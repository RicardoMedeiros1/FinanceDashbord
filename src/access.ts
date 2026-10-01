// Registro de acessos: formata as tentativas de login e decide quando avisar o usuário.

export interface AccessEntry {
  at: string // ISO
  ok: boolean // entrou
  locked: boolean // bloqueada por excesso de erros (nem conferiu a senha)
  ip?: string | null
  ua?: string | null
}

/** "Chrome no Windows" a partir do user-agent (aproximado: serve para o usuário reconhecer o aparelho). */
export function describeDevice(ua?: string | null): string {
  if (!ua) return 'Aparelho desconhecido'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} no ${os}` : browser
}

export const entryLabel = (e: AccessEntry) => (e.ok ? 'Entrou' : e.locked ? 'Bloqueada (excesso de tentativas)' : 'Senha ou e-mail errado')

const TYPO_WINDOW_MS = 10 * 60 * 1000

/**
 * Tentativas erradas que merecem aviso: as que aconteceram desde o login anterior, menos as que vieram logo antes do
 * login atual (provavelmente o próprio erro de digitação) e as que o usuário já viu.
 * `entries` em qualquer ordem; `seen` = ISO da última tentativa já dispensada ('' se nenhuma).
 */
export function failuresToReport(entries: AccessEntry[], seen: string): AccessEntry[] {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at))
  const successes = sorted.filter((e) => e.ok)
  const current = successes[0]
  const previous = successes[1]?.at ?? ''
  return sorted.filter((e) => {
    if (e.ok || e.at <= previous || e.at <= seen) return false
    if (current && e.at < current.at && Date.parse(current.at) - Date.parse(e.at) <= TYPO_WINDOW_MS) return false
    return true
  })
}
