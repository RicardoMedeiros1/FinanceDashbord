import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const seed = () => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  const t = (id: string, type: string, accountId: string, date: string, description: string, amount: number) => ({ id, type, accountId, date, description, amount, category: type === 'income' ? 'renda' : 'outros' })
  localStorage.setItem('fd:accounts', JSON.stringify([
    { id: 'A', name: 'Nubank', kind: 'checking', openingBalance: 1000, openingDate: '2026-09-01', color: '#3b6ef5' },
    { id: 'B', name: 'Reserva', kind: 'savings', openingBalance: 0, openingDate: '2026-09-01', color: '#3ecf6e' },
  ]))
  localStorage.setItem('fd:txs', JSON.stringify([
    t('e1', 'expense', 'A', '2026-09-10', 'Pix enviado Reserva', 500),
    t('i1', 'income', 'B', '2026-09-10', 'Pix recebido', 500),
    t('e2', 'expense', 'A', '2026-09-12', 'Mercado X', 100),
    t('i2', 'income', 'B', '2026-09-14', 'Reembolso', 100),
    t('e3', 'expense', 'A', '2026-09-15', 'Aplicação CDB', 300),
  ]))
}

const balance = async (p: any, name: string) => {
  await p.goto('./#/cards/contas')
  return norm(await p.locator(`.cc:has-text("${name}") .sub-price`).first().textContent())
}

test('transferências entre contas: revisar, converter, marcar uma só e desfazer', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, { init: seed })
  await p.goto('./#/transactions')
  expect(await balance(p, 'Nubank')).toContain('R$ 100,00') // 1000 − 500 − 100 − 300
  expect(await balance(p, 'Reserva')).toContain('R$ 600,00')

  // aviso com os pares encontrados: o de confiança alta (pix) e o de 2 dias sem palavra de transferência
  await p.goto('./#/transactions')
  await expect(p.getByRole('status').filter({ hasText: 'possíveis transferências' })).toContainText('Encontrei 2')
  await p.getByRole('button', { name: 'Revisar' }).click()
  const modal = p.getByRole('dialog', { name: 'Transferências entre as suas contas' })
  await expect(modal.getByLabel('Converter Pix enviado Reserva')).toBeChecked()
  await expect(modal.getByLabel('Converter Mercado X')).not.toBeChecked() // baixa confiança: você decide
  await expect(modal).toContainText('Confira: só o valor e a data batem')
  await expect(modal.getByRole('button', { name: /Transformar 1 par/ })).toBeVisible()
  await modal.getByRole('button', { name: /Transformar 1 par/ }).click()

  // virou transferência: saiu de receitas e despesas, o saldo das contas não mudou
  const txs = await p.ls('fd:txs')
  expect(txs.map((x: any) => x.id).sort()).toEqual(['e2', 'e3', 'i2'])
  const transfers = await p.ls('fd:transfers')
  expect(transfers).toHaveLength(1)
  expect(transfers[0]).toMatchObject({ from: 'A', to: 'B', amount: 500, kind: 'transfer' })
  expect(transfers[0].origin.map((o: any) => o.id)).toEqual(['e1', 'i1'])
  expect(await balance(p, 'Nubank')).toContain('R$ 100,00')
  expect(await balance(p, 'Reserva')).toContain('R$ 600,00')
  await p.goto('./#/transactions')
  await expect(p.getByRole('status').filter({ hasText: 'possível transferência' })).toContainText('Encontrei 1') // sobrou o de baixa confiança

  // um lançamento só: a aplicação no CDB foi para uma conta de fora do app
  await p.getByRole('button', { name: 'Marcar Aplicação CDB como transferência' }).click()
  const mark = p.getByRole('dialog', { name: 'Marcar como transferência' })
  await expect(mark.getByLabel('De')).toHaveValue('A') // já vem a conta do lançamento
  await expect(mark.getByLabel('Para')).toHaveValue('')
  await mark.getByRole('button', { name: 'Marcar como transferência' }).click()
  expect((await p.ls('fd:txs')).map((x: any) => x.id).sort()).toEqual(['e2', 'i2'])
  expect(await balance(p, 'Nubank')).toContain('R$ 100,00') // o saldo continua igual

  // desfazer pelo extrato da conta: os lançamentos voltam
  await p.goto('./#/cards/contas')
  await p.locator('.cc:has-text("Nubank")').getByRole('button', { name: 'Extrato' }).click()
  await p.getByRole('button', { name: /Desfazer Transferência para Reserva/ }).click()
  const back = (await p.ls('fd:txs')).map((x: any) => x.id).sort()
  expect(back).toEqual(['e1', 'e2', 'i1', 'i2'])
  expect(await p.ls('fd:transfers')).toHaveLength(1) // só a da aplicação sobrou
  expect(p.errors).toEqual([])
})

test('sem contas ou sem pares não aparece aviso nem o botão de transferência', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL) // dados de exemplo, sem contas
  await p.goto('./#/transactions')
  await expect(p.locator('table')).toBeVisible()
  await expect(p.getByRole('status').filter({ hasText: 'transferências' })).toHaveCount(0)
  await expect(p.getByRole('button', { name: /como transferência/ })).toHaveCount(0)
})
