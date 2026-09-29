import { Lock } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Auth, Session } from './types'

interface Props {
  auth: Auth
  children: (session: Session) => ReactNode
}

/** Só mostra o app para quem está logado. */
export function AuthGate({ auth, children }: Props) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    let alive = true
    auth.getSession().then((s) => alive && setSession(s), () => alive && setSession(null))
    // ignora renovações de token: só muda a tela se o usuário mudou
    const off = auth.onChange((s) => setSession((cur) => (cur !== 'loading' && cur?.userId === s?.userId ? cur : s)))
    return () => {
      alive = false
      off()
    }
  }, [auth])

  if (session === 'loading') return <div className="splash" aria-busy="true"><span className="brand-mark" /></div>
  if (!session) return <Login auth={auth} />
  return <>{children(session)}</>
}

function Login({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="login">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await auth.signIn(email.trim(), password)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <span className="brand-mark" />
        <h1>Finn</h1>
        <p className="muted">Acesso restrito. Entre para ver as suas finanças.</p>
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="bad-text small" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !email || !password}>
          <Lock size={15} /> {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
