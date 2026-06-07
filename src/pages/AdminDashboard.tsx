import { useEffect, useState } from 'react'
import MapDashboard from '../components/MapDashboard'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
    if (link) link.href = '/manifest-admin.webmanifest'
    
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

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setShowInstallBtn(false)
  }
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <span className="admin-page__badge">AG-PILOTO</span>
        <h1>Painel de Administração</h1>
        {showInstallBtn && (
          <button onClick={handleInstall} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'transparent', border: '1px solid #1a1a2e',
            color: '#1a1a2e', borderRadius: '8px', padding: '7px 14px',
            fontSize: '13px', cursor: 'pointer'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 16l-6-6h4V4h4v6h4l-6 6z" fill="currentColor"/>
              <path d="M4 20h16v-2H4v2z" fill="currentColor"/>
            </svg>
            Instalar
          </button>
        )}
        <p>Base de Controle para monitoramento operacional, financeiro e intervenções em tempo real.</p>
        <a href="/admin/comida" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '12px',
          background: '#ff6b00',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '0.85rem',
          textDecoration: 'none'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/>
            <path d="M7 2v20"/>
            <path d="M21 15V2a5 5 0 00-5 5v6h3v7"/>
          </svg>
          Gerir Comida
        </a>
        <a href="/admin/farmacia" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '12px',
          marginLeft: '8px',
          background: '#16a34a',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '0.85rem',
          textDecoration: 'none'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 8v8M9 11h6"/>
            <rect x="6" y="5" width="12" height="14" rx="2"/>
          </svg>
          Gerir Farmácia
        </a>
      </header>

      <MapDashboard />
    </div>
  )
}
