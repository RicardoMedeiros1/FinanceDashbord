import { Pencil } from 'lucide-react'
import { Bar, ComposedChart, LabelList, Line, ResponsiveContainer, XAxis } from 'recharts'
import { HealthGauge } from '../components/HealthGauge'
import { useMemo, useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES } from '../categories'
import { financialHealth, spendByCategory } from '../insights'
import { brl, inMonth, monthKey } from '../lib'
import type { Budget, CategoryId, Subscription, Transaction } from '../types'

export function Budgets({ txs, subs, budgets, onChange }: { txs: Transaction[]; subs: Subscription[]; budgets: Budget[]; onChange: (category: CategoryId, limit: number) => void }) {
  const spent = useMemo(() => spendByCategory(txs.filter((t) => inMonth(t, monthKey(new Date())))), [txs])
  const [editing, setEditing] = useState<CategoryId | null>(null)
  const [draft, setDraft] = useState('')

  const commit = (cat: CategoryId) => {
    const v = Number(draft.replace(',', '.'))
    if (v >= 0 && draft.trim() !== '') onChange(cat, v)
    setEditing(null)
  }

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0)
  const totalSpent = budgets.reduce((s, b) => s + (spent.get(b.category) ?? 0), 0)

  const health = useMemo(() => financialHealth(txs, subs, budgets), [txs, subs, budgets])
  const chartData = [
    { name: 'Gasto', value: totalSpent },
    { name: 'Orçamento', value: totalLimit },
    { name: 'Restante', value: Math.max(totalLimit - totalSpent, 0) },
  ]

  return (
    <>
      <div className="grid duo">
        <div className="card">
          <div className="card-head">
            <h3>Visão do orçamento</h3>
            <span className="muted small">mês atual</span>
          </div>
          <div className="chart-fill short">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart accessibilityLayer={false} data={chartData} margin={{ top: 24, left: 8, right: 8 }}>
                <XAxis dataKey="name" stroke="#6b6b6b" tickLine={false} axisLine={false} fontSize={12} />
                <Bar dataKey="value" fill="#e84a45" radius={[10, 10, 0, 0]} maxBarSize={90}>
                  <LabelList dataKey="value" position="top" fill="#e9e9e9" fontSize={12} formatter={(v) => brl(Number(v))} />
                </Bar>
                <Line dataKey="value" type="monotone" stroke="#fff" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <HealthGauge health={health} />
      </div>

      <div className="grid budgets">
        {EXPENSE_CATEGORIES.map((cat) => {
          const budget = budgets.find((b) => b.category === cat)
          const s = spent.get(cat) ?? 0
          const pct = budget && budget.limit > 0 ? (s / budget.limit) * 100 : 0
          const state = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''
          return (
            <div className="card budget" key={cat}>
              <div className="card-head">
                <h3><span className="dot lg" style={{ background: CATEGORIES[cat].color }} /> {CATEGORIES[cat].label}</h3>
                {editing === cat ? (
                  <input
                    className="inline"
                    autoFocus
                    value={draft}
                    inputMode="decimal"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(cat)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commit(cat); if (e.key === 'Escape') setEditing(null) }}
                  />
                ) : (
                  <button className="link" onClick={() => { setEditing(cat); setDraft(String(budget?.limit ?? '')) }}>
                    <Pencil size={13} /> {budget ? 'Editar' : 'Definir limite'}
                  </button>
                )}
              </div>
              <div className="budget-nums">
                <strong>{brl(s)}</strong>
                <span className="muted">{budget ? `de ${brl(budget.limit)}` : 'sem limite'}</span>
              </div>
              {budget && (
                <>
                  <div className={`bar ${state}`}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  <span className={`small ${state ? 'bad-text' : 'muted'}`}>
                    {pct >= 100 ? `Estourou em ${brl(s - budget.limit)}` : `Restam ${brl(budget.limit - s)}`}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
