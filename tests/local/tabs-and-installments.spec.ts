import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-29T12:00:00'

test('abas por URL e parcelas viram despesas', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  const base = './'
  await p.goto(base); await p.waitForSelector('.stat')
  const get = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k)
  const txt = async (sel) => (await p.locator(sel).allTextContents()).join(' ').replace(/ /g, ' ')
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')

  // sidebar com nomes
  console.log('sidebar labels:', (await txt('.nav-label')))
  // navegação pelo menu muda a URL
  await p.click('.nav-item[aria-label="Assinaturas"]')
  console.log('hash:', await p.evaluate(() => location.hash))
  assert.strictEqual(await p.evaluate(() => location.hash), '#/subscriptions')

  // abas: só aparece o conteúdo da aba ativa
  assert(await p.getByText('Suas assinaturas').isVisible()); assert(!(await p.getByText('Parcelas e dívidas').count()))
  await p.click('[role=tab]:has-text("Parcelas")')
  assert.strictEqual(await p.evaluate(() => location.hash), '#/subscriptions/installments')
  assert(await p.getByText('Parcelas e dívidas').isVisible()); assert(!(await p.getByText('Suas assinaturas').count()))
  assert.strictEqual(await p.getAttribute('[role=tab]:has-text("Parcelas")', 'aria-selected'), 'true')
  await p.click('[role=tab]:has-text("Assinaturas")')
  assert(await p.getByText('Suas assinaturas').isVisible()); assert(!(await p.getByText('Parcelas e dívidas').count()))
  // teclado
  await p.focus('[role=tab][aria-selected=true]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100)
  assert.strictEqual(await p.evaluate(() => location.hash), '#/subscriptions/installments')
  // reload e voltar preservam a aba
  await p.reload(); await p.waitForSelector('[role=tab]')
  assert(await p.getByText('Parcelas e dívidas').isVisible())
  await p.goBack(); await p.waitForTimeout(200)
  assert(await p.getByText('Suas assinaturas').isVisible())
  await p.goForward(); await p.waitForTimeout(200)

  // Transações: Lançamentos x Recorrentes
  await p.click('.nav-item[aria-label="Transações"]')
  assert(await p.locator('table').count() === 1)
  await p.click('[role=tab]:has-text("Recorrentes")')
  assert(await p.locator('table').count() === 0); assert.strictEqual(await p.evaluate(() => location.hash), '#/transactions/recurring')
  await p.click('[role=tab]:has-text("Lançamentos")'); assert(await p.locator('table').count() === 1)

  // ---- parcelas viram despesas ----
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.click('[role=tab]:has-text("Parcelas")')
  await p.click('button:has-text("Nova parcela")')
  await p.fill('input[placeholder="Ex.: iPhone 15"]', 'iPhone 15'); await p.fill('input[placeholder="0,00"]', '250'); await p.fill('input[placeholder="12"]', '12')
  await p.fill('form input[type=date] >> nth=0', '2026-03-10')
  console.log('checkbox label:', (await p.locator('label.check').textContent()))
  
  await p.click('form button.btn.primary'); await p.waitForTimeout(400)
  let txs = await get('fd:txs'); console.log('expenses:', txs.map((t) => `${t.date} ${t.description} ${t.category}`).sort().join(' | '))
  assert.strictEqual(txs.length, 6); assert(txs.every((t) => t.type === 'expense' && t.category === 'compras' && t.amount === 250))
  assert.strictEqual((await get('fd:installments'))[0].generated, 6)
  await p.reload(); await p.waitForSelector('[role=tab]'); assert.strictEqual((await get('fd:txs')).length, 6)
  // apagar uma despesa gerada não recria
  await p.click('.nav-item[aria-label="Transações"]'); await p.selectOption('.toolbar select', '2026-05'); await p.click('button[aria-label^="Excluir iPhone"]')
  await p.reload(); await p.waitForSelector('.sidebar'); assert.strictEqual((await get('fd:txs')).length, 5)

  // sem histórico: checkbox desmarcado
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.click('[role=tab]:has-text("Parcelas")'); await p.click('button:has-text("Nova parcela")')
  await p.fill('input[placeholder="Ex.: iPhone 15"]', 'Notebook'); await p.fill('input[placeholder="0,00"]', '100'); await p.fill('input[placeholder="12"]', '4')
  await p.fill('form input[type=date] >> nth=0', '2026-05-05'); await p.uncheck('label.check input')
  await p.click('form button.btn.primary'); await p.waitForTimeout(300)
  txs = await get('fd:txs'); console.log('after no-history item:', txs.length, JSON.stringify((await get('fd:installments'))[1].generated))
  assert.strictEqual(txs.length, 5)

  // vencendo hoje: 1ª parcela hoje → despesa hoje
  const today = await p.evaluate(() => { const d = new Date(); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}` })
  await p.click('button:has-text("Nova parcela")')
  await p.fill('input[placeholder="Ex.: iPhone 15"]', 'TV'); await p.fill('input[placeholder="0,00"]', '80'); await p.fill('input[placeholder="12"]', '3')
  await p.fill('form input[type=date] >> nth=1', today); await p.selectOption('form select', 'lazer')
  await p.click('form button.btn.primary'); await p.waitForTimeout(300)
  txs = await get('fd:txs'); const tv = txs.filter((t) => t.description.startsWith('TV'))
  console.log('TV expenses:', JSON.stringify(tv.map((t) => [t.date, t.description, t.category])))
  assert(tv.length === 1 && tv[0].date === today && tv[0].category === 'lazer')

  // editar valor: afeta só as futuras
  await p.click('button[aria-label="Editar TV"]'); await p.fill('input[placeholder="0,00"]', '90'); await p.click('form button.btn.primary'); await p.waitForTimeout(300)
  txs = await get('fd:txs'); assert(txs.find((t) => t.description.startsWith('TV')).amount === 80)
  assert.strictEqual((await get('fd:installments')).find((i) => i.name === 'TV').amount, 90)

  // legado (sem generated) não gera histórico
  await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('fd:installments')); a.push({ id: 'old', name: 'Legado', lender: '', amount: 10, count: 5, purchaseDate: '2026-01-01', firstDate: '2026-02-01', color: '#fff' }); localStorage.setItem('fd:installments', JSON.stringify(a)) })
  const before = (await get('fd:txs')).length
  await p.reload(); await p.waitForSelector('.sidebar')
  assert.strictEqual((await get('fd:txs')).length, before); console.log('legacy generated =', (await get('fd:installments')).find((i) => i.id === 'old').generated)

  // Visão geral reflete despesas
  await p.click('.nav-item[aria-label="Visão geral"]'); await p.waitForTimeout(400)
  console.log('overview despesas card:', (await txt('.stat >> nth=2')))
  
  await p.click('.nav-item[aria-label="Assinaturas"]'); 
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); 
  console.log('errors', errs); console.log('ALL OK'); 

})
