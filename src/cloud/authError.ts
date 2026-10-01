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
  if (code === 'same_password' || /different from the old password/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (code === 'weak_password' || /password should be|weak password/i.test(msg)) return 'Senha fraca. Use pelo menos 12 caracteres (uma frase longa funciona bem), sem senhas comuns.'
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg)) return 'Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.'
  if (code === 'session_not_found' || code === 'not_authenticated' || /auth session missing/i.test(msg)) return 'Sessão expirada. Peça um novo link ou entre de novo.'
  if (code === 'mfa_verification_failed' || /invalid totp code/i.test(msg)) return 'Código incorreto ou vencido. Confira se a hora do celular está certa e digite o código atual.'
  if (code === 'mfa_challenge_expired' || /challenge.*expired/i.test(msg)) return 'O código demorou demais. Digite o código atual do aplicativo.'
  if (code === 'mfa_totp_enroll_not_enabled' || code === 'mfa_totp_verify_not_enabled' || /mfa.*(disabled|not enabled)/i.test(msg)) {
    return 'A verificação em duas etapas está desligada no Supabase (Authentication → Sign In / Providers → Multi-Factor → TOTP).'
  }
  if (code === 'insufficient_aal') return 'Confirme o código do aplicativo autenticador para continuar.'
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
  if (e.status === 404 || /invalid path/i.test(msg)) {
    return 'Endereço do Supabase incorreto. Em SUPABASE_URL use só https://xxxx.supabase.co (sem nada depois) e publique de novo.'
  }
  if (e.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e a variável SUPABASE_URL.'
  }
  const detail = [code, e.status, msg].filter(Boolean).join(' · ')
  return `Não foi possível concluir. Tente novamente.${detail ? ` (detalhe: ${detail})` : ''}`
}
