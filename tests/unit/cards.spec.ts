import { expect, test } from '../support/test'
import { cardInvoices, cardSummary, invoiceDates, invoiceKeyForDate, invoiceStatus, shiftKey } from '../../src/cards'
import type { Card, Transaction } from '../../src/types'

const card = (closingDay: number, dueDay: number, extra: Partial<Card> = {}): Card => ({ id: 'c', name: 'X', closingDay, dueDay, color: '#fff', ...extra })
const tx = (id: string, date: string, amount: number, cardId = 'c'): Transaction => ({ id, description: id, amount, type: 'expense', category: 'compras', date, cardId })

test.describe('faturas de cartão', () => {
  test('vencimento: mesmo mês se depois do fechamento, senão no mês seguinte', () => {
    expect(invoiceDates(card(5, 12), '2026-10')).toEqual({ closing: '2026-10-05', due: '2026-10-12' })
    expect(invoiceDates(card(25, 5), '2026-10')).toEqual({ closing: '2026-10-25', due: '2026-11-05' })
    expect(invoiceDates(card(20, 20), '2026-10')).toEqual({ closing: '2026-10-20', due: '2026-11-20' })
    expect(invoiceDates(card(25, 5), '2026-12')).toEqual({ closing: '2026-12-25', due: '2027-01-05' })
  })

  test('dia 31 em meses curtos (inclusive bissexto)', () => {
    expect(invoiceDates(card(31, 10), '2027-02').closing).toBe('2027-02-28')
    expect(invoiceDates(card(31, 10), '2028-02').closing).toBe('2028-02-29')
    expect(invoiceDates(card(31, 10), '2026-04').closing).toBe('2026-04-30')
  })

  test('compra no dia do fechamento fica na fatura que fecha; depois, na próxima', () => {
    const nu = card(5, 12)
    expect(invoiceKeyForDate(nu, '2026-09-05')).toBe('2026-09')
    expect(invoiceKeyForDate(nu, '2026-09-06')).toBe('2026-10')
    expect(invoiceKeyForDate(nu, '2026-12-20')).toBe('2027-01')
    expect(invoiceKeyForDate(card(31, 10), '2027-02-28')).toBe('2027-02')
    expect(invoiceKeyForDate(card(31, 10), '2027-03-01')).toBe('2027-03')
    expect(shiftKey('2026-12', 1)).toBe('2027-01')
    expect(shiftKey('2026-01', -1)).toBe('2025-12')
  })

  test('status da fatura', () => {
    const nu = card(5, 12)
    expect(invoiceStatus(nu, '2026-09', '2026-09-30')).toBe('overdue')
    expect(invoiceStatus(nu, '2026-10', '2026-09-30')).toBe('open')
    expect(invoiceStatus(nu, '2026-11', '2026-09-30')).toBe('future')
    expect(invoiceStatus(nu, '2026-09', '2026-09-08')).toBe('closed')
    expect(invoiceStatus(nu, '2026-09', '2026-09-05')).toBe('open') // no dia do fechamento ainda está aberta
    expect(invoiceStatus({ ...nu, paid: ['2026-09'] }, '2026-09', '2026-09-30')).toBe('paid')
  })

  test('totais, limite e melhor dia de compra', () => {
    const nu = card(5, 12)
    const txs = [tx('a', '2026-09-03', 100), tx('b', '2026-09-05', 50), tx('c', '2026-09-06', 200), tx('d', '2026-09-29', 30), tx('e', '2026-09-10', 999, 'outro'), { ...tx('f', '2026-09-10', 5), type: 'income' as const }]
    const inv = cardInvoices(nu, txs, '2026-09-30')
    expect(inv.find((i) => i.key === '2026-09')!.total).toBe(150)
    expect(inv.find((i) => i.key === '2026-10')!.total).toBe(230)
    const s = cardSummary(nu, txs, '2026-09-30')
    expect(s).toMatchObject({ used: 230, bestDay: 6, daysToClose: 5, closed: null })
    expect(cardSummary(nu, txs, '2026-09-08')).toMatchObject({ used: 380 })
    expect(cardSummary(card(31, 10), [], '2027-02-10').bestDay).toBe(1)
  })
})
