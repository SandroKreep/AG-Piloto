import React, { useState } from 'react'
import { MessageSquare, Star, CreditCard, Clock, MapPin, X } from 'lucide-react'
import ChatComponent from './ChatComponent'
import RatingComponent from './RatingComponent'
import PaymentComponent from './PaymentComponent'
import './TripAcceptedView.css'

interface TripAcceptedViewProps {
  tripId: string
  driverName?: string
  onNewTrip: () => void
}

export default function TripAcceptedView({ tripId, driverName = 'Motorista', onNewTrip }: TripAcceptedViewProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'rating' | 'payment'>('info')

  return (
    <div className="trip-accepted-view">
      <div className="trip-accepted-header">
        <div className="trip-accepted-info">
          <h2>🚗 Motorista a caminho!</h2>
          <p>{driverName} está a caminho para buscar você</p>
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
            <div className="info-card">
              <h3>📍 Informações da Viagem</h3>
              <div className="info-item">
                <span className="info-label">ID da Viagem:</span>
                <span className="info-value">{tripId.substring(0, 12)}...</span>
              </div>
              <div className="info-item">
                <span className="info-label">Motorista:</span>
                <span className="info-value">{driverName}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className="info-value status-accepted">Aceito</span>
              </div>
            </div>
            
            <div className="info-card">
              <h3>💡 Dicas</h3>
              <ul className="tips-list">
                <li>Mantenha-se atento às notificações</li>
                <li>Use o chat para comunicar com o motorista</li>
                <li>Tenha seu documento de identificação pronto</li>
                <li>Confirme o destino antes de iniciar</li>
              </ul>
            </div>
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
