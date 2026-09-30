import { expect, test } from '../support/test'
import { startFakeCloud, type FakeCloud } from '../support/fakeserver'
import { device } from '../support/util'

let cloud: FakeCloud
test.beforeEach(async () => {
  cloud = await startFakeCloud(4300)
})
test.afterEach(async () => {
  await cloud.close()
})

test('convite por e-mail: define a senha e entra', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./#type=invite&rt=abc')
  await expect(p.getByRole('heading', { name: 'Bem-vindo ao Finn' })).toBeVisible()
  await expect(p.getByText('Você foi convidado')).toBeVisible()
  await p.getByLabel('Nova senha', { exact: true }).fill('minhaSenha123')
  await p.getByLabel('Repita a nova senha').fill('minhaSenha123')
  await p.getByRole('button', { name: 'Definir senha e entrar' }).click()
  await expect(p.locator('.sidebar')).toBeVisible()
  expect(cloud.state.password).toBe('minhaSenha123')
  expect(p.errors).toEqual([])
})

test('privacidade e termos abrem sem login', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.click('a:has-text("Privacidade e termos de uso")')
  await expect(p.getByRole('heading', { name: 'Privacidade e termos de uso' })).toBeVisible()
  await p.click('a:has-text("Voltar")')
  await expect(p.locator('input[type=email]')).toBeVisible()
})

test('excluir a conta apaga tudo e exige confirmação digitada', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', 'pw')
  await p.click('button:has-text("Entrar")')
  await p.waitForSelector('.sync-badge.ok')
  await p.click('button:has-text("Nova transação")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Teste')
  await p.fill('input[placeholder="0,00"]', '10')
  await p.click('form button.btn.primary')
  await expect.poll(() => cloud.rows.size).toBeGreaterThan(0)

  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Excluir minha conta")')
  const confirm = p.getByRole('button', { name: 'Excluir minha conta para sempre' })
  await expect(confirm).toBeDisabled()
  await p.getByLabel('Digite EXCLUIR para confirmar').fill('excluir') // minúsculas não valem
  await expect(confirm).toBeDisabled()
  await p.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await confirm.click()

  await expect(p.locator('input[type=email]')).toBeVisible() // voltou para o login
  expect(cloud.state.deleted).toBe(true)
  expect(cloud.rows.size).toBe(0)
  const left = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fd:')))
  expect(left).toEqual([])
  // a conta não existe mais
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', 'pw')
  await p.click('button:has-text("Entrar")')
  await expect(p.getByRole('alert')).toContainText('E-mail ou senha incorretos')
})
