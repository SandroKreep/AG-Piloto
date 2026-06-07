import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import './MotoqueiroPedidos.css'

type Motorista = {
  id: string
  nome: string
  ultimo_nome?: string
  email?: string
  whatsapp: string
  foto_url?: string
  password?: string
  ativo?: boolean
  created_at?: string
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
  foto_url?: string
  cliente_whatsapp?: string
}

export default function MotoqueiroPedidos() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [motorista, setMotorista] = useState<Motorista | null>(null)
  const [nome, setNome] = useState('')
  const [ultimoNome, setUltimoNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [modoLogin, setModoLogin] = useState<'login' | 'register'>('login')
  const [erro, setErro] = useState('')
  const [pedidos, setPedidos] = useState<Trip[]>([])
  const [fretes, setFretes] = useState<Trip[]>([])
  const [meusPedidos, setMeusPedidos] = useState<Trip[]>([])
  const [filtro, setFiltro] = useState<'Todos' | 'Moto-Táxi' | 'Frete' | 'Farmácia' | 'Documentos'>('Todos')
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Trip | null>(null)
  const [rota, setRota] = useState<[number, number][]>([])
  const [mapaLoading, setMapaLoading] = useState(false)
  const [motoristaLocation, setMotoristaLocation] = useState<[number, number] | null>(null)
  const [aceitando, setAceitando] = useState<string | null>(null)

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
    if (link) link.href = '/manifest-moto.webmanifest'
    
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBtn(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    
    return () => {
      if (link) link.href = '/manifest.webmanifest'
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  useEffect(() => {
    const motoristaSalvo = localStorage.getItem('ag_motorista')
    if (motoristaSalvo) {
      setMotorista(JSON.parse(motoristaSalvo))
    }
  }, [])

  useEffect(() => {
    if (motorista) {
      carregarPedidos()
      carregarFretes()
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
          if (payload.new.status === 'ASSIGNED' || payload.new.status === 'assigned') {
            setPedidos(prev => prev.filter(p => p.id !== payload.new.id))
            if (payload.new.motorista_id === motorista.id) {
              setMeusPedidos(prev => {
                if (prev.some(p => p.id === payload.new.id)) return prev
                return [payload.new as Trip, ...prev]
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fretes'
        },
        (payload) => {
          if (payload.new.status === 'pendente') {
            const freteConvertido = {
              id: payload.new.id,
              status: payload.new.status,
              service_type: 'frete',
              origin_address: payload.new.origem_address || '',
              destination_address: payload.new.destino_address || '',
              quoted_price: payload.new.quoted_price,
              created_at: payload.new.created_at,
              motorista_id: null,
              origin_lat: payload.new.origem_lat,
              origin_lng: payload.new.origem_lng,
              destination_lat: payload.new.destino_lat,
              destination_lng: payload.new.destino_lng,
              foto_url: payload.new.foto_url || null,
              cliente_whatsapp: payload.new.whatsapp || null,
              _is_frete: true,
            }
            setFretes(prev => [freteConvertido as Trip, ...prev])
            const audio = new Audio('/notification.mp3')
            audio.play().catch(() => {})
            notificarBrowser(freteConvertido as Trip)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fretes'
        },
        (payload) => {
          if (payload.new.status === 'aceite') {
            setFretes(prev => prev.filter(f => f.id !== payload.new.id))
            if (payload.new.motorista_id === motorista.id) {
              const freteConvertido = {
                id: payload.new.id,
                status: payload.new.status,
                service_type: 'frete',
                origin_address: payload.new.origem_address || '',
                destination_address: payload.new.destino_address || '',
                quoted_price: payload.new.quoted_price,
                created_at: payload.new.created_at,
                motorista_id: payload.new.motorista_id,
                motorista_nome: payload.new.motorista_nome,
                motorista_whatsapp: payload.new.motorista_whatsapp,
                origin_lat: payload.new.origem_lat,
                origin_lng: payload.new.origem_lng,
                destination_lat: payload.new.destino_lat,
                destination_lng: payload.new.destino_lng,
                _is_frete: true,
              }
              setMeusPedidos(prev => [freteConvertido as Trip, ...prev])
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [motorista])

  const registar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro('')

    if (password.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.')
      setLoading(false)
      return
    }

    try {
      // 1. Upload da foto
      let foto_url = ''
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const path = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('motoristas').upload(path, fotoFile)
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('motoristas').getPublicUrl(path)
        foto_url = data.publicUrl
      }

      // 2. Insere motorista
      const { data, error } = await supabase
        .from('motoristas')
        .insert({ nome, ultimo_nome: ultimoNome, email, whatsapp, password, foto_url })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          setErro('Email ou WhatsApp já registado.')
        } else {
          setErro('Erro ao criar conta: ' + error.message)
        }
        setLoading(false)
        return
      }

      setMotorista(data)
      localStorage.setItem('ag_motorista', JSON.stringify(data))
    } catch (error: any) {
      console.error('Erro ao registar:', error)
      setErro('Erro ao criar conta: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro('')

    try {
      const { data, error } = await supabase
        .from('motoristas')
        .select('*')
        .or(`email.eq.${email},whatsapp.eq.${email}`)
        .eq('password', password)
        .single()

      if (error || !data) {
        setErro('Email/WhatsApp ou senha incorrectos.')
        setLoading(false)
        return
      }

      setMotorista(data)
      localStorage.setItem('ag_motorista', JSON.stringify(data))
    } catch (error: any) {
      console.error('Erro ao fazer login:', error)
      setErro('Erro ao fazer login: ' + error.message)
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

  const carregarFretes = async () => {
    const { data } = await supabase
      .from('fretes')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
    if (data) {
      const fretesConvertidos = data.map((f: any) => ({
        id: f.id,
        status: f.status,
        service_type: 'frete',
        origin_address: f.origem_address || '',
        destination_address: f.destino_address || '',
        quoted_price: f.quoted_price,
        created_at: f.created_at,
        motorista_id: null,
        origin_lat: f.origem_lat,
        origin_lng: f.origem_lng,
        destination_lat: f.destino_lat,
        destination_lng: f.destino_lng,
        foto_url: f.foto_url || null,
        cliente_whatsapp: f.whatsapp || null,
        _is_frete: true,
      }))
      setFretes(fretesConvertidos)
    }
  }

  const carregarMeusPedidos = async () => {
    if (!motorista) return
    
    const { data: tripsData } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['ASSIGNED', 'assigned', 'ACCEPTED', 'accepted'])
      .eq('motorista_id', motorista.id)
      .order('created_at', { ascending: false })
    
    const { data: fretesData } = await supabase
      .from('fretes')
      .select('*')
      .eq('status', 'aceite')
      .eq('motorista_id', motorista.id)
      .order('created_at', { ascending: false })
    
    const fretesConvertidos = (fretesData ?? []).map((f: any) => ({
      id: f.id,
      status: f.status,
      service_type: 'frete',
      origin_address: f.origem_address || '',
      destination_address: f.destino_address || '',
      quoted_price: f.quoted_price,
      created_at: f.created_at,
      motorista_id: f.motorista_id,
      origin_lat: f.origem_lat,
      origin_lng: f.origem_lng,
      destination_lat: f.destino_lat,
      destination_lng: f.destino_lng,
      _is_frete: true,
    }))
    
    setMeusPedidos([...(tripsData ?? []), ...fretesConvertidos] as Trip[])
  }

  const aceitarPedido = async (tripId: string, isFrete?: boolean) => {
    if (!motorista) return
    if (aceitando === tripId) return
    setAceitando(tripId)

    if (isFrete) {
      const { error } = await supabase
        .from('fretes')
        .update({
          status: 'aceite',
          motorista_id: motorista.id,
          motorista_nome: `${motorista.nome} ${motorista.ultimo_nome || ''}`.trim(),
          motorista_whatsapp: motorista.whatsapp,
        })
        .eq('id', tripId)
        .eq('status', 'pendente')

      if (!error) {
        setFretes(prev => prev.filter(f => f.id !== tripId))
      }
      setAceitando(null)
      return
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'ASSIGNED',
        motorista_id: motorista.id,
        motorista_nome: `${motorista.nome} ${motorista.ultimo_nome || ''}`.trim(),
        motorista_whatsapp: motorista.whatsapp,
        motorista_foto_url: motorista.foto_url || null
      })
      .eq('id', tripId)
      .in('status', ['PENDING', 'pending', 'REQUESTED', 'requested'])

    if (error) {
      console.error('Erro ao aceitar pedido:', error)
      setAceitando(null)
      return
    }

    const pedidoAceite = pedidos.find(p => p.id === tripId)
    if (pedidoAceite) {
      setMeusPedidos(prev => {
        if (prev.some(p => p.id === tripId)) return prev
        return [{
          ...pedidoAceite,
          status: 'ASSIGNED',
          motorista_nome: `${motorista.nome} ${motorista.ultimo_nome || ''}`.trim(),
          motorista_whatsapp: motorista.whatsapp,
          motorista_foto_url: motorista.foto_url || null,
        }, ...prev]
      })
    }
    setPedidos(prev => prev.filter(p => p.id !== tripId))
    setAceitando(null)
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

  const getNomeServico = (serviceType?: string) => {
    switch (serviceType) {
      case 'moto': return 'Moto-Táxi'
      case 'frete': return 'Frete'
      case 'farmacia': return 'Farmácia'
      case 'documentos': return 'Documentos'
      case 'familiar': return 'Familiar'
      default: return serviceType || 'Moto-Táxi'
    }
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

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setShowInstallBtn(false)
  }

  const selecionarPedido = async (trip: Trip) => {
    if (pedidoSelecionado?.id === trip.id) {
      setPedidoSelecionado(null)
      setRota([])
      return
    }
    setPedidoSelecionado(trip)
    
    if (!trip.origin_lat || !trip.origin_lng || 
        !trip.destination_lat || !trip.destination_lng) {
      setMapaLoading(false)
      setRota([])
      return
    }
    
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

  const todosPedidos = [...pedidos, ...fretes]

  const pedidosFiltrados = todosPedidos.filter(pedido => {
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
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
            Motoqueiro
          </h1>
          <p>{modoLogin === 'login' ? 'Entre com seus dados para ver pedidos disponíveis' : 'Crie sua conta para começar'}</p>
          
          {erro && (
            <div style={{
              background: '#fee2e2',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.9rem'
            }}>
              {erro}
            </div>
          )}

          {modoLogin === 'register' ? (
            <form onSubmit={registar}>
              <input
                type="text"
                placeholder="Primeiro nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Último nome"
                value={ultimoNome}
                onChange={(e) => setUltimoNome(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="WhatsApp (+244...)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Senha (mínimo 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                  color: '#374151'
                }}>
                  Foto 4x4 (opcional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px'
                  }}
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'A criar conta...' : 'Criar Conta'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoLogin('login')
                  setErro('')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  marginTop: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Já tenho conta → Entrar
              </button>
            </form>
          ) : (
            <form onSubmit={login}>
              <input
                type="text"
                placeholder="Email ou WhatsApp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoLogin('register')
                  setErro('')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  marginTop: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Não tenho conta → Criar Conta
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="moto-pedidos">
      <div className="moto-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {motorista.foto_url ? (
            <img src={motorista.foto_url} 
              style={{ width: 40, height: 40, borderRadius: '50%', 
                objectFit: 'cover', border: '2px solid #ff6b00' }} 
              alt={motorista.nome} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%',
              background: '#ff6b00', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
              {motorista.nome[0]}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {motorista.nome} {motorista.ultimo_nome}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {motorista.whatsapp}
            </div>
          </div>
        </div>
        {showInstallBtn && (
          <button onClick={handleInstall} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'transparent', border: '1px solid #ff6b00',
            color: '#ff6b00', borderRadius: '8px', padding: '7px 14px',
            fontSize: '13px', cursor: 'pointer', marginRight: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 16l-6-6h4V4h4v6h4l-6 6z" fill="currentColor"/>
              <path d="M4 20h16v-2H4v2z" fill="currentColor"/>
            </svg>
            Instalar
          </button>
        )}
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
              {getNomeServico(pedido.service_type)}
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
              {getNomeServico(pedido.service_type)}
            </div>
            <div className="moto-card__rota">
              <strong>De:</strong> {pedido.origin_address}
            </div>
            <div className="moto-card__rota">
              <strong>Para:</strong> {pedido.destination_address}
            </div>
            {pedido.service_type === 'frete' && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                {pedido.foto_url && (
                  <img src={pedido.foto_url} alt="Material" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '8px' }} />
                )}
                {pedido.cliente_whatsapp && (
                  <a href={`https://wa.me/${pedido.cliente_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {pedido.cliente_whatsapp}
                  </a>
                )}
              </div>
            )}
            <div className="moto-card__preco">{formatPrice(pedido.quoted_price)}</div>
            <div className="moto-card__footer">
              <span className="moto-card__data">{formatData(pedido.created_at)}</span>
              <button
                className="moto-card__aceitar"
                onClick={(e) => {
                  e.stopPropagation()
                  aceitarPedido(pedido.id, (pedido as any)._is_frete)
                }}
                disabled={aceitando === pedido.id}
                style={{ opacity: aceitando === pedido.id ? 0.6 : 1 }}
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
