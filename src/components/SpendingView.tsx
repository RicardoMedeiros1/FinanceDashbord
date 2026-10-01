import { Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES } from '../categories'
import { brl, formatDate, monthLabel } from '../lib'
import { GroupLimit } from './GroupLimit'
import { expensesIn, groupSpent, filterMerchant, parseTerms, PERIOD_LABEL, rankMerchants, searchSpending, summarize, SUGGESTIONS, matchesTerms, type Period } from '../spending'
import type { SpendGroup, Transaction } from '../types'

interface Props {
  txs: Transaction[]
  groups: SpendGroup[]
  onSaveGroup: (name: string, terms: string) => void
  onDeleteGroup: (id: string) => void
  onGroupLimit: (id: string, limit: number | null) => void
}

const PERIODS = Object.keys(PERIOD_LABEL) as Period[]
const TOP = 15

/** Para onde vai o dinheiro: ranking de estabelecimentos, grupos (padaria, mercado livre...) e o detalhe de cada busca. */
export function SpendingView({ txs, groups, onSaveGroup, onDeleteGroup, onGroupLimit }: Props) {
  const [period, setPeriod] = useState<Period>('3m')
  const [q, setQ] = useState('')
  const [merchant, setMerchant] = useState<{ key: string; name: string } | null>(null)
  const [groupName, setGroupName] = useState<string | null>(null) // preenchido enquanto o nome do grupo está sendo digitado
  const [label, setLabel] = useState('') // nome do grupo aberto pelos cartões (a caixa de busca mostra as palavras)
  const [all, setAll] = useState(false)

  const expenses = useMemo(() => expensesIn(txs, period), [txs, period])
  const totalAll = useMemo(() => expenses.reduce((s, t) => s + t.amount, 0), [expenses])
  const monthSpent = useMemo(() => new Map(groups.map((g) => [g.id, groupSpent(g, txs).spent])), [groups, txs])
  const ranking = useMemo(() => rankMerchants(expenses), [expenses])

  const list = useMemo(() => (merchant ? filterMerchant(expenses, merchant.key) : q.trim() ? searchSpending(expenses, q) : null), [expenses, merchant, q])
  const summary = useMemo(() => (list ? summarize(list, period) : null), [list, period])

  // grupos salvos + os sugeridos que têm gastos no período
  const cards = useMemo(() => {
    const saved = groups.map((g) => ({ id: g.id, name: g.name, terms: g.terms, saved: true }))
    // a sugestão some quando você já salvou um grupo com o mesmo nome ou as mesmas palavras
    const names = new Set(groups.map((g) => g.name.toLowerCase()))
    const sameTerms = new Set(groups.map((g) => parseTerms(g.terms).join()))
    const ideas = SUGGESTIONS.filter((s) => !names.has(s.name.toLowerCase()) && !sameTerms.has(parseTerms(s.terms).join())).map((s) => ({ id: `s-${s.name}`, name: s.name, terms: s.terms, saved: false }))
    return [...saved, ...ideas]
      .map((g) => {
        const t = parseTerms(g.terms)
        const hit = expenses.filter((x) => matchesTerms(x.description, t))
        return { ...g, total: hit.reduce((s, x) => s + x.amount, 0), count: hit.length }
      })
      .filter((g) => g.saved || g.count > 0)
  }, [groups, expenses])

  const open = (terms: string, name = '') => {
    setMerchant(null)
    setQ(terms)
    setLabel(name)
    setGroupName(null)
  }
  const reset = () => open('')
  const title = merchant ? merchant.name : label || `“${q.trim()}”`
  const maxMonth = summary ? Math.max(1, ...summary.byMonth.map((m) => m.total)) : 1
  const alreadySaved = !merchant && groups.some((g) => parseTerms(g.terms).join() === parseTerms(q).join())

  return (
    <div className="spend">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Buscar estabelecimento ou tipo de gasto"
            value={merchant ? merchant.name : q}
            onChange={(e) => {
              setMerchant(null)
              setQ(e.target.value)
              setLabel('')
              setGroupName(null)
            }}
            placeholder="Ex.: mercado livre, padaria, uber…"
          />
          {(q || merchant) && <button className="icon-btn" onClick={reset} aria-label="Limpar busca"><X size={15} /></button>}
        </div>
        <div className="segmented" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p} className={period === p ? 'on' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>
          ))}
        </div>
      </div>
      <p className="muted small spend-hint">Busque por nome ou por tipo. Separe palavras com vírgula para juntar tudo num grupo (ex.: <em>padaria, panificadora</em>). Só despesas entram aqui.</p>

      {!list && (
        <>
          <div className="spend-total">
            <span className="muted">Gasto no período ({PERIOD_LABEL[period].toLowerCase()})</span>
            <strong>{brl(totalAll)}</strong>
            <span className="muted small">{expenses.length} {expenses.length === 1 ? 'compra' : 'compras'}</span>
          </div>

          {cards.length > 0 && (
            <>
              <h4 className="spend-h">Grupos</h4>
              <div className="spend-groups">
                {cards.map((g) => (
                  <div key={g.id} className={`spend-group ${g.saved ? 'saved' : ''}`}>
                    <button className="spend-group-main" onClick={() => open(g.terms, g.name)} aria-label={`Ver gastos de ${g.name}`}>
                      <strong>{g.name}</strong>
                      <span>{brl(g.total)}</span>
                      <span className="muted small">{g.count} {g.count === 1 ? 'compra' : 'compras'}</span>
                    </button>
                    {g.saved && (
                      <button className="icon-btn" onClick={() => { if (confirm(`Excluir o grupo “${g.name}”? As despesas continuam.`)) onDeleteGroup(g.id) }} aria-label={`Excluir grupo ${g.name}`}><Trash2 size={14} /></button>
                    )}
                    {g.saved && (
                      <div className="spend-group-limit">
                        <GroupLimit id={g.id} name={g.name} limit={groups.find((x) => x.id === g.id)?.limit} spent={monthSpent.get(g.id) ?? 0} onSave={onGroupLimit} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <h4 className="spend-h">Onde você mais gasta</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Estabelecimento</th><th className="right">Compras</th><th className="right">Total</th><th className="right">%</th></tr>
              </thead>
              <tbody>
                {(all ? ranking : ranking.slice(0, TOP)).map((m) => (
                  <tr key={m.key}>
                    <td>
                      <button className="link-row" onClick={() => { setMerchant({ key: m.key, name: m.name }); setQ(''); setLabel('') }} aria-label={`Ver ${m.name}`}>{m.name}</button>
                      <div className="spend-share"><span style={{ width: `${totalAll ? (m.total / totalAll) * 100 : 0}%` }} /></div>
                    </td>
                    <td className="right muted">{m.count}</td>
                    <td className="right">{brl(m.total)}</td>
                    <td className="right muted">{totalAll ? Math.round((m.total / totalAll) * 100) : 0}%</td>
                  </tr>
                ))}
                {ranking.length === 0 && <tr><td colSpan={4} className="empty">Nenhuma despesa neste período.</td></tr>}
              </tbody>
            </table>
          </div>
          {ranking.length > TOP && <button className="btn ghost" onClick={() => setAll((v) => !v)}>{all ? 'Mostrar só os maiores' : `Mostrar todos (${ranking.length})`}</button>}
        </>
      )}

      {list && summary && (
        <>
          <div className="spend-title">
            <h3>{title}</h3>
            {!merchant && !alreadySaved && list.length > 0 && groupName === null && (
              <button className="btn" onClick={() => setGroupName(q.split(/[,;|+]/)[0].trim().replace(/^./, (c) => c.toUpperCase()))}>Salvar como grupo</button>
            )}
            {alreadySaved && <span className="tag" style={{ '--c': '#3ecf6e' } as React.CSSProperties}>Grupo salvo</span>}
          </div>
          {groupName !== null && (
            <form className="spend-save" onSubmit={(e) => { e.preventDefault(); if (groupName.trim()) { onSaveGroup(groupName.trim(), q.trim()); setGroupName(null) } }}>
              <input aria-label="Nome do grupo" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nome do grupo" autoFocus />
              <button className="btn primary" disabled={!groupName.trim()}>Salvar grupo</button>
              <button type="button" className="btn ghost" onClick={() => setGroupName(null)}>Cancelar</button>
            </form>
          )}

          {list.length === 0 ? (
            <p className="muted empty-rules">Nenhuma despesa encontrada neste período. Tente outro período ou outra palavra.</p>
          ) : (
            <>
              <div className="spend-stats">
                <div className="card stat"><span className="muted">Total gasto</span><div className="stat-value" data-testid="spend-total">{brl(summary.total)}</div></div>
                <div className="card stat"><span className="muted">Compras</span><div className="stat-value" data-testid="spend-count">{summary.count}</div></div>
                <div className="card stat"><span className="muted">Média por compra</span><div className="stat-value">{brl(summary.avg)}</div></div>
                <div className="card stat"><span className="muted">Maior compra</span><div className="stat-value">{brl(summary.max?.amount ?? 0)}</div><span className="muted small">{summary.max ? formatDate(summary.max.date) : ''}</span></div>
              </div>
              <p className="muted small">{totalAll ? `${Math.round((summary.total / totalAll) * 100)}% de tudo o que você gastou no período · ` : ''}última compra em {formatDate(summary.last)}</p>

              {summary.byMonth.length > 1 && (
                <div className="spend-bars" role="img" aria-label="Gasto por mês">
                  {summary.byMonth.map((m) => (
                    <div key={m.month} className="spend-bar">
                      <span className="spend-bar-v">{m.total > 0 ? brl(m.total) : ''}</span>
                      <div className="spend-bar-track"><span style={{ height: `${(m.total / maxMonth) * 100}%` }} /></div>
                      <span className="muted small">{monthLabel(new Date(`${m.month}-01T12:00:00`))}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th className="right">Valor</th></tr></thead>
                  <tbody>
                    {list.map((t) => (
                      <tr key={t.id}>
                        <td>{t.description}</td>
                        <td><span className="tag" style={{ '--c': CATEGORIES[t.category].color } as React.CSSProperties}>{CATEGORIES[t.category].label}</span></td>
                        <td className="muted">{formatDate(t.date)}</td>
                        <td className="right">− {brl(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
