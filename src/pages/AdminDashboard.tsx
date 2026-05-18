import MapDashboard from '../components/MapDashboard'
import './AdminDashboard.css'

export default function AdminDashboard() {
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <span className="admin-page__badge">AG-PILOTO</span>
        <h1>Painel de Administração</h1>
        <p>Base de Controle para monitoramento operacional, financeiro e intervenções em tempo real.</p>
      </header>

      <MapDashboard />
    </div>
  )
}
