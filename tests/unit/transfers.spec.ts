import { expect, test } from '@playwright/test'
import { accountBalance } from '../../src/accounts'
import { buildCandidates } from '../../src/importer'
import { planSync } from '../../src/openfinance'
import { convertedIds, findTransferMatches, matchToTransfer, singleToTransfer } from '../../src/transfers'
import type { Account, Transaction } from '../../src/types'
import { acct, item, ITEM, tx as bankTx } from '../support/pluggydata'

const A: Account = { id: 'A', name: 'Nubank', kind: 'checking', openingBalance: 1000, openingDate: '2026-09-01', color: '#fff' }
const B: Account = { id: 'B', name: 'Reserva', kind: 'savings', openingBalance: 0, openingDate: '2026-09-01', color: '#fff' }
const t = (id: string, type: 'expense' | 'income', accountId: string | undefined, date: string, description: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id, type, accountId, date, description, amount, category: 'outros', ...extra })

test('acha o par saída/entrada entre contas e separa o que é seguro do que precisa de conferência', () => {
  const txs = [
    t('e1', 'expense', 'A', '2026-09-10', 'Pix enviado', 500),
    t('i1', 'income', 'B', '2026-09-10', 'Pix recebido', 500),
    t('e2', 'expense', 'A', '2026-09-12', 'Mercado X', 100),
    t('i2', 'income', 'B', '2026-09-14', 'Reembolso', 100), // 2 dias e sem palavra de transferência
    t('e3', 'expense', 'A', '2026-09-20', 'Resgate CDB', 80),
    t('i3', 'income', 'B', '2026-09-22', 'Entrada', 80), // "resgate" aparece na descrição
    t('e4', 'expense', 'A', '2026-09-01', 'Padaria', 50),
    t('i4', 'income', 'B', '2026-09-05', 'Devolução', 50), // 4 dias: longe demais
    t('e5', 'expense', 'A', '2026-09-03', 'Pix', 70),
    t('i5', 'income', 'B', '2026-09-03', 'Pix', 71), // valores diferentes
  ]
  const m = findTransferMatches(txs, [A, B])
  expect(m.map((x) => [x.expense.id, x.income.id, x.confidence, x.days]).sort()).toEqual([
    ['e1', 'i1', 'high', 0],
    ['e2', 'i2', 'low', 2],
    ['e3', 'i3', 'high', 2],
  ])
})

test('não cria par com cartão, mesma conta, conta desconhecida ou sem conta; cada lançamento entra uma vez só', () => {
  const txs = [
    t('e1', 'expense', 'A', '2026-09-10', 'Pix', 100, { cardId: 'c' }), // compra no cartão
    t('i1', 'income', 'B', '2026-09-10', 'Pix', 100),
    t('e2', 'expense', 'A', '2026-09-11', 'Pix', 40),
    t('i2', 'income', 'A', '2026-09-11', 'Pix', 40), // mesma conta
    t('e3', 'expense', undefined, '2026-09-12', 'Pix', 30), // sem conta
    t('i3', 'income', 'B', '2026-09-12', 'Pix', 30),
    t('e4', 'expense', 'Z', '2026-09-13', 'Pix', 20), // conta que não existe
    t('i4', 'income', 'B', '2026-09-13', 'Pix', 20),
  ]
  expect(findTransferMatches(txs, [A, B])).toEqual([])

  // duas saídas iguais e uma entrada: só um par; o mais próximo no tempo
  const dup = [t('e1', 'expense', 'A', '2026-09-10', 'Pix enviado', 60), t('e2', 'expense', 'A', '2026-09-12', 'Pix enviado', 60), t('i1', 'income', 'B', '2026-09-12', 'Pix recebido', 60)]
  const m = findTransferMatches(dup, [A, B])
  expect(m).toHaveLength(1)
  expect(m[0].expense.id).toBe('e2')
})

test('converter em transferência mantém o saldo das contas e tira do total de receitas e despesas', () => {
  const txs = [t('e1', 'expense', 'A', '2026-09-10', 'Pix enviado', 500), t('i1', 'income', 'B', '2026-09-10', 'Pix recebido', 500), t('e2', 'expense', 'A', '2026-09-12', 'Mercado', 100)]
  const today = '2026-09-29'
  const before = [accountBalance(A, txs, [], [A, B], today), accountBalance(B, txs, [], [A, B], today)]
  expect(before).toEqual([400, 500])

  const [m] = findTransferMatches(txs, [A, B])
  const tr = matchToTransfer(m, () => 'tr1')
  expect(tr).toMatchObject({ id: 'tr1', from: 'A', to: 'B', amount: 500, date: '2026-09-10', kind: 'transfer' })
  expect(tr.origin?.map((o) => o.id)).toEqual(['e1', 'i1'])
  const rest = txs.filter((x) => !['e1', 'i1'].includes(x.id))
  expect([accountBalance(A, rest, [tr], [A, B], today), accountBalance(B, rest, [tr], [A, B], today)]).toEqual(before)
  expect(rest.filter((x) => x.type === 'income')).toHaveLength(0) // a "receita" de 500 deixou de existir
})

test('um lançamento só: transferência de/para uma conta de fora do app', () => {
  const x = t('e9', 'expense', 'A', '2026-09-15', 'Aplicação CDB', 300)
  const tr = singleToTransfer(x, 'A', '', () => 'tr9')
  expect(tr).toMatchObject({ from: 'A', to: undefined, amount: 300, note: 'Aplicação CDB' })
  expect(accountBalance(A, [], [tr], [A, B], '2026-09-29')).toBe(700) // mesmo efeito de antes no saldo
  const inc = singleToTransfer(t('i9', 'income', 'B', '2026-09-16', 'Resgate', 50), '', 'B', () => 'tr10')
  expect(accountBalance(B, [], [inc], [A, B], '2026-09-29')).toBe(50)
})

test('o que já virou transferência não volta pelo banco nem pelo extrato', () => {
  const e = t('pl-t1', 'expense', 'A', '2026-09-10', 'Pix enviado', 500)
  const i = t('pl-t2', 'income', 'B', '2026-09-10', 'Pix recebido', 500)
  const tr = matchToTransfer({ expense: e, income: i, confidence: 'high', days: 0 }, () => 'tr1')
  expect(convertedIds([tr])).toEqual(['pl-t1', 'pl-t2'])

  // Open Finance: o movimento do banco com esse id não é importado de novo
  const resp = { items: [item()], accounts: [acct({ id: 'acc-1' })], transactions: [bankTx('t1', 'acc-1', '2026-09-10', 'Pix enviado', 500, 'out'), bankTx('t3', 'acc-1', '2026-09-11', 'Mercado', 20, 'out')] }
  const link = { id: ITEM, label: 'Nubank', since: '2026-09-01', map: { 'acc-1': { kind: 'account' as const, id: 'A' } } }
  const p = planSync({ response: resp as never, links: [link], accounts: [A], cards: [], txs: [], transfers: [tr], now: new Date('2026-09-29T12:00:00') })
  expect(p.txs.map((x) => x.id)).toEqual(['pl-t3'])
  expect(p.stats.known).toBe(1)

  // extrato OFX/CSV: idem (pelo id estável)
  const rows = [{ date: '2026-09-10', description: 'Pix enviado', amount: -500, fitid: 'abc' }]
  const id = buildCandidates(rows, 'account', [])[0].id
  expect(buildCandidates(rows, 'account', [], [id])[0].status).toBe('imported')
})
