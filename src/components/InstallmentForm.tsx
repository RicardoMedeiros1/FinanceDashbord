import { useState } from 'react'
import { brl, installmentStatus, monthLong, occurrence, toISO } from '../lib'
import type { Installment } from '../types'

const COLORS = ['#e0600f', '#3b6ef5', '#8b3ff5', '#e84a45', '#3ecf6e', '#f472b6', '#22d3ee', '#94a3b8']

interface Props {
  initial?: Installment
  onSave: (i: Omit<Installment, 'id'>) => void
}

export function InstallmentForm({ initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [lender, setLender] = useState(initial?.lender ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace('.', ',') : '')
  const [count, setCount] = useState(initial ? String(initial.count) : '')
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? toISO(new Date()))
  const [firstDate, setFirstDate] = useState(initial?.firstDate ?? occurrence(toISO(new Date()), 'monthly', 1))
  const [firstTouched, setFirstTouched] = useState(!!initial)
  const [color, setColor] = useState(initial?.color ?? COLORS[0])

  const value = Number(amount.replace(',', '.'))
  const n = Math.floor(Number(count))
  const valid = name.trim() && value > 0 && n >= 1 && n <= 120 && purchaseDate && firstDate

  // pré-visualização do que o sistema vai calcular
  const preview =
    value > 0 && n >= 1 && n <= 120 && firstDate
      ? installmentStatus({ id: '', name, lender, amount: value, count: n, purchaseDate, firstDate, color })
      : null

  const onPurchase = (d: string) => {
    setPurchaseDate(d)
    // por padrão a 1ª parcela vence um mês depois da compra, até você mexer nesse campo
    if (!firstTouched && d) setFirstDate(occurrence(d, 'monthly', 1))
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), lender: lender.trim(), amount: value, count: n, purchaseDate, firstDate, color })
      }}
    >
      <label>
        O que foi comprado
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: iPhone 15" autoFocus />
      </label>
      <label>
        Com quem (opcional)
        <input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Ex.: João — cartão dele" />
      </label>
      <div className="row">
        <label>
          Valor da parcela (R$)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </label>
        <label>
          Nº de parcelas
          <input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" placeholder="12" />
        </label>
      </div>
      <div className="row">
        <label>
          Data da compra
          <input type="date" value={purchaseDate} onChange={(e) => onPurchase(e.target.value)} />
        </label>
        <label>
          1ª parcela vence em
          <input type="date" value={firstDate} onChange={(e) => { setFirstDate(e.target.value); setFirstTouched(true) }} />
        </label>
      </div>
      <div className="swatches">
        {COLORS.map((c) => (
          <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />
        ))}
      </div>
      {preview && (
        <p className="preview small" role="note">
          {n}x de {brl(value)} = <strong>{brl(preview.total)}</strong>. Última parcela em <strong>{monthLong(preview.end.slice(0, 7)).toLowerCase()}</strong>
          {preview.paid > 0 ? ` · ${preview.paid} já ${preview.paid > 1 ? 'venceram' : 'venceu'}` : ''}.
        </p>
      )}
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar alterações' : 'Adicionar'}</button>
    </form>
  )
}
