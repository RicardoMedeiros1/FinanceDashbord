import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const seed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  const t = (id: string, date: string, description: string, amount: number, type = 'expense', category = 'alimentacao') => ({ id, date, description, amount, type, category })
  localStorage.setItem(
    'fd:txs',
    JSON.stringify([
      t('1', '2026-08-05', 'Salário', 5000, 'income', 'salario'),
      t('2', '2026-08-10', 'Mercado Central', 400),
      t('3', '2026-09-05', 'Salário', 5000, 'income', 'salario'),
      t('4', '2026-09-10', 'Mercado Central', 600),
      t('5', '2026-09-22', 'Cinema', 50, 'expense', 'lazer'),
    ]),
  )
  localStorage.setItem('fd:budgets', JSON.stringify([{ category: 'alimentacao', limit: 500 }]))
}

test('relatório do mês: números, navegação entre meses e visual de impressão', async ({ browser, baseURL }, info) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/overview')
  await p.getByRole('button', { name: 'Relatório do mês' }).click()
  const dlg = p.getByRole('dialog', { name: 'Relatório do mês' })
  await expect(dlg).toContainText('Setembro de 2026')
  expect(norm(await dlg.getByTestId('rp-income').textContent())).toBe('R$ 5.000,00')
  expect(norm(await dlg.getByTestId('rp-expense').textContent())).toBe('R$ 650,00')
  expect(norm(await dlg.getByTestId('rp-balance').textContent())).toBe('+ R$ 4.350,00')
  await expect(dlg.getByRole('table', { name: 'Despesas por categoria' })).toContainText('Alimentação')
  await expect(dlg.getByRole('table', { name: 'Estabelecimentos' })).toContainText('Mercado Central')
  await expect(dlg.getByRole('table', { name: 'Orçamentos e limites' })).toContainText('estourou') // 600 de 500
  await expect(dlg.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()

  // mês anterior
  await dlg.getByRole('button', { name: 'Mês anterior' }).click()
  await expect(dlg).toContainText('Agosto de 2026')
  expect(norm(await dlg.getByTestId('rp-expense').textContent())).toBe('R$ 400,00')
  await expect(dlg.getByRole('button', { name: 'Mês anterior' })).toBeDisabled()
  await dlg.getByRole('button', { name: 'Próximo mês' }).click()

  // impressão: só o relatório aparece, em fundo claro
  await p.emulateMedia({ media: 'print' })
  await expect(p.locator('.sidebar')).toBeHidden()
  await expect(p.locator('.topbar')).toBeHidden()
  await expect(dlg.locator('.report-actions')).toBeHidden()
  await expect(dlg.getByRole('article')).toBeVisible()
  expect(await p.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
  const pdf = await p.pdf({ format: 'A4', printBackground: true })
  expect(pdf.length).toBeGreaterThan(5_000)
  await info.attach('relatorio.pdf', { body: pdf, contentType: 'application/pdf' })
  await p.emulateMedia({ media: 'screen' })

  // fechar volta ao normal (a classe de impressão sai)
  await p.getByRole('button', { name: 'Fechar' }).click()
  expect(await p.evaluate(() => document.body.classList.contains('printing-report'))).toBe(false)
  await expect(p.locator('.sidebar')).toBeVisible()
})
