// Edge Function "pluggy": ponte entre o Finn e a API da Pluggy (Meu Pluggy / Open Finance).
//
// Por que existe: as credenciais da Pluggy (client id e secret) NÃO podem ir para o navegador — o repositório
// e o app são públicos. Elas ficam só aqui, como "secrets" do Supabase. O app chama esta função já logado,
// e ela devolve contas e transações num formato simples.
//
// Arquivo único e sem imports, para poder ser colado direto no editor de Edge Functions do painel do Supabase.
// Passo a passo em docs/OPEN_FINANCE.md.

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void } | undefined

export interface Env {
  get(k: string): string | undefined
}

/** Conta bancária ou cartão de crédito. */
export interface BankAccount {
  id: string
  itemId: string
  kind: 'bank' | 'card'
  name: string
  subtype: string
  number: string
  balance: number
  creditLimit: number | null
  availableCredit: number | null
  closeDate: string | null // yyyy-mm-dd
  dueDate: string | null
}

/** Movimento; `amount` sempre positivo, o sentido vem de `direction`. */
export interface BankTx {
  id: string
  accountId: string
  itemId: string
  date: string // yyyy-mm-dd
  description: string
  amount: number
  direction: 'in' | 'out'
  category: string | null
  pending: boolean
  installment: { n: number; total: number } | null
}

export interface BankItem {
  id: string
  connector: string
  status: string
  updatedAt: string | null
  error?: 'not_found' | 'failed'
}

export interface BankSyncResponse {
  items: BankItem[]
  accounts: BankAccount[]
  transactions: BankTx[]
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
// Erros previstos voltam com status 200 e { error, message }: o app mostra a mensagem em português.
const fail = (error: string, message: string) => reply(200, { error, message })

const ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const MAX_PAGES = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function handle(req: Request, env: Env, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: 'method' })

  // 1) quem está chamando? (o painel do Supabase já exige um login válido; aqui confirmamos e pegamos o e-mail)
  const auth = req.headers.get('authorization') ?? ''
  const supaUrl = (env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
  const supaKey = env.get('SUPABASE_ANON_KEY') ?? ''
  let email = ''
  try {
    const r = await fetchFn(`${supaUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: supaKey } })
    if (!r.ok) return reply(401, { error: 'unauthorized', message: 'Sessão inválida. Entre de novo.' })
    email = String(((await r.json()) as any)?.email ?? '').toLowerCase()
  } catch {
    return reply(401, { error: 'unauthorized', message: 'Não foi possível confirmar o login.' })
  }
  if (!email) return reply(401, { error: 'unauthorized', message: 'Sessão inválida. Entre de novo.' })

  // 2) só e-mails liberados usam a sua conta da Pluggy (o Meu Pluggy é para uso pessoal)
  const allowed = (env.get('PLUGGY_ALLOWED_EMAILS') ?? '').split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!allowed.includes(email)) {
    return fail('forbidden', 'Este e-mail não está liberado para conectar bancos. Peça ao administrador para incluí-lo em PLUGGY_ALLOWED_EMAILS.')
  }

  const clientId = env.get('PLUGGY_CLIENT_ID')
  const clientSecret = env.get('PLUGGY_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return fail('not_configured', 'A conexão com a Pluggy ainda não foi configurada no Supabase (faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET).')
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'bad_request', message: 'Pedido inválido.' })
  }
  const items: string[] = Array.isArray(body?.items) ? body.items.map(String) : []
  if (body?.action !== 'sync' || items.length === 0 || items.length > 10 || !items.every((i) => ITEM_ID.test(i))) {
    return fail('bad_request', 'Informe o ID da conexão (Item ID) no formato correto.')
  }
  const from = typeof body.from === 'string' && DAY.test(body.from) ? body.from : new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  // 3) API da Pluggy
  const base = (env.get('PLUGGY_API_URL') ?? 'https://api.pluggy.ai').replace(/\/+$/, '')
  let apiKey = ''
  try {
    const r = await fetchFn(`${base}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    })
    if (!r.ok) return fail('pluggy_auth', 'A Pluggy recusou as credenciais (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET). Confira se copiou a aplicação certa.')
    apiKey = String(((await r.json()) as any)?.apiKey ?? '')
  } catch {
    return fail('pluggy_down', 'Não foi possível falar com a Pluggy agora. Tente de novo em instantes.')
  }
  const get = async (path: string): Promise<{ status: number; json: any }> => {
    const r = await fetchFn(`${base}${path}`, { headers: { 'X-API-KEY': apiKey, Accept: 'application/json' } })
    let json: any = null
    try {
      json = await r.json()
    } catch {
      /* corpo vazio */
    }
    return { status: r.status, json }
  }

  const out: BankSyncResponse = { items: [], accounts: [], transactions: [] }
  for (const id of items) {
    try {
      const it = await get(`/items/${id}`)
      if (it.status === 404) {
        out.items.push({ id, connector: '', status: 'NOT_FOUND', updatedAt: null, error: 'not_found' })
        continue
      }
      if (it.status >= 400) throw new Error(`item ${it.status}`)
      out.items.push({
        id,
        connector: String(it.json?.connector?.name ?? ''),
        status: String(it.json?.status ?? ''),
        updatedAt: day(it.json?.lastUpdatedAt) ? String(it.json.lastUpdatedAt) : null,
      })

      const acc = await get(`/accounts?itemId=${id}`)
      if (acc.status >= 400) throw new Error(`accounts ${acc.status}`)
      for (const a of (acc.json?.results ?? []) as any[]) {
        const card = a.type === 'CREDIT'
        const cd = a.creditData ?? {}
        out.accounts.push({
          id: String(a.id),
          itemId: id,
          kind: card ? 'card' : 'bank',
          name: String(a.marketingName || a.name || (card ? 'Cartão' : 'Conta')),
          subtype: String(a.subtype ?? ''),
          number: String(a.number ?? ''),
          balance: num(a.balance) ?? 0,
          creditLimit: card ? num(cd.creditLimit) : null,
          availableCredit: card ? num(cd.availableCreditLimit) : null,
          closeDate: card ? day(cd.balanceCloseDate) : null,
          dueDate: card ? day(cd.balanceDueDate) : null,
        })

        for (let page = 1; page <= MAX_PAGES; page++) {
          const tr = await get(`/transactions?accountId=${a.id}&from=${from}&to=${to}&pageSize=500&page=${page}`)
          if (tr.status >= 400) throw new Error(`transactions ${tr.status}`)
          for (const t of (tr.json?.results ?? []) as any[]) {
            const date = day(t.date)
            const amount = num(t.amount)
            if (!date || amount === null) continue
            const cm = t.creditCardMetadata
            out.transactions.push({
              id: String(t.id),
              accountId: String(a.id),
              itemId: id,
              date,
              description: String(t.description || t.descriptionRaw || 'Sem descrição').trim(),
              amount: Math.abs(amount),
              // o sentido vem do tipo (DEBIT = saiu, CREDIT = entrou), sem depender do sinal do valor
              direction: t.type === 'CREDIT' ? 'in' : 'out',
              category: typeof t.category === 'string' ? t.category : null,
              pending: t.status === 'PENDING',
              installment:
                cm && num(cm.installmentNumber) && num(cm.totalInstallments) && cm.totalInstallments > 1
                  ? { n: cm.installmentNumber, total: cm.totalInstallments }
                  : null,
            })
          }
          if (page >= (num(tr.json?.totalPages) ?? 1)) break
        }
      }
    } catch {
      // uma conexão com problema não derruba as outras
      if (!out.items.some((x) => x.id === id)) out.items.push({ id, connector: '', status: 'ERROR', updatedAt: null, error: 'failed' })
      else out.items = out.items.map((x) => (x.id === id ? { ...x, error: 'failed' as const } : x))
      out.accounts = out.accounts.filter((a) => a.itemId !== id)
      out.transactions = out.transactions.filter((t) => t.itemId !== id)
    }
  }
  return reply(200, out)
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => handle(req, Deno!.env))
}
