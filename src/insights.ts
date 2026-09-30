import { CATEGORIES } from './categories'
import { brl, daysUntil, formatDate, inMonth, installmentStatus, monthKey, monthLong, monthlyCost, nextCharge, parseISO, shiftMonth, sumBy } from './lib'
import { cardInvoices, cardSummary } from './cards'
import type { Budget, Card, CategoryId, Installment, Subscription, Transaction } from './types'

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

const incomeOf = (list: Transaction[], cat: CategoryId) =>
  list.filter((t) => t.type === 'income' && t.category === cat).reduce((a, t) => a + t.amount, 0)

/** Insights gerados por regras a partir dos seus dados (tudo local). */
export function buildInsights(
  txs: Transaction[],
  subs: Subscription[],
  budgets: Budget[],
  installments: Installment[] = [],
  cards: Card[] = [],
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

  // Renda fixa x variável (ex.: salário + Uber)
  const fixed = incomeOf(curTx, 'salario')
  const variable = incomeOf(curTx, 'variavel')
  if (fixed > 0 && expense > 0) {
    const cover = (fixed / expense) * 100
    out.push(
      cover >= 100
        ? { id: 'fixed', tone: 'good', title: 'Salário fixo cobre as despesas', text: `Seu salário fixo (${brl(fixed)}) cobre todas as despesas do mês. A renda variável é sobra.` }
        : { id: 'fixed', tone: 'info', title: `Salário fixo cobre ${cover.toFixed(0)}% das despesas`, text: `Faltam ${brl(expense - fixed)} para fechar o mês; isso depende da renda variável.` },
    )
  }
  const work = curTx.filter((t) => t.type === 'expense' && t.category === 'trabalho').reduce((a, t) => a + t.amount, 0)
  const past3 = [1, 2, 3].map((n) => incomeOf(txs.filter((t) => inMonth(t, monthKey(shiftMonth(now, -n)))), 'variavel'))
  const avgVar = past3.some((v) => v > 0) ? past3.reduce((a, v) => a + v, 0) / 3 : 0
  if (variable > 0 || work > 0) {
    out.push({
      id: 'variable',
      tone: 'info',
      title: work > 0 ? `Renda variável líquida: ${brl(variable - work)}` : `Renda variável: ${brl(variable)}`,
      text:
        (work > 0 ? `Entrou ${brl(variable)} e os custos do trabalho foram ${brl(work)}. ` : '') +
        (avgVar > 0 ? `Média bruta dos 3 meses anteriores: ${brl(avgVar)}.` : 'Ainda não há meses anteriores para comparar.'),
    })
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
  const open = installments.map((i) => ({ i, st: installmentStatus(i) })).filter((x) => x.st.remaining > 0)
  if (open.length) {
    const monthlyInst = open.reduce((a, x) => a + x.i.amount, 0)
    const owed = open.reduce((a, x) => a + x.st.remainingAmount, 0)
    const last = open.map((x) => x.st.end).sort().pop()!
    out.push({
      id: 'inst',
      tone: 'info',
      title: `${open.length} ${open.length > 1 ? 'parcelamentos' : 'parcelamento'} em aberto`,
      text: `Faltam ${brl(owed)} (${brl(monthlyInst)}/mês). O último termina em ${monthLong(last.slice(0, 7)).toLowerCase()}.`,
    })
  }

  // Cartões: fechamento e vencimento chegando
  for (const c of cards) {
    const s = cardSummary(c, txs)
    if (s.open.total > 0 && s.daysToClose <= 5) {
      out.push({
        id: `card-close-${c.id}`,
        tone: 'info',
        title: `Fatura ${c.name} fecha ${s.daysToClose === 0 ? 'hoje' : `em ${s.daysToClose} ${s.daysToClose === 1 ? 'dia' : 'dias'}`}`,
        text: `Já são ${brl(s.open.total)} nesta fatura. Compras depois de ${formatDate(s.open.closing)} entram só na próxima.`,
      })
    }
    if (s.closed) {
      const d = daysUntil(parseISO(s.closed.due))
      if (d <= 5) out.push({ id: `card-due-${c.id}`, tone: 'warn', title: `Fatura ${c.name} vence ${d === 0 ? 'hoje' : `em ${d} ${d === 1 ? 'dia' : 'dias'}`}`, text: `${brl(s.closed.total)} a pagar. Depois de pagar, marque como paga em Cartões.` })
    }
    const recentOverdue = cardInvoices(c, txs).find((i) => i.status === 'overdue' && i.total > 0 && daysUntil(parseISO(i.due)) >= -20)
    if (recentOverdue) {
      out.push({ id: `card-late-${c.id}`, tone: 'warn', title: `Fatura ${c.name} vencida em ${formatDate(recentOverdue.due)}`, text: `${brl(recentOverdue.total)}. Se já pagou, marque como paga em Cartões.` })
    }
  }

  const soon = [
    ...active.map((s) => ({ name: s.name, price: s.price, d: daysUntil(nextCharge(s)) })),
    ...open.map((x) => ({ name: x.i.name, price: x.i.amount, d: daysUntil(parseISO(x.st.next!)) })),
  ]
    .filter((x) => x.d <= 5)
    .sort((a, b) => a.d - b.d)
  if (soon.length) {
    const total = soon.reduce((s, x) => s + x.price, 0)
    out.push({
      id: 'soon',
      tone: 'info',
      title: 'Cobranças chegando',
      text: `${soon.map((x) => x.name).join(', ')} ${soon.length > 1 ? 'vencem' : 'vence'} nos próximos 5 dias (${brl(total)}).`,
    })
  }

  return out
}

export interface Health {
  score: number
  label: string
  tip: string
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))

/** Nota 0–100: poupança (40), orçamentos respeitados (35), peso das assinaturas (25). */
export function financialHealth(txs: Transaction[], subs: Subscription[], budgets: Budget[]): Health {
  const cur = monthKey(new Date())
  const list = txs.filter((t) => inMonth(t, cur))
  if (list.length === 0) return { score: 0, label: 'Sem dados', tip: 'Lance suas transações do mês para calcular a nota.' }
  const income = sumBy(list, 'income')
  const expense = sumBy(list, 'expense')
  const rate = income > 0 ? (income - expense) / income : 0
  const spent = spendByCategory(list)
  const ok = budgets.length ? budgets.filter((b) => (spent.get(b.category) ?? 0) <= b.limit).length / budgets.length : 1
  const subsShare = income > 0 ? subs.filter((s) => s.active).reduce((a, s) => a + monthlyCost(s), 0) / income : 0

  const score = Math.round(clamp(rate / 0.3) * 40 + ok * 35 + (1 - clamp(subsShare / 0.1)) * 25)
  const label = score >= 75 ? 'Excelente' : score >= 55 ? 'No caminho certo' : score >= 35 ? 'Atenção' : 'Crítico'
  const tip =
    rate < 0.2
      ? 'Aumentar a poupança para 20% da renda é o que mais melhora sua nota.'
      : ok < 1
        ? 'Segure as categorias que passaram do orçamento para subir a nota.'
        : 'Suas finanças estão equilibradas. Mantenha o ritmo!'
  return { score, label, tip }
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const SUGGESTIONS = [
  'Quanto gastei este mês?',
  'Quais assinaturas posso cortar?',
  'Como estão meus orçamentos?',
  'Como economizar mais?',
  'Quanto ainda devo em parcelas?',
  'Quando fecham as faturas dos meus cartões?',
]

/** Assistente local: responde por palavras-chave usando os seus dados (não é um LLM). */
export function answer(question: string, txs: Transaction[], subs: Subscription[], budgets: Budget[], installments: Installment[] = [], cards: Card[] = []): string {
  const q = norm(question)
  const cur = monthKey(new Date())
  const list = txs.filter((t) => inMonth(t, cur))
  const income = sumBy(list, 'income')
  const expense = sumBy(list, 'expense')
  const byCat = [...spendByCategory(list)].sort((a, b) => b[1] - a[1])

  if (/cartao|cartoes|fatura|fecha|limite disponivel/.test(q)) {
    if (!cards.length) return 'Você ainda não cadastrou cartões. Cadastre em Cartões, com o dia de fechamento e de vencimento.'
    return cards
      .map((c) => {
        const s = cardSummary(c, txs)
        const parts = [`• ${c.name}: fatura atual ${brl(s.open.total)}, fecha ${s.daysToClose === 0 ? 'hoje' : `em ${s.daysToClose} ${s.daysToClose === 1 ? 'dia' : 'dias'}`} (${formatDate(s.open.closing)}), vence ${formatDate(s.open.due)}`]
        if (s.closed) parts.push(`  fechada a pagar: ${brl(s.closed.total)}, vence ${formatDate(s.closed.due)}`)
        if (c.limit) parts.push(`  limite disponível: ${brl(Math.max(0, c.limit - s.used))}`)
        parts.push(`  melhor dia de compra: dia ${s.bestDay}`)
        return parts.join('\n')
      })
      .join('\n')
  }
  if (/parcela|divida|devo|emprest|financ/.test(q)) {
    const open = installments.map((i) => ({ i, st: installmentStatus(i) })).filter((x) => x.st.remaining > 0)
    if (!open.length) return 'Você não tem parcelas em aberto. 🎉'
    const owed = open.reduce((a, x) => a + x.st.remainingAmount, 0)
    const monthly = open.reduce((a, x) => a + x.i.amount, 0)
    return `Você deve ${brl(owed)} em ${open.length} ${open.length > 1 ? 'parcelamentos' : 'parcelamento'} (${brl(monthly)}/mês):\n${open
      .map((x) => `• ${x.i.name}${x.i.lender ? ` (${x.i.lender})` : ''}: ${x.st.paid}/${x.i.count} pagas, faltam ${brl(x.st.remainingAmount)}, termina em ${monthLong(x.st.end.slice(0, 7)).toLowerCase()}`)
      .join('\n')}`
  }
  if (/assinatura|renova|cancel|cortar/.test(q)) {
    const active = subs.filter((s) => s.active).sort((a, b) => monthlyCost(b) - monthlyCost(a))
    if (!active.length) return 'Você não tem assinaturas ativas. 🎉'
    const total = active.reduce((a, s) => a + monthlyCost(s), 0)
    const top = active.slice(0, 2)
    const save = top.reduce((a, s) => a + monthlyCost(s), 0)
    return `Você tem ${active.length} assinaturas ativas, somando ${brl(total)}/mês (${brl(total * 12)}/ano). As mais caras são ${top.map((s) => `${s.name} (${brl(monthlyCost(s))}/mês)`).join(' e ')}. Cancelar as duas economizaria ${brl(save)}/mês — ${brl(save * 12)} por ano.`
  }
  if (/orcamento|limite/.test(q)) {
    const spent = spendByCategory(list)
    if (!budgets.length) return 'Você ainda não definiu orçamentos. Defina limites na aba Orçamentos.'
    return budgets
      .map((b) => {
        const s = spent.get(b.category) ?? 0
        return `• ${CATEGORIES[b.category].label}: ${brl(s)} de ${brl(b.limit)} (${((s / b.limit) * 100).toFixed(0)}%)`
      })
      .join('\n')
  }
  if (/econom|poup|guardar|meta/.test(q)) {
    const rate = income > 0 ? ((income - expense) / income) * 100 : 0
    const top = byCat[0]
    return `Neste mês você guarda ${rate.toFixed(0)}% da renda${rate < 20 ? ' — abaixo dos 20% recomendados' : ''}. ${top ? `Sua maior categoria é ${CATEGORIES[top[0]].label} (${brl(top[1])}); reduzir 10% dela libera ${brl(top[1] * 0.1)}/mês.` : ''}`
  }
  if (/gast|despesa|categoria|onde/.test(q)) {
    if (!byCat.length) return 'Ainda não há despesas neste mês.'
    return `Você gastou ${brl(expense)} este mês. Maiores categorias:\n${byCat.slice(0, 4).map(([c, v]) => `• ${CATEGORIES[c].label}: ${brl(v)}`).join('\n')}`
  }
  if (/saldo|receita|renda|ganh|salario|uber/.test(q)) {
    const fixed = incomeOf(list, 'salario')
    const variable = incomeOf(list, 'variavel')
    const work = list.filter((t) => t.type === 'expense' && t.category === 'trabalho').reduce((a, t) => a + t.amount, 0)
    const parts = [`Este mês: receitas de ${brl(income)}, despesas de ${brl(expense)} e saldo de ${brl(income - expense)}.`]
    if (fixed > 0 || variable > 0) parts.push(`• Salário fixo: ${brl(fixed)}\n• Renda variável: ${brl(variable)}${work > 0 ? ` (custos do trabalho ${brl(work)}, líquido ${brl(variable - work)})` : ''}`)
    return parts.join('\n')
  }
  return 'Posso ajudar com gastos do mês, assinaturas, orçamentos e formas de economizar. Tente uma das sugestões abaixo.'
}
