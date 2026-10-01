import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

test('contas: saldo real, transferência, pagamento de fatura e previsão do mês', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL) // hoje = 29/09/2026 (fim do mês: 30/09)
  await p.goto('./')
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Começar do zero")')
  await p.click('.icon-btn[aria-label="Fechar"]')

  // ---- contas com saldo inicial
  await p.click('.nav-item[aria-label="Cartões e contas"]')
  await p.click('[role=tab]:has-text("Contas")')
  expect(await p.evaluate(() => location.hash)).toBe('#/cards/contas')
  await expect(p.getByText('Cadastre suas contas')).toBeVisible()
  const addAccount = async (name: string, kind: string, balance: string) => {
    await p.click('button:has-text("Nova conta")')
    await p.fill('input[placeholder^="Ex.: Nubank, Carteira"]', name)
    await p.selectOption('form select', kind)
    await p.fill('input[placeholder="0,00"]', balance)
    await p.fill('form input[type=date]', '2026-09-01')
    await p.click('form button.btn.primary')
  }
  await addAccount('Nubank', 'checking', '1000')
  await addAccount('Poupança', 'savings', '500')
  await expect(p.locator('.card.stat').first()).toContainText('R$ 1.500,00')

  // ---- receita e despesa ligadas à conta; com uma só conta a forma de pagamento é sugerida
  await p.click('button:has-text("Nova transação")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Mercado')
  await p.fill('input[placeholder="0,00"]', '200')
  await p.fill('form input[type=date] >> nth=0', '2026-09-10')
  await p.getByLabel('Forma de pagamento').selectOption({ label: 'Nubank' })
  await p.click('form button.btn.primary')
  await p.click('button:has-text("Nova transação")')
  await p.click('form .segmented button:has-text("Receita")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Freela')
  await p.fill('input[placeholder="0,00"]', '300')
  await p.fill('form input[type=date] >> nth=0', '2026-09-12')
  await p.getByLabel('Conta que recebe').selectOption({ label: 'Nubank' })
  await p.click('form button.btn.primary')

  // ---- transferência não é despesa nem receita
  await p.click('.nav-item[aria-label="Cartões e contas"]')
  await p.click('[role=tab]:has-text("Contas")')
  await p.click('button:has-text("Transferir")')
  await p.locator('form select').nth(0).selectOption({ label: 'Nubank' })
  await p.locator('form select').nth(1).selectOption({ label: 'Poupança' })
  await p.fill('input[placeholder="0,00"]', '400')
  await p.fill('form input[type=date]', '2026-09-15')
  await p.click('form button.btn.primary')
  const tiles = norm(await p.locator('.cc').allTextContents().then((a) => a.join('|')))
  expect(tiles).toContain('Nubank') // 1000 − 200 + 300 − 400 = 700
  expect(tiles).toMatch(/Saldo atual\s*R\$ 700,00/)
  expect(tiles).toMatch(/Saldo atual\s*R\$ 900,00/) // poupança: 500 + 400
  const txs = await p.ls('fd:txs')
  expect(txs).toHaveLength(2) // a transferência não criou lançamentos

  // ---- extrato
  await p.click('.cc:has-text("Nubank") button:has-text("Extrato")')
  const st = norm(await p.locator('.statement').textContent())
  expect(st).toContain('Transferência para Poupança')
  expect(st).toContain('Freela')
  expect(st).toContain('Mercado')
  await p.click('.icon-btn[aria-label="Fechar"]')

  // ---- cartão + pagamento da fatura sai da conta, sem virar despesa
  await p.click('[role=tab]:has-text("Cartões")')
  await p.click('button:has-text("Novo cartão")')
  await p.fill('input[placeholder="Ex.: Nubank"]', 'Visa')
  await p.fill('input[placeholder="Ex.: 5"]', '5')
  await p.fill('input[placeholder="Ex.: 12"]', '12')
  await p.click('form button.btn.primary')
  const cid = (await p.ls('fd:cards'))[0].id
  await p.click('button:has-text("Nova transação")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Notebook')
  await p.fill('input[placeholder="0,00"]', '150')
  await p.fill('form input[type=date] >> nth=0', '2026-09-03') // fatura de setembro (fechou dia 5, venceu dia 12)
  await p.getByLabel('Forma de pagamento').selectOption('card:' + cid)
  await p.click('form button.btn.primary')
  await p.click('.nav-item[aria-label="Cartões e contas"]')
  await p.click('.cc:has-text("Visa") button:has-text("Ver faturas")')
  await p.click('.invoice:has-text("Vencida") button:has-text("Marcar como paga")')
  await p.getByLabel('Paga com a conta').selectOption({ label: 'Nubank' })
  await p.fill('form input[inputmode="decimal"]', '150')
  await p.fill('form input[type=date]', '2026-09-20')
  await p.click('button:has-text("Confirmar pagamento")')
  await expect(p.locator('.invoice:has-text("Paga")')).toHaveCount(1)
  expect(await p.ls('fd:transfers')).toHaveLength(2)
  expect((await p.ls('fd:txs')).filter((t: any) => t.type === 'expense')).toHaveLength(2) // continua só Mercado + Notebook
  await p.click('.nav-item[aria-label="Visão geral"]')
  await expect(p.getByTestId('accounts-total')).toContainText('R$ 1.450,00') // 700 − 150 + 900

  // desfazer o pagamento devolve o dinheiro à conta
  await p.click('.nav-item[aria-label="Cartões e contas"]')
  await p.click('.cc:has-text("Visa") button:has-text("Ver faturas")')
  await p.click('.invoice:has-text("Paga") .invoice-head')
  await p.click('button:has-text("Desfazer pagamento")')
  expect((await p.ls('fd:transfers')).filter((t: any) => t.kind === 'invoice')).toHaveLength(0)

  // ---- previsão: salário e aluguel recorrentes, parcelas e a fatura em aberto
  await p.click('button:has-text("Nova transação")')
  await p.click('form .segmented button:has-text("Receita")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Salário')
  await p.fill('input[placeholder="0,00"]', '5000')
  await p.fill('form input[type=date] >> nth=0', '2026-09-30') // cai amanhã
  await p.getByLabel('Conta que recebe').selectOption({ label: 'Nubank' })
  await p.selectOption('form select >> nth=0', 'salario')
  await p.click('form button.btn.primary')
  await p.click('button:has-text("Nova transação")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Aluguel')
  await p.fill('input[placeholder="0,00"]', '2000')
  await p.fill('form input[type=date] >> nth=0', '2026-09-30')
  await p.getByLabel('Forma de pagamento').selectOption({ label: 'Nubank' })
  await p.check('input[type=checkbox]')
  await p.click('form button.btn.primary')
  await p.click('.nav-item[aria-label="Visão geral"]')
  const f = p.locator('.forecast')
  // já: receita 300 (Freela), despesa 200 + 150; falta: +5000 −2000 → 300 + 5000 − (350 + 2000)
  await expect(p.getByTestId('forecast-leftover')).toContainText('R$ 2.950,00')
  const cash = norm(await p.getByTestId('forecast-cash').textContent())
  // contas hoje: 700 (Nubank) + 900 (Poupança) = 1600; + 5000 − 2000 − fatura Visa em aberto? (paga? desfeita, vencida: fora do caixa)
  expect(cash).toContain('R$ 4.600,00')
  await f.locator('button:has-text("Ver o que falta acontecer")').click()
  const det = norm(await f.textContent())
  expect(det).toContain('Salário')
  expect(det).toContain('Aluguel')
  await p.click('.nav-item[aria-label="Assistente"]')
  await p.fill('input[aria-label="Pergunta"]', 'Quanto vai sobrar até o fim do mês?')
  await p.keyboard.press('Enter')
  await expect(p.locator('.bubble.bot')).toContainText('R$ 2.950,00')

  // ---- excluir a conta solta os lançamentos
  await p.click('.nav-item[aria-label="Cartões e contas"]')
  await p.click('[role=tab]:has-text("Contas")')
  await p.click('button[aria-label="Excluir conta Poupança"]')
  expect((await p.ls('fd:accounts')).map((a: any) => a.name)).toEqual(['Nubank'])
  expect(await p.ls('fd:transfers')).toHaveLength(0) // a transferência com a Poupança foi removida
  expect(p.errors).toEqual([])
})

test('evolução do saldo: gráfico mês a mês, variação e aviso quando só há um mês', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, {
    init: () => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('fd:accounts', JSON.stringify([
        { id: 'a', name: 'Conta Aurora', kind: 'checking', openingBalance: 1000, openingDate: '2026-06-10', color: '#3b6ef5' },
        { id: 'b', name: 'Reserva', kind: 'savings', openingBalance: 500, openingDate: '2026-08-15', color: '#3ecf6e' },
      ]))
      localStorage.setItem('fd:txs', JSON.stringify([
        { id: '1', date: '2026-07-05', description: 'Mercado', amount: 100, type: 'expense', category: 'alimentacao', accountId: 'a' },
        { id: '2', date: '2026-08-05', description: 'Salário', amount: 300, type: 'income', category: 'salario', accountId: 'a' },
        { id: '3', date: '2026-09-10', description: 'Padaria', amount: 50, type: 'expense', category: 'alimentacao', accountId: 'a' },
      ]))
    },
  })
  await p.goto('./#/cards/contas')
  const card = p.getByLabel('Evolução do saldo')
  await expect(card).toBeVisible()
  expect(norm(await card.getByTestId('nw-current').textContent())).toBe('R$ 1.650,00') // 1000−100+300−50 + 500
  expect(norm(await card.getByTestId('nw-month').textContent())).toBe('− R$ 50,00')
  await expect(card.getByTestId('nw-saved')).toHaveText('30%')
  await expect(card.locator('.recharts-area')).toBeVisible()
  await expect(card).toContainText('Melhor mês')

  // uma conta recém-criada: sem gráfico, com explicação
  await p.evaluate(() => {
    localStorage.setItem('fd:accounts', JSON.stringify([{ id: 'z', name: 'Nova', kind: 'checking', openingBalance: 10, openingDate: '2026-09-20', color: '#fff' }]))
  })
  await p.reload()
  await expect(p.getByLabel('Evolução do saldo')).toContainText('pelo menos dois meses')
})
