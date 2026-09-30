import type { CategoryId, Transaction } from './types'

/** Uma linha do extrato como veio no arquivo (valor com o sinal original). */
export interface ImportRow {
  date: string // yyyy-mm-dd
  description: string
  amount: number
  fitid?: string
}

export interface ParsedStatement {
  format: 'ofx' | 'csv'
  rows: ImportRow[]
}

export interface CsvTable {
  rows: string[][]
  headerIndex: number // -1 se não achou cabeçalho
  columns: { date: number; description: number; amount: number; credit: number; debit: number }
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const normDesc = (s: string) => strip(s).replace(/\s+/g, ' ').trim()

/** Bancos brasileiros costumam exportar em windows-1252; tenta UTF-8 e cai para 1252. */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

/** Aceita "1.234,56", "-1234.56", "R$ 1.234,56", "(123,45)", "123,45-". Devolve null se não for número. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/R\$|\s| /g, '')
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    neg = true
    s = s.slice(0, -1)
  }
  if (s.startsWith('-')) {
    neg = true
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let decimal: ',' | '.' | null = null
  if (lastComma >= 0 && lastDot >= 0) decimal = lastComma > lastDot ? ',' : '.'
  else if (lastComma >= 0) decimal = ','
  else if (lastDot >= 0) decimal = /^\d{1,3}(\.\d{3})+$/.test(s) ? null : '.'
  let norm = s
  if (decimal === ',') norm = s.replace(/\./g, '').replace(',', '.')
  else if (decimal === '.') norm = s.replace(/,/g, '')
  else norm = s.replace(/[.,]/g, '')
  const n = Number(norm)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

const MONTHS: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 }
const pad = (n: number) => String(n).padStart(2, '0')

function validIso(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/** yyyymmdd (OFX), yyyy-mm-dd, dd/mm/yyyy, dd/mm/yy, dd-mm-yyyy, dd.mm.yyyy, "05 out 2026", "5 de outubro de 2026". */
export function parseDate(raw: string): string | null {
  const s = strip(raw).trim()
  let m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?(?!\d)/) // OFX: 20260930 ou 20260930120000[...]
  if (m) return validIso(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return validIso(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)/)
  if (m) return validIso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  m = s.match(/^(\d{1,2})\s*(?:de\s+)?([a-z]{3})[a-z]*\.?\s*(?:de\s+)?(\d{4})/)
  if (m && MONTHS[m[2]]) return validIso(+m[3], MONTHS[m[2]], +m[1])
  return null
}

// ---------------- OFX ----------------

function tag(block: string, name: string): string {
  // OFX 1.x (SGML) não fecha as tags; OFX 2.x (XML) fecha. Os dois casos: pega até a próxima "<" ou quebra de linha.
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : ''
}

const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

export function parseOfx(text: string): ImportRow[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTTRNRS>|$)/gi) ?? []
  const rows: ImportRow[] = []
  for (const b of blocks) {
    const date = parseDate(tag(b, 'DTPOSTED'))
    const amount = parseAmount(tag(b, 'TRNAMT'))
    if (!date || amount === null) continue
    const memo = decodeEntities(tag(b, 'MEMO'))
    const name = decodeEntities(tag(b, 'NAME'))
    const description = [name, memo].filter((x, i, a) => x && a.indexOf(x) === i).join(' - ') || 'Sem descrição'
    const fitid = tag(b, 'FITID')
    rows.push({ date, description, amount, fitid: fitid || undefined })
  }
  return rows
}

// ---------------- CSV ----------------

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 15).join('\n')
  const count = (d: string) => (sample.match(new RegExp(d === '\t' ? '\\t' : `\\${d}`, 'g')) ?? []).length
  const best = [';', '\t', ',', '|'].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : ','
}

/** Divide o CSV respeitando aspas (e quebras de linha dentro de aspas). */
export function splitCsv(text: string, delim = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()))
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()))
  return rows
}

/** Acha o cabeçalho e as colunas de data, descrição, valor e (se separados) crédito/débito. */
export function readCsv(text: string): CsvTable {
  const rows = splitCsv(text)
  const none = { date: -1, description: -1, amount: -1, credit: -1, debit: -1 }
  const isDateHead = (h: string) => /^(data|date|dt)\b|\bdata\b|\bdate\b/.test(h)
  const isAmountHead = (h: string) => /^(valor|amount|quantia|montante)|\bvalor\b|\bamount\b/.test(h)
  const isCredit = (h: string) => /credito|entrada|\bcredit\b/.test(h)
  const isDebit = (h: string) => /debito|saida|\bdebit\b/.test(h)
  const isDesc = (h: string) => /descri|historico|lancamento|estabelecimento|titulo|title|memo|detalhe|nome|\bdescription\b/.test(h)

  let headerIndex = -1
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const heads = rows[r].map(strip)
    const hasDate = heads.some(isDateHead)
    const hasMoney = heads.some((h) => isAmountHead(h) || isCredit(h) || isDebit(h))
    if (hasDate && hasMoney) {
      headerIndex = r
      break
    }
  }

  const columns = { ...none }
  if (headerIndex >= 0) {
    const heads = rows[headerIndex].map(strip)
    heads.forEach((h, i) => {
      if (columns.date < 0 && isDateHead(h)) columns.date = i
    })
    heads.forEach((h, i) => {
      if (i === columns.date) return
      if (columns.credit < 0 && isCredit(h) && !isAmountHead(h)) columns.credit = i
      else if (columns.debit < 0 && isDebit(h) && !isAmountHead(h)) columns.debit = i
      else if (columns.amount < 0 && isAmountHead(h)) columns.amount = i
    })
    heads.forEach((h, i) => {
      if (columns.description < 0 && i !== columns.date && i !== columns.amount && i !== columns.credit && i !== columns.debit && isDesc(h)) columns.description = i
    })
  } else {
    // sem cabeçalho reconhecível: adivinha pelo conteúdo da primeira linha de dados
    const first = rows.find((r) => r.some((c) => parseDate(c)) && r.some((c) => parseAmount(c) !== null && !parseDate(c)))
    if (first) {
      columns.date = first.findIndex((c) => parseDate(c))
      columns.amount = first.findIndex((c, i) => i !== columns.date && parseAmount(c) !== null)
      const texts = first.map((c, i) => [c, i] as const).filter(([c, i]) => i !== columns.date && i !== columns.amount && c && parseAmount(c) === null)
      columns.description = texts.sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? -1
    }
  }
  return { rows, headerIndex, columns }
}

export function csvToRows(table: CsvTable, cols = table.columns): ImportRow[] {
  const out: ImportRow[] = []
  const start = table.headerIndex >= 0 ? table.headerIndex + 1 : 0
  for (const r of table.rows.slice(start)) {
    const date = cols.date >= 0 ? parseDate(r[cols.date] ?? '') : null
    if (!date) continue
    let amount: number | null = null
    if (cols.amount >= 0) amount = parseAmount(r[cols.amount] ?? '')
    else if (cols.credit >= 0 || cols.debit >= 0) {
      const c = cols.credit >= 0 ? parseAmount(r[cols.credit] ?? '') ?? 0 : 0
      const d = cols.debit >= 0 ? parseAmount(r[cols.debit] ?? '') ?? 0 : 0
      if ((r[cols.credit] ?? '').trim() === '' && (r[cols.debit] ?? '').trim() === '') continue
      amount = Math.abs(c) - Math.abs(d)
    }
    if (amount === null || amount === 0) continue
    out.push({ date, description: (cols.description >= 0 ? r[cols.description] : '') || 'Sem descrição', amount })
  }
  return out
}

/** OFX ou CSV, detectado pelo conteúdo. Devolve também a tabela do CSV para o mapeamento manual de colunas. */
export function parseStatement(text: string): { format: 'ofx' | 'csv'; rows: ImportRow[]; table?: CsvTable } {
  if (/<OFX>|<STMTTRN>|OFXHEADER/i.test(text)) return { format: 'ofx', rows: parseOfx(text) }
  const table = readCsv(text)
  return { format: 'csv', rows: csvToRows(table), table }
}

// ---------------- categorias, duplicados, ids ----------------

const RULES: [RegExp, CategoryId][] = [
  [/fatura|pagto cartao|pagamento cartao/, 'outros'],
  [/netflix|spotify|disney|prime video|amazon prime|youtube|hbo|max\b|globoplay|deezer|icloud|google one|apple\.com|paramount|crunchyroll/, 'assinaturas'],
  [/ifood|rappi|restaurante|lanchonete|padaria|panificadora|mercado|supermercado|carrefour|atacadao|assai|pao de acucar|extra\b|dia\b|hortifruti|acougue|burger|pizza|cafe\b|starbucks|mcdonald/, 'alimentacao'],
  [/posto|shell|ipiranga|combustivel|gasolina|estacionamento|pedagio|sem parar|conectcar|metro|cptm|bilhete|onibus|99 ?pop|99app|cabify/, 'transporte'],
  [/uber/, 'transporte'],
  [/farmacia|drogaria|droga ?raia|drogasil|pague menos|panvel|hospital|clinica|laboratorio|unimed|dentista|medico|plano de saude|amil|bradesco saude|sulamerica/, 'saude'],
  [/aluguel|condominio|enel|cpfl|light\b|cemig|copel|sabesp|copasa|celesc|energia|iptu|internet|vivo\b|claro\b|tim\b|oi\b|net ?claro|gas\b|comgas/, 'moradia'],
  [/cinema|ingresso|steam|playstation|xbox|nintendo|teatro|show|bar\b|balada|viagem|hotel|airbnb|booking|decolar/, 'lazer'],
  [/amazon|mercado ?livre|shopee|magalu|magazine|americanas|shein|aliexpress|kabum|casas bahia|renner|zara|c&a/, 'compras'],
  [/escola|curso|udemy|alura|faculdade|mensalidade|livraria|hotmart/, 'educacao'],
]

export function suggestCategory(description: string, type: 'income' | 'expense', history: Map<string, CategoryId>): CategoryId {
  const d = normDesc(description)
  if (type === 'income') {
    if (/salario|folha|proventos|vencimentos|13o|ferias/.test(d)) return 'salario'
    if (/uber|99 ?pop|99app|ifood|rappi|freela|repasse/.test(d)) return 'variavel'
    return history.get(d) && ['salario', 'variavel', 'renda'].includes(history.get(d)!) ? history.get(d)! : 'renda'
  }
  const exact = history.get(d)
  if (exact) return exact
  const key = d.split(' ').slice(0, 2).join(' ')
  const partial = history.get(`~${key}`)
  if (partial) return partial
  for (const [re, cat] of RULES) if (re.test(d)) return cat
  return 'outros'
}

/** Aprende com o histórico: descrição normalizada → categoria mais usada nas despesas/receitas já lançadas. */
export function buildHistory(txs: Transaction[]): Map<string, CategoryId> {
  const counts = new Map<string, Map<CategoryId, number>>()
  const bump = (k: string, c: CategoryId) => {
    const m = counts.get(k) ?? new Map<CategoryId, number>()
    m.set(c, (m.get(c) ?? 0) + 1)
    counts.set(k, m)
  }
  for (const t of txs) {
    const d = normDesc(t.description)
    if (!d) continue
    bump(d, t.category)
    bump(`~${d.split(' ').slice(0, 2).join(' ')}`, t.category)
  }
  const out = new Map<string, CategoryId>()
  for (const [k, m] of counts) out.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0])
  return out
}

/** Pagamento de fatura de cartão: as compras já contam no dia em que foram feitas. */
export function isInvoicePayment(description: string): boolean {
  const d = normDesc(description)
  return /pagamento (de )?fatura|pagto\.? ?fatura|pgto fatura|fatura (do )?cart|pagamento recebido|pagamento efetuado/.test(d)
}

/** Hash de 53 bits (cyrb53), para ids estáveis. */
export function hashString(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export type Interpretation = 'account' | 'card'
export type CandidateStatus = 'ok' | 'imported' | 'maybe' | 'invoice'

export interface Candidate {
  id: string
  date: string
  description: string
  type: 'income' | 'expense'
  amount: number
  category: CategoryId
  status: CandidateStatus
}

/**
 * Prepara as linhas para importar: tipo pelo sinal (extrato de conta: negativo = despesa; fatura de cartão: positivo = despesa),
 * categoria sugerida, id estável (não duplica se importar o mesmo arquivo de novo) e o estado de cada linha.
 */
export function buildCandidates(rows: ImportRow[], mode: Interpretation, existing: Transaction[]): Candidate[] {
  const history = buildHistory(existing)
  const ids = new Set(existing.map((t) => t.id))
  const sameSlot = new Set(existing.map((t) => `${t.date}|${t.type}|${t.amount.toFixed(2)}`))
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const raw = mode === 'card' ? -r.amount : r.amount
    const type = raw < 0 ? 'expense' : 'income'
    const amount = Math.abs(r.amount)
    const base = r.fitid ? `f:${r.fitid}` : `${r.date}|${r.amount.toFixed(2)}|${normDesc(r.description)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const id = `imp-${hashString(`${base}#${n}`)}`
    const invoice = isInvoicePayment(r.description)
    let status: CandidateStatus = 'ok'
    if (ids.has(id)) status = 'imported'
    else if (invoice) status = 'invoice'
    else if (sameSlot.has(`${r.date}|${type}|${amount.toFixed(2)}`)) status = 'maybe'
    return { id, date: r.date, description: r.description, type, amount, category: suggestCategory(r.description, type, history), status }
  })
}
