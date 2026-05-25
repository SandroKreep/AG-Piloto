import { memo, useMemo, useState } from 'react'

export type TripRow = {
  id: string
  status: string
  serviceType: 'taxi' | 'familiar' | 'frete' | 'farmacia' | 'documentos'
  driverName: string
  customerName: string
  valueCents: number
}

type Props = {
  trips: TripRow[]
  onForceCancel: (tripId: string) => Promise<void>
  onReassign: (tripId: string) => Promise<void>
}

const PAGE_SIZE = 8

function getServiceIcon(serviceType: TripRow['serviceType']): string {
  switch (serviceType) {
    case 'taxi':
      return '🏍️'
    case 'familiar':
      return '👨‍👩‍👧‍👦'
    case 'frete':
      return '🚚'
    case 'farmacia':
      return '💊'
    case 'documentos':
      return '📄'
    default:
      return '📦'
  }
}

function TripTable({ trips, onForceCancel, onReassign }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [serviceFilter, setServiceFilter] = useState<'all' | TripRow['serviceType']>('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return trips.filter((trip) => {
      const statusOk = statusFilter === 'all' || trip.status === statusFilter
      const serviceOk = serviceFilter === 'all' || trip.serviceType === serviceFilter
      return statusOk && serviceOk
    })
  }, [serviceFilter, statusFilter, trips])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

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
            {paged.map((trip) => (
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
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
          Anterior
        </button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
          Próxima
        </button>
      </div>
    </section>
  )
}

export default memo(TripTable)
