import { Plus } from 'lucide-react'
import { useState } from 'react'
import { goalPlan } from '../goals'
import { useInvestStored } from '../investStore'
import { brl, formatDate } from '../lib'
import type { Goal } from '../types'
import { GoalForm } from './GoalForm'
import { Modal } from './Modal'

interface Props {
  goals: Goal[]
  onAdd: (g: { name: string; target: number; color: string; deadline?: string }) => void
  onDeposit: (id: string, amount: number) => void
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#262626" strokeWidth="4" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} transform="rotate(-90 20 20)" />
    </svg>
  )
}

export function GoalsCard({ goals, onAdd, onDeposit }: Props) {
  const [saved] = useInvestStored()
  const [modal, setModal] = useState<'new' | string | null>(null)
  const [value, setValue] = useState('')
  const num = Number(value.replace(',', '.'))

  const close = () => {
    setModal(null)
    setValue('')
  }
  const target = goals.find((g) => g.id === modal)

  return (
    <div className="card">
      <div className="card-head">
        <h3>Metas de economia</h3>
        <button className="icon-btn" onClick={() => setModal('new')} aria-label="Nova meta"><Plus size={16} /></button>
      </div>
      <ul className="list">
        {goals.map((g) => {
          const pct = (g.saved / g.target) * 100
          const plan = goalPlan(g, undefined, saved.rates, saved.params)
          return (
            <li key={g.id}>
              <Ring pct={pct} color={g.color} />
              <div className="grow">
                <strong>{g.name}</strong>
                <span className="muted small">{brl(g.saved)} de {brl(g.target)}</span>
                {g.deadline && plan.status !== 'done' && (
                  <span className="muted small">
                    até {formatDate(g.deadline)}{plan.perMonth ? ` · ${brl(plan.perMonth)}/mês` : plan.status === 'overdue' ? ' · prazo vencido' : ''}
                  </span>
                )}
              </div>
              <button className="pill-btn" onClick={() => setModal(g.id)}>+ Guardar</button>
            </li>
          )
        })}
        {goals.length === 0 && <li className="muted">Crie sua primeira meta.</li>}
      </ul>

      {modal === 'new' && (
        <Modal title="Nova meta" onClose={close}>
          <GoalForm onSave={(g) => { onAdd(g); close() }} />
        </Modal>
      )}
      {target && (
        <Modal title={`Guardar para ${target.name}`} onClose={close}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (num > 0) { onDeposit(target.id, num); close() } }}>
            <label>Valor (R$)<input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus /></label>
            <button className="btn primary" disabled={!(num > 0)}>Guardar</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
