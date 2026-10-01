// Bloqueio do app por PIN neste aparelho. O PIN nunca é guardado: só um hash (PBKDF2-SHA256 com sal aleatório).
// Atenção: é uma trava de tela do app, não criptografia dos dados que já estão no navegador.

export const LOCK_KEY = 'fd:lock'
export const PIN_LENGTH = 6
const ITERATIONS = 150_000

/** Depois de quantos minutos fora do app ele bloqueia (0 = ao sair do app). */
export const TIMEOUTS = [0, 1, 5, 15, 30] as const
export type Timeout = (typeof TIMEOUTS)[number]

/** Erros seguidos que, com conta na nuvem, encerram a sessão e apagam os dados deste aparelho. */
export const MAX_FAILS = 10

export interface LockConfig {
  salt: string // base64
  hash: string // base64
  iterations: number
  timeout: Timeout
  fails: number // erros seguidos
  lockedUntil: number // ms; antes disso nem aceita o PIN
}

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return b64(bits)
}

/** Comparação que leva o mesmo tempo, acertando ou não. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const validPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)

/** PINs fáceis demais: 000000, 123456, 654321, 121212... */
export function weakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true
  if ('01234567890'.includes(pin) || '09876543210'.includes(pin)) return true
  return /^(\d\d)\1\1$/.test(pin) || /^(\d\d\d)\1$/.test(pin)
}

export function readLock(): LockConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null')
    return c && typeof c.hash === 'string' && typeof c.salt === 'string' ? ({ fails: 0, lockedUntil: 0, timeout: 5, iterations: ITERATIONS, ...c } as LockConfig) : null
  } catch {
    return null
  }
}
const write = (c: LockConfig) => localStorage.setItem(LOCK_KEY, JSON.stringify(c))
export const removeLock = () => localStorage.removeItem(LOCK_KEY)

export async function setPin(pin: string, timeout: Timeout): Promise<void> {
  if (!validPin(pin)) throw new Error(`O PIN tem ${PIN_LENGTH} dígitos.`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  write({ salt: b64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS, timeout, fails: 0, lockedUntil: 0 })
}

export function setTimeoutMinutes(timeout: Timeout) {
  const c = readLock()
  if (c) write({ ...c, timeout })
}

/** Espera depois de erros seguidos: nada até 2, depois 30 s, 1 min, 5 min, 15 min e, por fim, 1 hora. */
export function delayAfter(fails: number): number {
  if (fails < 3) return 0
  if (fails === 3) return 30_000
  if (fails === 4) return 60_000
  if (fails <= 6) return 5 * 60_000
  if (fails <= 8) return 15 * 60_000
  return 60 * 60_000
}

export type VerifyResult = { ok: true } | { ok: false; fails: number; lockedUntil: number; wipe: boolean } | { ok: false; waiting: true; lockedUntil: number }

/** Confere o PIN. Dentro do tempo de espera nem tenta. */
export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  const c = readLock()
  if (!c) return { ok: true }
  if (c.lockedUntil > now) return { ok: false, waiting: true, lockedUntil: c.lockedUntil }
  const good = validPin(pin) && same(await derive(pin, unb64(c.salt), c.iterations), c.hash)
  if (good) {
    write({ ...c, fails: 0, lockedUntil: 0 })
    return { ok: true }
  }
  const fails = c.fails + 1
  const lockedUntil = delayAfter(fails) ? now + delayAfter(fails) : 0
  write({ ...c, fails, lockedUntil })
  return { ok: false, fails, lockedUntil, wipe: fails >= MAX_FAILS }
}

/** Fora do app por `awayMs`: já passou do tempo para bloquear? */
export const shouldLock = (awayMs: number, timeout: Timeout) => awayMs >= timeout * 60_000
