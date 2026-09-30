import type { ReserveSettings } from './reserve'

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
  accountId?: string // conta de onde saiu (despesa) ou onde entrou (receita); vazio se for no cartão
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
  accountId?: string // ou a conta em que é debitada
}

export interface Budget {
  category: CategoryId
  limit: number
}

export type AccountKind = 'checking' | 'cash' | 'savings' | 'other'

export type Page = 'overview' | 'transactions' | 'subscriptions' | 'cards' | 'budgets' | 'invest' | 'assistant'

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
  accountId?: string
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
  accountId?: string // ou a conta de onde as parcelas saem (carnê, boleto)
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

/** Conexão com um banco via Open Finance (Meu Pluggy). O `id` é o Item ID da Pluggy. */
export interface BankLink {
  id: string
  label: string // como o usuário chama o banco, ex.: "Nubank"
  since: string // yyyy-mm-dd: histórico importado a partir desta data
  lastSync?: string // ISO
  status?: string // situação da conexão na Pluggy (UPDATED, LOGIN_ERROR...)
  /** para cada conta/cartão da Pluggy: a que conta/cartão do Finn corresponde (ou 'ignore') */
  map: Record<string, { kind: 'account' | 'card' | 'ignore'; id?: string }>
  /** saldo informado pelo banco na última sincronização (só contas) */
  balances?: Record<string, number>
}

/** Grupo de gastos criado pelo usuário: todas as despesas cuja descrição tem alguma das palavras. */
export interface SpendGroup {
  id: string
  name: string
  terms: string // palavras separadas por vírgula, ex.: "padaria, panificadora"
}

/** Perfil do usuário (um único registro, id 'me'). */
export interface Profile {
  id: string
  name: string
  onboardingHidden?: boolean
  banks?: BankLink[]
  groups?: SpendGroup[]
  reserve?: ReserveSettings
}

/** Conta (corrente, carteira, poupança...). O saldo é: saldo inicial + o que entrou e saiu desde a data inicial. */
export interface Account {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  openingDate: string // yyyy-mm-dd: movimentos anteriores já estão dentro do saldo inicial
  color: string
}

/** Movimentação entre contas ou pagamento de fatura de cartão (sai da conta, não é despesa nova). */
export interface Transfer {
  id: string
  date: string
  from?: string // conta de origem
  to?: string // conta de destino (vazio no pagamento de fatura)
  amount: number
  note: string
  kind: 'transfer' | 'invoice'
  cardId?: string
  invoiceKey?: string
  /** lançamentos que viraram esta transferência (para desfazer, e para o banco não importá-los de novo) */
  origin?: Transaction[]
}
