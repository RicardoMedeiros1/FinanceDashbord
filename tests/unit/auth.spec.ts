import { expect, test } from '../support/test'
import { friendlyAuthError as f } from '../../src/cloud/authError'
import { cleanKey, normalizeSupabaseUrl as n } from '../../src/cloud/normalize'

const ok = 'https://abcdefgh.supabase.co'

test('normaliza a URL do Supabase colada de várias formas', () => {
  for (const input of [ok, `${ok}/`, `${ok}/rest/v1/`, `${ok}/auth/v1`, `  ${ok}  `, `"${ok}"`, 'abcdefgh.supabase.co', 'https://supabase.com/dashboard/project/abcdefgh', 'https://supabase.com/dashboard/project/abcdefgh/settings/api']) {
    expect(n(input), input).toBe(ok)
  }
  expect(n('')).toBeUndefined()
  expect(n(undefined)).toBeUndefined()
  expect(n('   ')).toBeUndefined()
})

test('limpa espaços e aspas da chave', () => {
  expect(cleanKey(' eyJ.abc \n')).toBe('eyJ.abc')
  expect(cleanKey('"sb_publishable_x"')).toBe('sb_publishable_x')
  expect(cleanKey('  ')).toBeUndefined()
})

test('erros de login viram mensagens em português', () => {
  expect(f({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe('E-mail ou senha incorretos.')
  expect(f({ message: 'x', code: 'email_not_confirmed' })).toContain('não confirmado')
  expect(f({ message: 'x', code: 'over_request_rate_limit', status: 429 })).toContain('Muitas tentativas')
  expect(f({ message: 'x', code: 'email_provider_disabled' })).toContain('desativado')
  expect(f({ message: 'Invalid API key', status: 401 })).toContain('Chave do Supabase inválida')
  expect(f({ message: 'Invalid path specified in request URL', status: 404 })).toContain('Endereço do Supabase incorreto')
  expect(f({ message: 'Failed to fetch', name: 'AuthRetryableFetchError' })).toContain('Sem conexão')
  expect(f({ message: 'x', code: 'same_password' })).toContain('diferente da atual')
  expect(f({ message: 'x', code: 'weak_password' })).toContain('Senha fraca')
  expect(f({ message: 'Database error', code: 'unexpected_failure', status: 500 })).toContain('detalhe: unexpected_failure · 500 · Database error')
})

test('erros do 2FA viram mensagens em português', () => {
  expect(f({ message: 'Invalid TOTP code entered', code: 'mfa_verification_failed' })).toContain('Código incorreto ou vencido')
  expect(f({ message: 'x', code: 'mfa_challenge_expired' })).toContain('demorou demais')
  expect(f({ message: 'MFA enroll is disabled for TOTP', code: 'mfa_totp_enroll_not_enabled' })).toContain('desligada no Supabase')
  expect(f({ message: 'x', code: 'insufficient_aal' })).toContain('Confirme o código')
})
