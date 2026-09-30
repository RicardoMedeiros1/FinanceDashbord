import { useState } from 'react'

interface Props {
  onSubmit: (password: string) => Promise<void>
  submitLabel: string
  onDone?: () => void
}

/** Nova senha + confirmação. Usada após o link de recuperação e em "Trocar senha". */
export function PasswordForm({ onSubmit, submitLabel, onDone }: Props) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const tooShort = pw.length > 0 && pw.length < 8
  const mismatch = pw2.length > 0 && pw !== pw2
  const valid = pw.length >= 8 && pw === pw2

  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid) return
        setBusy(true)
        setError('')
        try {
          await onSubmit(pw)
          onDone?.()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        Nova senha
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </label>
      <label>
        Repita a nova senha
        <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      {tooShort && <p className="bad-text small">Use pelo menos 8 caracteres.</p>}
      {mismatch && <p className="bad-text small">As senhas não são iguais.</p>}
      {error && <p className="bad-text small" role="alert">{error}</p>}
      <button className="btn primary" disabled={!valid || busy}>{busy ? 'Salvando…' : submitLabel}</button>
    </form>
  )
}
