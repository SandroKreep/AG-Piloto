import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './Comida.css'

export default function Comida() {
  const [refeicoes, setRefeicoes] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [endereco, setEndereco] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sugestoes, setSugestoes] = useState<any[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    supabase
      .from('refeicoes')
      .select('*')
      .eq('disponivel', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRefeicoes(data ?? []))
  }, [])

  const obterGPS = () => {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `/api/reverse-geocode?lat=${latitude}&lon=${longitude}`
          )
          const data = await res.json()
          if (data?.display_name) setEndereco(data.display_name)
          else setEndereco(`${latitude}, ${longitude}`)
        } catch {
          setEndereco(`${latitude}, ${longitude}`)
        }
        setGpsLoading(false)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const buscarSugestoes = (texto: string) => {
    setEndereco(texto)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (texto.length < 3) {
      setSugestoes([])
      setMostrarSugestoes(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(texto + ' Luanda Angola')}`
        )
        const data = await res.json()
        setSugestoes(data)
        setMostrarSugestoes(true)
      } catch {
        setSugestoes([])
      }
    }, 600)
  }

  const confirmarPedido = async () => {
    if (!selected || !endereco.trim()) return
    setLoading(true)
    await supabase.from('pedidos_comida').insert([{
      refeicao_id: selected.id,
      refeicao_nome: selected.nome,
      refeicao_preco: selected.preco,
      origem_address: endereco,
      whatsapp_restaurante: selected.whatsapp,
      status: 'pendente',
    }])
    const msg = encodeURIComponent(
      `Olá! Quero encomendar: ${selected.nome} - ${selected.preco} Kz\nEntrega em: ${endereco}\nPodemos confirmar?` 
    )
    window.open(`https://wa.me/${selected.whatsapp.replace(/\D/g, '')}?text=${msg}`, '_blank')
    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setSuccess(false)
      setSelected(null)
      setEndereco('')
    }, 3000)
  }

  return (
    <div className="comida-page">
      <div className="comida-header">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2a5 5 0 00-5 5v6h3v7"/>
        </svg>
        <div>
          <h1 className="comida-header__title">O que vais comer hoje?</h1>
          <p className="comida-header__subtitle">Entrega rápida em Luanda</p>
        </div>
      </div>

      <div className="comida-grid">
        {refeicoes.map((r) => (
          <div key={r.id} className="comida-card">
            <img
              src={r.foto_url || '/placeholder-food.jpg'}
              alt={r.nome}
              className="comida-card__img"
            />
            <div className="comida-card__overlay">
              <p className="comida-card__nome">{r.nome}</p>
              <p className="comida-card__preco">{Number(r.preco).toLocaleString('pt-AO')} Kz</p>
              <button
                className="comida-card__btn"
                onClick={() => {
                  setSelected(r)
                  setSuccess(false)
                  setEndereco('')
                  obterGPS()
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>
                </svg>
                Encomendar
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="comida-modal-overlay" onClick={() => setSelected(null)}>
          <div className="comida-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="comida-modal__title">{selected.nome}</h2>
            <p className="comida-modal__preco">{Number(selected.preco).toLocaleString('pt-AO')} Kz</p>
            {selected.descricao && (
              <p className="comida-modal__desc">{selected.descricao}</p>
            )}
            <label className="comida-modal__label">Endereço de entrega</label>
            <div className="comida-modal__input-row">
              <input
                className="comida-modal__input"
                value={endereco}
                onChange={(e) => buscarSugestoes(e.target.value)}
                placeholder={gpsLoading ? 'A obter localização...' : 'Ex: Rua da Samba, Luanda'}
              />
              {mostrarSugestoes && sugestoes.length > 0 && (
                <div style={{
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  marginTop: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  position: 'relative',
                  zIndex: 10
                }}>
                  {sugestoes.map((s: any) => (
                    <div
                      key={s.place_id}
                      onClick={() => {
                        setEndereco(s.display_name)
                        setSugestoes([])
                        setMostrarSugestoes(false)
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        borderBottom: '1px solid #f0f0f0',
                        color: '#111827'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fff7ed')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                    >
                      {s.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="comida-modal__confirm"
              onClick={() => {
                if (!selected || !endereco.trim()) return
                const msg = encodeURIComponent(
                  `Olá! Quero encomendar: ${selected.nome} - ${Number(selected.preco).toLocaleString('pt-AO')} Kz\nEntrega em: ${endereco}\nPodemos confirmar?`
                )
                window.open(
                  `https://wa.me/${selected.whatsapp.replace(/\D/g, '')}?text=${msg}`,
                  '_blank'
                )
              }}
              disabled={!endereco.trim()}
            >
              Confirmar Pedido
            </button>
            <button className="comida-modal__close" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
