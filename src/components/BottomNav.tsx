import type { TabId } from '../App'
import { useToast } from './Toast'
import { useAuthStore } from '../store/authStore'
import './BottomNav.css'

const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: 'home', label: 'Início' },
  { id: 'driver', label: 'Motoqueiro' },
  { id: 'profile', label: 'Perfil' },
]

function IconHome() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconList() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTruck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 17h6l2-4V9h-6v8zM6 17H4a2 2 0 01-2-2v-5h8v9a2 2 0 01-2 2zm10 0h2a2 2 0 002-2v-4M6 17a2 2 0 104 0 2 2 0 00-4 0zm10 0a2 2 0 104 0 2 2 0 00-4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 20v-1.5a4 4 0 014-4h4a4 4 0 014 4V20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TabIcon({ id }: { id: TabId }) {
  switch (id) {
    case 'home':
      return <IconHome />
    case 'orders':
      return <IconList />
    case 'driver':
      return <IconTruck />
    case 'profile':
      return <IconUser />
  }
}

type Props = {
  active: TabId
  onChange: (id: TabId) => void
}

export default function BottomNav({ active, onChange }: Props) {
  const { addToast } = useToast()
  const { user, logout } = useAuthStore()
  
  const handleTabClick = (t: typeof tabs[0]) => {
    if (t.disabled) {
      addToast('Esta funcionalidade estará disponível em breve.', 'info')
      return
    }
    // If clicking profile tab and user is not logged in, open auth modal
    if (t.id === 'profile' && !user) {
      const { setShowAuthModal } = useAuthStore.getState()
      setShowAuthModal(true)
      return
    }
    onChange(t.id)
  }

  const handleLogout = async () => {
    await logout()
    addToast('Sessão terminada', 'info')
  }
  
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {tabs.map((t) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
            onClick={() => handleTabClick(t)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bottom-nav__icon">
              <TabIcon id={t.id} />
            </span>
            <span className="bottom-nav__label">{t.label}</span>
          </button>
        )
      })}
      {user && (
        <button
          type="button"
          className="bottom-nav__item bottom-nav__logout"
          onClick={handleLogout}
          aria-label="Sair"
        >
          <span className="bottom-nav__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 17l5-5-5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="bottom-nav__label">Sair</span>
        </button>
      )}
    </nav>
  )
}