import { useState } from 'react'
import { toISO } from '../lib'
import type { Subscription } from '../types'

const COLORS = ['#8b5cf6', '#e50914', '#1db954', '#38bdf8', '#f59e0b', '#f472b6', '#10a37f', '#6366f1']

export function SubscriptionForm({ onSave }: { onSave: (s: Omit<Subscription, 'id' | 'active'>) => void }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cycle, setCycle] = useState<Subscription['cycle']>('monthly')
  const [billingDate, setBillingDate] = useState(toISO(new Date()))
  const [color, setColor] = useState(COLORS[0])

  const value = Number(price.replace(',', '.'))
  const valid = name.trim() && value > 0 && billingDate

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), price: value, cycle, billingDate, color })
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
      <div className="swatches">
        {COLORS.map((c) => (
          <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />
        ))}
      </div>
      <button className="btn primary" disabled={!valid}>Salvar</button>
    </form>
  )
}
