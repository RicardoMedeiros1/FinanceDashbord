// Open Finance (Meu Pluggy): transforma o que a função do Supabase devolve em contas, cartões e lançamentos do Finn.
// Tudo aqui é função pura (sem rede), para poder testar sem banco de verdade.
import { buildHistory, normDesc, suggestCategory } from './importer'
import { toISO, uid } from './lib'
import { convertedIds } from './transfers'
import type { Account, BankLink, Card, CategoryId, Transaction, Transfer } from './types'
import type { BankAccount, BankSyncResponse, BankTx } from '../supabase/functions/pluggy/index'

export type { BankAccount, BankSyncResponse, BankTx }

const COLORS = ['#3b6ef5', '#3ecf6e', '#e0600f', '#8b3ff5', '#f472b6', '#22d3ee', '#e84a45', '#94a3b8']

/** Um Item ID da Pluggy é um UUID. */
export const isItemId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())

/**
 * Pagamento da fatura do cartão feito pela conta. Mais estrito que o do importador de extratos: no Nubank,
 * "Pagamento efetuado|EMPRESA X" é um pagamento a terceiros (boleto, financiamento...) e é despesa de verdade.
 */
export const isCardBillPayment = (description: string) => /pagamento (de |da |do )?fatura|pagto\.? ?(de )?fatura|pgto\.? ?(de )?fatura|fatura (do |de )?cart/.test(normDesc(description))

export const txId = (t: { id: string }) => `pl-${t.id}`

// categorias da Pluggy (em português ou inglês) → categorias do Finn
const EXPENSE_CATEGORIES: Array<[RegExp, CategoryId]> = [
  [/assinatura|subscription|streaming|digital service/, 'assinaturas'],
  [/supermerc|groceries|restaur|eating|alimenta|food|delivery|padaria|bakery|bar\b/, 'alimentacao'],
  [/transport|taxi|ride|uber|fuel|gas station|combust|parking|estaciona|pedagio|toll|onibus|bus\b/, 'transporte'],
  [/health|saude|pharm|farmac|medic|hospital|dent|clinic/, 'saude'],
  [/educa|school|escola|curso|course|university|faculdade|book/, 'educacao'],
  [/entertain|lazer|leisure|cinema|game|travel|viage|hotel|sport|esporte/, 'lazer'],
  [/shopping|compras|cloth|roupa|electronic|retail|marketplace|online/, 'compras'],
  [/housing|rent|aluguel|moradia|utilit|energia|electric|water|agua|internet|telecom|condomin/, 'moradia'],
]
const INCOME_CATEGORIES: Array<[RegExp, CategoryId]> = [
  [/salar|payroll|wage|proventos/, 'salario'],
  [/freela|autonom|self.?employ|business income|renda variavel/, 'variavel'],
]

/** Primeiro o que o app já aprendeu com você e as regras por descrição; depois a categoria que a Pluggy informou. */
export function pickCategory(pluggyCategory: string | null, description: string, type: 'income' | 'expense', history: Map<string, CategoryId>): CategoryId {
  const guess = suggestCategory(description, type, history)
  if (guess !== (type === 'income' ? 'renda' : 'outros')) return guess
  const c = normDesc(pluggyCategory ?? '')
  if (c) for (const [re, cat] of type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES) if (re.test(c)) return cat
  return guess
}

export interface Skipped {
  tx: Transaction
  reason: 'maybe' | 'invoice'
}

export interface Plan {
  /** conexões atualizadas (mapeamentos, saldos, data da sincronização) */
  links: BankLink[]
  /** o que criar */
  accounts: Account[]
  cards: Card[]
  txs: Transaction[]
  /** o que ficou de fora e por quê */
  skipped: Skipped[]
  /** lançamentos seus, sem conta/cartão, que batem com um movimento do banco: passam a valer nessa conta/cartão */
  patches: Array<{ id: string; accountId?: string; cardId?: string }>
  stats: { added: number; known: number; skipped: number; ignored: number; linked: number }
  warnings: string[]
}

export interface PlanInput {
  response: BankSyncResponse
  links: BankLink[]
  accounts: Account[]
  cards: Card[]
  txs: Transaction[]
  transfers?: Transfer[]
  now?: Date
  newId?: () => string
}

const round2 = (n: number) => Math.round(n * 100) / 100
const dayOf = (iso: string | null) => (iso ? Number(iso.slice(8, 10)) || null : null)
const slot = (date: string, type: string, amount: number) => `${date}|${type}|${amount.toFixed(2)}`

/**
 * Decide o que a sincronização vai fazer, sem alterar nada:
 * - cria a conta/cartão do Finn na primeira vez (conta com saldo inicial que fecha com o do banco) e guarda a correspondência;
 * - importa só o que ainda não foi importado (id `pl-…`), sem os movimentos pendentes;
 * - não importa o que já foi lançado à mão ou por arquivo (mesma data, tipo e valor) nem pagamento de fatura: vão para `skipped`.
 */
export function planSync({ response, links, accounts, cards, txs, transfers = [], now = new Date(), newId = uid }: PlanInput): Plan {
  // o que já virou transferência entre contas também conta como importado
  const known = new Set([...txs.map((t) => t.id), ...convertedIds(transfers)])
  const history = buildHistory(txs)
  // lançamentos "manuais" (não vindos da Pluggy) que podem ser o mesmo movimento do banco
  const manual = new Map<string, Transaction[]>()
  for (const t of txs) if (!t.id.startsWith('pl-')) manual.set(slot(t.date, t.type, t.amount), [...(manual.get(slot(t.date, t.type, t.amount)) ?? []), t])
  const accountIds = new Set(accounts.map((a) => a.id))
  const cardIds = new Set(cards.map((c) => c.id))

  const plan: Plan = { links: [], accounts: [], cards: [], txs: [], skipped: [], patches: [], stats: { added: 0, known: 0, skipped: 0, ignored: 0, linked: 0 }, warnings: [] }
  let color = accounts.length + cards.length

  for (const link of links) {
    const item = response.items.find((i) => i.id === link.id)
    if (!item) {
      plan.links.push(link)
      continue
    }
    if (item.error) {
      plan.warnings.push(
        item.error === 'not_found'
          ? `“${link.label}”: a Pluggy não encontrou essa conexão. Confira o Item ID.`
          : `“${link.label}”: não foi possível ler os dados agora${item.detail ? ` (${item.detail})` : ''}. Tente de novo mais tarde.`,
      )
      plan.links.push({ ...link, status: item.status })
      continue
    }
    if (item.status && item.status !== 'UPDATED' && item.status !== 'UPDATING') {
      plan.warnings.push(`“${link.label}”: a conexão está com a situação ${item.status}. Reconecte o banco no Meu Pluggy para receber dados novos.`)
    }

    const map = { ...link.map }
    const balances = { ...(link.balances ?? {}) }
    const own = response.accounts.filter((a) => a.itemId === link.id)
    for (const a of own) {
      const window = response.transactions.filter((t) => t.accountId === a.id && t.date >= link.since && !t.pending)
      let target = map[a.id] as BankLink['map'][string] | undefined
      const valid = target && (target.kind === 'ignore' || (target.kind === 'account' && (accountIds.has(target.id!) || plan.accounts.some((x) => x.id === target!.id))) || (target.kind === 'card' && (cardIds.has(target.id!) || plan.cards.some((x) => x.id === target!.id))))
      if (!valid) {
        const sameKind = own.filter((x) => x.kind === a.kind).length
        const name = sameKind > 1 ? `${link.label} · ${a.name}` : link.label
        if (a.kind === 'card') {
          const c: Card = {
            id: newId(),
            name: sameKind > 1 ? name : `${link.label} (cartão)`,
            closingDay: dayOf(a.closeDate) ?? 1,
            dueDay: dayOf(a.dueDate) ?? 10,
            limit: a.creditLimit ?? undefined,
            color: COLORS[color++ % COLORS.length],
          }
          plan.cards.push(c)
          target = { kind: 'card', id: c.id }
          if (!a.closeDate || !a.dueDate) plan.warnings.push(`Confira o fechamento e o vencimento do cartão “${c.name}” em Cartões: o banco não informou.`)
        } else {
          // saldo inicial = saldo do banco hoje menos o que se moveu desde a data de início, para o saldo do Finn bater com o do banco
          const net = window.reduce((s, t) => s + (t.direction === 'in' ? t.amount : -t.amount), 0)
          const acc: Account = {
            id: newId(),
            name,
            kind: /SAVINGS/.test(a.subtype) ? 'savings' : 'checking',
            openingBalance: round2(a.balance - net),
            openingDate: link.since,
            color: COLORS[color++ % COLORS.length],
          }
          plan.accounts.push(acc)
          target = { kind: 'account', id: acc.id }
        }
        map[a.id] = target
      }
      if (a.kind === 'bank') balances[a.id] = a.balance
      const tgt = target!
      if (tgt.kind === 'ignore') continue

      for (const t of window) {
        const id = txId(t)
        if (known.has(id)) {
          plan.stats.known++
          continue
        }
        if (tgt.kind === 'card' && t.direction === 'in') {
          plan.stats.ignored++ // pagamento da fatura ou estorno: não é despesa nem receita
          continue
        }
        const type = t.direction === 'in' ? 'income' : 'expense'
        const description = t.installment ? `${t.description} (${t.installment.n}/${t.installment.total})` : t.description
        const tx: Transaction = {
          id,
          description,
          amount: round2(t.amount),
          type,
          category: pickCategory(t.category, t.description, type, history),
          date: t.date,
          ...(tgt.kind === 'card' ? { cardId: tgt.id } : { accountId: tgt.id }),
        }
        if (tgt.kind === 'account' && type === 'expense' && isCardBillPayment(t.description)) {
          plan.skipped.push({ tx, reason: 'invoice' })
          continue
        }
        const k = slot(t.date, type, tx.amount)
        const mine = manual.get(k)?.shift() // cada lançamento manual "absorve" um movimento do banco
        if (mine) {
          if (!mine.accountId && !mine.cardId) plan.patches.push({ id: mine.id, ...(tgt.kind === 'card' ? { cardId: tgt.id } : { accountId: tgt.id }) })
          plan.skipped.push({ tx, reason: 'maybe' })
          continue
        }
        known.add(id)
        plan.txs.push(tx)
      }
    }
    plan.links.push({ ...link, map, balances, status: item.status, lastSync: now.toISOString() })
  }
  plan.stats.added = plan.txs.length
  plan.stats.skipped = plan.skipped.length
  plan.stats.linked = plan.patches.length
  return plan
}

/** Confere se o app deve atualizar sozinho ao abrir (última sincronização há mais de `hours` horas). */
export function needsAutoSync(links: BankLink[], now = new Date(), hours = 6): boolean {
  return links.some((l) => !l.lastSync || now.getTime() - Date.parse(l.lastSync) > hours * 3600_000)
}

export const defaultSince = (now = new Date(), days = 90) => toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days))

/** Pedido de sincronização enviado à função do Supabase. */
export const syncRequest = (links: BankLink[]) => ({
  action: 'sync' as const,
  items: links.map((l) => l.id),
  from: links.map((l) => l.since).sort()[0],
})
