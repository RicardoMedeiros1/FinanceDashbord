// Reserva de emergência: quanto seria ideal guardar e quanto falta, a partir do que o app já sabe.
import { accountBalance } from './accounts'
import { monthKey, shiftMonth, toISO } from './lib'
import type { Account, CategoryId, Transaction, Transfer } from './types'

/** Gastos que não dá para cortar de um dia para o outro. */
export const ESSENTIAL: CategoryId[] = ['moradia', 'alimentacao', 'transporte', 'saude', 'educacao', 'trabalho']

export interface ReserveSettings {
  months: number // quantos meses de despesa guardar (3 a 12)
  essentialOnly: boolean
  accountIds?: string[] // contas que contam como reserva; vazio = as de tipo poupança/reserva
  extra: number // valor guardado fora do app (investimentos, dinheiro em casa...)
}
export const DEFAULT_RESERVE: ReserveSettings = { months: 6, essentialOnly: false, extra: 0 }

export interface Base {
  monthlyExpense: number // despesa média por mês
  surplus: number // sobra média por mês (receitas − despesas totais)
  monthsUsed: number // quantos meses fechados entraram na média (0 = só o mês atual, ainda incompleto)
}

/** Média dos últimos 3 meses fechados que têm lançamentos; sem histórico, usa o mês atual até hoje. */
export function monthlyBase(txs: Transaction[], essentialOnly: boolean, today = toISO(new Date())): Base {
  const now = new Date(`${today}T12:00:00`)
  const keys = [1, 2, 3].map((n) => monthKey(shiftMonth(now, -n)))
  const sum = (list: Transaction[], type: 'expense' | 'income', onlyEssential = false) =>
    list.filter((t) => t.type === type && (!onlyEssential || ESSENTIAL.includes(t.category))).reduce((s, t) => s + t.amount, 0)
  const withData = keys.filter((k) => txs.some((t) => t.date.startsWith(k)))
  if (withData.length === 0) {
    const cur = txs.filter((t) => t.date.startsWith(monthKey(now)) && t.date <= today)
    return { monthlyExpense: sum(cur, 'expense', essentialOnly), surplus: sum(cur, 'income') - sum(cur, 'expense'), monthsUsed: 0 }
  }
  const exp = withData.reduce((s, k) => s + sum(txs.filter((t) => t.date.startsWith(k)), 'expense', essentialOnly), 0)
  const net = withData.reduce((s, k) => s + sum(txs.filter((t) => t.date.startsWith(k)), 'income') - sum(txs.filter((t) => t.date.startsWith(k)), 'expense'), 0)
  return { monthlyExpense: exp / withData.length, surplus: net / withData.length, monthsUsed: withData.length }
}

export interface ReserveStatus extends Base {
  target: number
  saved: number
  missing: number
  progress: number // 0 a 1
  done: boolean
  monthsToGoal: number | null // com a sobra média de hoje; null se não sobra
  perMonthIn: (months: number) => number // quanto guardar por mês para chegar em N meses
  covered: number // quantos meses de despesa o valor guardado cobre
}

export function reserveStatus(s: ReserveSettings, txs: Transaction[], accounts: Account[], transfers: Transfer[], today = toISO(new Date())): ReserveStatus {
  const base = monthlyBase(txs, s.essentialOnly, today)
  const ids = s.accountIds ?? accounts.filter((a) => a.kind === 'savings').map((a) => a.id)
  const fromAccounts = accounts.filter((a) => ids.includes(a.id)).reduce((sum, a) => sum + accountBalance(a, txs, transfers, accounts, today), 0)
  const saved = Math.max(0, fromAccounts) + Math.max(0, s.extra || 0)
  const target = base.monthlyExpense * s.months
  const missing = Math.max(0, target - saved)
  return {
    ...base,
    target,
    saved,
    missing,
    progress: target > 0 ? Math.min(1, saved / target) : 0,
    done: target > 0 && saved >= target,
    monthsToGoal: missing === 0 ? 0 : base.surplus > 0 ? Math.ceil(missing / base.surplus) : null,
    perMonthIn: (m) => (m > 0 ? missing / m : 0),
    covered: base.monthlyExpense > 0 ? saved / base.monthlyExpense : 0,
  }
}
