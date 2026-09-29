export type CategoryId =
  | 'moradia'
  | 'alimentacao'
  | 'transporte'
  | 'lazer'
  | 'saude'
  | 'assinaturas'
  | 'compras'
  | 'educacao'
  | 'outros'
  | 'renda'

export interface Transaction {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: CategoryId
  date: string // yyyy-mm-dd
  ruleId?: string // definido quando foi gerada por uma recorrência
}

export interface Subscription {
  id: string
  name: string
  price: number
  cycle: 'monthly' | 'yearly'
  billingDate: string // yyyy-mm-dd, qualquer cobrança passada/futura
  color: string
  active: boolean
}

export interface Budget {
  category: CategoryId
  limit: number
}

export type Page = 'overview' | 'transactions' | 'subscriptions' | 'budgets' | 'assistant'

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  color: string
}

export type Cycle = 'weekly' | 'monthly' | 'yearly'

/** Regra que gera um lançamento a cada ciclo, a partir de `anchor`. */
export interface Recurring {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: CategoryId
  cycle: Cycle
  anchor: string // yyyy-mm-dd da primeira ocorrência
  generated: number // quantas ocorrências já viraram lançamento
  active: boolean
}

/** Compra parcelada / dívida com terceiros. */
export interface Installment {
  id: string
  name: string
  lender: string // com quem (opcional), ex.: "João (cartão)"
  amount: number // valor de cada parcela
  count: number // número de parcelas
  purchaseDate: string // yyyy-mm-dd
  firstDate: string // vencimento da 1ª parcela, yyyy-mm-dd
  color: string
}
