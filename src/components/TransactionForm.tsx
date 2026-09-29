import { useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES } from '../categories'
import { toISO } from '../lib'
import type { CategoryId, Transaction } from '../types'

export function TransactionForm({ onSave }: { onSave: (t: Omit<Transaction, 'id'>) => void }) {
  const [type, setType] = useState<Transaction['type']>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<CategoryId>('alimentacao')
  const [date, setDate] = useState(toISO(new Date()))

  const value = Number(amount.replace(',', '.'))
  const valid = description.trim() && value > 0 && date

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({ description: description.trim(), amount: value, type, category: type === 'income' ? 'renda' : category, date })
      }}
    >
      <div className="segmented">
        <button type="button" className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>Despesa</button>
        <button type="button" className={type === 'income' ? 'on' : ''} onClick={() => setType('income')}>Receita</button>
      </div>
      <label>
        Descrição
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Mercado" autoFocus />
      </label>
      <div className="row">
        <label>
          Valor (R$)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </label>
        <label>
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {type === 'expense' && (
        <label>
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORIES[c].label}</option>
            ))}
          </select>
        </label>
      )}
      <button className="btn primary" disabled={!valid}>Salvar</button>
    </form>
  )
}
