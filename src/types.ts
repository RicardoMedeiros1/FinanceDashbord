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
  | 'trabalho'
  | 'salario'
  | 'variavel'
  | 'renda'

export interface Transaction {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: CategoryId
  date: string // yyyy-mm-dd
  ruleId?: string // definido quando foi gerada por uma recorrência
  cardId?: string // cartão de crédito usado (a compra entra na fatura dele)
}

export interface Subscription {
  id: string
  name: string
  price: number
  cycle: 'monthly' | 'yearly'
  billingDate: string // yyyy-mm-dd, qualquer cobrança passada/futura
  color: string
  active: boolean
  category?: CategoryId // categoria da despesa gerada (padrão: assinaturas)
  chargedUntil?: string // cobranças até esta data já foram processadas (yyyy-mm-dd)
  cardId?: string // cartão em que a assinatura é cobrada
}

export interface Budget {
  category: CategoryId
  limit: number
}

export type Page = 'overview' | 'transactions' | 'subscriptions' | 'cards' | 'budgets' | 'assistant'

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
  cardId?: string
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
  category?: CategoryId // categoria das despesas geradas (padrão: compras)
  generated?: number // quantas parcelas já viraram despesa
  cardId?: string // cartão PRÓPRIO em que a compra foi parcelada (deixe vazio se for cartão de terceiros)
}

/** Cartão de crédito: as compras entram na fatura conforme o dia de fechamento. */
export interface Card {
  id: string
  name: string
  closingDay: number // 1–31 (em meses curtos vale o último dia)
  dueDay: number // 1–31
  limit?: number
  color: string
  paid?: string[] // faturas marcadas como pagas (chave = mês do fechamento, yyyy-mm)
}
