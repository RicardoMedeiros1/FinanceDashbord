import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../components/Modal'
import { SubscriptionForm } from '../components/SubscriptionForm'
import { brl, daysUntil, formatDate, monthlyCost, nextCharge, toISO } from '../lib'
import type { Subscription } from '../types'

interface Props {
  subs: Subscription[]
  onAdd: (s: Omit<Subscription, 'id' | 'active'>) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export function Subscriptions({ subs, onAdd, onToggle, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const active = subs.filter((s) => s.active)
  const monthly = active.reduce((s, x) => s + monthlyCost(x), 0)

  return (
    <>
      <div className="grid stats three">
        <div className="card stat">
          <span className="muted">Custo mensal</span>
          <div className="stat-value">{brl(monthly)}</div>
        </div>
        <div className="card stat">
          <span className="muted">Custo anual</span>
          <div className="stat-value">{brl(monthly * 12)}</div>
        </div>
        <div className="card stat">
          <span className="muted">Ativas</span>
          <div className="stat-value">{active.length} <span className="muted small">de {subs.length}</span></div>
        </div>
      </div>

      <div className="section-head">
        <h3>Suas assinaturas</h3>
        <button className="btn primary" onClick={() => setOpen(true)}><Plus size={16} /> Nova assinatura</button>
      </div>

      <div className="grid subs">
        {[...subs]
          .sort((a, b) => Number(b.active) - Number(a.active) || nextCharge(a).getTime() - nextCharge(b).getTime())
          .map((s) => {
            const next = nextCharge(s)
            const d = daysUntil(next)
            return (
              <div key={s.id} className={`card sub ${s.active ? '' : 'off'}`}>
                <div className="sub-top">
                  <span className="logo lg" style={{ background: s.color }}>{s.name[0]}</span>
                  <div className="grow">
                    <strong>{s.name}</strong>
                    <span className="muted small">{s.cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                  </div>
                  <button className="icon-btn" onClick={() => onDelete(s.id)} aria-label={`Excluir ${s.name}`}><Trash2 size={16} /></button>
                </div>
                <div className="sub-price">{brl(s.price)}<span className="muted small"> /{s.cycle === 'monthly' ? 'mês' : 'ano'}</span></div>
                <div className="sub-foot">
                  <span className="muted small">
                    {s.active ? `Renova ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`} · ${formatDate(toISO(next))}`.replace('· $', '· ') : 'Pausada'}
                  </span>
                  <button className={`switch ${s.active ? 'on' : ''}`} onClick={() => onToggle(s.id)} role="switch" aria-checked={s.active} aria-label={`${s.active ? 'Pausar' : 'Ativar'} ${s.name}`}>
                    <span />
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {open && (
        <Modal title="Nova assinatura" onClose={() => setOpen(false)}>
          <SubscriptionForm onSave={(s) => { onAdd(s); setOpen(false) }} />
        </Modal>
      )}
    </>
  )
}
