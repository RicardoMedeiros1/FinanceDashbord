import { expect, test } from '../support/test'
import { startFakeCloud, type FakeCloud } from '../support/fakeserver'
import { device, until } from '../support/util'

let cloud: FakeCloud
test.beforeEach(async () => {
  cloud = await startFakeCloud(4300)
})
test.afterEach(async () => {
  await cloud.close()
})

const login = async (p: any) => {
  await p.goto('./')
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', 'pw')
  await p.click('button:has-text("Entrar")')
}
const code = (p: any, c: string) => p.getByLabel('Código de 6 dígitos').fill(c)

test('primeiro login com 2FA obrigatório: cadastra o aplicativo, erra o código e entra', async ({ browser, baseURL }) => {
  cloud.state.mfa.enforce = true // o banco só entrega dados à sessão verificada
  const { p } = await device(browser, baseURL)
  await login(p)
  await expect(p.getByRole('heading', { name: /Ative a verificação em duas etapas/ })).toBeVisible()
  await expect(p.getByTestId('mfa-secret')).toHaveText('JBSW Y3DP EHPK 3PXP')
  await expect(p.getByAltText('QR code para o aplicativo autenticador')).toBeVisible()
  expect(cloud.state.fetches).toEqual([]) // nenhum dado foi pedido ainda
  await expect(p.locator('.sidebar')).toHaveCount(0)

  // código curto nem envia; errado mostra o aviso e limpa o campo
  await code(p, '12345')
  await expect(p.getByRole('button', { name: 'Ativar' })).toBeDisabled()
  await code(p, '000000')
  await p.getByRole('button', { name: 'Ativar' }).click()
  await expect(p.getByRole('alert')).toContainText('Código incorreto ou vencido')
  await expect(p.getByLabel('Código de 6 dígitos')).toHaveValue('')
  expect(cloud.state.mfa.enrolled).toBe(false)

  await code(p, '123456')
  await p.getByRole('button', { name: 'Ativar' }).click()
  await expect(p.locator('.sidebar')).toBeVisible()
  await p.waitForSelector('.sync-badge.ok')
  expect(cloud.state.mfa.enrolled).toBe(true)
  expect(cloud.state.fetches.length).toBeGreaterThan(0) // só depois de verificar
  expect(p.errors).toEqual([])
})

test('com o 2FA ativo, outro aparelho precisa do código antes de ver qualquer dado', async ({ browser, baseURL }) => {
  cloud.state.mfa.enrolled = true
  cloud.state.mfa.enforce = true
  const { p } = await device(browser, baseURL)
  await login(p)
  await expect(p.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible()
  await expect(p.getByText('me@x.com')).toBeVisible()
  expect(cloud.state.fetches).toEqual([])
  await expect(p.locator('.sidebar')).toHaveCount(0)

  await code(p, '999999')
  await p.getByRole('button', { name: 'Confirmar' }).click()
  await expect(p.getByRole('alert')).toContainText('Código incorreto ou vencido')
  await expect(p.locator('.sidebar')).toHaveCount(0)
  expect(cloud.state.fetches).toEqual([])

  await code(p, '123456')
  await p.getByRole('button', { name: 'Confirmar' }).click()
  await expect(p.locator('.sidebar')).toBeVisible()
  await p.waitForSelector('.sync-badge.ok')

  // recarregar mantém a sessão verificada; sair e entrar de novo pede o código outra vez
  await p.reload()
  await expect(p.locator('.sidebar')).toBeVisible()
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Sair desta conta")')
  await p.waitForSelector('input[type=email]')
  await login(p)
  await expect(p.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible()
})

test('pelo desafio dá para sair sem digitar o código', async ({ browser, baseURL }) => {
  cloud.state.mfa.enrolled = true
  const { p } = await device(browser, baseURL)
  await login(p)
  await expect(p.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible()
  await p.getByRole('button', { name: 'Sair' }).click()
  await expect(p.locator('input[type=email]')).toBeVisible()
})

test('link de recuperação de senha também passa pelo código', async ({ browser, baseURL }) => {
  cloud.state.mfa.enrolled = true
  cloud.state.mfa.enforce = true
  const { p } = await device(browser, baseURL)
  await p.goto('./#type=recovery&rt=abc')
  // só o link do e-mail não basta: primeiro o código do aplicativo, depois a nova senha
  await expect(p.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible()
  await expect(p.getByRole('heading', { name: 'Nova senha' })).toHaveCount(0)
  await code(p, '123456')
  await p.getByRole('button', { name: 'Confirmar' }).click()
  await expect(p.getByRole('heading', { name: 'Nova senha' })).toBeVisible()
  await p.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
  await p.getByLabel('Repita a nova senha').fill('novaSenha123')
  await p.getByRole('button', { name: 'Salvar e entrar' }).click()
  await expect(p.locator('.sidebar')).toBeVisible()
  expect(cloud.state.password).toBe('novaSenha123')
})

test('se o servidor não oferece o 2FA, mostra o motivo e só então deixa seguir', async ({ browser, baseURL }) => {
  cloud.state.mfa.enforce = true
  cloud.state.mfa.enrollError = 'A verificação em duas etapas está desligada no Supabase (Authentication → Sign In / Providers → Multi-Factor → TOTP).'
  const { p } = await device(browser, baseURL)
  await login(p)
  await expect(p.getByRole('alert')).toContainText('desligada no Supabase')
  await expect(p.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
  await p.getByRole('button', { name: /Continuar sem verificação/ }).click()
  await expect(p.locator('.sidebar')).toBeVisible()

  // outro erro qualquer: sem atalho para pular
  const d2 = await device(browser, baseURL)
  cloud.state.mfa.enrollError = 'Erro inesperado no servidor.'
  await login(d2.p)
  await expect(d2.p.getByRole('alert')).toContainText('Erro inesperado')
  await expect(d2.p.getByRole('button', { name: /Continuar sem verificação/ })).toHaveCount(0)
})

test('em Segurança: se o 2FA ficou desligado no servidor, aparece "Desligada"', async ({ browser, baseURL }) => {
  cloud.state.mfa.enforce = true
  cloud.state.mfa.enrollError = 'A verificação em duas etapas está desligada no Supabase (Authentication → Sign In / Providers → Multi-Factor → TOTP).'
  const { p } = await device(browser, baseURL)
  await login(p)
  await p.getByRole('button', { name: /Continuar sem verificação/ }).click()
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  await expect(p.getByRole('region', { name: 'Verificação em duas etapas' })).toContainText('Desligada')
  await expect(p.getByRole('button', { name: 'Trocar o aplicativo autenticador' })).toHaveCount(0)
})

test('em Segurança: com 2FA aparece "Ativada" e dá para trocar o aplicativo autenticador', async ({ browser, baseURL }) => {
  cloud.state.mfa.enrolled = true
  cloud.state.mfa.enforce = true
  const { p } = await device(browser, baseURL)
  await login(p)
  await code(p, '123456')
  await p.getByRole('button', { name: 'Confirmar' }).click()
  await p.waitForSelector('.sync-badge.ok')
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  await expect(p.getByRole('region', { name: 'Verificação em duas etapas' })).toContainText('Ativada')
  await p.getByRole('button', { name: 'Trocar o aplicativo autenticador' }).click() // o diálogo de confirmação é aceito pelo helper
  await until(() => cloud.state.mfa.enrolled === false, 'fator removido')
  await expect(p.getByRole('heading', { name: /Ative a verificação em duas etapas/ })).toBeVisible()
})
