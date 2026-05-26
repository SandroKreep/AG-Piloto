import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomeView.css'
import TripMap from './TripMap'
import TripRequestForm from './TripRequestForm'
import type { Coordinates } from '../services/osrm'
import { fetchOsrmRoute } from '../services/osrm'

type ServiceItem = {
  title: string
  desc: string
  tone: 'peach' | 'mint' | 'yellow' | 'pink' | 'blue' | 'purple' | 'orange'
  icon: 'moto' | 'box' | 'cup' | 'cross' | 'bag' | 'doc' | 'truck'
}

const mainServices: ServiceItem[] = [
  { title: 'Moto-Táxi', desc: 'Chega ao destino sem trânsito', tone: 'peach', icon: 'moto' },
  { title: 'Encomenda', desc: 'Envia documentos e pacotes por hora', tone: 'mint', icon: 'box' },
]

const moreServices: ServiceItem[] = [
  { title: 'Comida', desc: 'Restaurantes e comida para levar', tone: 'yellow', icon: 'cup' },
  { title: 'Farmácia', desc: 'Medicamentos urgentes 24 horas por dia', tone: 'pink', icon: 'cross' },
  { title: 'Frete', desc: 'Transporte de materiais com Kupapata', tone: 'orange', icon: 'truck' },
  { title: 'Documentos', desc: 'Levantar e entregar com segurança', tone: 'purple', icon: 'doc' },
]

function ServiceIcon({ item }: { item: ServiceItem }) {
  const body = (() => {
    switch (item.icon) {
      case 'moto':
        return (
          <path
            d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )
      case 'box':
        return (
          <path
            d="M12 3l8 5v8l-8 5-8-5V8l8-5z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            fill="none"
          />
        )
      case 'cup':
        return (
          <path
            d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )
      case 'cross':
        return (
          <>
            <path d="M12 8v8M9 11h6" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="6" y="5" width="12" height="14" rx="2" stroke="#16a34a" strokeWidth="2" fill="none" />
          </>
        )
      case 'bag':
        return (
          <path
            d="M9 11V8a3 3 0 016 0v3M7 11h10l1 9H6l1-9z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )
      case 'doc':
        return (
          <path
            d="M9 4h6l3 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V6a2 2 0 012-2zM9 10h6M9 14h4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        )
      case 'truck':
        return (
          <>
            <rect x="2" y="8" width="13" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M15 12h4l2-4v8h-6v-4z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </>
        )
    }
  })()

  return (
    <span className={`svc-icon svc-icon--${item.tone}`} aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {body}
      </svg>
    </span>
  )
}

function ServiceCard({ item, onClick }: { item: ServiceItem; onClick?: () => void }) {
  return (
    <article className="svc-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <ServiceIcon item={item} />
      <h3 className="svc-card__title">{item.title}</h3>
      <p className="svc-card__desc">{item.desc}</p>
    </article>
  )
}

type Props = {
  onGoDriver: () => void
}

export default function HomeView({ onGoDriver }: Props) {
  const navigate = useNavigate()
  const [destinationCoords, setDestinationCoords] = useState<Coordinates | null>(() => {
    const saved = sessionStorage.getItem('ag_destination_coords')
    return saved ? JSON.parse(saved) : null
  })
  const [destinationAddress, setDestinationAddress] = useState<string | null>(() => {
    return sessionStorage.getItem('ag_destination_address') || null
  })
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(() => {
    const saved = sessionStorage.getItem('ag_origin_coords')
    return saved ? JSON.parse(saved) : null
  })
  const [route, setRoute] = useState<Array<[number, number]>>([])
  const [stats, setStats] = useState<{ distanceKm: number; durationMin: number } | null>(null)
  const [resetMap, setResetMap] = useState(false)
  const [userChoseOrigin, setUserChoseOrigin] = useState(false)
  const [gpsCoords, setGpsCoords] = useState<Coordinates | null>(null)

  useEffect(() => {
    if (originCoords && destinationCoords) {
      const getRoute = async () => {
        try {
          const routeData = await fetchOsrmRoute(originCoords, destinationCoords)
          setRoute(routeData.geometry)
          setStats({ distanceKm: routeData.distanceMeters / 1000, durationMin: routeData.durationSeconds / 60 })
        } catch (error) {
          console.error('Error fetching route:', error)
          setRoute([])
          setStats(null)
        }
      }
      getRoute()
    } else {
      setRoute([])
      setStats(null)
    }
  }, [originCoords, destinationCoords])

  useEffect(() => {
    if (originCoords) sessionStorage.setItem('ag_origin_coords', JSON.stringify(originCoords))
    else sessionStorage.removeItem('ag_origin_coords')
  }, [originCoords])

  useEffect(() => {
    if (destinationCoords) sessionStorage.setItem('ag_destination_coords', JSON.stringify(destinationCoords))
    else sessionStorage.removeItem('ag_destination_coords')
  }, [destinationCoords])

  useEffect(() => {
    if (destinationAddress) sessionStorage.setItem('ag_destination_address', destinationAddress)
    else sessionStorage.removeItem('ag_destination_address')
  }, [destinationAddress])

  useEffect(() => {
    if (!userChoseOrigin && gpsCoords) {
      setOriginCoords(gpsCoords)
    }
  }, [gpsCoords, userChoseOrigin])

  return (
    <div className="home">
      <header className="home__top">
        <div className="home__brand-wrap">
          <span className="home__brand">AG-PILOTO</span>
          <h1 className="home__welcome">Bem-vindo</h1>
          <p className="home__tagline">Movimentamos Angola, contigo.</p>
          <TripRequestForm
            destinationCoords={destinationCoords}
            setDestinationCoords={setDestinationCoords}
            destinationAddress={destinationAddress}
            setDestinationAddress={setDestinationAddress}
            originCoords={originCoords}
            setOriginCoords={setOriginCoords}
            onReset={() => {
              setResetMap(true)
              setTimeout(() => setResetMap(false), 100)
              setUserChoseOrigin(false)
            }}
            onOriginManuallyChosen={() => setUserChoseOrigin(true)}
          />
        </div>
        <button type="button" className="home__avatar" aria-label="Perfil">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="9" r="3.5" stroke="#6b7280" strokeWidth="1.75" />
            <path
              d="M6 20v-1.5a4 4 0 014-4h4a4 4 0 014 4V20"
              stroke="#6b7280"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <section className="home__section" aria-labelledby="mapa-rota">
        <h2 id="mapa-rota" className="home__section-title">
          Rota em tempo real (OSM + OSRM)
        </h2>
        <TripMap
          destinationCoords={destinationCoords}
          setDestinationCoords={setDestinationCoords}
          destinationAddress={destinationAddress}
          setDestinationAddress={setDestinationAddress}
          originCoords={originCoords}
          setOriginCoords={setOriginCoords}
          route={route}
          stats={stats}
          resetMap={resetMap}
          userChoseOrigin={userChoseOrigin}
          onGpsCoordsChange={setGpsCoords}
        />
      </section>

      <section className="home__section" aria-labelledby="main-services">
        <h2 id="main-services" className="home__section-title">
          Serviços principais
        </h2>
        <div className="home__grid home__grid--2">
          {mainServices.map((item) => (
            <ServiceCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section className="home__section" aria-labelledby="more-services">
        <h2 id="more-services" className="home__section-title home__section-title--plain">
          Mais,
        </h2>
        <div className="home__grid home__grid--2 home__grid--more">
          {moreServices.map((item) => (
            <ServiceCard
              key={item.title}
              item={item}
              onClick={item.title === 'Farmácia' ? () => navigate('/farmacia') : item.title === 'Frete' ? () => navigate('/frete') : item.title === 'Documentos' ? () => navigate('/documentos') : undefined}
            />
          ))}
        </div>
      </section>

      <article className="recruit-card">
        <div className="recruit-card__body">
          <span className="recruit-card__badge">NOVO</span>
          <h2 className="recruit-card__title">Tornar-se motoqueiro AG-PILOTO</h2>
          <p className="recruit-card__text">
            Trabalha quando quiser. Recebe directamente na tua conta. Cumprimos com os requisitos legais angolanos para
            a tua segurança.
          </p>
        </div>
        <button type="button" className="recruit-card__cta" onClick={onGoDriver}>
          <span>Quero.</span>
          <span className="recruit-card__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </article>
    </div>
  )
}
