import type { Subscription, Transaction } from './types'

export const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const brlShort = (n: number) =>
  Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toFixed(1).replace('.', ',')}k` : `R$ ${Math.round(n)}`

export const uid = () => Math.random().toString(36).slice(2, 10)

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export const shiftMonth = (d: Date, delta: number) =>
  new Date(d.getFullYear(), d.getMonth() + delta, 1)

export const monthLabel = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

export const monthLong = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const formatDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

export const inMonth = (t: Transaction, key: string) => t.date.startsWith(key)

export const sumBy = (list: Transaction[], type: 'income' | 'expense') =>
  list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)

/** Próxima cobrança de uma assinatura, a partir de hoje. */
export function nextCharge(sub: Subscription, today = new Date()): Date {
  const base = parseISO(sub.billingDate)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const d = new Date(base)
  const step = sub.cycle === 'monthly' ? 1 : 12
  let guard = 0
  while (d < start && guard++ < 600) {
    d.setMonth(d.getMonth() + step)
  }
  return d
}

export const daysUntil = (d: Date, today = new Date()) => {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((d.getTime() - start.getTime()) / 86400000)
}

export const monthlyCost = (s: Subscription) => (s.cycle === 'monthly' ? s.price : s.price / 12)
