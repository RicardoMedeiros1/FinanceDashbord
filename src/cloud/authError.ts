interface AuthErrorLike {
  message: string
  name?: string
  code?: string
  status?: number
}

/** Traduz erros de login do Supabase e, quando não reconhece, mostra o detalhe técnico para facilitar o diagnóstico. */
export function friendlyAuthError(e: AuthErrorLike): string {
  const msg = e.message ?? ''
  const code = e.code ?? ''
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'E-mail não confirmado. No Supabase, confirme o usuário (Auto Confirm User).'
  if (code === 'over_request_rate_limit' || e.status === 429 || /rate limit|too many requests/i.test(msg)) {
    return 'Muitas tentativas seguidas. Aguarde cerca de 10 minutos e tente de novo.'
  }
  if (code === 'email_provider_disabled' || /email logins are disabled|provider is not enabled/i.test(msg)) {
    return 'O login por e-mail está desativado no Supabase (Authentication → Sign In / Providers → Email).'
  }
  if (/invalid api key|no api key|apikey/i.test(msg) || code === 'bad_jwt') {
    return 'Chave do Supabase inválida. Confira a variável SUPABASE_ANON_KEY no GitHub e publique de novo.'
  }
  if (e.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e a variável SUPABASE_URL.'
  }
  const detail = [code, e.status, msg].filter(Boolean).join(' · ')
  return `Não foi possível entrar. Tente novamente.${detail ? ` (detalhe: ${detail})` : ''}`
}
