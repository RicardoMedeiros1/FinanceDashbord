import { ArrowLeftRight, Paperclip, Pencil, PieChart, Plus, Repeat, Search, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES } from '../categories'
import { Tabs } from '../components/Tabs'
import { brl, CYCLE_LABEL, formatDate, monthKey, monthLong, nextOccurrence, sumBy } from '../lib'
import { ImportModal } from '../components/ImportModal'
import { SpendingView } from '../components/SpendingView'
import { MarkTransferModal } from '../components/MarkTransferModal'
import { TransferReviewModal } from '../components/TransferReviewModal'
import { findTransferMatches, type TransferMatch } from '../transfers'
import type { Account, Card, Recurring, SpendGroup, Transaction } from '../types'

type Filter = 'all' | 'income' | 'expense'

export type TxView = 'list' | 'recurring' | 'merchants'

interface Props {
  knownIds: string[]
  onConvertTransfers: (list: TransferMatch[]) => void
  onMarkTransfer: (tx: Transaction, from: string, to: string) => void
  groups: SpendGroup[]
  onSaveGroup: (name: string, terms: string) => void
  onDeleteGroup: (id: string) => void
  accounts: Account[]
  onImport: (list: Transaction[]) => void
  cards: Card[]
  receiptIds: Set<string>
  onOpenReceipt: (id: string) => void
  view: TxView
  onView: (v: TxView) => void
  txs: Transaction[]
  rules: Recurring[]
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
  onNewRecurring: () => void
  onToggleRule: (id: string) => void
  onDeleteRule: (id: string) => void
}

const tagStyle = (color: string) => ({ '--c': color }) as React.CSSProperties

export function Transactions({ knownIds, onConvertTransfers, onMarkTransfer, groups, onSaveGroup, onDeleteGroup, accounts, onImport, cards, receiptIds, onOpenReceipt, view, onView, txs, rules, onEdit, onDelete, onNewRecurring, onToggleRule, onDeleteRule }: Props) {
  const [importing, setImporting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [marking, setMarking] = useState<Transaction | null>(null)
  const matches = useMemo(() => findTransferMatches(txs, accounts), [txs, accounts])
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
      <div className="view-tabs">
        <Tabs
          label="Transações"
          active={view}
          onChange={onView}
          tabs={[
            { id: 'list', label: 'Lançamentos' },
            { id: 'recurring', label: 'Recorrentes', icon: <Repeat size={13} />, count: rules.length },
            { id: 'merchants', label: 'Onde gasto', icon: <PieChart size={13} /> },
          ]}
        />
        {view === 'recurring' && (
          <button className="btn primary" onClick={onNewRecurring}><Plus size={16} /> Nova recorrente</button>
        )}
        {view === 'list' && (
          <button className="btn" onClick={() => setImporting(true)}><Upload size={16} /> Importar extrato</button>
        )}
      </div>

      {view !== 'recurring' && matches.length > 0 && (
        <div className="transfer-banner" role="status">
          <ArrowLeftRight size={16} />
          <span className="grow">Encontrei <strong>{matches.length}</strong> {matches.length === 1 ? 'possível transferência' : 'possíveis transferências'} entre as suas contas. Elas estão contando como despesa e receita.</span>
          <button className="btn" onClick={() => setReviewing(true)}>Revisar</button>
        </div>
      )}

      {view === 'merchants' ? (
        <SpendingView txs={txs} groups={groups} onSaveGroup={onSaveGroup} onDeleteGroup={onDeleteGroup} />
      ) : view === 'list' ? (
        <>
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
            <span className="muted">{rows.length} {rows.length === 1 ? "transação" : "transações"}</span>
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
                    <td>
                      {t.description}
                      {t.cardId && cards.find((c) => c.id === t.cardId) && (
                        <span className="tag card-tag" style={tagStyle(cards.find((c) => c.id === t.cardId)!.color)}>{cards.find((c) => c.id === t.cardId)!.name}</span>
                      )}
                      {receiptIds.has(t.id) && (
                        <button className="rec-btn" onClick={() => onOpenReceipt(t.id)} aria-label={`Ver comprovante de ${t.description}`}><Paperclip size={13} /></button>
                      )}
                      {t.ruleId && <Repeat size={12} className="rec-icon" aria-label="Lançado automaticamente" />}
                    </td>
                    <td><span className="tag" style={tagStyle(CATEGORIES[t.category].color)}>{CATEGORIES[t.category].label}</span></td>
                    <td className="muted">{formatDate(t.date)}</td>
                    <td className={`right ${t.type === 'income' ? 'pos' : ''}`}>{t.type === 'income' ? '+' : '−'} {brl(t.amount)}</td>
                    <td className="right actions">
                      {accounts.length > 0 && !t.cardId && <button className="icon-btn" onClick={() => setMarking(t)} aria-label={`Marcar ${t.description} como transferência`} title="Marcar como transferência"><ArrowLeftRight size={15} /></button>}
                      <button className="icon-btn" onClick={() => onEdit(t)} aria-label={`Editar ${t.description}`}><Pencil size={15} /></button>
                      <button className="icon-btn" onClick={() => onDelete(t.id)} aria-label={`Excluir ${t.description}`}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="empty">Nada por aqui.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <ul className="list rules">
          {rules.map((r) => (
            <li key={r.id} className={r.active ? '' : 'off'}>
              <span className="dot lg" style={{ background: CATEGORIES[r.category].color }} />
              <div className="grow">
                <strong>{r.description}</strong>
                <span className="muted small">
                  {CYCLE_LABEL[r.cycle]} · {r.active ? `próxima em ${formatDate(nextOccurrence(r))}` : 'pausada'} · {CATEGORIES[r.category].label}
                </span>
              </div>
              <strong className={r.type === 'income' ? 'pos' : ''}>{r.type === 'income' ? '+' : '−'} {brl(r.amount)}</strong>
              <button className={`switch ${r.active ? 'on' : ''}`} onClick={() => onToggleRule(r.id)} role="switch" aria-checked={r.active} aria-label={`${r.active ? 'Pausar' : 'Ativar'} ${r.description}`}><span /></button>
              <button className="icon-btn" onClick={() => onDeleteRule(r.id)} aria-label={`Excluir recorrência ${r.description}`}><Trash2 size={15} /></button>
            </li>
          ))}
          {rules.length === 0 && (
            <li className="empty-rules muted">
              Nenhuma recorrência ainda. Cadastre salário, aluguel e contas fixas uma vez e o app lança sozinho quando chegar o dia.
            </li>
          )}
        </ul>
      )}
      {importing && <ImportModal txs={txs} cards={cards} accounts={accounts} onImport={onImport} knownIds={knownIds} onClose={() => setImporting(false)} />}
      {reviewing && <TransferReviewModal matches={matches} accounts={accounts} onConvert={(l) => { onConvertTransfers(l); setReviewing(false) }} onClose={() => setReviewing(false)} />}
      {marking && <MarkTransferModal tx={marking} accounts={accounts} onSave={(f, to) => { onMarkTransfer(marking, f, to); setMarking(null) }} onClose={() => setMarking(null)} />}
    </div>
  )
}
