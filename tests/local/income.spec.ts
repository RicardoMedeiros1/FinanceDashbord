import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-29T12:00:00'

test('salário fixo e renda variável', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  const _c = p.click.bind(p)
  const ls = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), k)
  const norm = (t) => t.replace(/ /g, ' ')
  await p.goto('./'); await p.waitForSelector('.stat')
  const today = await p.evaluate(() => { const d = new Date(); const z = (n) => String(n).padStart(2, '0'); return { ym: `${d.getFullYear()}-${z(d.getMonth() + 1)}`, d: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` } })
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')

  // 1) salário fixo: escolher o tipo já sugere repetir todo mês
  await p.click('button:has-text("Nova transação")'); await p.click('form .segmented button:has-text("Receita")')
  console.log('tipos:', (await p.locator('form select >> nth=0').locator('option').allTextContents()).join(' | '))
  await p.selectOption('form select >> nth=0', 'salario')
  assert.strictEqual(await p.isChecked('input[type=checkbox]'), true, 'salário sugere repetir')
  await p.fill('input[placeholder="Ex.: Mercado"]', 'Salário empresa'); await p.fill('input[placeholder="0,00"]', '5000'); await p.fill('form input[type=date]', `${today.ym}-05`)
  console.log('botão:', await p.textContent('form button.btn.primary')); 
  await p.click('form button.btn.primary'); await sleep(300)
  const rules = await ls('fd:rules'); assert(rules.length === 1 && rules[0].cycle === 'monthly' && rules[0].category === 'salario' && rules[0].type === 'income')
  let txs = await ls('fd:txs'); assert(txs.length === 1 && txs[0].category === 'salario' && txs[0].date === `${today.ym}-05` && txs[0].amount === 5000); console.log('salário: regra mensal + lançamento de', txs[0].date)

  // 2) renda variável (Uber): 2 recebimentos, sem repetir (padrão do tipo variável)
  for (const [desc, v] of [['Uber semana 1', '800'], ['Uber semana 2', '650']]) {
    await p.click('button:has-text("Nova transação")'); await p.click('form .segmented button:has-text("Receita")')
    assert.strictEqual(await p.inputValue('form select >> nth=0'), 'variavel'); assert.strictEqual(await p.isChecked('input[type=checkbox]'), false)
    await p.fill('input[placeholder="Ex.: Mercado"]', desc); await p.fill('input[placeholder="0,00"]', v); await p.click('form button.btn.primary'); await sleep(200)
  }
  // 3) custo do trabalho
  await p.click('button:has-text("Nova transação")'); await p.fill('input[placeholder="Ex.: Mercado"]', 'Combustível Uber'); await p.fill('input[placeholder="0,00"]', '300')
  await p.selectOption('form select >> nth=0', 'trabalho'); await p.click('form button.btn.primary'); await sleep(200)
  txs = await ls('fd:txs'); assert.strictEqual(txs.filter((t) => t.category === 'variavel').length, 2); assert.strictEqual(txs.find((t) => t.category === 'trabalho').amount, 300)
  assert.strictEqual((await ls('fd:rules')).length, 1, 'variável não cria recorrência')

  // 4) Visão geral
  await p.click('.nav-item[aria-label="Visão geral"]'); await sleep(400)
  const rec = norm(await p.locator('.stat >> nth=1').textContent()); console.log('Receitas:', rec)
  assert(rec.includes('R$ 6.450,00') && rec.includes('Fixa R$ 5,0k') && rec.includes('Variável R$ 1,5k'))
  const ai = norm(await p.locator('.ai-card').textContent()); console.log('insights:', ai.slice(0, 400))
  assert(ai.includes('Salário fixo cobre as despesas') || ai.includes('Salário fixo')); assert(ai.includes('Renda variável líquida: R$ 1.150,00'))
  

  // 5) orçamentos não listam receitas, mas listam custos do trabalho
  await p.click('.nav-item[aria-label="Orçamentos"]'); await sleep(300)
  const budgets = norm(await p.locator('.budget').allTextContents().then((a) => a.join('|')))
  assert(!budgets.includes('Salário fixo') && !budgets.includes('Renda variável') && budgets.includes('Custos do trabalho')); console.log('orçamentos ok')

  // 6) assistente
  await p.click('.nav-item[aria-label="Assistente"]'); await p.fill('input[aria-label="Pergunta"]', 'Quanto ganhei de salário e uber?'); await p.keyboard.press('Enter'); await sleep(300)
  console.log('assistente:', norm(await p.locator('.bubble.bot').textContent()))
  assert(norm(await p.locator('.bubble.bot').textContent()).includes('Renda variável'))

  // 7) editar o tipo de uma receita
  await p.click('.nav-item[aria-label="Transações"]'); await p.click('button[aria-label^="Editar Uber semana 2"]')
  assert.strictEqual(await p.inputValue('form select >> nth=0'), 'variavel'); await p.selectOption('form select >> nth=0', 'renda'); await p.click('form button.btn.primary'); await sleep(200)
  assert.strictEqual((await ls('fd:txs')).find((t) => t.description === 'Uber semana 2').category, 'renda')
  console.log('errors', errs); assert.strictEqual(errs.length, 0); console.log('ALL OK'); 

})
