import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import './AuthModal.css'

type Tab = 'login' | 'register'

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, register } = useAuthStore()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!showAuthModal) return null

  const handleClose = () => {
    setShowAuthModal(false)
    setEmail('')
    setPassword('')
    setName('')
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await login(email, password)
    
    if (!result.success) {
      setError(result.error || 'Erro ao fazer login')
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await register(email, password, name)
    
    if (!result.success) {
      setError(result.error || 'Erro ao criar conta')
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal__close" onClick={handleClose} aria-label="Fechar">
          ✕
        </button>

        <div className="auth-modal__tabs">
          <button
            className={`auth-modal__tab ${tab === 'login' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => {
              setTab('login')
              setError('')
            }}
          >
            Entrar
          </button>
          <button
            className={`auth-modal__tab ${tab === 'register' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => {
              setTab('register')
              setError('')
            }}
          >
            Criar conta
          </button>
        </div>

        {error && (
          <div className="auth-modal__error">
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <form className="auth-modal__form" onSubmit={handleLogin}>
            <div className="auth-modal__field">
              <label htmlFor="login-email" className="auth-modal__label">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                className="auth-modal__input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-modal__field">
              <label htmlFor="login-password" className="auth-modal__label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="auth-modal__input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="auth-modal__button"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form className="auth-modal__form" onSubmit={handleRegister}>
            <div className="auth-modal__field">
              <label htmlFor="register-name" className="auth-modal__label">
                Nome
              </label>
              <input
                id="register-name"
                type="text"
                className="auth-modal__input"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="auth-modal__field">
              <label htmlFor="register-email" className="auth-modal__label">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                className="auth-modal__input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-modal__field">
              <label htmlFor="register-password" className="auth-modal__label">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                className="auth-modal__input"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="auth-modal__button"
              disabled={loading}
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
