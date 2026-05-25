import { Suspense, lazy, useState, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import DesktopHeader from './components/DesktopHeader'
import BottomNav from './components/BottomNav'
import HomeView from './components/HomeView'
import TabPlaceholder from './components/TabPlaceholder'
import TripDetailsPage from './pages/TripDetailsPage'
import TripHistoryWrapper from './components/TripHistoryWrapper'
import DriverApplicationForm from './components/DriverApplicationForm'
import CandidaturaPage from './pages/motoqueiro/candidatura/page'
import AuthModal from './components/AuthModal'
import Profile from './components/Profile'
import AdminDashboard from './pages/AdminDashboard'
import AdminFarmacia from './pages/AdminFarmacia'
import Farmacia from './pages/Farmacia'
import Frete from './pages/Frete'
import Documentos from './pages/Documentos'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'

const MotoqueiroView = lazy(() => import('./components/MotoqueiroView'))

export type TabId = 'home' | 'orders' | 'driver' | 'profile'

function MainApp() {
  const [tab, setTab] = useState<TabId>('home')
  const { checkSession } = useAuthStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return (
    <div className="app-root">
      <DesktopHeader active={tab} onChange={setTab} />
      <div className="app-shell">
        <main className="app-main">
          {tab === 'home' && <HomeView onGoDriver={() => setTab('driver')} />}
          {tab === 'orders' && <TripHistoryWrapper />}
          {tab === 'driver' && (
            <Suspense fallback={<TabPlaceholder title="A carregar painel..." subtitle="A preparar a área de operação." />}>
              <MotoqueiroView />
            </Suspense>
          )}
          {tab === 'profile' && <Profile />}
        </main>
        <BottomNav active={tab} onChange={setTab} />
      </div>
      <AuthModal />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route
        path="/admin"
        element={<AdminDashboard />}
      />
      <Route
        path="/admin/farmacia"
        element={<AdminFarmacia />}
      />
      <Route
        path="/farmacia"
        element={<Farmacia />}
      />
      <Route
        path="/frete"
        element={<Frete />}
      />
      <Route
        path="/documentos"
        element={<Documentos />}
      />
      <Route
        path="/trips/:tripId"
        element={<TripDetailsPage />}
      />
      <Route
        path="/driver-application"
        element={<DriverApplicationForm />}
      />
      <Route
        path="/motoqueiro/candidatura"
        element={<CandidaturaPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
