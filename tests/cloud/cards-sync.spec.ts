import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, sleep, until, PNG } from '../support/util'
import { startFakeCloud } from '../support/fakeserver'

const TIME = undefined

test('cartões e compras no cartão sincronizam entre aparelhos', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  let cloud: any
  try {

  cloud = await startFakeCloud(4300); const rows = cloud.rows, files = cloud.files, st = cloud.state
  const b = browser; const errs: string[] = []
  const device = async (n) => { const d = await makeDevice(browser, baseURL); d.p.on('pageerror', (e) => errs.push(n + ': ' + e.message)); await d.p.goto('./'); await d.p.fill('input[type=email]', 'me@x.com'); await d.p.fill('input[type=password]', 'pw'); await d.p.click('button:has-text("Entrar")'); await d.p.waitForSelector('.sync-badge.ok'); return d.p }
  const a = await device('A'); const bb = await device('B')
  await a.click('.nav-item[aria-label="Cartões e contas"]'); await a.click('button:has-text("Novo cartão")'); await a.fill('input[placeholder="Ex.: Nubank"]', 'Itaú'); await a.fill('input[placeholder="Ex.: 5"]', '20'); await a.fill('input[placeholder="Ex.: 12"]', '28'); await a.click('form button.btn.primary')
  await until(() => [...rows.values()].some((r) => r.collection === 'cards' && !r.deleted), 'cartão no servidor'); await until(async () => (await bb.ls('fd:cards')).length === 1, 'B recebe cartão')
  const cid = (await a.ls('fd:cards'))[0].id
  await a.click('button:has-text("Nova transação")'); await a.fill('input[placeholder="Ex.: Mercado"]', 'Compra cartão'); await a.fill('input[placeholder="0,00"]', '80'); await a.getByLabel('Forma de pagamento').selectOption('card:' + cid); await a.click('form button.btn.primary')
  await until(async () => (await bb.ls('fd:txs')).find((t) => t.description === 'Compra cartão')?.cardId === cid, 'B recebe compra com cardId')
  await a.click('.nav-item[aria-label="Cartões e contas"]'); await a.click('.cc button:has-text("Ver faturas")'); await a.click('.invoice-head >> nth=0'); await sleep(100)
  // marcar como paga no B → A vê
  await bb.click('.nav-item[aria-label="Cartões e contas"]'); await bb.click('.cc button:has-text("Ver faturas")')
  const closedOrOverdue = bb.locator('.invoice button:has-text("Marcar como paga")')
  if (await closedOrOverdue.count()) { await closedOrOverdue.first().click(); await until(async () => ((await a.ls('fd:cards'))[0].paid ?? []).length === 1, 'A vê fatura paga') ; console.log('pago propagou') } else console.log('sem fatura fechada hoje (ok)')
  console.log('errors', errs); assert.strictEqual(errs.length, 0); console.log('ALL OK'); ; 

  } finally {
    await cloud?.close()
  }

})
