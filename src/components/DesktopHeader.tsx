import type { TabId } from '../App'
import { useToast } from './Toast'
import { useAuthStore } from '../store/authStore'
import './DesktopHeader.css'

const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: 'home', label: 'Início' },
  { id: 'driver', label: 'Motoqueiro' },
  { id: 'profile', label: 'Perfil' },
]

type Props = {
  active: TabId
  onChange: (id: TabId) => void
}

export default function DesktopHeader({ active, onChange }: Props) {
  const { addToast } = useToast()
  const { user, logout } = useAuthStore()
  
  const handleTabClick = (t: typeof tabs[0]) => {
    if (t.disabled) {
      addToast('Esta funcionalidade estará disponível em breve.', 'info')
      return
    }
    onChange(t.id)
  }

  const handleLogout = async () => {
    await logout()
    addToast('Sessão terminada', 'info')
  }
  
  return (
    <header className="desktop-header">
      <div className="desktop-header__inner">
        <button type="button" className="desktop-header__logo" onClick={() => onChange('home')}>
          AG-PILOTO
        </button>
        <nav className="desktop-header__nav" aria-label="Navegação">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`desktop-header__link ${active === t.id ? 'desktop-header__link--active' : ''}`}
              onClick={() => handleTabClick(t)}
              aria-current={active === t.id ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {user ? (
          <div className="desktop-header__user-info">
            <span className="desktop-header__user-name">{user.full_name || user.email}</span>
            <button
              type="button"
              className="desktop-header__logout"
              onClick={handleLogout}
              aria-label="Sair"
            >
              Sair
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="desktop-header__profile"
            onClick={() => {
              const { setShowAuthModal } = useAuthStore.getState()
              setShowAuthModal(true)
            }}
            aria-label="Perfil"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="M6 20v-1.5a4 4 0 014-4h4a4 4 0 014 4V20"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
