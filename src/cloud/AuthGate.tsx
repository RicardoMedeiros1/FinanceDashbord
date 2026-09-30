import { Lock } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PasswordForm } from './PasswordForm'
import type { Auth, Session } from './types'

interface Props {
  auth: Auth
  children: (session: Session) => ReactNode
}

/** Só mostra o app para quem está logado. */
export function AuthGate({ auth, children }: Props) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let alive = true
    auth.getSession().then((s) => alive && setSession(s), () => alive && setSession(null))
    // ignora renovações de token: só muda a tela se o usuário mudou
    const off = auth.onChange((s) => setSession((cur) => (cur !== 'loading' && cur?.userId === s?.userId ? cur : s)))
    const offRecovery = auth.onRecovery(() => setRecovery(true))
    return () => {
      alive = false
      off()
      offRecovery()
    }
  }, [auth])

  if (session === 'loading') return <div className="splash" aria-busy="true"><span className="brand-mark" /></div>
  if (!session) return <Login auth={auth} />
  if (recovery) {
    return (
      <div className="login">
        <div className="login-card">
          <span className="brand-mark" />
          <h1>Nova senha</h1>
          <p className="muted">Escolha a nova senha da sua conta ({session.email}).</p>
          <PasswordForm submitLabel="Salvar e entrar" onSubmit={(pw) => auth.updatePassword(pw)} onDone={() => setRecovery(false)} />
        </div>
      </div>
    )
  }
  return <>{children(session)}</>
}

/** O link do e-mail pode voltar com erro (expirado/já usado): explica em português. */
function linkError(): string {
  const h = window.location.hash
  if (/error_code=otp_expired|error=access_denied/.test(h)) return 'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
  return ''
}

function Login({ auth }: { auth: Auth }) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkError)
  const [sent, setSent] = useState(false)

  if (mode === 'forgot') {
    return (
      <div className="login">
        <form
          className="login-card"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              await auth.resetPassword(email.trim())
              setSent(true)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <span className="brand-mark" />
          <h1>Esqueci minha senha</h1>
          {sent ? (
            <p className="pos" role="status">Se esse e-mail tiver uma conta, você vai receber um link para criar uma nova senha. Confira também o spam.</p>
          ) : (
            <>
              <p className="muted">Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.</p>
              <label>
                E-mail
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
              </label>
              {error && <p className="bad-text small" role="alert">{error}</p>}
              <button className="btn primary" disabled={busy || !email}>{busy ? 'Enviando…' : 'Enviar link'}</button>
            </>
          )}
          <button type="button" className="link center" onClick={() => { setMode('login'); setSent(false); setError('') }}>Voltar para o login</button>
        </form>
      </div>
    )
  }

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
        <button type="button" className="link center" onClick={() => { setMode('forgot'); setError('') }}>Esqueci minha senha</button>
      </form>
    </div>
  )
}
