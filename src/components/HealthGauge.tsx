import type { Health } from '../insights'

/** Medidor semicircular de 0 a 100. */
export function HealthGauge({ health }: { health: Health }) {
  const r = 78
  const half = Math.PI * r
  const angle = Math.PI * (1 - health.score / 100)
  const nx = 100 + r * Math.cos(angle)
  const ny = 100 - r * Math.sin(angle)
  return (
    <div className="card health">
      <div className="card-head">
        <h3>Saúde financeira</h3>
      </div>
      <div className="gauge">
        <svg viewBox="0 0 200 118" role="img" aria-label={`Nota ${health.score} de 100`}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" x2="1">
              <stop offset="0" stopColor="#e84a45" />
              <stop offset="1" stopColor="#e0800f" />
            </linearGradient>
          </defs>
          <path d="M 22 100 A 78 78 0 0 1 178 100" fill="none" stroke="#262626" strokeWidth="14" strokeLinecap="round" />
          <path d="M 22 100 A 78 78 0 0 1 178 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(half * health.score) / 100} ${half}`} />
          <circle cx={nx} cy={ny} r="6" fill="#fff" />
        </svg>
        <div className="gauge-center">
          <strong>{health.score}</strong>
          <span className="muted small">Sua nota · {health.label}</span>
        </div>
      </div>
      <p className="muted small tip">{health.tip}</p>
    </div>
  )
}
