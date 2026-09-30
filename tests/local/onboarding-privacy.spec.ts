import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const clearAll = async (p: any) => {
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Começar do zero")')
  await p.click('.icon-btn[aria-label="Fechar"]')
}

test('boas-vindas: passo a passo que se completa sozinho e pode ser dispensado', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await expect(p.getByRole('region', { name: 'Primeiros passos', exact: true })).toHaveCount(0) // dados de exemplo (15+ lançamentos): não aparece
  await clearAll(p)
  const box = p.getByRole('region', { name: 'Primeiros passos', exact: true })
  await expect(box).toBeVisible()
  await expect(box).toContainText('0 de 4 passos concluídos')

  // nome
  await box.getByRole('button', { name: 'Definir nome' }).click()
  await p.fill('input[placeholder="Como quer ser chamado"]', 'Maria')
  await p.click('button:has-text("Salvar")')
  await p.click('.icon-btn[aria-label="Fechar"]')
  await expect(box).toContainText('1 de 4 passos concluídos')

  // conta: o botão leva à aba de contas
  await box.getByRole('button', { name: 'Cadastrar contas' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/cards/contas')
  await p.click('button:has-text("Nova conta")')
  await p.fill('input[placeholder^="Ex.: Nubank, Carteira"]', 'Nubank')
  await p.fill('input[placeholder="0,00"]', '1000')
  await p.click('form button.btn.primary')
  await p.click('.nav-item[aria-label="Visão geral"]')
  await expect(box).toContainText('2 de 4 passos concluídos')

  // salário: abre o formulário já como receita recorrente
  await box.getByRole('button', { name: 'Cadastrar salário' }).click()
  await expect(p.getByRole('heading', { name: 'Nova recorrente' })).toBeVisible()
  await expect(p.getByRole('button', { name: 'Receita' })).toHaveClass(/on/)
  await expect(p.getByLabel('Tipo de receita')).toHaveValue('salario')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Salário')
  await p.fill('input[placeholder="0,00"]', '5000')
  await p.click('form button.btn.primary')
  await expect(box).toContainText('3 de 4 passos concluídos')

  // dispensar persiste
  await p.click('button[aria-label="Dispensar primeiros passos"]')
  await expect(box).toHaveCount(0)
  await p.reload()
  await expect(p.getByRole('region', { name: 'Primeiros passos', exact: true })).toHaveCount(0)
  expect(p.errors).toEqual([])
})

test('boas-vindas somem quando os passos obrigatórios terminam', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, {
    init: () => {
      if (sessionStorage.getItem('s')) return
      sessionStorage.setItem('s', '1')
      const set = (k: string, v: unknown) => localStorage.setItem('fd:' + k, JSON.stringify(v))
      set('profile', [{ id: 'me', name: 'Ana' }])
      set('accounts', [{ id: 'a', name: 'Conta', kind: 'checking', openingBalance: 0, openingDate: '2026-09-01', color: '#fff' }])
      set('rules', [{ id: 'r', description: 'Salário', amount: 1000, type: 'income', category: 'salario', cycle: 'monthly', anchor: '2026-10-05', generated: 0, active: true }])
      set('txs', [1, 2, 3].map((i) => ({ id: 'e' + i, description: 'Gasto ' + i, amount: 10, type: 'expense', category: 'outros', date: '2026-09-0' + i })))
    },
  })
  await p.goto('./')
  await expect(p.locator('.stat').first()).toBeVisible()
  await expect(p.getByRole('region', { name: 'Primeiros passos', exact: true })).toHaveCount(0)
})

test('modo privacidade esconde os valores na tela e persiste', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL) // dados de exemplo
  await p.goto('./')
  const stat = p.locator('.stat').first()
  expect(norm(await stat.textContent())).toMatch(/\d/)
  await p.click('button[aria-label="Ocultar valores"]')
  const hidden = norm(await p.locator('main').textContent())
  expect(hidden).toContain('R$ •••••')
  expect(hidden).not.toMatch(/R\$\s*\d/) // nenhum valor em dinheiro visível
  await p.click('.nav-item[aria-label="Transações"]')
  expect(norm(await p.locator('main').textContent())).not.toMatch(/R\$\s*\d/)
  await p.reload()
  expect(norm(await p.locator('main').textContent())).not.toMatch(/R\$\s*\d/) // continua escondido
  await p.click('button[aria-label="Mostrar valores"]')
  expect(norm(await p.locator('main').textContent())).toMatch(/R\$\s*\d/)
  expect(p.errors).toEqual([])
})

test('página de privacidade e termos abre e volta ao app', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.click('button:has-text("Dados")')
  await p.click('a:has-text("Privacidade e termos de uso")')
  await expect(p.getByRole('heading', { name: 'Privacidade e termos de uso' })).toBeVisible()
  await expect(p.locator('.doc')).toContainText('Seus direitos')
  await p.click('a:has-text("Voltar")')
  await expect(p.locator('.sidebar')).toBeVisible()
})

test('sem nuvem não há conexão com bancos (precisa do servidor)', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await expect(p.locator('.sidebar')).toBeVisible()
  await expect(p.getByRole('button', { name: 'Bancos (Open Finance)' })).toHaveCount(0)
})
