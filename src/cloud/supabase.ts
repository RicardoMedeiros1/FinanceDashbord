import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { friendlyAuthError } from './authError'
import type { Auth, Remote, Row, Session } from './types'

const BUCKET = 'receipts'
const PAGE = 1000
const CHUNK = 500

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
  const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? '' } : null

  // O link de recuperação abre o app com #...type=recovery; o evento pode disparar antes de a tela assinar, então guardamos.
  const fromUrl = typeof window !== 'undefined' ? window.location.hash.match(/type=(recovery|invite)/)?.[1] : undefined
  let recoveryPending: 'recovery' | 'invite' | null = fromUrl === 'invite' ? 'invite' : fromUrl === 'recovery' ? 'recovery' : null
  const recoveryListeners = new Set<(kind: 'recovery' | 'invite') => void>()
  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryPending = 'recovery'
      recoveryListeners.forEach((l) => l('recovery'))
    }
  })
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL}` : undefined

  return {
    async getSession() {
      const { data } = await client.auth.getSession()
      return toSession(data.session)
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(friendlyAuthError(error))
    },
    async signOut() {
      // 'local' encerra só este aparelho e não depende de rede; se falhar, limpamos a sessão salva à mão
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k))
    },
    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw new Error(friendlyAuthError(error))
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error(friendlyAuthError(error))
      recoveryPending = null
    },
    onRecovery(cb) {
      recoveryListeners.add(cb)
      if (recoveryPending) {
        const kind = recoveryPending
        queueMicrotask(() => cb(kind))
      }
      return () => void recoveryListeners.delete(cb)
    },
    async deleteAccount() {
      const { error } = await client.rpc('delete_my_account')
      if (error) throw new Error('Não foi possível excluir a conta agora. Tente de novo mais tarde.')
      await client.auth.signOut()
    },
    async mfaStatus() {
      // lê só a sessão guardada (sem rede): o nível vem do próprio token
      const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (error) throw new Error(friendlyAuthError(error))
      return { enrolled: data.nextLevel === 'aal2', verified: data.currentLevel === 'aal2' }
    },
    async mfaEnroll() {
      // cadastros que ficaram pela metade atrapalham um novo: remove antes
      const list = await client.auth.mfa.listFactors()
      for (const f of list.data?.all ?? []) if (f.factor_type === 'totp' && f.status === 'unverified') await client.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'Finn', friendlyName: `Finn ${new Date().toISOString().slice(0, 10)}` })
      if (error || !data) throw new Error(friendlyAuthError(error ?? { message: 'enroll' }))
      return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
    },
    async mfaVerify(code, factorId) {
      let id = factorId
      if (!id) {
        const list = await client.auth.mfa.listFactors()
        id = list.data?.totp[0]?.id
        if (!id) throw new Error('Nenhum aplicativo autenticador cadastrado.')
      }
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code: code.replace(/\s/g, '') })
      if (error) throw new Error(friendlyAuthError(error))
    },
    async mfaUnenroll() {
      const list = await client.auth.mfa.listFactors()
      for (const f of list.data?.all ?? []) {
        const { error } = await client.auth.mfa.unenroll({ factorId: f.id })
        if (error) throw new Error(friendlyAuthError(error))
      }
    },
    async bankSync(req) {
      const { data, error } = await client.functions.invoke('pluggy', { body: req })
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status
        if (status === 404) throw new Error('A função "pluggy" não está publicada no Supabase. Veja docs/OPEN_FINANCE.md, passo 3.')
        if (status === 401) throw new Error('Sessão expirada. Saia e entre de novo.')
        throw new Error('Não foi possível falar com o servidor agora. Tente de novo.')
      }
      if (data && typeof data === 'object' && 'error' in data) throw new Error(String((data as { message?: string }).message ?? 'Não foi possível sincronizar.'))
      return data
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toSession(session)))
      return () => data.subscription.unsubscribe()
    },
    remote: (userId) => createRemote(client, userId),
  }
}
