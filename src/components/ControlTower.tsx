import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './ControlTower.css'
import { supabase } from '../lib/supabase'
import { Howl } from 'howler'
import { MapPin, Bike, Car, Truck } from 'lucide-react'
import { isValidLuandaCoordinate, formatCurrency } from '../lib/geoUtils'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import FretesTab from './FretesTab'
import { iconeUsuario, iconeDestino } from '../lib/mapIcons'

// Helper function to format currency
const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export type Trip = {
  id: string
  created_at: string
  origin_address: string
  destination_address: string
  origin_lat?: number
  origin_lng?: number
  destination_lat?: number
  destination_lng?: number
  status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'ASSIGNED'
  client_name: string
  client_phone: string
  service_type: 'moto' | 'carro' | 'caminhao'
  quoted_price: number | null
  geocoded_lat?: number
  geocoded_lng?: number
  new?: boolean
  _isOutsideLuanda?: boolean
  driver_name?: string
}

type VehicleType = 'taxi' | 'familiar' | 'frete'
type MarkerType = VehicleType | 'origin' | 'destination'

export type VehicleLive = {
  id: string
  lat: number
  lng: number
  type: VehicleType
  label: string
  updatedAt: number
}

type Props = {
  vehicles: VehicleLive[]
  onSelectFrete?: (frete: any) => void
  selectedFreteId?: string
  selectedTrip?: Trip | null
  onAcceptTrip?: (tripId: string) => Promise<void>
}

function buildVehicleIcon(type: VehicleType) {
  const colors: Record<VehicleType, string> = {
    taxi: '#2563eb',
    familiar: '#7c3aed',
    frete: '#ea580c',
  }
  const symbols: Record<VehicleType, string> = {
    taxi: 'T',
    familiar: 'F',
    frete: 'C',
  }

  return L.divIcon({
    className: `vehicle-icon vehicle-icon--${type}`,
    html: `<div style="background-color: ${colors[type]}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">${symbols[type]}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; isFallback?: boolean } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}, Luanda, Angola&format=json&limit=1&countrycodes=ao&viewbox=13.0,-8.4,13.6,-9.3&bounded=1`,
    )
    const data = await response.json()
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat)
      const lng = parseFloat(data[0].lon)
      if (isValidLuandaCoordinate(lat, lng)) {
        return { lat, lng }
      } else {
        console.warn(`Geocoded coordinates for ${address} are outside Luanda boundaries. Using default center.`) // Log warning
        return { lat: -8.8149, lng: 13.2306, isFallback: true } // Default to Luanda center, indicating it's a fallback
      }
    }
    return null
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

function buildTripIcon() {
  return L.divIcon({
    className: 'trip-icon',
    html: '<div style="display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function buildUserMarkerIcon() {
  return L.divIcon({
    className: 'user-marker-icon',
    html: '<div class="user-marker-pulse"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

const createOriginIcon = () => {
  return L.divIcon({
    className: 'custom-origin-icon',
    html: '<div style="background-color: green; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white;">A</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-destination-icon',
    html: '<div style="background-color: red; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white;">B</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function ServiceIcon({ serviceType }: { serviceType: Trip['service_type'] }) {
  switch (serviceType) {
    case 'moto':
      return <Bike size={20} className="service-icon" />
    case 'carro':
      return <Car size={20} className="service-icon" />
    case 'caminhao':
      return <Truck size={20} className="service-icon" />
    default:
      return null
  }
}

function ControlTower({ vehicles, onSelectFrete, selectedFreteId, selectedTrip: externalSelectedTrip, onAcceptTrip }: Props) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [internalSelectedTrip, setInternalSelectedTrip] = useState<Trip | null>(null) // New state for selected trip
  const selectedTrip = externalSelectedTrip ?? internalSelectedTrip
  const sound = useRef<Howl | null>(null)
  const [route, setRoute] = useState<Array<[number, number]>>([])
  const [routeLoading, setRouteLoading] = useState<boolean>(false)
  const [isLoadingTrips, setIsLoadingTrips] = useState<boolean>(true) // New loading state for trips
  const [activeTab, setActiveTab] = useState<'trips' | 'fretes'>('trips')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'cancelled'>('all')
  const [fretes, setFretes] = useState<any[]>([])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b'
      case 'accepted':
        return '#3b82f6'
      case 'completed':
        return '#10b981'
      case 'cancelled':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente'
      case 'accepted':
        return 'Atribuída'
      case 'completed':
        return 'Concluída'
      case 'cancelled':
        return 'Cancelada'
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredTrips = statusFilter === 'all' 
    ? trips 
    : trips.filter(trip => trip.status === statusFilter)

  const statusCounts = {
    all: trips.length,
    pending: trips.filter(t => t.status === 'pending').length,
    accepted: trips.filter(t => t.status === 'accepted').length,
    completed: trips.filter(t => t.status === 'completed').length,
    cancelled: trips.filter(t => t.status === 'cancelled').length,
  }


  useEffect(() => {
    if (
      !selectedTrip ||
      !selectedTrip.origin_lat ||
      !selectedTrip.origin_lng ||
      !selectedTrip.destination_lat ||
      !selectedTrip.destination_lng
    ) {
      setRoute([])
      return
    }

    let isActive = true
    setRouteLoading(true)

    const pickupCoords: Coordinates = {
      lat: selectedTrip.origin_lat,
      lng: selectedTrip.origin_lng,
    }
    const dropoffCoords: Coordinates = {
      lat: selectedTrip.destination_lat,
      lng: selectedTrip.destination_lng,
    }

    fetchOsrmRoute(pickupCoords, dropoffCoords)
      .then((data) => {
        if (!isActive) return
        const distanceKm = data.distanceMeters / 1000
        if (distanceKm > 100) {
          console.warn('Route too long or outside Luanda. Aborting route display.', { distanceKm })
          setRoute([])
          setRouteLoading(false)
          return
        }

        const newRoute = data.geometry.map(([lng, lat]) => [lat, lng] as [number, number])
        setRoute(newRoute)

        if (mapRef.current && newRoute.length > 0) {
          const mapInstance = mapRef.current;
          const bounds = L.latLngBounds(newRoute.map((coord) => L.latLng(coord[0], coord[1])))
          bounds.extend(L.latLng(pickupCoords.lat, pickupCoords.lng))
          bounds.extend(L.latLng(dropoffCoords.lat, dropoffCoords.lng))
          mapInstance.fitBounds(bounds, { padding: [50, 50] })
        }
      })
      .catch((error) => {
        console.error('Error fetching route:', error)
        if (!isActive) return
        setRoute([])
      })
      .finally(() => {
        if (isActive) setRouteLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [selectedTrip])

  const handleAcceptTrip = async (tripId: string) => {
    console.log('🔧 ADMIN DEBUG: Accepting trip', tripId)
    
    setTrips(prev => prev.map(t =>
      t.id === tripId ? { ...t, status: 'ASSIGNED' } : t
    ))

    const { error } = await supabase
      .from('trips')
      .update({ status: 'ASSIGNED' })
      .eq('id', tripId)

    if (error) {
      console.error('❌ ADMIN ERROR: Error accepting trip:', error)
      // Optionally, show a user-friendly error message
    } else {
      // The `UPDATE` event listener will handle state update automatically
      console.log(`✅ ADMIN SUCCESS: Trip ${tripId} accepted with status ASSIGNED.`)
      if (selectedTrip?.id === tripId) {
        setInternalSelectedTrip(null) // Clear selected trip if accepted trip was selected
      }
    }
  }

  useEffect(() => {
    // Initialize Howl object once when component mounts
    try {
      sound.current = new Howl({
        src: ['/notification.mp3'],
        html5: true,
        volume: 0.5,
      })
    } catch (error) {
      console.error('Error initializing sound:', error)
    }

    const fetchActiveTrips = async () => {
      setIsLoadingTrips(true)
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching trips:', error)
      } else if (data) {
        // Geocode addresses for initial trips if needed (similar to realtime insert)
        const tripsWithGeocoded = await Promise.all(data.map(async (trip) => {
          if (trip.origin_address) { // Always try to geocode if address exists
            const coords = await geocodeAddress(trip.origin_address)
            if (coords && !coords.isFallback) {
              return { ...trip, geocoded_lat: coords.lat, geocoded_lng: coords.lng }
            } else if (coords && coords.isFallback) {
              // If it's a fallback, we mark it to be filtered out later if the original address was truly outside
              return { ...trip, geocoded_lat: coords.lat, geocoded_lng: coords.lng, _isOutsideLuanda: true }
            }
          }
          return trip
        }))
        // Filter out trips that were marked as being outside Luanda (after geocoding fallback)
        setTrips(tripsWithGeocoded.filter(trip => !trip._isOutsideLuanda) as Trip[])
      }
      setIsLoadingTrips(false)
    }

    fetchActiveTrips()

    // Fetch fretes data
    const fetchFretes = async () => {
      const { data, error } = await supabase
        .from('fretes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching fretes:', error)
      } else if (data) {
        setFretes(data)
      }
    }

    fetchFretes()

    const channel = supabase
      .channel('control-tower-trips')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trips' },
        async (payload) => {
          let newTrip = payload.new as Trip
          if (newTrip.origin_address) {
            const coords = await geocodeAddress(newTrip.origin_address)
            if (coords && !coords.isFallback) {
              newTrip.geocoded_lat = coords.lat
              newTrip.geocoded_lng = coords.lng
            } else if (coords && coords.isFallback) {
              newTrip = { ...newTrip, geocoded_lat: coords.lat, geocoded_lng: coords.lng, _isOutsideLuanda: true }
            } else {
              // If geocoding completely fails, still mark for filtering
              newTrip = { ...newTrip, _isOutsideLuanda: true }
            }
          }
          // Only add if not marked as outside Luanda
          if (!newTrip._isOutsideLuanda) {
            setTrips((prevTrips) => [{
              ...newTrip,
              new: true, // Mark as new for animation
            }, ...prevTrips]);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        (payload) => {
          const updatedTrip = payload.new as Trip
          setTrips((prevTrips) => {
            // If the updated trip is completed or cancelled, remove it from the list
            if (updatedTrip.status === 'completed' || updatedTrip.status === 'cancelled') {
              return prevTrips.filter((trip) => trip.id !== updatedTrip.id)
            }
            // Otherwise, update the existing trip or add it if it's new (shouldn't happen with this filter)
            const index = prevTrips.findIndex((trip) => trip.id === updatedTrip.id)
            if (index > -1) {
              const newTrips = [...prevTrips]
              newTrips[index] = updatedTrip
              return newTrips
            } else {
              // If an updated trip is not found, and it's not completed/cancelled,
              // it might be a trip that was inserted and then updated quickly before
              // the insert event was processed, or a trip that changed status from
              // completed/cancelled to something else (unlikely but handle defensively)
              return [updatedTrip, ...prevTrips] // Prepend and let the next re-render sort
            }
          })
          if (selectedTrip?.id === updatedTrip.id && (updatedTrip.status === 'completed' || updatedTrip.status === 'cancelled')) {
            setInternalSelectedTrip(null) // Clear selected trip if it was completed/cancelled
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fretes' },
        async (payload) => {
          setFretes((prevFretes) => [payload.new, ...prevFretes])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fretes' },
        (payload) => {
          setFretes((prevFretes) => {
            const index = prevFretes.findIndex((f) => f.id === payload.new.id)
            if (index > -1) {
              const newFretes = [...prevFretes]
              newFretes[index] = payload.new
              return newFretes
            }
            return prevFretes
          })
        },
      )
      .subscribe()

    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      channel.unsubscribe()
    }
  }, []) // Empty dependency array means this effect runs once on mount and cleans up on unmount

  useEffect(() => {
    const newTrips = trips.filter((trip) => trip.new)
    if (newTrips.length > 0) {
      // Play sound
      if (sound.current && sound.current.state() === 'loaded') { // Check if sound is loaded
        sound.current.play()
      }

      // Remove 'new' flag after a delay
      const timer = setTimeout(() => {
        setTrips((prevTrips) =>
          prevTrips.map((trip) => ({
            ...trip,
            new: false,
          })),
        )
      }, 3000) // 3 seconds

      return () => clearTimeout(timer)
    }
  }, [trips])

  const mapRef = useRef<L.Map>(null) // Adicionar ref para o mapa

  const center = useMemo<[number, number]>(() => {
    if (selectedTrip && selectedTrip.geocoded_lat && selectedTrip.geocoded_lng) {
      return [selectedTrip.geocoded_lat, selectedTrip.geocoded_lng]
    }
    if (vehicles.length === 0) return [-8.8383, 13.2344] // Default to Luanda
    const sample = vehicles[Math.min(vehicles.length - 1, 2)]
    return [sample.lat, sample.lng]
  }, [vehicles, selectedTrip])

  const markers = useMemo(() => {
    let allMarkers: Array<{
      id: string
      position: L.LatLngExpression
      icon: L.DivIcon
      label: string
      type: MarkerType
    }> = vehicles
      .filter((vehicle) => isValidLuandaCoordinate(vehicle.lat, vehicle.lng))
      .map((vehicle) => ({
        id: vehicle.id,
        position: [vehicle.lat, vehicle.lng] as L.LatLngExpression,
        icon: buildVehicleIcon(vehicle.type),
        label: vehicle.label,
        type: vehicle.type,
      }))

    if (selectedTrip) {
      if (selectedTrip.origin_lat && selectedTrip.origin_lng && isValidLuandaCoordinate(selectedTrip.origin_lat, selectedTrip.origin_lng)) {
        allMarkers.push({
          id: 'origin',
          position: [selectedTrip.origin_lat, selectedTrip.origin_lng],
          icon: iconeUsuario,
          label: selectedTrip.origin_address,
          type: 'origin',
        })
      }
      if (selectedTrip.destination_lat && selectedTrip.destination_lng && isValidLuandaCoordinate(selectedTrip.destination_lat, selectedTrip.destination_lng)) {
        allMarkers.push({
          id: 'destination',
          position: [selectedTrip.destination_lat, selectedTrip.destination_lng],
          icon: iconeDestino,
          label: selectedTrip.destination_address,
          type: 'destination',
        })
      }
    }

    return allMarkers
  }, [vehicles, selectedTrip])

  return (
    <section className="control-tower">
      <div className="control-tower__sidebar">
        <div className="sidebar-tabs">
          <button
            className={`tab-button ${activeTab === 'trips' ? 'active' : ''}`}
            onClick={() => setActiveTab('trips')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
              <path d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            Pedidos
          </button>
          <button
            className={`tab-button ${activeTab === 'fretes' ? 'active' : ''}`}
            onClick={() => setActiveTab('fretes')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
              <rect x="2" y="8" width="13" height="8" rx="1" />
              <path d="M15 12h4l2-4v8h-6v-4z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
            Fretes
          </button>
        </div>
        
        {activeTab === 'trips' ? (
          <>
            <h3>Pedidos</h3>
            <div className="status-filters">
              <button
                className={`status-filter ${statusFilter === 'all' ? 'status-filter--active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Todos ({statusCounts.all})
              </button>
              <button
                className={`status-filter ${statusFilter === 'pending' ? 'status-filter--active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                Pendentes ({statusCounts.pending})
              </button>
              <button
                className={`status-filter ${statusFilter === 'accepted' ? 'status-filter--active' : ''}`}
                onClick={() => setStatusFilter('accepted')}
              >
                Atribuídas ({statusCounts.accepted})
              </button>
              <button
                className={`status-filter ${statusFilter === 'completed' ? 'status-filter--active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                Concluídas ({statusCounts.completed})
              </button>
              <button
                className={`status-filter ${statusFilter === 'cancelled' ? 'status-filter--active' : ''}`}
                onClick={() => setStatusFilter('cancelled')}
              >
                Canceladas ({statusCounts.cancelled})
              </button>
            </div>
            <div className="trip-cards-container">
              {isLoadingTrips ? (
                <p className="loading-message">Carregando pedidos...</p>
              ) : filteredTrips.length === 0 ? (
                <p className="no-trips-message">Nenhum pedido encontrado</p>
              ) : (
                filteredTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className={`trip-card ${trip.new ? 'new-trip-item' : ''} ${selectedTrip?.id === trip.id ? 'trip-card--selected' : ''}`}
                    onClick={(e) => {
                      e.preventDefault() // Previne o comportamento padrão do clique (se houver)
                      e.stopPropagation() // Impede a propagação do evento
                      setInternalSelectedTrip(trip)
                    }}
                  >
                    <div className="trip-card-header">
                      <ServiceIcon serviceType={trip.service_type} />
                      <span
                        className="trip-status-badge"
                        style={{ backgroundColor: getStatusColor(trip.status) }}
                      >
                        {getStatusLabel(trip.status)}
                      </span>
                      {trip.new && <span className="new-trip-badge"></span>}
                    </div>
                    <div className="trip-card-body">
                      <p className="trip-card-date">{formatDate(trip.created_at)}</p>
                      <p>De: {trip.origin_address}</p>
                      <p>Para: {trip.destination_address}</p>
                      <p>Preço: {formatPrice(trip.quoted_price)}</p>
                      {trip.driver_name && <p>Motorista: {trip.driver_name}</p>}
                    </div>
                    {trip.status === 'pending' && (
                      <div className="trip-card-actions">
                        <button type="button" className="accept-button" onClick={() => handleAcceptTrip(trip.id)}>Aceitar</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <FretesTab fretes={fretes} onSelectFrete={onSelectFrete} selectedFreteId={selectedFreteId} />
        )}
      </div>
      <div className="control-tower__main-content">
        <div className="control-tower__header">
          <h3>Monitoramento em tempo real</h3>
          <p>{vehicles.length} ativos no mapa</p>
        </div>
        <MapContainer ref={mapRef} center={center} zoom={12} scrollWheelZoom className="control-tower__map" zoomControl={false} maxBounds={[[-9.30, 13.00], [-8.40, 13.60]]}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />
            {markers.map((marker) => (
              <Marker key={marker.id} position={marker.position} icon={marker.icon}>
                <Popup>
                  <strong>{marker.label}</strong>
                  <br />
                  Tipo: {marker.type}
                </Popup>
              </Marker>
            ))}
            {route.length > 0 && <Polyline positions={route} color="#2563eb" weight={5} />}
        </MapContainer>
      </div>
    </section>
  )
}
export default memo(ControlTower)
