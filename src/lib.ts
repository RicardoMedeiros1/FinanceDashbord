import type { Cycle, Installment, Recurring, Subscription, Transaction } from './types'

export const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const brlShort = (n: number) =>
  Math.abs(n) >= 1000 ? `R$ ${(Math.round(n / 100) / 10).toFixed(1).replace('.', ',')}k` : `R$ ${Math.round(n)}`

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

const subCycle = (s: Subscription): Cycle => (s.cycle === 'monthly' ? 'monthly' : 'yearly')
const subOccurrence = (s: Subscription, n: number) => occurrence(s.billingDate, subCycle(s), n)

/** Próxima cobrança de uma assinatura, a partir de hoje (hoje conta). */
export function nextCharge(sub: Subscription, today = new Date()): Date {
  const start = toISO(today)
  for (let n = 0; n < 2000; n++) {
    const d = subOccurrence(sub, n)
    if (d >= start) return parseISO(d)
  }
  return parseISO(sub.billingDate)
}

/** Cobrança mais recente até hoje (ou null se a 1ª ainda está no futuro). */
export function lastCharge(sub: Subscription, today = toISO(new Date())): string | null {
  let last: string | null = null
  for (let n = 0; n < 2000; n++) {
    const d = subOccurrence(sub, n)
    if (d > today) break
    last = d
  }
  return last
}

const addDays = (iso: string, days: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** Ponto de partida das cobranças de uma assinatura nova: por padrão só vale de hoje em diante. */
export function initialChargedUntil(sub: Subscription, includeLast: boolean, today = toISO(new Date())) {
  const last = lastCharge(sub, today)
  return includeLast && last ? addDays(last, -1) : today
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
      txs.push({ id: `${r.id}-${n}`, description: r.description, amount: r.amount, type: r.type, category: r.category, date, ruleId: r.id, cardId: r.cardId })
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

export interface InstallmentStatus {
  paid: number // parcelas com vencimento até hoje (no dia do vencimento vira despesa)
  remaining: number
  remainingAmount: number
  total: number
  next: string | null // próximo vencimento (sempre depois de hoje)
  end: string // vencimento da última parcela
  done: boolean
}

/** Tudo é derivado das datas: as parcelas vão "sendo pagas" conforme os vencimentos passam. */
export function installmentStatus(i: Installment, today = toISO(new Date())): InstallmentStatus {
  let paid = 0
  while (paid < i.count && occurrence(i.firstDate, 'monthly', paid) <= today) paid++
  const remaining = i.count - paid
  return {
    paid,
    remaining,
    remainingAmount: remaining * i.amount,
    total: i.count * i.amount,
    next: remaining > 0 ? occurrence(i.firstDate, 'monthly', paid) : null,
    end: occurrence(i.firstDate, 'monthly', i.count - 1),
    done: remaining === 0,
  }
}

/** A despesa de uma parcela. O id é determinístico: nunca há duas despesas da mesma parcela. */
export function installmentTx(i: Installment, k: number): Transaction {
  return {
    id: `${i.id}-p${k}`,
    description: `${i.name} (${k + 1}/${i.count})`,
    amount: i.amount,
    type: 'expense',
    category: i.category ?? 'compras',
    date: occurrence(i.firstDate, 'monthly', k),
    ruleId: i.id,
    cardId: i.cardId,
  }
}

/** Parcelas já pagas (vencidas) que não têm despesa lançada, por exemplo as anteriores ao app ou apagadas. */
export function missingInstallmentTxs(i: Installment, existingIds: Set<string>, today = toISO(new Date())): Transaction[] {
  const paid = installmentStatus(i, today).paid
  const out: Transaction[] = []
  for (let k = 0; k < paid; k++) if (!existingIds.has(`${i.id}-p${k}`)) out.push(installmentTx(i, k))
  return out
}

/**
 * Transforma em despesa cada parcela que venceu (até hoje), até a última.
 * Os ids são determinísticos (`parcelamento-pN`), então rodar de novo não duplica,
 * e o contador `generated` evita recriar uma despesa que você apagou.
 * Parcelamentos antigos, sem contador, começam de agora (não mexem no histórico).
 */
export function applyInstallments(items: Installment[], today = toISO(new Date())) {
  const txs: Transaction[] = []
  let changed = false
  const next = items.map((i) => {
    if (i.generated === undefined) {
      changed = true
      return { ...i, generated: installmentStatus(i, today).paid }
    }
    let n = i.generated
    while (n < i.count) {
      const date = occurrence(i.firstDate, 'monthly', n)
      if (date > today) break
      txs.push(installmentTx(i, n))
      n++
    }
    if (n === i.generated) return i
    changed = true
    return { ...i, generated: n }
  })
  return changed ? { items: next, txs } : null
}

/**
 * Transforma em despesa cada cobrança de assinatura que chegou (até hoje).
 * `chargedUntil` marca até onde já foi processado: não recria despesa apagada, não volta no tempo
 * e uma assinatura pausada não acumula cobranças para lançar quando for reativada.
 * Assinaturas antigas, sem esse campo, começam de ontem (só valem de agora em diante).
 */
export function applySubscriptions(subs: Subscription[], today = toISO(new Date())) {
  const txs: Transaction[] = []
  let changed = false
  const next = subs.map((s) => {
    if (s.chargedUntil === undefined) {
      changed = true
      return { ...s, chargedUntil: addDays(today, -1) }
    }
    if (s.active) {
      for (let n = 0; n < 2000; n++) {
        const date = subOccurrence(s, n)
        if (date > today) break
        if (date <= s.chargedUntil) continue
        txs.push({ id: `${s.id}-c${date}`, description: s.name, amount: s.price, type: 'expense', category: s.category ?? 'assinaturas', date, ruleId: s.id, cardId: s.cardId })
      }
    }
    if (s.chargedUntil >= today) return s
    changed = true
    return { ...s, chargedUntil: today }
  })
  return changed ? { items: next, txs } : null
}
