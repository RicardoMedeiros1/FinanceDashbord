import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  icon: ReactNode
  /** variação % vs mês anterior */
  delta?: number | null
  /** true quando subir é ruim (ex.: despesas) */
  invert?: boolean
  hint?: string
}

export function StatCard({ label, value, icon, delta, invert, hint }: Props) {
  const good = delta == null ? true : invert ? delta <= 0 : delta >= 0
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="muted">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {delta != null && (
          <span className={`chip ${good ? 'good' : 'bad'}`}>
            {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        <span className="muted small">{hint ?? 'vs. mês anterior'}</span>
      </div>
    </div>
  )
}
