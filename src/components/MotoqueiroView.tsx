import { Link } from 'react-router-dom'
import './MotoqueiroView.css'

export default function MotoqueiroView() {
  return (
    <div className="driver">
      <div className="driver__columns">
        <div className="driver__col driver__col--hero">
          <header className="driver__header">
            <h1 className="driver__title">Sê motoqueiro AG-PILOTO</h1>
            <p className="driver__subtitle">Trabalha por conta própria</p>
          </header>

          <section className="driver__earn" aria-labelledby="earn-label">
            <p id="earn-label" className="driver__earn-label">
              Rendimento médio
            </p>
            <p className="driver__earn-value">180.000 — 350.000 Kz / mês</p>
            <p className="driver__earn-note">Paga directamente para a tua conta bancária todas as semanas.</p>
          </section>

          <Link to="/motoqueiro/candidatura" className="driver__cta">
            <span className="driver__cta-inner">
              <span className="driver__cta-text">
                <span className="driver__cta-main">Iniciar candidatura</span>
                <span className="driver__cta-sub">Demora cerca de 5 minutos</span>
              </span>
              <span className="driver__cta-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12h14m0 0l-6-6m6 6l-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          </Link>
        </div>

        <section className="driver__legal">
          <h2 className="driver__legal-title">Requisitos legais — Lei Angolana</h2>
          <p className="driver__legal-text">
            Para operares em segurança e em conformidade, precisamos de documentação válida segundo a legislação em
            vigor (ARSEG / DNVT). Prepara os teus documentos antes de iniciares.
          </p>

          <article className="driver__doc-card">
            <span className="driver__doc-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="17" r="1.5" fill="currentColor" />
              </svg>
            </span>
            <div>
              <h3 className="driver__doc-title">Bilhete de Identidade (BI)</h3>
              <p className="driver__doc-desc">BI angolano válido, com idade mínima de 18 anos.</p>
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
