import { memo, useMemo } from 'react'

export type SchoolScheduleRow = {
  id: string
  route: string
  status: 'pendente' | 'aceita' | 'concluida'
  scheduledAt: string
  startedAt?: string | null
  lastProgressAt?: string | null
}

type Props = {
  rows: SchoolScheduleRow[]
}

function minutesDiff(baseIso: string | null | undefined, now: number) {
  if (!baseIso) return Number.POSITIVE_INFINITY
  const ms = new Date(baseIso).getTime()
  if (Number.isNaN(ms)) return Number.POSITIVE_INFINITY
  return (now - ms) / 60000
}

function SchoolSchedulesTab({ rows }: Props) {
  const now = Date.now()
  const computed = useMemo(
    () =>
      rows.map((row) => {
        const lateStart = row.status === 'pendente' && minutesDiff(row.scheduledAt, now) > 10
        const stalled = row.status === 'aceita' && minutesDiff(row.lastProgressAt, now) > 10
        return { ...row, risk: lateStart || stalled }
      }),
    [now, rows],
  )

  return (
    <section className="school-tab">
      <h3>Agendamentos Escolares</h3>
      <div className="school-tab__list">
        {computed.map((row) => (
          <article key={row.id} className={`school-tab__row ${row.risk ? 'school-tab__row--risk' : ''}`}>
            <div>
              <strong>{row.route}</strong>
              <p>Status: {row.status}</p>
            </div>
            <div>
              <p>Hora: {new Date(row.scheduledAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</p>
              {row.risk ? <p className="school-tab__alert">Alerta de risco: atraso/paragem {'>'} 10 min</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default memo(SchoolSchedulesTab)
