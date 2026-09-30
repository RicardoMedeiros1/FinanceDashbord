import { ArrowLeftRight, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { accountBalance, accountMovements, KIND_LABEL, totalBalance } from '../accounts'
import { brl, formatDate } from '../lib'
import type { Account, Transaction, Transfer } from '../types'
import { AccountForm } from './AccountForm'
import { Modal } from './Modal'
import { Money } from './Money'
import { TransferForm } from './TransferForm'

interface Props {
  accounts: Account[]
  txs: Transaction[]
  transfers: Transfer[]
  onSave: (a: Omit<Account, 'id'>, id?: string) => void
  onDelete: (id: string) => void
  onTransfer: (t: Omit<Transfer, 'id' | 'kind'>) => void
  onDeleteTransfer: (id: string) => void
}

export function AccountsTab({ accounts, txs, transfers, onSave, onDelete, onTransfer, onDeleteTransfer }: Props) {
  const [form, setForm] = useState<{ item?: Account } | null>(null)
  const [transfer, setTransfer] = useState(false)
  const [statement, setStatement] = useState<string | null>(null)
  const total = totalBalance(accounts, txs, transfers)
  const stAcc = accounts.find((a) => a.id === statement)

  return (
    <>
      <div className="section-head">
        <h3>Suas contas</h3>
        <div className="head-actions">
          {accounts.length >= 2 && (
            <button className="btn" onClick={() => setTransfer(true)}><ArrowLeftRight size={16} /> Transferir</button>
          )}
          <button className="btn primary" onClick={() => setForm({})}><Plus size={16} /> Nova conta</button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card empty-rules muted">
          Cadastre suas contas (corrente, carteira, poupança) com o saldo de hoje. Ao lançar receitas e despesas, escolha a conta e o app mantém o saldo real de cada uma. O pagamento da fatura do cartão também sai de uma conta.
        </div>
      ) : (
        <>
          <div className="card stat">
            <span className="muted">Saldo total nas contas</span>
            <div className="stat-value"><Money value={total} /></div>
          </div>
          <div className="grid cardgrid">
            {accounts.map((a) => {
              const bal = accountBalance(a, txs, transfers, accounts)
              return (
                <div key={a.id} className="card cc" style={{ '--c': a.color } as React.CSSProperties}>
                  <div className="sub-top">
                    <span className="logo lg" style={{ background: a.color }}><Landmark size={18} /></span>
                    <div className="grow">
                      <strong>{a.name}</strong>
                      <span className="muted small">{KIND_LABEL[a.kind]}</span>
                    </div>
                    <button className="icon-btn" onClick={() => setForm({ item: a })} aria-label={`Editar conta ${a.name}`}><Pencil size={15} /></button>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        if (confirm(`Excluir a conta “${a.name}”? Os lançamentos continuam, mas deixam de estar ligados a ela, e as transferências dela são removidas.`)) onDelete(a.id)
                      }}
                      aria-label={`Excluir conta ${a.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div>
                    <span className="muted small">Saldo atual</span>
                    <div className={`sub-price ${bal < 0 ? 'bad-text' : ''}`}><Money value={bal} /></div>
                    <span className="muted small">saldo de {brl(a.openingBalance)} em {formatDate(a.openingDate)}</span>
                  </div>
                  <button className="pill-btn details-btn" onClick={() => setStatement(a.id)}>Extrato</button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {form && (
        <Modal title={form.item ? 'Editar conta' : 'Nova conta'} onClose={() => setForm(null)}>
          <AccountForm initial={form.item} onSave={(a) => { onSave(a, form.item?.id); setForm(null) }} />
        </Modal>
      )}
      {transfer && (
        <Modal title="Transferir entre contas" onClose={() => setTransfer(false)}>
          <TransferForm accounts={accounts} onSave={(t) => { onTransfer(t); setTransfer(false) }} />
        </Modal>
      )}
      {stAcc && (
        <Modal title={`Extrato — ${stAcc.name}`} onClose={() => setStatement(null)}>
          <ul className="list compact statement">
            {accountMovements(stAcc, txs, transfers, accounts).map((m) => (
              <li key={m.id}>
                <div className="grow">
                  <strong>{m.label}</strong>
                  <span className="muted small">{formatDate(m.date)}</span>
                </div>
                <strong className={m.amount >= 0 ? 'pos' : ''}>{m.amount >= 0 ? '+' : '−'} {brl(Math.abs(m.amount))}</strong>
                {(m.kind === 'transfer-in' || m.kind === 'transfer-out') && (
                  <button className="icon-btn" onClick={() => onDeleteTransfer(m.id.replace(/-in$/, ''))} aria-label={`Desfazer ${m.label}`}><Trash2 size={14} /></button>
                )}
              </li>
            ))}
            {accountMovements(stAcc, txs, transfers, accounts).length === 0 && <li className="muted">Nenhuma movimentação desde {formatDate(stAcc.openingDate)}.</li>}
          </ul>
        </Modal>
      )}
    </>
  )
}
