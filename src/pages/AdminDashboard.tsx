import MapDashboard from '../components/MapDashboard'
import './AdminDashboard.css'

export default function AdminDashboard() {
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <span className="admin-page__badge">AG-PILOTO</span>
        <h1>Painel de Administração</h1>
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
