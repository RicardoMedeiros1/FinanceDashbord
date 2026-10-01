import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Auth, MfaStatus } from '../cloud/types'
import { Modal } from './Modal'

interface Props {
  auth?: Auth
  email?: string
  onClose: () => void
}

/** Segurança da conta: verificação em duas etapas, acessos, bloqueio por PIN. */
export function SecurityModal({ auth, email, onClose }: Props) {
  const [mfa, setMfa] = useState<MfaStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!auth) return
    let alive = true
    auth.mfaStatus().then((s) => alive && setMfa(s), () => alive && setMfa(null))
    return () => {
      alive = false
    }
  }, [auth])

  const reconfigure = async () => {
    if (!auth) return
    if (!confirm('Trocar o aplicativo autenticador? O atual deixa de valer e você cadastra um novo agora. Faça isso com o celular antigo ou o novo em mãos.')) return
    setBusy(true)
    setError('')
    try {
      await auth.mfaUnenroll()
      window.location.reload() // ao recarregar, o app pede o novo cadastro
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível trocar agora.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Segurança" onClose={onClose}>
      {auth && (
        <section className="sec-block" aria-label="Verificação em duas etapas">
          <h4><ShieldCheck size={16} /> Verificação em duas etapas</h4>
          <p className="muted small">Além da senha, o Finn pede um código do aplicativo autenticador do seu celular{email ? ` (conta ${email})` : ''}.</p>
          <p role="status">
            {mfa === null ? <span className="muted">Verificando…</span> : mfa.enrolled ? <span className="pos">Ativada</span> : <span className="bad-text">Desligada</span>}
          </p>
          {mfa?.enrolled && <button className="btn" onClick={() => void reconfigure()} disabled={busy}>Trocar o aplicativo autenticador</button>}
          {error && <p className="bad-text small" role="alert">{error}</p>}
          <p className="muted small">Se perder o celular, quem administra o projeto no Supabase pode remover o fator em Authentication → Users, e você cadastra um novo no próximo login.</p>
        </section>
      )}
    </Modal>
  )
}
