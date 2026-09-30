import http from 'node:http'
import { expect, test } from '@playwright/test'
import { buildProducts, DEFAULT_PARAMS, DEFAULT_RATES, fetchRates, irRate, simulate, type Product } from '../../src/invest'
import { monthlyBase, reserveStatus } from '../../src/reserve'
import type { Account, Transaction } from '../../src/types'

const near = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
const products = (over: Partial<typeof DEFAULT_RATES> = {}) => Object.fromEntries(buildProducts({ ...DEFAULT_RATES, ...over }, DEFAULT_PARAMS).map((p) => [p.id, p])) as Record<string, Product>

test('imposto de renda regressivo pelo tempo de cada aporte', () => {
  expect([irRate(30), irRate(180), irRate(181), irRate(360), irRate(361), irRate(720), irRate(721), irRate(3000)]).toEqual([0.225, 0.225, 0.2, 0.2, 0.175, 0.175, 0.15, 0.15])
})

test('poupança: 0,5% ao mês com Selic alta e 70% da Selic com Selic baixa; sem imposto', () => {
  const s = simulate(products().poupanca, { initial: 1000, monthly: 0, months: 12 }, 4.5)
  near(s.net, 1000 * Math.pow(1.005, 12)) // 1.061,68
  expect([s.tax, s.invested]).toEqual([0, 1000])
  const low = buildProducts({ selic: 8, cdi: 7.9, ipca: 4 }, DEFAULT_PARAMS).find((p) => p.id === 'poupanca')!
  near(low.monthly, 0.7 * (Math.pow(1.08, 1 / 12) - 1), 1e-9)
})

test('CDB 100% do CDI por 12 meses: rende o CDI e paga 20% de IR sobre o ganho (faixa de 181 a 360 dias)', () => {
  const p = products({ cdi: 12 }).cdb_liquidez
  const s = simulate(p, { initial: 1000, monthly: 0, months: 12 }, 4.5)
  near(s.gross, 1000 * Math.pow(1 + p.monthly, 12))
  near(s.gross, 1120, 0.6) // 12% ao ano, com os dias úteis arredondados em 21 por mês
  near(s.tax, (s.gross - 1000) * 0.2, 1e-6)
  near(s.net, 1000 + (s.gross - 1000) * 0.8, 1e-6)
  near(s.real, s.net / 1.045, 1e-6)
})

test('LCI/LCA é isenta; com 90% do CDI rende menos que o CDB de 100% antes do imposto, mas pode ganhar depois dele', () => {
  const p = products({ cdi: 12 })
  const lci = simulate(p.lci, { initial: 1000, monthly: 0, months: 6 }, 4.5)
  const cdb = simulate(p.cdb_liquidez, { initial: 1000, monthly: 0, months: 6 }, 4.5)
  expect(lci.tax).toBe(0)
  expect(lci.gross).toBeLessThan(cdb.gross)
  expect(lci.net).toBeGreaterThan(cdb.net) // 6 meses = 22,5% de IR no CDB
})

test('aportes mensais: cada aporte rende pelo tempo que ficou e o IR usa a faixa de cada um', () => {
  const p = products({ cdi: 12 }).cdb_liquidez
  const s = simulate(p, { initial: 0, monthly: 100, months: 24 }, 4.5)
  expect(s.invested).toBe(2400)
  let gross = 0
  let tax = 0
  for (let k = 1; k <= 24; k++) {
    const age = 24 - k
    const g = 100 * Math.pow(1 + p.monthly, age)
    gross += g
    tax += (g - 100) * irRate(age * 30)
  }
  near(s.gross, gross, 1e-6)
  near(s.tax, tax, 1e-6)
  expect(s.series).toHaveLength(25)
  expect(s.series[0]).toEqual({ month: 0, invested: 0, net: 0 })
  near(s.series[24].net, s.net, 1e-6)
  expect(s.series[1].net).toBe(100) // o aporte do primeiro mês ainda não rendeu
  // os aportes mais recentes pagam mais IR por dia de rendimento: o imposto médio fica entre 15% e 22,5% do ganho
  expect(s.tax / (s.gross - s.invested)).toBeGreaterThan(0.15)
  expect(s.tax / (s.gross - s.invested)).toBeLessThan(0.225)
})

test('Tesouro IPCA+ junta inflação e juro real; Tesouro Selic acompanha a Selic', () => {
  const p = products({ selic: 12, ipca: 5 })
  near(Math.pow(1 + p.tesouro_ipca.monthly, 12) - 1, 1.05 * 1.06 - 1, 1e-9)
  near(Math.pow(1 + p.tesouro_selic.monthly, 12) - 1, 0.12, 0.002)
  expect(p.tesouro_selic.fgc).toContain('Não')
})

test('sem valor investido ou sem prazo, nada quebra', () => {
  const p = products().cdb_liquidez
  expect(simulate(p, { initial: 0, monthly: 0, months: 12 }, 4.5)).toMatchObject({ invested: 0, net: 0, gain: 0, annualNet: 0 })
  const zero = simulate(p, { initial: 1000, monthly: 0, months: 0 }, 4.5)
  expect([zero.net, zero.series.length]).toEqual([1000, 1])
})

test('busca de taxas no Banco Central: lê o último valor de cada série e recusa resposta estranha', async () => {
  const paths: string[] = []
  let broken = false
  const srv = http.createServer((req, res) => {
    paths.push(req.url ?? '')
    const v: Record<string, string> = { '432': '13.75', '4389': '13.65', '13522': '4.31' }
    const code = /sgs\.(\d+)/.exec(req.url ?? '')?.[1] ?? ''
    res.writeHead(broken ? 500 : 200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify([{ data: '29/09/2026', valor: v[code] }]))
  })
  await new Promise<void>((r) => srv.listen(0, r))
  const base = `http://localhost:${(srv.address() as { port: number }).port}`
  try {
    const r = await fetchRates(fetch, base)
    expect(r).toEqual({ selic: 13.75, cdi: 13.65, ipca: 4.31, date: '29/09/2026' })
    expect(paths.sort()).toEqual(['/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json', '/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json', '/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json'])
    broken = true
    await expect(fetchRates(fetch, base)).rejects.toThrow('Não foi possível buscar as taxas')
  } finally {
    await new Promise<void>((r) => srv.close(() => r()))
  }
})

// ---------- reserva de emergência ----------
const t = (id: string, date: string, amount: number, category: Transaction['category'] = 'outros', type: 'expense' | 'income' = 'expense'): Transaction => ({ id, date, amount, category, type, description: id })
const TODAY = '2026-09-29'

test('base mensal: média dos últimos 3 meses fechados com dados, só essenciais se pedir, e sobra média', () => {
  const txs = [
    t('a', '2026-06-10', 3000, 'moradia'), t('b', '2026-06-11', 500, 'lazer'), t('i1', '2026-06-05', 5000, 'salario', 'income'),
    t('c', '2026-07-10', 2000, 'alimentacao'), t('i2', '2026-07-05', 5000, 'salario', 'income'),
    t('e', '2026-09-10', 9999, 'lazer'), // mês atual: fica de fora quando há meses fechados
    // agosto sem nenhum lançamento: não entra na média (não puxa para baixo)
  ]
  const all = monthlyBase(txs, false, TODAY)
  expect(all).toEqual({ monthlyExpense: (3500 + 2000) / 2, surplus: (1500 + 3000) / 2, monthsUsed: 2 })
  expect(monthlyBase(txs, true, TODAY).monthlyExpense).toBe((3000 + 2000) / 2)
})

test('sem histórico fechado usa o mês atual até hoje', () => {
  const txs = [t('a', '2026-09-10', 700, 'moradia'), t('b', '2026-09-28', 100), t('c', '2026-10-05', 5000), t('i', '2026-09-05', 2000, 'salario', 'income')]
  expect(monthlyBase(txs, false, TODAY)).toEqual({ monthlyExpense: 800, surplus: 1200, monthsUsed: 0 })
  expect(monthlyBase([], false, TODAY)).toEqual({ monthlyExpense: 0, surplus: 0, monthsUsed: 0 })
})

test('reserva: meta, guardado (contas de poupança por padrão, ou as escolhidas, mais o de fora), falta e prazo', () => {
  const txs = [t('a', '2026-07-10', 3000, 'moradia'), t('i', '2026-07-05', 5000, 'salario', 'income'), t('b', '2026-08-10', 3000, 'moradia'), t('j', '2026-08-05', 5000, 'salario', 'income')]
  const accounts: Account[] = [
    { id: 'S', name: 'Reserva', kind: 'savings', openingBalance: 9000, openingDate: '2026-01-01', color: '#fff' },
    { id: 'C', name: 'Corrente', kind: 'checking', openingBalance: 500, openingDate: '2026-01-01', color: '#fff' },
  ]
  const a = reserveStatus({ months: 6, essentialOnly: false, extra: 0 }, txs, accounts, [], TODAY)
  expect([a.target, a.monthlyExpense, a.surplus]).toEqual([18000, 3000, 2000])
  expect(a.saved).toBe(9000) // só a de poupança; a corrente não entra sozinha
  expect([a.missing, a.progress, a.done, a.monthsToGoal, a.covered]).toEqual([9000, 0.5, false, 5, 3])
  expect(a.perMonthIn(12)).toBe(750)

  const b = reserveStatus({ months: 3, essentialOnly: false, extra: 1000, accountIds: ['S', 'C'] }, txs, accounts, [], TODAY)
  expect(b.saved).toBe(9000 + 500 + 1000) // as duas contas escolhidas (os lançamentos não têm conta) + o valor de fora do app
  expect(b.done).toBe(true)
  expect([b.missing, b.monthsToGoal]).toEqual([0, 0])

  const none = reserveStatus({ months: 6, essentialOnly: false, extra: 0 }, [], [], [], TODAY)
  expect([none.target, none.saved, none.progress, none.done]).toEqual([0, 0, 0, false])
})
