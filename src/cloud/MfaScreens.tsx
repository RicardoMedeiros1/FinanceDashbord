import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Auth, MfaEnrollment } from './types'

interface CodeProps {
  onSubmit: (code: string) => Promise<void>
  label: string
}

/** Campo do código de 6 dígitos do aplicativo autenticador. */
function CodeForm({ onSubmit, label }: CodeProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = /^\d{6}$/.test(code)
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid || busy) return
        setBusy(true)
        setError('')
        try {
          await onSubmit(code)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Código incorreto.')
          setCode('')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        Código de 6 dígitos
        <input
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-label="Código de 6 dígitos"
          autoFocus
        />
      </label>
      {error && <p className="bad-text small" role="alert">{error}</p>}
      <button className="btn primary" disabled={!valid || busy}>{busy ? 'Verificando…' : label}</button>
    </form>
  )
}

interface ChallengeProps {
  auth: Auth
  email: string
  onVerified: () => void
  onSignOut: () => void
}

/** Login em um aparelho novo (ou depois de sair): pede o código do aplicativo autenticador. */
export function MfaChallenge({ auth, email, onVerified, onSignOut }: ChallengeProps) {
  return (
    <div className="login">
      <div className="login-card">
        <span className="brand-mark" />
        <h1>Verificação em duas etapas</h1>
        <p className="muted">Abra o aplicativo autenticador no seu celular e digite o código atual do Finn ({email}).</p>
        <CodeForm label="Confirmar" onSubmit={async (c) => { await auth.mfaVerify(c); onVerified() }} />
        <button type="button" className="link center" onClick={onSignOut}>Sair</button>
      </div>
    </div>
  )
}

interface SetupProps {
  auth: Auth
  email: string
  onDone: () => void
  onSignOut: () => void
  /** só quando o servidor não oferece a verificação (desligada no projeto): deixa seguir sem ela */
  onSkip: () => void
}

/** Primeiro cadastro do aplicativo autenticador: obrigatório para entrar. */
export function MfaSetup({ auth, email, onDone, onSignOut, onSkip }: SetupProps) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setEnrollment(null)
    setError('')
    auth.mfaEnroll().then(
      (e) => alive && setEnrollment(e),
      (e) => alive && setError(e instanceof Error ? e.message : 'Não foi possível iniciar o cadastro.'),
    )
    return () => {
      alive = false
    }
  }, [auth, attempt])

  const notEnabled = /desligada no Supabase/.test(error)
  return (
    <div className="login">
      <div className="login-card wide">
        <span className="brand-mark" />
        <h1><ShieldCheck size={22} /> Ative a verificação em duas etapas</h1>
        <p className="muted">Além da senha, o Finn passa a pedir um código do seu celular. Assim, mesmo que a senha vaze, ninguém entra na sua conta ({email}).</p>
        {error && (
          <>
            <p className="bad-text small" role="alert">{error}</p>
            <button className="btn" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</button>
            {notEnabled && <button className="btn ghost" onClick={onSkip}>Continuar sem verificação (não recomendado)</button>}
          </>
        )}
        {!error && !enrollment && <p className="muted" aria-busy="true">Preparando…</p>}
        {enrollment && (
          <>
            <ol className="mfa-steps">
              <li>Instale um aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator, Authy, 1Password…).</li>
              <li>
                Escaneie o QR code abaixo{' '}
                <span className="muted small">(ou, no app, escolha “inserir chave” e digite a chave que aparece abaixo do QR code)</span>.
              </li>
            </ol>
            <div className="mfa-qr">
              <img src={enrollment.qr} alt="QR code para o aplicativo autenticador" width={176} height={176} />
              <div>
                <span className="muted small">Chave para digitar à mão</span>
                <code className="mfa-secret" data-testid="mfa-secret">{enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
              </div>
            </div>
            <p className="muted small">3. Digite o código de 6 dígitos que o aplicativo mostrar:</p>
            <CodeForm label="Ativar" onSubmit={async (c) => { await auth.mfaVerify(c, enrollment.factorId); onDone() }} />
          </>
        )}
        <button type="button" className="link center" onClick={onSignOut}>Sair</button>
      </div>
    </div>
  )
}
