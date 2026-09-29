import { Pencil, Plus, Trash2 } from 'lucide-react'
import { brl, formatDate, installmentStatus, monthLong } from '../lib'
import type { Installment } from '../types'

interface Props {
  items: Installment[]
  onNew: () => void
  onEdit: (i: Installment) => void
  onDelete: (id: string) => void
}

export function Installments({ items, onNew, onEdit, onDelete }: Props) {
  const rows = items
    .map((i) => ({ i, st: installmentStatus(i) }))
    .sort((a, b) => Number(a.st.done) - Number(b.st.done) || (a.st.next ?? '9').localeCompare(b.st.next ?? '9'))
  const open = rows.filter((r) => !r.st.done)
  const monthly = open.reduce((s, r) => s + r.i.amount, 0)
  const owed = open.reduce((s, r) => s + r.st.remainingAmount, 0)

  return (
    <>
      <div className="grid stats three">
        <div className="card stat"><span className="muted">Parcelas por mês</span><div className="stat-value">{brl(monthly)}</div></div>
        <div className="card stat"><span className="muted">Ainda a pagar</span><div className="stat-value">{brl(owed)}</div></div>
        <div className="card stat"><span className="muted">Em aberto</span><div className="stat-value">{open.length} <span className="muted small">de {items.length}</span></div></div>
      </div>

      <div className="section-head">
        <h3>Parcelas e dívidas</h3>
        <button className="btn primary" onClick={onNew}><Plus size={16} /> Nova parcela</button>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-rules muted">
          Comprou algo parcelado no cartão de alguém? Cadastre aqui: informe a data da compra, o valor e o número de parcelas, e o app calcula quanto falta e quando termina.
        </div>
      ) : (
        <div className="grid subs">
          {rows.map(({ i, st }) => (
            <div key={i.id} className={`card sub ${st.done ? 'off' : ''}`}>
              <div className="sub-top">
                <span className="logo lg" style={{ background: i.color }}>{i.name[0]?.toUpperCase()}</span>
                <div className="grow">
                  <strong>{i.name}</strong>
                  <span className="muted small">{i.lender ? `Com ${i.lender}` : `Comprado em ${formatDate(i.purchaseDate)}`}</span>
                </div>
                <button className="icon-btn" onClick={() => onEdit(i)} aria-label={`Editar ${i.name}`}><Pencil size={15} /></button>
                <button className="icon-btn" onClick={() => onDelete(i.id)} aria-label={`Excluir ${i.name}`}><Trash2 size={15} /></button>
              </div>
              <div className="sub-price">{brl(i.amount)}<span className="muted small"> /mês · {i.count}x</span></div>
              <div>
                <div className={`bar ${st.done ? '' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={i.count} aria-valuenow={st.paid} aria-label={`${st.paid} de ${i.count} parcelas pagas`}>
                  <span style={{ width: `${(st.paid / i.count) * 100}%` }} />
                </div>
                <div className="inst-meta small">
                  <span>{st.paid} de {i.count} pagas</span>
                  <span className="muted">{st.done ? 'Quitada' : `faltam ${brl(st.remainingAmount)}`}</span>
                </div>
              </div>
              <span className="muted small">
                {st.done ? `Terminou em ${monthLong(st.end.slice(0, 7)).toLowerCase()}` : `Próxima: ${formatDate(st.next!)} · termina em ${monthLong(st.end.slice(0, 7)).toLowerCase()}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
