import { memo } from 'react'

type Props = {
  completedToday: number
  totalCommissionCents: number
  payoutAvailableCents: number
}

function FinancialSummary({ completedToday, totalCommissionCents, payoutAvailableCents }: Props) {
  return (
    <aside className="financial-summary">
      <h3>Gestão Financeira</h3>
      <div className="financial-summary__grid">
        <article>
          <p>Corridas concluídas (hoje)</p>
          <strong>{completedToday}</strong>
        </article>
        <article>
          <p>Comissão total AG-PILOTO</p>
          <strong>{(totalCommissionCents / 100).toLocaleString('pt-AO')} Kz</strong>
        </article>
        <article>
          <p>Saldo para repasse</p>
          <strong>{(payoutAvailableCents / 100).toLocaleString('pt-AO')} Kz</strong>
        </article>
      </div>
    </aside>
  )
}

export default memo(FinancialSummary)
