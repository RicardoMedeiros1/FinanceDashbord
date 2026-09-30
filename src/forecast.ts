import { accountBalance } from './accounts'
import { cardInvoices } from './cards'
import { inMonth, installmentStatus, monthKey, occurrence, shiftMonth, subOccurrence, toISO } from './lib'
import type { Account, Card, Installment, Recurring, Subscription, Transaction, Transfer } from './types'

export interface ForecastItem {
  id: string
  name: string
  date: string
  amount: number
  source: 'recorrente' | 'assinatura' | 'parcela' | 'fatura'
  /** cobrada no cartão de crédito (vira fatura; não sai da conta na hora) */
  onCard: boolean
}

export interface Forecast {
  today: string
  monthEnd: string
  incomeSoFar: number
  expenseSoFar: number
  upcomingIncome: ForecastItem[]
  upcomingExpense: ForecastItem[]
  projectedIncome: number
  projectedExpense: number
  /** receitas previstas menos despesas previstas no mês inteiro (regime de competência, como o resto do app) */
  leftover: number
  /** média da renda variável dos 3 meses anteriores (não entra na previsão: não é garantida) */
  variableAvg: number
  /** Só existe se houver contas: o que deve sobrar em conta no fim do mês (regime de caixa). */
  cash?: { balance: number; income: number; outflows: number; invoices: ForecastItem[]; expected: number }
}

interface Input {
  txs: Transaction[]
  rules: Recurring[]
  subs: Subscription[]
  installments: Installment[]
  cards: Card[]
  accounts: Account[]
  transfers: Transfer[]
  today?: string
}

const sum = (l: { amount: number }[]) => l.reduce((s, x) => s + x.amount, 0)

/** Quanto ainda entra e sai até o fim do mês, com base nas recorrências, assinaturas, parcelas e faturas cadastradas. */
export function buildForecast(i: Input): Forecast {
  const today = i.today ?? toISO(new Date())
  const [y, m] = today.split('-').map(Number)
  const monthEnd = toISO(new Date(y, m, 0))
  const cur = today.slice(0, 7)
  const month = i.txs.filter((t) => t.date.startsWith(cur) && t.date <= today)
  const incomeSoFar = sum(month.filter((t) => t.type === 'income'))
  const expenseSoFar = sum(month.filter((t) => t.type === 'expense'))

  const upIncome: ForecastItem[] = []
  const upExpense: ForecastItem[] = []
  const inRest = (d: string) => d > today && d <= monthEnd

  for (const r of i.rules) {
    if (!r.active) continue
    for (let n = r.generated; n < r.generated + 100; n++) {
      const date = occurrence(r.anchor, r.cycle, n)
      if (date > monthEnd) break
      if (!inRest(date)) continue
      const item: ForecastItem = { id: `${r.id}-${n}`, name: r.description, date, amount: r.amount, source: 'recorrente', onCard: !!r.cardId }
      ;(r.type === 'income' ? upIncome : upExpense).push(item)
    }
  }
  for (const s of i.subs) {
    if (!s.active) continue
    for (let n = 0; n < 2000; n++) {
      const date = subOccurrence(s, n)
      if (date > monthEnd) break
      if (inRest(date)) upExpense.push({ id: `${s.id}-${date}`, name: s.name, date, amount: s.price, source: 'assinatura', onCard: !!s.cardId })
    }
  }
  for (const p of i.installments) {
    const st = installmentStatus(p, today)
    for (let k = st.paid; k < p.count; k++) {
      const date = occurrence(p.firstDate, 'monthly', k)
      if (date > monthEnd) break
      if (inRest(date)) upExpense.push({ id: `${p.id}-p${k}`, name: `${p.name} (${k + 1}/${p.count})`, date, amount: p.amount, source: 'parcela', onCard: !!p.cardId })
    }
  }
  const byDate = (a: ForecastItem, b: ForecastItem) => a.date.localeCompare(b.date)
  upIncome.sort(byDate)
  upExpense.sort(byDate)

  const projectedIncome = incomeSoFar + sum(upIncome)
  const projectedExpense = expenseSoFar + sum(upExpense)

  const past3 = [1, 2, 3].map((n) => i.txs.filter((t) => t.type === 'income' && t.category === 'variavel' && inMonth(t, monthKey(shiftMonth(new Date(y, m - 1, 1), -n)))).reduce((s, t) => s + t.amount, 0))
  const variableAvg = past3.some((v) => v > 0) ? sum(past3.map((amount) => ({ amount }))) / 3 : 0

  let cash: Forecast['cash']
  if (i.accounts.length) {
    const balance = i.accounts.reduce((s, a) => s + accountBalance(a, i.txs, i.transfers, i.accounts, today), 0)
    const income = sum(upIncome)
    const outflows = sum(upExpense.filter((e) => !e.onCard))
    const invoices: ForecastItem[] = []
    for (const c of i.cards) {
      for (const inv of cardInvoices(c, i.txs, today)) {
        // faturas ainda por vencer neste mês: pagam-se da conta
        if ((inv.status === 'open' || inv.status === 'closed') && inv.total > 0 && inv.due > today && inv.due <= monthEnd) {
          invoices.push({ id: `${c.id}-${inv.key}`, name: `Fatura ${c.name}`, date: inv.due, amount: inv.total, source: 'fatura', onCard: false })
        }
      }
    }
    invoices.sort(byDate)
    cash = { balance, income, outflows, invoices, expected: balance + income - outflows - sum(invoices) }
  }

  return { today, monthEnd, incomeSoFar, expenseSoFar, upcomingIncome: upIncome, upcomingExpense: upExpense, projectedIncome, projectedExpense, leftover: projectedIncome - projectedExpense, variableAvg, cash }
}
