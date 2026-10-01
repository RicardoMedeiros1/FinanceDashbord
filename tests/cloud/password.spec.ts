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

const login = async (p: any, email: string, pw: string) => {
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', pw)
  await p.click('button:has-text("Entrar")')
}

test('esqueci minha senha envia o e-mail sem revelar se a conta existe', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.click('button:has-text("Esqueci minha senha")')
  await p.fill('input[type=email]', 'alguem@x.com')
  await p.click('button:has-text("Enviar link")')
  await expect(p.getByRole('status')).toContainText('Se esse e-mail tiver uma conta')
  expect(cloud.state.resets).toEqual(['alguem@x.com'])
  await p.click('button:has-text("Voltar para o login")')
  await expect(p.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('link de recuperação: define a nova senha e entra', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./#type=recovery&rt=abc')
  await expect(p.getByRole('heading', { name: 'Nova senha' })).toBeVisible()
  const save = p.getByRole('button', { name: 'Salvar e entrar' })
  await expect(save).toBeDisabled()
  const [n1, n2] = [p.getByLabel('Nova senha', { exact: true }), p.getByLabel('Repita a nova senha')]
  await n1.fill('curta')
  await expect(p.getByText(/Use pelo menos 12 caracteres/)).toBeVisible()
  await n1.fill('onzeletras1') // 11
  await expect(p.getByText(/Use pelo menos 12 caracteres/)).toBeVisible()
  await n1.fill('novaSenha123')
  await n2.fill('outraSenha123')
  await expect(p.getByText('As senhas não são iguais.')).toBeVisible()
  await expect(save).toBeDisabled()
  await n2.fill('novaSenha123')
  await save.click()
  await expect(p.locator('.sidebar')).toBeVisible()
  expect(cloud.state.password).toBe('novaSenha123')

  // sair e entrar: a senha antiga não vale mais, a nova vale
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Sair desta conta")')
  await expect(p.locator('input[type=email]')).toBeVisible()
  await login(p, 'me@x.com', 'pw')
  await expect(p.getByRole('alert')).toContainText('E-mail ou senha incorretos')
  await login(p, 'me@x.com', 'novaSenha123')
  await expect(p.locator('.sidebar')).toBeVisible()
  expect(p.errors).toEqual([])
})

test('trocar senha dentro do app', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await login(p, 'me@x.com', 'pw')
  await p.waitForSelector('.sync-badge.ok')
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Trocar senha")')
  await p.getByLabel('Nova senha', { exact: true }).fill('senhaNova456')
  await p.getByLabel('Repita a nova senha').fill('senhaNova456')
  await p.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(p.getByText('Senha alterada.')).toBeVisible()
  expect(cloud.state.password).toBe('senhaNova456')
  expect(p.errors).toEqual([])
})

test('link expirado mostra explicação em português', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(p.getByText('Esse link expirou ou já foi usado')).toBeVisible()
})

test('o nome do perfil sincroniza entre aparelhos', async ({ browser, baseURL }) => {
  const mk = async () => {
    const d = await device(browser, baseURL)
    await d.p.goto('./')
    await login(d.p, 'me@x.com', 'pw')
    await d.p.waitForSelector('.sync-badge.ok')
    return d.p
  }
  const a = await mk()
  const b = await mk()
  await a.click('button:has-text("Dados")')
  await a.fill('input[placeholder="Como quer ser chamado"]', 'Ana')
  await a.click('button:has-text("Salvar")')
  await until(async () => (await b.locator('h1').textContent()) === 'Boa tarde, Ana', 'nome chega ao outro aparelho')
})
