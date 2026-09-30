import { expect, test } from '@playwright/test'
import { accountBalance } from '../../src/accounts'
import { needsAutoSync, planSync, pickCategory, isItemId } from '../../src/openfinance'
import type { Account, BankLink, Card, Transaction } from '../../src/types'
import { acct, card, item, ITEM, sample, tx } from '../support/pluggydata'

const link = (over: Partial<BankLink> = {}): BankLink => ({ id: ITEM, label: 'Nubank', since: '2026-09-01', map: {}, ...over })
let n = 0
const newId = () => `id${++n}`
const NOW = new Date('2026-09-29T12:00:00')
const run = (over: Record<string, unknown> = {}) =>
  planSync({ response: sample() as never, links: [link()], accounts: [], cards: [], txs: [], now: NOW, newId, ...over } as never)
const apply = (p: ReturnType<typeof run>, accounts: Account[] = [], cards: Card[] = [], txs: Transaction[] = []) => ({
  links: p.links,
  accounts: [...accounts, ...p.accounts],
  cards: [...cards, ...p.cards],
  txs: [...p.txs, ...txs],
})

test('primeira sincronização cria conta (saldo fecha com o banco), cartão e lançamentos', () => {
  n = 0
  const p = run()
  expect(p.accounts).toHaveLength(1)
  expect(p.cards).toHaveLength(1)
  const a = p.accounts[0]
  // saldo hoje 1.250 = inicial + 5.000 − 32,50 (a fatura paga não entra; pendente fica de fora) → o app soma só o que importou
  // aqui o saldo inicial considera todos os movimentos postados da janela: 1250 − (5000 − 32,5 − 900)
  expect(a.openingBalance).toBe(-2817.5)
  expect(a.openingDate).toBe('2026-09-01')
  expect(a.kind).toBe('checking')
  expect(p.cards[0]).toMatchObject({ name: 'Nubank (cartão)', closingDay: 20, dueDay: 28, limit: 8000 })

  // importados: salário, padaria, 2 compras no cartão. Ficam de fora: fatura paga na conta, pagamento recebido no cartão, pendente
  const by = Object.fromEntries(p.txs.map((t) => [t.id, t]))
  expect(Object.keys(by).sort()).toEqual(['pl-t1', 'pl-t2', 'pl-t4', 'pl-t5'])
  expect(by['pl-t1']).toMatchObject({ type: 'income', amount: 5000, category: 'salario', accountId: a.id })
  expect(by['pl-t2']).toMatchObject({ type: 'expense', amount: 32.5, category: 'alimentacao', accountId: a.id })
  expect(by['pl-t4']).toMatchObject({ type: 'expense', cardId: p.cards[0].id, category: 'compras' })
  expect(by['pl-t4'].accountId).toBeUndefined()
  expect(by['pl-t5'].description).toBe('Celular Loja (2/6)')
  expect(p.skipped.map((s) => [s.tx.id, s.reason])).toEqual([['pl-t3', 'invoice']])
  expect(p.stats).toMatchObject({ added: 4, known: 0, skipped: 1, ignored: 1 })
  expect(p.links[0].lastSync).toBe(NOW.toISOString())
  expect(p.links[0].balances).toEqual({ 'acc-1': 1250 })
  expect(Object.values(p.links[0].map).map((m) => m.kind).sort()).toEqual(['account', 'card'])
})

test('sincronizar de novo não duplica nada e não recria contas', () => {
  n = 0
  const first = run()
  const state = apply(first)
  const second = run({ links: state.links, accounts: state.accounts, cards: state.cards, txs: state.txs })
  expect(second.txs).toHaveLength(0)
  expect(second.accounts).toHaveLength(0)
  expect(second.cards).toHaveLength(0)
  expect(second.stats.known).toBe(4)
  expect(second.links[0].map).toEqual(state.links[0].map)
})

test('movimento novo no banco entra na próxima sincronização', () => {
  n = 0
  const state = apply(run())
  const resp = sample()
  resp.transactions.push(tx('t9', 'acc-1', '2026-09-29', 'Uber *Trip', 18.9, 'out') as never)
  const p = planSync({ response: resp as never, links: state.links, accounts: state.accounts, cards: state.cards, txs: state.txs, now: NOW, newId })
  expect(p.txs.map((t) => [t.id, t.category, t.accountId])).toEqual([['pl-t9', 'transporte', state.accounts[0].id]])
})

test('o que já foi lançado à mão não é duplicado (cada lançamento absorve um movimento)', () => {
  n = 0
  const manual: Transaction[] = [{ id: 'm1', description: 'padaria', amount: 32.5, type: 'expense', category: 'alimentacao', date: '2026-09-10' }]
  const resp = sample()
  resp.transactions.push(tx('t10', 'acc-1', '2026-09-10', 'Padaria Estrela', 32.5, 'out') as never) // segundo movimento igual, esse é de verdade
  const p = planSync({ response: resp as never, links: [link()], accounts: [], cards: [], txs: manual, now: NOW, newId })
  expect(p.skipped.filter((s) => s.reason === 'maybe').map((s) => s.tx.id)).toEqual(['pl-t2'])
  expect(p.txs.map((t) => t.id)).toContain('pl-t10')
  // o lançamento seu, sem conta, passa a valer na conta do banco (o saldo e a fatura ficam certos)
  expect(p.patches).toEqual([{ id: 'm1', accountId: p.accounts[0].id }])
  expect(p.stats.linked).toBe(1)
  // depois de importar os novos, o movimento que sobrou continua o mesmo na sincronização seguinte
  const state = apply(p, [], [], [{ ...manual[0], accountId: p.accounts[0].id }])
  const again = planSync({ response: resp as never, links: state.links, accounts: state.accounts, cards: state.cards, txs: state.txs, now: NOW, newId })
  expect(again.txs).toHaveLength(0)
  expect(again.skipped.filter((s) => s.reason === 'maybe').map((s) => s.tx.id)).toEqual(['pl-t2'])
  expect(again.patches).toEqual([]) // já está ligado
})

test('histórico só a partir da data escolhida, e conta apagada é recriada', () => {
  n = 0
  const p = planSync({ response: sample() as never, links: [link({ since: '2026-09-11' })], accounts: [], cards: [], txs: [], now: NOW, newId })
  expect(p.txs.map((t) => t.id).sort()).toEqual(['pl-t5'].sort()) // t1, t2, t4 são anteriores a 11/09
  const state = apply(planSync({ response: sample() as never, links: [link()], accounts: [], cards: [], txs: [], now: NOW, newId }))
  const gone = planSync({ response: sample() as never, links: state.links, accounts: [], cards: state.cards, txs: state.txs, now: NOW, newId })
  expect(gone.accounts).toHaveLength(1) // a conta do app foi excluída: cria de novo
  expect(gone.cards).toHaveLength(0)
})

test('conexões com problema viram aviso e não mexem nos dados', () => {
  const resp = { items: [item({ id: ITEM, error: 'not_found', status: 'NOT_FOUND' })], accounts: [], transactions: [] }
  const p = planSync({ response: resp as never, links: [link()], accounts: [], cards: [], txs: [], now: NOW, newId })
  expect(p.warnings[0]).toContain('Nubank')
  expect(p.txs).toHaveLength(0)
  const login = { items: [item({ status: 'LOGIN_ERROR' })], accounts: [acct()], transactions: [] }
  const q = planSync({ response: login as never, links: [link()], accounts: [], cards: [], txs: [], now: NOW, newId })
  expect(q.warnings.join(' ')).toContain('LOGIN_ERROR')
})

test('vários cartões/contas na mesma conexão ganham nomes diferentes; ignorar não importa', () => {
  n = 0
  const resp = { items: [item()], accounts: [acct(), acct({ id: 'acc-2', name: 'Poupança', subtype: 'SAVINGS_ACCOUNT', balance: 50 }), card()], transactions: [tx('x1', 'acc-2', '2026-09-03', 'Rendimento', 1, 'in')] }
  const p = planSync({ response: resp as never, links: [link()], accounts: [], cards: [], txs: [], now: NOW, newId })
  expect(p.accounts.map((a) => [a.name, a.kind])).toEqual([['Nubank · Conta Corrente', 'checking'], ['Nubank · Poupança', 'savings']])
  const ignored = planSync({ response: resp as never, links: [link({ map: { 'acc-2': { kind: 'ignore' } } })], accounts: [], cards: [], txs: [], now: NOW, newId })
  expect(ignored.txs.find((t) => t.id === 'pl-x1')).toBeUndefined()
})

test('categorias: histórico e regras primeiro, depois a categoria da Pluggy', () => {
  const h = new Map<string, never>()
  expect(pickCategory('Groceries', 'LOJA XYZ', 'expense', h)).toBe('alimentacao')
  expect(pickCategory('Transport', 'ABC', 'expense', h)).toBe('transporte')
  expect(pickCategory('Salary', 'DEPOSITO', 'income', h)).toBe('salario')
  expect(pickCategory(null, 'ALGO', 'expense', h)).toBe('outros')
  expect(pickCategory('Groceries', 'Uber *Trip', 'expense', h)).toBe('transporte') // a regra por descrição vence
})

test('atualização automática e validação do Item ID', () => {
  expect(needsAutoSync([link()], NOW)).toBe(true)
  expect(needsAutoSync([link({ lastSync: '2026-09-29T10:00:00' })], NOW)).toBe(false)
  expect(needsAutoSync([link({ lastSync: '2026-09-28T10:00:00' })], NOW)).toBe(true)
  expect(needsAutoSync([], NOW)).toBe(false)
  expect(isItemId(ITEM)).toBe(true)
  expect(isItemId(` ${ITEM} `)).toBe(true)
  expect(isItemId('abc')).toBe(false)
  expect(isItemId('meu.pluggy.ai')).toBe(false)
})

test('o saldo da conta no app fecha com o do banco (depois de registrar a fatura paga)', () => {
  n = 0
  const p = run()
  const state = apply(p)
  const acc = state.accounts[0]
  const today = '2026-09-29'
  // a fatura de R$ 900 paga pela conta ainda não foi registrada: o app mostra 900 a mais
  expect(accountBalance(acc, state.txs, [], state.accounts, today)).toBe(2150)
  // ao registrar em Cartões → Pagar fatura, fecha com o banco (1.250)
  const paid = [{ id: 'tr1', date: '2026-09-12', from: acc.id, amount: 900, note: 'Fatura', kind: 'invoice' as const, cardId: state.cards[0].id, invoiceKey: '2026-09' }]
  expect(accountBalance(acc, state.txs, paid, state.accounts, today)).toBe(1250)
})
