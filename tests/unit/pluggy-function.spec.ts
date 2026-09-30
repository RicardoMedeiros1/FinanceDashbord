import http from 'node:http'
import { expect, test } from '@playwright/test'
import { handle } from '../../supabase/functions/pluggy/index'

const ITEM = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const BAD = '00000000-0000-4000-8000-000000000000'

/** Servidor único que faz o papel do Supabase Auth e da API da Pluggy. */
async function startFake() {
  const seen: Array<{ url: string; key?: string }> = []
  const state = { authOk: true, txPages: 2 }
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x')
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      seen.push({ url: req.url ?? '', key: req.headers['x-api-key'] as string | undefined })
      if (u.pathname === '/auth/v1/user') {
        const ok = req.headers.authorization === 'Bearer good' && req.headers.apikey === 'anon'
        return ok ? send(200, { id: 'u1', email: 'Me@X.com' }) : send(401, { msg: 'bad jwt' })
      }
      if (u.pathname === '/auth') {
        const b = JSON.parse(raw)
        return state.authOk && b.clientId === 'cid' && b.clientSecret === 'sec' ? send(200, { apiKey: 'KEY' }) : send(403, {})
      }
      if (req.headers['x-api-key'] !== 'KEY') return send(403, {})
      if (u.pathname === `/items/${ITEM}`) return send(200, { id: ITEM, status: 'UPDATED', connector: { name: 'MeuPluggy' }, lastUpdatedAt: '2026-09-29T08:00:00.000Z' })
      if (u.pathname === `/items/${BAD}`) return send(404, { message: 'not found' })
      if (u.pathname === '/accounts') {
        return send(200, {
          results: [
            { id: 'a1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', number: '1234', balance: 1250.5, name: 'Conta', marketingName: 'Conta Ouro', creditData: null },
            { id: 'c1', type: 'CREDIT', subtype: 'CREDIT_CARD', number: '5678', balance: 300, name: 'Cartão', marketingName: null, creditData: { creditLimit: 8000, availableCreditLimit: 7000, balanceCloseDate: '2026-09-20T00:00:00.000Z', balanceDueDate: '2026-09-28T00:00:00.000Z' } },
          ],
        })
      }
      if (u.pathname === '/transactions') {
        const acc = u.searchParams.get('accountId')
        const page = Number(u.searchParams.get('page'))
        const t = (id: string, type: string, amount: number, extra: Record<string, unknown> = {}) => ({ id, date: '2026-09-10T00:00:00.000Z', description: 'Padaria', descriptionRaw: null, type, amount, category: 'Eating out', status: 'POSTED', creditCardMetadata: null, ...extra })
        const all: Record<string, unknown[][]> = {
          a1: [[t('t1', 'DEBIT', -32.5), t('t2', 'CREDIT', 5000, { description: 'SALARIO' })], [t('t3', 'DEBIT', -10, { status: 'PENDING' })]],
          c1: [[t('t4', 'DEBIT', 150, { creditCardMetadata: { installmentNumber: 2, totalInstallments: 6 } }), t('t5', 'CREDIT', -900, { description: 'Pagamento recebido' })]],
        }
        const pages = all[acc ?? ''] ?? [[]]
        return send(200, { results: pages[page - 1] ?? [], page, total: 9, totalPages: pages.length })
      }
      send(404, {})
    })
  })
  await new Promise<void>((r) => srv.listen(0, r))
  const port = (srv.address() as { port: number }).port
  const base = `http://localhost:${port}`
  const env = (over: Record<string, string> = {}) => {
    const m: Record<string, string> = { SUPABASE_URL: base, SUPABASE_ANON_KEY: 'anon', PLUGGY_API_URL: base, PLUGGY_CLIENT_ID: 'cid', PLUGGY_CLIENT_SECRET: 'sec', PLUGGY_ALLOWED_EMAILS: 'me@x.com', ...over }
    return { get: (k: string) => m[k] }
  }
  return { seen, state, env, close: () => new Promise<void>((r) => srv.close(() => r())) }
}

const call = (env: ReturnType<Awaited<ReturnType<typeof startFake>>['env']>, body: unknown, token = 'good') =>
  handle(new Request('http://fn/', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env)

test('só atende quem está logado e liberado, e sem credenciais configuradas explica o que falta', async () => {
  const f = await startFake()
  try {
    const body = { action: 'sync', items: [ITEM] }
    expect((await call(f.env(), body, 'ruim')).status).toBe(401)

    const forbidden = await (await call(f.env({ PLUGGY_ALLOWED_EMAILS: 'outro@x.com' }), body)).json()
    expect(forbidden.error).toBe('forbidden')
    const none = await (await call(f.env({ PLUGGY_ALLOWED_EMAILS: '' }), body)).json()
    expect(none.error).toBe('forbidden') // lista vazia = ninguém

    const notConfigured = await (await call(f.env({ PLUGGY_CLIENT_SECRET: '' }), body)).json()
    expect(notConfigured.error).toBe('not_configured')
    expect(notConfigured.message).toContain('PLUGGY_CLIENT_SECRET')

    const wrong = await (await call(f.env({ PLUGGY_CLIENT_SECRET: 'errado' }), body)).json()
    expect(wrong.error).toBe('pluggy_auth')
    // nada da Pluggy foi chamado antes de validar o usuário
    expect(f.seen.filter((s) => s.url.startsWith('/items')).length).toBe(0)
  } finally {
    await f.close()
  }
})

test('valida o pedido: Item ID no formato certo, no máximo 10, só a ação sync', async () => {
  const f = await startFake()
  try {
    for (const b of [{ action: 'sync', items: [] }, { action: 'sync', items: ['abc'] }, { action: 'sync', items: ['../accounts'] }, { action: 'outra', items: [ITEM] }, { action: 'sync', items: Array(11).fill(ITEM) }]) {
      expect((await (await call(f.env(), b)).json()).error).toBe('bad_request')
    }
    const opt = await handle(new Request('http://fn/', { method: 'OPTIONS' }), f.env())
    expect(opt.status).toBe(204)
    expect(opt.headers.get('access-control-allow-origin')).toBe('*')
    expect((await handle(new Request('http://fn/'), f.env())).status).toBe(405)
  } finally {
    await f.close()
  }
})

test('sincroniza contas, cartão e transações no formato simples do app', async () => {
  const f = await startFake()
  try {
    const res = await call(f.env(), { action: 'sync', items: [ITEM], from: '2026-08-01' })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.items).toEqual([{ id: ITEM, connector: 'MeuPluggy', status: 'UPDATED', updatedAt: '2026-09-29T08:00:00.000Z' }])
    expect(j.accounts.map((a: any) => [a.id, a.kind, a.name, a.balance])).toEqual([['a1', 'bank', 'Conta Ouro', 1250.5], ['c1', 'card', 'Cartão', 300]])
    const card = j.accounts[1]
    expect([card.creditLimit, card.availableCredit, card.closeDate, card.dueDate]).toEqual([8000, 7000, '2026-09-20', '2026-09-28'])

    // páginas seguidas até o fim; sentido vem do tipo, valor sempre positivo (com sinal negativo ou não)
    const t = Object.fromEntries(j.transactions.map((x: any) => [x.id, x]))
    expect(Object.keys(t).sort()).toEqual(['t1', 't2', 't3', 't4', 't5'])
    expect([t.t1.amount, t.t1.direction, t.t1.date]).toEqual([32.5, 'out', '2026-09-10'])
    expect([t.t2.amount, t.t2.direction]).toEqual([5000, 'in'])
    expect(t.t3.pending).toBe(true)
    expect(t.t4.installment).toEqual({ n: 2, total: 6 })
    expect([t.t5.amount, t.t5.direction]).toEqual([900, 'in'])
    expect(t.t1.category).toBe('Eating out')

    // usa a chave da API só do lado do servidor e o período pedido
    expect(f.seen.filter((s) => s.url.startsWith('/accounts')).every((s) => s.key === 'KEY')).toBe(true)
    expect(f.seen.some((s) => s.url.includes('from=2026-08-01') && s.url.includes('accountId=a1') && s.url.includes('pageSize=500'))).toBe(true)
    expect(JSON.stringify(j)).not.toContain('sec')
    expect(JSON.stringify(j)).not.toContain('KEY')
  } finally {
    await f.close()
  }
})

test('conexão inexistente não derruba as outras', async () => {
  const f = await startFake()
  try {
    const j = await (await call(f.env(), { action: 'sync', items: [BAD, ITEM] })).json()
    expect(j.items.map((i: any) => [i.id, i.error ?? null])).toEqual([[BAD, 'not_found'], [ITEM, null]])
    expect(j.accounts.length).toBe(2)
  } finally {
    await f.close()
  }
})
