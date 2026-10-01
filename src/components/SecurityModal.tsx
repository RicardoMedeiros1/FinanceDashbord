import { Check, LogOut, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { describeDevice, entryLabel, type AccessEntry } from '../access'
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
  const [log, setLog] = useState<AccessEntry[] | null>(null)
  const [logError, setLogError] = useState('')

  useEffect(() => {
    if (!auth) return
    let alive = true
    auth.mfaStatus().then((s) => alive && setMfa(s), () => alive && setMfa(null))
    return () => {
      alive = false
    }
  }, [auth])

  useEffect(() => {
    if (!auth) return
    let alive = true
    auth.accessLog().then(
      (l) => alive && setLog(l),
      (e) => alive && setLogError(e instanceof Error ? e.message : 'Não foi possível carregar os acessos.'),
    )
    return () => {
      alive = false
    }
  }, [auth])

  const signOutAll = async () => {
    if (!auth) return
    if (!confirm('Sair de todos os aparelhos? Você (e qualquer outra pessoa logada) terá que entrar de novo com senha e código.')) return
    setBusy(true)
    setError('')
    try {
      await auth.signOutEverywhere()
      Object.keys(localStorage).filter((k) => k.startsWith('fd:')).forEach((k) => localStorage.removeItem(k))
      window.location.hash = ''
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível encerrar as sessões agora.')
      setBusy(false)
    }
  }

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
      {auth && (
        <section className="sec-block" aria-label="Acessos recentes">
          <h4><ShieldAlert size={16} /> Acessos recentes</h4>
          <p className="muted small">Tentativas de entrar na sua conta por este app. Se algo não for você, troque a senha e encerre as sessões.</p>
          {logError && <p className="muted small" role="status">{logError}</p>}
          {!logError && log === null && <p className="muted small">Carregando…</p>}
          {log && log.length === 0 && <p className="muted small">Nenhum acesso registrado ainda.</p>}
          {log && log.length > 0 && (
            <ul className="access-list">
              {log.slice(0, 15).map((e, i) => (
                <li key={`${e.at}-${i}`} className={e.ok ? 'ok' : 'bad'}>
                  <span className="access-mark" aria-hidden>{e.ok ? <Check size={13} /> : <X size={13} />}</span>
                  <div className="grow">
                    <strong>{entryLabel(e)}</strong>
                    <span className="muted small">{new Date(e.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {describeDevice(e.ua)}{e.ip ? ` · IP ${e.ip}` : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {auth && (
        <section className="sec-block" aria-label="Sessões">
          <h4><LogOut size={16} /> Sessões</h4>
          <p className="muted small">Se perdeu um aparelho ou suspeita de acesso indevido, encerre todas as sessões de uma vez.</p>
          <button className="btn danger" onClick={() => void signOutAll()} disabled={busy}>Sair de todos os aparelhos</button>
        </section>
      )}
    </Modal>
  )
}
