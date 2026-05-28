import { memo, useMemo, useState } from 'react'

export type TripRow = {
  id: string
  status: string
  serviceType: 'taxi' | 'familiar' | 'frete' | 'farmacia' | 'documentos'
  driverName: string
  customerName: string
  valueCents: number
  origin_lat?: number
  origin_lng?: number
  destination_lat?: number
  destination_lng?: number
}

type Props = {
  trips: TripRow[]
  onForceCancel: (tripId: string) => Promise<void>
  onReassign: (tripId: string) => Promise<void>
  page: number
  setPage: (page: number) => void
  total: number
  pageSize: number
}

function getServiceIcon(serviceType: TripRow['serviceType']): JSX.Element {
  switch (serviceType) {
    case 'taxi':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M5 17h-2v-5l2.5-3h3l2 3h5v5M9 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      )
    case 'familiar':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'frete':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <rect x="2" y="8" width="13" height="8" rx="1" />
          <path d="M15 12h4l2-4v8h-6v-4z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      )
    case 'farmacia':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M12 8v8M9 11h6" />
          <rect x="6" y="5" width="12" height="14" rx="2" />
        </svg>
      )
    case 'documentos':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M9 4h6l3 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V6a2 2 0 012-2zM9 10h6M9 14h4" />
        </svg>
      )
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
          <path d="M12 3l8 5v8l-8 5-8-5V8l8-5z" />
        </svg>
      )
  }
}

function TripTable({ trips, onForceCancel, onReassign, page, setPage, total, pageSize }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [serviceFilter, setServiceFilter] = useState<'all' | TripRow['serviceType']>('all')

  const filtered = useMemo(() => {
    return trips.filter((trip) => {
      const statusOk = statusFilter === 'all' || trip.status === statusFilter
      const serviceOk = serviceFilter === 'all' || trip.serviceType === serviceFilter
      return statusOk && serviceOk
    })
  }, [serviceFilter, statusFilter, trips])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="trip-table">
      <div className="trip-table__header">
        <h3>Torre de Controle</h3>
        <div className="trip-table__filters">
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
            <option value="all">Status: todos</option>
            <option value="REQUESTED">solicitada</option>
            <option value="IN_PROGRESS">em_curso</option>
            <option value="ASSIGNED">atribuída</option>
            <option value="COMPLETED">concluída</option>
          </select>
          <select value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value as 'all' | TripRow['serviceType']); setPage(1) }}>
            <option value="all">Serviço: todos</option>
            <option value="taxi">Táxi</option>
            <option value="familiar">Familiar</option>
            <option value="frete">Frete</option>
            <option value="farmacia">Farmácia</option>
            <option value="documentos">Documentos</option>
          </select>
        </div>
      </div>

      <div className="trip-table__wrapper">
        <table>
          <thead>
            <tr>
              <th>ID da Corrida</th>
              <th>Status</th>
              <th>Serviço</th>
              <th>Motorista</th>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((trip) => (
              <tr key={trip.id}>
                <td>{trip.id.slice(0, 8)}</td>
                <td>{trip.status}</td>
                <td>{getServiceIcon(trip.serviceType)} {trip.serviceType}</td>
                <td>{trip.driverName}</td>
                <td>{trip.customerName}</td>
                <td>{(trip.valueCents / 100).toLocaleString('pt-AO')} Kz</td>
                <td className="trip-table__actions">
                  <button type="button" onClick={() => void onForceCancel(trip.id)}>Forçar Cancelamento</button>
                  <button type="button" onClick={() => void onReassign(trip.id)}>Reatribuir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="trip-table__pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Próxima
        </button>
      </div>
    </section>
  )
}

export default memo(TripTable)
