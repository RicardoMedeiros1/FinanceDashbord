import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-29T12:00:00'

test('recorrentes e edição de transação', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { ctx, p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  await p.goto('./'); await p.waitForSelector('.stat')
  const get = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k)
  // zera
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')
  await p.click('.nav-item[aria-label="Transações"]')

  // 1) recorrente mensal começando em 31/01/2026
  await p.click('button:has-text("Recorrentes")'); await p.click('button:has-text("Nova recorrente")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Aluguel')
  await p.fill('input[placeholder="0,00"]', '2100')
  await p.fill('input[type=date]', '2026-01-31')
  await p.selectOption('form select >> nth=0', 'moradia')
  console.log('repeat checked by default:', await p.isChecked('input[type=checkbox]'))
  await p.click('form button.btn.primary'); await p.waitForTimeout(400)
  let txs = await get('fd:txs'); let dates = txs.map((t) => t.date).sort()
  console.log('monthly dates:', dates.join(' '))
  assert.deepStrictEqual(dates, ['2026-01-31','2026-02-28','2026-03-31','2026-04-30','2026-05-31','2026-06-30','2026-07-31','2026-08-31'])
  assert(txs.every((t) => t.ruleId))

  // 2) recarregar não duplica
  await p.reload(); await p.waitForSelector('.sidebar')
  assert.strictEqual((await get('fd:txs')).length, 8)

  // 3) apagar um lançamento gerado não o recria
  await p.click('.nav-item[aria-label="Transações"]')
  await p.selectOption('.toolbar select', '2026-03')
  await p.click('button[aria-label^="Excluir Aluguel"]'); await p.waitForTimeout(200)
  await p.reload(); await p.waitForSelector('.sidebar')
  assert.strictEqual((await get('fd:txs')).length, 7)

  // 4) editar
  await p.click('.nav-item[aria-label="Transações"]')
  await p.selectOption('.toolbar select', '2026-04')
  await p.click('button[aria-label^="Editar Aluguel"]')
  console.log('edit form prefilled:', await p.inputValue('input[placeholder="Ex.: Mercado"]'), await p.inputValue('input[placeholder="0,00"]'), await p.isVisible('input[type=checkbox]'))
  await p.fill('input[placeholder="0,00"]', '2250,50')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Aluguel reajustado')
  await p.click('form button.btn.primary'); await p.waitForTimeout(300)
  txs = await get('fd:txs')
  const edited = txs.find((t) => t.date === '2026-04-30')
  console.log('edited:', edited.description, edited.amount, 'ruleId kept:', !!edited.ruleId)
  assert(edited.amount === 2250.5 && edited.description === 'Aluguel reajustado' && edited.ruleId)
  assert.strictEqual(txs.length, 7)

  // 5) pausar / reativar pula o que passou
  await p.click('button:has-text("Recorrentes")')
  const rule0 = (await get('fd:rules'))[0]
  await p.click('button[role=switch]'); await p.waitForTimeout(200)
  console.log('paused:', !(await get('fd:rules'))[0].active)
  await p.click('button[role=switch]'); await p.waitForTimeout(300)
  const r2 = (await get('fd:rules'))[0]
  console.log('resumed generated', rule0.generated, '->', r2.generated, 'txs', (await get('fd:txs')).length)
  assert.strictEqual((await get('fd:txs')).length, 7)

  // 6) receita semanal criada com data futura não gera nada
  await p.click('button:has-text("Nova recorrente")')
  await p.click('form .segmented button:has-text("Receita")')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Freela')
  await p.fill('input[placeholder="0,00"]', '300')
  await p.fill('input[type=date]', '2026-12-01')
  await p.selectOption('select[aria-label="Frequência"]', 'weekly')
  await p.click('form button.btn.primary'); await p.waitForTimeout(300)
  assert.strictEqual((await get('fd:txs')).length, 7)
  assert.strictEqual((await get('fd:rules')).length, 2)
  

  // 7) excluir a regra mantém os lançamentos já gerados
  await p.click('button[aria-label^="Excluir recorrência Freela"]'); await p.waitForTimeout(200)
  assert.strictEqual((await get('fd:rules')).length, 1)
  assert.strictEqual((await get('fd:txs')).length, 7)

  // 8) exportar inclui recurring
  await p.click('button:has-text("Dados")')
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Exportar backup")')])
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'))
  console.log('backup has recurring:', json.recurring.length)
  await p.click('.icon-btn[aria-label="Fechar"]')
  await p.click('button:has-text("Lançamentos")'); await p.selectOption('.toolbar select', '2026-04'); await p.waitForTimeout(200)
  
  console.log('errors', errs); console.log('ALL OK'); 

})
