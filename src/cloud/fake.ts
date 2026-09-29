// Servidor falso (HTTP) usado apenas nos testes automatizados. Não entra no build de produção.
import type { Auth, Remote, Row, Session } from './types'

const KEY = 'fake:session'

export function createFakeAuth(base: string): Auth {
  const listeners = new Set<(s: Session | null) => void>()
  const read = (): (Session & { token: string }) | null => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      return null
    }
  }
  const emit = () => listeners.forEach((l) => l(read()))
  const q = (token: string, extra = '') => `${base}${extra}${extra.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`

  return {
    async getSession() {
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
