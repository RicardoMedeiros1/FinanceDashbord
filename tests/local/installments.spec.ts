import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-29T12:00:00'

test('parcelas: despesas automáticas, edição e comprovantes de backup', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  await p.goto('./'); await p.waitForSelector('.stat')
  const get = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k)
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')
  await p.click('.nav-item[aria-label="Assinaturas"]')
  await p.click('[role=tab]:has-text("Parcelas")')
  console.log('empty hint:', (await p.locator('.empty-rules').textContent()).slice(0, 40))

  await p.click('button:has-text("Nova parcela")')
  await p.fill('input[placeholder="Ex.: iPhone 15"]', 'iPhone 15')
  await p.fill('input[placeholder^="Ex.: João"]', 'João — cartão dele')
  await p.fill('input[placeholder="0,00"]', '250')
  await p.fill('input[placeholder="12"]', '12')
  await p.fill('form input[type=date] >> nth=0', '2026-03-10')
  console.log('first date auto:', await p.inputValue('form input[type=date] >> nth=1'))
  assert.strictEqual(await p.inputValue('form input[type=date] >> nth=1'), '2026-04-10')
  console.log('preview:', await p.locator('[role=note]').textContent())
  await p.screenshot({ path: 'inst-form.png' })
  await p.click('form button.btn.primary'); await p.waitForTimeout(300)

  let items = await get('fd:installments'); console.log('saved', JSON.stringify(items[0]))
  assert.strictEqual(items.length, 1)
  const card = (await p.locator('.card.sub').textContent()).replace(/\u00a0/g, ' '); console.log('card:', card)
  assert(card.includes('6 de 12 pagas') && card.includes('R$ 1.500,00'))
  await p.screenshot({ path: 'inst-page.png' })

  // editar: mudar nº de parcelas para 10 → termina em jan/2027, 6 pagas, faltam 4
  await p.click('button[aria-label="Editar iPhone 15"]')
  assert.strictEqual(await p.inputValue('input[placeholder="12"]'), '12')
  await p.fill('input[placeholder="12"]', '10')
  await p.click('form button.btn.primary'); await p.waitForTimeout(300)
  const c2 = (await p.locator('.card.sub').textContent()).replace(/\u00a0/g, ' '); console.log('after edit:', c2)
  assert(c2.includes('6 de 10 pagas') && c2.includes('R$ 1.000,00'))

  // visão geral: próximos pagamentos com nota da parcela
  await p.click('.nav-item[aria-label="Visão geral"]'); await p.waitForTimeout(400)
  const up = (await p.locator('.list.compact').textContent()).replace(/\u00a0/g, ' '); console.log('upcoming:', up)
  assert(up.includes('iPhone 15') && up.includes('parcela 7/10'))
  const ins = await p.locator('.ai-card').textContent(); console.log('insights has parcelamento:', ins.includes('parcelamento'))
  await p.screenshot({ path: 'inst-overview.png' })

  // assistente
  await p.click('.nav-item[aria-label="Assistente"]'); await p.click('.chip-btn:has-text("parcelas")'); await p.waitForTimeout(300)
  console.log('assistant:', await p.locator('.bubble.bot').textContent())

  // backup inclui parcelas; quitada quando todas venceram
  await p.click('button:has-text("Dados")')
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Exportar backup")')])
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); console.log('backup installments:', json.installments.length)
  await p.click('.icon-btn[aria-label="Fechar"]')
  await p.evaluate(() => { const k='fd:installments'; const a=JSON.parse(localStorage.getItem(k)); a.push({id:'x',name:'Notebook',lender:'',amount:100,count:3,purchaseDate:'2026-01-05',firstDate:'2026-02-05',color:'#3b6ef5'}); localStorage.setItem(k, JSON.stringify(a)) })
  await p.reload(); await p.waitForSelector('.sidebar')
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.click('[role=tab]:has-text("Parcelas")')
  await p.waitForTimeout(400); const all = await p.locator('.card.sub').allTextContents(); console.log('paid-off card:', all[1])
  assert(all[1].includes('Quitada') && all[1].includes('3 de 3 pagas'))

  // excluir
  await p.click('button[aria-label="Excluir Notebook"]'); await p.waitForTimeout(200)
  assert.strictEqual((await get('fd:installments')).length, 1)
  // mobile
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300)
  await p.screenshot({ path: 'inst-mobile.png' })
  console.log('errors', errs); console.log('ALL OK'); 

})
