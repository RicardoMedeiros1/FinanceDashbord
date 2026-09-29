import { useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../categories'
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
  const [category, setCategory] = useState<CategoryId>(initial && initial.type === 'expense' ? initial.category : 'alimentacao')
  const [incomeCat, setIncomeCat] = useState<CategoryId>(initial && initial.type === 'income' ? initial.category : (startRepeating ? 'salario' : 'variavel'))
  const [date, setDate] = useState(initial?.date ?? toISO(new Date()))
  const [repeat, setRepeat] = useState(startRepeating ?? false)
  const [repeatTouched, setRepeatTouched] = useState(false)
  const [cycle, setCycle] = useState<Cycle>('monthly')

  // salário fixo costuma se repetir todo mês: já sugere repetir, até você mexer na caixa
  const repeating = repeatTouched ? repeat : repeat || (!initial && type === 'income' && incomeCat === 'salario')
  const value = Number(amount.replace(',', '.'))
  const valid = description.trim() && value > 0 && date

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave(
          { description: description.trim(), amount: value, type, category: type === 'income' ? incomeCat : category, date },
          repeating && !initial ? cycle : null,
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
          {repeating && !initial ? 'Primeira data' : 'Data'}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {type === 'income' && (
        <>
          <label>
            Tipo de receita
            <select value={incomeCat} onChange={(e) => setIncomeCat(e.target.value as CategoryId)}>
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORIES[c].label}</option>
              ))}
            </select>
          </label>
          <p className="muted small hint">
            {incomeCat === 'salario'
              ? 'Salário fixo: cadastre uma vez com repetição mensal, no dia em que cai na conta.'
              : incomeCat === 'variavel'
                ? 'Renda variável: lance cada recebimento com o valor real (ex.: o repasse do Uber).'
                : 'Qualquer outra entrada de dinheiro.'}
          </p>
        </>
      )}
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
            <input type="checkbox" checked={repeating} onChange={(e) => { setRepeat(e.target.checked); setRepeatTouched(true) }} />
            Repetir automaticamente
          </label>
          {repeating && (
            <select value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)} aria-label="Frequência">
              <option value="monthly">Todo mês</option>
              <option value="weekly">Toda semana</option>
              <option value="yearly">Todo ano</option>
            </select>
          )}
        </div>
      )}
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar alterações' : repeating ? 'Criar recorrência' : 'Salvar'}</button>
    </form>
  )
}
