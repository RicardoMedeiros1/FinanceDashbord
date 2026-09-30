import { useState } from 'react'
import { brl, formatDate } from '../lib'
import type { Account, Transaction } from '../types'
import { Modal } from './Modal'

interface Props {
  tx: Transaction
  accounts: Account[]
  onSave: (from: string, to: string) => void
  onClose: () => void
}

/** Um lançamento só vira transferência; o outro lado pode estar numa conta que não está no app. */
export function MarkTransferModal({ tx, accounts, onSave, onClose }: Props) {
  const out = tx.type === 'expense'
  const [from, setFrom] = useState(out ? tx.accountId ?? '' : '')
  const [to, setTo] = useState(out ? '' : tx.accountId ?? '')
  const valid = (from || to) && from !== to

  return (
    <Modal title="Marcar como transferência" onClose={onClose}>
      <p className="muted small data-note">
        “{tx.description}” · {formatDate(tx.date)} · {brl(tx.amount)}. Como transferência, deixa de contar como {out ? 'despesa' : 'receita'}; só mexe no saldo das contas.
      </p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(from, to) }}>
        <div className="row">
          <label>
            De
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Fora do app</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>
            Para
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Fora do app</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">“Fora do app” é uma conta sua que você não cadastrou aqui (ex.: investimentos, outro banco).</p>
        <button className="btn primary" disabled={!valid}>Marcar como transferência</button>
      </form>
    </Modal>
  )
}
