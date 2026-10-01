// Relatório mensal: junta os números do mês num só lugar (tudo local). Funções puras.
import { groupLimits, rankMerchants, type GroupLimit, type Merchant } from './spending'
import { spendByCategory } from './insights'
import { inMonth, monthKey, monthLong, monthlyCost, parseISO, shiftMonth, toISO } from './lib'
import { netWorthSeries, netWorthStats } from './networth'
import type { Account, Budget, CategoryId, SpendGroup, Subscription, Transaction, Transfer } from './types'

export interface ReportInput {
  txs: Transaction[]
  subs: Subscription[]
  budgets: Budget[]
  groups: SpendGroup[]
  accounts: Account[]
  transfers: Transfer[]
  month: string // yyyy-mm
  today?: string
}

export interface CategoryLine {
  category: CategoryId
  total: number
  share: number // 0–1 das despesas do mês
  prev: number
  delta: number | null // variação vs. mês anterior (null se não havia gasto antes)
}

export interface Report {
  month: string
  title: string // "Setembro de 2026"
  partial: boolean // mês ainda em andamento
  income: number
  expense: number
  balance: number
  savingsRate: number | null
  prev: { income: number; expense: number; balance: number }
  incomeFixed: number
  incomeVariable: number
  workCosts: number
  categories: CategoryLine[]
  merchants: Merchant[]
  biggest: Transaction[]
  budgets: Array<{ category: CategoryId; limit: number; spent: number; pct: number; state: '' | 'warn' | 'over' }>
  groups: GroupLimit[]
  accounts: { total: number; change: number | null } | null
  subsMonthly: number
  subsCount: number
  count: number
}

const sum = (list: Transaction[], type: 'income' | 'expense') => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
const endOfMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return toISO(new Date(y, m, 0))
}

/** Meses com lançamentos (do mais antigo ao mês atual), para navegar no relatório. */
export function reportMonths(txs: Transaction[], today = toISO(new Date())): string[] {
  const cur = today.slice(0, 7)
  const first = txs.reduce((m, t) => (t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m), cur)
  const out: string[] = []
  for (let d = parseISO(`${first}-01`); monthKey(d) <= cur && out.length < 120; d = shiftMonth(d, 1)) out.push(monthKey(d))
  return out
}

export function buildReport({ txs, subs, budgets, groups, accounts, transfers, month, today = toISO(new Date()) }: ReportInput): Report {
  const partial = month >= today.slice(0, 7)
  const upTo = partial ? today : endOfMonth(month)
  const list = txs.filter((t) => inMonth(t, month) && t.date <= upTo)
  const prevKey = monthKey(shiftMonth(parseISO(`${month}-01`), -1))
  const prevList = txs.filter((t) => inMonth(t, prevKey))

  const income = sum(list, 'income')
  const expense = sum(list, 'expense')
  const prevIncome = sum(prevList, 'income')
  const prevExpense = sum(prevList, 'expense')

  const spent = spendByCategory(list)
  const before = spendByCategory(prevList)
  const categories = [...spent]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, total]) => {
      const prev = before.get(category) ?? 0
      return { category, total, share: expense > 0 ? total / expense : 0, prev, delta: prev > 0 ? (total - prev) / prev : null }
    })

  const expenses = list.filter((t) => t.type === 'expense')
  const series = netWorthSeries(accounts, txs, transfers, upTo, 12)
  const stats = netWorthStats(series, accounts)

  const active = subs.filter((s) => s.active)
  return {
    month,
    title: monthLong(month),
    partial,
    income,
    expense,
    balance: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : null,
    prev: { income: prevIncome, expense: prevExpense, balance: prevIncome - prevExpense },
    incomeFixed: list.filter((t) => t.type === 'income' && t.category === 'salario').reduce((s, t) => s + t.amount, 0),
    incomeVariable: list.filter((t) => t.type === 'income' && t.category === 'variavel').reduce((s, t) => s + t.amount, 0),
    workCosts: spent.get('trabalho') ?? 0,
    categories,
    merchants: rankMerchants(expenses).slice(0, 5),
    biggest: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    budgets: budgets.map((b) => {
      const s = spent.get(b.category) ?? 0
      const pct = b.limit > 0 ? (s / b.limit) * 100 : 0
      return { category: b.category, limit: b.limit, spent: s, pct, state: pct >= 100 ? ('over' as const) : pct >= 80 ? ('warn' as const) : ('' as const) }
    }),
    groups: groupLimits(groups, txs, upTo),
    accounts: stats ? { total: stats.current, change: stats.sinceLastMonth } : null,
    subsMonthly: active.reduce((s, x) => s + monthlyCost(x), 0),
    subsCount: active.length,
    count: list.length,
  }
}
