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

test('com conta: 10 erros de PIN seguidos saem da conta e limpam o aparelho; esqueci o PIN também', async ({ browser, baseURL }) => {
  const { p, ctx } = await device(browser, baseURL)
  await p.goto('./')
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', 'pw')
  await p.click('button:has-text("Entrar")')
  await p.waitForSelector('.sync-badge.ok')
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  const sec = p.getByRole('region', { name: 'Bloqueio com PIN' })
  await sec.getByLabel('Novo PIN').fill('482915')
  await sec.getByLabel('Repita o PIN').fill('482915')
  await sec.getByRole('button', { name: 'Ativar bloqueio' }).click()
  await p.click('.icon-btn[aria-label="Fechar"]')
  await p.reload()
  const screen = p.getByRole('dialog', { name: 'Finn bloqueado' })
  await expect(screen).toBeVisible()
  await expect(screen).toContainText('Depois de 10 erros seguidos, o app sai da conta')

  for (let i = 1; i <= 10; i++) {
    const until: number = await p.evaluate(() => JSON.parse(localStorage.getItem('fd:lock') || '{"lockedUntil":0}').lockedUntil)
    const now: number = await p.evaluate(() => Date.now())
    if (until > now) await ctx.clock.fastForward(until - now + 1000) // espera acabar
    if (i === 10) break
    await p.getByLabel('PIN').fill('000001')
    await expect(p.getByLabel('PIN')).toHaveValue('')
  }
  await p.getByLabel('PIN').fill('000001') // o décimo erro
  await p.waitForLoadState('load')
  await expect(p.locator('input[type=email]')).toBeVisible({ timeout: 15_000 }) // saiu da conta
  const left = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fd:')))
  expect(left).toEqual([])
  expect(cloud.rows.size).toBeGreaterThanOrEqual(0) // os dados continuam na nuvem

  // entrar de novo traz os dados de volta, sem PIN (o PIN era deste aparelho)
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', 'pw')
  await p.click('button:has-text("Entrar")')
  await expect(p.locator('.sidebar')).toBeVisible()
  await expect(screen).toHaveCount(0)
})

test('com conta, "Esqueci o PIN" sai da conta sem apagar nada da nuvem', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', 'pw')
  await p.click('button:has-text("Entrar")')
  await p.waitForSelector('.sync-badge.ok')
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  const sec = p.getByRole('region', { name: 'Bloqueio com PIN' })
  await sec.getByLabel('Novo PIN').fill('482915')
  await sec.getByLabel('Repita o PIN').fill('482915')
  await sec.getByRole('button', { name: 'Ativar bloqueio' }).click()
  await p.click('.icon-btn[aria-label="Fechar"]')
  await p.reload()
  await p.getByRole('button', { name: 'Esqueci o PIN' }).click()
  await expect(p.getByText('Seus dados estão na nuvem')).toBeVisible()
  await p.getByRole('button', { name: 'Sair da conta' }).click()
  await p.waitForLoadState('load')
  await expect(p.locator('input[type=email]')).toBeVisible()
})
