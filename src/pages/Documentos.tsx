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

  const origemDebounceRef = useRef<number | null>(null)
  const destinoDebounceRef = useRef<number | null>(null)

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

      const { error } = await supabase
        .from('trips')
        .insert([{
          destination_address: formData.destinoAddress,
          origin_address: formData.origemAddress,
          quoted_price: total,
          status: 'pending',
          metadata: {
            service_type: 'documentos',
            descricao: formData.descricao,
            whatsapp: formData.whatsapp,
            origem_lat: origemCoords.lat,
            origem_lng: origemCoords.lng,
            destino_lat: destinoCoords.lat,
            destino_lng: destinoCoords.lng
          }
        }])

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Pedido enviado! O motoqueiro chegará em breve.' })
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
        <h1 className="documentos-page__title">📄 Serviço de Documentos</h1>
        <p className="documentos-page__subtitle">Levantamento e entrega de documentos com segurança em Luanda</p>
      </header>

      {message && (
        <div className={`documentos-page__message documentos-page__message--${message.type}`}>
          {message.text}
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
