import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, ZoomControl, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { fetchOsrmRoute, type Coordinates } from '../services/osrm'
import ToastNotification from '../components/ToastNotification'
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
  const [freteAceiteId, setFreteAceiteId] = useState<string | null>(null)
  const [freteAceite, setFreteAceite] = useState(false)
  const [motoristaInfo, setMotoristaInfo] = useState<{
    nome: string, whatsapp: string, foto_url?: string
  } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const origemDebounceRef = useRef<number | null>(null)
  const destinoDebounceRef = useRef<number | null>(null)
  const mapRef = useRef<L.Map>(null)
  const subscriptionRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (origemDebounceRef.current) clearTimeout(origemDebounceRef.current)
      if (destinoDebounceRef.current) clearTimeout(destinoDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!freteAceiteId) return
    
    if ('Notification' in window && 
        Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
    subscriptionRef.current = supabase
      .channel(`frete-${freteAceiteId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'fretes',
        filter: `id=eq.${freteAceiteId}` 
      }, (payload) => {
        if (payload.new.status === 'aceite') {
          const audio = new Audio('/notification.mp3')
          audio.play().catch(() => {})
          
          if (Notification.permission === 'granted') {
            new Notification('Frete Aceite!', {
              body: 'O motoqueiro está a caminho',
              icon: '/favicon.ico'
            })
          }
          
          setFreteAceite(true)
          setMotoristaInfo({
            nome: payload.new.motorista_nome || 'Motoqueiro',
            whatsapp: payload.new.motorista_whatsapp || '',
            foto_url: payload.new.motorista_foto_url
          })
        } else if (payload.new.status === 'pendente') {
          const audio = new Audio('/notification.mp3')
          audio.play().catch(() => {})
          
          if (Notification.permission === 'granted') {
            new Notification('Frete Cancelado', {
              body: 'O motoqueiro cancelou o frete',
              icon: '/favicon.ico'
            })
          }
          
          setToast({ message: 'O motoqueiro cancelou o frete', type: 'error' })
          setFreteAceite(false)
          setMotoristaInfo(null)
          setFreteAceiteId(null)
        } else if (payload.new.status === 'concluido') {
          const audio = new Audio('/notification.mp3')
          audio.play().catch(() => {})
          
          if (Notification.permission === 'granted') {
            new Notification('Frete Concluído', {
              body: 'O motoqueiro concluiu o frete com sucesso',
              icon: '/favicon.ico'
            })
          }
          
          setToast({ message: 'Frete concluído com sucesso!', type: 'success' })
          setFreteAceite(false)
          setMotoristaInfo(null)
          setFreteAceiteId(null)
        }
      })
      .subscribe()
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [freteAceiteId])

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

      const { data: insertData, error } = await supabase
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
          status: 'pendente',
          quoted_price: estimatedPrice?.price || null
        }])
        .select('id')
        .single()

      if (error) throw error
      setFreteAceiteId(insertData.id)
      setMessage({ type: 'success', text: 'Pedido enviado! A aguardar motoqueiro...' })
    } catch (error) {
      console.error('Error submitting frete:', error)
      setMessage({ type: 'error', text: 'Erro ao enviar pedido. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  const handleNovoPedido = () => {
    setFreteAceiteId(null)
    setFreteAceite(false)
    setMotoristaInfo(null)
    setMessage(null)
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
  }

  if (freteAceiteId && !freteAceite) {
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
          <p className="frete-page__subtitle">A aguardar motoqueiro...</p>
        </header>
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
            Pedido Enviado!
          </div>
          <div style={{ marginBottom: '8px', color: '#374151' }}>
            <strong>De:</strong> {formData.origemAddress}
          </div>
          <div style={{ marginBottom: '8px', color: '#374151' }}>
            <strong>Para:</strong> {formData.destinoAddress}
          </div>
          {estimatedPrice && (
            <div style={{ color: '#374151' }}>
              <strong>Estimativa:</strong> {estimatedPrice.price.toLocaleString('pt-AO')} Kz
            </div>
          )}
          <div style={{ marginTop: '16px', color: '#6b7280', fontSize: '0.9rem' }}>
            A aguardar que um motoqueiro aceite o pedido...
          </div>
        </div>
      </div>
    )
  }

  if (freteAceite && motoristaInfo) {
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
          <p className="frete-page__subtitle">Pedido Aceite!</p>
        </header>
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
            Frete Aceite!
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
            <a href={`https://wa.me/${motoristaInfo.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Olá! Aceitaste o meu pedido de frete. Quando chegará?')}`}
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
          <button
            onClick={handleNovoPedido}
            style={{
              marginTop: '16px',
              padding: '12px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#16a34a',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Novo Pedido
          </button>
        </div>
      </div>
    )
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
              <path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"></path>
            </svg>
            {routeStats.distanceKm.toFixed(1)} km · 
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', marginLeft: '4px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            {routeStats.durationMin.toFixed(0)} min · 
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', marginLeft: '4px' }}>
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Estimativa: {estimatedPrice?.price.toLocaleString('pt-AO')} Kz
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
      
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
