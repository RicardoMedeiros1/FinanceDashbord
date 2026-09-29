import { Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES } from '../categories'
import { brl, formatDate, monthKey, monthLong, sumBy } from '../lib'
import type { Transaction } from '../types'

type Filter = 'all' | 'income' | 'expense'

export function Transactions({ txs, onDelete }: { txs: Transaction[]; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [month, setMonth] = useState(monthKey(new Date()))

  const months = useMemo(() => {
    const set = new Set(txs.map((t) => t.date.slice(0, 7)))
    set.add(monthKey(new Date()))
    return [...set].sort().reverse()
  }, [txs])

  const rows = useMemo(
    () =>
      txs
        .filter((t) => t.date.startsWith(month))
        .filter((t) => filter === 'all' || t.type === filter)
        .filter((t) => `${t.description} ${CATEGORIES[t.category].label}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [txs, month, filter, query],
  )

  return (
    <div className="card">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar transação…" />
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>{monthLong(m)}</option>
          ))}
        </select>
        <div className="segmented">
          {(['all', 'income', 'expense'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todas' : f === 'income' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
      </div>

      <div className="summary">
        <span className="muted">{rows.length} transações</span>
        <span className="pos">+ {brl(sumBy(rows, 'income'))}</span>
        <span>− {brl(sumBy(rows, 'expense'))}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Descrição</th><th>Categoria</th><th>Data</th><th className="right">Valor</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.description}</td>
                <td>
                  <span className="tag" style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}>{CATEGORIES[t.category].label}</span>
                </td>
                <td className="muted">{formatDate(t.date)}</td>
                <td className={`right ${t.type === 'income' ? 'pos' : ''}`}>{t.type === 'income' ? '+' : '−'} {brl(t.amount)}</td>
                <td className="right">
                  <button className="icon-btn" onClick={() => onDelete(t.id)} aria-label="Excluir"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="empty">Nada por aqui.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
