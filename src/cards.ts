import { parseISO, toISO } from './lib'
import type { Card, Transaction } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate()
const keyOf = (y: number, m0: number) => `${new Date(y, m0, 1).getFullYear()}-${pad(new Date(y, m0, 1).getMonth() + 1)}`

const dateIn = (y: number, m0: number, day: number) => {
  const d = new Date(y, m0, Math.min(day, daysIn(new Date(y, m0, 1).getFullYear(), new Date(y, m0, 1).getMonth())))
  return toISO(d)
}

const parseKey = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return { y, m0: m - 1 }
}

export const shiftKey = (key: string, delta: number) => {
  const { y, m0 } = parseKey(key)
  return keyOf(y, m0 + delta)
}

/** Datas de uma fatura: fechamento no mês da chave; vencimento no primeiro dia de vencimento depois do fechamento. */
export function invoiceDates(card: Card, key: string) {
  const { y, m0 } = parseKey(key)
  const closing = dateIn(y, m0, card.closingDay)
  const sameMonth = dateIn(y, m0, card.dueDay)
  const due = sameMonth > closing ? sameMonth : dateIn(y, m0 + 1, card.dueDay)
  return { closing, due }
}

/** Compras até o dia do fechamento (inclusive) entram na fatura que fecha naquele mês; depois, na seguinte. */
export function invoiceKeyForDate(card: Card, iso: string): string {
  const d = parseISO(iso)
  const key = keyOf(d.getFullYear(), d.getMonth())
  return iso <= invoiceDates(card, key).closing ? key : shiftKey(key, 1)
}

export type InvoiceStatus = 'paid' | 'open' | 'closed' | 'overdue' | 'future'

export interface Invoice {
  key: string
  closing: string
  due: string
  status: InvoiceStatus
  total: number
  txs: Transaction[]
}

export function invoiceStatus(card: Card, key: string, today: string): InvoiceStatus {
  const { closing, due } = invoiceDates(card, key)
  if (card.paid?.includes(key)) return 'paid'
  const prevClosing = invoiceDates(card, shiftKey(key, -1)).closing
  if (today <= prevClosing) return 'future'
  if (today <= closing) return 'open'
  return today <= due ? 'closed' : 'overdue'
}

/** Faturas do cartão: as que têm compras + a atual + a anterior + as duas próximas, da mais recente para a mais antiga. */
export function cardInvoices(card: Card, txs: Transaction[], today = toISO(new Date())): Invoice[] {
  const mine = txs.filter((t) => t.cardId === card.id && t.type === 'expense')
  const byKey = new Map<string, Transaction[]>()
  for (const t of mine) {
    const k = invoiceKeyForDate(card, t.date)
    byKey.set(k, [...(byKey.get(k) ?? []), t])
  }
  const current = invoiceKeyForDate(card, today)
  for (const k of [shiftKey(current, -1), current, shiftKey(current, 1), shiftKey(current, 2)]) if (!byKey.has(k)) byKey.set(k, [])
  return [...byKey.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({
      key,
      ...invoiceDates(card, key),
      status: invoiceStatus(card, key, today),
      total: list.reduce((s, t) => s + t.amount, 0),
      txs: [...list].sort((a, b) => b.date.localeCompare(a.date)),
    }))
}

export interface CardSummary {
  open: Invoice // fatura em aberto (a que recebe as compras de hoje)
  closed: Invoice | null // fechada e ainda por vencer (a pagar)
  used: number // limite comprometido: faturas ainda não pagas e não vencidas
  bestDay: number // melhor dia de compra: o dia seguinte ao fechamento
  daysToClose: number
}

export function cardSummary(card: Card, txs: Transaction[], today = toISO(new Date())): CardSummary {
  const invoices = cardInvoices(card, txs, today)
  const open = invoices.find((i) => i.status === 'open')!
  const closed = invoices.find((i) => i.status === 'closed') ?? null
  const used = invoices.filter((i) => i.status === 'open' || i.status === 'closed' || i.status === 'future').reduce((s, i) => s + i.total, 0)
  const nextDay = parseISO(open.closing)
  nextDay.setDate(nextDay.getDate() + 1)
  const daysToClose = Math.round((parseISO(open.closing).getTime() - parseISO(today).getTime()) / 86400000)
  return { open, closed, used, bestDay: nextDay.getDate(), daysToClose }
}

/** Próximo pagamento do cartão: a fatura fechada a pagar, ou a aberta. */
export function nextInvoiceToPay(card: Card, txs: Transaction[], today = toISO(new Date())): Invoice {
  const s = cardSummary(card, txs, today)
  return s.closed ?? s.open
}
