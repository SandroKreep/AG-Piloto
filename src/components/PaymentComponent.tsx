import React, { useState } from 'react'
import { CreditCard, Wallet, DollarSign, Smartphone, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './PaymentComponent.css'

interface PaymentComponentProps {
  tripId: string
  amountCents: number
  currency?: string
  onPaymentComplete?: (payment: any) => void
  onPaymentError?: (error: string) => void
}

export default function PaymentComponent({
  tripId,
  amountCents,
  currency = 'AOA',
  onPaymentComplete,
  onPaymentError
}: PaymentComponentProps) {
  const [selectedMethod, setSelectedMethod] = useState<'WALLET' | 'CASH' | 'CREDIT_CARD' | 'MOBILE_MONEY'>('WALLET')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [walletBalance, setWalletBalance] = useState(0)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: currency
    }).format(amount / 100)
  }

  const loadWalletBalance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/wallet/${session.user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setWalletBalance(data.data.balanceCents || 0)
      }
    } catch (error) {
      console.error('Erro ao carregar saldo da carteira:', error)
    }
  }

  React.useEffect(() => {
    if (selectedMethod === 'WALLET') {
      loadWalletBalance()
    }
  }, [selectedMethod])

  const handlePayment = async () => {
    setIsProcessing(true)
    setPaymentStatus('processing')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('Usuário não autenticado')
      }

      // Criar pagamento
      const createPaymentResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            tripId,
            customerId: session.user.id,
            amountCents,
            method: selectedMethod,
            platformFeeCents: Math.floor(amountCents * 0.1), // 10% taxa da plataforma
            driverFeeCents: Math.floor(amountCents * 0.05) // 5% taxa do motorista
          })
        }
      )

      if (!createPaymentResponse.ok) {
        const error = await createPaymentResponse.json()
        throw new Error(error.error || 'Erro ao criar pagamento')
      }

      const paymentData = await createPaymentResponse.json()

      // Processar pagamento baseado no método
      if (selectedMethod === 'WALLET') {
        await processWalletPayment(paymentData.data.id, user.session?.access_token)
      } else if (selectedMethod === 'CASH') {
        await processCashPayment(paymentData.data.id, user.session?.access_token)
      } else {
        // Para cartão e dinheiro móvel, mostrar formulário de pagamento
        setShowPaymentForm(true)
        setPaymentStatus('idle')
        return
      }

    } catch (error) {
      console.error('Erro no pagamento:', error)
      setPaymentStatus('failed')
      onPaymentError?.(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setIsProcessing(false)
    }
  }

  const processWalletPayment = async (paymentId: string, token?: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/payments/${paymentId}/process`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            providerTxId: `wallet_${Date.now()}`,
            providerMetadata: { method: 'wallet' }
          })
        }
      )

      if (response.ok) {
        const processedPayment = await response.json()
        setPaymentStatus('completed')
        onPaymentComplete?.(processedPayment.data)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao processar pagamento')
      }
    } catch (error) {
      throw error
    }
  }

  const processCashPayment = async (paymentId: string, token?: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/payments/${paymentId}/process`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            providerTxId: `cash_${Date.now()}`,
            providerMetadata: { method: 'cash' }
          })
        }
      )

      if (response.ok) {
        const processedPayment = await response.json()
        setPaymentStatus('completed')
        onPaymentComplete?.(processedPayment.data)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao processar pagamento')
      }
    } catch (error) {
      throw error
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'WALLET': return <Wallet size={24} />
      case 'CASH': return <DollarSign size={24} />
      case 'CREDIT_CARD': return <CreditCard size={24} />
      case 'MOBILE_MONEY': return <Smartphone size={24} />
      default: return <CreditCard size={24} />
    }
  }

  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'WALLET': return 'Carteira Digital'
      case 'CASH': return 'Dinheiro'
      case 'CREDIT_CARD': return 'Cartão de Crédito'
      case 'MOBILE_MONEY': return 'Dinheiro Móvel'
      default: return method
    }
  }

  const getPaymentMethodDescription = (method: string) => {
    switch (method) {
      case 'WALLET': return 'Use seu saldo disponível na carteira'
      case 'CASH': return 'Pague diretamente ao motorista'
      case 'CREDIT_CARD': return 'Pague com cartão de crédito ou débito'
      case 'MOBILE_MONEY': return 'Use serviços de dinheiro móvel'
      default: return ''
    }
  }

  if (paymentStatus === 'completed') {
    return (
      <div className="payment-success">
        <CheckCircle size={64} color="#4CAF50" />
        <h3>Pagamento Concluído!</h3>
        <p>{formatCurrency(amountCents)}</p>
        <div className="payment-success-details">
          <p>Método: {getPaymentMethodName(selectedMethod)}</p>
          <p>Referência: {tripId}</p>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="payment-error">
        <AlertCircle size={64} color="#f44336" />
        <h3>Pagamento Falhou</h3>
        <p>Ocorreu um erro ao processar seu pagamento.</p>
        <button 
          className="payment-retry-btn"
          onClick={() => {
            setPaymentStatus('idle')
            setShowPaymentForm(false)
          }}
        >
          Tentar Novamente
        </button>
      </div>
    )
  }

  if (showPaymentForm) {
    return (
      <div className="payment-form-container">
        <h3>Pagar com {getPaymentMethodName(selectedMethod)}</h3>
        <div className="payment-amount">{formatCurrency(amountCents)}</div>
        
        {selectedMethod === 'CREDIT_CARD' && (
          <CreditCardForm 
            onSubmit={(cardData) => {
              // Integrar com gateway de pagamento
              console.log('Cartão:', cardData)
            }}
            onCancel={() => setShowPaymentForm(false)}
          />
        )}
        
        {selectedMethod === 'MOBILE_MONEY' && (
          <MobileMoneyForm 
            onSubmit={(mobileData) => {
              // Integrar com serviço de dinheiro móvel
              console.log('Dinheiro móvel:', mobileData)
            }}
            onCancel={() => setShowPaymentForm(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="payment-container">
      <div className="payment-header">
        <h3>Forma de Pagamento</h3>
        <div className="payment-amount">{formatCurrency(amountCents)}</div>
      </div>

      <div className="payment-methods">
        {(['WALLET', 'CASH', 'CREDIT_CARD', 'MOBILE_MONEY'] as const).map(method => (
          <button
            key={method}
            className={`payment-method ${selectedMethod === method ? 'selected' : ''}`}
            onClick={() => setSelectedMethod(method)}
            disabled={isProcessing}
          >
            <div className="payment-method-icon">
              {getPaymentMethodIcon(method)}
            </div>
            <div className="payment-method-info">
              <div className="payment-method-name">
                {getPaymentMethodName(method)}
              </div>
              <div className="payment-method-description">
                {getPaymentMethodDescription(method)}
              </div>
              {method === 'WALLET' && (
                <div className="wallet-balance">
                  Saldo: {formatCurrency(walletBalance)}
                  {walletBalance < amountCents && (
                    <span className="insufficient-funds">Saldo insuficiente</span>
                  )}
                </div>
              )}
            </div>
            <div className="payment-method-radio">
              <input
                type="radio"
                name="payment-method"
                checked={selectedMethod === method}
                onChange={() => setSelectedMethod(method)}
                disabled={isProcessing}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="payment-fee-info">
        <div className="fee-item">
          <span>Subtotal:</span>
          <span>{formatCurrency(amountCents)}</span>
        </div>
        <div className="fee-item">
          <span>Taxa da plataforma (10%):</span>
          <span>{formatCurrency(Math.floor(amountCents * 0.1))}</span>
        </div>
        <div className="fee-item">
          <span>Taxa do motorista (5%):</span>
          <span>{formatCurrency(Math.floor(amountCents * 0.05))}</span>
        </div>
        <div className="fee-item total">
          <span>Total:</span>
          <span>{formatCurrency(amountCents)}</span>
        </div>
      </div>

      <button
        className="payment-submit-btn"
        onClick={handlePayment}
        disabled={isProcessing || (selectedMethod === 'WALLET' && walletBalance < amountCents)}
      >
        {isProcessing ? (
          <>
            <Clock size={18} className="spinning" />
            Processando...
          </>
        ) : (
          `Pagar ${formatCurrency(amountCents)}`
        )}
      </button>
    </div>
  )
}

// Componente para formulário de cartão
function CreditCardForm({ onSubmit, onCancel }: {
  onSubmit: (data: any) => void
  onCancel: () => void
}) {
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(cardData)
  }

  return (
    <form onSubmit={handleSubmit} className="credit-card-form">
      <div className="form-group">
        <label>Número do Cartão</label>
        <input
          type="text"
          placeholder="0000 0000 0000 0000"
          value={cardData.number}
          onChange={(e) => setCardData({...cardData, number: e.target.value})}
          maxLength={19}
        />
      </div>
      
      <div className="form-group">
        <label>Nome no Cartão</label>
        <input
          type="text"
          placeholder="NOME COMO ESTÁ NO CARTÃO"
          value={cardData.name}
          onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})}
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Validade</label>
          <input
            type="text"
            placeholder="MM/AA"
            value={cardData.expiry}
            onChange={(e) => setCardData({...cardData, expiry: e.target.value})}
            maxLength={5}
          />
        </div>
        
        <div className="form-group">
          <label>CVV</label>
          <input
            type="text"
            placeholder="123"
            value={cardData.cvv}
            onChange={(e) => setCardData({...cardData, cvv: e.target.value})}
            maxLength={3}
          />
        </div>
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="cancel-btn">
          Cancelar
        </button>
        <button type="submit" className="submit-btn">
          Pagar Agora
        </button>
      </div>
    </form>
  )
}

// Componente para formulário de dinheiro móvel
function MobileMoneyForm({ onSubmit, onCancel }: {
  onSubmit: (data: any) => void
  onCancel: () => void
}) {
  const [mobileData, setMobileData] = useState({
    provider: '',
    phone: '',
    pin: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(mobileData)
  }

  return (
    <form onSubmit={handleSubmit} className="mobile-money-form">
      <div className="form-group">
        <label>Operadora</label>
        <select
          value={mobileData.provider}
          onChange={(e) => setMobileData({...mobileData, provider: e.target.value})}
        >
          <option value="">Selecione a operadora</option>
          <option value="UNITEL">Unitel</option>
          <option value="Movicel">Movicel</option>
          <option value="Africell">Africell</option>
        </select>
      </div>
      
      <div className="form-group">
        <label>Número de Telefone</label>
        <input
          type="tel"
          placeholder="+244 900 000 000"
          value={mobileData.phone}
          onChange={(e) => setMobileData({...mobileData, phone: e.target.value})}
        />
      </div>
      
      <div className="form-group">
        <label>PIN</label>
        <input
          type="password"
          placeholder="****"
          value={mobileData.pin}
          onChange={(e) => setMobileData({...mobileData, pin: e.target.value})}
          maxLength={4}
        />
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="cancel-btn">
          Cancelar
        </button>
        <button type="submit" className="submit-btn">
          Pagar Agora
        </button>
      </div>
    </form>
  )
}
