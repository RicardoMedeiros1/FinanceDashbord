import { expect, test } from '../support/test'
import { device } from '../support/util'

test('o nome do perfil aparece na saudação e persiste', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL) // relógio fixo às 12h → "Boa tarde"
  await p.goto('./')
  await expect(p.locator('h1')).toHaveText('Boa tarde') // sem nome, nada fixo no código
  await p.click('button:has-text("Dados")')
  await p.fill('input[placeholder="Como quer ser chamado"]', 'Maria')
  await p.click('button:has-text("Salvar")')
  await expect(p.getByText('Nome salvo.')).toBeVisible()
  await p.click('.icon-btn[aria-label="Fechar"]')
  await expect(p.locator('h1')).toHaveText('Boa tarde, Maria')
  await p.reload()
  await expect(p.locator('h1')).toHaveText('Boa tarde, Maria')

  // "Começar do zero" não apaga o nome; limpar o campo remove
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Começar do zero")')
  await expect(p.locator('input[placeholder="Como quer ser chamado"]')).toHaveValue('Maria')
  await p.fill('input[placeholder="Como quer ser chamado"]', '')
  await p.click('button:has-text("Salvar")')
  await p.click('.icon-btn[aria-label="Fechar"]')
  await expect(p.locator('h1')).toHaveText('Boa tarde')
  expect(p.errors).toEqual([])
})
