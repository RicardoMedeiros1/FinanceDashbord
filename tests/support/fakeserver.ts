import http from 'node:http'
import { URL } from 'node:url'

export interface FakeCloud {
  rows: Map<string, any>
  files: Map<string, { buf: Buffer; type: string }>
  state: { offline: boolean; seq: number; version: number; fetches: string[]; upserts: number; password: string; resets: string[] }
  close(): Promise<void>
}

/** Servidor HTTP que imita a nuvem (login, registros por usuário, arquivos). Só para testes. */
export async function startFakeCloud(port = 4300): Promise<FakeCloud> {
  const rows = new Map<string, any>()
  const files = new Map<string, { buf: Buffer; type: string }>()
  const state = { offline: false, seq: 0, version: 0, fetches: [] as string[], upserts: 0, password: 'pw', resets: [] as string[] }

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
        return b.email === 'me@x.com' && b.password === state.password ? send(200, { userId: 'u1', token: 'tok' }) : send(401, { error: 'bad' })
      }
      if (path === '/reset') {
        state.resets.push(JSON.parse(body.toString()).email)
        return send(200, { ok: true })
      }
      if (path === '/recover') return send(200, { userId: 'u1', token: 'tok' }) // qualquer "link" vale
      if (state.offline) return send(503, { error: 'offline' })
      if (q.token !== 'tok') return send(401, {})
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
