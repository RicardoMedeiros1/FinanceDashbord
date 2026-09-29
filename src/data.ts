import type { Budget, Subscription, Transaction } from './types'
import { shiftMonth, toISO, uid } from './lib'

const day = (monthsAgo: number, dayOfMonth: number) => {
  const base = shiftMonth(new Date(), -monthsAgo)
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  return toISO(new Date(base.getFullYear(), base.getMonth(), Math.min(dayOfMonth, last)))
}

/** Dados de exemplo relativos a hoje, para o dashboard nascer preenchido. */
export function seedTransactions(): Transaction[] {
  const list: Transaction[] = []
  const add = (
    description: string,
    amount: number,
    type: Transaction['type'],
    category: Transaction['category'],
    m: number,
    d: number,
  ) => list.push({ id: uid(), description, amount, type, category, date: day(m, d) })

  for (let m = 0; m < 6; m++) {
    const wobble = (n: number) => Math.round(n * (0.85 + ((m * 37) % 30) / 100))
    add('Salário', 7200, 'income', 'renda', m, 5)
    if (m % 2 === 0) add('Freelance', wobble(1200), 'income', 'renda', m, 18)
    add('Aluguel', 2100, 'expense', 'moradia', m, 6)
    add('Condomínio + luz', wobble(520), 'expense', 'moradia', m, 10)
    add('Supermercado', wobble(780), 'expense', 'alimentacao', m, 8)
    add('Restaurantes / iFood', wobble(430), 'expense', 'alimentacao', m, 20)
    add('Combustível', wobble(320), 'expense', 'transporte', m, 12)
    add('Uber', wobble(140), 'expense', 'transporte', m, 22)
    add('Cinema e saídas', wobble(260), 'expense', 'lazer', m, 15)
    add('Farmácia', wobble(120), 'expense', 'saude', m, 9)
    add('Compras online', wobble(380), 'expense', 'compras', m, 24)
    if (m % 3 === 0) add('Curso online', 199, 'expense', 'educacao', m, 14)
  }
  return list.filter((t) => t.date <= toISO(new Date()))
}

export function seedSubscriptions(): Subscription[] {
  const d = (n: number) => day(0, n)
  return [
    { id: uid(), name: 'Netflix', price: 55.9, cycle: 'monthly', billingDate: d(3), color: '#e50914', active: true },
    { id: uid(), name: 'Spotify', price: 23.9, cycle: 'monthly', billingDate: d(8), color: '#1db954', active: true },
    { id: uid(), name: 'Amazon Prime', price: 166.8, cycle: 'yearly', billingDate: day(5, 20), color: '#38bdf8', active: true },
    { id: uid(), name: 'ChatGPT Plus', price: 110, cycle: 'monthly', billingDate: d(2), color: '#10a37f', active: true },
    { id: uid(), name: 'iCloud 200GB', price: 14.9, cycle: 'monthly', billingDate: d(28), color: '#94a3b8', active: true },
    { id: uid(), name: 'Academia', price: 119.9, cycle: 'monthly', billingDate: d(1), color: '#f59e0b', active: true },
    { id: uid(), name: 'Disney+', price: 33.9, cycle: 'monthly', billingDate: d(17), color: '#6366f1', active: false },
  ]
}

export const seedBudgets = (): Budget[] => [
  { category: 'moradia', limit: 2800 },
  { category: 'alimentacao', limit: 1300 },
  { category: 'transporte', limit: 500 },
  { category: 'lazer', limit: 350 },
  { category: 'compras', limit: 400 },
  { category: 'saude', limit: 300 },
]
