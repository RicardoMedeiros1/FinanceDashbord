import { useState } from 'react'
import { toISO } from '../lib'
import type { Account, Transfer } from '../types'

interface Props {
  accounts: Account[]
  onSave: (t: Omit<Transfer, 'id' | 'kind'>) => void
}

export function TransferForm({ accounts, onSave }: Props) {
  const [from, setFrom] = useState(accounts[0]?.id ?? '')
  const [to, setTo] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toISO(new Date()))
  const [note, setNote] = useState('')

  const value = Number(amount.replace(',', '.'))
  const valid = from && to && from !== to && value > 0 && date

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ from, to, amount: value, date, note: note.trim() })
      }}
    >
      <div className="row">
        <label>
          De
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label>
          Para
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Valor (R$)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus />
        </label>
        <label>
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label>
        Observação (opcional)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: guardar para a viagem" />
      </label>
      {from === to && <p className="bad-text small">Escolha contas diferentes.</p>}
      <p className="muted small hint">Transferir não é despesa nem receita: o dinheiro só muda de conta.</p>
      <button className="btn primary" disabled={!valid}>Transferir</button>
    </form>
  )
}
