import { Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES } from '../categories'
import { spendByCategory } from '../insights'
import { brl, inMonth, monthKey } from '../lib'
import type { Budget, CategoryId, Transaction } from '../types'

export function Budgets({ txs, budgets, onChange }: { txs: Transaction[]; budgets: Budget[]; onChange: (category: CategoryId, limit: number) => void }) {
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

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h3>Orçamento do mês</h3>
          <span className="muted">{brl(totalSpent)} de {brl(totalLimit)}</span>
        </div>
        <div className="bar big"><span style={{ width: `${Math.min(100, totalLimit ? (totalSpent / totalLimit) * 100 : 0)}%` }} /></div>
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
