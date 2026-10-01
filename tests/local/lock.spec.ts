import { expect, test } from '../support/test'
import { device } from '../support/util'

const hide = (p: any) => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
const show = (p: any) => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
const lockState = (p: any) => p.evaluate(() => JSON.parse(localStorage.getItem('fd:lock') || 'null'))
const screen = (p: any) => p.getByRole('dialog', { name: 'Finn bloqueado' })

async function enable(p: any, timeout = 'Depois de 5 minutos', pin = '482915') {
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  const sec = p.getByRole('region', { name: 'Bloqueio com PIN' })
  await sec.getByLabel('Novo PIN').fill(pin)
  await sec.getByLabel('Repita o PIN').fill(pin)
  await sec.getByLabel('Quando bloquear').selectOption({ label: timeout })
  await sec.getByRole('button', { name: 'Ativar bloqueio' }).click()
  await expect(sec).toContainText('Ativado')
  await p.click('.icon-btn[aria-label="Fechar"]')
}

test('ativar o PIN: recusa PIN fraco e diferente, e guarda só o hash', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  const sec = p.getByRole('region', { name: 'Bloqueio com PIN' })
  await expect(sec).toContainText('Desligado')
  await sec.getByLabel('Novo PIN').fill('123456')
  await sec.getByLabel('Repita o PIN').fill('123456')
  await expect(sec.getByRole('alert')).toContainText('fácil demais')
  await expect(sec.getByRole('button', { name: 'Ativar bloqueio' })).toBeDisabled()
  await sec.getByLabel('Novo PIN').fill('482915')
  await sec.getByLabel('Repita o PIN').fill('482916')
  await expect(sec.getByRole('alert')).toContainText('não são iguais')
  await sec.getByLabel('Novo PIN').fill('48291')
  await expect(sec.getByRole('alert')).toContainText('6 dígitos')
  await sec.getByLabel('Novo PIN').fill('482915')
  await sec.getByLabel('Repita o PIN').fill('482915')
  await sec.getByRole('button', { name: 'Ativar bloqueio' }).click()
  await expect(sec).toContainText('Ativado')
  const raw = await p.evaluate(() => localStorage.getItem('fd:lock'))
  expect(raw).not.toContain('482915')
  expect(JSON.parse(raw!)).toMatchObject({ timeout: 5, fails: 0 })
})

test('ao abrir o app, ele começa travado; PIN errado, espera e PIN certo', async ({ browser, baseURL }) => {
  const { p, ctx } = await device(browser, baseURL)
  await p.goto('./')
  await enable(p)
  await p.reload()
  await expect(screen(p)).toBeVisible()
  await expect(p.locator('.sidebar')).toBeHidden() // o app fica escondido e inerte
  await expect(p.locator('.lock-content')).toHaveAttribute('inert', '')

  for (const wrong of ['111111', '222222']) {
    await p.getByLabel('PIN').fill(wrong)
    await expect(p.getByRole('alert')).toContainText('PIN incorreto')
  }
  await p.getByLabel('PIN').fill('333333') // o terceiro erro pede espera
  await expect(p.getByRole('alert')).toContainText('Aguarde 30 segundos')
  await expect(p.getByLabel('PIN')).toBeDisabled()
  expect((await lockState(p)).fails).toBe(3)

  await ctx.clock.fastForward(31_000)
  await expect(p.getByLabel('PIN')).toBeEnabled()
  await p.getByLabel('PIN').fill('482915')
  await expect(screen(p)).toHaveCount(0)
  await expect(p.locator('.sidebar')).toBeVisible()
  expect((await lockState(p)).fails).toBe(0)
  expect(p.errors).toEqual([])
})

test('bloqueia sozinho: ao sair do app, depois do tempo escolhido e por inatividade', async ({ browser, baseURL }) => {
  const { p, ctx } = await device(browser, baseURL)
  await p.goto('./')
  await enable(p, 'Depois de 5 minutos')
  await p.reload()
  await p.getByLabel('PIN').fill('482915')
  await expect(screen(p)).toHaveCount(0)

  // 2 minutos fora: ainda não bloqueia; 6 minutos: bloqueia
  await hide(p); await ctx.clock.fastForward(2 * 60_000); await show(p)
  await expect(screen(p)).toHaveCount(0)
  await hide(p); await ctx.clock.fastForward(6 * 60_000); await show(p)
  await expect(screen(p)).toBeVisible()
  await p.getByLabel('PIN').fill('482915')

  // parado com o app aberto por mais de 5 minutos
  await ctx.clock.runFor(5 * 60_000 + 20_000) // roda os temporizadores do app (fastForward dispara cada um só uma vez)
  await expect(screen(p)).toBeVisible()
  await p.getByLabel('PIN').fill('482915')

  // "ao sair do app": qualquer saída bloqueia
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  await p.getByLabel('Quando bloquear').selectOption({ label: 'Ao sair do app' })
  expect((await lockState(p)).timeout).toBe(0)
  await p.click('.icon-btn[aria-label="Fechar"]')
  await hide(p); await show(p)
  await expect(screen(p)).toBeVisible()
})

test('botão Bloquear agora, trocar PIN e desativar exigem o PIN atual', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await enable(p)
  await p.click('button[aria-label="Bloquear o app"]')
  await expect(screen(p)).toBeVisible()
  await p.getByLabel('PIN').fill('482915')

  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  const sec = p.getByRole('region', { name: 'Bloqueio com PIN' })
  await sec.getByRole('button', { name: 'Trocar PIN' }).click()
  await sec.getByLabel('PIN atual').fill('999999')
  await sec.getByLabel('Novo PIN', { exact: true }).fill('135792')
  await sec.getByLabel('Repita o novo PIN').fill('135792')
  await sec.getByRole('button', { name: 'Trocar PIN' }).click()
  await expect(sec.getByRole('alert')).toContainText('PIN incorreto')
  await sec.getByLabel('PIN atual').fill('482915')
  await sec.getByRole('button', { name: 'Trocar PIN' }).click()
  await expect(sec).toContainText('PIN trocado')

  await p.reload()
  await p.getByLabel('PIN').fill('482915') // o antigo não vale mais
  await expect(p.getByRole('alert')).toContainText('PIN incorreto')
  await p.getByLabel('PIN').fill('135792')
  await expect(screen(p)).toHaveCount(0)

  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  await sec.getByRole('button', { name: 'Desativar' }).click()
  await sec.getByLabel('PIN atual').fill('135792')
  await sec.getByRole('button', { name: 'Desativar', exact: true }).last().click()
  await expect(sec).toContainText('Bloqueio desativado')
  expect(await lockState(p)).toBeNull()
  await p.reload()
  await expect(p.locator('.sidebar')).toBeVisible() // sem PIN, abre direto
  await expect(screen(p)).toHaveCount(0)
})

test('sem conta, esqueci o PIN só se resolve apagando os dados do aparelho', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await enable(p)
  await p.reload()
  await p.getByRole('button', { name: 'Esqueci o PIN' }).click()
  await expect(p.getByText('não há como recuperar o PIN')).toBeVisible()
  const wipe = p.getByRole('button', { name: 'Apagar os dados e remover o PIN' })
  await expect(wipe).toBeDisabled()
  await p.getByLabel('Digite APAGAR para confirmar').fill('apagar')
  await expect(wipe).toBeDisabled() // tem que ser em maiúsculas
  await p.getByLabel('Digite APAGAR para confirmar').fill('APAGAR')
  await wipe.click()
  await p.waitForLoadState('load')
  await expect(p.locator('.sidebar')).toBeVisible()
  expect(await lockState(p)).toBeNull()
  expect(await p.ls('fd:txs')).not.toEqual([]) // voltou com os dados de exemplo (o aparelho foi limpo)
})

test('a tela de PIN cabe no celular e o teclado numérico é o padrão', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { viewport: { width: 380, height: 700 } })
  await p.goto('./')
  await enable(p)
  await p.reload()
  await expect(p.getByLabel('PIN')).toHaveAttribute('inputmode', 'numeric')
  await expect(p.getByLabel('PIN')).toHaveAttribute('type', 'password')
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})
