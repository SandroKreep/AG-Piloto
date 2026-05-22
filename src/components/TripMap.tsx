import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isValidLuandaCoordinate, reverseGeocodeCoordinates } from '../lib/geoUtils'
import { useAuthStore } from '../store/authStore'

import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import DriverTracking from './DriverTracking'
import './TripMap.css'

import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
import marker from 'leaflet/dist/images/marker-icon.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'
import { iconeUsuario, iconeDestino } from '../lib/mapIcons'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker,
  shadowUrl: shadow,
})

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const createOriginIcon = () => {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: #16a34a;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">A</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-destination-icon',
    html: '<div style="background-color: red; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">D</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
};

function MapClickHandler({
  setDestinationCoords,
  setDestinationAddress,
  setShowLocationWarning,
  destinationMarkerRef,
  routeLayerRef,
  setRoute,
  setStats,
}: {
  setDestinationCoords: (coords: Coordinates | null) => void
  setDestinationAddress: (address: string | null) => void
  setShowLocationWarning: (show: boolean) => void
  destinationMarkerRef: React.MutableRefObject<L.Marker | null>
  routeLayerRef: React.MutableRefObject<L.Polyline | null>
  setRoute: (route: Array<[number, number]>) => void
  setStats: (stats: { distanceKm: number; durationMin: number } | null) => void
}) {
  const map = useMap();
  const { user, setShowAuthModal } = useAuthStore();

  useEffect(() => {
    const onClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (!isValidLuandaCoordinate(lat, lng)) {
        setShowLocationWarning(true);
        setDestinationCoords(null);
        setDestinationAddress(null);
        return;
      }

      // Remove marcador anterior se existir
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }

      // Limpa rota anterior
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }

      // Limpa estados anteriores
      setRoute([])
      setStats(null)

      // Check if user is logged in
      if (!user) {
        setShowAuthModal(true, () => {
          // After login, retry the click action
          setShowLocationWarning(false);
          setDestinationCoords({ lat, lng });
          reverseGeocodeCoordinates(lat, lng).then((address) => {
            if (address) {
              setDestinationAddress(address);
            } else {
              setDestinationAddress('Localização desconhecida');
            }
          });
        });
        return;
      }

      setShowLocationWarning(false);
      setDestinationCoords({ lat, lng });

      const address = await reverseGeocodeCoordinates(lat, lng);
      if (address) {
        setDestinationAddress(address);
      } else {
        setDestinationAddress('Localização desconhecida');
      }
    };
    map.on('click', onClick);

    return () => {
      map.off('click', onClick);
    };
  }, [map, setDestinationCoords, setDestinationAddress, setShowLocationWarning, user, setShowAuthModal, destinationMarkerRef, routeLayerRef, setRoute, setStats]);
  return null;
}

function MyLocationMarker({ activeTripId, setOriginCoords, setGpsCoords }: { activeTripId: string | null; setOriginCoords: (coords: Coordinates) => void; setGpsCoords: (coords: Coordinates | null) => void }) {
  const [position, setPosition] = useState<L.LatLngExpression | null>(null)
  const [showLocationWarning, setShowLocationWarning] = useState(false) // New state for warning
  const map = useMap()
  const mapCentradoRef = useRef(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      console.log('Geolocation is not supported by your browser')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        if (!isValidLuandaCoordinate(latitude, longitude)) {
          setShowLocationWarning(true)
          // Do not update position or move map if outside Luanda
          return
        } else {
          setShowLocationWarning(false)
        }

        const newPos: L.LatLngExpression = [latitude, longitude]
        setPosition(newPos)
        setOriginCoords({ lat: latitude, lng: longitude }); // Update origin in parent
        setGpsCoords({ lat: latitude, lng: longitude }); // Update GPS coordinates

        // Only center map on first GPS position
        if (!mapCentradoRef.current) {
          map.setView([latitude, longitude], 15)
          mapCentradoRef.current = true
        }

        if (activeTripId) {
          const { error } = await supabase
            .from('trips')
            .update({ origin_lat: latitude, origin_lng: longitude })
            .eq('id', activeTripId)

          if (error) {
            console.error('Error updating trip location:', error)
          }
        }
      },
      (error) => {
        console.error('Error getting location:', error)
        setShowLocationWarning(true) // Show warning on GPS error as well
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map, activeTripId, setOriginCoords])

  return (
    <>
      {showLocationWarning && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'red', color: 'white', padding: '5px 10px', borderRadius: '5px', zIndex: 1000 }}>
          Localização fora da área de serviço
        </div>
      )}
      {position === null ? null : (
        <Marker position={position} icon={iconeUsuario}>
          <Popup>Você está aqui</Popup>
        </Marker>
      )}
    </>
  )
}



type Props = {
  destinationCoords: Coordinates | null
  setDestinationCoords: (coords: Coordinates | null) => void
  destinationAddress: string | null
  setDestinationAddress: (address: string | null) => void
  originCoords: Coordinates | null
  setOriginCoords: (coords: Coordinates | null) => void
  route: Array<[number, number]>
  stats: { distanceKm: number; durationMin: number } | null
  resetMap?: boolean
  onReset?: () => void
}

type Trip = {
  id: string
  created_at: string
  origin_address: string
  destination_address: string
  origin_lat?: number
  origin_lng?: number
  destination_lat?: number
  destination_lng?: number
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  client_name: string
  client_phone: string
  service_type: 'moto' | 'carro' | 'caminhao'
  quoted_price: number | null
  geocoded_lat?: number
  geocoded_lng?: number
  new?: boolean
  driver_id?: string
  driver_lat?: number
  driver_lng?: number
}

export default function TripMap({ destinationCoords, setDestinationCoords, destinationAddress, setDestinationAddress, originCoords, setOriginCoords, resetMap }: Props) {

  const [route, setRoute] = useState<Array<[number, number]>>([])
  const [stats, setStats] = useState<{ distanceKm: number; durationMin: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [showLocationWarning, setShowLocationWarning] = useState(false) // State for 'Destino fora da área de atuação'
  const [gpsCoords, setGpsCoords] = useState<Coordinates | null>(null) // Track GPS coordinates

  const mapRef = useRef<L.Map>(null); // Add map ref
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const center = useMemo<[number, number]>(
    () => {
      const defaultCenter: [number, number] = [-8.8399, 13.2894] // Default to Luanda

      if (activeTrip && activeTrip.origin_lat && activeTrip.origin_lng && activeTrip.destination_lat && activeTrip.destination_lng) {
        const originValid = isValidLuandaCoordinate(activeTrip.origin_lat, activeTrip.origin_lng)
        const destValid = isValidLuandaCoordinate(activeTrip.destination_lat, activeTrip.destination_lng)

        if (originValid && destValid) {
          return [
            (activeTrip.origin_lat + activeTrip.destination_lat) / 2,
            (activeTrip.origin_lng + activeTrip.destination_lng) / 2,
          ]
        }
      }
      return defaultCenter
    },
    [activeTrip],
  )

  // Effect to load active trip from localStorage on mount
  useEffect(() => {
    const storedTripId = localStorage.getItem('activeTripId');
    if (storedTripId) {
      setActiveTripId(storedTripId);
    }
  }, []);

  // Effect to fetch active trip details from Supabase when activeTripId changes
  useEffect(() => {
    if (activeTripId) {
      const fetchActiveTrip = async () => {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', activeTripId)
          .single();

        if (error) {
          console.error('Error fetching active trip:', error);
          setActiveTrip(null);
          localStorage.removeItem('activeTripId'); // Clear invalid ID
        } else if (data) {
          setActiveTrip(data as Trip);
        }
      };
      fetchActiveTrip();

      // Set up real-time listener for the active trip (e.g., status changes)
      const channel = supabase
        .channel(`trip-${activeTripId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${activeTripId}` },
          (payload) => {
            setActiveTrip(payload.new as Trip);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [activeTripId]);

  // Effect to show route from originCoords and destinationCoords (before trip is submitted)
  useEffect(() => {
    if (originCoords && destinationCoords && !activeTripId) {
      let isActive = true
      setIsLoading(true)

      const pickupCoords: Coordinates = originCoords
      const dropoffCoords: Coordinates = destinationCoords

      fetchOsrmRoute(pickupCoords, dropoffCoords)
        .then((data) => {
          if (!isActive) return
          const newRoute = data.geometry.map(([lng, lat]) => [lat, lng] as [number, number]);
          setRoute(newRoute)
          setStats({
            distanceKm: Number((data.distanceMeters / 1000).toFixed(2)),
            durationMin: Number((data.durationSeconds / 60).toFixed(1)),
          })
          setError(null)

          // Fit bounds to the route
          if (mapRef.current && newRoute.length > 0) {
            const bounds = L.latLngBounds(newRoute.map(coord => L.latLng(coord[0], coord[1])));
            bounds.extend(L.latLng(pickupCoords.lat, pickupCoords.lng));
            bounds.extend(L.latLng(dropoffCoords.lat, dropoffCoords.lng));
            mapRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        })
        .catch(() => {
          if (!isActive) return
          setError('Não foi possível carregar a rota.')
          setStats(null)
        })
        .finally(() => {
          if (isActive) setIsLoading(false)
        })

      return () => {
        isActive = false
      }
    }
  }, [originCoords, destinationCoords, activeTripId])

  // Custom AntPath component for react-leaflet
  useEffect(() => {
    if (!activeTrip || !activeTrip.origin_lat || !activeTrip.origin_lng || !activeTrip.destination_lat || !activeTrip.destination_lng) {
      setRoute([]);
      setStats(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const originValid = isValidLuandaCoordinate(activeTrip.origin_lat, activeTrip.origin_lng);
    const destValid = isValidLuandaCoordinate(activeTrip.destination_lat, activeTrip.destination_lng);

    if (!originValid || !destValid) {
      setError('Origem ou destino fora da área de serviço de Luanda.');
      setRoute([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    let isActive = true
    setIsLoading(true)

    const pickupCoords: Coordinates = { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng };
    const dropoffCoords: Coordinates = { lat: activeTrip.destination_lat, lng: activeTrip.destination_lng };

    fetchOsrmRoute(pickupCoords, dropoffCoords)
      .then((data) => {
        if (!isActive) return
        const newRoute = data.geometry.map(([lng, lat]) => [lat, lng] as [number, number]);
        setRoute(newRoute)
        setStats({
          distanceKm: Number((data.distanceMeters / 1000).toFixed(2)),
          durationMin: Number((data.durationSeconds / 60).toFixed(1)),
        })
        setError(null) // Clear any previous error

        // Fit bounds to the route
        if (mapRef.current && newRoute.length > 0) {
          const bounds = L.latLngBounds(newRoute.map(coord => L.latLng(coord[0], coord[1])));
          bounds.extend(L.latLng(pickupCoords.lat, pickupCoords.lng));
          bounds.extend(L.latLng(dropoffCoords.lat, dropoffCoords.lng));
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      })
      .catch(() => {
        if (!isActive) return
        setError('Não foi possível carregar a rota.') // Mensagem de erro mais concisa
        setStats(null) // Clear stats on error
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [activeTrip])

  // Effect to manage destination marker imperatively
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing marker
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    // Add new marker if destination exists
    if (destinationCoords) {
      const marker = L.marker([destinationCoords.lat, destinationCoords.lng], {
        icon: iconeDestino
      }).addTo(mapRef.current);

      if (destinationAddress) {
        marker.bindPopup(destinationAddress);
      }

      destinationMarkerRef.current = marker;
    }

    return () => {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    };
  }, [destinationCoords, destinationAddress, mapRef.current]);

  // Effect to manage route layer imperatively
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    // Add new route if route exists
    if (route.length > 0) {
      const polyline = L.polyline(route, {
        color: '#007bff',
        weight: 5
      }).addTo(mapRef.current);

      routeLayerRef.current = polyline;
    }

    return () => {
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
    };
  }, [route]);

  // Effect to remove markers and route when both coords are null
  useEffect(() => {
    if (!originCoords && !destinationCoords) {
      // Remove marker de destino se existir
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove()
        destinationMarkerRef.current = null
      }
      // Remover rota se existir
      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }
    }
  }, [originCoords, destinationCoords])

  // Effect to reset map when resetMap prop is true
  useEffect(() => {
    if (resetMap) {
      setActiveTripId(null)
      setActiveTrip(null)
      setRoute([])
      setStats(null)
      setError(null)
      localStorage.removeItem('activeTripId')
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove()
        destinationMarkerRef.current = null
      }
      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }
    }
  }, [resetMap])

  return (
    <section className="trip-map" aria-label="Mapa de rota com Leaflet">
        <MapContainer ref={mapRef} center={center} zoom={13} scrollWheelZoom={false} className="trip-map__canvas">
          <MapClickHandler
            setDestinationCoords={setDestinationCoords}
            setDestinationAddress={setDestinationAddress}
            setShowLocationWarning={setShowLocationWarning}
            destinationMarkerRef={destinationMarkerRef}
            routeLayerRef={routeLayerRef}
            setRoute={setRoute}
            setStats={setStats}
          />
          {showLocationWarning && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'red',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '5px',
                zIndex: 1000,
              }}
            >
              Destino fora da área de atuação
            </div>
          )}
          {!destinationCoords && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '5px',
                zIndex: 1000,
              }}
            >
              Toque no mapa para escolher o destino
            </div>
          )}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="bottomright" />
          {activeTrip && activeTrip.origin_lat && activeTrip.origin_lng && isValidLuandaCoordinate(activeTrip.origin_lat, activeTrip.origin_lng) && (
            <Marker position={[activeTrip.origin_lat, activeTrip.origin_lng]} icon={createOriginIcon()}>
              <Popup>Origem: {activeTrip.origin_address}</Popup>
            </Marker>
          )}
          {activeTrip && activeTrip.destination_lat && activeTrip.destination_lng && isValidLuandaCoordinate(activeTrip.destination_lat, activeTrip.destination_lng) && (
            <Marker position={[activeTrip.destination_lat, activeTrip.destination_lng]} icon={iconeDestino}>
              <Popup>Destino: {activeTrip.destination_address}</Popup>
            </Marker>
          )}
          {originCoords && gpsCoords && 
           (Math.abs(originCoords.lat - gpsCoords.lat) > 0.0001 || 
            Math.abs(originCoords.lng - gpsCoords.lng) > 0.0001) && (
            <Marker position={[originCoords.lat, originCoords.lng]} icon={createOriginIcon()}>
              <Popup>Origem escolhida</Popup>
            </Marker>
          )}
          <MyLocationMarker activeTripId={activeTripId} setOriginCoords={setOriginCoords} setGpsCoords={setGpsCoords} />
          {activeTrip && activeTrip.status === 'accepted' && activeTripId && (
            <DriverTracking driverId={activeTrip.driver_id || null} tripId={activeTripId} />
          )}
        </MapContainer>
        <div className="trip-map__meta">
          {activeTrip && (
            <dl className="trip-map__meta-list">
              <div className="trip-map__meta-row">
                <dt className="trip-map__meta-term">Preço</dt>
                <dd className="trip-map__meta-desc">{formatCurrency(activeTrip.quoted_price ?? 0)}</dd>
              </div>
              <div className="trip-map__meta-row">
                <dt className="trip-map__meta-term">Status</dt>
                <dd className="trip-map__meta-desc trip-map__meta-desc--badge">{activeTrip.status}</dd>
              </div>
              {activeTrip.client_name && (
                <div className="trip-map__meta-row">
                  <dt className="trip-map__meta-term">Cliente</dt>
                  <dd className="trip-map__meta-desc">{activeTrip.client_name}</dd>
                </div>
              )}
              {activeTrip.service_type && (
                <div className="trip-map__meta-row">
                  <dt className="trip-map__meta-term">Serviço</dt>
                  <dd className="trip-map__meta-desc">{activeTrip.service_type}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      <div className="trip-map__meta">
        {activeTrip && (
          <div style={{ color: 'lightgreen', marginBottom: '10px', textAlign: 'center' }}>
            GPS Ativo!
          </div>
        )}
        {isLoading ? (
          <span>A calcular melhor rota...</span>
        ) : stats ? (
          <>
            <span>{stats.distanceKm} km</span>
            <span>{stats.durationMin} min</span>
          </>
        ) : (
          <span>{error ?? 'Não foi possível carregar a rota.'}</span>
        )}
      </div>
    </section>
  )
}
