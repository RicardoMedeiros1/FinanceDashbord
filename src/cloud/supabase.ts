import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Auth, Remote, Row, Session } from './types'

const BUCKET = 'receipts'
const PAGE = 1000
const CHUNK = 500

function friendly(message: string, name?: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'Confirme o e-mail antes de entrar.'
  if (name === 'AuthRetryableFetchError' || /failed to fetch|network/i.test(message)) return 'Sem conexão com o servidor. Verifique a internet.'
  return 'Não foi possível entrar. Tente novamente.'
}

function createRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async fetchAll(since) {
      const out: Row[] = []
      for (let from = 0; ; from += PAGE) {
        let q = client
          .from('records')
          .select('collection,id,data,deleted,synced_at')
          .order('synced_at', { ascending: true })
          .order('collection', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (since) q = q.gt('synced_at', since)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        const page = (data ?? []) as Row[]
        out.push(...page)
        if (page.length < PAGE) break
      }
      return out
    },

    async upsert(rows) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({
          user_id: userId,
          collection: r.collection,
          id: r.id,
          data: r.data,
          deleted: r.deleted,
        }))
        const { error } = await client.from('records').upsert(chunk, { onConflict: 'user_id,collection,id' })
        if (error) throw new Error(error.message)
      }
    },

    subscribe(onChange) {
      const channel = client
        .channel(`records-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${userId}` }, () => onChange())
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },

    async uploadFile(path, file, contentType) {
      const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType, upsert: true })
      if (error) throw new Error(error.message)
    },

    async fileUrl(path) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 600)
      if (error || !data) throw new Error(error?.message ?? 'Arquivo indisponível')
      return data.signedUrl
    },

    async removeFile(path) {
      const { error } = await client.storage.from(BUCKET).remove([path])
      if (error) throw new Error(error.message)
    },
  }
}

export function createSupabaseAuth(url: string, key: string): Auth {
  const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? '' } : null

  return {
    async getSession() {
      const { data } = await client.auth.getSession()
      return toSession(data.session)
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(friendly(error.message, error.name))
    },
    async signOut() {
      await client.auth.signOut()
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toSession(session)))
      return () => data.subscription.unsubscribe()
    },
    remote: (userId) => createRemote(client, userId),
  }
}
