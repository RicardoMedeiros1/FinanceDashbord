import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-30T12:00:00'

test('cartões: faturas, limite e vínculo com despesas', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { ctx, p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  const _c = p.click.bind(p)
  const ls = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k)
  const norm = (t) => t.replace(/ /g, ' ').replace(/\s+/g, ' ')
  await p.goto('./'); await p.waitForSelector('.stat')
  console.log('hoje no app:', await p.evaluate(() => new Date().toISOString().slice(0, 10)))
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')

  // 1) página vazia + cadastrar cartão
  await p.click('.nav-item[aria-label="Cartões"]'); assert(await p.getByText('Cadastre seus cartões de crédito').isVisible())
  await p.click('button:has-text("Novo cartão")')
  await p.fill('input[placeholder="Ex.: Nubank"]', 'Nubank'); await p.fill('input[placeholder="Ex.: 5"]', '5'); await p.fill('input[placeholder="Ex.: 12"]', '12'); await p.fill('input[placeholder="0,00"]', '5000')
  await p.click('form button.btn.primary'); const cards = await p.evaluate(() => JSON.parse(localStorage.getItem('fd:cards'))); assert(cards.length === 1 && cards[0].closingDay === 5 && cards[0].dueDay === 12 && cards[0].limit === 5000); const cid = cards[0].id
  // validação: dia inválido
  await p.click('button:has-text("Novo cartão")'); await p.fill('input[placeholder="Ex.: Nubank"]', 'X'); await p.fill('input[placeholder="Ex.: 5"]', '40'); await p.fill('input[placeholder="Ex.: 12"]', '12')
  assert(await p.locator('form button.btn.primary').isDisabled(), 'dia 40 inválido'); await p.click('.icon-btn[aria-label="Fechar"]')

  // 2) despesas no cartão
  const add = async (desc, val, date, withCard = true) => {
    await p.click('button:has-text("Nova transação")'); await p.fill('input[placeholder="Ex.: Mercado"]', desc); await p.fill('input[placeholder="0,00"]', val); await p.fill('form input[type=date] >> nth=0', date)
    if (withCard) await p.getByLabel('Cartão de crédito').selectOption(cid)
    await p.click('form button.btn.primary')
  }
  await add('Mercado', '100', '2026-09-03'); await add('Fechamento', '50', '2026-09-05'); await add('Farmácia', '200', '2026-09-06'); await add('Restaurante', '30', '2026-09-29'); await add('Dinheiro', '77', '2026-09-20', false)
  const txs = await ls('fd:txs'); assert.strictEqual(txs.filter((t) => t.cardId === cid).length, 4); assert(!txs.find((t) => t.description === 'Dinheiro').cardId)

  // 3) painel do cartão
  await p.click('.nav-item[aria-label="Cartões"]'); await sleep(200)
  const tile = norm(await p.locator('.cc').textContent()); console.log('tile:', tile)
  assert(tile.includes('R$ 230,00') && tile.includes('Fecha em 5 dias') && tile.includes('05 de out') && tile.includes('vence 12 de out'))
  assert(tile.includes('disponível R$ 4.770,00') && tile.includes('Melhor dia de compra: dia 6'))
  await p.screenshot({ path: 'cards-list.png' })

  // 4) faturas
  await p.click('.cc button:has-text("Ver faturas")'); assert.strictEqual(await p.evaluate(() => location.hash), `#/cards/${cid}`)
  const inv = norm(await p.locator('.invoices').textContent()); console.log('faturas:', inv.slice(0, 500))
  const octRow = p.locator('.invoice', { hasText: 'Aberta' }); const sepRow = p.locator('.invoice', { hasText: 'Vencida' })
  const oct = norm(await octRow.textContent()); assert(oct.includes('R$ 230,00') && oct.includes('Restaurante') && oct.includes('Farmácia'))
  const sep = norm(await sepRow.textContent()); assert(sep.includes('R$ 150,00') && sep.includes('Fechamento'), 'compra no dia do fechamento fica na fatura que fecha')
  await p.screenshot({ path: 'cards-detail.png' })
  await sepRow.locator('button:has-text("Marcar como paga")').click(); assert((await p.locator('.invoice', { hasText: 'Paga' }).count()) === 1)
  assert.deepStrictEqual((await p.evaluate(() => JSON.parse(localStorage.getItem('fd:cards'))))[0].paid, ['2026-09'])
  await p.reload(); await p.waitForSelector('.invoices'); assert((await p.locator('.invoice', { hasText: 'Paga' }).count()) === 1, 'pago persiste')
  await p.locator('.invoice', { hasText: 'Paga' }).locator('.invoice-head').click(); await p.locator('.invoice', { hasText: 'Paga' }).locator('button:has-text("Desfazer pagamento")').click(); assert.strictEqual(await p.locator('.invoice', { hasText: 'Vencida' }).count(), 1)

  // 5) transações mostram o cartão; visão geral e insights
  await p.click('.nav-item[aria-label="Transações"]'); assert((await p.locator('.card-tag', { hasText: 'Nubank' }).count()) >= 2)
  await p.click('.nav-item[aria-label="Visão geral"]'); await sleep(300)
  const up = norm(await p.locator('.list.compact').first().textContent()); console.log('próximos:', up); assert(up.includes('Fatura Nubank') && up.includes('R$ 230,00') && up.includes('em aberto'))
  const ai = norm(await p.locator('.ai-card').textContent()); assert(ai.includes('Fatura Nubank fecha em 5 dias')); console.log('insight ok')

  // 6) despesas automáticas herdam o cartão: assinatura, recorrente e parcela
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.click('button:has-text("Nova assinatura")')
  await p.fill('input[placeholder="Ex.: Netflix"]', 'Netflix'); await p.fill('input[placeholder="0,00"]', '55,90'); await p.fill('form input[type=date]', '2026-09-01'); await p.getByLabel('Cobrada no cartão').selectOption(cid); await p.click('form button.btn.primary')
  assert((await ls('fd:txs')).find((t) => t.description === 'Netflix').cardId === cid, 'assinatura → cartão')
  await p.click('[role=tab]:has-text("Parcelas")'); await p.click('button:has-text("Nova parcela")')
  await p.fill('input[placeholder="Ex.: iPhone 15"]', 'TV'); await p.fill('input[placeholder="0,00"]', '300'); await p.fill('input[placeholder="12"]', '4'); await p.fill('form input[type=date] >> nth=0', '2026-08-20'); await p.getByLabel('Cartão próprio em que foi parcelado').selectOption(cid); await p.click('form button.btn.primary')
  const tv = (await ls('fd:txs')).filter((t) => t.description.startsWith('TV')); assert(tv.length >= 1 && tv.every((t) => t.cardId === cid), 'parcelas → cartão'); console.log('parcelas no cartão:', tv.map((t) => t.date).join(','))
  await p.click('.nav-item[aria-label="Transações"]'); await p.click('button:has-text("Nova transação")'); await p.fill('input[placeholder="Ex.: Mercado"]', 'Academia'); await p.fill('input[placeholder="0,00"]', '120'); await p.fill('form input[type=date] >> nth=0', '2026-09-10')
  await p.getByLabel('Cartão de crédito').selectOption(cid); await p.check('input[type=checkbox]'); await p.click('form button.btn.primary')
  const rule = (await ls('fd:rules'))[0]; assert.strictEqual(rule.cardId, cid); assert((await ls('fd:txs')).find((t) => t.description === 'Academia').cardId === cid, 'recorrente → cartão')

  // 7) editar compra: tirar do cartão
  await p.selectOption('.toolbar select', '2026-09'); await p.click('button[aria-label^="Editar Restaurante"]'); await p.getByLabel('Cartão de crédito').selectOption(''); await p.click('form button.btn.primary')
  assert(!(await ls('fd:txs')).find((t) => t.description === 'Restaurante').cardId)

  // 8) assistente
  await p.click('.nav-item[aria-label="Assistente"]'); await p.click('.chip-btn:has-text("faturas")'); await sleep(300)
  const ans = norm(await p.locator('.bubble.bot').textContent()); console.log('assistente:', ans); assert(ans.includes('Nubank') && ans.includes('melhor dia de compra: dia 6'))

  // 9) excluir cartão mantém compras
  const n = (await ls('fd:txs')).length
  await p.click('.nav-item[aria-label="Cartões"]'); await p.click('.cc button:has-text("Ver faturas")'); await p.click(`button[aria-label="Excluir Nubank"]`); await sleep(200)
  assert.strictEqual((await ls('fd:cards')).length, 0); const after = await ls('fd:txs'); assert.strictEqual(after.length, n); assert(after.every((t) => !t.cardId)); assert((await ls('fd:subs')).every((s) => !s.cardId)); assert((await ls('fd:rules')).every((r) => !r.cardId))
  assert.strictEqual(await p.evaluate(() => location.hash), '#/cards')

  // 10) celular: 6 itens no menu sem rolagem horizontal
  await p.setViewportSize({ width: 390, height: 844 }); await sleep(300); assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 390); await p.screenshot({ path: 'cards-mobile.png' })
  console.log('errors', errs); assert.strictEqual(errs.length, 0); console.log('ALL OK'); 

})
