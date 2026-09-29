import { CATEGORIES } from './categories'
import { brl, daysUntil, inMonth, monthKey, monthlyCost, nextCharge, shiftMonth, sumBy } from './lib'
import type { Budget, CategoryId, Subscription, Transaction } from './types'

export interface Insight {
  id: string
  tone: 'good' | 'warn' | 'info'
  title: string
  text: string
}

export function spendByCategory(list: Transaction[]) {
  const map = new Map<CategoryId, number>()
  for (const t of list) {
    if (t.type !== 'expense') continue
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return map
}

/** Insights gerados por regras a partir dos seus dados (tudo local). */
export function buildInsights(
  txs: Transaction[],
  subs: Subscription[],
  budgets: Budget[],
): Insight[] {
  const now = new Date()
  const cur = monthKey(now)
  const prev = monthKey(shiftMonth(now, -1))
  const curTx = txs.filter((t) => inMonth(t, cur))
  const prevTx = txs.filter((t) => inMonth(t, prev))
  const out: Insight[] = []

  const income = sumBy(curTx, 'income')
  const expense = sumBy(curTx, 'expense')
  if (income > 0) {
    const rate = ((income - expense) / income) * 100
    out.push(
      rate >= 20
        ? { id: 'save', tone: 'good', title: 'Boa taxa de poupança', text: `Você está guardando ${rate.toFixed(0)}% da renda este mês. Continue assim!` }
        : rate >= 0
          ? { id: 'save', tone: 'info', title: 'Poupança abaixo do ideal', text: `Você guarda ${rate.toFixed(0)}% da renda. A meta comum é 20%.` }
          : { id: 'save', tone: 'warn', title: 'Gastos acima da renda', text: `Você já gastou ${brl(expense - income)} a mais do que ganhou este mês.` },
    )
  }

  // Categoria que mais cresceu em relação ao mês passado
  const c = spendByCategory(curTx)
  const p = spendByCategory(prevTx)
  let worst: { cat: CategoryId; diff: number; pct: number } | null = null
  for (const [cat, v] of c) {
    const before = p.get(cat) ?? 0
    if (before < 50) continue
    const diff = v - before
    const pct = (diff / before) * 100
    if (diff > 80 && pct > 20 && (!worst || diff > worst.diff)) worst = { cat, diff, pct }
  }
  if (worst) {
    out.push({
      id: 'spike',
      tone: 'warn',
      title: `${CATEGORIES[worst.cat].label} subiu ${worst.pct.toFixed(0)}%`,
      text: `Você gastou ${brl(worst.diff)} a mais que no mês passado nessa categoria.`,
    })
  }

  // Orçamentos
  for (const b of budgets) {
    const spent = c.get(b.category) ?? 0
    const pct = (spent / b.limit) * 100
    if (pct >= 100) {
      out.push({ id: `b-${b.category}`, tone: 'warn', title: `Orçamento de ${CATEGORIES[b.category].label} estourado`, text: `${brl(spent)} de ${brl(b.limit)} (${pct.toFixed(0)}%).` })
    } else if (pct >= 80) {
      out.push({ id: `b-${b.category}`, tone: 'warn', title: `${CATEGORIES[b.category].label} perto do limite`, text: `Já usou ${pct.toFixed(0)}% do orçamento — restam ${brl(b.limit - spent)}.` })
    }
  }

  // Assinaturas
  const active = subs.filter((s) => s.active)
  const monthly = active.reduce((s, x) => s + monthlyCost(x), 0)
  if (active.length) {
    const top = [...active].sort((a, b) => monthlyCost(b) - monthlyCost(a))[0]
    out.push({
      id: 'subs',
      tone: 'info',
      title: `${active.length} assinaturas ativas`,
      text: `Custam ${brl(monthly)}/mês (${brl(monthly * 12)}/ano). A mais cara é ${top.name}, com ${brl(monthlyCost(top))}/mês.`,
    })
  }
  const soon = active
    .map((s) => ({ s, d: daysUntil(nextCharge(s)) }))
    .filter((x) => x.d <= 5)
    .sort((a, b) => a.d - b.d)
  if (soon.length) {
    const total = soon.reduce((s, x) => s + x.s.price, 0)
    out.push({
      id: 'soon',
      tone: 'info',
      title: 'Cobranças chegando',
      text: `${soon.map((x) => x.s.name).join(', ')} ${soon.length > 1 ? 'renovam' : 'renova'} nos próximos 5 dias (${brl(total)}).`,
    })
  }

  return out
}
