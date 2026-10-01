import { expect, test } from '@playwright/test'
import { buildAlerts } from '../../src/alerts'
import { groupLimits, groupSpent, expensesIn, filterMerchant, matchesTerms, merchantName, parseTerms, periodStart, rankMerchants, searchSpending, summarize } from '../../src/spending'
import type { Transaction } from '../../src/types'

const tx = (id: string, date: string, description: string, amount: number, type: 'expense' | 'income' = 'expense'): Transaction => ({ id, date, description, amount, type, category: 'outros' })
const TODAY = '2026-09-29'

test('nome do estabelecimento: tira prefixos, códigos e parcelas, e junta as grafias da mesma marca', () => {
  const n = (d: string) => merchantName(d).name
  expect(n('MERCADOLIVRE*12AB34')).toBe('Mercado Livre')
  expect(n('Mercado Livre')).toBe('Mercado Livre')
  expect(n('MERCADOLIVRE*ABC - Parcela 2/6')).toBe('Mercado Livre')
  expect(n('Mercado Pago*Loja')).toBe('Mercado Pago') // não confunde com Mercado Livre
  expect(n('Pagamento efetuado|PADARIA ESTRELA LTDA')).toBe('Padaria Estrela Ltda')
  expect(n('Compra no débito - Padaria São José')).toBe('Padaria São José') // mantém acentos
  expect(n('PADARIA ESTRELA 123456')).toBe('Padaria Estrela')
  expect(n('Celular Loja (2/6)')).toBe('Celular Loja')
  expect(n('AMAZON BR')).toBe('Amazon')
  expect(n('IFD*IFOOD CLUB')).toBe('iFood')
  expect(n('Uber *Trip')).toBe('Uber')
  expect(n('Uber Eats')).toBe('Uber Eats')
  expect(merchantName('Padaria Estrela').key).toBe(merchantName('PADARIA ESTRELA*XYZ99').key)
  expect(merchantName('   ').name).toBe('Sem descrição')
})

test('busca por palavras: ignora acento, caixa, espaços e asteriscos; vírgula junta termos', () => {
  expect(parseTerms('Padaria, panificadora ; Padoca')).toEqual(['padaria', 'panificadora', 'padoca'])
  expect(parseTerms(' a ')).toEqual([]) // termo de 1 letra é ignorado
  expect(matchesTerms('MERCADOLIVRE*12AB', parseTerms('mercado livre'))).toBe(true)
  expect(matchesTerms('Mercado Livre', parseTerms('mercadolivre'))).toBe(true)
  expect(matchesTerms('Padaria São José', parseTerms('sao jose'))).toBe(true)
  expect(matchesTerms('Mercado Pago', parseTerms('mercado livre'))).toBe(false)
  expect(matchesTerms('Qualquer', [])).toBe(false)
})

test('períodos contam meses de calendário e não incluem receitas nem compras futuras', () => {
  expect(periodStart('1m', TODAY)).toBe('2026-09-01')
  expect(periodStart('3m', TODAY)).toBe('2026-07-01')
  expect(periodStart('12m', TODAY)).toBe('2025-10-01')
  expect(periodStart('all', TODAY)).toBe('')
  expect(periodStart('3m', '2026-01-15')).toBe('2025-11-01') // vira o ano
  const list = [tx('a', '2026-09-10', 'X', 10), tx('b', '2026-06-30', 'X', 20), tx('c', '2026-09-10', 'Salário', 5000, 'income'), tx('d', '2026-10-05', 'X', 30)]
  expect(expensesIn(list, '3m', TODAY).map((t) => t.id)).toEqual(['a'])
  expect(expensesIn(list, 'all', TODAY).map((t) => t.id)).toEqual(['a', 'b'])
})

test('resumo: total, média, maior compra e um item por mês (inclusive os vazios)', () => {
  const list = [tx('a', '2026-09-10', 'X', 100), tx('b', '2026-07-20', 'X', 50), tx('c', '2026-09-01', 'X', 30)]
  const s = summarize(list, '3m', TODAY)
  expect([s.total, s.count, s.avg, s.max?.id, s.last]).toEqual([180, 3, 60, 'a', '2026-09-10'])
  expect(s.byMonth).toEqual([{ month: '2026-07', total: 50 }, { month: '2026-08', total: 0 }, { month: '2026-09', total: 130 }])
  const empty = summarize([], '3m', TODAY)
  expect([empty.total, empty.count, empty.avg, empty.max]).toEqual([0, 0, 0, null])
  expect(summarize(list, 'all', TODAY).byMonth.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09'])
})

test('ranking por estabelecimento, busca e filtro exato', () => {
  const list = [
    tx('1', '2026-09-10', 'MERCADOLIVRE*AA', 100),
    tx('2', '2026-08-10', 'Mercado Livre', 50),
    tx('3', '2026-09-12', 'Pagamento efetuado|PADARIA ESTRELA', 30),
    tx('4', '2026-09-13', 'Padaria Estrela', 20),
    tx('5', '2026-09-14', 'Mercado Pago*X', 40),
    tx('6', '2026-09-15', 'Uber *Trip', 10),
    tx('7', '2026-09-16', 'Uber Eats', 15),
  ]
  const r = rankMerchants(list)
  expect(r.map((m) => [m.name, m.total, m.count])).toEqual([['Mercado Livre', 150, 2], ['Padaria Estrela', 50, 2], ['Mercado Pago', 40, 1], ['Uber Eats', 15, 1], ['Uber', 10, 1]])
  expect(searchSpending(list, 'mercado livre').map((t) => t.id)).toEqual(['1', '2'])
  expect(searchSpending(list, 'uber').map((t) => t.id)).toEqual(['7', '6']) // busca por palavra pega os dois
  expect(filterMerchant(list, merchantName('Uber').key).map((t) => t.id)).toEqual(['6']) // escolher o estabelecimento é exato
  expect(searchSpending(list, 'padaria, mercado pago').map((t) => t.id)).toEqual(['5', '4', '3'])
})

test('limite por grupo: conta só o mês atual, ignora grupos sem limite e marca aviso/estouro', () => {
  const list = [
    tx('1', '2026-09-03', 'Padaria Estrela', 60),
    tx('2', '2026-09-20', 'Panificadora São José', 30),
    tx('3', '2026-08-28', 'Padaria Estrela', 500), // mês passado
    tx('4', '2026-10-02', 'Padaria Estrela', 80), // futura
    tx('5', '2026-09-10', 'Salário padaria', 999, 'income'), // receita
    tx('6', '2026-09-05', 'iFood', 130),
  ]
  const groups = [
    { id: 'p', name: 'Padaria', terms: 'padaria, panificadora', limit: 100 },
    { id: 'd', name: 'Delivery', terms: 'ifood', limit: 130 },
    { id: 'm', name: 'Mercado', terms: 'mercado' }, // sem limite
    { id: 'z', name: 'Zero', terms: 'ifood', limit: 0 }, // limite 0 = sem limite
  ]
  expect(groupSpent(groups[0], list, TODAY)).toEqual({ spent: 90, count: 2 })
  const r = groupLimits(groups, list, TODAY)
  expect(r.map((x) => x.group.id)).toEqual(['p', 'd'])
  expect(r[0]).toMatchObject({ spent: 90, state: 'warn' }) // 90%
  expect(r[0].pct).toBeCloseTo(90)
  expect(r[1]).toMatchObject({ spent: 130, state: 'over' }) // exatamente o limite já conta como estourado
})

test.describe('alertas', () => {
  const ids = (list: Transaction[]) => buildAlerts(list, TODAY).map((a) => a.id)

  test('compra muito acima do que costuma pagar naquele lugar', () => {
    const base = [tx('a', '2026-06-10', 'Mercado Central', 100), tx('b', '2026-07-12', 'Mercado Central', 120), tx('c', '2026-08-10', 'MERCADO CENTRAL', 110)]
    expect(ids([...base, tx('d', '2026-09-27', 'Mercado Central', 450)])).toEqual(['unusual-d'])
    expect(ids([...base, tx('d', '2026-09-27', 'Mercado Central', 250)])).toEqual([]) // só 2,3x
    expect(ids([...base, tx('d', '2026-09-01', 'Mercado Central', 900)])).toEqual([]) // não é recente
    expect(ids([base[0], base[1], tx('d', '2026-09-27', 'Mercado Central', 900)])).toEqual([]) // pouco histórico
    expect(ids([...base, { ...tx('d', '2026-09-27', 'Mercado Central', 900), ruleId: 'r' }])).toEqual([]) // recorrência é esperada
  })

  test('mesma cobrança duas vezes em até 2 dias', () => {
    expect(ids([tx('a', '2026-09-26', 'Loja Azul', 89.9), tx('b', '2026-09-27', 'LOJA AZUL*123', 89.9)])).toEqual(['dup-a-b'])
    expect(ids([tx('a', '2026-09-27', 'Loja Azul', 89.9), tx('b', '2026-09-27', 'Loja Azul', 89.9)])).toEqual(['dup-a-b'])
    expect(ids([tx('a', '2026-09-20', 'Loja Azul', 89.9), tx('b', '2026-09-27', 'Loja Azul', 89.9)])).toEqual([]) // longe
    expect(ids([tx('a', '2026-09-26', 'Loja Azul', 89.9), tx('b', '2026-09-27', 'Loja Azul', 80)])).toEqual([]) // valor diferente
    expect(ids([tx('a', '2026-09-26', 'Café', 8), tx('b', '2026-09-26', 'Café', 8)])).toEqual([]) // valor pequeno
  })

  test('assinatura que mudou de valor', () => {
    const subs = [tx('a', '2026-07-05', 'StreamMax', 29.9), tx('b', '2026-08-05', 'StreamMax', 29.9)]
    const r = buildAlerts([...subs, tx('c', '2026-09-05', 'StreamMax', 39.9)], TODAY)
    expect(r.map((a) => a.id)).toEqual(['price-c'])
    expect(r[0].title).toContain('mais caro')
    expect(r[0].text).toMatch(/29,90.*39,90/)
    expect(buildAlerts([...subs, tx('c', '2026-09-05', 'StreamMax', 29.9)], TODAY)).toEqual([]) // igual
    expect(buildAlerts([...subs, tx('c', '2026-09-05', 'StreamMax', 30.4)], TODAY)).toEqual([]) // <3%
    expect(buildAlerts([...subs, tx('c', '2026-08-20', 'StreamMax', 39.9)], TODAY)).toEqual([]) // não é mensal
  })

  test('gasto do mês acima do ritmo dos 3 meses anteriores, só depois do dia 10', () => {
    const mk = (m: string, total: number) => tx(`m${m}`, `${m}-05`, `Gastos ${m}`, total)
    const past = [mk('2026-06', 1000), mk('2026-07', 1100), mk('2026-08', 900)]
    expect(ids([...past, mk('2026-09', 1500)])).toEqual(['pace-2026-09']) // média 1000 → +50%
    expect(ids([...past, mk('2026-09', 1200)])).toEqual([]) // só 20%
    expect(buildAlerts([...past, mk('2026-09', 1500)], '2026-09-08')).toEqual([]) // começo do mês
    expect(ids([mk('2026-08', 900), mk('2026-09', 1500)])).toEqual([]) // pouco histórico
    expect(buildAlerts([...past, mk('2026-09', 1500)], TODAY)[0].title).toBe('Gastos 50% acima do seu ritmo')
  })

  test('receitas e compras futuras não geram alerta', () => {
    expect(ids([tx('a', '2026-09-26', 'Loja', 100, 'income'), tx('b', '2026-09-27', 'Loja', 100, 'income'), tx('c', '2026-10-05', 'Loja', 100), tx('d', '2026-10-06', 'Loja', 100)])).toEqual([])
  })
})
