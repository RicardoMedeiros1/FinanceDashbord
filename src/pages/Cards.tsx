import { ArrowLeft, Check, CreditCard, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cardInvoices, cardSummary, type Invoice, type InvoiceStatus } from '../cards'
import { CardForm } from '../components/CardForm'
import { Modal } from '../components/Modal'
import { Money } from '../components/Money'
import { brl, formatDate, monthLong } from '../lib'
import type { Card, Transaction } from '../types'

const STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  open: { label: 'Aberta', cls: '' },
  closed: { label: 'Fechada · a pagar', cls: 'warn' },
  overdue: { label: 'Vencida', cls: 'bad' },
  paid: { label: 'Paga', cls: 'good' },
  future: { label: 'Futura', cls: '' },
}

interface Props {
  cards: Card[]
  txs: Transaction[]
  sub: string // id do cartão aberto (vazio = lista)
  onOpen: (id: string) => void
  onBack: () => void
  onSave: (c: Omit<Card, 'id' | 'paid'>, id?: string) => void
  onDelete: (id: string) => void
  onTogglePaid: (cardId: string, key: string) => void
}

export function Cards({ cards, txs, sub, onOpen, onBack, onSave, onDelete, onTogglePaid }: Props) {
  const [form, setForm] = useState<{ item?: Card } | null>(null)
  const card = cards.find((c) => c.id === sub)

  const modal = form && (
    <Modal title={form.item ? 'Editar cartão' : 'Novo cartão'} onClose={() => setForm(null)}>
      <CardForm
        initial={form.item}
        onSave={(c) => {
          onSave(c, form.item?.id)
          setForm(null)
        }}
      />
    </Modal>
  )

  if (card) {
    return (
      <>
        <CardDetail
          card={card}
          txs={txs}
          onBack={onBack}
          onEdit={() => setForm({ item: card })}
          onDelete={() => {
            if (confirm(`Excluir o cartão “${card.name}”? As compras continuam nas Transações, mas deixam de estar ligadas a um cartão.`)) {
              onDelete(card.id)
              onBack()
            }
          }}
          onTogglePaid={(key) => onTogglePaid(card.id, key)}
        />
        {modal}
      </>
    )
  }

  return (
    <>
      <div className="section-head">
        <h3>Seus cartões</h3>
        <button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Novo cartão</button>
      </div>

      {cards.length === 0 ? (
        <div className="card empty-rules muted">
          Cadastre seus cartões de crédito com o dia de fechamento e o de vencimento. Ao lançar uma despesa, escolha o cartão usado e o app monta as faturas, mostra quando fecham, quanto falta pagar e o limite disponível.
        </div>
      ) : (
        <div className="grid cardgrid">
          {cards.map((c) => {
            const s = cardSummary(c, txs)
            const pct = c.limit ? Math.min(100, (s.used / c.limit) * 100) : 0
            return (
              <div key={c.id} className="card cc" style={{ '--c': c.color } as React.CSSProperties}>
                <div className="sub-top">
                  <span className="logo lg" style={{ background: c.color }}><CreditCard size={18} /></span>
                  <div className="grow">
                    <strong>{c.name}</strong>
                    <span className="muted small">Fecha dia {c.closingDay} · vence dia {c.dueDay}</span>
                  </div>
                </div>
                <div>
                  <span className="muted small">Fatura atual (aberta)</span>
                  <div className="sub-price"><Money value={s.open.total} /></div>
                  <span className="muted small">
                    {s.daysToClose === 0 ? 'Fecha hoje' : `Fecha em ${s.daysToClose} ${s.daysToClose === 1 ? 'dia' : 'dias'}`} ({formatDate(s.open.closing)}) · vence {formatDate(s.open.due)}
                  </span>
                </div>
                {s.closed && (
                  <div className="cc-alert">
                    Fatura fechada: <strong>{brl(s.closed.total)}</strong> · vence {formatDate(s.closed.due)}
                  </div>
                )}
                {c.limit ? (
                  <div>
                    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.limit} aria-valuenow={s.used} aria-label={`Limite usado de ${c.name}`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <div className="inst-meta small">
                      <span>Usado {brl(s.used)}</span>
                      <span className="muted">disponível {brl(Math.max(0, c.limit - s.used))}</span>
                    </div>
                  </div>
                ) : null}
                <span className="muted small">Melhor dia de compra: dia {s.bestDay}</span>
                <button className="pill-btn details-btn" onClick={() => onOpen(c.id)}>Ver faturas</button>
              </div>
            )
          })}
        </div>
      )}
      {modal}
    </>
  )
}

function CardDetail({ card, txs, onBack, onEdit, onDelete, onTogglePaid }: { card: Card; txs: Transaction[]; onBack: () => void; onEdit: () => void; onDelete: () => void; onTogglePaid: (key: string) => void }) {
  const invoices = cardInvoices(card, txs)
  const s = cardSummary(card, txs)
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(invoices.filter((i) => i.status === 'open' || i.status === 'closed' || (i.status === 'overdue' && i.total > 0)).map((i) => i.key)))
  const toggle = (k: string) => setOpenKeys((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <>
      <div className="detail-head">
        <button className="btn ghost" onClick={onBack}><ArrowLeft size={15} /> Cartões</button>
        <div className="grow">
          <h3>{card.name}</h3>
          <span className="muted small">Fecha dia {card.closingDay} · vence dia {card.dueDay}{card.limit ? ` · limite ${brl(card.limit)}` : ''}</span>
        </div>
        <button className="icon-btn" onClick={onEdit} aria-label={`Editar ${card.name}`}><Pencil size={15} /></button>
        <button className="icon-btn" onClick={onDelete} aria-label={`Excluir ${card.name}`}><Trash2 size={15} /></button>
      </div>

      <div className="grid stats three">
        <div className="card stat"><span className="muted">Fatura atual</span><div className="stat-value"><Money value={s.open.total} /></div><span className="muted small">fecha {formatDate(s.open.closing)} · vence {formatDate(s.open.due)}</span></div>
        <div className="card stat"><span className="muted">Fechada, a pagar</span><div className="stat-value">{s.closed ? <Money value={s.closed.total} /> : 'R$ 0,00'}</div><span className="muted small">{s.closed ? `vence ${formatDate(s.closed.due)}` : 'nenhuma no momento'}</span></div>
        <div className="card stat"><span className="muted">{card.limit ? 'Limite disponível' : 'Melhor dia de compra'}</span><div className="stat-value">{card.limit ? <Money value={Math.max(0, card.limit - s.used)} /> : `dia ${s.bestDay}`}</div><span className="muted small">{card.limit ? `melhor dia de compra: dia ${s.bestDay}` : 'o dia seguinte ao fechamento'}</span></div>
      </div>

      <ul className="invoices">
        {invoices.map((i) => (
          <InvoiceRow key={i.key} inv={i} open={openKeys.has(i.key)} onToggle={() => toggle(i.key)} onTogglePaid={() => onTogglePaid(i.key)} />
        ))}
      </ul>
    </>
  )
}

function InvoiceRow({ inv, open, onToggle, onTogglePaid }: { inv: Invoice; open: boolean; onToggle: () => void; onTogglePaid: () => void }) {
  const st = STATUS[inv.status]
  return (
    <li className="card invoice">
      <button className="invoice-head" onClick={onToggle} aria-expanded={open}>
        <div className="grow">
          <strong>Fatura de {monthLong(inv.due.slice(0, 7))}</strong>
          <span className="muted small">fecha {formatDate(inv.closing)} · vence {formatDate(inv.due)}</span>
        </div>
        <span className={`pill ${st.cls}`}>{st.label}</span>
        <strong>{brl(inv.total)}</strong>
      </button>
      {open && (
        <div className="invoice-body">
          {inv.txs.length === 0 ? (
            <p className="muted small">Nenhuma compra nesta fatura.</p>
          ) : (
            <ul className="list compact">
              {inv.txs.map((t) => (
                <li key={t.id}>
                  <div className="grow">
                    <strong>{t.description}</strong>
                    <span className="muted small">{formatDate(t.date)}</span>
                  </div>
                  <strong>{brl(t.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
          {(inv.status === 'closed' || inv.status === 'overdue') && (
            <button className="btn primary" onClick={onTogglePaid}><Check size={15} /> Marcar como paga</button>
          )}
          {inv.status === 'paid' && (
            <button className="btn ghost" onClick={onTogglePaid}><RotateCcw size={15} /> Desfazer pagamento</button>
          )}
        </div>
      )}
    </li>
  )
}
