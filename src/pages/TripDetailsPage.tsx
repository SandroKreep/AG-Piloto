import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Star, CreditCard, MapPin, Clock, DollarSign, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ChatComponent from '../components/ChatComponent'
import RatingComponent, { RatingDisplay } from '../components/RatingComponent'
import PaymentComponent from '../components/PaymentComponent'
import './TripDetailsPage.css'

interface TripDetails {
  id: string
  publicRef: string
  serviceKind: string
  status: string
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  quotedPriceCents: number
  finalPriceCents?: number
  currency: string
  distanceMeters?: number
  durationSeconds?: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  customer?: any
  driver?: any
  rating?: any
  payment?: any
}

export default function TripDetailsPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'rating' | 'payment'>('details')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    loadTripDetails()
    loadCurrentUser()
  }, [tripId])

  const loadTripDetails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/trips/${tripId}?userId=${session.user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setTrip(data.data)
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da viagem:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const formatCurrency = (amount: number, currency: string = 'AOA') => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: currency
    }).format(amount / 100)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4CAF50'
      case 'CANCELLED': return '#f44336'
      case 'IN_PROGRESS': return '#2196F3'
      case 'ASSIGNED': return '#FF9800'
      default: return '#9E9E9E'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'Solicitado'
      case 'OFFERING': return 'Ofertando'
      case 'ASSIGNED': return 'Atribuído'
      case 'DRIVER_ARRIVED': return 'Motorista chegou'
      case 'IN_PROGRESS': return 'Em andamento'
      case 'COMPLETED': return 'Concluído'
      case 'CANCELLED': return 'Cancelado'
      default: return status
    }
  }

  const getServiceKindText = (serviceKind: string) => {
    switch (serviceKind) {
      case 'TAXI': return 'Táxi'
      case 'FAMILIAR': return 'Familiar'
      case 'FRETE': return 'Frete'
      default: return serviceKind
    }
  }

  const getUserType = (): 'CUSTOMER' | 'DRIVER' => {
    if (!currentUser || !trip) return 'CUSTOMER'
    return trip.customer?.id === currentUser.id ? 'CUSTOMER' : 'DRIVER'
  }

  const canShowChat = () => {
    return trip && ['ASSIGNED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(trip.status)
  }

  const canShowRating = () => {
    return trip && trip.status === 'COMPLETED' && !trip.rating
  }

  const canShowPayment = () => {
    return trip && !trip.payment && trip.status !== 'CANCELLED'
  }

  if (loading) {
    return (
      <div className="trip-details-loading">
        <div className="trip-details-spinner"></div>
        <p>A carregar detalhes da viagem...</p>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="trip-details-error">
        <h3>Viagem não encontrada</h3>
        <button onClick={() => navigate('/')} className="back-btn">
          Voltar para o início
        </button>
      </div>
    )
  }

  return (
    <div className="trip-details-page">
      <div className="trip-details-header">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ArrowLeft size={20} />
          Voltar
        </button>
        
        <div className="trip-title">
          <h2>Viagem {trip.publicRef}</h2>
          <span 
            className="trip-status"
            style={{ color: getStatusColor(trip.status) }}
          >
            {getStatusText(trip.status)}
          </span>
        </div>
      </div>

      <div className="trip-tabs">
        <button
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Detalhes
        </button>
        
        {canShowChat() && (
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} />
            Chat
          </button>
        )}
        
        {canShowRating() && (
          <button
            className={`tab-btn ${activeTab === 'rating' ? 'active' : ''}`}
            onClick={() => setActiveTab('rating')}
          >
            <Star size={16} />
            Avaliar
          </button>
        )}
        
        {canShowPayment() && (
          <button
            className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('payment')}
          >
            <CreditCard size={16} />
            Pagar
          </button>
        )}
      </div>

      <div className="trip-content">
        {activeTab === 'details' && (
          <div className="trip-details-content">
            <div className="trip-info-cards">
              <div className="info-card">
                <h3>Informações da Viagem</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Tipo:</span>
                    <span className="info-value">{getServiceKindText(trip.serviceKind)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Valor:</span>
                    <span className="info-value">
                      {formatCurrency(trip.finalPriceCents || trip.quotedPriceCents)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Distância:</span>
                    <span className="info-value">
                      {trip.distanceMeters ? `${(trip.distanceMeters / 1000).toFixed(1)} km` : 'N/A'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Duração:</span>
                    <span className="info-value">
                      {trip.durationSeconds ? `${Math.floor(trip.durationSeconds / 60)} min` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="info-card">
                <h3>Localização</h3>
                <div className="route-info">
                  <div className="route-point">
                    <MapPin size={16} />
                    <div>
                      <div className="route-label">Origem</div>
                      <div className="route-coords">
                        {trip.pickupLat.toFixed(6)}, {trip.pickupLng.toFixed(6)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="route-point">
                    <MapPin size={16} />
                    <div>
                      <div className="route-label">Destino</div>
                      <div className="route-coords">
                        {trip.dropoffLat.toFixed(6)}, {trip.dropoffLng.toFixed(6)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="info-card">
                <h3>Participantes</h3>
                <div className="participants">
                  <div className="participant">
                    <User size={16} />
                    <div>
                      <div className="participant-label">Cliente</div>
                      <div className="participant-name">
                        {trip.customer?.profile?.fullNameCipher || 'Cliente'}
                      </div>
                    </div>
                  </div>
                  
                  {trip.driver && (
                    <div className="participant">
                      <User size={16} />
                      <div>
                        <div className="participant-label">Motorista</div>
                        <div className="participant-name">
                          {trip.driver.user?.profile?.fullNameCipher || 'Motorista'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {trip.rating && (
                <div className="info-card">
                  <h3>Avaliação</h3>
                  <RatingDisplay 
                    rating={trip.rating} 
                    isDriverView={getUserType() === 'DRIVER'}
                  />
                </div>
              )}

              {trip.payment && (
                <div className="info-card">
                  <h3>Pagamento</h3>
                  <div className="payment-info">
                    <div className="payment-item">
                      <span className="payment-label">Método:</span>
                      <span className="payment-value">{trip.payment.method}</span>
                    </div>
                    <div className="payment-item">
                      <span className="payment-label">Status:</span>
                      <span className="payment-value" style={{ color: getStatusColor(trip.payment.status) }}>
                        {getStatusText(trip.payment.status)}
                      </span>
                    </div>
                    <div className="payment-item">
                      <span className="payment-label">Valor:</span>
                      <span className="payment-value">
                        {formatCurrency(trip.payment.amountCents)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="info-card">
                <h3>Timeline</h3>
                <div className="timeline">
                  <div className="timeline-item">
                    <Clock size={16} />
                    <div>
                      <div className="timeline-label">Criado</div>
                      <div className="timeline-date">
                        {new Date(trip.createdAt).toLocaleString('pt-AO')}
                      </div>
                    </div>
                  </div>
                  
                  {trip.startedAt && (
                    <div className="timeline-item">
                      <Clock size={16} />
                      <div>
                        <div className="timeline-label">Iniciado</div>
                        <div className="timeline-date">
                          {new Date(trip.startedAt).toLocaleString('pt-AO')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {trip.completedAt && (
                    <div className="timeline-item">
                      <Clock size={16} />
                      <div>
                        <div className="timeline-label">Concluído</div>
                        <div className="timeline-date">
                          {new Date(trip.completedAt).toLocaleString('pt-AO')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && canShowChat() && (
          <div className="chat-container-full">
            <ChatComponent
              tripId={trip.id}
              currentUserId={currentUser?.id || ''}
              currentUserType={getUserType()}
              recipientName={getUserType() === 'CUSTOMER' ? 
                trip.driver?.user?.profile?.fullNameCipher : 
                trip.customer?.profile?.fullNameCipher
              }
            />
          </div>
        )}

        {activeTab === 'rating' && canShowRating() && (
          <div className="rating-container-full">
            <RatingComponent
              tripId={trip.id}
              customerId={trip.customer.id}
              isDriver={getUserType() === 'DRIVER'}
              onRatingSubmitted={() => {
                loadTripDetails()
                setActiveTab('details')
              }}
            />
          </div>
        )}

        {activeTab === 'payment' && canShowPayment() && (
          <div className="payment-container-full">
            <PaymentComponent
              tripId={trip.id}
              amountCents={trip.finalPriceCents || trip.quotedPriceCents}
              currency={trip.currency}
              onPaymentComplete={() => {
                loadTripDetails()
                setActiveTab('details')
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
