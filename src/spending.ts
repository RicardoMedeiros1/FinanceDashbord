// "Onde gasto": agrupa as despesas por estabelecimento e por tipo (padaria, mercado livre...). Funções puras.
import { normDesc } from './importer'
import { monthKey, shiftMonth, toISO } from './lib'
import type { SpendGroup, Transaction } from './types'

/** Só letras e números, sem acento: "MERCADOLIVRE*12AB" e "Mercado Livre" ficam comparáveis. */
export const squash = (s: string) => normDesc(s).replace(/[^a-z0-9]/g, '')

// marcas conhecidas: várias grafias do extrato viram um único nome
const BRANDS: Array<[RegExp, string]> = [
  [/mercado ?pago/, 'Mercado Pago'],
  [/mercado ?livre|\bmeli\b/, 'Mercado Livre'],
  [/amazon|amzn/, 'Amazon'],
  [/ifood|\bifd\b/, 'iFood'],
  [/uber ?eats/, 'Uber Eats'],
  [/\buber\b/, 'Uber'],
  [/\b99 ?(pop|app|taxi)?\b/, '99'],
  [/shopee/, 'Shopee'],
  [/magalu|magazine ?luiza/, 'Magalu'],
  [/aliexpress/, 'AliExpress'],
  [/netflix/, 'Netflix'],
  [/spotify/, 'Spotify'],
  [/shein/, 'Shein'],
]

const PREFIXES = /^(pagamento efetuado|compra no d[eé]bito|compra no cr[eé]dito|compra d[eé]bito|compra cr[eé]dito|compra|pix (enviado|recebido)|transfer[eê]ncia (enviada|recebida)|d[eé]bito autom[aá]tico|pagto|pgto)\s*[-:|]?\s*/i

const title = (s: string) => s.toLowerCase().replace(/(^|[\s/.-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())

/** Tira prefixo de operação, código depois do asterisco e números longos; mantém acentos. */
function clean(s: string): string {
  let n = s.trim().replace(PREFIXES, '')
  const star = n.indexOf('*')
  if (star >= 3) n = n.slice(0, star) // "LOJA*AB12CD": o código depois do asterisco não faz parte do nome
  return n.replace(/\b\d{4,}\b/g, '').replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Nome do estabelecimento a partir da descrição do extrato: sem prefixos, códigos e número de parcela. */
export function merchantName(description: string): { key: string; name: string } {
  // "Pagamento efetuado|PADARIA X": o que importa vem depois da última barra vertical
  let raw = description.includes('|') ? description.split('|').pop()! : description
  raw = raw.replace(/\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)\s*$/, '').replace(/\bparc(ela)?\.? ?\d{1,2}\s*\/\s*\d{1,2}\s*$/i, '')
  const n = normDesc(raw)
  for (const [re, name] of BRANDS) if (re.test(n)) return { key: squash(name), name }
  const c = clean(raw)
  if (!squash(c)) return { key: squash(description) || 'sem-nome', name: description.trim() || 'Sem descrição' }
  return { key: squash(c), name: title(c) }
}

/** "padaria, panificadora" → ['padaria', 'panificadora'] */
export const parseTerms = (input: string) =>
  input
    .split(/[,;|+]/)
    .map(squash)
    .filter((t) => t.length >= 2)

export const matchesTerms = (description: string, terms: string[]) => {
  if (terms.length === 0) return false
  const d = squash(description)
  return terms.some((t) => d.includes(t))
}

export interface Suggestion {
  name: string
  terms: string
}

/** Grupos prontos para começar; o usuário também cria os próprios. */
export const SUGGESTIONS: Suggestion[] = [
  { name: 'Mercado Livre', terms: 'mercado livre, mercadolivre' },
  { name: 'Amazon', terms: 'amazon, amzn' },
  { name: 'Padaria', terms: 'padaria, panificadora, padoca, confeitaria' },
  { name: 'Supermercado', terms: 'supermerc, atacadao, assai, carrefour, pao de acucar, hortifruti, sacolao' },
  { name: 'Delivery', terms: 'ifood, rappi, uber eats, aiqfome, 99food' },
  { name: 'Restaurantes', terms: 'restaurante, lanchonete, pizzaria, churrascaria, hamburgueria, burger, sushi' },
  { name: 'Uber e 99', terms: 'uber, 99 pop, 99app, cabify' },
  { name: 'Farmácia', terms: 'farmacia, drogaria, drogasil, droga raia, pague menos, panvel' },
  { name: 'Combustível', terms: 'posto, combustivel, ipiranga, petrobras, shell' },
]

export type Period = '1m' | '3m' | '6m' | '12m' | 'all'
export const PERIOD_LABEL: Record<Period, string> = { '1m': 'Este mês', '3m': '3 meses', '6m': '6 meses', '12m': '12 meses', all: 'Tudo' }

/** Primeiro dia do período (meses de calendário, contando o atual); '' = sem limite. */
export function periodStart(p: Period, today = toISO(new Date())): string {
  if (p === 'all') return ''
  const n = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[p]
  const d = new Date(`${today}T12:00:00`)
  return `${monthKey(shiftMonth(d, -(n - 1)))}-01`
}

/** Despesas do período, sem as futuras. */
export const expensesIn = (txs: Transaction[], p: Period, today = toISO(new Date())) => {
  const from = periodStart(p, today)
  return txs.filter((t) => t.type === 'expense' && t.date <= today && (!from || t.date >= from))
}

export interface Summary {
  total: number
  count: number
  avg: number
  max: Transaction | null
  last: string
  byMonth: Array<{ month: string; total: number }>
}

export function summarize(list: Transaction[], p: Period, today = toISO(new Date())): Summary {
  const total = list.reduce((s, t) => s + t.amount, 0)
  const count = list.length
  const max = list.reduce<Transaction | null>((m, t) => (!m || t.amount > m.amount ? t : m), null)
  const last = list.reduce((d, t) => (t.date > d ? t.date : d), '')
  // um item por mês, inclusive os sem gasto, do início do período até hoje (no máximo 24)
  const first = p === 'all' ? list.reduce((d, t) => (!d || t.date < d ? t.date : d), '') : periodStart(p, today)
  const byMonth: Summary['byMonth'] = []
  if (first) {
    const end = new Date(`${today}T12:00:00`)
    let cur = new Date(`${first.slice(0, 7)}-01T12:00:00`)
    while (monthKey(cur) <= monthKey(end) && byMonth.length < 24) {
      byMonth.push({ month: monthKey(cur), total: 0 })
      cur = shiftMonth(cur, 1)
    }
    for (const t of list) {
      const m = byMonth.find((x) => x.month === t.date.slice(0, 7))
      if (m) m.total += t.amount
    }
  }
  return { total, count, avg: count ? total / count : 0, max, last, byMonth }
}

export interface Merchant {
  key: string
  name: string
  total: number
  count: number
  last: string
}

/** Ranking dos estabelecimentos por quanto foi gasto. */
export function rankMerchants(list: Transaction[]): Merchant[] {
  const map = new Map<string, Merchant>()
  for (const t of list) {
    const { key, name } = merchantName(t.description)
    const m = map.get(key) ?? { key, name, total: 0, count: 0, last: '' }
    m.total += t.amount
    m.count++
    if (t.date > m.last) m.last = t.date
    map.set(key, m)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** As despesas que batem com a busca (nome do estabelecimento ou qualquer palavra do grupo). */
export const searchSpending = (list: Transaction[], query: string) => {
  const terms = parseTerms(query)
  return list.filter((t) => matchesTerms(t.description, terms)).sort((a, b) => b.date.localeCompare(a.date))
}

/** Só as despesas de um estabelecimento (pelo nome normalizado, sem "conter"). */
export const filterMerchant = (list: Transaction[], key: string) =>
  list.filter((t) => merchantName(t.description).key === key).sort((a, b) => b.date.localeCompare(a.date))

export interface GroupLimit {
  group: SpendGroup & { limit: number }
  spent: number
  count: number
  pct: number
  state: '' | 'warn' | 'over'
}

/** Quanto foi gasto neste mês nas despesas que batem com as palavras do grupo. */
export function groupSpent(group: SpendGroup, txs: Transaction[], today = toISO(new Date())) {
  const terms = parseTerms(group.terms)
  const hit = expensesIn(txs, '1m', today).filter((t) => matchesTerms(t.description, terms))
  return { spent: hit.reduce((s, t) => s + t.amount, 0), count: hit.length }
}

/** Grupos com limite mensal: quanto já foi gasto neste mês (só despesas até hoje) e em que situação está. */
export function groupLimits(groups: SpendGroup[], txs: Transaction[], today = toISO(new Date())): GroupLimit[] {
  return groups
    .filter((g): g is SpendGroup & { limit: number } => typeof g.limit === 'number' && g.limit > 0)
    .map((group) => {
      const { spent, count } = groupSpent(group, txs, today)
      const pct = (spent / group.limit) * 100
      return { group, spent, count, pct, state: pct >= 100 ? ('over' as const) : pct >= 80 ? ('warn' as const) : ('' as const) }
    })
}
