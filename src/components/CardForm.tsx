import { useState } from 'react'
import type { Card } from '../types'

const COLORS = ['#8b3ff5', '#e0600f', '#3b6ef5', '#e84a45', '#3ecf6e', '#f472b6', '#22d3ee', '#94a3b8']

interface Props {
  initial?: Card
  onSave: (c: Omit<Card, 'id' | 'paid'>) => void
}

export function CardForm({ initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [closing, setClosing] = useState(initial ? String(initial.closingDay) : '')
  const [due, setDue] = useState(initial ? String(initial.dueDay) : '')
  const [limit, setLimit] = useState(initial?.limit ? String(initial.limit).replace('.', ',') : '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])

  const c = Math.floor(Number(closing))
  const d = Math.floor(Number(due))
  const lim = limit.trim() ? Number(limit.replace(',', '.')) : undefined
  const validDay = (n: number) => n >= 1 && n <= 31
  const valid = name.trim() && validDay(c) && validDay(d) && (lim === undefined || lim > 0)

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), closingDay: c, dueDay: d, limit: lim, color })
      }}
    >
      <label>
        Nome do cartão
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank" autoFocus />
      </label>
      <div className="row">
        <label>
          Dia do fechamento
          <input value={closing} onChange={(e) => setClosing(e.target.value)} inputMode="numeric" placeholder="Ex.: 5" />
        </label>
        <label>
          Dia do vencimento
          <input value={due} onChange={(e) => setDue(e.target.value)} inputMode="numeric" placeholder="Ex.: 12" />
        </label>
      </div>
      <label>
        Limite (opcional)
        <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="0,00" />
      </label>
      <div className="swatches">
        {COLORS.map((x) => (
          <button type="button" key={x} className={`swatch ${x === color ? 'on' : ''}`} style={{ background: x }} onClick={() => setColor(x)} aria-label={`Cor ${x}`} />
        ))}
      </div>
      <p className="muted small hint">
        Compras feitas até o dia do fechamento (inclusive) entram na fatura que fecha nesse dia; a partir do dia seguinte, na próxima. Se o seu banco conta diferente, ajuste o dia do fechamento em 1.
        Em meses curtos, o dia 31 vale o último dia do mês.
      </p>
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar alterações' : 'Adicionar cartão'}</button>
    </form>
  )
}
