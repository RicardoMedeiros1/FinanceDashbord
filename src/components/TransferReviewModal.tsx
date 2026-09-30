import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { brl, formatDate } from '../lib'
import type { TransferMatch } from '../transfers'
import type { Account } from '../types'
import { Modal } from './Modal'

interface Props {
  matches: TransferMatch[]
  accounts: Account[]
  onConvert: (list: TransferMatch[]) => void
  onClose: () => void
}

/** Revisão dos pares encontrados: nada é convertido sem você confirmar. */
export function TransferReviewModal({ matches, accounts, onConvert, onClose }: Props) {
  const [sel, setSel] = useState(() => new Set(matches.filter((m) => m.confidence === 'high').map((m) => m.expense.id)))
  const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? '—'
  const chosen = matches.filter((m) => sel.has(m.expense.id))
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <Modal title="Transferências entre as suas contas" onClose={onClose}>
      <p className="muted small data-note">
        Estes pares têm o mesmo valor, saem de uma conta e entram em outra em até 3 dias. Transformados em transferência, eles <strong>deixam de contar como despesa e receita</strong>; o saldo das contas continua igual. Dá para desfazer no extrato da conta.
      </p>
      <ul className="list transfer-review">
        {matches.map((m) => (
          <li key={m.expense.id}>
            <label className="check">
              <input type="checkbox" checked={sel.has(m.expense.id)} onChange={() => toggle(m.expense.id)} aria-label={`Converter ${m.expense.description}`} />
              <span className="grow">
                <strong>{brl(m.expense.amount)}</strong>
                <span className="transfer-route"> {name(m.expense.accountId)} <ArrowRight size={13} /> {name(m.income.accountId)}</span>
                <span className="muted small">{formatDate(m.expense.date)} · {m.expense.description}{m.income.description !== m.expense.description ? ` → ${m.income.description}` : ''}</span>
                {m.confidence === 'low' && <span className="badge maybe">Confira: só o valor e a data batem</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="data-actions">
        <button className="btn primary" disabled={chosen.length === 0} onClick={() => onConvert(chosen)}>
          Transformar {chosen.length} {chosen.length === 1 ? 'par em transferência' : 'pares em transferências'}
        </button>
      </div>
    </Modal>
  )
}
