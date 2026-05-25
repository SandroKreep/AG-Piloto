import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, ZoomControl, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import './Frete.css'

type FormData = {
  descricao: string
  origemAddress: string
  destinoAddress: string
  whatsapp: string
  imagem: File | null
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

export default function Frete() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<FormData>({
    descricao: '',
    origemAddress: '',
    destinoAddress: '',
    whatsapp: '',
    imagem: null
  })
  const [origemCoords, setOrigemCoords] = useState<Coordinates | null>(null)
  const [destinoCoords, setDestinoCoords] = useState<Coordinates | null>(null)
  const [origemSuggestions, setOrigemSuggestions] = useState<Suggestion[]>([])
  const [destinoSuggestions, setDestinoSuggestions] = useState<Suggestion[]>([])
  const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false)
  const [showDestinoSuggestions, setShowDestinoSuggestions] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [estimatedPrice, setEstimatedPrice] = useState<{ price: number; distance: number; duration: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [routePoints, setRoutePoints] = useState<Array<[number, number]>>([])
  const [routeStats, setRouteStats] = useState<{ distanceKm: number; durationMin: number } | null>(null)

  const origemDebounceRef = useRef<number | null>(null)
  const destinoDebounceRef = useRef<number | null>(null)
  const mapRef = useRef<L.Map>(null)

  useEffect(() => {
    return () => {
      if (origemDebounceRef.current) clearTimeout(origemDebounceRef.current)
      if (destinoDebounceRef.current) clearTimeout(destinoDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (origemCoords && destinoCoords) {
      calculatePrice()
      calculateRoute()
    } else {
      setEstimatedPrice(null)
      setRoutePoints([])
      setRouteStats(null)
    }
  }, [origemCoords, destinoCoords])

  const calculateRoute = async () => {
    if (!origemCoords || !destinoCoords) return

    try {
      const routeData = await fetchOsrmRoute(origemCoords, destinoCoords)
      const points = routeData.geometry.map(([lng, lat]) => [lat, lng] as [number, number])
      setRoutePoints(points)
      setRouteStats({
        distanceKm: routeData.distanceMeters / 1000,
        durationMin: routeData.durationSeconds / 60
      })

      if (mapRef.current && points.length > 0) {
        const bounds = L.latLngBounds(points.map(coord => L.latLng(coord[0], coord[1])))
        bounds.extend(L.latLng(origemCoords.lat, origemCoords.lng))
        bounds.extend(L.latLng(destinoCoords.lat, destinoCoords.lng))
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      }
    } catch (error) {
      console.error('Error calculating route:', error)
    }
  }

  const calculatePrice = async () => {
    if (!origemCoords || !destinoCoords) return

    try {
      const routeData = await fetchOsrmRoute(origemCoords, destinoCoords)
      const distanceKm = routeData.distanceMeters / 1000
      const durationMin = routeData.durationSeconds / 60
      const price = 2000 + (distanceKm * 500)
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

  const createOriginIcon = () => {
    return L.divIcon({
      className: '',
      html: `<div style="
        background: #16a34a;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">A</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const createDestinationIcon = () => {
    return L.divIcon({
      className: '',
      html: `<div style="
        background: #dc2626;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">D</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'origemAddress') {
      buscarSugestoesOrigem(value)
    } else if (name === 'destinoAddress') {
      buscarSugestoesDestino(value)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setFormData(prev => ({ ...prev, imagem: file }))
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('fretes')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('fretes')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
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
      let imageUrl = null
      if (formData.imagem) {
        imageUrl = await uploadImage(formData.imagem)
      }

      const { error } = await supabase
        .from('fretes')
        .insert([{
          origem_address: formData.origemAddress,
          origem_lat: origemCoords.lat,
          origem_lng: origemCoords.lng,
          destino_address: formData.destinoAddress,
          destino_lat: destinoCoords.lat,
          destino_lng: destinoCoords.lng,
          whatsapp: formData.whatsapp,
          descricao: formData.descricao || null,
          foto_url: imageUrl,
          status: 'pending',
          quoted_price: estimatedPrice?.price || null
        }])

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Pedido enviado! Entraremos em contacto via WhatsApp.' })
      setFormData({
        descricao: '',
        origemAddress: '',
        destinoAddress: '',
        whatsapp: '',
        imagem: null
      })
      setOrigemCoords(null)
      setDestinoCoords(null)
      setImagePreview(null)
      setEstimatedPrice(null)
      setRoutePoints([])
      setRouteStats(null)
    } catch (error) {
      console.error('Error submitting frete:', error)
      setMessage({ type: 'error', text: 'Erro ao enviar pedido. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="frete-page">
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
      <header className="frete-page__header">
        <span className="frete-page__badge">AG-PILOTO</span>
        <h1 className="frete-page__title">🛺 Frete Kupapata</h1>
        <p className="frete-page__subtitle">Transporte de materiais com segurança em Luanda</p>
      </header>

      {message && (
        <div className={`frete-page__message frete-page__message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="frete-page__form">
        <div className="frete-page__form-group">
          <label htmlFor="imagem">Foto do Material (opcional)</label>
          <input
            type="file"
            id="imagem"
            name="imagem"
            onChange={handleImageChange}
            accept="image/*"
            className="frete-page__file-input"
          />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="frete-page__image-preview" />
          )}
        </div>

        <div className="frete-page__form-group">
          <label htmlFor="descricao">Descrição do Material (opcional)</label>
          <textarea
            id="descricao"
            name="descricao"
            value={formData.descricao}
            onChange={handleInputChange}
            rows={3}
            placeholder="Descreva o que precisa transportar..."
            className="frete-page__textarea"
          />
        </div>

        <div className="frete-page__form-group">
          <label htmlFor="origemAddress">Ponto de Partida *</label>
          <input
            type="text"
            id="origemAddress"
            name="origemAddress"
            value={formData.origemAddress}
            onChange={handleInputChange}
            placeholder="Digite o endereço de origem..."
            className="frete-page__input"
            required
          />
          {showOrigemSuggestions && origemSuggestions.length > 0 && (
            <div className="frete-page__suggestions">
              {origemSuggestions.map((s, idx) => (
                <div
                  key={s.place_id || idx}
                  className="frete-page__suggestion"
                  onClick={() => selecionarSugestaoOrigem(s)}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="frete-page__form-group">
          <label htmlFor="destinoAddress">Ponto de Destino *</label>
          <input
            type="text"
            id="destinoAddress"
            name="destinoAddress"
            value={formData.destinoAddress}
            onChange={handleInputChange}
            placeholder="Digite o endereço de destino..."
            className="frete-page__input"
            required
          />
          {showDestinoSuggestions && destinoSuggestions.length > 0 && (
            <div className="frete-page__suggestions">
              {destinoSuggestions.map((s, idx) => (
                <div
                  key={s.place_id || idx}
                  className="frete-page__suggestion"
                  onClick={() => selecionarSugestaoDestino(s)}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="frete-page__form-group">
          <label htmlFor="whatsapp">WhatsApp de Contacto *</label>
          <input
            type="tel"
            id="whatsapp"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleInputChange}
            placeholder="+244 9XX XXX XXX"
            className="frete-page__input"
            required
          />
        </div>

        <div className="frete-page__map-container">
          <MapContainer
            ref={mapRef}
            center={[-8.8399, 13.2894]}
            zoom={13}
            scrollWheelZoom={false}
            className="frete-page__map"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />
            {origemCoords && (
              <Marker position={[origemCoords.lat, origemCoords.lng]} icon={createOriginIcon()} />
            )}
            {destinoCoords && (
              <Marker position={[destinoCoords.lat, destinoCoords.lng]} icon={createDestinationIcon()} />
            )}
            {routePoints.length > 0 && (
              <Polyline 
                positions={routePoints} 
                color="#007bff" 
                weight={5} 
              />
            )}
          </MapContainer>
        </div>

        {routeStats && (
          <div className="frete-page__route-info">
            📏 {routeStats.distanceKm.toFixed(1)} km · ⏱️ {routeStats.durationMin.toFixed(0)} min · 💰 Estimativa: {estimatedPrice?.price.toLocaleString('pt-AO')} Kz
          </div>
        )}

        {estimatedPrice && (
          <div className="frete-page__price-card">
            <div className="frete-page__price-label">Estimativa:</div>
            <div className="frete-page__price-value">{estimatedPrice.price.toLocaleString('pt-AO')} Kz</div>
            <div className="frete-page__price-details">
              {estimatedPrice.distance.toFixed(1)} km · {estimatedPrice.duration.toFixed(0)} min
            </div>
          </div>
        )}

        <button
          type="submit"
          className="frete-page__submit-btn"
          disabled={loading}
        >
          {loading ? 'A enviar...' : 'Solicitar Kupapata'}
        </button>
      </form>
    </div>
  )
}
