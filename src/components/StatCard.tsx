import { Bar, BarChart, Cell, ResponsiveContainer, YAxis } from 'recharts'
import type { ReactNode } from 'react'

interface Props {
  label: string
  icon: ReactNode
  value: ReactNode
  spark: number[]
  color: string
  delta?: number | null
  invert?: boolean
  foot?: string
}

export function StatCard({ label, icon, value, spark, color, delta, invert, foot = 'Mês anterior' }: Props) {
  const good = delta == null ? true : invert ? delta <= 0 : delta >= 0
  const max = Math.max(...spark.map(Math.abs), 1)
  const empty = spark.every((v) => v === 0)
  const data = spark.map((v, i) => ({ v: empty ? 0 : Math.max(Math.abs(v), max * 0.08), i }))
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">
          <span className="stat-icon">{icon}</span>
          {label}
        </span>
        <span className="dots" aria-hidden>···</span>
      </div>
      <div className="stat-mid">
        <div className="stat-value">{value}</div>
        <div className="spark">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer={false} data={data} barCategoryGap={2}>
              <YAxis hide domain={[0, max]} />
              <Bar dataKey="v" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={color} fillOpacity={0.35 + (0.65 * (i + 1)) / data.length} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="stat-foot">
        <span className="muted small">{foot}</span>
        {delta != null && (
          <span className={`pill ${good ? 'good' : 'bad'}`}>
            {delta >= 0 ? '+' : '−'}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}
