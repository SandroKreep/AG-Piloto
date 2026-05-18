import React, { useState, useEffect } from 'react'
import { Search, Filter, Calendar, MapPin, Clock, DollarSign, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './TripHistoryComponent.css'

interface Trip {
  id: string
  publicRef: string
  serviceKind: 'TAXI' | 'FAMILIAR' | 'FRETE'
  status: 'REQUESTED' | 'OFFERING' | 'ASSIGNED' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
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
  rating?: {
    driverRating?: number
    customerRating?: number
  }
  payment?: {
    status: string
    method: string
    amountCents: number
  }
}

interface TripHistoryComponentProps {
  userId: string
  userType: 'CUSTOMER' | 'DRIVER'
}

export default function TripHistoryComponent({ userId, userType }: TripHistoryComponentProps) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    serviceKind: '',
    dateFrom: '',
    dateTo: ''
  })
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    totalAmount: 0,
    averageRating: 0
  })

  useEffect(() => {
    loadTrips()
    loadStats()
  }, [userId, userType])

  useEffect(() => {
    applyFilters()
  }, [trips, searchQuery, filters])

  const loadTrips = async () => {
    try {
      setLoading(true)
      const endpoint = userType === 'CUSTOMER' 
        ? `customers/${userId}/trips`
        : `drivers/${userId}/trips`
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/${endpoint}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setTrips(data.data.trips || [])
      }
    } catch (error) {
      console.error('Erro ao carregar viagens:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/users/${userId}/stats?userType=${userType}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  const applyFilters = () => {
    let filtered = trips

    // Aplicar busca
    if (searchQuery) {
      filtered = filtered.filter(trip => 
        trip.publicRef.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Aplicar filtros
    if (filters.status) {
      filtered = filtered.filter(trip => trip.status === filters.status)
    }

    if (filters.serviceKind) {
      filtered = filtered.filter(trip => trip.serviceKind === filters.serviceKind)
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(trip => 
        new Date(trip.createdAt) >= new Date(filters.dateFrom)
      )
    }

    if (filters.dateTo) {
      filtered = filtered.filter(trip => 
        new Date(trip.createdAt) <= new Date(filters.dateTo)
      )
    }

    setFilteredTrips(filtered)
  }

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
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

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'WALLET': return 'Carteira'
      case 'CASH': return 'Dinheiro'
      case 'CREDIT_CARD': return 'Cartão de crédito'
      case 'MOBILE_MONEY': return 'Dinheiro móvel'
      default: return method
    }
  }

  const formatCurrency = (amount: number, currency: string = 'AOA') => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: currency
    }).format(amount / 100)
  }

  const formatDistance = (meters?: number) => {
    if (!meters) return 'N/A'
    if (meters < 1000) return `${meters}m`
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}min`
    return `${minutes}min`
  }

  const toggleTripExpansion = (tripId: string) => {
    const newExpanded = new Set(expandedTrips)
    if (newExpanded.has(tripId)) {
      newExpanded.delete(tripId)
    } else {
      newExpanded.add(tripId)
    }
    setExpandedTrips(newExpanded)
  }

  const clearFilters = () => {
    setFilters({
      status: '',
      serviceKind: '',
      dateFrom: '',
      dateTo: ''
    })
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className="trip-history-loading">
        <div className="trip-history-spinner"></div>
        <p>A carregar histórico de viagens...</p>
      </div>
    )
  }

  return (
    <div className="trip-history">
      {/* Estatísticas */}
      <div className="trip-history-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.totalTrips}</div>
          <div className="stat-label">Total de viagens</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.completedTrips}</div>
          <div className="stat-label">Concluídas</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{formatCurrency(stats.totalAmount)}</div>
          <div className="stat-label">Valor total</div>
        </div>
        {stats.averageRating > 0 && (
          <div className="stat-card">
            <div className="stat-number">{stats.averageRating.toFixed(1)} ⭐</div>
            <div className="stat-label">Avaliação média</div>
          </div>
        )}
      </div>

      {/* Busca e Filtros */}
      <div className="trip-history-controls">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por referência..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <button 
            className={`filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            Filtros
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {(filters.status || filters.serviceKind || filters.dateFrom || filters.dateTo) && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Painel de Filtros */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-row">
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">Todos os status</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="IN_PROGRESS">Em andamento</option>
            </select>
            
            <select
              value={filters.serviceKind}
              onChange={(e) => setFilters({...filters, serviceKind: e.target.value})}
            >
              <option value="">Todos os tipos</option>
              <option value="TAXI">Táxi</option>
              <option value="FAMILIAR">Familiar</option>
              <option value="FRETE">Frete</option>
            </select>
          </div>
          
          <div className="filter-row">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              placeholder="Data inicial"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              placeholder="Data final"
            />
          </div>
        </div>
      )}

      {/* Lista de Viagens */}
      <div className="trip-list">
        {filteredTrips.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} color="#ccc" />
            <h3>Nenhuma viagem encontrada</h3>
            <p>
              {trips.length === 0 
                ? 'Você ainda não realizou nenhuma viagem'
                : 'Tente ajustar os filtros ou busca'
              }
            </p>
          </div>
        ) : (
          filteredTrips.map(trip => (
            <div key={trip.id} className="trip-card">
              <div className="trip-header" onClick={() => toggleTripExpansion(trip.id)}>
                <div className="trip-main-info">
                  <div className="trip-ref-status">
                    <span className="trip-ref">{trip.publicRef}</span>
                    <span 
                      className="trip-status"
                      style={{ color: getStatusColor(trip.status) }}
                    >
                      {getStatusText(trip.status)}
                    </span>
                  </div>
                  
                  <div className="trip-meta">
                    <span className="trip-service">{getServiceKindText(trip.serviceKind)}</span>
                    <span className="trip-date">
                      {new Date(trip.createdAt).toLocaleDateString('pt-AO')}
                    </span>
                  </div>
                </div>
                
                <div className="trip-price">
                  <DollarSign size={16} />
                  {formatCurrency(trip.finalPriceCents || trip.quotedPriceCents)}
                </div>
                
                <div className="trip-expand-icon">
                  {expandedTrips.has(trip.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {expandedTrips.has(trip.id) && (
                <div className="trip-details">
                  <div className="trip-route">
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

                  <div className="trip-info-grid">
                    <div className="info-item">
                      <Clock size={16} />
                      <div>
                        <div className="info-label">Duração</div>
                        <div className="info-value">{formatDuration(trip.durationSeconds)}</div>
                      </div>
                    </div>
                    
                    <div className="info-item">
                      <MapPin size={16} />
                      <div>
                        <div className="info-label">Distância</div>
                        <div className="info-value">{formatDistance(trip.distanceMeters)}</div>
                      </div>
                    </div>
                  </div>

                  {trip.payment && (
                    <div className="trip-payment">
                      <div className="payment-info">
                        <span className="payment-label">Pagamento:</span>
                        <span className="payment-method">{getPaymentMethodText(trip.payment.method)}</span>
                        <span className="payment-status" style={{ color: getStatusColor(trip.payment.status) }}>
                          {getStatusText(trip.payment.status)}
                        </span>
                      </div>
                    </div>
                  )}

                  {trip.rating && (
                    <div className="trip-rating">
                      <Star size={16} color="#ffc107" fill="#ffc107" />
                      <span>
                        Avaliação: {userType === 'DRIVER' ? trip.rating.customerRating : trip.rating.driverRating}/5
                      </span>
                    </div>
                  )}

                  <div className="trip-timestamps">
                    <div>
                      <strong>Criado:</strong> {new Date(trip.createdAt).toLocaleString('pt-AO')}
                    </div>
                    {trip.startedAt && (
                      <div>
                        <strong>Iniciado:</strong> {new Date(trip.startedAt).toLocaleString('pt-AO')}
                      </div>
                    )}
                    {trip.completedAt && (
                      <div>
                        <strong>Concluído:</strong> {new Date(trip.completedAt).toLocaleString('pt-AO')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
