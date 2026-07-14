import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import { reverseGeocodeCoordinates } from '../lib/geoUtils'
import TripAcceptedView from './TripAcceptedView'
import { useAuthStore } from '../store/authStore'
import './TripRequestForm.css'

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Basic styling for the form (can be moved to CSS module later)
const formStyles: React.CSSProperties = {
  background: '#fff',
  boxShadow: 'none',
  border: 'none',
  padding: '24px',
}

const inputStyles: React.CSSProperties = {
  padding: '10px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  backgroundColor: 'white',
  color: '#1f2937',
  fontSize: '16px',
  outline: 'none',
  transition: 'border-color 0.2s',
}

const buttonStyles: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: '4px',
  border: 'none',
  backgroundColor: '#F97316',
  color: 'white',
  fontSize: '16px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'background-color 0.2s ease-in-out',
}

const buttonSecondaryStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: '#6b7280',
}

const summaryStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '15px',
  borderRadius: '8px',
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
}

const summaryRowStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid #e5e7eb',
}

const summaryLabelStyles: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '14px',
}

const summaryValueStyles: React.CSSProperties = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
}

const priceHighlightStyles: React.CSSProperties = {
  ...summaryValueStyles,
  color: '#16a34a',
  fontSize: '20px',
}

const successNotificationStyles: React.CSSProperties = {
  padding: '15px',
  borderRadius: '8px',
  marginBottom: '15px',
  textAlign: 'center',
  fontWeight: 'bold',
  backgroundColor: '#dcfce7',
  color: '#166534',
  border: '1px solid #bbf7d0',
}

const buttonGroupStyles: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
}

async function geocodeAddress(address: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
    )
    const data = await response.json()
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name }
    }
    return null
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

// Helper function to send browser notification
function sendNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, options)
  }
}

export default function TripRequestForm({
  destinationCoords,
  setDestinationCoords,
  destinationAddress,
  setDestinationAddress,
  originCoords,
  setOriginCoords,
  onReset,
  onOriginManuallyChosen,
}: {
  destinationCoords: Coordinates | null
  setDestinationCoords: (coords: Coordinates | null) => void
  destinationAddress: string | null
  setDestinationAddress: (address: string | null) => void
  originCoords: Coordinates | null
  setOriginCoords: (coords: Coordinates | null) => void
  onReset?: () => void
  onOriginManuallyChosen?: () => void
}) {
  const { user, setShowAuthModal } = useAuthStore() 
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)
  const [originAddress, setOriginAddress] = useState(() => {
    return sessionStorage.getItem('ag_origin_address') || ''
  })
  const [loading, setLoading] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [showPermissionWarning, setShowPermissionWarning] = useState(false)
  const [gpsObtained, setGpsObtained] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [activeTripId, setActiveTripId] = useState<string | null>(
    () => localStorage.getItem('activeTripId')
  )

  // New states for route summary
  const [routeData, setRouteData] = useState<{ distanceKm: number; durationMin: number; price: number | null } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [tripAccepted, setTripAccepted] = useState(
    () => !!localStorage.getItem('activeTripId')
  )

  useEffect(() => {
    if (activeTripId) {
      localStorage.setItem('activeTripId', activeTripId)
    } else {
      localStorage.removeItem('activeTripId')
    }
  }, [activeTripId])

  const [acceptedDriver, setAcceptedDriver] = useState<string | null>(null)
  const [waitingSeconds, setWaitingSeconds] = useState(0)
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [successModal, setSuccessModal] = useState(false)
  
  // Autocomplete states for destination
  const [destinoTexto, setDestinoTexto] = useState('')
  const [sugestoes, setSugestoes] = useState<any[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const debounceRef = useRef<any>(null)

  // Autocomplete states for origin
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false)
  const [originSearchLoading, setOriginSearchLoading] = useState(false)
  const [userEditedOrigin, setUserEditedOrigin] = useState(false)
  const originDebounceRef = useRef<any>(null)
  const originInputRef = useRef<HTMLInputElement>(null)
  const originContainerRef = useRef<HTMLDivElement>(null)

  const watchId = useRef<number | null>(null)
  const subscriptionRef = useRef<any>(null)
  const waitingTimerRef = useRef<number | null>(null)
  const driverSubscriptionRef = useRef<any>(null)
  const geocodingDone = useRef(false)
  const destinoFixo = useRef(sessionStorage.getItem('ag_destination_coords') !== null)
  const originCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const originFixed = useRef(sessionStorage.getItem('ag_origin_coords') !== null)
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originLockedRef = useRef(false)

  const buscarSugestoes = (texto: string) => {
    setDestinoTexto(texto)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (texto.length < 3) {
      setSugestoes([])
      setMostrarSugestoes(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(texto + ' Luanda Angola')}`
        )
        const data = await res.json()
        setSugestoes(data)
        setMostrarSugestoes(true)
      } catch (err) {
        console.error('Erro autocomplete destino:', err)
      }
    }, 800)
  }

  const selecionarSugestao = (s: any) => {
    setDestinoTexto(s.display_name)
    setSugestoes([])
    setMostrarSugestoes(false)
    // Actualiza o destino no mapa
    const lat = parseFloat(s.lat)
    const lng = parseFloat(s.lon)
    
    // Bloqueia actualizações GPS e limpa watch
    destinoFixo.current = true
    originLockedRef.current = true
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    
    setDestinationCoords({ lat, lng })
    setDestinationAddress(s.display_name)
  }

  const buscarSugestoesOrigem = (texto: string) => {
    setUserEditedOrigin(true)
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current)
    if (texto.length < 3) {
      setOriginSuggestions([])
      setShowOriginSuggestions(false)
      return
    }
    setOriginSearchLoading(true)
    originDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(texto + ' Luanda Angola')}`
        )
        const data = await res.json()
        setOriginSuggestions(data)
        setShowOriginSuggestions(true)
      } catch (err) {
        console.error('Erro autocomplete origem:', err)
      } finally {
        setOriginSearchLoading(false)
      }
    }, 400)
  }

  const selecionarSugestaoOrigem = (s: any) => {
    setOriginAddress(s.display_name)
    setOriginSuggestions([])
    setShowOriginSuggestions(false)
    // Actualiza a origem no mapa
    const lat = parseFloat(s.lat)
    const lng = parseFloat(s.lon)
    
    // Bloqueia actualizações GPS e limpa watch
    originFixed.current = true
    originLockedRef.current = true
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    
    setLatitude(lat)
    setLongitude(lng)
    originCoordsRef.current = { lat, lng }
    setOriginCoords({ lat, lng })
    
    // Guarda coordenadas de origem no sessionStorage
    sessionStorage.setItem('ag_origin_coords', JSON.stringify({ lat, lng }))
    
    // Recalcula a rota directamente com as coordenadas escolhidas
    calcularRota({ lat, lng }, destinationCoords || undefined)
    
    // Notifica que o utilizador escolheu a origem manualmente
    onOriginManuallyChosen?.()
  }

  useEffect(() => {
    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          
          // Só actualiza origem se ainda não escolheu destino, não fixou origem manualmente, origem não está bloqueada, e utilizador não editou origem manualmente
          if (!destinoFixo.current && !originFixed.current && !originLockedRef.current && !userEditedOrigin) {
            setLatitude(currentLat);
            setLongitude(currentLng);
            originCoordsRef.current = { lat: currentLat, lng: currentLng };
            setOriginCoords({ lat: currentLat, lng: currentLng });
            setLocationPermission('granted');
            setGpsObtained(true);
            console.log('Enviando GPS:', currentLat, currentLng);
          }
        },
        (error) => {
          console.error('Error getting location:', error)
          setLocationPermission('denied')
          setGpsObtained(false)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      )
    } else {
      console.warn('Geolocation is not supported by this browser.')
      setLocationPermission('denied')
      setGpsObtained(false)
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [])

  // Effect to perform reverse geocoding only once after GPS returns
  useEffect(() => {
    if (latitude && longitude && !geocodingDone.current) {
      geocodingDone.current = true
      setIsGeocoding(true)
      reverseGeocodeCoordinates(latitude, longitude).then((address) => {
        setOriginAddress(address)
        setIsGeocoding(false)
      })
    }
  }, [latitude, longitude])

  // Reusable route calculation function
  const calcularRota = async (origem?: Coordinates, destino?: Coordinates) => {
    const origin = origem || originCoords || originCoordsRef.current
    const dest = destino || destinationCoords
    
    if (!origin || !dest) {
      setRouteData(null)
      return
    }

    setRouteLoading(true)
    try {
      const routeInfo = await fetchOsrmRoute(origin, dest)
      const distanceKm = routeInfo.distanceMeters / 1000
      const durationMin = routeInfo.durationSeconds / 60
      // Rule: 300 Kz per km
      const price = Math.round(distanceKm * 300)

      setRouteData({
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin: Number(durationMin.toFixed(1)),
        price,
      })
    } catch (error) {
      console.error('Error calculating route:', error)
      setRouteData(null)
    } finally {
      setRouteLoading(false)
    }
  }

  // Effect to calculate route when destination changes (not GPS) - with debounce
  useEffect(() => {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current)
    routeTimerRef.current = setTimeout(() => {
      calcularRota()
    }, 1500)

    return () => {
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current)
    }
  }, [destinationCoords, originCoords])

  // Save originAddress to sessionStorage when it changes
  useEffect(() => {
    if (originAddress) {
      sessionStorage.setItem('ag_origin_address', originAddress)
    }
  }, [originAddress])

  // Save destination to sessionStorage when it changes
  useEffect(() => {
    if (destinationCoords) {
      sessionStorage.setItem('ag_destination_coords', JSON.stringify(destinationCoords))
      
      // Bloqueia GPS e limpa watch quando destino é seleccionado no mapa
      if (!destinoFixo.current) {
        destinoFixo.current = true
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current)
          watchId.current = null
        }
      }
    }
    if (destinationAddress) {
      sessionStorage.setItem('ag_destination_address', destinationAddress)
      // Sync destinoTexto with destinationAddress when changed externally
      setDestinoTexto(destinationAddress)
    }
  }, [destinationCoords, destinationAddress])

  // Effect to close origin suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (originContainerRef.current && !originContainerRef.current.contains(event.target as Node)) {
        setShowOriginSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Effect to listen for trip acceptance
  useEffect(() => {
    if (!activeTripId) {
      return
    }

    let isMounted = true

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Set up real-time listener for trip status changes
    subscriptionRef.current = supabase
      .channel(`trip-${activeTripId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${activeTripId}` },
        (payload: any) => {
          if (!isMounted) return
          
          if (payload.new.status === 'ASSIGNED' || payload.new.status === 'assigned') {
            setTripAccepted(true)
            setAcceptedDriver(payload.new.motorista_nome || 'Motorista')
            setWaitingSeconds(0)
            
            // Send notification
            sendNotification('Pedido Aceito!', {
              body: 'Seu motorista está a caminho',
              icon: '/favicon.ico'
            })

            // Start waiting timer
            if (waitingTimerRef.current) clearInterval(waitingTimerRef.current)
            waitingTimerRef.current = setInterval(() => {
              setWaitingSeconds(prev => prev + 1)
            }, 1000)
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
      if (driverSubscriptionRef.current) {
        driverSubscriptionRef.current.unsubscribe()
      }
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current)
      }
    }
  }, [activeTripId])

  // New useEffect to update Supabase with current location for active trip
  useEffect(() => {
    if (activeTripId && latitude !== null && longitude !== null) {
      const updateLocation = async () => {
        const { error } = await supabase
          .from('trips')
          .update({ origin_lat: latitude, origin_lng: longitude })
          .eq('id', activeTripId);

        if (error) {
          console.error('Error updating trip location:', error);
        }
      };
      // Debounce the update to prevent too many writes to Supabase
      const handler = setTimeout(() => {
        updateLocation();
      }, 2000); // Update every 2 seconds

      return () => clearTimeout(handler); // Cleanup timeout
    }
  }, [latitude, longitude, activeTripId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (locationPermission === 'denied' && !showPermissionWarning) {
      setShowPermissionWarning(true)
      setLoading(false)
      return
    }

    let finalOriginLat = latitude
    let finalOriginLng = longitude
    let finalDestinationLat: number | null = null
    let finalDestinationLng: number | null = null
    let quotedPrice: number | null = null
    let gpsFallbackMessage: string | null = null;

    // Prioritize GPS coordinates for origin
    if (latitude === null || longitude === null) {
      const originCoords = await geocodeAddress(originAddress)
      if (originCoords) {
        finalOriginLat = originCoords.lat
        finalOriginLng = originCoords.lng
      } else {
        gpsFallbackMessage = 'Usando endereço digitado por falha no GPS ou geocoding da origem.';
      }
    }

    // Use destinationCoords from map selection
    if (destinationCoords) {
      finalDestinationLat = destinationCoords.lat
      finalDestinationLng = destinationCoords.lng
    } else {
      setMensagemErro('Por favor, selecione um destino no mapa.')
      setTimeout(() => setMensagemErro(null), 4000)
      setLoading(false);
      return;
    }

    // Calculate price if both origin and destination coordinates are available
    if (finalOriginLat && finalOriginLng && finalDestinationLat && finalDestinationLng) {
      try {
        const origin: Coordinates = { lat: finalOriginLat, lng: finalOriginLng }
        const destination: Coordinates = { lat: finalDestinationLat, lng: finalDestinationLng }
        const routeData = await fetchOsrmRoute(origin, destination)
        const distanceKm = routeData.distanceMeters / 1000
        // Rule: 300 Kz per km
        quotedPrice = Math.round(distanceKm * 300)
      } catch (osrmError) {
        console.error('Error calculating route distance with OSRM:', osrmError)
        quotedPrice = null
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const clienteWhatsapp = data?.whatsapp || null

    try {
      const { data, error } = await supabase
        .from('trips')
        .insert([
          {
            origin_address: originAddress,
            destination_address: destinationAddress,
            status: 'pending',
            service_type: 'moto',
            origin_lat: finalOriginLat,
            origin_lng: finalOriginLng,
            destination_lat: finalDestinationLat,
            destination_lng: finalDestinationLng,
            quoted_price: quotedPrice,
            user_id: user?.id ?? null,
            cliente_whatsapp: clienteWhatsapp,
          },
        ])
        .select('id');

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        setActiveTripId(data[0].id);
        localStorage.setItem('activeTripId', data[0].id);
        setShowSummary(false);
        setTripAccepted(false);
        // Clear sessionStorage after successful submission
        sessionStorage.removeItem('ag_origin_address')
        sessionStorage.removeItem('ag_destination_coords')
        sessionStorage.removeItem('ag_destination_address')
      }

      let successMessage = 'Pedido de viagem enviado com sucesso! Aguardando motorista.';
      if (gpsFallbackMessage) {
        successMessage += ` (${gpsFallbackMessage})`;
      }
      setSuccessModal(true)
      setTimeout(() => setSuccessModal(false), 4000)
      setOriginAddress('');
      setDestinationAddress('');
      setShowPermissionWarning(false);
      setGpsObtained(false);
    } catch (err: any) {
      setMensagemErro(`Erro ao solicitar viagem: ${err.message}`)
      setTimeout(() => setMensagemErro(null), 4000)
      setActiveTripId(null);
    } finally {
      setLoading(false);
    }
  }

  const handleShowSummary = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setShowAuthModal(true)
      return
    }
    setShowSummary(true)
  }

  const handleBackToForm = () => {
    setShowSummary(false)
  }

  // Show summary before confirming trip
  if (showSummary && routeData) {
    return (
      <form style={formStyles} className="trip-form" onSubmit={handleSubmit}>
        <h2 style={{ color: '#1f2937', textAlign: 'center' }}>Resumo da Viagem</h2>
        
        <div style={summaryStyles}>
          <div style={summaryRowStyles}>
            <span style={summaryLabelStyles}>Origem</span>
            <span style={summaryValueStyles}>{originAddress.substring(0, 25)}...</span>
          </div>
          
          <div style={summaryRowStyles}>
            <span style={summaryLabelStyles}>Destino</span>
            <span style={summaryValueStyles}>{destinationAddress?.substring(0, 25)}...</span>
          </div>
          

          <div style={{ ...summaryRowStyles, borderBottom: 'none', marginTop: '5px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
            <span style={summaryLabelStyles}>Distância</span>
            <span style={summaryValueStyles}>{routeData.distanceKm} km</span>
          </div>
          
          <div style={summaryRowStyles}>
            <span style={summaryLabelStyles}>Duração estimada</span>
            <span style={summaryValueStyles}>{routeData.durationMin} min</span>
          </div>

          <div style={{ ...summaryRowStyles, borderBottom: 'none', marginTop: '10px', paddingTop: '10px', justifyContent: 'center' }}>
            <span style={priceHighlightStyles}>
              {routeData.price ? formatCurrency(routeData.price) : 'A calcular'}
            </span>
          </div>
        </div>

        <div style={buttonGroupStyles}>
          <button 
            type="button" 
            onClick={handleBackToForm} 
            style={buttonSecondaryStyles}
          >
            Voltar
          </button>
          <button 
            type="submit" 
            style={buttonStyles} 
            disabled={loading}
          >
            {loading ? 'Confirmando...' : 'Confirmar Viagem'}
          </button>
        </div>
      </form>
    )
  }

  // Show initial form
  return (
    <form style={formStyles} className="trip-form" onSubmit={handleShowSummary}>
      {gpsObtained && (
        <div className="gps-obtido" style={{ marginBottom: '10px', textAlign: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          Localização GPS obtida!
        </div>
      )}

      {showPermissionWarning && locationPermission === 'denied' && (
        <div style={{ color: '#F97316', marginBottom: '10px', fontSize: '14px' }}>
          Para sua segurança, a localização exata ajuda o motorista. Deseja continuar apenas com o endereço de texto?
          <button type="button" onClick={() => setShowPermissionWarning(false)} style={{ marginLeft: '10px', background: '#F97316', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
            Sim, continuar
          </button>
        </div>
      )}

      {!destinationCoords && (
        <div style={{ color: '#999', marginBottom: '10px', textAlign: 'center', fontSize: '13px' }}>
          Selecione um destino no mapa manualmente (opcional)
        </div>
      )}

      {routeData && destinationCoords && (
        <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '8px', marginBottom: '10px', color: '#166534', textAlign: 'center', fontSize: '14px', border: '1px solid #bbf7d0' }}>
          Rota calculada: {routeData.distanceKm} km · {routeData.durationMin} min · {formatCurrency(routeData.price || 0)}
        </div>
      )}

      <div className="trip-form__grid">
        <div style={{ position: 'relative' }} ref={originContainerRef}>
          <label style={{ fontSize: '11px', color: '#999', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>ORIGEM</label>
          <input
            ref={originInputRef}
            type="text"
            placeholder={originAddress ? originAddress : gpsObtained ? 'A obter endereço...' : 'Endereço de Origem'}
            value={originAddress}
            onChange={(e) => {
              setOriginAddress(e.target.value)
              buscarSugestoesOrigem(e.target.value)
            }}
            style={{ ...inputStyles, paddingRight: originSearchLoading ? '40px' : '10px' }}
            required
          />
          {originSearchLoading && (
            <div style={{
              position: 'absolute',
              right: '10px',
              top: 'calc(50% + 12px)',
              transform: 'translateY(-50%)',
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="trip-form__spinner">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
          )}
          {showOriginSuggestions && originSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              zIndex: 1000,
              maxHeight: '300px',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {originSuggestions.map((s) => (
                <div
                  key={s.place_id}
                  onClick={() => selecionarSugestaoOrigem(s)}
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fff7ed')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '11px', color: '#999', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>DESTINO</label>
          <input
            type="text"
            value={destinoTexto}
            onChange={(e) => buscarSugestoes(e.target.value)}
            placeholder="Escreve o destino..."
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: 'white', color: '#1f2937', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }}
          />
          {mostrarSugestoes && sugestoes.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'white', border: '1px solid #ddd', borderRadius: '8px',
              zIndex: 1000, maxHeight: '300px', overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              {sugestoes.map((s) => (
                <div
                  key={s.place_id}
                  onClick={() => selecionarSugestao(s)}
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fff7ed')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {mensagemErro && (
        <div style={{
          background: '#fff3ed',
          border: '1px solid #ff6b00',
          borderLeft: '4px solid #ff6b00',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#cc4400',
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ff6b00" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {mensagemErro}
        </div>
      )}

      <button
        type="submit"
        style={{ ...buttonStyles, width: '100%', marginTop: '8px' }}
        disabled={loading || !destinationCoords || routeLoading}
      >
        {routeLoading ? 'Calculando rota...' : loading ? 'Solicitando...' : 'Próximo'}
      </button>
      
      <button 
        type="button"
        onClick={() => {
          sessionStorage.removeItem('ag_origin_coords')
          sessionStorage.removeItem('ag_destination_coords')
          sessionStorage.removeItem('ag_destination_address')
          sessionStorage.removeItem('ag_origin_address')
          setOriginCoords(null)
          setDestinationCoords(null)
          setDestinationAddress(null)
          setOriginAddress('')
          setDestinoTexto('')
          setRouteData(null)
          geocodingDone.current = false
          originFixed.current = false
          destinoFixo.current = false
          originCoordsRef.current = null
          onReset?.()
        }}
        style={{
          background: 'transparent',
          color: '#6b7280',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          padding: '10px 20px',
          fontSize: '14px',
          cursor: 'pointer',
          width: '100%',
          marginTop: '-8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <path d="M3 3v5h5"></path>
        </svg>
        Nova Viagem
      </button>

      {successModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '32px 28px',
            maxWidth: '340px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            animation: 'popIn 0.3s ease',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 0 8px rgba(34,197,94,0.15)',
              animation: 'pulseGreen 1.5s ease infinite',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24"
                fill="none" stroke="white" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 style={{
              margin: '0 0 8px',
              fontSize: '1.2rem',
              fontWeight: 800,
              color: '#111827'
            }}>
              Pedido enviado!
            </h3>
            <p style={{
              margin: 0,
              color: '#6b7280',
              fontSize: '0.9rem'
            }}>
              A aguardar motorista disponível...
            </p>
          </div>
        </div>
      )}
      {tripAccepted && activeTripId && (
        <TripAcceptedView
          tripId={activeTripId}
          driverName={acceptedDriver}
          onNewTrip={() => {
            setShowSummary(false)
            setTripAccepted(false)
            setActiveTripId(null)
            localStorage.removeItem('activeTripId')
            setOriginAddress('')
            setDestinationAddress(null)
            setDestinationCoords(null)
            setWaitingSeconds(0)
            setDriverLocation(null)
            destinoFixo.current = false
            originCoordsRef.current = null
            originFixed.current = false
            originLockedRef.current = false
            setOriginSuggestions([])
            setShowOriginSuggestions(false)
            setOriginSearchLoading(false)
            setUserEditedOrigin(false)
            sessionStorage.removeItem('ag_origin_address')
            sessionStorage.removeItem('ag_destination_coords')
            sessionStorage.removeItem('ag_destination_address')
            if (waitingTimerRef.current) clearInterval(waitingTimerRef.current)
          }}
        />
      )}
    </form>
  )
}
