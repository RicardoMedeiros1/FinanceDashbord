import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const seed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  const t = (id: string, date: string, description: string, amount: number, type = 'expense') => ({ id, date, description, amount, type, category: type === 'income' ? 'salario' : 'outros' })
  localStorage.setItem(
    'fd:txs',
    JSON.stringify([
      t('1', '2026-09-10', 'MERCADOLIVRE*12AB34', 100),
      t('2', '2026-08-20', 'Mercado Livre', 50),
      t('3', '2026-09-01', 'MercadoLivre*X', 25.5),
      t('4', '2026-05-01', 'MERCADOLIVRE', 999), // fora dos 3 meses
      t('5', '2026-10-05', 'Mercado Livre', 77), // futura
      t('6', '2026-09-12', 'Pagamento efetuado|PADARIA ESTRELA LTDA', 32.5),
      t('7', '2026-09-20', 'Padaria Estrela', 12.5),
      t('8', '2026-09-05', 'Panificadora São José', 20),
      t('9', '2026-09-08', 'MERCADOPAGO*ABC', 40),
      t('10', '2026-09-01', 'Salário', 5000, 'income'),
    ]),
  )
}

test('onde gasto: ranking, grupos, busca por tipo, período e grupo salvo', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/transactions/merchants')
  await expect(p.getByRole('tab', { name: /Onde gasto/ })).toHaveAttribute('aria-selected', 'true')

  // ranking (3 meses): as grafias do Mercado Livre viram uma linha só; receita e compra futura ficam de fora
  const rows = p.locator('tbody tr')
  await expect(rows.first()).toContainText('Mercado Livre')
  expect(norm(await rows.first().textContent())).toContain('R$ 175,50')
  expect(norm(await rows.first().textContent())).toMatch(/3\s*R\$ 175,50/)
  await expect(p.locator('.spend-total')).toContainText('R$ 280,50') // 175,5 + 65 + 40
  await expect(p.getByRole('button', { name: 'Ver Mercado Pago' })).toBeVisible()

  // grupos sugeridos com gasto no período
  await expect(p.getByRole('button', { name: 'Ver gastos de Padaria' })).toContainText('R$ 65,00')
  await expect(p.getByRole('button', { name: 'Ver gastos de Mercado Livre' })).toContainText('3 compras')
  await expect(p.getByRole('button', { name: 'Ver gastos de Amazon' })).toHaveCount(0) // sem compras: não aparece

  // tudo de padaria (e afins)
  await p.getByRole('button', { name: 'Ver gastos de Padaria' }).click()
  await expect(p.getByTestId('spend-total')).toHaveText(/R\$\s65,00/)
  await expect(p.getByTestId('spend-count')).toHaveText('3')
  await expect(p.locator('tbody tr')).toHaveCount(3)
  await expect(p.locator('.spend-bar')).toHaveCount(3) // jul, ago, set
  await expect(p.locator('tbody')).toContainText('Panificadora São José')
  await expect(p.locator('tbody')).not.toContainText('Mercado')

  // salva o grupo
  await p.getByRole('button', { name: 'Salvar como grupo' }).click()
  await expect(p.getByLabel('Nome do grupo')).toHaveValue('Padaria')
  await p.getByLabel('Nome do grupo').fill('Padarias')
  await p.getByRole('button', { name: 'Salvar grupo' }).click()
  await expect(p.getByText('Grupo salvo')).toBeVisible()
  const profile = (await p.ls('fd:profile'))[0]
  expect(profile.groups).toHaveLength(1)
  expect(profile.groups[0]).toMatchObject({ name: 'Padarias', terms: 'padaria, panificadora, padoca, confeitaria' })

  // busca livre + período
  await p.getByRole('button', { name: 'Limpar busca' }).click()
  await p.getByLabel('Buscar estabelecimento ou tipo de gasto').fill('mercado livre')
  await expect(p.getByTestId('spend-total')).toHaveText(/R\$\s175,50/)
  await expect(p.getByTestId('spend-count')).toHaveText('3')
  await p.getByRole('button', { name: 'Tudo' }).click()
  await expect(p.getByTestId('spend-total')).toHaveText(/R\$\s1\.174,50/)
  await expect(p.getByTestId('spend-count')).toHaveText('4') // a de maio entra; a futura e o Mercado Pago, não
  await p.getByRole('button', { name: 'Este mês' }).click()
  await expect(p.getByTestId('spend-total')).toHaveText(/R\$\s125,50/)
  await p.getByLabel('Buscar estabelecimento ou tipo de gasto').fill('xyz inexistente')
  await expect(p.getByText('Nenhuma despesa encontrada')).toBeVisible()

  // escolher um estabelecimento no ranking é exato
  await p.getByRole('button', { name: 'Limpar busca' }).click()
  await p.getByRole('button', { name: 'Ver Padaria Estrela Ltda' }).click()
  await expect(p.getByTestId('spend-count')).toHaveText('1')

  // o grupo salvo continua depois de recarregar e pode ser excluído
  await p.reload()
  await p.getByRole('button', { name: 'Tudo' }).click()
  await expect(p.getByRole('button', { name: 'Ver gastos de Padarias' })).toBeVisible()
  await expect(p.getByRole('button', { name: 'Ver gastos de Padaria', exact: true })).toHaveCount(0) // a sugestão some: já tem o seu
  await p.getByRole('button', { name: 'Excluir grupo Padarias' }).click()
  await expect(p.getByRole('button', { name: 'Ver gastos de Padarias' })).toHaveCount(0)
  expect((await p.ls('fd:profile'))[0].groups).toEqual([])
  expect(p.errors).toEqual([])
})

test('onde gasto respeita o modo privacidade e volta para Lançamentos pela aba', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/transactions/merchants')
  await p.click('button[aria-label="Ocultar valores"]')
  expect(norm(await p.locator('main').textContent())).not.toMatch(/R\$\s*\d/)
  await p.getByRole('tab', { name: 'Lançamentos' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/transactions')
  await p.getByRole('tab', { name: /Onde gasto/ }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/transactions/merchants')
})

test('no celular a página não estoura a largura (nem com a aba Onde gasto)', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed, viewport: { width: 380, height: 800 } })
  for (const hash of ['#/', '#/transactions', '#/transactions/merchants']) {
    await p.goto('./' + hash)
    await p.waitForSelector('main')
    await p.waitForTimeout(300)
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, hash).toBeLessThanOrEqual(0)
  }
  await p.goto('./#/transactions/merchants')
  await p.getByRole('button', { name: 'Ver gastos de Padaria' }).click()
  await p.waitForSelector('.spend-bars')
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test('assistente responde quanto foi gasto num lugar ou tipo de gasto', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/assistant')
  const ask = async (q: string) => {
    await p.fill('input[aria-label="Pergunta"]', q)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(250)
    return norm(await p.locator('.bubble.bot').last().textContent())
  }
  const ml = await ask('Quanto gastei no Mercado Livre?')
  expect(ml).toContain('Mercado Livre:')
  expect(ml).toContain('Este mês: R$ 125,50 (2 compras)')
  expect(ml).toContain('Últimos 3 meses: R$ 175,50 (3 compras)')
  expect(ml).toContain('Tudo o que está registrado: R$ 1.174,50 (4 compras)') // sem a compra futura nem o Mercado Pago
  expect(ml).toContain('Maior compra: R$ 999,00')

  const pad = await ask('me mostra tudo de padaria')
  expect(pad).toContain('Padaria:')
  expect(pad).toContain('Este mês: R$ 65,00 (3 compras)') // grupo pronto: padaria, panificadora...
  expect(await ask('quanto gastei com padarias?')).toContain('Este mês: R$ 65,00') // plural
  expect(await ask('Quanto gastei no zzzz?')).toContain('Não achei despesas com “zzzz”')
  expect(await ask('Quanto gastei este mês?')).toContain('Você gastou') // pergunta geral continua como antes
  expect(await ask('Quanto ganhei de salário e uber?')).toContain('Salário fixo') // e as de renda também
  expect(p.errors).toEqual([])
})
