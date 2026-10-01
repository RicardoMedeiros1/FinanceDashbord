import { expect, test } from '../support/test'
import { buildReport, reportMonths } from '../../src/report'
import type { Account, Transaction } from '../../src/types'

const tx = (id: string, date: string, description: string, amount: number, type: 'income' | 'expense' = 'expense', category: Transaction['category'] = 'alimentacao'): Transaction => ({ id, date, description, amount, type, category })
const TODAY = '2026-09-29'
const txs = [
  tx('s8', '2026-08-05', 'Salário', 5000, 'income', 'salario'),
  tx('m8', '2026-08-10', 'Mercado Central', 400),
  tx('c8', '2026-08-12', 'Cinema', 100, 'expense', 'lazer'),
  tx('s9', '2026-09-05', 'Salário', 5000, 'income', 'salario'),
  tx('u9', '2026-09-06', 'Uber corridas', 800, 'income', 'variavel'),
  tx('w9', '2026-09-07', 'Gasolina', 200, 'expense', 'trabalho'),
  tx('m9', '2026-09-10', 'Mercado Central', 600),
  tx('m9b', '2026-09-20', 'MERCADO CENTRAL', 200),
  tx('c9', '2026-09-22', 'Cinema', 50, 'expense', 'lazer'),
  tx('f9', '2026-10-05', 'Futura', 999), // depois de hoje
]
const accounts: Account[] = [{ id: 'a', name: 'Conta', kind: 'checking', openingBalance: 1000, openingDate: '2026-07-01', color: '#fff' }]
const base = { txs, subs: [], budgets: [{ category: 'alimentacao' as const, limit: 700 }], groups: [{ id: 'g', name: 'Mercado', terms: 'mercado', limit: 1000 }], accounts, transfers: [], today: TODAY }

test('relatório do mês corrente: totais até hoje, variação, categorias, estabelecimentos, orçamento e grupos', () => {
  const r = buildReport({ ...base, month: '2026-09' })
  expect(r.partial).toBe(true)
  expect(r.title).toBe('Setembro de 2026')
  expect(r).toMatchObject({ income: 5800, expense: 1050, balance: 4750, incomeFixed: 5000, incomeVariable: 800, workCosts: 200, count: 6 })
  expect(r.savingsRate).toBeCloseTo(4750 / 5800)
  expect(r.prev).toEqual({ income: 5000, expense: 500, balance: 4500 })
  expect(r.categories[0]).toMatchObject({ category: 'alimentacao', total: 800 })
  expect(r.categories[0].share).toBeCloseTo(800 / 1050)
  expect(r.categories[0].delta).toBeCloseTo((800 - 400) / 400)
  expect(r.categories.find((c) => c.category === 'trabalho')!.delta).toBeNull() // não havia no mês anterior
  expect(r.merchants[0]).toMatchObject({ name: 'Mercado Central', total: 800, count: 2 })
  expect(r.biggest.map((t) => t.id)).toEqual(['m9', 'w9', 'm9b', 'c9'])
  expect(r.budgets[0]).toMatchObject({ spent: 800, state: 'over' })
  expect(r.groups[0]).toMatchObject({ spent: 800, state: 'warn' })
  expect(r.accounts).toEqual({ total: 1000, change: 0 }) // nenhum lançamento está ligado à conta
})

test('mês fechado vai até o último dia; saldo das contas e variação saem dos movimentos ligados a elas', () => {
  const linked = txs.map((t) => (t.id === 's8' || t.id === 'm8' ? { ...t, accountId: 'a' } : t))
  const r = buildReport({ ...base, txs: linked, month: '2026-08' })
  expect(r.partial).toBe(false)
  expect(r).toMatchObject({ income: 5000, expense: 500, balance: 4500, count: 3 })
  expect(r.accounts).toEqual({ total: 1000 + 5000 - 400, change: 4600 })
  expect(r.groups[0].spent).toBe(400) // só agosto
  expect(r.budgets[0]).toMatchObject({ spent: 400, state: '' })
})

test('mês vazio e meses navegáveis', () => {
  const r = buildReport({ ...base, txs: [], month: '2026-09' })
  expect(r).toMatchObject({ income: 0, expense: 0, savingsRate: null, count: 0, categories: [], merchants: [] })
  expect(reportMonths(txs, TODAY)).toEqual(['2026-08', '2026-09'])
  expect(reportMonths([], TODAY)).toEqual(['2026-09'])
})
