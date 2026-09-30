import { toISO } from './lib'
import type { Account, AccountKind, Transaction, Transfer } from './types'

export const KIND_LABEL: Record<AccountKind, string> = {
  checking: 'Conta corrente',
  cash: 'Carteira / dinheiro',
  savings: 'Poupança / reserva',
  other: 'Outra',
}

export interface Movement {
  id: string
  date: string
  label: string
  amount: number // com sinal: positivo entra, negativo sai
  kind: 'income' | 'expense' | 'transfer-in' | 'transfer-out' | 'invoice'
}

/**
 * Movimentos da conta desde a data inicial, até hoje.
 * Despesas no cartão não mexem no saldo: só o pagamento da fatura (uma "transferência" com kind 'invoice').
 */
export function accountMovements(acc: Account, txs: Transaction[], transfers: Transfer[], accounts: Account[], today = toISO(new Date())): Movement[] {
  const inRange = (d: string) => d >= acc.openingDate && d <= today
  const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? 'outra conta'
  const out: Movement[] = []
  for (const t of txs) {
    if (t.accountId !== acc.id || t.cardId || !inRange(t.date)) continue
    out.push({ id: t.id, date: t.date, label: t.description, amount: t.type === 'income' ? t.amount : -t.amount, kind: t.type })
  }
  for (const tr of transfers) {
    if (!inRange(tr.date)) continue
    if (tr.from === acc.id) {
      out.push({ id: tr.id, date: tr.date, label: tr.kind === 'invoice' ? tr.note || 'Pagamento de fatura' : `Transferência para ${name(tr.to)}`, amount: -tr.amount, kind: tr.kind === 'invoice' ? 'invoice' : 'transfer-out' })
    }
    if (tr.to === acc.id) out.push({ id: `${tr.id}-in`, date: tr.date, label: `Transferência de ${name(tr.from)}`, amount: tr.amount, kind: 'transfer-in' })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export function accountBalance(acc: Account, txs: Transaction[], transfers: Transfer[], accounts: Account[], today = toISO(new Date())): number {
  return acc.openingBalance + accountMovements(acc, txs, transfers, accounts, today).reduce((s, m) => s + m.amount, 0)
}

export const totalBalance = (accounts: Account[], txs: Transaction[], transfers: Transfer[], today = toISO(new Date())) =>
  accounts.reduce((s, a) => s + accountBalance(a, txs, transfers, accounts, today), 0)
