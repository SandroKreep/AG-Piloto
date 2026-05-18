import { useEffect, useState, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'

type Props = {
  driverId: string | null
  tripId: string
}

const createDriverIcon = () => {
  return L.divIcon({
    className: 'driver-icon',
    html: `<div style="background-color: #ffc107; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: black; font-weight: bold; font-size: 16px;">🚗</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function DriverTracking({ driverId, tripId }: Props) {
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [driverName, setDriverName] = useState<string | null>(null)
  const subscriptionRef = useRef<any>(null)

  useEffect(() => {
    if (!driverId || !tripId) return

    // Fetch driver info
    const fetchDriver = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*, user:users(fullName)')
        .eq('id', driverId)
        .single()

      if (error) {
        console.error('Error fetching driver:', error)
      } else if (data) {
        setDriverName(data.user?.fullName || 'Motorista')
      }
    }

    fetchDriver()

    // Set up real-time listener for driver location
    subscriptionRef.current = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId}`,
        },
        (payload: any) => {
          if (payload.new.driver_lat && payload.new.driver_lng) {
            setDriverLocation({
              lat: payload.new.driver_lat,
              lng: payload.new.driver_lng,
            })
          }
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [driverId, tripId])

  if (!driverLocation) return null

  return (
    <Marker position={[driverLocation.lat, driverLocation.lng]} icon={createDriverIcon()}>
      <Popup>
        <div style={{ textAlign: 'center' }}>
          <strong>{driverName || 'Motorista'}</strong>
          <br />
          <small>A caminho</small>
        </div>
      </Popup>
    </Marker>
  )
}
