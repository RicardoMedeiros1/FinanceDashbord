import type { Remote, Row } from './types'

export const COLS = ['txs', 'subs', 'budgets', 'goals', 'installments', 'rules', 'receipts', 'cards', 'profile'] as const
export type Col = (typeof COLS)[number]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Item = any
export type Collections = Record<Col, Item[]>

export interface Change {
  col: Col
  id: string
  item: Item | null // null = remover
}

export type SyncState = 'idle' | 'syncing' | 'ok' | 'offline' | 'error'
export interface SyncStatus {
  state: SyncState
  lastSync: number | null
  error?: string
}

export interface SyncIO {
  /** Estado local mais recente (síncrono). */
  get(): Collections
  /** Aplica mudanças vindas da nuvem no estado local (síncrono, atualiza o que `get` devolve). */
  apply(changes: Change[]): void
  onStatus(s: SyncStatus): void
}

/** Registros de orçamento não têm id: a categoria é a chave. */
export const keyOf = (col: Col, item: Item): string => String(col === 'budgets' ? item.category : item.id)

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** Hash de 53 bits (cyrb53): pequeno o bastante para guardar um por registro. */
function hash(item: unknown): string {
  const s = stable(item)
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

/** Aplica mudanças a uma lista (função pura, usada no estado do React e no espelho síncrono). */
export function applyChanges(list: Item[], col: Col, changes: Change[]): Item[] {
  const mine = changes.filter((c) => c.col === col)
  if (!mine.length) return list
  const byId = new Map(mine.map((c) => [c.id, c.item]))
  const out: Item[] = []
  const seen = new Set<string>()
  for (const it of list) {
    const k = keyOf(col, it)
    if (byId.has(k)) {
      seen.add(k)
      const next = byId.get(k)
      if (next !== null) out.push(next)
    } else out.push(it)
  }
  for (const c of mine) if (c.item !== null && !seen.has(c.id)) out.push(c.item)
  return out
}

/**
 * Sincronização local-first, por registro:
 * - envia só o que mudou desde o último envio (comparando hashes) e usa "tombstones" para exclusões;
 * - traz da nuvem só o que mudou desde a última busca (cursor `synced_at` do servidor, com folga de 5s);
 * - se o mesmo registro mudou nos dois lados, vale o que foi alterado aqui (e sobrescreve a nuvem no envio).
 */
export class SyncEngine {
  private remote: Remote
  private io: SyncIO
  private storeKey: string
  private snap: Record<string, string> = {}
  private cursor: string | null = null
  private chain: Promise<unknown> = Promise.resolve()
  private timer: ReturnType<typeof setTimeout> | null = null
  private unsub: (() => void) | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private disposed = false
  private lastSync: number | null = null
  private onOnline = () => void this.sync()
  private onVisible = () => {
    if (document.visibilityState === 'visible') void this.sync()
  }

  constructor(remote: Remote, io: SyncIO, storeKey: string) {
    this.remote = remote
    this.io = io
    this.storeKey = storeKey
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? 'null')
      if (saved) {
        this.snap = saved.snap ?? {}
        this.cursor = saved.cursor ?? null
      }
    } catch {
      /* começa do zero */
    }
  }

  start() {
    this.unsub = this.remote.subscribe(() => this.schedule(400))
    window.addEventListener('online', this.onOnline)
    document.addEventListener('visibilitychange', this.onVisible)
    this.interval = setInterval(() => void this.sync(), 60_000)
    return this.sync()
  }

  dispose() {
    this.disposed = true
    this.unsub?.()
    window.removeEventListener('online', this.onOnline)
    document.removeEventListener('visibilitychange', this.onVisible)
    if (this.interval) clearInterval(this.interval)
    if (this.timer) clearTimeout(this.timer)
  }

  /** Agenda uma sincronização (chamado a cada mudança local). */
  schedule(delay = 800) {
    if (this.disposed) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delay)
  }

  /** Busca e depois envia, uma de cada vez. Nunca lança: erros viram status. */
  sync(): Promise<void> {
    const run = async () => {
      if (this.disposed) return
      this.io.onStatus({ state: 'syncing', lastSync: this.lastSync })
      try {
        await this.pull()
        await this.push()
        this.lastSync = Date.now()
        this.io.onStatus({ state: 'ok', lastSync: this.lastSync })
      } catch (e) {
        const offline = !navigator.onLine || e instanceof TypeError
        this.io.onStatus({ state: offline ? 'offline' : 'error', lastSync: this.lastSync, error: e instanceof Error ? e.message : String(e) })
      }
    }
    this.chain = this.chain.then(run, run)
    return this.chain as Promise<void>
  }

  private persist() {
    if (this.disposed) return
    try {
      localStorage.setItem(this.storeKey, JSON.stringify({ snap: this.snap, cursor: this.cursor }))
    } catch {
      /* armazenamento cheio: a próxima sincronização refaz */
    }
  }

  private index(): Map<string, Item> {
    const local = this.io.get()
    const idx = new Map<string, Item>()
    for (const col of COLS) for (const it of local[col] ?? []) idx.set(`${col}/${keyOf(col, it)}`, it)
    return idx
  }

  private async pull() {
    const since = this.cursor ? new Date(Date.parse(this.cursor) - 5000).toISOString() : null
    const rows = await this.remote.fetchAll(since)
    if (this.disposed) return // encerrado (ex.: saiu da conta) durante a busca
    const idx = this.index()
    const changes: Change[] = []
    let newest = this.cursor ? Date.parse(this.cursor) : 0
    let newestRaw = this.cursor

    for (const r of rows) {
      const ts = r.synced_at ? Date.parse(r.synced_at) : 0
      if (ts > newest) {
        newest = ts
        newestRaw = r.synced_at ?? newestRaw
      }
      if (!(COLS as readonly string[]).includes(r.collection)) continue
      const col = r.collection as Col
      const k = `${col}/${r.id}`
      const local = idx.get(k)
      const dirty = (local === undefined ? undefined : hash(local)) !== this.snap[k]
      if (dirty) continue // alteração local pendente vence
      if (r.deleted) {
        if (local !== undefined) changes.push({ col, id: r.id, item: null })
        delete this.snap[k]
      } else {
        const h = hash(r.data)
        if (local === undefined || hash(local) !== h) changes.push({ col, id: r.id, item: r.data })
        this.snap[k] = h
      }
    }
    if (changes.length) this.io.apply(changes)
    this.cursor = newestRaw
    this.persist()
  }

  private async push() {
    const idx = this.index()
    const rows: Row[] = []
    const sent: Record<string, string | null> = {}
    for (const [k, item] of idx) {
      const h = hash(item)
      if (this.snap[k] === h) continue
      const [col, ...rest] = k.split('/')
      rows.push({ collection: col, id: rest.join('/'), data: item, deleted: false })
      sent[k] = h
    }
    for (const k of Object.keys(this.snap)) {
      if (idx.has(k)) continue
      const [col, ...rest] = k.split('/')
      rows.push({ collection: col, id: rest.join('/'), data: {}, deleted: true })
      sent[k] = null
    }
    if (!rows.length) return
    await this.remote.upsert(rows)
    if (this.disposed) return
    for (const [k, h] of Object.entries(sent)) {
      if (h === null) delete this.snap[k]
      else this.snap[k] = h
    }
    this.persist()
  }
}

export function countLocal(c: Collections): number {
  return COLS.reduce((n, col) => n + (c[col]?.length ?? 0), 0)
}
