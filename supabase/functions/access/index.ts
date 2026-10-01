// Edge Function "access": porta de entrada do login do Finn, com registro e bloqueio de tentativas.
//
// O app envia e-mail e senha para cá. A função confere no Supabase Auth, anota a tentativa (certa ou errada, com
// horário, aparelho e IP) na tabela `login_attempts` e bloqueia por 15 minutos depois de 5 senhas erradas.
// Quem está logado vê o histórico em Dados → Segurança, e o app avisa se houve tentativas erradas.
//
// Limite honesto: quem falar direto com a API pública do Supabase (sem passar por aqui) não é registrado nem bloqueado
// por esta função. A proteção contra isso é o 2FA (supabase/security-2fa.sql), os limites do próprio Supabase
// (Authentication → Rate Limits) e, se quiser, o CAPTCHA. Veja docs/SEGURANCA.md.
//
// Arquivo único e sem imports, para colar direto no editor de Edge Functions do painel do Supabase.

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void } | undefined

export interface Env {
  get(k: string): string | undefined
}

export const WINDOW_MS = 15 * 60 * 1000 // janela de contagem e tempo de bloqueio
export const MAX_PER_EMAIL = 5 // senhas erradas seguidas para o mesmo e-mail
export const MAX_PER_IP = 20 // senhas erradas do mesmo endereço, em qualquer e-mail

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const WRONG = 'E-mail ou senha incorretos.'

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function handle(req: Request, env: Env, fetchFn: typeof fetch = fetch, now: () => number = Date.now): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  const base = (env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
  const anon = env.get('SUPABASE_ANON_KEY') ?? ''
  const service = env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!base || !anon || !service) return reply({ error: 'not_configured', message: 'A função de acesso não está configurada.' })

  let body: any
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'bad_request', message: 'Pedido inválido.' }, 400)
  }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (body?.action !== 'login' || !email.includes('@') || email.length > 254 || !password || password.length > 1024) {
    return reply({ error: 'invalid', message: WRONG })
  }

  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '').split(',')[0].trim().slice(0, 64)
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 300)
  const rest = (path: string, init: RequestInit = {}) =>
    fetchFn(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) } })
  const q = encodeURIComponent
  const since = new Date(now() - WINDOW_MS).toISOString()

  /** Falhas (não bloqueadas) na janela, mais novas primeiro. */
  const fails = async (filter: string, limit: number): Promise<number[]> => {
    try {
      const r = await rest(`login_attempts?select=at&ok=eq.false&locked=eq.false&at=gt.${q(since)}&${filter}&order=at.desc&limit=${limit}`)
      if (!r.ok) return []
      return ((await r.json()) as Array<{ at: string }>).map((x) => Date.parse(x.at))
    } catch {
      return [] // sem o registro, a função ainda confere a senha (o bloqueio é um reforço)
    }
  }
  const record = async (ok: boolean, locked: boolean) => {
    try {
      await rest('login_attempts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ email, ok, locked, ip: ip || null, ua: ua || null }) })
      // limpeza: de vez em quando apaga o que tem mais de 90 dias
      if (Math.random() < 0.05) await rest(`login_attempts?at=lt.${q(new Date(now() - 90 * 86400000).toISOString())}`, { method: 'DELETE' })
    } catch {
      /* registro é melhor esforço */
    }
  }

  // 1) bloqueio: depois de 5 erros seguidos para o e-mail (zera com um acerto) ou 20 do mesmo IP
  let lastOk = 0
  try {
    const r = await rest(`login_attempts?select=at&email=eq.${q(email)}&ok=eq.true&order=at.desc&limit=1`)
    if (r.ok) lastOk = Date.parse(((await r.json()) as Array<{ at: string }>)[0]?.at ?? '') || 0
  } catch {
    /* ignora */
  }
  const byEmail = (await fails(`email=eq.${q(email)}`, MAX_PER_EMAIL)).filter((t) => t > lastOk)
  const byIp = ip ? await fails(`ip=eq.${q(ip)}`, MAX_PER_IP) : []
  const lockedUntil = Math.max(byEmail.length >= MAX_PER_EMAIL ? byEmail[MAX_PER_EMAIL - 1] + WINDOW_MS : 0, byIp.length >= MAX_PER_IP ? byIp[MAX_PER_IP - 1] + WINDOW_MS : 0)
  if (lockedUntil > now()) {
    await record(false, true)
    const retryAfter = Math.max(1, Math.ceil((lockedUntil - now()) / 1000))
    return reply({ error: 'locked', retryAfter, message: `Muitas tentativas erradas. Aguarde ${Math.ceil(retryAfter / 60)} ${Math.ceil(retryAfter / 60) === 1 ? 'minuto' : 'minutos'} e tente de novo.` })
  }

  // 2) confere a senha no Supabase Auth
  let r: Response
  try {
    r = await fetchFn(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  } catch {
    return reply({ error: 'unavailable', message: 'Não foi possível falar com o servidor agora. Tente de novo.' })
  }
  if (r.ok) {
    const s = (await r.json()) as any
    await record(true, false)
    return reply({ session: { access_token: s.access_token, refresh_token: s.refresh_token } })
  }
  if (r.status === 400 || r.status === 401 || r.status === 422) {
    await record(false, false)
    const left = MAX_PER_EMAIL - (byEmail.length + 1)
    return reply({ error: 'invalid', message: left > 0 && left <= 2 ? `${WRONG} Restam ${left} ${left === 1 ? 'tentativa' : 'tentativas'} antes do bloqueio.` : WRONG, remaining: Math.max(0, left) })
  }
  if (r.status === 429) return reply({ error: 'rate', message: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.' })
  return reply({ error: 'unavailable', message: 'Não foi possível entrar agora. Tente de novo em instantes.' })
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => handle(req, Deno!.env))
}
