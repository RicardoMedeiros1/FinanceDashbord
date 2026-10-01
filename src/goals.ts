// Metas com prazo: quanto falta, quantos meses restam, quanto guardar por mês (sem render e rendendo) e se está no ritmo.
import { buildProducts, DEFAULT_PARAMS, DEFAULT_RATES, simulate, type ProductParams, type Rates } from './invest'
import { parseISO, toISO } from './lib'
import type { Goal } from './types'

export type GoalStatus = 'done' | 'overdue' | 'no-deadline' | 'on-track' | 'behind'

export interface GoalPlan {
  missing: number
  monthsLeft: number | null // meses inteiros até o prazo (arredondado para cima); null se não há prazo
  perMonth: number | null // guardando sem render
  perMonthInvested: number | null // se o dinheiro rendesse como o Tesouro Selic (estimativa líquida de imposto)
  status: GoalStatus
  behind: number // quanto falta para o ritmo esperado (só quando está atrasada)
}

/** Meses de `from` até `to`, contando o mês incompleto como um mês inteiro; 0 se o prazo já passou. */
export function monthsBetween(from: string, to: string): number {
  const a = parseISO(from)
  const b = parseISO(to)
  if (b <= a) return 0
  const addMonths = (d: Date, n: number) => {
    const first = new Date(d.getFullYear(), d.getMonth() + n, 1)
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last)) // dia 31 em mês curto vira o último dia
  }
  let n = 0
  while (addMonths(a, n) < b && n < 1200) n++
  return n
}

/** Menor aporte mensal que, rendendo como o produto, chega à meta no prazo (busca binária sobre a simulação). */
export function monthlyToReach(target: number, saved: number, months: number, rates: Rates, params: ProductParams): number {
  if (months <= 0 || saved >= target) return 0
  const prod = buildProducts(rates, params).find((p) => p.id === 'tesouro_selic')!
  const net = (c: number) => simulate(prod, { initial: saved, monthly: c, months }, rates.ipca).net
  if (net(0) >= target) return 0
  let lo = 0
  let hi = (target - saved) / months // sem render seria isso; rendendo, basta menos
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (net(mid) >= target) hi = mid
    else lo = mid
  }
  return hi
}

export function goalPlan(g: Goal, today = toISO(new Date()), rates: Rates = DEFAULT_RATES, params: ProductParams = DEFAULT_PARAMS): GoalPlan {
  const missing = Math.max(0, g.target - g.saved)
  if (missing === 0) return { missing, monthsLeft: g.deadline ? monthsBetween(today, g.deadline) : null, perMonth: 0, perMonthInvested: 0, status: 'done', behind: 0 }
  if (!g.deadline) return { missing, monthsLeft: null, perMonth: null, perMonthInvested: null, status: 'no-deadline', behind: 0 }
  const monthsLeft = monthsBetween(today, g.deadline)
  if (monthsLeft === 0) return { missing, monthsLeft, perMonth: null, perMonthInvested: null, status: 'overdue', behind: missing }
  const capped = Math.min(monthsLeft, 360)
  const perMonth = missing / monthsLeft
  const perMonthInvested = monthlyToReach(g.target, g.saved, capped, rates, params)
  // ritmo: o esperado hoje, em linha reta entre a criação e o prazo
  let status: GoalStatus = 'on-track'
  let behind = 0
  if (g.createdAt && g.createdAt < g.deadline) {
    const total = parseISO(g.deadline).getTime() - parseISO(g.createdAt).getTime()
    const elapsed = Math.min(total, Math.max(0, parseISO(today).getTime() - parseISO(g.createdAt).getTime()))
    const expected = g.target * (elapsed / total)
    behind = Math.max(0, expected - g.saved)
    if (behind > g.target * 0.05) status = 'behind'
    else behind = 0
  }
  return { missing, monthsLeft, perMonth, perMonthInvested, status, behind }
}
