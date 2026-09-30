import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const seed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  const t = (id: string, type: string, date: string, description: string, amount: number, category: string) => ({ id, type, date, description, amount, category })
  const txs: unknown[] = []
  for (const m of ['2026-06', '2026-07', '2026-08']) {
    txs.push(t(`a${m}`, 'expense', `${m}-10`, 'Aluguel', 2000, 'moradia'))
    txs.push(t(`b${m}`, 'expense', `${m}-12`, 'Cinema', 1000, 'lazer'))
    txs.push(t(`c${m}`, 'income', `${m}-05`, 'Salário', 5000, 'salario'))
  }
  localStorage.setItem('fd:txs', JSON.stringify(txs))
  localStorage.setItem('fd:accounts', JSON.stringify([
    { id: 'S', name: 'Reserva', kind: 'savings', openingBalance: 9000, openingDate: '2026-01-01', color: '#3ecf6e' },
    { id: 'C', name: 'Corrente', kind: 'checking', openingBalance: 500, openingDate: '2026-01-01', color: '#3b6ef5' },
  ]))
}

const BCB: Record<string, string> = { '432': '13.75', '4389': '13.65', '13522': '4.31' }
const mockBcb = async (p: any) =>
  p.route('**/api.bcb.gov.br/**', (route: any) => {
    const code = /sgs\.(\d+)/.exec(route.request().url())?.[1] ?? ''
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ data: '29/09/2026', valor: BCB[code] }]) })
  })

test('reserva de emergência: meta, guardado, prazo, essenciais, contas e persistência', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest')
  const v = async (id: string) => norm(await p.getByTestId(id).textContent())
  expect(await v('reserve-target')).toContain('R$ 18.000,00') // 6 meses × R$ 3.000
  expect(await v('reserve-saved')).toContain('R$ 9.000,00') // só a conta de poupança conta sozinha
  expect(await v('reserve-missing')).toContain('R$ 9.000,00')
  await expect(p.getByRole('progressbar', { name: 'Progresso da reserva' })).toHaveAttribute('aria-valuenow', '50')
  await expect(p.getByRole('status').filter({ hasText: 'Você já tem 50%' })).toContainText('cobre cerca de 3,0 meses')
  await expect(p.getByText('Despesa média: R$ 3.000,00 por mês')).toBeVisible()
  const plan = norm(await p.locator('.reserve-plan').textContent())
  expect(plan).toContain('sobra média é de R$ 2.000,00')
  expect(plan).toContain('5 meses')
  expect(plan).toContain('12 meses: R$ 750,00 por mês')
  expect(plan).toContain('24 meses: R$ 375,00 por mês')

  // 3 meses: a meta cai para R$ 9.000 e a reserva já está completa
  await p.getByRole('button', { name: '3 meses' }).click()
  expect(await v('reserve-target')).toContain('R$ 9.000,00')
  await expect(p.getByText('Reserva completa')).toBeVisible()
  await expect(p.getByText('Como chegar lá')).toHaveCount(0)

  // só gastos essenciais: o cinema sai da conta (moradia R$ 2.000 × 3 = R$ 6.000)
  await p.getByLabel(/Contar só gastos essenciais/).check()
  expect(await v('reserve-target')).toContain('R$ 6.000,00')

  // tirar a poupança da conta e contar um valor de fora do app
  await p.getByLabel('Contar Reserva como reserva').uncheck()
  expect(await v('reserve-saved')).toContain('R$ 0,00')
  await p.getByLabel('Valor guardado fora do app').fill('1.000,50')
  expect(await v('reserve-saved')).toContain('R$ 1.000,50')
  await p.getByLabel('Contar Corrente como reserva').check()
  expect(await v('reserve-saved')).toContain('R$ 1.500,50')

  // fica salvo no perfil
  const prof = (await p.ls('fd:profile'))[0]
  expect(prof.reserve).toMatchObject({ months: 3, essentialOnly: true, extra: 1000.5, accountIds: ['C'] })
  await p.reload()
  expect(await v('reserve-target')).toContain('R$ 6.000,00')
  expect(await v('reserve-saved')).toContain('R$ 1.500,50')
  await expect(p.getByRole('button', { name: '3 meses' })).toHaveAttribute('aria-pressed', 'true')
  expect(p.errors).toEqual([])
})

test('da reserva para o simulador com os valores preenchidos', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest')
  await p.getByRole('button', { name: 'Simular onde deixar esse dinheiro' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest/simulador')
  await expect(p.getByLabel('Valor inicial')).toHaveValue('9000')
  await expect(p.getByLabel('Aporte mensal')).toHaveValue('750')
  await expect(p.getByLabel('Prazo em meses')).toHaveValue('12')
  expect(norm(await p.getByTestId('sim-invested').textContent())).toContain('R$ 18.000,00')
})

test('simulador: taxas do Banco Central, produtos, imposto, gráfico e erro de rede', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await mockBcb(p)
  await p.goto('./#/invest/simulador')
  await expect(p.getByText('Valores de exemplo')).toBeVisible()

  await p.getByRole('button', { name: 'Atualizar pelo Banco Central' }).click()
  await expect(p.getByText('Taxas do Banco Central de 29/09/2026.')).toBeVisible()
  await expect(p.getByLabel('Taxa Selic')).toHaveValue('13,75')
  await expect(p.getByLabel('Taxa CDI')).toHaveValue('13,65')
  await expect(p.getByLabel('Inflação IPCA')).toHaveValue('4,31')

  await p.getByLabel('Valor inicial').fill('10000')
  await p.getByLabel('Aporte mensal').fill('0')
  await p.getByLabel('Prazo em meses').fill('12')
  await expect(p.locator('.sim-table tbody tr')).toHaveCount(6)
  expect(norm(await p.getByTestId('sim-invested').textContent())).toContain('R$ 10.000,00')
  // poupança: 0,5% ao mês com Selic alta, sem imposto
  expect(norm(await p.getByTestId('sim-net-poupanca').textContent())).toContain('R$ 10.616,78')
  expect(norm(await p.getByTestId('sim-poupanca').textContent())).toContain('R$ 0,00') // imposto
  // LCI/LCA isenta; CDB paga imposto
  expect(norm(await p.getByTestId('sim-lci').textContent())).toMatch(/R\$ 0,00/)
  expect(norm(await p.getByTestId('sim-cdb_liquidez').textContent())).not.toMatch(/Imposto R\$ 0,00/)
  await expect(p.locator('.sim-table .badge')).toHaveCount(1) // marca o maior valor da simulação
  await expect(p.locator('.sim-table')).toContainText('FGC')
  await expect(p.locator('.sim-chart .recharts-line').first()).toBeAttached()

  // mudar o prazo muda o resultado; aportes entram no total investido
  await p.getByRole('button', { name: '5 anos' }).click()
  await p.getByLabel('Aporte mensal').fill('500')
  expect(norm(await p.getByTestId('sim-invested').textContent())).toContain('R$ 40.000,00') // 10.000 + 60 × 500
  await p.getByLabel(/Em valores de hoje/).check()
  await p.getByLabel(/Em valores de hoje/).uncheck()

  // as taxas ficam salvas neste aparelho
  await p.reload()
  await expect(p.getByLabel('Taxa Selic')).toHaveValue('13,75')
  await expect(p.getByText('Taxas do Banco Central de 29/09/2026.')).toBeVisible()

  // sem rede: mensagem clara e os valores continuam editáveis
  await p.unroute('**/api.bcb.gov.br/**')
  await p.route('**/api.bcb.gov.br/**', (r) => r.abort())
  await p.getByRole('button', { name: 'Atualizar pelo Banco Central' }).click()
  await expect(p.getByRole('alert')).toContainText('Não foi possível buscar as taxas')
  await p.getByLabel('Taxa Selic').fill('10')
  await expect(p.getByLabel('Taxa Selic')).toHaveValue('10')

  // valores inválidos não quebram
  await p.getByLabel('Valor inicial').fill('abc')
  await p.getByLabel('Aporte mensal').fill('')
  await expect(p.getByText('Informe um valor inicial ou um aporte mensal')).toBeVisible()
  expect(p.errors).toEqual([])
})

test('modo privacidade esconde os valores da reserva e do simulador', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest')
  await p.click('button[aria-label="Ocultar valores"]')
  expect(norm(await p.locator('main').textContent())).not.toMatch(/R\$\s*\d/)
  await p.getByRole('tab', { name: 'Simulador' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest/simulador')
  expect(norm(await p.locator('.sim-table').textContent())).not.toMatch(/R\$\s*\d/)
})

test('no celular a página Investir e o menu de 7 itens cabem na tela', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed, viewport: { width: 380, height: 800 } })
  for (const hash of ['#/invest', '#/invest/simulador']) {
    await p.goto('./' + hash)
    await p.waitForSelector('.invest')
    await p.waitForTimeout(300)
    expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), hash).toBeLessThanOrEqual(0)
  }
  const items = p.locator('nav .nav-item')
  await expect(items).toHaveCount(7)
  const right = await items.last().evaluate((el) => el.getBoundingClientRect().right)
  expect(right).toBeLessThanOrEqual(380)
  await expect(p.getByRole('button', { name: 'Investir' })).toHaveAttribute('aria-current', 'page')
})
