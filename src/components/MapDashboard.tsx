import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import ControlTower, { type VehicleLive } from './ControlTower'
import FinancialSummary from './FinancialSummary'
import type { SchoolScheduleRow } from './SchoolSchedulesTab'
import type { TripRow } from './TripTable'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabase'
import './MapDashboard.css'

const API_BASE_URL = 'http://localhost:3000/api/v1'
const SOCKET_URL = 'http://localhost:3000'
const TripTable = lazy(() => import('./TripTable'))
const SchoolSchedulesTab = lazy(() => import('./SchoolSchedulesTab'))

export default function MapDashboard() {
  const [vehicles, setVehicles] = useState<VehicleLive[]>([])
  const [trips, setTrips] = useState<TripRow[]>([])
  const [schedules, setSchedules] = useState<SchoolScheduleRow[]>([])
  const [activeTab, setActiveTab] = useState<'operacoes' | 'escolar'>('operacoes')
  const [message, setMessage] = useState<string | null>(null)
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
    async function loadInitial() {
      const { data: tripRows } = await supabase
        .from('trips')
        .select('id,status,quoted_price,final_price,service_id,driver_id,passenger_id,requested_at')
        .order('requested_at', { ascending: false })
        .limit(80)

      const { data: services } = await supabase.from('services').select('id,code')
      const serviceMap = new Map((services ?? []).map((item) => [item.id as string, item.code as TripRow['serviceType']]))

      setTrips(
        (tripRows ?? []).map((row) => ({
          id: String(row.id),
          status: String(row.status ?? 'REQUESTED').toUpperCase(),
          serviceType: serviceMap.get(String(row.service_id)) ?? 'taxi',
          driverName: row.driver_id ? `Driver ${String(row.driver_id).slice(0, 6)}` : 'Aguardando',
          customerName: row.passenger_id ? `Cliente ${String(row.passenger_id).slice(0, 6)}` : 'Cliente',
          valueCents: Math.round(Number(row.final_price ?? row.quoted_price ?? 0) * 100),
        })),
      )

      const { data: schedulesRows } = await supabase
        .from('family_schedules')
        .select('id,pickup_address,destination_address,pickup_time,created_at,is_active')
        .limit(60)

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
    }

    void loadInitial()
  }, [])

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
          Torre de operações AG-PILOTO com monitoramento ao vivo, intervenção e gestão financeira.
        </p>
      </header>

      <div className="map-dashboard__layout">
        <div className="map-dashboard__main">
          <ControlTower vehicles={vehicles} />
          <div className="map-dashboard__tabs">
            <button type="button" className={activeTab === 'operacoes' ? 'is-active' : ''} onClick={() => setActiveTab('operacoes')}>
              Operações
            </button>
            <button type="button" className={activeTab === 'escolar' ? 'is-active' : ''} onClick={() => setActiveTab('escolar')}>
              Agendamentos Escolares
            </button>
          </div>
          <Suspense fallback={<p className="map-dashboard__message">A carregar módulo da aba...</p>}>
            {activeTab === 'operacoes' ? (
              <TripTable
                trips={trips}
                onForceCancel={async (tripId) => runAction(tripId, 'cancel')}
                onReassign={async (tripId) => runAction(tripId, 'reassign')}
              />
            ) : (
              <SchoolSchedulesTab rows={schedules} />
            )}
          </Suspense>
        </div>
        <FinancialSummary
          completedToday={financial.completedToday}
          totalCommissionCents={financial.totalCommissionCents}
          payoutAvailableCents={financial.payoutAvailableCents}
        />
      </div>

      {loading ? <p className="map-dashboard__message">Validando sessão...</p> : null}
      {message ? <p className="map-dashboard__message">{message}</p> : null}
    </section>
  )
}
