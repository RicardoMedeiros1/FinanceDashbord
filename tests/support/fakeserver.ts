import http from 'node:http'
import { URL } from 'node:url'

export interface FakeCloud {
  rows: Map<string, any>
  files: Map<string, { buf: Buffer; type: string }>
  state: {
    offline: boolean
    seq: number
    version: number
    fetches: string[]
    upserts: number
    password: string
    resets: string[]
    deleted: boolean
    /** simula a função "pluggy": `data` é o que a Pluggy tem; `error` faz a função responder com esse erro */
    pluggy: { data: any; error: string; requests: any[] }
    /** verificação em duas etapas: `enforce` imita a regra do banco (dados só com a sessão verificada) */
    mfa: { enrolled: boolean; pending: boolean; code: string; enforce: boolean; aal2: Set<string>; counter: number; enrollError: string }
  }
  close(): Promise<void>
}

/** Servidor HTTP que imita a nuvem (login, registros por usuário, arquivos). Só para testes. */
export async function startFakeCloud(port = 4300): Promise<FakeCloud> {
  const rows = new Map<string, any>()
  const files = new Map<string, { buf: Buffer; type: string }>()
  const state = { offline: false, seq: 0, version: 0, fetches: [] as string[], upserts: 0, password: 'pw', resets: [] as string[], deleted: false, pluggy: { data: null as any, error: '', requests: [] as any[] }, mfa: { enrolled: false, pending: false, code: '123456', enforce: false, aal2: new Set<string>(), counter: 0, enrollError: '' } }

  const srv = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', `http://localhost:${port}`)
    const q = Object.fromEntries(u.searchParams)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const send = (code: number, obj: unknown, type = 'application/json') => {
        res.writeHead(code, { 'Content-Type': type })
        res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj))
      }
      const path = u.pathname
      if (path === '/admin') {
        if ('offline' in q) state.offline = q.offline === '1'
        return send(200, { ok: true })
      }
      if (path === '/login') {
        const b = JSON.parse(body.toString())
        if (state.deleted || b.email !== 'me@x.com' || b.password !== state.password) return send(401, { error: 'bad' })
        // com 2FA cada login é uma sessão própria (começa sem a verificação)
        const token = state.mfa.enrolled || state.mfa.enforce ? `tok-${++state.mfa.counter}` : 'tok'
        return send(200, { userId: 'u1', token })
      }
      if (path === '/reset') {
        state.resets.push(JSON.parse(body.toString()).email)
        return send(200, { ok: true })
      }
      if (path === '/recover') return send(200, { userId: 'u1', token: state.mfa.enrolled || state.mfa.enforce ? `tok-${++state.mfa.counter}` : 'tok' }) // qualquer "link" vale
      if (state.offline) return send(503, { error: 'offline' })
      if (q.token !== 'tok' && !q.token?.startsWith('tok-')) return send(401, {})
      if (path.startsWith('/mfa/')) {
        const m = state.mfa
        // sem simular o 2FA (testes antigos), a sessão conta como cadastrada e verificada
        if (path === '/mfa/status') return send(200, m.enrolled || m.enforce ? { enrolled: m.enrolled, verified: m.aal2.has(q.token) } : { enrolled: true, verified: true })
        if (path === '/mfa/enroll') {
          if (m.enrollError) return send(400, { message: m.enrollError })
          m.pending = true
          return send(200, { factorId: 'f1', qr: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/Finn:me%40x.com?secret=JBSWY3DPEHPK3PXP&issuer=Finn' })
        }
        if (path === '/mfa/verify') {
          const b = JSON.parse(body.toString() || '{}')
          if (b.code !== m.code) return send(400, { error: 'bad_code' })
          if (m.pending) { m.enrolled = true; m.pending = false }
          m.aal2.add(q.token)
          return send(200, { ok: true })
        }
        if (path === '/mfa/unenroll') {
          if (!(q.token === 'tok' || m.aal2.has(q.token))) return send(403, {})
          m.enrolled = false
          m.pending = false
          return send(200, { ok: true })
        }
      }
      // regra do banco: com 2FA exigido, os dados só abrem para a sessão verificada
      if (state.mfa.enforce && q.token !== 'tok' && !state.mfa.aal2.has(q.token)) return send(403, { error: 'insufficient_aal' })
      if (path === '/delete-account') {
        rows.clear()
        files.clear()
        state.deleted = true
        return send(200, { ok: true })
      }
      if (path === '/pluggy') {
        const b = JSON.parse(body.toString())
        state.pluggy.requests.push(b)
        if (state.pluggy.error) return send(200, { error: 'not_configured', message: state.pluggy.error })
        const d = state.pluggy.data ?? { items: [], accounts: [], transactions: [] }
        const ids: string[] = b.items ?? []
        return send(200, {
          items: ids.map((id) => d.items.find((i: any) => i.id === id) ?? { id, connector: '', status: 'NOT_FOUND', updatedAt: null, error: 'not_found' }),
          accounts: d.accounts.filter((a: any) => ids.includes(a.itemId)),
          transactions: d.transactions.filter((t: any) => ids.includes(t.itemId)),
        })
      }
      if (path === '/password') {
        state.password = JSON.parse(body.toString()).password
        return send(200, { ok: true })
      }
      if (path === '/version') return send(200, String(state.version), 'text/plain')
      if (path === '/rows') {
        state.fetches.push(q.since || '')
        const since = q.since ? Date.parse(q.since) : 0
        return send(200, [...rows.values()].filter((r) => Date.parse(r.synced_at) > since).sort((a, b) => a.synced_at.localeCompare(b.synced_at)))
      }
      if (path === '/upsert') {
        const list = JSON.parse(body.toString())
        state.upserts++
        const now = Date.now()
        for (const r of list) {
          state.seq++
          rows.set(`${r.collection}/${r.id}`, { ...r, synced_at: new Date(now + state.seq).toISOString() })
        }
        state.version++
        return send(200, { ok: true })
      }
      if (path === '/file') {
        if (req.method === 'PUT') {
          files.set(q.path, { buf: body, type: (req.headers['content-type'] as string) || 'application/octet-stream' })
          return send(200, { ok: true })
        }
        if (req.method === 'DELETE') {
          files.delete(q.path)
          return send(200, { ok: true })
        }
        const f = files.get(q.path)
        return f ? send(200, f.buf, f.type) : send(404, {})
      }
      send(404, {})
    })
  })
  await new Promise<void>((resolve) => srv.listen(port, resolve))
  return { rows, files, state, close: () => new Promise((r) => srv.close(() => r())) }
}
