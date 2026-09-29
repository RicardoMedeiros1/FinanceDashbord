import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react'
import type { Insight } from '../insights'

const ICON = { good: CheckCircle2, warn: AlertTriangle, info: Info }

export function Insights({ items }: { items: Insight[] }) {
  return (
    <div className="card insights">
      <div className="card-head">
        <h3>
          <Sparkles size={16} /> Insights
        </h3>
        <span className="chip">{items.length}</span>
      </div>
      {items.length === 0 && <p className="muted">Sem novidades por enquanto.</p>}
      <ul>
        {items.map((i) => {
          const Icon = ICON[i.tone]
          return (
            <li key={i.id} className={i.tone}>
              <Icon size={18} />
              <div>
                <strong>{i.title}</strong>
                <p>{i.text}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
