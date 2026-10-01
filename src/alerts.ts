// Alertas: coisas que merecem um olhar (compra fora do padrão, cobrança repetida, preço que subiu, gasto acima do ritmo).
// Funções puras; o app só mostra e deixa dispensar.
import { brl, formatDate, monthKey, parseISO, shiftMonth, toISO } from './lib'
import { merchantName } from './spending'
import type { Transaction } from './types'

export interface Alert {
  id: string
  kind: 'unusual' | 'duplicate' | 'price' | 'pace'
  title: string
  text: string
}

const DAY = 86_400_000
const days = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY)
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const same = (a: number, b: number) => Math.abs(a - b) < 0.01

/** Olha só os últimos dias, para o alerta ser sobre algo recente. */
const RECENT = 14

export function buildAlerts(txs: Transaction[], today = toISO(new Date())): Alert[] {
  const out: Alert[] = []
  const expenses = txs.filter((t) => t.type === 'expense' && t.date <= today)
  const byMerchant = new Map<string, Transaction[]>()
  for (const t of expenses) {
    const k = merchantName(t.description).key
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), t])
  }
  for (const list of byMerchant.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const recent = (t: Transaction) => days(t.date, today) <= RECENT

  for (const list of byMerchant.values()) {
    const name = merchantName(list[0].description).name

    // 1) compra bem acima do que você costuma pagar ali
    for (let i = 0; i < list.length; i++) {
      const t = list[i]
      if (!recent(t) || t.ruleId) continue
      const before = list.slice(0, i).filter((x) => days(x.date, t.date) <= 365)
      if (before.length < 3) continue
      const usual = median(before.map((x) => x.amount))
      if (t.amount >= usual * 3 && t.amount - usual >= 50) {
        out.push({
          id: `unusual-${t.id}`,
          kind: 'unusual',
          title: `Compra acima do normal em ${name}`,
          text: `${brl(t.amount)} em ${formatDate(t.date)}; ali você costuma pagar cerca de ${brl(usual)}. Confira se foi você.`,
        })
      }
    }

    // 2) a mesma cobrança duas vezes em até 2 dias
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]
      const b = list[i]
      if (!recent(b) || a.ruleId || b.ruleId || b.amount < 20 || !same(a.amount, b.amount) || days(a.date, b.date) > 2) continue
      out.push({
        id: `dup-${a.id}-${b.id}`,
        kind: 'duplicate',
        title: `Possível cobrança repetida em ${name}`,
        text: `${brl(b.amount)} em ${formatDate(a.date)}${a.date === b.date ? ' (duas vezes no mesmo dia)' : ` e em ${formatDate(b.date)}`}. Se não foi proposital, vale pedir estorno.`,
      })
    }

    // 3) cobrança mensal que mudou de valor (assinatura que subiu)
    if (list.length >= 3) {
      const [c1, c2, c3] = list.slice(-3)
      const monthly = (x: Transaction, y: Transaction) => days(x.date, y.date) >= 25 && days(x.date, y.date) <= 35
      if (days(c3.date, today) <= 35 && same(c1.amount, c2.amount) && monthly(c1, c2) && monthly(c2, c3) && !same(c2.amount, c3.amount) && Math.abs(c3.amount - c2.amount) >= 1 && Math.abs(c3.amount - c2.amount) / c2.amount >= 0.03) {
        const up = c3.amount > c2.amount
        out.push({
          id: `price-${c3.id}`,
          kind: 'price',
          title: `${name} ${up ? 'ficou mais caro' : 'ficou mais barato'}`,
          text: `A cobrança mensal passou de ${brl(c2.amount)} para ${brl(c3.amount)} (${up ? '+' : '−'}${brl(Math.abs(c3.amount - c2.amount))}).`,
        })
      }
    }
  }

  // 4) gasto do mês acima do ritmo dos 3 meses anteriores (comparando até o mesmo dia)
  const now = parseISO(today)
  const day = now.getDate()
  if (day >= 10) {
    const upTo = (key: string) => expenses.filter((t) => t.date.startsWith(key) && Number(t.date.slice(8, 10)) <= day).reduce((s, t) => s + t.amount, 0)
    const prior = [1, 2, 3].map((n) => upTo(monthKey(shiftMonth(now, -n))))
    const avg = prior.reduce((s, v) => s + v, 0) / 3
    const cur = upTo(monthKey(now))
    if (prior.filter((v) => v > 0).length >= 2 && avg >= 500 && cur >= avg * 1.3) {
      out.push({
        id: `pace-${monthKey(now)}`,
        kind: 'pace',
        title: `Gastos ${Math.round((cur / avg - 1) * 100)}% acima do seu ritmo`,
        text: `Até o dia ${day} você gastou ${brl(cur)}; nos 3 meses anteriores, no mesmo ponto do mês, a média foi ${brl(avg)}.`,
      })
    }
  }

  const rank = { duplicate: 0, unusual: 1, price: 2, pace: 3 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind])
}
