import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import './Documentos.css'

type FormData = {
  descricao: string
  origemAddress: string
  destinoAddress: string
  whatsapp: string
}

type Suggestion = {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  display_name: string
  address: any
}

const TAXA_ENTREGA = 1500

export default function Documentos() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<FormData>({
    descricao: '',
    origemAddress: '',
    destinoAddress: '',
    whatsapp: ''
  })
  const [origemCoords, setOrigemCoords] = useState<Coordinates | null>(null)
  const [destinoCoords, setDestinoCoords] = useState<Coordinates | null>(null)
  const [origemSuggestions, setOrigemSuggestions] = useState<Suggestion[]>([])
  const [destinoSuggestions, setDestinoSuggestions] = useState<Suggestion[]>([])
  const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false)
  const [showDestinoSuggestions, setShowDestinoSuggestions] = useState(false)
  const [estimatedPrice, setEstimatedPrice] = useState<{ price: number; distance: number; duration: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [tripAceite, setTripAceite] = useState(false)
  const [motoristaInfo, setMotoristaInfo] = useState<{
    nome: string, whatsapp: string, foto_url?: string
  } | null>(null)

  const origemDebounceRef = useRef<number | null>(null)
  const destinoDebounceRef = useRef<number | null>(null)
  const subscriptionRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (origemDebounceRef.current) clearTimeout(origemDebounceRef.current)
      if (destinoDebounceRef.current) clearTimeout(destinoDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (origemCoords && destinoCoords) {
      calculatePrice()
    } else {
      setEstimatedPrice(null)
    }
  }, [origemCoords, destinoCoords])

  useEffect(() => {
    if (!activeTripId) return
    
    if ('Notification' in window && 
        Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
    subscriptionRef.current = supabase
      .channel(`documento-trip-${activeTripId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trips',
        filter: `id=eq.${activeTripId}` 
      }, (payload) => {
        if (payload.new.status === 'ASSIGNED' || 
            payload.new.status === 'assigned') {
          
          const audio = new Audio('/notification.mp3')
          audio.play().catch(() => {})
          
          if (Notification.permission === 'granted') {
            new Notification('Pedido Aceite!', {
              body: `${payload.new.motorista_nome || 'Motoqueiro'} aceitou o seu pedido de documentos!`,
              icon: '/favicon.ico'
            })
          }
          
          setTripAceite(true)
          setMotoristaInfo({
            nome: payload.new.motorista_nome || 'Motoqueiro',
            whatsapp: payload.new.motorista_whatsapp || '',
            foto_url: payload.new.motorista_foto_url
          })
        }
      })
      .subscribe()
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [activeTripId])

  const calculatePrice = async () => {
    if (!origemCoords || !destinoCoords) return

    try {
      const routeData = await fetchOsrmRoute(origemCoords, destinoCoords)
      const distanceKm = routeData.distanceMeters / 1000
      const durationMin = routeData.durationSeconds / 60
      const price = TAXA_ENTREGA + (distanceKm * 300)
      setEstimatedPrice({ price: Math.round(price), distance: distanceKm, duration: durationMin })
    } catch (error) {
      console.error('Error calculating price:', error)
    }
  }

  const buscarSugestoesOrigem = (texto: string) => {
    if (origemDebounceRef.current) clearTimeout(origemDebounceRef.current)
    if (texto.length < 3) {
      setOrigemSuggestions([])
      setShowOrigemSuggestions(false)
      return
    }
    origemDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texto)}&format=json&addressdetails=1&limit=5&countrycodes=ao`,
          { headers: { 'User-Agent': 'AG-PILOTO/1.0 (ag-piloto.vercel.app)' } }
        )
        const data = await res.json()
        setOrigemSuggestions(data)
        setShowOrigemSuggestions(true)
      } catch (err) {
        console.error('Erro autocomplete origem:', err)
      }
    }, 400)
  }

  const buscarSugestoesDestino = (texto: string) => {
    if (destinoDebounceRef.current) clearTimeout(destinoDebounceRef.current)
    if (texto.length < 3) {
      setDestinoSuggestions([])
      setShowDestinoSuggestions(false)
      return
    }
    destinoDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texto)}&format=json&addressdetails=1&limit=5&countrycodes=ao`,
          { headers: { 'User-Agent': 'AG-PILOTO/1.0 (ag-piloto.vercel.app)' } }
        )
        const data = await res.json()
        setDestinoSuggestions(data)
        setShowDestinoSuggestions(true)
      } catch (err) {
        console.error('Erro autocomplete destino:', err)
      }
    }, 400)
  }

  const selecionarSugestaoOrigem = (s: Suggestion) => {
    setFormData(prev => ({ ...prev, origemAddress: s.display_name }))
    setOrigemSuggestions([])
    setShowOrigemSuggestions(false)
    setOrigemCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
  }

  const selecionarSugestaoDestino = (s: Suggestion) => {
    setFormData(prev => ({ ...prev, destinoAddress: s.display_name }))
    setDestinoSuggestions([])
    setShowDestinoSuggestions(false)
    setDestinoCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'origemAddress') {
      buscarSugestoesOrigem(value)
    } else if (name === 'destinoAddress') {
      buscarSugestoesDestino(value)
    }
  }

  const validateWhatsApp = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length >= 9
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.origemAddress || !formData.destinoAddress || !formData.whatsapp) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' })
      return
    }

    if (!origemCoords || !destinoCoords) {
      setMessage({ type: 'error', text: 'Seleccione endereços válidos das sugestões.' })
      return
    }

    if (!validateWhatsApp(formData.whatsapp)) {
      setMessage({ type: 'error', text: 'WhatsApp inválido. Mínimo 9 dígitos.' })
      return
    }

    setLoading(true)

    try {
      const total = estimatedPrice?.price || TAXA_ENTREGA

      const { data: insertData, error } = await supabase
        .from('trips')
        .insert([{
          destination_address: formData.destinoAddress,
          origin_address: formData.origemAddress,
          quoted_price: total,
          status: 'pending',
          service_type: 'documentos',
          origin_lat: origemCoords.lat,
          origin_lng: origemCoords.lng,
          destination_lat: destinoCoords.lat,
          destination_lng: destinoCoords.lng,
          metadata: {
            descricao: formData.descricao,
            whatsapp: formData.whatsapp
          }
        }])
        .select('id')
        .single()

      if (error) throw error
      setActiveTripId(insertData.id)

      setMessage({ type: 'success', text: 'Pedido enviado! O motoqueiro chegará em breve.' })
      setTripAceite(false)
      setMotoristaInfo(null)
      setFormData({
        descricao: '',
        origemAddress: '',
        destinoAddress: '',
        whatsapp: ''
      })
      setOrigemCoords(null)
      setDestinoCoords(null)
      setEstimatedPrice(null)
    } catch (error) {
      console.error('Error submitting documentos:', error)
      setMessage({ type: 'error', text: 'Erro ao enviar pedido. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="documentos-page">
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6b7280',
          fontSize: '14px',
          padding: '12px 16px',
          fontWeight: '500'
        }}
      >
        ← Voltar
      </button>
      <header className="documentos-page__header">
        <span className="documentos-page__badge">AG-PILOTO</span>
        <h1 className="documentos-page__title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}>
            <path d="M9 4h6l3 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V6a2 2 0 012-2zM9 10h6M9 14h4" />
          </svg>
          Serviço de Documentos
        </h1>
        <p className="documentos-page__subtitle">Levantamento e entrega de documentos com segurança em Luanda</p>
      </header>

      {message && (
        <div className={`documentos-page__message documentos-page__message--${message.type}`}>
          {message.text}
        </div>
      )}

      {tripAceite && motoristaInfo && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '16px',
          padding: '20px',
          marginTop: '16px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '12px', color: '#15803d', 
            fontWeight: 700, fontSize: '1rem' }}>
            Pedido Aceite!
          </div>
          {motoristaInfo.foto_url && (
            <img src={motoristaInfo.foto_url}
              style={{ width: 60, height: 60, borderRadius: '50%',
                objectFit: 'cover', border: '3px solid #16a34a',
                marginBottom: '10px' }}
              alt="Motorista" />
          )}
          <div style={{ fontWeight: 700, color: '#111827', 
            marginBottom: '8px' }}>
            {motoristaInfo.nome}
          </div>
          {motoristaInfo.whatsapp && (
            <a href={`https://wa.me/${motoristaInfo.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Olá! Aceitaste o meu pedido de documentos. Quando chegará?')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ color: '#25D366', fontWeight: 600,
                fontSize: '0.9rem', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Contactar Motoqueiro
            </a>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="documentos-page__form">
        <div className="documentos-page__form-group">
          <label htmlFor="descricao">Descrição do Documento (opcional)</label>
          <textarea
            id="descricao"
            name="descricao"
            value={formData.descricao}
            onChange={handleInputChange}
            rows={3}
            placeholder="Descreva o tipo de documento (ex: BI, passaporte, certidão...)"
            className="documentos-page__textarea"
          />
        </div>

        <div className="documentos-page__form-group">
          <label htmlFor="origemAddress">Ponto de Origem *</label>
          <input
            type="text"
            id="origemAddress"
            name="origemAddress"
            value={formData.origemAddress}
            onChange={handleInputChange}
            placeholder="Digite o endereço de origem..."
            className="documentos-page__input"
            required
          />
          {showOrigemSuggestions && origemSuggestions.length > 0 && (
            <div className="documentos-page__suggestions">
              {origemSuggestions.map((s, idx) => (
                <div
                  key={s.place_id || idx}
                  className="documentos-page__suggestion"
                  onClick={() => selecionarSugestaoOrigem(s)}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="documentos-page__form-group">
          <label htmlFor="destinoAddress">Ponto de Destino *</label>
          <input
            type="text"
            id="destinoAddress"
            name="destinoAddress"
            value={formData.destinoAddress}
            onChange={handleInputChange}
            placeholder="Digite o endereço de destino..."
            className="documentos-page__input"
            required
          />
          {showDestinoSuggestions && destinoSuggestions.length > 0 && (
            <div className="documentos-page__suggestions">
              {destinoSuggestions.map((s, idx) => (
                <div
                  key={s.place_id || idx}
                  className="documentos-page__suggestion"
                  onClick={() => selecionarSugestaoDestino(s)}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="documentos-page__form-group">
          <label htmlFor="whatsapp">WhatsApp de Contacto *</label>
          <input
            type="tel"
            id="whatsapp"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleInputChange}
            placeholder="+244 9XX XXX XXX"
            className="documentos-page__input"
            required
          />
        </div>

        {estimatedPrice && (
          <div className="documentos-page__price-card">
            <div className="documentos-page__price-label">Estimativa:</div>
            <div className="documentos-page__price-value">{estimatedPrice.price.toLocaleString('pt-AO')} Kz</div>
            <div className="documentos-page__price-details">
              {estimatedPrice.distance.toFixed(1)} km · {estimatedPrice.duration.toFixed(0)} min
            </div>
          </div>
        )}

        <button
          type="submit"
          className="documentos-page__submit-btn"
          disabled={loading}
        >
          {loading ? 'A enviar...' : 'Solicitar Motoqueiro'}
        </button>
      </form>
    </div>
  )
}
