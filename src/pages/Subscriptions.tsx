import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../components/Modal'
import { InstallmentForm } from '../components/InstallmentForm'
import { SubscriptionForm } from '../components/SubscriptionForm'
import { Tabs } from '../components/Tabs'
import { Installments } from './Installments'
import { CATEGORIES } from '../categories'
import { brl, daysUntil, formatDate, monthlyCost, nextCharge, toISO } from '../lib'
import type { Installment, Subscription } from '../types'

export type SubsTab = 'subs' | 'installments'

interface Props {
  receiptCount: (installmentId: string) => number
  onDetails: (i: Installment) => void
  tab: SubsTab
  onTab: (t: SubsTab) => void
  installments: Installment[]
  onSaveInstallment: (i: Omit<Installment, 'id' | 'generated'>, includePast: boolean, id?: string) => void
  onDeleteInstallment: (id: string) => void
  subs: Subscription[]
  onSave: (s: Omit<Subscription, 'id' | 'active' | 'chargedUntil'>, includeLast: boolean, id?: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export function Subscriptions({ receiptCount, onDetails, tab, onTab, subs, onSave, onToggle, onDelete, installments, onSaveInstallment, onDeleteInstallment }: Props) {
  const [subForm, setSubForm] = useState<{ item?: Subscription } | null>(null)
  const [instForm, setInstForm] = useState<{ item?: Installment } | null>(null)
  const active = subs.filter((s) => s.active)
  const monthly = active.reduce((s, x) => s + monthlyCost(x), 0)

  const tabs = (
    <Tabs
      label="Assinaturas e parcelas"
      active={tab}
      onChange={onTab}
      tabs={[
        { id: 'subs', label: 'Assinaturas', count: subs.filter((x) => x.active).length },
        { id: 'installments', label: 'Parcelas', count: installments.length },
      ]}
    />
  )

  if (tab === 'installments') {
    return (
      <>
        {tabs}
        <Installments
          receiptCount={receiptCount}
          onDetails={onDetails}
          items={installments}
          onNew={() => setInstForm({})}
          onEdit={(item) => setInstForm({ item })}
          onDelete={onDeleteInstallment}
        />
        {instForm && (
          <Modal title={instForm.item ? 'Editar parcela' : 'Nova parcela'} onClose={() => setInstForm(null)}>
            <InstallmentForm
              initial={instForm.item}
              onSave={(i, includePast) => {
                onSaveInstallment(i, includePast, instForm.item?.id)
                setInstForm(null)
              }}
            />
          </Modal>
        )}
      </>
    )
  }

  return (
    <>
      {tabs}
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
        <button className="btn primary" onClick={() => setSubForm({})}><Plus size={16} /> Nova assinatura</button>
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
                    <span className="muted small">{s.cycle === 'monthly' ? 'Mensal' : 'Anual'} · {CATEGORIES[s.category ?? 'assinaturas'].label}</span>
                  </div>
                  <button className="icon-btn" onClick={() => setSubForm({ item: s })} aria-label={`Editar ${s.name}`}><Pencil size={15} /></button>
                  <button className="icon-btn" onClick={() => { if (confirm(`Excluir “${s.name}”? As despesas já lançadas continuam nas Transações.`)) onDelete(s.id) }} aria-label={`Excluir ${s.name}`}><Trash2 size={16} /></button>
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

      {subForm && (
        <Modal title={subForm.item ? 'Editar assinatura' : 'Nova assinatura'} onClose={() => setSubForm(null)}>
          <SubscriptionForm
            initial={subForm.item}
            onSave={(sub, includeLast) => {
              onSave(sub, includeLast, subForm.item?.id)
              setSubForm(null)
            }}
          />
        </Modal>
      )}
    </>
  )
}
