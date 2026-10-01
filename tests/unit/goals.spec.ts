import { expect, test } from '@playwright/test'
import { goalPlan, monthlyToReach, monthsBetween } from '../../src/goals'
import { buildProducts, DEFAULT_PARAMS, DEFAULT_RATES, simulate } from '../../src/invest'
import type { Goal } from '../../src/types'

const TODAY = '2026-09-29'
const goal = (over: Partial<Goal> = {}): Goal => ({ id: 'g', name: 'Viagem', target: 20000, saved: 2000, color: '#e0600f', ...over })

test('meses até o prazo: meses inteiros, mês incompleto conta como um e prazo passado é zero', () => {
  expect(monthsBetween('2026-09-29', '2027-03-29')).toBe(6)
  expect(monthsBetween('2026-09-29', '2027-04-10')).toBe(7)
  expect(monthsBetween('2026-09-29', '2026-09-30')).toBe(1)
  expect(monthsBetween('2026-09-29', '2026-09-29')).toBe(0)
  expect(monthsBetween('2026-09-29', '2026-01-01')).toBe(0)
  expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(1) // mês curto: dia 31 vira o último dia
  expect(monthsBetween('2026-09-29', '2028-09-29')).toBe(24)
  expect(monthsBetween('2026-09-29', '2028-03-29')).toBe(18)
})

test('quanto guardar por mês: sem render é falta ÷ meses; rendendo, menos, e fecha exatamente na meta', () => {
  const p = goalPlan(goal({ deadline: '2028-03-29' }), TODAY)
  expect([p.missing, p.monthsLeft, p.perMonth, p.status]).toEqual([18000, 18, 1000, 'on-track'])
  expect(p.perMonthInvested!).toBeLessThan(1000)
  expect(p.perMonthInvested!).toBeGreaterThan(700)
  // a conta fecha: com esse aporte, o líquido final alcança a meta, e com um pouco menos não
  const prod = buildProducts(DEFAULT_RATES, DEFAULT_PARAMS).find((x) => x.id === 'tesouro_selic')!
  const net = (c: number) => simulate(prod, { initial: 2000, monthly: c, months: 18 }, DEFAULT_RATES.ipca).net
  expect(net(p.perMonthInvested!)).toBeGreaterThanOrEqual(20000 - 0.01)
  expect(net(p.perMonthInvested! - 0.5)).toBeLessThan(20000)
  // taxas mais altas pedem menos por mês
  const hi = goalPlan(goal({ deadline: '2028-03-29' }), TODAY, { ...DEFAULT_RATES, selic: 20, cdi: 19.9 })
  expect(hi.perMonthInvested!).toBeLessThan(p.perMonthInvested!)
})

test('situações: sem prazo, atingida, vencida, no ritmo e atrasada', () => {
  expect(goalPlan(goal(), TODAY)).toMatchObject({ status: 'no-deadline', perMonth: null, monthsLeft: null, missing: 18000 })
  expect(goalPlan(goal({ saved: 20000, deadline: '2027-01-01' }), TODAY)).toMatchObject({ status: 'done', perMonth: 0, missing: 0 })
  expect(goalPlan(goal({ saved: 25000 }), TODAY).status).toBe('done') // passou da meta
  expect(goalPlan(goal({ deadline: '2026-08-01' }), TODAY)).toMatchObject({ status: 'overdue', perMonth: null, monthsLeft: 0 })
  // criada em 29/03/2026 com prazo em 29/03/2027: hoje deveria ter cerca de metade (R$ 10.000)
  const base = { createdAt: '2026-03-29', deadline: '2027-03-29' }
  const late = goalPlan(goal({ ...base, saved: 4000 }), TODAY)
  expect(late.status).toBe('behind')
  expect(late.behind).toBeGreaterThan(5000)
  expect(goalPlan(goal({ ...base, saved: 10000 }), TODAY)).toMatchObject({ status: 'on-track', behind: 0 })
  expect(goalPlan(goal({ ...base, saved: 9500 }), TODAY).status).toBe('on-track') // folga de 5% da meta
  // meta antiga, sem data de criação: só calcula o aporte
  expect(goalPlan(goal({ deadline: '2027-03-29' }), TODAY).status).toBe('on-track')
})

test('quando o rendimento sozinho já chega lá, o aporte é zero; entradas absurdas não quebram', () => {
  expect(monthlyToReach(20000, 19990, 12, DEFAULT_RATES, DEFAULT_PARAMS)).toBe(0)
  expect(monthlyToReach(20000, 0, 0, DEFAULT_RATES, DEFAULT_PARAMS)).toBe(0)
  expect(monthlyToReach(20000, 25000, 12, DEFAULT_RATES, DEFAULT_PARAMS)).toBe(0)
  const far = goalPlan(goal({ deadline: '2096-09-29' }), TODAY) // 70 anos: limita a simulação
  expect(Number.isFinite(far.perMonthInvested!)).toBe(true)
})
