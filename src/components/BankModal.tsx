import { Landmark, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { defaultSince, isItemId, type Plan } from '../openfinance'
import { brl, formatDate } from '../lib'
import type { Account, BankLink, Card, Transaction } from '../types'
import { Modal } from './Modal'

export interface BankState {
  busy: boolean
  error: string
  result: Plan | null
}

interface Props {
  links: BankLink[]
  accounts: Account[]
  cards: Card[]
  state: BankState
  onAdd: (link: { id: string; label: string; since: string }) => void
  onRemove: (id: string) => void
  onSync: () => void
  onImportSkipped: (tx: Transaction) => void
  onClose: () => void
}

const STATUS_OK = new Set(['UPDATED', 'UPDATING'])
const REASON = {
  maybe: 'Parece igual a um lançamento seu (mesma data e valor).',
  invoice: 'Pagamento de fatura: registre em Cartões → Pagar fatura (o saldo da conta só fecha depois disso).',
}
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'ainda não sincronizou')

/** Conexão com bancos via Open Finance (Meu Pluggy): adicionar, sincronizar e ver o que entrou. */
export function BankModal({ links, accounts, cards, state, onAdd, onRemove, onSync, onImportSkipped, onClose }: Props) {
  const [label, setLabel] = useState('')
  const [itemId, setItemId] = useState('')
  const [since, setSince] = useState(defaultSince())
  const id = itemId.trim()
  const dup = links.some((l) => l.id.toLowerCase() === id.toLowerCase())
  const idProblem = id && !isItemId(id) ? 'O Item ID é uma sequência como 3fa85f64-5717-4562-b3fc-2c963f66afa6.' : dup ? 'Essa conexão já foi adicionada.' : ''
  const valid = label.trim() && isItemId(id) && !dup && since
  const nameOf = (m: BankLink['map'][string]) => (m.kind === 'account' ? accounts.find((a) => a.id === m.id)?.name : m.kind === 'card' ? cards.find((c) => c.id === m.id)?.name : undefined)
  const r = state.result

  return (
    <Modal title="Bancos (Open Finance)" onClose={onClose}>
      <p className="muted small data-note">
        Traz contas, cartões e transações direto do banco, pelo Open Finance, usando o Meu Pluggy. Você autoriza no próprio banco e pode revogar quando quiser.{' '}
        <a className="link small" href="https://github.com/RicardoMedeiros1/FinanceDashbord/blob/HEAD/docs/OPEN_FINANCE.md" target="_blank" rel="noreferrer">Como configurar</a>
      </p>

      {links.length > 0 && (
        <ul className="list bank-list">
          {links.map((l) => {
            const mapped = Object.entries(l.map).filter(([, m]) => m.kind !== 'ignore')
            return (
              <li key={l.id}>
                <span className="logo"><Landmark size={16} /></span>
                <div className="grow">
                  <strong>{l.label}</strong>
                  <span className="muted small">
                    {l.status && !STATUS_OK.has(l.status) ? <span className="badge maybe">Precisa de atenção ({l.status})</span> : null} Última sincronização: {when(l.lastSync)}
                  </span>
                  {mapped.map(([pid, m]) => (
                    <span key={pid} className="muted small">
                      {m.kind === 'card' ? 'Cartão' : 'Conta'} {nameOf(m) ?? '—'}
                      {l.balances?.[pid] !== undefined ? ` · saldo no banco ${brl(l.balances[pid])}` : ''}
                    </span>
                  ))}
                </div>
                <button className="icon-btn" aria-label={`Remover ${l.label}`} onClick={() => { if (confirm(`Remover a conexão “${l.label}”? Os lançamentos, contas e cartões já importados continuam no app.`)) onRemove(l.id) }}>
                  <Trash2 size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {links.length > 0 && (
        <div className="data-actions">
          <button className="btn primary" onClick={onSync} disabled={state.busy}><RefreshCw size={16} /> {state.busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>
        </div>
      )}
      {state.error && <p className="bad-text small" role="alert">{state.error}</p>}

      {r && (
        <div className="bank-result" role="status">
          <strong>
            {r.stats.added === 0 ? 'Nada novo para importar.' : `${r.stats.added} ${r.stats.added === 1 ? 'lançamento novo' : 'lançamentos novos'}.`}
          </strong>
          <span className="muted small">
            {r.stats.known > 0 ? `${r.stats.known} já estavam no app. ` : ''}
            {r.accounts.length > 0 ? `${r.accounts.length} ${r.accounts.length === 1 ? 'conta criada' : 'contas criadas'}. ` : ''}
            {r.cards.length > 0 ? `${r.cards.length} ${r.cards.length === 1 ? 'cartão criado' : 'cartões criados'}. ` : ''}
            {r.stats.linked > 0 ? `${r.stats.linked} lançamentos seus foram ligados à conta/cartão do banco. ` : ''}
            {r.stats.ignored > 0 ? `Pagamentos/estornos de fatura ignorados: ${r.stats.ignored}.` : ''}
          </span>
          {r.warnings.map((w) => <span key={w} className="bad-text small">{w}</span>)}
          {r.skipped.length > 0 && (
            <>
              <span className="muted small">Não importados ({r.skipped.length}):</span>
              <ul className="list compact">
                {r.skipped.map((s) => (
                  <li key={s.tx.id}>
                    <div className="grow">
                      <strong>{s.tx.description}</strong>
                      <span className="muted small">{formatDate(s.tx.date)} · {s.tx.type === 'income' ? '+' : '−'} {brl(s.tx.amount)} · {REASON[s.reason]}</span>
                    </div>
                    <button className="pill-btn" onClick={() => onImportSkipped(s.tx)}>Importar mesmo assim</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <form
        className="form bank-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          onAdd({ id, label: label.trim(), since })
          setLabel('')
          setItemId('')
        }}
      >
        <h4>{links.length ? 'Conectar outro banco' : 'Conectar um banco'}</h4>
        <label>
          Nome do banco
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Meu banco" />
        </label>
        <label>
          Item ID da conexão (Pluggy)
          <input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
        {idProblem && <p className="bad-text small">{idProblem}</p>}
        <label>
          Importar histórico desde
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!valid || state.busy}>Conectar e importar</button>
      </form>
    </Modal>
  )
}
