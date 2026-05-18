import './TabPlaceholder.css'

type Props = {
  title: string
  subtitle?: string
}

export default function TabPlaceholder({ title, subtitle }: Props) {
  return (
    <div className="tab-ph">
      <h1 className="tab-ph__title">{title}</h1>
      {subtitle ? <p className="tab-ph__sub">{subtitle}</p> : null}
      <p className="tab-ph__hint">Conteúdo em construção.</p>
    </div>
  )
}
