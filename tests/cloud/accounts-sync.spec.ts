import { expect, test } from '../support/test'
import { startFakeCloud, type FakeCloud } from '../support/fakeserver'
import { device, until } from '../support/util'

let cloud: FakeCloud
test.beforeEach(async () => {
  cloud = await startFakeCloud(4300)
})
test.afterEach(async () => {
  await cloud.close()
})

test('contas, transferências e pagamento de fatura sincronizam entre aparelhos', async ({ browser, baseURL }) => {
  const open = async () => {
    const d = await device(browser, baseURL)
    await d.p.goto('./')
    await d.p.fill('input[type=email]', 'me@x.com')
    await d.p.fill('input[type=password]', 'pw')
    await d.p.click('button:has-text("Entrar")')
    await d.p.waitForSelector('.sync-badge.ok')
    return d.p
  }
  const a = await open()
  const b = await open()

  const addAccount = async (name: string, balance: string) => {
    await a.click('button:has-text("Nova conta")')
    await a.fill('input[placeholder^="Ex.: Nubank, Carteira"]', name)
    await a.fill('input[placeholder="0,00"]', balance)
    await a.fill('form input[type=date]', '2026-09-01')
    await a.click('form button.btn.primary')
  }
  await a.click('.nav-item[aria-label="Cartões e contas"]')
  await a.click('[role=tab]:has-text("Contas")')
  await addAccount('Corrente', '1000')
  await addAccount('Reserva', '0')
  await a.click('button:has-text("Transferir")')
  await a.locator('form select').nth(0).selectOption({ label: 'Corrente' })
  await a.locator('form select').nth(1).selectOption({ label: 'Reserva' })
  await a.fill('input[placeholder="0,00"]', '250')
  await a.fill('form input[type=date]', '2026-09-10')
  await a.click('form button.btn.primary')

  await until(async () => (await b.ls('fd:accounts')).length === 2 && (await b.ls('fd:transfers')).length === 1, 'contas e transferência chegam ao B')
  await b.click('.nav-item[aria-label="Visão geral"]')
  await expect(b.getByTestId('accounts-total')).toContainText('R$ 1.000,00')
  await b.click('.nav-item[aria-label="Cartões e contas"]')
  await b.click('[role=tab]:has-text("Contas")')
  await expect(b.locator('.cc:has-text("Reserva")')).toContainText('R$ 250,00')

  // B apaga a transferência (extrato) → A vê o saldo voltar
  await b.click('.cc:has-text("Reserva") button:has-text("Extrato")')
  await b.click('.statement button[aria-label^="Desfazer"]')
  await until(async () => (await a.ls('fd:transfers')).length === 0, 'A vê a transferência desfeita', 15000)
  expect(a.errors).toEqual([])
  expect(b.errors).toEqual([])
})
