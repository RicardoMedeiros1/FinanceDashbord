import { expect, test } from '../support/test'
import { startFakeCloud, type FakeCloud } from '../support/fakeserver'
import { acct, ITEM, sample, tx } from '../support/pluggydata'
import { device, norm, until } from '../support/util'

let cloud: FakeCloud
test.beforeEach(async () => {
  cloud = await startFakeCloud(4300)
})
test.afterEach(async () => {
  await cloud.close()
})

const login = async (browser: any, baseURL: string | undefined) => {
  const d = await device(browser, baseURL)
  await d.p.goto('./')
  await d.p.fill('input[type=email]', 'me@x.com')
  await d.p.fill('input[type=password]', 'pw')
  await d.p.click('button:has-text("Entrar")')
  await d.p.waitForSelector('.sync-badge.ok')
  return d.p
}
const ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const modal = (p: any) => p.getByRole('dialog', { name: 'Bancos (Open Finance)' })
const openBank = async (p: any) => {
  await p.click('button[aria-label="Bancos (Open Finance)"]')
  await expect(modal(p)).toBeVisible()
}
const connect = async (p: any, label = 'Nubank', id = ID) => {
  await modal(p).getByLabel('Nome do banco').fill(label)
  await modal(p).getByLabel('Item ID da conexão (Pluggy)').fill(id)
  await modal(p).getByRole('button', { name: 'Conectar e importar' }).click()
}

test('conectar o banco importa contas, cartão e lançamentos; sincronizar de novo não duplica; outro aparelho recebe', async ({ browser, baseURL }) => {
  cloud.state.pluggy.data = sample()
  const a = await login(browser, baseURL)
  await openBank(a)
  await connect(a)
  await expect(modal(a).getByRole('status')).toContainText('4 lançamentos novos')
  await expect(modal(a)).toContainText('1 conta criada')
  await expect(modal(a)).toContainText('1 cartão criado')
  await expect(modal(a)).toContainText('Pagamento de fatura Mastercard') // ficou de fora, com o motivo
  await expect(modal(a)).toContainText('registre em Cartões → Pagar fatura')
  await expect(modal(a)).toContainText('saldo no banco R$ 1.250,00')
  expect(cloud.state.pluggy.requests[0]).toEqual({ action: 'sync', items: [ID], from: '2026-07-01' })

  const accounts = await a.ls('fd:accounts')
  const cards = await a.ls('fd:cards')
  const txs = await a.ls('fd:txs')
  expect(accounts.map((x: any) => [x.name, x.openingDate])).toEqual([['Nubank', '2026-07-01']])
  expect(cards.map((c: any) => [c.name, c.closingDay, c.dueDay, c.limit])).toEqual([['Nubank (cartão)', 20, 28, 8000]])
  expect(txs.map((t: any) => t.id).sort()).toEqual(['pl-t1', 'pl-t2', 'pl-t4', 'pl-t5'])
  expect((await a.ls('fd:profile'))[0].banks[0]).toMatchObject({ id: ID, label: 'Nubank', since: '2026-07-01', status: 'UPDATED' })

  // o saldo da conta aparece na Visão geral (a fatura paga na conta ainda não foi registrada: R$ 900 a mais que no banco)
  await a.click('button[aria-label="Fechar"]')
  await a.click('.nav-item[aria-label="Visão geral"]')
  await expect(a.getByTestId('accounts-total')).toContainText('R$ 2.150,00')

  // de novo: nada muda
  await openBank(a)
  await modal(a).getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(modal(a).getByRole('status')).toContainText('Nada novo para importar')
  expect(await a.ls('fd:txs')).toHaveLength(4)
  expect(await a.ls('fd:accounts')).toHaveLength(1)

  // movimento novo no banco
  cloud.state.pluggy.data.transactions.push(tx('t9', 'acc-1', '2026-09-29', 'Uber *Trip', 18.9, 'out'))
  await modal(a).getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(modal(a).getByRole('status')).toContainText('1 lançamento novo')
  await until(async () => (await a.ls('fd:txs')).length === 5, 'novo lançamento salvo')
  await a.click('button[aria-label="Fechar"]')

  // outro aparelho recebe tudo pela sincronização normal, inclusive a conexão
  const b = await login(browser, baseURL)
  await until(async () => (await b.ls('fd:txs')).length === 5 && (await b.ls('fd:accounts')).length === 1, 'dados chegam ao B')
  await openBank(b)
  await expect(modal(b)).toContainText('Nubank')
  await expect(modal(b)).toContainText('Conta Nubank')
  await modal(b).getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(modal(b).getByRole('status')).toContainText('Nada novo para importar')
  expect(await b.ls('fd:txs')).toHaveLength(5)

  // remover a conexão mantém o que já foi importado
  await modal(b).getByRole('button', { name: 'Remover Nubank' }).click()
  await expect(modal(b).getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0)
  expect(await b.ls('fd:txs')).toHaveLength(5)
  expect(a.errors).toEqual([])
  expect(b.errors).toEqual([])
})

test('lançamento seu igual ao do banco não duplica e passa a valer na conta', async ({ browser, baseURL }) => {
  cloud.state.pluggy.data = { items: [{ id: ID, connector: 'MeuPluggy', status: 'UPDATED', updatedAt: null }], accounts: [acct({ balance: 500 })], transactions: [tx('z1', 'acc-1', '2026-09-29', 'PADARIA ESTRELA', 32.5, 'out')] }
  const p = await login(browser, baseURL)
  await p.click('button:has-text("Nova transação")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Padaria')
  await p.fill('input[placeholder="0,00"]', '32,50')
  await p.click('form button.btn.primary')
  await until(async () => (await p.ls('fd:txs')).length === 1, 'lançamento manual salvo')
  expect((await p.ls('fd:txs'))[0].accountId).toBeUndefined()

  await openBank(p)
  await connect(p)
  await expect(modal(p).getByRole('status')).toContainText('Nada novo para importar')
  await expect(modal(p)).toContainText('1 lançamentos seus foram ligados')
  await expect(modal(p)).toContainText('Parece igual a um lançamento seu')
  const [account] = await p.ls('fd:accounts')
  await until(async () => (await p.ls('fd:txs'))[0]?.accountId === account.id, 'lançamento ligado à conta')

  // se for outro movimento mesmo, dá para importar
  await modal(p).getByRole('button', { name: 'Importar mesmo assim' }).click()
  await until(async () => (await p.ls('fd:txs')).length === 2, 'importado mesmo assim')
  await expect(modal(p).getByRole('button', { name: 'Importar mesmo assim' })).toHaveCount(0)
  await modal(p).getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(modal(p).getByRole('status')).toContainText('Nada novo para importar')
  expect(await p.ls('fd:txs')).toHaveLength(2)
})

test('mensagens de erro claras: não configurado, conexão não encontrada, Item ID inválido', async ({ browser, baseURL }) => {
  const p = await login(browser, baseURL)
  await openBank(p)

  // Item ID em formato errado nem chega a ser enviado
  await modal(p).getByLabel('Nome do banco').fill('Nubank')
  await modal(p).getByLabel('Item ID da conexão (Pluggy)').fill('meu.pluggy.ai')
  await expect(modal(p)).toContainText('O Item ID é uma sequência como')
  await expect(modal(p).getByRole('button', { name: 'Conectar e importar' })).toBeDisabled()

  cloud.state.pluggy.error = 'A conexão com a Pluggy ainda não foi configurada no Supabase (faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET).'
  await modal(p).getByLabel('Item ID da conexão (Pluggy)').fill(ID)
  await modal(p).getByRole('button', { name: 'Conectar e importar' }).click()
  await expect(modal(p).getByRole('alert')).toContainText('ainda não foi configurada')

  cloud.state.pluggy.error = ''
  cloud.state.pluggy.data = { items: [], accounts: [], transactions: [] } // a Pluggy não conhece esse ID
  await modal(p).getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(modal(p).getByRole('status')).toContainText('não encontrou essa conexão')
  expect(await p.ls('fd:txs')).toHaveLength(0)

  // mesmo ID duas vezes
  await modal(p).getByLabel('Nome do banco').fill('Outro')
  await modal(p).getByLabel('Item ID da conexão (Pluggy)').fill(ID.toUpperCase())
  await expect(modal(p)).toContainText('Essa conexão já foi adicionada')
})

test('ao abrir o app, atualiza sozinho se passaram mais de 6 horas', async ({ browser, baseURL }) => {
  cloud.state.pluggy.data = sample()
  const p = await login(browser, baseURL)
  await openBank(p)
  await connect(p)
  await expect(modal(p).getByRole('status')).toContainText('4 lançamentos novos')
  await until(async () => (await p.ls('fd:txs')).length === 4, 'salvo')
  await p.click('button[aria-label="Fechar"]')
  expect(cloud.state.pluggy.requests).toHaveLength(1)

  // recém sincronizado: reabrir não pergunta ao banco de novo
  cloud.state.pluggy.data.transactions.push(tx('t9', 'acc-1', '2026-09-29', 'Uber *Trip', 18.9, 'out'))
  await p.reload()
  await p.waitForSelector('.sync-badge.ok')
  await new Promise((r) => setTimeout(r, 800))
  expect(cloud.state.pluggy.requests).toHaveLength(1)
  expect(await p.ls('fd:txs')).toHaveLength(4)

  // última sincronização antiga: atualiza sozinho
  await p.evaluate(() => {
    const prof = JSON.parse(localStorage.getItem('fd:profile')!)
    prof[0].banks[0].lastSync = '2026-09-28T00:00:00.000Z'
    localStorage.setItem('fd:profile', JSON.stringify(prof))
  })
  await p.reload()
  await until(async () => (await p.ls('fd:txs')).length === 5, 'atualização automática')
  expect(cloud.state.pluggy.requests).toHaveLength(2)
  expect(norm(await p.locator('main').textContent())).toContain('Uber *Trip')
  expect(p.errors).toEqual([])
})
