import React, { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import './TripAcceptedView.css'

interface TripAcceptedViewProps {
  tripId: string
  driverName?: string
  onNewTrip: () => void
}

function sendNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, options)
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export default function TripAcceptedView({ tripId, driverName = 'Motoqueiro', onNewTrip }: TripAcceptedViewProps) {
  const [activeTab, setActiveTab] = useState<'info'>('info')
  const [tripDetails, setTripDetails] = useState<any>(null)
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrip = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('trips')
        .select('quoted_price, origin_lat, origin_lng, destination_lat, destination_lng, origin_address, destination_address, status, motorista_nome, motorista_whatsapp, motorista_foto_url')
        .eq('id', tripId)
        .single()
      if (data) {
        setTripDetails(data)
        
        // Calculate route using OSRM
        if (data.origin_lat && data.origin_lng && data.destination_lat && data.destination_lng) {
          try {
            const routeData = await fetchOsrmRoute(
              { lat: data.origin_lat, lng: data.origin_lng },
              { lat: data.destination_lat, lng: data.destination_lng }
            )
            setRouteInfo({
              distanceKm: Number((routeData.distanceMeters / 1000).toFixed(2)),
              durationMin: Number((routeData.durationSeconds / 60).toFixed(1))
            })
          } catch (error) {
            console.error('Error calculating route:', error)
          }
        }
      }
      setLoading(false)
    }
    fetchTrip()
  }, [tripId])

  useEffect(() => {
    const channel = supabase
      .channel(`trip-status-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId}`
        },
        (payload) => {
          console.log('Trip status update:', payload)
          
          if (payload.new.status === 'CANCELLED') {
            sendNotification('Viagem Cancelada', {
              body: 'O motoqueiro cancelou a viagem',
              icon: '/favicon.ico'
            })
            alert('O motoqueiro cancelou a viagem')
            onNewTrip()
          } else if (payload.new.status === 'ASSIGNED') {
            setTripDetails(prev => ({ 
              ...prev, 
              motorista_nome: payload.new.motorista_nome,
              motorista_whatsapp: payload.new.motorista_whatsapp,
              motorista_foto_url: payload.new.motorista_foto_url,
              status: 'ASSIGNED'
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, onNewTrip])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="trip-accepted-view">
      <div className="trip-accepted-header">
        <div className="trip-accepted-info">
          <p>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}>
              <path d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            Motoqueiro está a caminho para buscar você
          </p>
        </div>
        <button className="close-btn" onClick={onNewTrip}>
          <X size={20} />
        </button>
      </div>

      <div className="trip-tabs">
        <button
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <Clock size={16} />
          Informações
        </button>
      </div>

      <div className="trip-content">
        {activeTab === 'info' && (
          <div className="info-content">
            {loading ? (
              <div className="info-card">
                <p>A carregar informações da viagem...</p>
              </div>
            ) : tripDetails ? (
              <div className="info-card">
                <h3>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  Informações da Viagem
                </h3>
                <div className="info-item">
                  <span className="info-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Preço:
                  </span>
                  <span className="info-value">{tripDetails.quoted_price ? formatCurrency(tripDetails.quoted_price) : 'A calcular'}</span>
                </div>
                {routeInfo && (
                  <>
                    <div className="info-item">
                      <span className="info-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
                          <path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"></path>
                        </svg>
                        Distância:
                      </span>
                      <span className="info-value">{routeInfo.distanceKm} km</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Tempo estimado:
                      </span>
                      <span className="info-value">{routeInfo.durationMin} min</span>
                    </div>
                  </>
                )}
                <div className="info-item">
                  <span className="info-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    Origem:
                  </span>
                  <span className="info-value">{tripDetails.origin_address ? tripDetails.origin_address.substring(0, 30) + (tripDetails.origin_address.length > 30 ? '...' : '') : 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    </svg>
                    Destino:
                  </span>
                  <span className="info-value">{tripDetails.destination_address ? tripDetails.destination_address.substring(0, 30) + (tripDetails.destination_address.length > 30 ? '...' : '') : 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="info-value status-accepted">Aceito</span>
                </div>
                {(tripDetails.motorista_nome || tripDetails.motorista_whatsapp) && (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', background: '#f0fdf4', borderRadius: '12px',
                    border: '1px solid #bbf7d0', margin: '12px 0'
                  }}>
                    {tripDetails.motorista_foto_url ? (
                      <img src={tripDetails.motorista_foto_url}
                        style={{ width: 52, height: 52, borderRadius: '50%',
                          objectFit: 'cover', border: '3px solid #16a34a',
                          flexShrink: 0 }}
                        alt="Motorista" />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: '50%',
                        background: '#16a34a', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#fff', fontWeight: 700,
                        fontSize: '1.2rem', flexShrink: 0 }}>
                        {tripDetails.motorista_nome?.[0] || 'M'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: '#111827' }}>
                        {tripDetails.motorista_nome || 'Motoqueiro'}
                      </div>
                      {tripDetails.motorista_whatsapp && (
                        <a href={`https://wa.me/${tripDetails.motorista_whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Olá! Estou a aguardar a minha viagem.')}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: '#25D366', fontWeight: 600, 
                            fontSize: '0.88rem', textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" 
                            fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          {tripDetails.motorista_whatsapp}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="info-card">
                <p>Não foi possível carregar as informações da viagem.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
