import { Check, KeyRound, LogOut, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { describeDevice, entryLabel, type AccessEntry } from '../access'
import type { Auth, MfaStatus } from '../cloud/types'
import { PIN_LENGTH, TIMEOUTS, validPin, weakPin, type Timeout } from '../lock'
import { useLock } from './LockGate'
import { Modal } from './Modal'

interface Props {
  auth?: Auth
  email?: string
  onClose: () => void
}

const TIMEOUT_LABEL: Record<Timeout, string> = { 0: 'Ao sair do app', 1: 'Depois de 1 minuto', 5: 'Depois de 5 minutos', 15: 'Depois de 15 minutos', 30: 'Depois de 30 minutos' }

/** Bloqueio do app por PIN neste aparelho. */
function PinSection({ onClose }: { onClose: () => void }) {
  const lock = useLock()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [current, setCurrent] = useState('')
  const [mode, setMode] = useState<'idle' | 'change' | 'disable'>('idle')
  const [timeout, setTimeoutValue] = useState<Timeout>(5)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!lock) return null
  const digits = (s: string) => s.replace(/\D/g, '').slice(0, PIN_LENGTH)
  const newProblem = pin && !validPin(pin) ? `Use ${PIN_LENGTH} dígitos.` : validPin(pin) && weakPin(pin) ? 'PIN fácil demais (como 123456 ou 000000). Escolha outro.' : pin2 && pin !== pin2 ? 'Os PINs não são iguais.' : ''
  const newOk = validPin(pin) && !weakPin(pin) && pin === pin2
  const reset = () => { setPin(''); setPin2(''); setCurrent(''); setMode('idle') }

  return (
    <section className="sec-block" aria-label="Bloqueio com PIN">
      <h4><KeyRound size={16} /> Bloqueio do app com PIN</h4>
      <p className="muted small">Trava o Finn neste aparelho: ao abrir, depois de um tempo fora do app ou quando você pedir. É uma trava de tela; não criptografa os dados guardados no navegador.</p>
      <p role="status">{lock.enabled ? <span className="pos">Ativado</span> : <span className="muted">Desligado</span>}</p>

      {!lock.enabled && (
        <form className="form" onSubmit={async (e) => { e.preventDefault(); if (!newOk) return; await lock.enable(pin, timeout); reset(); setMsg({ ok: true, text: 'Bloqueio ativado.' }) }}>
          <div className="row">
            <label>Novo PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(digits(e.target.value))} aria-label="Novo PIN" /></label>
            <label>Repita o PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} aria-label="Repita o PIN" /></label>
          </div>
          <label>Bloquear
            <select value={timeout} onChange={(e) => setTimeoutValue(Number(e.target.value) as Timeout)} aria-label="Quando bloquear">
              {TIMEOUTS.map((t) => <option key={t} value={t}>{TIMEOUT_LABEL[t]}</option>)}
            </select>
          </label>
          {newProblem && <p className="bad-text small" role="alert">{newProblem}</p>}
          <button className="btn primary" disabled={!newOk}>Ativar bloqueio</button>
        </form>
      )}

      {lock.enabled && mode === 'idle' && (
        <>
          <label className="form-inline">Bloquear
            <select value={lock.timeout} onChange={(e) => lock.setTimeout(Number(e.target.value) as Timeout)} aria-label="Quando bloquear">
              {TIMEOUTS.map((t) => <option key={t} value={t}>{TIMEOUT_LABEL[t]}</option>)}
            </select>
          </label>
          <div className="head-actions">
            <button className="btn" onClick={() => { lock.lockNow(); onClose() }}>Bloquear agora</button>
            <button className="btn" onClick={() => { setMsg(null); setMode('change') }}>Trocar PIN</button>
            <button className="btn danger" onClick={() => { setMsg(null); setMode('disable') }}>Desativar</button>
          </div>
        </>
      )}

      {lock.enabled && mode !== 'idle' && (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault()
            const r = mode === 'disable' ? await lock.disable(current) : newOk ? await lock.change(current, pin) : { ok: false, message: newProblem }
            if (r.ok) { reset(); setMsg({ ok: true, text: mode === 'disable' ? 'Bloqueio desativado.' : 'PIN trocado.' }) }
            else setMsg({ ok: false, text: r.message ?? 'Não foi possível.' })
          }}
        >
          <label>PIN atual<input type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(e) => setCurrent(digits(e.target.value))} aria-label="PIN atual" autoFocus /></label>
          {mode === 'change' && (
            <div className="row">
              <label>Novo PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(digits(e.target.value))} aria-label="Novo PIN" /></label>
              <label>Repita o novo PIN<input type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} aria-label="Repita o novo PIN" /></label>
            </div>
          )}
          {mode === 'change' && newProblem && <p className="bad-text small" role="alert">{newProblem}</p>}
          <div className="head-actions">
            <button className="btn primary" disabled={!validPin(current) || (mode === 'change' && !newOk)}>{mode === 'disable' ? 'Desativar' : 'Trocar PIN'}</button>
            <button type="button" className="btn ghost" onClick={reset}>Cancelar</button>
          </div>
        </form>
      )}
      {msg && <p className={msg.ok ? 'pos small' : 'bad-text small'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  )
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
      <PinSection onClose={onClose} />
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
