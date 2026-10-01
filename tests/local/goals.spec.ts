import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const noSeed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  localStorage.setItem('fd:goals', '[]')
}
const card = (p: any, name: string) => p.getByTestId(`goal-${name}`)
const num = (t: string | null) => Number(norm(t).replace(/[^\d,]/g, '').replace(',', '.'))

test('metas com prazo: criar, quanto guardar por mês, guardar, editar, simular e excluir', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: noSeed })
  await p.goto('./#/invest/metas')
  await expect(p.getByRole('tab', { name: /Metas/ })).toHaveAttribute('aria-selected', 'true')
  await expect(p.getByText('Crie uma meta com valor e prazo')).toBeVisible()

  await p.getByRole('button', { name: 'Nova meta' }).click()
  await p.getByLabel('Nome').fill('Viagem')
  await p.getByLabel('Valor da meta').fill('6.000')
  await p.getByLabel('Prazo da meta').fill('2027-03-29')
  await p.getByRole('button', { name: 'Criar meta' }).click()

  const goals = await p.ls('fd:goals')
  expect(goals).toHaveLength(1)
  expect(goals[0]).toMatchObject({ name: 'Viagem', target: 6000, saved: 0, deadline: '2027-03-29', createdAt: '2026-09-29' })
  const c = card(p, 'Viagem')
  await expect(c).toContainText('até 29 de mar · 6 meses')
  await expect(c).toContainText('No ritmo')
  expect(norm(await p.getByTestId('goal-permonth-Viagem').textContent())).toContain('R$ 1.000,00')
  const invested = num(await p.getByTestId('goal-invested-Viagem').textContent())
  expect(invested).toBeGreaterThan(850)
  expect(invested).toBeLessThan(1000) // rendendo, precisa guardar menos

  // guardar R$ 1.000: falta 5.000 em 6 meses
  await c.getByRole('button', { name: '+ Guardar' }).click()
  await p.getByLabel('Valor a guardar').fill('1.000')
  await p.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(c).toContainText('R$ 1.000,00')
  expect(norm(await p.getByTestId('goal-permonth-Viagem').textContent())).toContain('R$ 833,33')
  await expect(c.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17')

  // editar: prazo maior diminui o valor mensal
  await p.getByRole('button', { name: 'Editar meta Viagem' }).click()
  await p.getByLabel('Prazo da meta').fill('2028-03-29')
  await p.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(c).toContainText('18 meses')
  expect(norm(await p.getByTestId('goal-permonth-Viagem').textContent())).toContain('R$ 277,78')
  expect((await p.ls('fd:goals'))[0].createdAt).toBe('2026-09-29') // editar não muda a data de criação

  // simular onde guardar: leva ao simulador já preenchido
  await c.getByRole('button', { name: 'Simular onde guardar' }).click()
  expect(await p.evaluate(() => location.hash)).toBe('#/invest/simulador')
  await expect(p.getByLabel('Valor inicial')).toHaveValue('1000')
  await expect(p.getByLabel('Prazo em meses')).toHaveValue('18')
  const monthly = num(await p.getByLabel('Aporte mensal').inputValue())
  expect(monthly).toBeGreaterThan(200)
  expect(monthly).toBeLessThan(278)

  // acertar o valor guardado à mão: meta atingida
  await p.getByRole('tab', { name: /Metas/ }).click()
  await p.getByRole('button', { name: 'Editar meta Viagem' }).click()
  await p.getByLabel('Já guardado na meta').fill('6000')
  await p.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(card(p, 'Viagem')).toContainText('Meta atingida')
  await expect(card(p, 'Viagem').getByRole('button', { name: '+ Guardar' })).toHaveCount(0)

  // excluir
  await p.getByRole('button', { name: 'Excluir meta Viagem' }).click()
  await expect(card(p, 'Viagem')).toHaveCount(0)
  expect(await p.ls('fd:goals')).toEqual([])
  expect(p.errors).toEqual([])
})

test('na Visão geral a meta com prazo mostra quanto guardar por mês', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: noSeed })
  await p.goto('./#/')
  await p.getByRole('button', { name: 'Nova meta' }).click()
  await p.getByLabel('Nome').fill('Notebook')
  await p.getByLabel('Valor da meta').fill('3000')
  await p.getByLabel('Prazo da meta').fill('2027-03-29')
  await p.getByRole('button', { name: 'Criar meta' }).click()
  await expect(p.locator('.card:has(h3:has-text("Metas de economia"))')).toContainText('até 29 de mar · R$ 500,00/mês')
  // vencida e sem prazo
  await p.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('fd:goals')!)
    g.push({ id: 'x', name: 'Antiga', target: 1000, saved: 100, color: '#fff', deadline: '2026-01-10' }, { id: 'y', name: 'Livre', target: 500, saved: 0, color: '#fff' })
    localStorage.setItem('fd:goals', JSON.stringify(g))
  })
  await p.reload()
  const box = p.locator('.card:has(h3:has-text("Metas de economia"))')
  await expect(box).toContainText('prazo vencido')
  await expect(box).toContainText('Livre')
  expect(p.errors).toEqual([])
})

test('metas cabem no celular', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { viewport: { width: 380, height: 800 } }) // com as metas de exemplo
  await p.goto('./#/invest/metas')
  await p.waitForSelector('.goal')
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await expect(p.getByTestId('goal-MacBook Pro')).toContainText('Sem prazo definido')
})
