import http from 'node:http'
import { expect, test } from '@playwright/test'
import { handle, MAX_PER_EMAIL, MAX_PER_IP, WINDOW_MS } from '../../supabase/functions/access/index'

/** Servidor único que faz o papel do Supabase Auth (senha) e do PostgREST (tabela login_attempts). */
async function startFake() {
  const rows: Array<{ at: string; email: string; ok: boolean; locked: boolean; ip: string | null; ua: string | null }> = []
  const state = { password: 'certa', authStatus: 200, restDown: false, clock: Date.parse('2026-09-30T12:00:00Z'), deletes: 0 }
  const seen: Array<{ method: string; url: string; headers: http.IncomingHttpHeaders }> = []
  const srv = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers })
      const send = (code: number, obj: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(obj))
      }
      const u = new URL(req.url ?? '/', 'http://x')
      if (u.pathname === '/auth/v1/token') {
        const b = JSON.parse(raw)
        if (state.authStatus !== 200) return send(state.authStatus, { msg: 'x' })
        return b.password === state.password ? send(200, { access_token: 'AT', refresh_token: 'RT', user: { id: 'u1' } }) : send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      }
      if (u.pathname === '/rest/v1/login_attempts') {
        if (state.restDown) return send(500, { message: 'down' })
        if (req.method === 'POST') {
          rows.push({ at: new Date(state.clock).toISOString(), locked: false, ...JSON.parse(raw) })
          return send(201, {})
        }
        if (req.method === 'DELETE') {
          state.deletes++
          return send(204, {})
        }
        const p = u.searchParams
        const eq = (v: string | null) => v?.replace(/^eq\./, '')
        let list = rows.filter((r) => (p.get('email') ? r.email === eq(p.get('email')) : true) && (p.get('ip') ? r.ip === eq(p.get('ip')) : true) && (p.get('ok') ? String(r.ok) === eq(p.get('ok')) : true) && (p.get('locked') ? String(r.locked) === eq(p.get('locked')) : true))
        const gt = p.get('at')?.replace(/^gt\./, '')
        if (gt) list = list.filter((r) => Date.parse(r.at) > Date.parse(gt))
        list = list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, Number(p.get('limit') ?? 100))
        return send(200, list.map((r) => ({ at: r.at })))
      }
      send(404, {})
    })
  })
  await new Promise<void>((r) => srv.listen(0, r))
  const base = `http://localhost:${(srv.address() as { port: number }).port}`
  const env = (over: Record<string, string> = {}) => {
    const m: Record<string, string> = { SUPABASE_URL: base, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ...over }
    return { get: (k: string) => m[k] }
  }
  const login = (email: string, password: string, headers: Record<string, string> = { 'x-forwarded-for': '1.2.3.4, 10.0.0.1', 'user-agent': 'TestBrowser/1' }) =>
    handle(new Request('http://fn/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'login', email, password }) }), env(), fetch, () => state.clock).then((r) => r.json())
  return { rows, state, seen, env, login, close: () => new Promise<void>((r) => srv.close(() => r())) }
}

test('login certo devolve a sessão e é registrado com e-mail, IP e aparelho', async () => {
  const f = await startFake()
  try {
    const r = await f.login('  Me@X.com ', 'certa')
    expect(r).toEqual({ session: { access_token: 'AT', refresh_token: 'RT' } })
    expect(f.rows).toHaveLength(1)
    expect(f.rows[0]).toMatchObject({ email: 'me@x.com', ok: true, locked: false, ip: '1.2.3.4', ua: 'TestBrowser/1' })
    // a chave de serviço só vai para a tabela; a senha só para o Auth
    const rest = f.seen.filter((s) => s.url.startsWith('/rest/'))
    expect(rest.every((s) => s.headers.apikey === 'service' && s.headers.authorization === 'Bearer service')).toBe(true)
    expect(f.seen.some((s) => s.url.startsWith('/rest/') && s.method === 'POST' && JSON.stringify(s).includes('certa'))).toBe(false)
  } finally {
    await f.close()
  }
})

test('senha errada: mensagem igual para qualquer e-mail, registro da falha e aviso de tentativas restantes', async () => {
  const f = await startFake()
  try {
    const msgs: string[] = []
    for (let i = 1; i <= 4; i++) msgs.push((await f.login('me@x.com', 'errada')).message)
    expect(msgs[0]).toBe('E-mail ou senha incorretos.')
    expect(msgs[1]).toBe('E-mail ou senha incorretos.')
    expect(msgs[2]).toContain('Restam 2 tentativas')
    expect(msgs[3]).toContain('Restam 1 tentativa antes do bloqueio')
    expect((await f.login('naoexiste@x.com', 'errada')).message).toBe('E-mail ou senha incorretos.') // não revela se a conta existe
    expect(f.rows.filter((r) => !r.ok)).toHaveLength(5)
  } finally {
    await f.close()
  }
})

test(`depois de ${MAX_PER_EMAIL} erros bloqueia (inclusive a senha certa), e o bloqueio acaba sozinho`, async () => {
  const f = await startFake()
  try {
    for (let i = 0; i < MAX_PER_EMAIL; i++) await f.login('me@x.com', 'errada')
    const blocked = await f.login('me@x.com', 'certa') // mesmo com a senha certa
    expect(blocked.error).toBe('locked')
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.retryAfter).toBeLessThanOrEqual(WINDOW_MS / 1000)
    expect(blocked.message).toContain('Aguarde 15 minutos')
    expect(f.rows.at(-1)).toMatchObject({ ok: false, locked: true }) // a tentativa bloqueada fica registrada
    // tentativas bloqueadas não prolongam o bloqueio
    await f.login('me@x.com', 'certa')
    const again = await f.login('me@x.com', 'certa')
    expect(again.retryAfter).toBeLessThanOrEqual(blocked.retryAfter)
    // outro e-mail, mesmo IP, não é bloqueado só por isso
    expect((await f.login('outro@x.com', 'certa')).session).toBeTruthy()
    // passados 15 minutos, volta ao normal
    f.state.clock += WINDOW_MS + 1000
    expect((await f.login('me@x.com', 'certa')).session).toBeTruthy()
  } finally {
    await f.close()
  }
})

test('um acerto zera a contagem de erros do e-mail', async () => {
  const f = await startFake()
  try {
    for (let i = 0; i < MAX_PER_EMAIL - 1; i++) await f.login('me@x.com', 'errada')
    f.state.clock += 1000
    expect((await f.login('me@x.com', 'certa')).session).toBeTruthy()
    f.state.clock += 1000
    for (let i = 0; i < MAX_PER_EMAIL - 1; i++) expect((await f.login('me@x.com', 'errada')).error).toBe('invalid') // ainda não bloqueia
  } finally {
    await f.close()
  }
})

test(`o mesmo IP com ${MAX_PER_IP} erros em e-mails diferentes é bloqueado, e outro IP não`, async () => {
  const f = await startFake()
  try {
    for (let i = 0; i < MAX_PER_IP; i++) await f.login(`alvo${i}@x.com`, 'errada')
    expect((await f.login('novo@x.com', 'certa')).error).toBe('locked')
    expect((await f.login('novo@x.com', 'certa', { 'x-forwarded-for': '9.9.9.9' })).session).toBeTruthy()
  } finally {
    await f.close()
  }
})

test('entradas inválidas, falhas do Supabase e registro fora do ar', async () => {
  const f = await startFake()
  try {
    expect((await f.login('semarroba', 'x')).error).toBe('invalid')
    expect((await f.login('a@x.com', '')).error).toBe('invalid')
    expect((await f.login('a@x.com', 'x'.repeat(2000))).error).toBe('invalid')
    expect(f.rows).toHaveLength(0) // entradas absurdas nem entram no registro

    f.state.authStatus = 429
    expect((await f.login('a@x.com', 'certa')).error).toBe('rate')
    f.state.authStatus = 503
    expect((await f.login('a@x.com', 'certa')).error).toBe('unavailable')
    f.state.authStatus = 200

    // se a tabela estiver fora do ar, o login ainda funciona (o bloqueio é reforço, não requisito)
    f.state.restDown = true
    expect((await f.login('a@x.com', 'certa')).session).toBeTruthy()
    expect((await f.login('a@x.com', 'errada')).error).toBe('invalid')

    // sem a chave de serviço configurada, avisa em vez de falhar calado
    const r = await handle(new Request('http://fn/', { method: 'POST', body: JSON.stringify({ action: 'login', email: 'a@x.com', password: 'certa' }) }), f.env({ SUPABASE_SERVICE_ROLE_KEY: '' }))
    expect((await r.json()).error).toBe('not_configured')
    expect((await handle(new Request('http://fn/', { method: 'OPTIONS' }), f.env())).status).toBe(204)
    expect((await handle(new Request('http://fn/'), f.env())).status).toBe(405)
  } finally {
    await f.close()
  }
})
