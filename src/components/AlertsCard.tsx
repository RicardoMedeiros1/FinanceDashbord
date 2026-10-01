import { BellRing, X } from 'lucide-react'
import type { Alert } from '../alerts'

/** Alertas da Visão geral; cada um pode ser dispensado. */
export function AlertsCard({ items, onDismiss }: { items: Alert[]; onDismiss: (id: string) => void }) {
  if (items.length === 0) return null
  return (
    <section className="card alerts-card" aria-label="Alertas">
      <div className="card-head">
        <h3><BellRing size={15} /> Alertas</h3>
        <span className="pill">{items.length}</span>
      </div>
      <ul className="alerts-list">
        {items.map((a) => (
          <li key={a.id} className={`alert-${a.kind}`}>
            <div className="grow">
              <strong>{a.title}</strong>
              <p>{a.text}</p>
            </div>
            <button className="icon-btn" aria-label={`Dispensar alerta: ${a.title}`} onClick={() => onDismiss(a.id)}><X size={15} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
