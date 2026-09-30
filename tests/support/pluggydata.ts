// Dados de exemplo no formato que a função "pluggy" devolve (o que o app recebe da Pluggy).
export const ITEM = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

export const acct = (over: Record<string, unknown> = {}) => ({
  id: 'acc-1',
  itemId: ITEM,
  kind: 'bank',
  name: 'Conta Corrente',
  subtype: 'CHECKING_ACCOUNT',
  number: '1234',
  balance: 1000,
  creditLimit: null,
  availableCredit: null,
  closeDate: null,
  dueDate: null,
  ...over,
})

export const card = (over: Record<string, unknown> = {}) => ({
  id: 'card-1',
  itemId: ITEM,
  kind: 'card',
  name: 'Mastercard Black',
  subtype: 'CREDIT_CARD',
  number: '5678',
  balance: 0,
  creditLimit: 8000,
  availableCredit: 7000,
  closeDate: '2026-09-20',
  dueDate: '2026-09-28',
  ...over,
})

export const tx = (id: string, accountId: string, date: string, description: string, amount: number, direction: 'in' | 'out', over: Record<string, unknown> = {}) => ({
  id,
  accountId,
  itemId: ITEM,
  date,
  description,
  amount,
  direction,
  category: null,
  pending: false,
  installment: null,
  ...over,
})

export const item = (over: Record<string, unknown> = {}) => ({ id: ITEM, connector: 'MeuPluggy', status: 'UPDATED', updatedAt: '2026-09-29T08:00:00.000Z', ...over })

/** Conta corrente (saldo 1.250) + cartão, com movimentos de setembro. */
export const sample = () => ({
  items: [item()],
  accounts: [acct({ balance: 1250 }), card()],
  transactions: [
    tx('t1', 'acc-1', '2026-09-05', 'SALARIO EMPRESA X', 5000, 'in', { category: 'Salary' }),
    tx('t2', 'acc-1', '2026-09-10', 'Padaria Estrela', 32.5, 'out', { category: 'Eating out' }),
    tx('t3', 'acc-1', '2026-09-12', 'Pagamento de fatura Mastercard', 900, 'out'),
    tx('t4', 'card-1', '2026-09-08', 'Amazon Marketplace', 150, 'out', { category: 'Shopping' }),
    tx('t5', 'card-1', '2026-09-15', 'Celular Loja', 200, 'out', { installment: { n: 2, total: 6 } }),
    tx('t6', 'card-1', '2026-09-18', 'Pagamento recebido', 900, 'in'),
    tx('t7', 'acc-1', '2026-09-28', 'Compra pendente', 10, 'out', { pending: true }),
  ],
})
