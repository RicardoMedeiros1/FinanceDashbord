import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { goalPlan, type GoalStatus } from '../goals'
import { useInvestStored } from '../investStore'
import { brl, formatDate } from '../lib'
import type { Goal } from '../types'
import { GoalForm } from './GoalForm'
import { Modal } from './Modal'

interface Props {
  goals: Goal[]
  onSave: (g: { name: string; target: number; saved?: number; color: string; deadline?: string }, id?: string) => void
  onDelete: (id: string) => void
  onDeposit: (id: string, amount: number) => void
  onSimulate: (seed: { initial: number; monthly: number; months: number }) => void
}

const STATUS: Record<GoalStatus, { label: string; cls: string }> = {
  done: { label: 'Meta atingida', cls: 'good' },
  overdue: { label: 'Prazo vencido', cls: 'bad' },
  'no-deadline': { label: 'Sem prazo', cls: '' },
  'on-track': { label: 'No ritmo', cls: 'good' },
  behind: { label: 'Atrasada', cls: 'warn' },
}

/** Metas com prazo: quanto guardar por mês (sem render e rendendo), se está no ritmo e atalho para o simulador. */
export function GoalsTab({ goals, onSave, onDelete, onDeposit, onSimulate }: Props) {
  const [saved] = useInvestStored()
  const [form, setForm] = useState<{ item?: Goal } | null>(null)
  const [deposit, setDeposit] = useState<Goal | null>(null)
  const [amount, setAmount] = useState('')
  const value = Number(amount.replace(/\./g, '').replace(',', '.'))

  return (
    <div className="invest-tab">
      <div className="section-head">
        <h3>Suas metas</h3>
        <button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Nova meta</button>
      </div>
      {goals.length === 0 && (
        <div className="card empty-rules muted">
          Crie uma meta com valor e prazo (ex.: R$ 20.000 em 18 meses). O app calcula quanto guardar por mês, sem render e rendendo, e deixa você simular onde colocar o dinheiro.
        </div>
      )}
      <div className="goal-grid">
        {goals.map((g) => {
          const plan = goalPlan(g, undefined, saved.rates, saved.params)
          const pct = Math.min(100, (g.saved / g.target) * 100)
          const st = STATUS[plan.status]
          return (
            <div key={g.id} className="card goal" data-testid={`goal-${g.name}`} style={{ '--c': g.color } as React.CSSProperties}>
              <div className="sub-top">
                <span className="dot lg" style={{ background: g.color }} />
                <div className="grow">
                  <strong>{g.name}</strong>
                  <span className="muted small">{g.deadline ? `até ${formatDate(g.deadline)}${plan.monthsLeft ? ` · ${plan.monthsLeft} ${plan.monthsLeft === 1 ? 'mês' : 'meses'}` : ''}` : 'Sem prazo definido'}</span>
                </div>
                <span className={`tag status-${st.cls}`} style={{ '--c': st.cls === 'good' ? '#3ecf6e' : st.cls === 'bad' ? '#e84a45' : st.cls === 'warn' ? '#e0a30f' : '#8b8b8b' } as React.CSSProperties}>{st.label}</span>
                <button className="icon-btn" onClick={() => setForm({ item: g })} aria-label={`Editar meta ${g.name}`}><Pencil size={15} /></button>
                <button className="icon-btn" onClick={() => { if (confirm(`Excluir a meta “${g.name}”? O valor guardado não é apagado de lugar nenhum; só a meta some do app.`)) onDelete(g.id) }} aria-label={`Excluir meta ${g.name}`}><Trash2 size={15} /></button>
              </div>
              <div className="bar big" role="progressbar" aria-label={`Progresso de ${g.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><span style={{ width: `${pct}%`, background: g.color }} /></div>
              <div className="goal-numbers">
                <span><span className="muted small">Guardado</span><strong>{brl(g.saved)}</strong></span>
                <span><span className="muted small">Meta</span><strong>{brl(g.target)}</strong></span>
                <span><span className="muted small">Falta</span><strong>{brl(plan.missing)}</strong></span>
              </div>
              {plan.status === 'overdue' && <p className="bad-text small">O prazo passou e ainda faltam {brl(plan.missing)}. Edite o prazo ou o valor da meta.</p>}
              {plan.perMonth !== null && plan.perMonth > 0 && (
                <ul className="goal-plan">
                  <li>Guardando sem render: <strong data-testid={`goal-permonth-${g.name}`}>{brl(plan.perMonth)}</strong> por mês.</li>
                  {plan.perMonthInvested !== null && plan.perMonthInvested < plan.perMonth - 0.005 && (
                    <li>Se render como o Tesouro Selic (estimativa, já com imposto): <strong data-testid={`goal-invested-${g.name}`}>{brl(plan.perMonthInvested)}</strong> por mês.</li>
                  )}
                  {plan.status === 'behind' && <li className="warn-text">Você está {brl(plan.behind)} atrás do ritmo esperado até hoje.</li>}
                </ul>
              )}
              <div className="goal-actions">
                {plan.status !== 'done' && <button className="pill-btn" onClick={() => { setDeposit(g); setAmount('') }}>+ Guardar</button>}
                {plan.status !== 'done' && plan.status !== 'no-deadline' && plan.status !== 'overdue' && plan.monthsLeft ? (
                  <button className="pill-btn" onClick={() => onSimulate({ initial: Math.round(g.saved), monthly: Math.ceil(plan.perMonthInvested ?? plan.perMonth ?? 0), months: plan.monthsLeft! })}>Simular onde guardar</button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {form && (
        <Modal title={form.item ? 'Editar meta' : 'Nova meta'} onClose={() => setForm(null)}>
          <GoalForm initial={form.item} onSave={(g) => { onSave(g, form.item?.id); setForm(null) }} />
        </Modal>
      )}
      {deposit && (
        <Modal title={`Guardar para ${deposit.name}`} onClose={() => setDeposit(null)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (value > 0) { onDeposit(deposit.id, value); setDeposit(null) } }}>
            <label>Valor (R$)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus aria-label="Valor a guardar" /></label>
            <button className="btn primary" disabled={!(value > 0)}>Guardar</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
