// Servidor falso (HTTP) usado apenas nos testes automatizados. Não entra no build de produção.
import type { Auth, Remote, Row, Session } from './types'

const KEY = 'fake:session'

export function createFakeAuth(base: string): Auth {
  const listeners = new Set<(s: Session | null) => void>()
  const recoveryListeners = new Set<(kind: 'recovery' | 'invite') => void>()
  let recoveryPending: 'recovery' | 'invite' | null = null
  const read = (): (Session & { token: string }) | null => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      return null
    }
  }
  const emit = () => listeners.forEach((l) => l(read()))
  const q = (token: string, extra = '') => `${base}${extra}${extra.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`

  // simula o link do e-mail: #type=recovery&rt=<token> ou #type=invite&rt=<token>
  const m = typeof window !== 'undefined' ? window.location.hash.match(/type=(recovery|invite)&rt=([^&]+)/) : null
  const recovered = m
    ? fetch(`${base}/recover`, { method: 'POST', body: JSON.stringify({ token: m[2] }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return
          localStorage.setItem(KEY, JSON.stringify({ ...j, email: 'me@x.com' }))
          recoveryPending = m[1] as 'recovery' | 'invite'
          history.replaceState(null, '', window.location.pathname)
          recoveryListeners.forEach((l) => l(recoveryPending!))
        })
        .catch(() => undefined)
    : Promise.resolve()

  return {
    async getSession() {
      await recovered
      return read()
    },
    async signIn(email, password) {
      const r = await fetch(`${base}/login`, { method: 'POST', body: JSON.stringify({ email, password }) }).catch(() => null)
      if (!r) throw new Error('Sem conexão com o servidor. Verifique a internet.')
      if (!r.ok) throw new Error('E-mail ou senha incorretos.')
      localStorage.setItem(KEY, JSON.stringify({ ...(await r.json()), email }))
      emit()
    },
    async signOut() {
      localStorage.removeItem(KEY)
      emit()
    },
    async resetPassword(email) {
      const r = await fetch(`${base}/reset`, { method: 'POST', body: JSON.stringify({ email }) }).catch(() => null)
      if (!r || !r.ok) throw new Error('Sem conexão com o servidor. Verifique a internet.')
    },
    async updatePassword(password) {
      const t = read()?.token ?? ''
      const r = await fetch(q(t, '/password'), { method: 'POST', body: JSON.stringify({ password }) }).catch(() => null)
      if (!r || !r.ok) throw new Error('Não foi possível trocar a senha.')
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
      const r = await fetch(q(read()?.token ?? '', '/delete-account'), { method: 'POST' }).catch(() => null)
      if (!r || !r.ok) throw new Error('Não foi possível excluir a conta agora. Tente de novo mais tarde.')
      localStorage.removeItem(KEY)
      emit()
    },
    async mfaStatus() {
      const r = await fetch(q(read()?.token ?? '', '/mfa/status')).catch(() => null)
      if (!r || !r.ok) throw new Error('Sem conexão com o servidor. Verifique a internet.')
      return (await r.json()) as { enrolled: boolean; verified: boolean }
    },
    async mfaEnroll() {
      const r = await fetch(q(read()?.token ?? '', '/mfa/enroll'), { method: 'POST' }).catch(() => null)
      if (!r) throw new Error('Sem conexão com o servidor. Verifique a internet.')
      const j = await r.json()
      if (!r.ok) throw new Error(String(j.message ?? 'Não foi possível cadastrar.'))
      return j
    },
    async mfaVerify(code, factorId) {
      const r = await fetch(q(read()?.token ?? '', '/mfa/verify'), { method: 'POST', body: JSON.stringify({ code, factorId }) }).catch(() => null)
      if (!r) throw new Error('Sem conexão com o servidor. Verifique a internet.')
      if (!r.ok) throw new Error('Código incorreto ou vencido. Confira se a hora do celular está certa e digite o código atual.')
    },
    async mfaUnenroll() {
      const r = await fetch(q(read()?.token ?? '', '/mfa/unenroll'), { method: 'POST' }).catch(() => null)
      if (!r || !r.ok) throw new Error('Não foi possível remover agora.')
    },
    async bankSync(req) {
      const r = await fetch(q(read()?.token ?? '', '/pluggy'), { method: 'POST', body: JSON.stringify(req) }).catch(() => null)
      if (!r) throw new Error('Sem conexão com o servidor. Verifique a internet.')
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error('Não foi possível falar com o servidor agora. Tente de novo.')
      if (j && 'error' in j) throw new Error(String(j.message ?? 'Não foi possível sincronizar.'))
      return j
    },
    onChange(cb) {
      listeners.add(cb)
      return () => void listeners.delete(cb)
    },
    remote(): Remote {
      const token = () => read()?.token ?? ''
      const ok = async (r: Response) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r
      }
      return {
        async fetchAll(since) {
          const r = await ok(await fetch(q(token(), `/rows?since=${encodeURIComponent(since ?? '')}`)))
          return (await r.json()) as Row[]
        },
        async upsert(rows) {
          await ok(await fetch(q(token(), '/upsert'), { method: 'POST', body: JSON.stringify(rows) }))
        },
        subscribe(onChange) {
          let last = -1
          const t = setInterval(async () => {
            try {
              const v = Number(await (await fetch(q(token(), '/version'))).text())
              if (last !== -1 && v !== last) onChange()
              last = v
            } catch {
              /* offline */
            }
          }, 400)
          return () => clearInterval(t)
        },
        async uploadFile(path, file) {
          await ok(await fetch(q(token(), `/file?path=${encodeURIComponent(path)}`), { method: 'PUT', body: file }))
        },
        async fileUrl(path) {
          return q(token(), `/file?path=${encodeURIComponent(path)}`)
        },
        async removeFile(path) {
          await ok(await fetch(q(token(), `/file?path=${encodeURIComponent(path)}`), { method: 'DELETE' }))
        },
      }
    },
  }
}
