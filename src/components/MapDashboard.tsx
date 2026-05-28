import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import ControlTower, { type VehicleLive } from './ControlTower'
import FinancialSummary from './FinancialSummary'
import type { SchoolScheduleRow } from './SchoolSchedulesTab'
import type { TripRow } from './TripTable'
import FretesTab from './FretesTab'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabase'
import './MapDashboard.css'

const API_BASE_URL = 'http://localhost:3000/api/v1'
const SOCKET_URL = 'http://localhost:3000'
const TripTable = lazy(() => import('./TripTable'))
const SchoolSchedulesTab = lazy(() => import('./SchoolSchedulesTab'))

const TRIPS_PAGE_SIZE = 8

export default function MapDashboard() {
  const [vehicles, setVehicles] = useState<VehicleLive[]>([])
  const [trips, setTrips] = useState<TripRow[]>([])
  const [schedules, setSchedules] = useState<SchoolScheduleRow[]>([])
  const [fretes, setFretes] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'operacoes' | 'fretes'>('operacoes')
  const [message, setMessage] = useState<string | null>(null)
  const [selectedFreteId, setSelectedFreteId] = useState<string | undefined>(undefined)
  const [selectedTripExternal, setSelectedTripExternal] = useState<any>(null)
  const [tripsPage, setTripsPage] = useState(1)
  const [tripsTotal, setTripsTotal] = useState(0)
  const { token, loading } = useAuthSession()
  const fallbackAdminId = useMemo(() => localStorage.getItem('ag_admin_id') ?? 'admin-demo-id', [])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    })

    socket.emit('user:join', { userId: fallbackAdminId })
    socket.emit('admin:join')

    socket.on('driver:location:update', (payload: { driverId: string; lat: number; lng: number; vehicleClass: 'MOTO' | 'CUPAPATA' }) => {
      setVehicles((prev) => {
        const nextType: VehicleLive['type'] = payload.vehicleClass === 'CUPAPATA' ? 'frete' : 'taxi'
        const next = prev.filter((vehicle) => vehicle.id !== payload.driverId)
        next.push({
          id: payload.driverId,
          label: `Motorista ${payload.driverId.slice(0, 6)}`,
          lat: payload.lat,
          lng: payload.lng,
          type: nextType,
          updatedAt: Date.now(),
        })
        return next
      })
    })

    socket.on('trip:status', (payload: { tripId: string; status: string; driverId?: string }) => {
      setTrips((prev) =>
        prev.map((trip) =>
          trip.id === payload.tripId
            ? { ...trip, status: payload.status, driverName: payload.driverId ? `Driver ${payload.driverId.slice(0, 6)}` : trip.driverName }
            : trip,
        ),
      )
    })

    socket.on('new_trip_offer', (payload: { tripId: string; serviceKind: string; priceCents: number }) => {
      setTrips((prev) => {
        if (prev.some((trip) => trip.id === payload.tripId)) return prev
        return [
          {
            id: payload.tripId,
            status: 'REQUESTED',
            serviceType: payload.serviceKind.toLowerCase() as TripRow['serviceType'],
            driverName: 'Aguardando',
            customerName: 'Cliente',
            valueCents: payload.priceCents,
          },
          ...prev,
        ]
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [fallbackAdminId])

  useEffect(() => {
    const channel = supabase
      .channel('fretes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fretes' }, (payload) => {
        setFretes((prev) => [payload.new as any, ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    async function loadInitial() {
      console.time('total loadInitial')
      console.time('services')
      console.time('schedules')
      console.time('fretes')

      const [
        { data: services },
        { data: schedulesRows },
        { data: fretesRows },
      ] = await Promise.all([
        supabase.from('services').select('id,code'),
        supabase
          .from('family_schedules')
          .select('id,pickup_address,destination_address,pickup_time,created_at,is_active')
          .limit(60),
        supabase
          .from('fretes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      console.timeEnd('services')
      console.timeEnd('schedules')
      console.timeEnd('fretes')

      setSchedules(
        (schedulesRows ?? []).map((row) => ({
          id: String(row.id),
          route: `${String(row.pickup_address)} -> ${String(row.destination_address)}`,
          status: row.is_active ? 'pendente' : 'concluida',
          scheduledAt: new Date(`${new Date().toDateString()} ${String(row.pickup_time)}`).toISOString(),
          startedAt: null,
          lastProgressAt: row.created_at ? String(row.created_at) : null,
        })),
      )

      setFretes(fretesRows ?? [])

      console.timeEnd('total loadInitial')
    }

    void loadInitial()
  }, [])

  const loadTrips = useCallback(async () => {
    console.time('trips')
    const from = (tripsPage - 1) * TRIPS_PAGE_SIZE
    const to = from + TRIPS_PAGE_SIZE - 1

    const { data: tripRows, count } = await supabase
      .from('trips')
      .select('id,status,quoted_price,final_price,service_id,driver_id,passenger_id,requested_at,metadata,origin_lat,origin_lng,destination_lat,destination_lng,origin_address,destination_address', { count: 'exact' })
      .order('requested_at', { ascending: false })
      .range(from, to)

    console.timeEnd('trips')

    const { data: services } = await supabase.from('services').select('id,code')
    const serviceMap = new Map((services ?? []).map((item) => [item.id as string, item.code as TripRow['serviceType']]))

    setTrips(
      (tripRows ?? []).map((row) => {
        const serviceTypeFromMetadata = (row.metadata as any)?.service_type as string
        const serviceType = (serviceTypeFromMetadata as TripRow['serviceType']) || (serviceMap.get(String(row.service_id)) ?? 'taxi')

        return {
          id: String(row.id),
          status: String(row.status ?? 'REQUESTED').toUpperCase(),
          serviceType: serviceType as TripRow['serviceType'],
          driverName: row.driver_id ? `Driver ${String(row.driver_id).slice(0, 6)}` : 'Aguardando',
          customerName: row.passenger_id ? `Cliente ${String(row.passenger_id).slice(0, 6)}` : 'Cliente',
          valueCents: Math.round(Number(row.final_price ?? row.quoted_price ?? 0) * 100),
          origin_lat: row.origin_lat ? Number(row.origin_lat) : undefined,
          origin_lng: row.origin_lng ? Number(row.origin_lng) : undefined,
          destination_lat: row.destination_lat ? Number(row.destination_lat) : undefined,
          destination_lng: row.destination_lng ? Number(row.destination_lng) : undefined,
        }
      }),
    )

    setTripsTotal(count ?? 0)
  }, [tripsPage])

  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  useEffect(() => {
    const channel = supabase
      .channel('trips-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          void loadTrips()
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [loadTrips])

  const financial = useMemo(() => {
    const todayKey = new Date().toDateString()
    const completedToday = trips.filter((trip) => trip.status === 'COMPLETED').length
    const totalCommissionCents = trips
      .filter((trip) => trip.status === 'COMPLETED' && new Date().toDateString() === todayKey)
      .reduce((acc, trip) => acc + Math.round(trip.valueCents * 0.15), 0)
    const payoutAvailableCents = trips
      .filter((trip) => trip.status === 'COMPLETED')
      .reduce((acc, trip) => acc + Math.round(trip.valueCents * 0.85), 0)

    return { completedToday, totalCommissionCents, payoutAvailableCents }
  }, [trips])

  const handleSelectFrete = useCallback((frete: any) => {
    setSelectedFreteId(frete.id)
    setSelectedTripExternal({
      id: frete.id,
      status: frete.status,
      service_type: 'frete',
      driver_name: 'Aguardando',
      client_name: frete.whatsapp || 'Cliente',
      client_phone: frete.whatsapp || '',
      quoted_price: frete.quoted_price,
      origin_address: frete.origem_address,
      destination_address: frete.destino_address,
      origin_lat: frete.origem_lat,
      origin_lng: frete.origem_lng,
      destination_lat: frete.destino_lat,
      destination_lng: frete.destino_lng,
      created_at: frete.created_at,
    })
  }, [])

  const handleAcceptTrip = useCallback(async (tripId: string) => {
    // Actualiza estado local imediatamente
    setTrips(prev => prev.map(t =>
      t.id === tripId ? { ...t, status: 'ASSIGNED' } : t
    ))
    // Fallback ao Supabase
    await supabase
      .from('trips')
      .update({ status: 'ASSIGNED' })
      .eq('id', tripId)
  }, [])

  const runAction = useCallback(async (tripId: string, type: 'cancel' | 'reassign') => {
    if (!token) {
      setMessage('Sessão inválida. Faça login para intervir nas corridas.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/trips/${tripId}/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error(type === 'cancel' ? 'Falha ao forçar cancelamento.' : 'Falha ao reatribuir corrida.')
      }
      setMessage(type === 'cancel' ? 'Corrida cancelada pela central.' : 'Corrida enviada para reatribuição.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ação não concluída.')
    }
  }, [token])

  return (
    <section className="map-dashboard">
      <header className="map-dashboard__header">
        <h2 className="map-dashboard__title">Base de Controle Central</h2>
        <p className="map-dashboard__subtitle">
          Torre de operações AG-PILOTO com monitoramento ao vivo e intervenção.
        </p>
      </header>

      <div className="map-dashboard__layout">
        <div className="map-dashboard__main">
          <ControlTower vehicles={vehicles} onSelectFrete={handleSelectFrete} selectedFreteId={selectedFreteId} selectedTrip={selectedTripExternal} onTripSelect={(trip) => setSelectedTripExternal(trip)} onAcceptTrip={handleAcceptTrip} />
          <div className="map-dashboard__tabs">
            <button type="button" className={activeTab === 'operacoes' ? 'is-active' : ''} onClick={() => setActiveTab('operacoes')}>
              Pedidos
            </button>
            <button type="button" className={activeTab === 'fretes' ? 'is-active' : ''} onClick={() => setActiveTab('fretes')}>
              Fretes
            </button>
          </div>
          <Suspense fallback={<p className="map-dashboard__message">A carregar módulo da aba...</p>}>
            {activeTab === 'operacoes' ? (
              <TripTable
                trips={trips}
                onForceCancel={async (tripId) => runAction(tripId, 'cancel')}
                onReassign={async (tripId) => runAction(tripId, 'reassign')}
                page={tripsPage}
                setPage={setTripsPage}
                total={tripsTotal}
                pageSize={TRIPS_PAGE_SIZE}
              />
            ) : (
              <FretesTab fretes={fretes} />
            )}
          </Suspense>
        </div>
      </div>

      {loading ? <p className="map-dashboard__message">Validando sessão...</p> : null}
      {message ? <p className="map-dashboard__message">{message}</p> : null}
    </section>
  )
}
