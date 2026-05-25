import { supabase } from '../lib/supabase'
import './FretesTab.css'

type FreteRow = {
  id: string
  origem_address: string
  destino_address: string
  whatsapp: string
  quoted_price: number | null
  status: string
  foto_url: string | null
  descricao: string | null
  created_at: string
}

type Props = {
  fretes: any[]
}

export default function FretesTab({ fretes }: Props) {
  const handleAccept = async (id: string) => {
    const { error } = await supabase
      .from('fretes')
      .update({ status: 'accepted' })
      .eq('id', id)

    if (error) {
      console.error('Error accepting frete:', error)
      alert('Erro ao aceitar frete')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      pending: { text: 'Pendente', className: 'fretes-tab__badge--pending' },
      accepted: { text: 'Aceite', className: 'fretes-tab__badge--accepted' },
      completed: { text: 'Concluído', className: 'fretes-tab__badge--completed' },
      cancelled: { text: 'Cancelado', className: 'fretes-tab__badge--cancelled' },
    }
    const config = statusMap[status] || { text: status, className: 'fretes-tab__badge--pending' }
    return <span className={`fretes-tab__badge ${config.className}`}>{config.text}</span>
  }

  return (
    <div className="fretes-tab">
      {fretes.length === 0 ? (
        <p className="fretes-tab__empty">Sem pedidos de frete</p>
      ) : (
        <div className="fretes-tab__list">
          {fretes.map((frete) => (
            <div key={frete.id} className="fretes-tab__card">
              <div className="fretes-tab__card-header">
                <span className="fretes-tab__date">{formatDate(frete.created_at)}</span>
                {getStatusBadge(frete.status)}
              </div>
              
              <div className="fretes-tab__card-body">
                <div className="fretes-tab__field">
                  <span className="fretes-tab__label">De:</span>
                  <span className="fretes-tab__value">{frete.origem_address}</span>
                </div>
                <div className="fretes-tab__field">
                  <span className="fretes-tab__label">Para:</span>
                  <span className="fretes-tab__value">{frete.destino_address}</span>
                </div>
                <div className="fretes-tab__field">
                  <span className="fretes-tab__label">WhatsApp:</span>
                  <a
                    href={`https://wa.me/${frete.whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá! Somos da AG-PILOTO 🚚\nEm resposta ao seu pedido de frete:\nDe: ${frete.origem_address}\nPara: ${frete.destino_address}\nValor estimado: ${frete.quoted_price ? frete.quoted_price.toLocaleString('pt-AO') : 'A definir'} Kz\nVamos tratar do seu pedido. Podemos confirmar?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#25D366', fontWeight: 600 }}
                  >
                    {frete.whatsapp}
                  </a>
                </div>
                {frete.descricao && (
                  <div className="fretes-tab__field">
                    <span className="fretes-tab__label">Descrição:</span>
                    <span className="fretes-tab__value">{frete.descricao}</span>
                  </div>
                )}
                {frete.quoted_price && (
                  <div className="fretes-tab__field">
                    <span className="fretes-tab__label">Preço:</span>
                    <span className="fretes-tab__value fretes-tab__value--price">
                      {frete.quoted_price.toLocaleString('pt-AO')} Kz
                    </span>
                  </div>
                )}
              </div>

              {frete.foto_url && (
                <div className="fretes-tab__photo">
                  <img src={frete.foto_url} alt="Foto do material" className="fretes-tab__photo-img" />
                </div>
              )}

              {frete.status === 'pending' && (
                <button
                  type="button"
                  className="fretes-tab__accept-btn"
                  onClick={() => handleAccept(frete.id)}
                >
                  Aceitar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
