import { Check, X } from 'lucide-react'

export interface OnboardingStep {
  id: string
  label: string
  done: boolean
  optional?: boolean
  action: string
  run: () => void
}

/** Passo a passo de boas-vindas: aparece enquanto a conta está vazia e some quando concluído ou dispensado. */
export function Onboarding({ steps, onDismiss }: { steps: OnboardingStep[]; onDismiss: () => void }) {
  const required = steps.filter((s) => !s.optional)
  const doneCount = required.filter((s) => s.done).length
  const pct = (doneCount / required.length) * 100
  return (
    <section className="card onboarding" aria-label="Primeiros passos">
      <div className="card-head">
        <div>
          <h3>Bem-vindo! Vamos configurar o seu Finn</h3>
          <span className="muted small">{doneCount} de {required.length} passos concluídos</span>
        </div>
        <button className="icon-btn" onClick={onDismiss} aria-label="Dispensar primeiros passos" title="Dispensar"><X size={16} /></button>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount} aria-label="Progresso dos primeiros passos"><span style={{ width: `${pct}%` }} /></div>
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'done' : ''}>
            <span className="step-check" aria-hidden>{s.done ? <Check size={13} /> : null}</span>
            <span className="grow">{s.label}{s.optional ? <span className="muted small"> (opcional)</span> : null}</span>
            {!s.done && <button className="pill-btn" onClick={s.run}>{s.action}</button>}
          </li>
        ))}
      </ol>
    </section>
  )
}
