import { expect, test } from '@playwright/test'
import { expensesIn, filterMerchant, matchesTerms, merchantName, parseTerms, periodStart, rankMerchants, searchSpending, summarize } from '../../src/spending'
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
