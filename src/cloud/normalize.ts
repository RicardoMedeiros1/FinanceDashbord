/**
 * Aceita o que costuma ser colado por engano e devolve só o endereço do projeto (https://xxxx.supabase.co):
 * espaços/aspas, sem "https://", com caminho extra (/rest/v1/, /auth/v1...) ou o endereço do painel
 * (supabase.com/dashboard/project/<ref>).
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let s = raw.trim().replace(/^["']|["']$/g, '').trim()
  if (!s) return undefined
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    const dash = u.pathname.match(/\/dashboard\/project\/([a-z0-9]+)/i)
    if (/(^|\.)supabase\.com$/i.test(u.hostname) && dash) return `https://${dash[1]}.supabase.co`
    return u.origin
  } catch {
    return undefined
  }
}

/** Remove espaços, quebras de linha e aspas que costumam vir junto ao copiar a chave. */
export function cleanKey(raw: string | undefined): string | undefined {
  const k = raw?.replace(/\s+/g, '').replace(/^["']|["']$/g, '')
  return k || undefined
}
