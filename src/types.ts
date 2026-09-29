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
