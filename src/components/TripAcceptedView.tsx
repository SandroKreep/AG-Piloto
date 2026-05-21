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
        .select('quoted_price, origin_lat, origin_lng, destination_lat, destination_lng, origin_address, destination_address')
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
          <p>🏍️ Motoqueiro está a caminho para buscar você</p>
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
                <h3>📍 Informações da Viagem</h3>
                <div className="info-item">
                  <span className="info-label">💰 Preço:</span>
                  <span className="info-value">{tripDetails.quoted_price ? formatCurrency(tripDetails.quoted_price) : 'A calcular'}</span>
                </div>
                {routeInfo && (
                  <>
                    <div className="info-item">
                      <span className="info-label">📏 Distância:</span>
                      <span className="info-value">{routeInfo.distanceKm} km</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">⏱️ Tempo estimado:</span>
                      <span className="info-value">{routeInfo.durationMin} min</span>
                    </div>
                  </>
                )}
                <div className="info-item">
                  <span className="info-label">📍 Origem:</span>
                  <span className="info-value">{tripDetails.origin_address ? tripDetails.origin_address.substring(0, 30) + (tripDetails.origin_address.length > 30 ? '...' : '') : 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">🏁 Destino:</span>
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
