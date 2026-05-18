import React, { useState } from 'react'
import { Star, MessageSquare, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './RatingComponent.css'

interface RatingComponentProps {
  tripId: string
  customerId: string
  driverId?: string
  onRatingSubmitted?: () => void
  isDriver?: boolean
  existingRating?: {
    driverRating?: number
    driverComment?: string
    customerRating?: number
    customerComment?: string
  }
}

export default function RatingComponent({
  tripId,
  customerId,
  driverId,
  onRatingSubmitted,
  isDriver = false,
  existingRating
}: RatingComponentProps) {
  const [rating, setRating] = useState(existingRating?.driverRating || 0)
  const [comment, setComment] = useState(existingRating?.driverComment || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [hoveredStar, setHoveredStar] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      alert('Por favor, selecione uma avaliação')
      return
    }

    setIsSubmitting(true)

    try {
      const ratingData = {
        tripId,
        customerId,
        ...(isDriver ? {
          customerRating: rating,
          customerComment: comment
        } : {
          driverRating: rating,
          driverComment: comment
        })
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/rating/trips/${tripId}/rating`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify(ratingData)
        }
      )

      if (response.ok) {
        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
          onRatingSubmitted?.()
        }, 2000)
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao enviar avaliação')
      }
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error)
      alert('Erro ao enviar avaliação. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1: return 'Péssimo'
      case 2: return 'Ruim'
      case 3: return 'Regular'
      case 4: return 'Bom'
      case 5: return 'Excelente'
      default: return ''
    }
  }

  const getRatingColor = (rating: number) => {
    switch (rating) {
      case 1: return '#ff4444'
      case 2: return '#ff8800'
      case 3: return '#ffbb33'
      case 4: return '#00C851'
      case 5: return '#00C851'
      default: return '#ccc'
    }
  }

  if (showSuccess) {
    return (
      <div className="rating-success">
        <div className="rating-success-icon">✓</div>
        <h3>Avaliação enviada!</h3>
        <p>Obrigado pelo seu feedback</p>
      </div>
    )
  }

  return (
    <div className="rating-container">
      <div className="rating-header">
        <h3>
          {isDriver ? 'Avaliar Cliente' : 'Avaliar Motorista'}
        </h3>
        <p>Sua opinião é muito importante para nós</p>
      </div>

      <form onSubmit={handleSubmit} className="rating-form">
        <div className="rating-stars-section">
          <label className="rating-label">Como foi sua experiência?</label>
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`rating-star ${star <= rating ? 'active' : ''} ${star <= hoveredStar ? 'hover' : ''}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                disabled={isSubmitting}
              >
                <Star 
                  size={32} 
                  fill={star <= (hoveredStar || rating) ? getRatingColor(hoveredStar || rating) : 'none'}
                  color={star <= (hoveredStar || rating) ? getRatingColor(hoveredStar || rating) : '#ddd'}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="rating-label-text" style={{ color: getRatingColor(rating) }}>
              {getRatingLabel(rating)}
            </div>
          )}
        </div>

        <div className="rating-comment-section">
          <label className="rating-label">
            <MessageSquare size={16} />
            Comentários (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte mais sobre sua experiência..."
            className="rating-comment"
            rows={4}
            maxLength={500}
            disabled={isSubmitting}
          />
          <div className="rating-comment-count">
            {comment.length}/500
          </div>
        </div>

        <div className="rating-actions">
          <button
            type="submit"
            className="rating-submit-btn"
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="rating-spinner"></div>
                Enviando...
              </>
            ) : (
              <>
                <Send size={18} />
                Enviar Avaliação
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// Componente para exibir avaliações existentes
interface RatingDisplayProps {
  rating: {
    driverRating?: number
    customerRating?: number
    driverComment?: string
    customerComment?: string
  }
  isDriverView?: boolean
}

export function RatingDisplay({ rating, isDriverView = false }: RatingDisplayProps) {
  const displayRating = isDriverView ? rating.customerRating : rating.driverRating
  const displayComment = isDriverView ? rating.customerComment : rating.driverComment

  if (!displayRating) {
    return (
      <div className="rating-display-empty">
        <Star size={24} color="#ddd" />
        <p>Ainda não avaliado</p>
      </div>
    )
  }

  return (
    <div className="rating-display">
      <div className="rating-display-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={20}
            fill={star <= displayRating ? '#ffc107' : 'none'}
            color={star <= displayRating ? '#ffc107' : '#ddd'}
          />
        ))}
        <span className="rating-display-value">{displayRating.toFixed(1)}</span>
      </div>
      
      {displayComment && (
        <div className="rating-display-comment">
          <p>{displayComment}</p>
        </div>
      )}
    </div>
  )
}

// Componente para lista de avaliações
interface RatingListProps {
  ratings: Array<{
    rating: number
    comment?: string
    createdAt: Date
    tripId: string
  }>
  averageRating: number
  totalRatings: number
}

export function RatingList({ ratings, averageRating, totalRatings }: RatingListProps) {
  const ratingDistribution = [1, 2, 3, 4, 5].map(stars => ({
    stars,
    count: ratings.filter(r => r.rating === stars).length,
    percentage: (ratings.filter(r => r.rating === stars).length / totalRatings) * 100
  }))

  return (
    <div className="rating-list">
      <div className="rating-summary">
        <div className="rating-summary-average">
          <div className="rating-summary-number">{averageRating.toFixed(1)}</div>
          <div className="rating-summary-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={16}
                fill={star <= Math.round(averageRating) ? '#ffc107' : 'none'}
                color={star <= Math.round(averageRating) ? '#ffc107' : '#ddd'}
              />
            ))}
          </div>
          <div className="rating-summary-total">{totalRatings} avaliações</div>
        </div>
        
        <div className="rating-distribution">
          {ratingDistribution.reverse().map(({ stars, count, percentage }) => (
            <div key={stars} className="rating-distribution-row">
              <span className="rating-distribution-label">{stars}</span>
              <div className="rating-distribution-bar">
                <div 
                  className="rating-distribution-fill" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="rating-distribution-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rating-items">
        {ratings.map((rating, index) => (
          <div key={`${rating.tripId}-${index}`} className="rating-item">
            <div className="rating-item-header">
              <div className="rating-item-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= rating.rating ? '#ffc107' : 'none'}
                    color={star <= rating.rating ? '#ffc107' : '#ddd'}
                  />
                ))}
              </div>
              <div className="rating-item-date">
                {new Date(rating.createdAt).toLocaleDateString('pt-AO')}
              </div>
            </div>
            
            {rating.comment && (
              <div className="rating-item-comment">
                <p>{rating.comment}</p>
              </div>
            )}
          </div>
        ))}
        
        {ratings.length === 0 && (
          <div className="rating-list-empty">
            <p>Nenhuma avaliação ainda</p>
          </div>
        )}
      </div>
    </div>
  )
}
