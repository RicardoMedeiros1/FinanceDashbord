import { expect, test } from '../support/test'
import { accountBalance, accountMovements, totalBalance } from '../../src/accounts'
import { buildForecast } from '../../src/forecast'
import { netWorthSeries, netWorthStats } from '../../src/networth'
import type { Account, Card, Installment, Recurring, Subscription, Transaction, Transfer } from '../../src/types'

const acc = (id: string, openingBalance: number, openingDate = '2026-09-01'): Account => ({ id, name: id.toUpperCase(), kind: 'checking', openingBalance, openingDate, color: '#fff' })
const tx = (id: string, date: string, amount: number, type: 'income' | 'expense', extra: Partial<Transaction> = {}): Transaction => ({ id, description: id, amount, type, category: type === 'income' ? 'salario' : 'compras', date, ...extra })

test.describe('contas', () => {
  const a = acc('a', 1000)
  const b = acc('b', 200)
  const accounts = [a, b]

  test('saldo = saldo inicial + entradas − saídas desde a data inicial, até hoje', () => {
    const txs = [
      tx('antes', '2026-08-30', 999, 'expense', { accountId: 'a' }), // anterior ao saldo inicial: ignorado
      tx('salario', '2026-09-05', 5000, 'income', { accountId: 'a' }),
      tx('mercado', '2026-09-10', 300, 'expense', { accountId: 'a' }),
      tx('futuro', '2026-10-05', 5000, 'income', { accountId: 'a' }), // ainda não aconteceu
      tx('cartao', '2026-09-12', 700, 'expense', { accountId: 'a', cardId: 'c1' }), // no cartão: não mexe no saldo
      tx('outra', '2026-09-12', 50, 'expense', { accountId: 'b' }),
    ]
    expect(accountBalance(a, txs, [], accounts, '2026-09-29')).toBe(1000 + 5000 - 300)
    expect(accountBalance(b, txs, [], accounts, '2026-09-29')).toBe(150)
  })

  test('transferências e pagamento de fatura', () => {
    const transfers: Transfer[] = [
      { id: 't1', date: '2026-09-15', from: 'a', to: 'b', amount: 400, note: '', kind: 'transfer' },
      { id: 't2', date: '2026-09-20', from: 'a', amount: 700, note: 'Fatura Nubank', kind: 'invoice', cardId: 'c1', invoiceKey: '2026-09' },
      { id: 't3', date: '2026-10-20', from: 'a', to: 'b', amount: 1, note: '', kind: 'transfer' }, // futura
    ]
    expect(accountBalance(a, [], transfers, accounts, '2026-09-29')).toBe(1000 - 400 - 700)
    expect(accountBalance(b, [], transfers, accounts, '2026-09-29')).toBe(200 + 400)
    // transferir não cria nem some dinheiro no total; pagar fatura tira
    expect(totalBalance(accounts, [], transfers.slice(0, 1), '2026-09-29')).toBe(1200)
    expect(totalBalance(accounts, [], transfers.slice(0, 2), '2026-09-29')).toBe(500)
    const mov = accountMovements(a, [], transfers, accounts, '2026-09-29')
    expect(mov.map((m) => [m.kind, m.amount])).toEqual([['invoice', -700], ['transfer-out', -400]])
    expect(mov[1].label).toBe('Transferência para B')
  })
})

test.describe('previsão do mês', () => {
  const today = '2026-09-29' // faltam 29 e 30
  const salary: Recurring = { id: 'sal', description: 'Salário', amount: 5000, type: 'income', category: 'salario', cycle: 'monthly', anchor: '2026-08-30', generated: 1, active: true }
  const rent: Recurring = { id: 'rent', description: 'Aluguel', amount: 2000, type: 'expense', category: 'moradia', cycle: 'monthly', anchor: '2026-08-30', generated: 1, active: true, accountId: 'a' }
  const netflix: Subscription = { id: 'nf', name: 'Netflix', price: 55.9, cycle: 'monthly', billingDate: '2026-06-30', color: '#f00', active: true, cardId: 'c1' }
  const tv: Installment = { id: 'tv', name: 'TV', lender: '', amount: 300, count: 6, purchaseDate: '2026-04-01', firstDate: '2026-05-30', color: '#00f' } // 5ª parcela em 30/09

  test('soma o que já aconteceu e o que ainda vai acontecer até o fim do mês', () => {
    const txs = [tx('j1', '2026-09-05', 3000, 'income'), tx('j2', '2026-09-10', 800, 'expense')]
    const f = buildForecast({ txs, rules: [salary, rent], subs: [netflix], installments: [tv], cards: [], accounts: [], transfers: [], today })
    expect(f.monthEnd).toBe('2026-09-30')
    expect(f.incomeSoFar).toBe(3000)
    expect(f.expenseSoFar).toBe(800)
    expect(f.upcomingIncome.map((i) => [i.name, i.date, i.amount])).toEqual([['Salário', '2026-09-30', 5000]])
    expect(f.upcomingExpense.map((i) => [i.name, i.source])).toEqual([['Aluguel', 'recorrente'], ['Netflix', 'assinatura'], ['TV (5/6)', 'parcela']])
    expect(f.projectedIncome).toBe(8000)
    expect(f.projectedExpense).toBeCloseTo(800 + 2000 + 55.9 + 300, 2)
    expect(f.leftover).toBeCloseTo(8000 - 3155.9, 2)
    expect(f.cash).toBeUndefined() // sem contas, sem visão de caixa
  })

  test('itens pausados, futuros ou de outros meses não entram', () => {
    const f = buildForecast({ txs: [], rules: [{ ...salary, active: false }, { ...rent, anchor: '2026-12-01', generated: 0 }], subs: [{ ...netflix, active: false }], installments: [{ ...tv, count: 4 }], cards: [], accounts: [], transfers: [], today })
    expect(f.upcomingIncome).toEqual([])
    expect(f.upcomingExpense).toEqual([]) // TV com 4 parcelas: a última foi em agosto
  })

  test('renda variável: média dos 3 meses anteriores, fora da previsão', () => {
    const txs = [tx('v1', '2026-08-10', 900, 'income', { category: 'variavel' }), tx('v2', '2026-07-10', 600, 'income', { category: 'variavel' }), tx('v3', '2026-06-10', 300, 'income', { category: 'variavel' }), tx('v4', '2026-09-03', 200, 'income', { category: 'variavel' })]
    const f = buildForecast({ txs, rules: [], subs: [], installments: [], cards: [], accounts: [], transfers: [], today })
    expect(f.variableAvg).toBe(600) // (900 + 600 + 300) / 3; setembro não entra
    expect(f.projectedIncome).toBe(200)
  })

  test('caixa: saldo das contas + entradas − saídas fora do cartão − faturas a vencer', () => {
    const nubank: Card = { id: 'c1', name: 'Nubank', closingDay: 5, dueDay: 30, color: '#a0f' }
    const txs = [
      tx('c1', '2026-09-03', 400, 'expense', { cardId: 'c1' }), // fatura de setembro (fechou dia 5, vence dia 30)
      tx('c2', '2026-09-08', 100, 'expense', { cardId: 'c1' }), // fatura de outubro (vence em out.)
    ]
    const f = buildForecast({ txs, rules: [salary, rent], subs: [netflix], installments: [tv], cards: [nubank], accounts: [acc('a', 6000, '2026-09-01')], transfers: [], today })
    expect(f.cash!.balance).toBe(6000)
    expect(f.cash!.income).toBe(5000)
    expect(f.cash!.outflows).toBe(2000 + 300) // aluguel e TV saem da conta; a Netflix vai para a fatura do cartão
    expect(f.cash!.invoices.map((i) => [i.name, i.amount, i.date])).toEqual([['Fatura Nubank', 400, '2026-09-30']])
    expect(f.cash!.expected).toBe(6000 + 5000 - 2300 - 400)
  })
})

test.describe('evolução do saldo', () => {
  const a = acc('a', 1000, '2026-06-10')
  const b: Account = { ...acc('b', 500, '2026-08-15'), kind: 'savings' }
  const txs = [
    tx('s1', '2026-06-20', 200, 'income', { accountId: 'a' }),
    tx('s2', '2026-07-05', 100, 'expense', { accountId: 'a' }),
    tx('s3', '2026-08-05', 300, 'income', { accountId: 'a' }),
    tx('s4', '2026-09-10', 50, 'expense', { accountId: 'a' }),
    tx('antes', '2026-05-01', 9999, 'income', { accountId: 'a' }), // anterior ao saldo inicial
  ]
  const transfers: Transfer[] = [{ id: 't', date: '2026-09-12', from: 'a', to: 'b', amount: 400, note: '', kind: 'transfer' }]

  test('uma ponto por mês, a conta só entra a partir da sua data inicial e o mês atual vai até hoje', () => {
    const s = netWorthSeries([a, b], txs, transfers, '2026-09-29', 12)
    expect(s.map((p) => p.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']) // antes da primeira conta, nada
    expect(s.map((p) => p.total)).toEqual([1200, 1100, 1400 + 500, 1350 + 500]) // set: 1400-50-400 + 500+400
    expect(Object.keys(s[0].byAccount)).toEqual(['a'])
    expect(Object.keys(s[3].byAccount)).toEqual(['a', 'b'])
    expect(s[3].date).toBe('2026-09-29')
    expect(s[0].date).toBe('2026-06-30')
  })

  test('mudanças comparam só contas que existem nos dois meses e a transferência não vira ganho', () => {
    const s = netWorthSeries([a, b], txs, transfers, '2026-09-29', 12)
    const st = netWorthStats(s, [a, b])!
    expect(st.current).toBe(1850)
    // ago→set: a: 1400→950 (−450), b: 500→900 (+400) = −50 (só a despesa); jul→ago: só a (+300); jun→jul: −100
    expect(st.sinceLastMonth).toBe(-50)
    expect(st.sinceStart).toBe(-100 + 300 - 50)
    expect(st.best).toEqual({ month: '2026-08', change: 300 })
    expect(st.worst).toEqual({ month: '2026-07', change: -100 })
    expect(st.savedShare).toBeCloseTo(900 / 1850)
  })

  test('sem contas não há série; com uma só ponto não há variação', () => {
    expect(netWorthSeries([], txs, [], '2026-09-29')).toEqual([])
    expect(netWorthStats([], [])).toBeNull()
    const one = netWorthSeries([acc('z', 100, '2026-09-20')], [], [], '2026-09-29')
    expect(one).toHaveLength(1)
    expect(netWorthStats(one, [])).toMatchObject({ current: 100, sinceLastMonth: null, best: null })
  })
})
