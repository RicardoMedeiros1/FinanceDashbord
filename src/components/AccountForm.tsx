import { useState } from 'react'
import { KIND_LABEL } from '../accounts'
import { toISO } from '../lib'
import type { Account, AccountKind } from '../types'

const COLORS = ['#3b6ef5', '#3ecf6e', '#e0600f', '#8b3ff5', '#f472b6', '#22d3ee', '#e84a45', '#94a3b8']

interface Props {
  initial?: Account
  onSave: (a: Omit<Account, 'id'>) => void
}

export function AccountForm({ initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? 'checking')
  const [balance, setBalance] = useState(initial ? String(initial.openingBalance).replace('.', ',') : '')
  const [date, setDate] = useState(initial?.openingDate ?? toISO(new Date()))
  const [color, setColor] = useState(initial?.color ?? COLORS[0])

  const value = balance.trim() === '' ? 0 : Number(balance.replace(',', '.'))
  const valid = name.trim() && Number.isFinite(value) && date

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), kind, openingBalance: value, openingDate: date, color })
      }}
    >
      <label>
        Nome da conta
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Carteira, Poupança" autoFocus />
      </label>
      <label>
        Tipo
        <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {(Object.keys(KIND_LABEL) as AccountKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <label>
          Saldo nessa data (R$)
          <input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </label>
        <label>
          Data do saldo
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="swatches">
        {COLORS.map((c) => (
          <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />
        ))}
      </div>
      <p className="muted small hint">
        Informe o saldo real que a conta tinha na data escolhida (olhe no app do banco). A partir dela, as receitas e despesas ligadas à conta e as transferências ajustam o saldo. Lançamentos anteriores a essa data não entram.
      </p>
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar alterações' : 'Adicionar conta'}</button>
    </form>
  )
}
