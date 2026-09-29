import { cleanKey, normalizeSupabaseUrl } from './normalize'

export const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
export const SUPABASE_KEY = cleanKey(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** Servidor falso, só para testes automatizados (build com VITE_CLOUD=fake). */
export const FAKE_CLOUD = import.meta.env.VITE_CLOUD === 'fake'

/** Sem essas variáveis o app roda só local, como antes. */
export const CLOUD_ENABLED = FAKE_CLOUD || Boolean(SUPABASE_URL && SUPABASE_KEY)

export async function createAuth() {
  if (FAKE_CLOUD) {
    const { createFakeAuth } = await import('./fake')
    return createFakeAuth(import.meta.env.VITE_FAKE_URL as string)
  }
  const { createSupabaseAuth } = await import('./supabase')
  return createSupabaseAuth(SUPABASE_URL!, SUPABASE_KEY!)
}
