import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const seed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  const t = (id: string, type: string, date: string, description: string, amount: number, category: string) => ({ id, type, date, description, amount, category })
  const txs: unknown[] = []
  for (const m of ['2026-06', '2026-07', '2026-08']) {
    txs.push(t(`a${m}`, 'expense', `${m}-10`, 'Aluguel', 2000, 'moradia'), t(`b${m}`, 'expense', `${m}-12`, 'Cinema', 1000, 'lazer'), t(`c${m}`, 'income', `${m}-05`, 'Salário', 5000, 'salario'))
  }
  localStorage.setItem('fd:txs', JSON.stringify(txs))
  localStorage.setItem('fd:accounts', JSON.stringify([{ id: 'S', name: 'Reserva', kind: 'savings', openingBalance: 9000, openingDate: '2026-01-01', color: '#3ecf6e' }]))
  localStorage.setItem('fd:installments', JSON.stringify([{ id: 'i1', name: 'Celular', lender: 'João', amount: 300, count: 10, purchaseDate: '2026-08-01', firstDate: '2026-09-01', color: '#e0600f', generated: 1 }]))
}
const money = (n: number) => norm(n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const card = (p: any, id: string) => p.locator(`#concept-${id}`)
const openCard = async (p: any, id: string) => {
  await card(p, id).locator('summary').click()
  await expect(card(p, id)).toHaveAttribute('open', '')
}

test('conceitos: trilha com os seus dados e navegação para reserva, simulador e onde gasto', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest/conceitos')
  await expect(p.getByRole('tab', { name: 'Conceitos' })).toHaveAttribute('aria-selected', 'true')
  await expect(p.getByTestId('trail-fluxo')).toHaveClass(/done/)
  await expect(p.getByTestId('trail-fluxo')).toContainText('3 meses fechados')
  await expect(p.getByTestId('trail-fluxo')).toContainText('R$ 3.000,00')
  await expect(p.getByTestId('trail-reserva')).toHaveClass(/todo/)
  await expect(p.getByTestId('trail-reserva')).toContainText('50% da meta de R$ 18.000,00')
  await expect(p.getByTestId('trail-dividas')).toContainText('1 parcelamento em aberto')
  await expect(p.getByTestId('trail-dividas')).toContainText('R$ 300,00 por mês')

  await p.getByTestId('trail-reserva').getByRole('button', { name: 'Ver a minha reserva' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest')
  await p.getByRole('tab', { name: 'Conceitos' }).click()
  await p.getByTestId('trail-simular').getByRole('button', { name: 'Abrir o simulador' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest/simulador')
  await p.getByRole('tab', { name: 'Conceitos' }).click()
  await p.getByTestId('trail-fluxo').getByRole('button', { name: 'Ver onde gasto' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/transactions/merchants')
  await p.goBack()
  await p.getByTestId('trail-variavel').getByRole('button', { name: 'Renda fixa x variável' }).click()
  await expect(card(p, 'renda-fixa-variavel')).toHaveAttribute('open', '')
  expect(p.errors).toEqual([])
})

test('conceitos: busca, filtro por tema, abrir, exemplos com as suas taxas e "veja também"', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest/conceitos')
  const total = await p.locator('.concept').count()
  expect(total).toBeGreaterThanOrEqual(20)

  await p.getByLabel('Buscar conceito').fill('poupanca')
  await expect(p.locator('.concept').first()).toContainText('Poupança')
  expect(await p.locator('.concept').count()).toBeLessThan(total)
  await p.getByLabel('Buscar conceito').fill('xyz inexistente')
  await expect(p.getByText('Nenhum conceito encontrado')).toBeVisible()
  await p.getByLabel('Buscar conceito').fill('')

  await p.getByRole('button', { name: 'Produtos' }).click()
  await expect(p.locator('.concept')).toHaveCount(5)
  await expect(p.locator('.concept summary .tag').first()).toHaveText('Produtos')
  await p.getByRole('button', { name: 'Todos' }).click()

  // abre o CDI: texto, exemplo com as taxas (valores de exemplo até atualizar) e ligação com outro conceito
  await openCard(p, 'cdi')
  await expect(card(p, 'cdi')).toContainText('Com as suas taxas')
  await expect(card(p, 'cdi')).toContainText('CDI de 13,65% ao ano')
  await card(p, 'cdi').getByRole('button', { name: 'Selic', exact: true }).click()
  await expect(card(p, 'selic')).toHaveAttribute('open', '')
  await expect(card(p, 'selic')).toContainText('Selic usada no simulador: 13,75% ao ano')

  // botão de ação leva ao simulador
  await card(p, 'selic').getByRole('button', { name: 'Atualizar as taxas no simulador' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest/simulador')
  expect(p.errors).toEqual([])
})

test('calculadoras: juros compostos x simples e inflação', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest/conceitos')
  await openCard(p, 'juros-compostos')
  // padrão: R$ 1.000 na taxa do CDI por 10 anos
  expect(norm(await p.getByTestId('compound-result').textContent())).toBe(money(1000 * Math.pow(1.1365, 10)))
  await p.getByLabel('Valor para juros compostos').fill('2000')
  await p.getByLabel('Taxa para juros compostos').fill('10')
  await p.getByLabel('Anos para juros compostos').fill('5')
  expect(norm(await p.getByTestId('compound-result').textContent())).toBe(money(3221.02))
  expect(norm(await p.getByTestId('simple-result').textContent())).toBe(money(3000))
  await expect(p.getByLabel('Calculadora de juros compostos')).toContainText('7,3 anos') // dobra

  await openCard(p, 'inflacao')
  expect(norm(await p.getByTestId('inflation-power').textContent())).toBe(money(1000 / Math.pow(1.045, 10)))
  expect(norm(await p.getByTestId('inflation-needed').textContent())).toBe(money(1000 * Math.pow(1.045, 10)))
  await p.getByLabel('Inflação ao ano').fill('0')
  expect(norm(await p.getByTestId('inflation-power').textContent())).toBe(money(1000))
  await p.getByLabel('Valor para inflação').fill('abc') // inválido não quebra
  expect(norm(await p.getByTestId('inflation-power').textContent())).toBe(money(0))
  expect(p.errors).toEqual([])
})

test('do simulador, o "?" abre o conceito certo; taxas alteradas aparecem nos exemplos', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/invest/simulador')
  await p.getByLabel('Taxa Selic').fill('10')
  await p.getByRole('button', { name: 'Entender: CDI' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest/conceitos')
  await expect(card(p, 'cdi')).toHaveAttribute('open', '')
  await p.getByRole('tab', { name: 'Simulador' }).click()
  await p.getByRole('button', { name: 'Entender: imposto de renda regressivo' }).click()
  await expect(card(p, 'ir-regressivo')).toHaveAttribute('open', '')
  await expect(card(p, 'ir-regressivo')).toContainText('R$ 225,00')
  await p.getByRole('tab', { name: 'Simulador' }).click()
  await p.getByRole('button', { name: 'Entender: Tesouro Selic' }).click()
  await expect(card(p, 'tesouro-selic')).toHaveAttribute('open', '')
  await openCard(p, 'selic')
  await expect(card(p, 'selic')).toContainText('Selic usada no simulador: 10,00% ao ano') // a que você digitou
  await openCard(p, 'poupanca')
  await expect(card(p, 'poupanca')).toContainText('Com a Selic em 10,00%')
})

test('conceitos respeitam o modo privacidade e cabem no celular', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed, viewport: { width: 380, height: 800 } })
  await p.goto('./#/invest/conceitos')
  await openCard(p, 'juros-compostos')
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await p.click('button[aria-label="Ocultar valores"]')
  const shown = norm(await p.locator('main').innerText()) // só o que está visível
  expect(shown).toContain('R$ •••••')
  expect(shown).not.toMatch(/R\$\s*\d{1,3}(\.\d{3})*,\d{2}/) // nenhum valor formatado (os exemplos de R$ 1.000 são fixos, não são seus)
  await p.evaluate(() => window.scrollTo(0, 0))
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})
