import { Lock } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MAX_FAILS, PIN_LENGTH, readLock, removeLock, setPin, setTimeoutMinutes, shouldLock, validPin, verifyPin, type Timeout } from '../lock'

export interface LockApi {
  enabled: boolean
  timeout: Timeout
  lockNow: () => void
  enable: (pin: string, timeout: Timeout) => Promise<void>
  /** false se o PIN atual não confere */
  disable: (current: string) => Promise<{ ok: boolean; message?: string }>
  change: (current: string, next: string) => Promise<{ ok: boolean; message?: string }>
  setTimeout: (t: Timeout) => void
}

const LockContext = createContext<LockApi | null>(null)
export const useLock = () => useContext(LockContext)

const waitText = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return s >= 90 ? `${Math.ceil(s / 60)} minutos` : `${s} segundos`
}

interface Props {
  children: ReactNode
  /** encerra a sessão e apaga os dados deste aparelho (PIN esquecido ou erros demais) */
  onWipe: () => void
  /** com conta na nuvem, ${MAX_FAILS} erros seguidos apagam os dados do aparelho (estão salvos na nuvem); sem conta, nunca */
  wipeOnMaxFails: boolean
  /** como o PIN é recuperado: com conta, entrando de novo; sem conta, só apagando os dados do aparelho */
  cloud: boolean
}

/** Trava o app com um PIN: ao abrir, ao ficar fora por um tempo ou sob demanda. */
export function LockGate({ children, onWipe, wipeOnMaxFails, cloud }: Props) {
  const [version, setVersion] = useState(0)
  const config = useMemo(() => readLock(), [version]) // eslint-disable-line react-hooks/exhaustive-deps
  const enabled = !!config
  const [locked, setLocked] = useState(() => !!readLock()) // ao abrir o app, começa travado
  const hiddenAt = useRef<number | null>(null)
  const lastActive = useRef(Date.now())
  const timeoutMin = (config?.timeout ?? 5) as Timeout

  // fora do app por tempo demais
  useEffect(() => {
    if (!enabled) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current !== null) {
        if (shouldLock(Date.now() - hiddenAt.current, timeoutMin)) setLocked(true)
        hiddenAt.current = null
        lastActive.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [enabled, timeoutMin])

  // parado com o app aberto
  useEffect(() => {
    if (!enabled || timeoutMin === 0) return
    const touch = () => (lastActive.current = Date.now())
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const t = setInterval(() => {
      if (Date.now() - lastActive.current >= timeoutMin * 60_000) setLocked(true)
    }, 15_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      clearInterval(t)
    }
  }, [enabled, timeoutMin])

  const api = useMemo<LockApi>(
    () => ({
      enabled,
      timeout: timeoutMin,
      lockNow: () => setLocked(true),
      enable: async (pin, timeout) => {
        await setPin(pin, timeout)
        lastActive.current = Date.now()
        setVersion((v) => v + 1)
      },
      disable: async (current) => {
        const r = await verifyPin(current)
        if (!r.ok) return { ok: false, message: 'waiting' in r ? `Muitas tentativas. Aguarde ${waitText(r.lockedUntil - Date.now())}.` : 'PIN incorreto.' }
        removeLock()
        setLocked(false)
        setVersion((v) => v + 1)
        return { ok: true }
      },
      change: async (current, next) => {
        const r = await verifyPin(current)
        if (!r.ok) return { ok: false, message: 'waiting' in r ? `Muitas tentativas. Aguarde ${waitText(r.lockedUntil - Date.now())}.` : 'PIN incorreto.' }
        await setPin(next, timeoutMin)
        setVersion((v) => v + 1)
        return { ok: true }
      },
      setTimeout: (t) => {
        setTimeoutMinutes(t)
        setVersion((v) => v + 1)
      },
    }),
    [enabled, timeoutMin],
  )

  const unlock = useCallback(() => {
    lastActive.current = Date.now()
    hiddenAt.current = null
    setLocked(false)
  }, [])

  const showLock = enabled && locked
  return (
    <LockContext.Provider value={api}>
      {/* trancado: o app fica no lugar (para não perder nada), mas invisível e inerte */}
      <div className="lock-content" style={showLock ? { visibility: 'hidden' } : undefined} aria-hidden={showLock || undefined} inert={showLock || undefined}>
        {children}
      </div>
      {showLock && <LockScreen onUnlock={unlock} onWipe={onWipe} wipeOnMaxFails={wipeOnMaxFails} cloud={cloud} />}
    </LockContext.Provider>
  )
}

function LockScreen({ onUnlock, onWipe, wipeOnMaxFails, cloud }: { onUnlock: () => void; onWipe: () => void; wipeOnMaxFails: boolean; cloud: boolean }) {
  const [pin, setPinValue] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [forgot, setForgot] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const until = readLock()?.lockedUntil ?? 0
  const waiting = until > now

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const submit = async (value: string) => {
    if (busy || waiting || !validPin(value)) return
    setBusy(true)
    setError('')
    try {
      const r = await verifyPin(value)
      if (r.ok) return onUnlock()
      setPinValue('')
      setNow(Date.now())
      if ('waiting' in r) return
      if (r.wipe && wipeOnMaxFails) return onWipe()
      setError(r.lockedUntil ? 'PIN incorreto.' : `PIN incorreto. ${r.fails === 2 ? 'Mais um erro e o app pede uma espera.' : ''}`.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="Finn bloqueado">
      <div className="login-card">
        <span className="brand-mark" />
        <h1><Lock size={22} /> Finn bloqueado</h1>
        <p className="muted">Digite o seu PIN de {PIN_LENGTH} dígitos para continuar.</p>
        <input
          className="code-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          value={pin}
          disabled={waiting || busy}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
            setPinValue(v)
            if (v.length === PIN_LENGTH) void submit(v)
          }}
          aria-label="PIN"
          autoFocus
        />
        {waiting && <p className="bad-text small" role="alert">Muitas tentativas erradas. Aguarde {waitText(until - now)}.</p>}
        {!waiting && error && <p className="bad-text small" role="alert">{error}</p>}
        {wipeOnMaxFails && <p className="muted small">Depois de {MAX_FAILS} erros seguidos, o app sai da conta neste aparelho.</p>}
        {!forgot ? (
          <button type="button" className="link center" onClick={() => setForgot(true)}>Esqueci o PIN</button>
        ) : cloud ? (
          <div className="form">
            <p className="muted small">Você vai sair da conta neste aparelho. Seus dados estão na nuvem: ao entrar de novo com e-mail, senha e código, eles voltam.</p>
            <button className="btn danger" onClick={onWipe}>Sair da conta</button>
            <button className="link center" onClick={() => setForgot(false)}>Voltar</button>
          </div>
        ) : (
          <div className="form">
            <p className="muted small">Sem conta na nuvem, não há como recuperar o PIN: só apagando os dados deste aparelho (exporte um backup antes, se ainda puder). Digite APAGAR para confirmar.</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Digite APAGAR para confirmar" placeholder="APAGAR" />
            <button className="btn danger" disabled={confirmText !== 'APAGAR'} onClick={onWipe}>Apagar os dados e remover o PIN</button>
            <button className="link center" onClick={() => setForgot(false)}>Voltar</button>
          </div>
        )}
      </div>
    </div>
  )
}
