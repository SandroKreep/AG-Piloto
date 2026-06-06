import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useToast } from './Toast'
import './Profile.css'

type Profile = {
  id: string
  full_name?: string
  phone?: string
  whatsapp?: string
}

type Trip = {
  id: string
  created_at: string
  origin_address: string
  destination_address: string
  quoted_price: number | null
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
}

export default function Profile() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { addToast } = useToast()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    fetchProfile()
    fetchTrips()
  }, [user, navigate])

  const fetchProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, whatsapp')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setProfile(data as Profile)
        setEditName(data.full_name || '')
        setEditPhone(data.phone || '')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      addToast('Erro ao carregar perfil', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrips = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('trips')
        .select('id, created_at, origin_address, destination_address, quoted_price, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setTrips(data as Trip[] || [])
    } catch (error) {
      console.error('Error fetching trips:', error)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName,
          phone: editPhone,
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, full_name: editName, phone: editPhone } : null)
      setEditing(false)
      addToast('Perfil atualizado com sucesso', 'success')
    } catch (error) {
      console.error('Error updating profile:', error)
      addToast('Erro ao atualizar perfil', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditName(profile?.full_name || '')
    setEditPhone(profile?.phone || '')
    setEditing(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A'
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981'
      case 'cancelled':
        return '#ef4444'
      case 'accepted':
        return '#3b82f6'
      default:
        return '#f59e0b'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluída'
      case 'cancelled':
        return 'Cancelada'
      case 'accepted':
        return 'Aceita'
      case 'pending':
        return 'Pendente'
      default:
        return status
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="profile">
        <div className="profile__loading">A carregar...</div>
      </div>
    )
  }

  return (
    <div className="profile">
      <div className="profile__container">
        {/* User Info Section */}
        <section className="profile__section">
          <h2 className="profile__section-title">Informações do Utilizador</h2>
          
          {editing ? (
            <div className="profile__edit-form">
              <div className="profile__field">
                <label className="profile__label">Nome</label>
                <input
                  type="text"
                  className="profile__input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              
              <div className="profile__field">
                <label className="profile__label">Email</label>
                <input
                  type="email"
                  className="profile__input profile__input--readonly"
                  value={user?.email || ''}
                  readOnly
                />
              </div>
              
              <div className="profile__field">
                <label className="profile__label">Telefone</label>
                <input
                  type="tel"
                  className="profile__input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+244 9XX XXX XXX"
                />
              </div>
              
              <div className="profile__edit-actions">
                <button
                  type="button"
                  className="profile__button profile__button--secondary"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="profile__button profile__button--primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="profile__info">
              <div className="profile__info-row">
                <span className="profile__info-label">Nome</span>
                <span className="profile__info-value">{profile?.full_name || 'Não definido'}</span>
              </div>
              
              <div className="profile__info-row">
                <span className="profile__info-label">Email</span>
                <span className="profile__info-value">{user?.email}</span>
              </div>
              
              <div className="profile__info-row">
                <span className="profile__info-label">Telefone</span>
                <span className="profile__info-value">{profile?.phone || 'Não definido'}</span>
              </div>
              
              <button
                type="button"
                className="profile__button profile__button--primary"
                onClick={() => setEditing(true)}
              >
                Editar perfil
              </button>
            </div>
          )}
        </section>

        {/* Trip History Section */}
        <section className="profile__section">
          <h2 className="profile__section-title">Histórico de Viagens</h2>
          
          {trips.length === 0 ? (
            <div className="profile__empty">
              <p>Nenhuma viagem ainda</p>
            </div>
          ) : (
            <div className="profile__trips">
              {trips.map((trip) => (
                <div key={trip.id} className="profile__trip-card">
                  <div className="profile__trip-header">
                    <span className="profile__trip-date">{formatDate(trip.created_at)}</span>
                    <span
                      className="profile__trip-status"
                      style={{ color: getStatusColor(trip.status) }}
                    >
                      {getStatusLabel(trip.status)}
                    </span>
                  </div>
                  
                  <div className="profile__trip-route">
                    <div className="profile__trip-point">
                      <span className="profile__trip-point-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                      </span>
                      <span className="profile__trip-point-text">{trip.origin_address}</span>
                    </div>
                    <div className="profile__trip-point">
                      <span className="profile__trip-point-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <circle cx="12" cy="12" r="6"></circle>
                          <circle cx="12" cy="12" r="2"></circle>
                        </svg>
                      </span>
                      <span className="profile__trip-point-text">{trip.destination_address}</span>
                    </div>
                  </div>
                  
                  <div className="profile__trip-footer">
                    <span className="profile__trip-price">{formatPrice(trip.quoted_price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
