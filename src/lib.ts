import type { Cycle, Recurring, Subscription, Transaction } from './types'

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

export const CYCLE_LABEL: Record<Cycle, string> = { weekly: 'Toda semana', monthly: 'Todo mês', yearly: 'Todo ano' }

/** Data da n-ésima ocorrência (n=0 é a âncora). Dia 31 vira o último dia dos meses menores. */
export function occurrence(anchor: string, cycle: Cycle, n: number): string {
  const a = parseISO(anchor)
  if (cycle === 'weekly') {
    const d = new Date(a)
    d.setDate(a.getDate() + 7 * n)
    return toISO(d)
  }
  const first = new Date(a.getFullYear(), a.getMonth() + (cycle === 'monthly' ? n : 12 * n), 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(a.getDate(), last)))
}

export const nextOccurrence = (r: Recurring) => occurrence(r.anchor, r.cycle, r.generated)

/**
 * Gera os lançamentos das ocorrências que já venceram (até hoje).
 * Os ids são determinísticos (`regra-n`), então rodar duas vezes não duplica.
 * Retorna null quando não há nada a gerar.
 */
export function applyRecurring(rules: Recurring[], today = toISO(new Date())) {
  const txs: Transaction[] = []
  let changed = false
  const next = rules.map((r) => {
    if (!r.active) return r
    let n = r.generated
    for (let guard = 0; guard < 1000; guard++) {
      const date = occurrence(r.anchor, r.cycle, n)
      if (date > today) break
      txs.push({ id: `${r.id}-${n}`, description: r.description, amount: r.amount, type: r.type, category: r.category, date, ruleId: r.id })
      n++
    }
    if (n === r.generated) return r
    changed = true
    return { ...r, generated: n }
  })
  return changed ? { rules: next, txs } : null
}

/** Ao reativar uma regra pausada, pula as ocorrências perdidas em vez de lançá-las de uma vez. */
export function skipToToday(r: Recurring, today = toISO(new Date())): Recurring {
  let n = r.generated
  for (let guard = 0; guard < 1000 && occurrence(r.anchor, r.cycle, n) < today; guard++) n++
  return { ...r, generated: n }
}
