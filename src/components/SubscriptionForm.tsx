import { useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES } from '../categories'
import { brl, formatDate, lastCharge, toISO } from '../lib'
import type { Card, CategoryId, Subscription } from '../types'

const COLORS = ['#8b5cf6', '#e50914', '#1db954', '#38bdf8', '#f59e0b', '#f472b6', '#10a37f', '#6366f1']

interface Props {
  cards: Card[]
  initial?: Subscription
  /** includeLast: lançar como despesa a cobrança deste mês que já aconteceu (só ao criar). */
  onSave: (s: Omit<Subscription, 'id' | 'active' | 'chargedUntil'>, includeLast: boolean) => void
}

export function SubscriptionForm({ cards, initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price).replace('.', ',') : '')
  const [cycle, setCycle] = useState<Subscription['cycle']>(initial?.cycle ?? 'monthly')
  const [billingDate, setBillingDate] = useState(initial?.billingDate ?? toISO(new Date()))
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'assinaturas')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [includeLast, setIncludeLast] = useState(true)
  const [cardId, setCardId] = useState(initial?.cardId ?? '')

  const value = Number(price.replace(',', '.'))
  const valid = name.trim() && value > 0 && billingDate

  // cobrança deste mês que já passou: pode entrar como despesa
  const today = toISO(new Date())
  const recent = value > 0 && billingDate ? lastCharge({ id: '', name, price: value, cycle, billingDate, color, active: true }, today) : null
  const offerLast = !initial && recent !== null && recent.slice(0, 7) === today.slice(0, 7)

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), price: value, cycle, billingDate, color, category, cardId: cardId || undefined }, offerLast && includeLast)
      }}
    >
      <label>
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Netflix" autoFocus />
      </label>
      <div className="row">
        <label>
          Valor (R$)
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </label>
        <label>
          Ciclo
          <select value={cycle} onChange={(e) => setCycle(e.target.value as Subscription['cycle'])}>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
        </label>
      </div>
      <label>
        Data de uma cobrança (a próxima é calculada)
        <input type="date" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} />
      </label>
      <label>
        Categoria da despesa
        <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORIES[c].label}</option>
          ))}
        </select>
      </label>
      {cards.length > 0 && (
        <label>
          Cobrada no cartão
          <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Nenhum (débito, Pix ou boleto)</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="swatches">
        {COLORS.map((c) => (
          <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />
        ))}
      </div>
      <p className="muted small">Cada cobrança vira uma despesa no dia da renovação. Se você já lança esta assinatura como transação ou recorrente, não cadastre aqui para não contar duas vezes.</p>
      {offerLast && recent && (
        <label className="check">
          <input type="checkbox" checked={includeLast} onChange={(e) => setIncludeLast(e.target.checked)} />
          Lançar como despesa a cobrança de {formatDate(recent)} ({brl(value)})
        </label>
      )}
      {initial && <p className="muted small">Alterações valem para as próximas cobranças; despesas já lançadas não mudam.</p>}
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar alterações' : 'Salvar'}</button>
    </form>
  )
}
