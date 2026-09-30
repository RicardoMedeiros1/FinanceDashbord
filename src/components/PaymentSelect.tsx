import type { Account, Card } from '../types'

export const payValue = (x: { accountId?: string; cardId?: string }) => (x.cardId ? `card:${x.cardId}` : x.accountId ? `acc:${x.accountId}` : '')

export const payIds = (v: string): { accountId?: string; cardId?: string } =>
  v.startsWith('card:') ? { cardId: v.slice(5) } : v.startsWith('acc:') ? { accountId: v.slice(4) } : {}

const REMEMBER = 'fd:lastPay:'

/** Valor inicial: o último usado (se ainda existir) ou, havendo uma única conta e nenhum cartão, essa conta. */
export function defaultPay(kind: string, accounts: Account[], cards: Card[], allowCards: boolean): string {
  const valid = new Set([...accounts.map((a) => `acc:${a.id}`), ...(allowCards ? cards.map((c) => `card:${c.id}`) : [])])
  try {
    const last = localStorage.getItem(REMEMBER + kind)
    if (last && valid.has(last)) return last
  } catch {
    /* sem storage */
  }
  return accounts.length === 1 && (!allowCards || cards.length === 0) ? `acc:${accounts[0].id}` : ''
}

export function rememberPay(kind: string, value: string) {
  try {
    localStorage.setItem(REMEMBER + kind, value)
  } catch {
    /* sem storage */
  }
}

interface Props {
  label: string
  none: string
  value: string
  onChange: (v: string) => void
  accounts: Account[]
  cards: Card[]
  allowCards?: boolean
}

/** Uma única escolha: conta (dinheiro, Pix, débito) ou cartão de crédito. */
export function PaymentSelect({ label, none, value, onChange, accounts, cards, allowCards = true }: Props) {
  const cardList = allowCards ? cards : []
  if (!accounts.length && !cardList.length) return null
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{none}</option>
        {accounts.length > 0 && (
          <optgroup label="Contas">
            {accounts.map((a) => (
              <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>
            ))}
          </optgroup>
        )}
        {cardList.length > 0 && (
          <optgroup label="Cartões de crédito">
            {cardList.map((c) => (
              <option key={c.id} value={`card:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}
