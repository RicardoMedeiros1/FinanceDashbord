import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthGate } from './cloud/AuthGate'
import { CLOUD_ENABLED, createAuth } from './cloud/config'
import type { Auth } from './cloud/types'
import './index.css'

registerSW({ immediate: true })

function Root() {
  const [auth, setAuth] = useState<Auth | null>(null)
  useEffect(() => {
    if (CLOUD_ENABLED) void createAuth().then(setAuth)
  }, [])

  // Sem as variáveis do Supabase o app roda só local, como antes.
  if (!CLOUD_ENABLED) return <App />
  if (!auth) return <div className="splash" aria-busy="true"><span className="brand-mark" /></div>
  return <AuthGate auth={auth}>{(s) => <App key={s.userId} cloud={{ userId: s.userId, email: s.email, auth }} />}</AuthGate>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
