import { expect, test } from '../support/test'
import { device } from '../support/util'

const seed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  const t = (id: string, date: string, description: string, amount: number) => ({ id, date, description, amount, type: 'expense', category: 'compras' })
  localStorage.setItem(
    'fd:txs',
    JSON.stringify([
      t('1', '2026-07-05', 'StreamMax', 29.9),
      t('2', '2026-08-05', 'StreamMax', 29.9),
      t('3', '2026-09-05', 'StreamMax', 39.9),
      t('4', '2026-09-26', 'Loja Azul', 89.9),
      t('5', '2026-09-27', 'Loja Azul', 89.9),
    ]),
  )
}

test('alertas: aparecem na visão geral, podem ser dispensados (e continuam dispensados) e o assistente lista', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/overview')
  const card = p.getByRole('region', { name: 'Alertas' })
  await expect(card).toContainText('Possível cobrança repetida em Loja Azul')
  await expect(card).toContainText('Streammax ficou mais caro')
  await expect(card.locator('li')).toHaveCount(2)

  await card.getByRole('button', { name: /Dispensar alerta: Possível cobrança repetida/ }).click()
  await expect(card.locator('li')).toHaveCount(1)
  await p.reload()
  await expect(p.getByRole('region', { name: 'Alertas' }).locator('li')).toHaveCount(1) // lembrou
  expect(await p.evaluate(() => JSON.parse(localStorage.getItem('fd:alerts-off') || '[]'))).toEqual(['dup-4-5'])

  // o assistente continua listando tudo
  await p.goto('./#/assistant')
  await p.getByLabel('Pergunta').fill('Tenho algum alerta?')
  await p.keyboard.press('Enter')
  await expect(p.locator('body')).toContainText('Streammax ficou mais caro')
  await expect(p.locator('body')).toContainText('Loja Azul')

  // dispensar o último some o cartão
  await p.goto('./#/overview')
  await p.getByRole('button', { name: /Dispensar alerta: Streammax/ }).click()
  await expect(p.getByRole('region', { name: 'Alertas' })).toHaveCount(0)
})
