import { useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES } from '../categories'
import { toISO } from '../lib'
import type { CategoryId, Cycle, Transaction } from '../types'

interface Props {
  /** Presente ao editar um lançamento existente. */
  initial?: Transaction
  /** Abre já com "Repetir" marcado (ao criar uma recorrente). */
  startRepeating?: boolean
  onSave: (t: Omit<Transaction, 'id' | 'ruleId'>, repeat: Cycle | null) => void
}

export function TransactionForm({ initial, startRepeating, onSave }: Props) {
  const [type, setType] = useState<Transaction['type']>(initial?.type ?? 'expense')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace('.', ',') : '')
  const [category, setCategory] = useState<CategoryId>(initial && initial.category !== 'renda' ? initial.category : 'alimentacao')
  const [date, setDate] = useState(initial?.date ?? toISO(new Date()))
  const [repeat, setRepeat] = useState(startRepeating ?? false)
  const [cycle, setCycle] = useState<Cycle>('monthly')

  const value = Number(amount.replace(',', '.'))
  const valid = description.trim() && value > 0 && date

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave(
          { description: description.trim(), amount: value, type, category: type === 'income' ? 'renda' : category, date },
          repeat && !initial ? cycle : null,
        )
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
          {repeat && !initial ? 'Primeira data' : 'Data'}
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
      {!initial && (
        <div className="repeat">
          <label className="check">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Repetir automaticamente
          </label>
          {repeat && (
            <select value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)} aria-label="Frequência">
              <option value="monthly">Todo mês</option>
              <option value="weekly">Toda semana</option>
              <option value="yearly">Todo ano</option>
            </select>
          )}
        </div>
      )}
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar alterações' : repeat ? 'Criar recorrência' : 'Salvar'}</button>
    </form>
  )
}
