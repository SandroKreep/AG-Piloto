import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Farmacia.css'

type Medicamento = {
  id: string
  nome: string
  descricao: string
  preco: number
  categoria: string
  imagem_url: string | null
  disponivel: boolean
}

type OrderModal = {
  isOpen: boolean
  medicamento: Medicamento | null
  quantidade: number
  endereco: string
  enderecoCoords: { lat: number; lon: number } | null
  loading: boolean
}

const CATEGORIAS = ['Todos', 'Analgésico', 'Antibiótico', 'Vitaminas', 'Higiene', 'Outros']
const TAXA_ENTREGA = 500

export default function Farmacia() {
  const navigate = useNavigate()
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<OrderModal>({
    isOpen: false,
    medicamento: null,
    quantidade: 1,
    endereco: '',
    enderecoCoords: null,
    loading: false
  })
  const [sugestoesEndereco, setSugestoesEndereco] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])

  useEffect(() => {
    fetchMedicamentos()
  }, [])

  const fetchMedicamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('medicamentos')
        .select('*')
        .order('nome')

      if (error) throw error
      setMedicamentos(data || [])
    } catch (error) {
      console.error('Error fetching medicamentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const medicamentosFiltrados = medicamentos.filter(m => {
    const matchCategoria = categoriaAtiva === 'Todos' || m.categoria === categoriaAtiva
    const matchBusca = m.nome.toLowerCase().includes(busca.toLowerCase()) ||
                      m.descricao.toLowerCase().includes(busca.toLowerCase())
    return matchCategoria && matchBusca
  })

  const handleOpenModal = (medicamento: Medicamento) => {
    setModal({
      isOpen: true,
      medicamento,
      quantidade: 1,
      endereco: '',
      enderecoCoords: null,
      loading: false
    })
  }

  const handleCloseModal = () => {
    setModal({
      isOpen: false,
      medicamento: null,
      quantidade: 1,
      endereco: '',
      enderecoCoords: null,
      loading: false
    })
    setSugestoesEndereco([])
  }

  const handleQuantidadeChange = (delta: number) => {
    const novaQuantidade = modal.quantidade + delta
    if (novaQuantidade >= 1 && novaQuantidade <= 10) {
      setModal(prev => ({ ...prev, quantidade: novaQuantidade }))
    }
  }

  const handleEnderecoChange = async (value: string) => {
    setModal(prev => ({ ...prev, endereco: value, enderecoCoords: null }))

    if (value.length < 3) {
      setSugestoesEndereco([])
      return
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&countrycodes=ao&limit=5`
      )
      const data = await response.json()
      setSugestoesEndereco(data)
    } catch (error) {
      console.error('Error fetching address suggestions:', error)
    }
  }

  const handleSelectEndereco = (sugestao: { display_name: string; lat: string; lon: string }) => {
    setModal(prev => ({
      ...prev,
      endereco: sugestao.display_name,
      enderecoCoords: { lat: parseFloat(sugestao.lat), lon: parseFloat(sugestao.lon) }
    }))
    setSugestoesEndereco([])
  }

  const handleConfirmarPedido = async () => {
    if (!modal.medicamento || !modal.endereco) return

    setModal(prev => ({ ...prev, loading: true }))

    try {
      const subtotal = modal.medicamento.preco * modal.quantidade
      const total = subtotal + TAXA_ENTREGA

      const { error } = await supabase
        .from('trips')
        .insert([{
          service_type: 'farmacia',
          destination_address: modal.endereco,
          origin_address: 'Farmácia AG-PILOTO',
          quoted_price: total,
          status: 'pending'
        }])

      if (error) throw error

      alert('Pedido realizado com sucesso! O motoqueiro chegará em breve.')
      handleCloseModal()
      navigate('/')
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Erro ao realizar pedido. Tente novamente.')
    } finally {
      setModal(prev => ({ ...prev, loading: false }))
    }
  }

  const subtotal = modal.medicamento ? modal.medicamento.preco * modal.quantidade : 0
  const total = subtotal + TAXA_ENTREGA

  return (
    <div className="farmacia">
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
      <header className="farmacia__header">
        <div className="farmacia__header-content">
          <div className="farmacia__logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}>
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
              <path d="M8.5 8.5v.01"></path>
              <path d="M16 16v.01"></path>
              <path d="M12 12v.01"></path>
              <path d="M8.5 15.5v.01"></path>
              <path d="M15.5 8.5v.01"></path>
            </svg>
            <h1>Farmácia AG-PILOTO</h1>
          </div>
          <p className="farmacia__subtitle">Medicamentos entregues por motoqueiro em Luanda</p>
        </div>
        <div className="farmacia__search">
          <input
            type="text"
            placeholder="Buscar medicamentos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="farmacia__search-input"
          />
          <span className="farmacia__search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
        </div>
      </header>

      <div className="farmacia__banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
        </svg>
        Entrega rápida em Luanda · Pague na entrega
      </div>

      <div className="farmacia__filters">
        {CATEGORIAS.map(categoria => (
          <button
            key={categoria}
            className={`farmacia__filter ${categoriaAtiva === categoria ? 'farmacia__filter--active' : ''}`}
            onClick={() => setCategoriaAtiva(categoria)}
          >
            {categoria}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="farmacia__loading">A carregar medicamentos...</div>
      ) : medicamentosFiltrados.length === 0 ? (
        <div className="farmacia__empty">
          <p>Nenhum medicamento encontrado</p>
        </div>
      ) : (
        <div className="farmacia__grid">
          {medicamentosFiltrados.map(medicamento => (
            <div key={medicamento.id} className="farmacia__card">
              <div className="farmacia__card-image">
                {medicamento.imagem_url ? (
                  <img src={medicamento.imagem_url} alt={medicamento.nome} />
                ) : (
                  <div className="farmacia__card-image-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                      <path d="M8.5 8.5v.01"></path>
                      <path d="M16 16v.01"></path>
                      <path d="M12 12v.01"></path>
                      <path d="M8.5 15.5v.01"></path>
                      <path d="M15.5 8.5v.01"></path>
                    </svg>
                  </div>
                )}
              </div>
              <span className="farmacia__card-category">{medicamento.categoria}</span>
              <h3 className="farmacia__card-title">{medicamento.nome}</h3>
              <p className="farmacia__card-desc">{medicamento.descricao}</p>
              <div className="farmacia__card-price">
                {medicamento.preco.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}
              </div>
              {medicamento.disponivel ? (
                <button
                  className="farmacia__card-btn"
                  onClick={() => handleOpenModal(medicamento)}
                >
                  Pedir Entrega
                </button>
              ) : (
                <span className="farmacia__card-unavailable">Indisponível</span>
              )}
            </div>
          ))}
        </div>
      )}

      <footer className="farmacia__footer">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
          <path d="M8.5 8.5v.01"></path>
          <path d="M16 16v.01"></path>
          <path d="M12 12v.01"></path>
          <path d="M8.5 15.5v.01"></path>
          <path d="M15.5 8.5v.01"></path>
        </svg>
        Farmácia AG-PILOTO · Entregamos em toda Luanda
      </footer>

      {modal.isOpen && modal.medicamento && (
        <div className="farmacia__modal-overlay">
          <div className="farmacia__modal">
            <div className="farmacia__modal-header">
              <h2>{modal.medicamento.nome}</h2>
              <button className="farmacia__modal-close" onClick={handleCloseModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="farmacia__modal-body">
              <div className="farmacia__modal-section">
                <label>Quantidade</label>
                <div className="farmacia__quantity-control">
                  <button
                    className="farmacia__quantity-btn"
                    onClick={() => handleQuantidadeChange(-1)}
                    disabled={modal.quantidade <= 1}
                  >
                    -
                  </button>
                  <span className="farmacia__quantity-value">{modal.quantidade}</span>
                  <button
                    className="farmacia__quantity-btn"
                    onClick={() => handleQuantidadeChange(1)}
                    disabled={modal.quantidade >= 10}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="farmacia__modal-section">
                <label>Endereço de Entrega</label>
                <input
                  type="text"
                  value={modal.endereco}
                  onChange={(e) => handleEnderecoChange(e.target.value)}
                  placeholder="Digite seu endereço em Luanda..."
                  className="farmacia__modal-input"
                />
                {sugestoesEndereco.length > 0 && (
                  <div className="farmacia__suggestions">
                    {sugestoesEndereco.map((sugestao, index) => (
                      <div
                        key={index}
                        className="farmacia__suggestion"
                        onClick={() => handleSelectEndereco(sugestao)}
                      >
                        {sugestao.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="farmacia__modal-summary">
                <div className="farmacia__summary-row">
                  <span>Subtotal:</span>
                  <span>{subtotal.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}</span>
                </div>
                <div className="farmacia__summary-row">
                  <span>Taxa de entrega:</span>
                  <span>{TAXA_ENTREGA.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}</span>
                </div>
                <div className="farmacia__summary-row farmacia__summary-row--total">
                  <span>Total:</span>
                  <span>{total.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}</span>
                </div>
              </div>
            </div>

            <div className="farmacia__modal-footer">
              <button
                className="farmacia__modal-btn farmacia__modal-btn--cancel"
                onClick={handleCloseModal}
                disabled={modal.loading}
              >
                Cancelar
              </button>
              <button
                className="farmacia__modal-btn farmacia__modal-btn--confirm"
                onClick={handleConfirmarPedido}
                disabled={!modal.endereco || modal.loading}
              >
                {modal.loading ? 'A processar...' : 'Confirmar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
