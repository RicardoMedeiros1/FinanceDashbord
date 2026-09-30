import { expect, test } from '../support/test'
import { applyInstallments, applyRecurring, applySubscriptions, installmentStatus, missingInstallmentTxs, occurrence } from '../../src/lib'
import { applyChanges, keyOf } from '../../src/cloud/sync'
import type { Installment, Recurring, Subscription } from '../../src/types'

const inst = (extra: Partial<Installment> = {}): Installment => ({ id: 'ip', name: 'iPhone', lender: '', amount: 250, count: 12, purchaseDate: '2026-03-10', firstDate: '2026-04-10', color: '#fff', ...extra })

test('ocorrências mensais mantêm o dia e ajustam meses curtos', () => {
  expect(occurrence('2026-01-31', 'monthly', 1)).toBe('2026-02-28')
  expect(occurrence('2026-01-31', 'monthly', 2)).toBe('2026-03-31')
  expect(occurrence('2028-01-31', 'monthly', 1)).toBe('2028-02-29')
  expect(occurrence('2026-12-15', 'monthly', 2)).toBe('2027-02-15')
  expect(occurrence('2026-01-05', 'weekly', 2)).toBe('2026-01-19')
  expect(occurrence('2024-02-29', 'yearly', 1)).toBe('2025-02-28')
})

test('parcelas: status derivado das datas', () => {
  const s = installmentStatus(inst(), '2026-09-29')
  expect(s).toMatchObject({ paid: 6, remaining: 6, remainingAmount: 1500, total: 3000, next: '2026-10-10', end: '2027-03-10', done: false })
  expect(installmentStatus(inst({ count: 3 }), '2026-09-29')).toMatchObject({ done: true, next: null })
  expect(installmentStatus(inst(), '2026-04-10').paid).toBe(1) // no dia do vencimento já conta
})

test('parcelas viram despesa uma vez só, e apagar não recria', () => {
  const first = applyInstallments([inst({ generated: 0 })], '2026-09-29')!
  expect(first.txs.map((t) => t.date)).toEqual(['2026-04-10', '2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10'])
  expect(first.items[0].generated).toBe(6)
  expect(applyInstallments(first.items, '2026-09-29')).toBeNull() // idempotente
  // uma despesa apagada pelo usuário não volta, mas o botão de "lançar pagas" a recria
  const existing = new Set(first.txs.filter((t) => t.id !== 'ip-p2').map((t) => t.id))
  expect(missingInstallmentTxs(inst({ generated: 6 }), existing, '2026-09-29').map((t) => t.id)).toEqual(['ip-p2'])
  // parcelamento antigo (sem contador) não lança histórico
  const legacy = applyInstallments([inst()], '2026-09-29')!
  expect(legacy.txs).toHaveLength(0)
  expect(legacy.items[0].generated).toBe(6)
})

test('assinaturas: sem histórico inventado, pausada não acumula', () => {
  const sub = (extra: Partial<Subscription> = {}): Subscription => ({ id: 's', name: 'Netflix', price: 55.9, cycle: 'monthly', billingDate: '2026-06-15', color: '#f00', active: true, ...extra })
  const r = applySubscriptions([sub({ chargedUntil: '2026-07-20' })], '2026-09-29')!
  expect(r.txs.map((t) => t.date)).toEqual(['2026-08-15', '2026-09-15'])
  expect(applySubscriptions(r.items, '2026-09-29')).toBeNull()
  expect(applySubscriptions([sub()], '2026-09-29')!.txs).toHaveLength(0) // legado começa de agora
  const paused = applySubscriptions([sub({ active: false, chargedUntil: '2026-07-01' })], '2026-09-29')!
  expect(paused.txs).toHaveLength(0)
  expect(paused.items[0].chargedUntil).toBe('2026-09-29')
})

test('recorrentes: ids determinísticos e datas no futuro não geram', () => {
  const rule: Recurring = { id: 'r', description: 'Aluguel', amount: 2100, type: 'expense', category: 'moradia', cycle: 'monthly', anchor: '2026-01-31', generated: 0, active: true }
  const out = applyRecurring([rule], '2026-09-29')!
  expect(out.txs.map((t) => t.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31'])
  expect(out.txs[0].id).toBe('r-0')
  expect(applyRecurring([{ ...rule, anchor: '2026-12-01' }], '2026-09-29')).toBeNull()
})

test('mudanças vindas da nuvem: substituir, inserir e remover', () => {
  const list = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }]
  const out = applyChanges(list, 'txs', [
    { col: 'txs', id: 'a', item: { id: 'a', v: 10 } },
    { col: 'txs', id: 'b', item: null },
    { col: 'txs', id: 'c', item: { id: 'c', v: 3 } },
    { col: 'subs', id: 'z', item: { id: 'z' } },
  ])
  expect(out).toEqual([{ id: 'a', v: 10 }, { id: 'c', v: 3 }])
  expect(applyChanges(list, 'goals', [])).toBe(list)
  expect(keyOf('budgets', { category: 'moradia', limit: 1 })).toBe('moradia')
})
