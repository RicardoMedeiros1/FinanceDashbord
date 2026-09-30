import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-29T12:00:00'

test('assinaturas viram despesa a cada cobrança', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  await p.goto('./'); await p.waitForSelector('.stat')
  const get = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k)
  const set = (k, v) => p.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v])
  const today = await p.evaluate(() => { const d = new Date(); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}` })
  const ym = today.slice(0, 7)
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')
  await p.click('.nav-item[aria-label="Assinaturas"]')

  const add = async (name, price, cycle, date, cat) => {
    await p.click('button:has-text("Nova assinatura")')
    await p.fill('input[placeholder="Ex.: Netflix"]', name); await p.fill('input[placeholder="0,00"]', price)
    await p.selectOption('form select >> nth=0', cycle); await p.fill('form input[type=date]', date)
    if (cat) await p.selectOption('form select >> nth=1', cat)
  }
  // A1) checkbox marcado por padrão → despesa da cobrança deste mês
  await add('Netflix', '55,90', 'monthly', `${ym}-01`, 'lazer')
  console.log('checkbox:', await p.locator('label.check').textContent())
  await p.screenshot({ path: 'sub-form.png' })
  await p.click('form button.btn.primary')
  let txs = await get('fd:txs'); console.log('A1', JSON.stringify(txs.map((t) => [t.date, t.description, t.category, t.amount])))
  assert(txs.length === 1 && txs[0].date === `${ym}-01` && txs[0].category === 'lazer' && txs[0].amount === 55.9)
  // A2) desmarcado → nenhuma despesa
  await add('Spotify', '23,90', 'monthly', `${ym}-01`)
  await p.uncheck('label.check input'); await p.click('form button.btn.primary')
  assert.strictEqual((await get('fd:txs')).length, 1)
  // A3) anual com última cobrança em outro mês → sem checkbox, sem despesa (não inventa histórico)
  await add('Prime', '166,80', 'yearly', '2025-01-20')
  assert.strictEqual(await p.locator('label.check').count(), 0); await p.click('form button.btn.primary')
  assert.strictEqual((await get('fd:txs')).length, 1)
  // A4) cobrança antiga (3 meses atrás), mensal → só oferece a do mês atual, sem backfill dos meses passados
  await add('iCloud', '14,90', 'monthly', '2026-06-01')
  await p.click('form button.btn.primary'); txs = await get('fd:txs')
  console.log('A4 txs:', txs.length); assert.strictEqual(txs.filter((t) => t.description === 'iCloud').length, 1)
  assert(txs.find((t) => t.description === 'iCloud').date === `${ym}-01`)

  // B) editar preço: só a assinatura muda
  await p.click('button[aria-label="Editar Netflix"]'); await p.fill('input[placeholder="0,00"]', '59,90'); await p.click('form button.btn.primary')
  assert.strictEqual((await get('fd:subs')).find((s) => s.name === 'Netflix').price, 59.9)
  assert.strictEqual((await get('fd:txs')).find((t) => t.description === 'Netflix').amount, 55.9)

  // C) tempo passando: assinatura mensal dia 15, processada até 20/07 → gera 15/08 e 15/09
  const subs = await get('fd:subs')
  subs.push({ id: 'gym', name: 'Academia', price: 119.9, cycle: 'monthly', billingDate: '2026-06-15', color: '#f59e0b', active: true, category: 'saude', chargedUntil: '2026-07-20' })
  subs.push({ id: 'paused', name: 'Disney+', price: 33.9, cycle: 'monthly', billingDate: '2026-06-17', color: '#6366f1', active: false, chargedUntil: '2026-07-01' })
  subs.push({ id: 'legacy', name: 'Antiga', price: 10, cycle: 'monthly', billingDate: '2026-01-05', color: '#999', active: true })
  await set('fd:subs', subs)
  await p.reload(); await p.waitForSelector('.sidebar'); await p.waitForTimeout(400)
  txs = await get('fd:txs')
  const gym = txs.filter((t) => t.description === 'Academia').map((t) => t.date).sort(); console.log('C gym:', gym.join(','))
  assert.deepStrictEqual(gym, ['2026-08-15', '2026-09-15']); assert(txs.filter((t) => t.description === 'Academia').every((t) => t.category === 'saude'))
  assert(!txs.some((t) => t.description === 'Disney+'), 'pausada não gera')
  assert(!txs.some((t) => t.description === 'Antiga'), 'legado não gera histórico')
  const after = await get('fd:subs'); console.log('chargedUntil:', after.map((s) => `${s.name}=${s.chargedUntil}`).join(' '))
  assert(after.every((s) => s.chargedUntil >= (s.active ? today : today)))
  // recarregar não duplica
  const n = txs.length; await p.reload(); await p.waitForSelector('.sidebar'); await p.waitForTimeout(300); assert.strictEqual((await get('fd:txs')).length, n)
  // apagar uma cobrança gerada não recria
  await p.click('.nav-item[aria-label="Transações"]'); await p.selectOption('.toolbar select', '2026-08'); await p.click('button[aria-label^="Excluir Academia"]')
  await p.reload(); await p.waitForSelector('.sidebar'); await p.waitForTimeout(300)
  assert.strictEqual((await get('fd:txs')).length, n - 1)

  // D) reativar pausada não faz backfill
  await p.click('.nav-item[aria-label="Assinaturas"]')
  const card = p.locator('.card.sub', { hasText: 'Disney+' }); await card.locator('button[role=switch]').click()
  await p.waitForTimeout(300); assert(!(await get('fd:txs')).some((t) => t.description === 'Disney+')); assert((await get('fd:subs')).find((s) => s.id === 'paused').active)

  // E) visão geral soma as assinaturas do mês
  await p.click('.nav-item[aria-label="Visão geral"]'); await p.waitForTimeout(400)
  console.log('Despesas card:', (await p.locator('.stat >> nth=2').textContent()).replace(/ /g, ' '))
  await p.screenshot({ path: 'subs-overview.png' })
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.screenshot({ path: 'subs-page.png' })
  console.log('errors', errs); console.log('ALL OK'); 

})
