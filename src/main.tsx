import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { PrivacyPage } from './pages/Privacy'
import { LockGate } from './components/LockGate'
import { AuthGate } from './cloud/AuthGate'
import { CLOUD_ENABLED, createAuth } from './cloud/config'
import type { Auth } from './cloud/types'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './index.css'

registerSW({ immediate: true })

function Root() {
  const [auth, setAuth] = useState<Auth | null>(null)
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (CLOUD_ENABLED) void createAuth().then(setAuth)
  }, [])

  // Termos e privacidade abrem sem login.
  if (hash.startsWith('#/privacy')) return <PrivacyPage />
  // Sem conta (ou sem sair dela) o PIN protege só este aparelho. Sair da conta apaga os dados e o PIN daqui.
  const wipe = async () => {
    try {
      await auth?.signOut()
    } catch {
      /* sem rede: segue apagando */
    }
    Object.keys(localStorage).filter((k) => k.startsWith('fd:')).forEach((k) => localStorage.removeItem(k))
    window.location.hash = ''
    window.location.reload()
  }
  const lockProps = { onWipe: () => void wipe(), wipeOnMaxFails: CLOUD_ENABLED, cloud: CLOUD_ENABLED }

  // Sem as variáveis do Supabase o app roda só local, como antes.
  if (!CLOUD_ENABLED) return <LockGate {...lockProps}><App /></LockGate>
  if (!auth) return <div className="splash" aria-busy="true"><span className="brand-mark" /></div>
  return (
    <LockGate {...lockProps}>
      <AuthGate auth={auth}>{(s) => <App key={s.userId} cloud={{ userId: s.userId, email: s.email, auth }} />}</AuthGate>
    </LockGate>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
