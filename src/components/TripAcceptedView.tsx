import React, { useEffect, useState } from 'react'
import { MessageSquare, Star, CreditCard, Clock, MapPin, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import ChatComponent from './ChatComponent'
import RatingComponent from './RatingComponent'
import PaymentComponent from './PaymentComponent'
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
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'rating' | 'payment'>('info')
  const [tripDetails, setTripDetails] = useState<any>(null)
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrip = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('trips')
        .select('quoted_price, origin_lat, origin_lng, destination_lat, destination_lng, origin_address, destination_address, status, motorista_nome')
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
          } else if (payload.new.status === 'ASSIGNED' && !tripDetails?.motorista_nome) {
            sendNotification('Motoqueiro Aceitou!', {
              body: 'Seu motorista está a caminho',
              icon: '/favicon.ico'
            })
            setTripDetails(prev => ({ ...prev, motorista_nome: payload.new.motorista_nome }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, tripDetails, onNewTrip])

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
        
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} />
          Chat
        </button>
        
        <button
          className={`tab-btn ${activeTab === 'rating' ? 'active' : ''}`}
          onClick={() => setActiveTab('rating')}
        >
          <Star size={16} />
          Avaliar
        </button>
        
        <button
          className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`}
          onClick={() => setActiveTab('payment')}
        >
          <CreditCard size={16} />
          Pagar
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
              </div>
            ) : (
              <div className="info-card">
                <p>Não foi possível carregar as informações da viagem.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-content">
            <ChatComponent
              tripId={tripId}
              currentUserId="current-user-id" // Isso será obtido dinamicamente
              currentUserType="CUSTOMER"
              recipientName={driverName}
            />
          </div>
        )}

        {activeTab === 'rating' && (
          <div className="rating-content">
            <RatingComponent
              tripId={tripId}
              customerId="current-user-id" // Isso será obtido dinamicamente
              onRatingSubmitted={() => setActiveTab('info')}
            />
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="payment-content">
            <PaymentComponent
              tripId={tripId}
              amountCents={5000} // Exemplo: 50.00 AOA
              onPaymentComplete={() => setActiveTab('info')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
