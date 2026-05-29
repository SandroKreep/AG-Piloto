import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import './MotoqueiroPedidos.css'

type Motorista = {
  id: string
  nome: string
  whatsapp: string
}

type Trip = {
  id: string
  status: string
  service_type?: string
  origin_address: string
  destination_address: string
  quoted_price?: number
  created_at: string
  motorista_id?: string
  motorista_nome?: string
  motorista_whatsapp?: string
  origin_lat?: number
  origin_lng?: number
  destination_lat?: number
  destination_lng?: number
}

export default function MotoqueiroPedidos() {
  const navigate = useNavigate()
  const [motorista, setMotorista] = useState<Motorista | null>(null)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [pedidos, setPedidos] = useState<Trip[]>([])
  const [meusPedidos, setMeusPedidos] = useState<Trip[]>([])
  const [filtro, setFiltro] = useState<'Todos' | 'Moto-Táxi' | 'Frete' | 'Farmácia' | 'Documentos'>('Todos')
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Trip | null>(null)
  const [rota, setRota] = useState<[number, number][]>([])
  const [mapaLoading, setMapaLoading] = useState(false)
  const [motoristaLocation, setMotoristaLocation] = useState<[number, number] | null>(null)

  useEffect(() => {
    const motoristaSalvo = localStorage.getItem('ag_motorista')
    if (motoristaSalvo) {
      setMotorista(JSON.parse(motoristaSalvo))
    }
  }, [])

  useEffect(() => {
    if (motorista) {
      carregarPedidos()
      carregarMeusPedidos()
    }
  }, [motorista])

  useEffect(() => {
    if (!motorista) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setMotoristaLocation([
          position.coords.latitude,
          position.coords.longitude,
        ])
      },
      (error) => {
        console.error('Erro ao obter localização do motorista:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [motorista])

  useEffect(() => {
    if (!motorista) return

    const channel = supabase
      .channel('pedidos-motorista')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trips'
        },
        (payload) => {
          if (['PENDING', 'pending', 'REQUESTED', 'requested'].includes(payload.new.status)) {
            setPedidos(prev => [payload.new as Trip, ...prev])
            const audio = new Audio('/notification.mp3')
            audio.play().catch(() => {})
            notificarBrowser(payload.new as Trip)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips'
        },
        (payload) => {
          if (payload.new.status === 'ASSIGNED') {
            setPedidos(prev => prev.filter(p => p.id !== payload.new.id))
            if (payload.new.motorista_id === motorista.id) {
              setMeusPedidos(prev => [payload.new as Trip, ...prev])
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [motorista])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('motoristas')
        .upsert({ nome, whatsapp }, { onConflict: 'whatsapp' })
        .select()
        .single()

      if (error) throw error

      setMotorista(data)
      localStorage.setItem('ag_motorista', JSON.stringify(data))
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      alert('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('ag_motorista')
    setMotorista(null)
    setPedidos([])
    setMeusPedidos([])
  }

  const carregarPedidos = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['PENDING', 'pending', 'REQUESTED', 'requested'])
      .is('motorista_id', null)
      .order('created_at', { ascending: false })
    
    console.log('Pedidos carregados:', data?.length, 'Erro:', error)
    
    if (data) {
      setPedidos(data as Trip[])
    }
  }

  const carregarMeusPedidos = async () => {
    if (!motorista) return

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['ASSIGNED', 'assigned', 'ACCEPTED', 'accepted'])
      .eq('motorista_id', motorista.id)
      .order('created_at', { ascending: false })

    console.log('Meus pedidos:', data, 'Erro:', error)

    if (data) {
      setMeusPedidos(data as Trip[])
    }
  }

  const aceitarPedido = async (tripId: string) => {
    if (!motorista) return

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'ASSIGNED',
        motorista_id: motorista.id,
        motorista_nome: motorista.nome,
        motorista_whatsapp: motorista.whatsapp,
      })
      .eq('id', tripId)
      .eq('status', 'PENDING')

    console.error('Erro ao aceitar pedido:', error)

    if (!error) {
      const pedidoAceite = pedidos.find(p => p.id === tripId)
      if (pedidoAceite) {
        setMeusPedidos(prev => [{
          ...pedidoAceite,
          status: 'ASSIGNED',
          motorista_nome: motorista.nome,
          motorista_whatsapp: motorista.whatsapp,
        }, ...prev])
      }
      setPedidos(prev => prev.filter(p => p.id !== tripId))
    }
  }

  const cancelarPedido = async (tripId: string) => {
    if (!motorista) return

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'CANCELLED',
        motorista_id: null,
        motorista_nome: null,
        motorista_whatsapp: null,
      })
      .eq('id', tripId)
      .eq('motorista_id', motorista.id)

    if (!error) {
      setMeusPedidos(prev => prev.filter(p => p.id !== tripId))
      if (pedidoSelecionado?.id === tripId) {
        setPedidoSelecionado(null)
        setRota([])
      }
    }
  }

  const notificarBrowser = (trip: Trip) => {
    const notificar = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      if (Notification.permission === 'granted') {
        new Notification('Novo pedido disponível!', {
          body: `${trip.service_type || 'Pedido'} — ${trip.origin_address}`,
          icon: '/favicon.ico',
        })
      }
    }
    notificar()
  }

  const getServiceIcon = (serviceType?: string) => {
    switch (serviceType) {
      case 'moto':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        )
      case 'frete':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        )
      case 'farmacia':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M2 12h20" />
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        )
      case 'documentos':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        )
    }
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatData = (data: string) => {
    return new Date(data).toLocaleString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const selecionarPedido = async (trip: Trip) => {
    if (pedidoSelecionado?.id === trip.id) {
      setPedidoSelecionado(null)
      setRota([])
      return
    }
    setPedidoSelecionado(trip)
    
    if (!trip.origin_lat || !trip.origin_lng || 
        !trip.destination_lat || !trip.destination_lng) return
    
    setMapaLoading(true)
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/` +
        `${trip.origin_lng},${trip.origin_lat};` +
        `${trip.destination_lng},${trip.destination_lat}` +
        `?overview=full&geometries=geojson` 
      )
      const data = await res.json()
      if (data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates
          .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
        setRota(coords)
      }
    } catch {
      setRota([])
    }
    setMapaLoading(false)
  }

  const pedidosFiltrados = pedidos.filter(pedido => {
    if (filtro === 'Todos') return true
    if (filtro === 'Moto-Táxi') return pedido.service_type === 'moto' || !pedido.service_type
    if (filtro === 'Frete') return pedido.service_type === 'frete'
    if (filtro === 'Farmácia') return pedido.service_type === 'farmacia'
    if (filtro === 'Documentos') return pedido.service_type === 'documentos'
    return true
  })

  if (!motorista) {
    return (
      <div className="moto-pedidos">
        <div className="moto-login">
          <h1>🏍️ Motoqueiro</h1>
          <p>Entre com seus dados para ver pedidos disponíveis</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="WhatsApp (+244...)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="moto-pedidos">
      <div className="moto-header">
        <h2>Olá, {motorista.nome}!</h2>
        <button onClick={handleLogout}>Sair</button>
      </div>

      <div className="moto-filtros">
        {['Todos', 'Moto-Táxi', 'Frete', 'Farmácia', 'Documentos'].map((f) => (
          <button
            key={f}
            className={`moto-filtro ${filtro === f ? 'ativo' : ''}`}
            onClick={() => setFiltro(f as any)}
          >
            {f}
          </button>
        ))}
      </div>

      {pedidoSelecionado && (
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          height: '260px',
          margin: '8px 0 16px',
          border: '2px solid #ff6b00',
          boxShadow: '0 4px 16px rgba(255,107,0,0.2)'
        }}>
          {mapaLoading ? (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f9fafb',
              color: '#6b7280',
              fontSize: '0.88rem'
            }}>
              A carregar rota...
            </div>
          ) : (
            <MapContainer
              center={[
                pedidoSelecionado.origin_lat || -8.8399,
                pedidoSelecionado.origin_lng || 13.2894
              ]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© OpenStreetMap'
              />
              <ZoomControl position="bottomright" />
              {pedidoSelecionado.origin_lat && (
                <Marker position={[
                  pedidoSelecionado.origin_lat,
                  pedidoSelecionado.origin_lng
                ]} icon={L.divIcon({
                  className: '',
                  html: '<div style="background:#16a34a;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">A</div>',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                })} />
              )}
              {pedidoSelecionado.destination_lat && (
                <Marker position={[
                  pedidoSelecionado.destination_lat,
                  pedidoSelecionado.destination_lng
                ]} icon={L.divIcon({
                  className: '',
                  html: '<div style="background:#ef4444;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">B</div>',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                })} />
              )}
              {rota.length > 0 && (
                <Polyline 
                  positions={rota} 
                  color="#ff6b00" 
                  weight={4}
                  opacity={0.8}
                />
              )}
              {motoristaLocation && (
                <Marker position={motoristaLocation} icon={L.divIcon({
                  className: '',
                  html: '<div style="position:relative"><div style="width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);animation:pulse 1.5s infinite"></div><style>@keyframes pulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.5}100%{transform:scale(1);opacity:1}}</style></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })} />
              )}
            </MapContainer>
          )}
        </div>
      )}

      <h3 className="moto-secao-titulo">Meus Pedidos Aceites</h3>
      {meusPedidos.length === 0 ? (
        <p className="moto-vazio">Nenhum pedido aceite ainda</p>
      ) : (
        meusPedidos.map((pedido) => (
          <div key={pedido.id} 
               className="moto-card moto-card--aceite"
               onClick={() => selecionarPedido(pedido)}
               style={pedidoSelecionado?.id === pedido.id ? {
                 border: '2px solid #ff6b00',
                 boxShadow: '0 0 0 3px rgba(255,107,0,0.15)'
               } : undefined}>
            <div className="moto-card__tipo">
              {getServiceIcon(pedido.service_type)}
              {pedido.service_type || 'Moto-Táxi'}
            </div>
            <div className="moto-card__rota">
              <strong>De:</strong> {pedido.origin_address}
            </div>
            <div className="moto-card__rota">
              <strong>Para:</strong> {pedido.destination_address}
            </div>
            <div className="moto-card__preco">{formatPrice(pedido.quoted_price)}</div>
            <div className="moto-card__footer">
              <span className="moto-card__data">{formatData(pedido.created_at)}</span>
              <span className="moto-badge-aceite">Aceite por mim</span>
              <button
                className="moto-card__cancelar"
                onClick={(e) => {
                  e.stopPropagation()
                  cancelarPedido(pedido.id)
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ))
      )}

      <h3 className="moto-secao-titulo">Pedidos Disponíveis</h3>
      {pedidosFiltrados.length === 0 ? (
        <p className="moto-vazio">Nenhum pedido disponível no momento</p>
      ) : (
        pedidosFiltrados.map((pedido) => (
          <div key={pedido.id} 
               className="moto-card"
               onClick={() => selecionarPedido(pedido)}
               style={pedidoSelecionado?.id === pedido.id ? {
                 border: '2px solid #ff6b00',
                 boxShadow: '0 0 0 3px rgba(255,107,0,0.15)'
               } : undefined}>
            <div className="moto-card__tipo">
              {getServiceIcon(pedido.service_type)}
              {pedido.service_type || 'Moto-Táxi'}
            </div>
            <div className="moto-card__rota">
              <strong>De:</strong> {pedido.origin_address}
            </div>
            <div className="moto-card__rota">
              <strong>Para:</strong> {pedido.destination_address}
            </div>
            <div className="moto-card__preco">{formatPrice(pedido.quoted_price)}</div>
            <div className="moto-card__footer">
              <span className="moto-card__data">{formatData(pedido.created_at)}</span>
              <button
                className="moto-card__aceitar"
                onClick={(e) => {
                  e.stopPropagation()
                  aceitarPedido(pedido.id)
                }}
              >
                Aceitar Pedido
              </button>
            </div>
          </div>
        ))
      )}

    </div>
  )
}
