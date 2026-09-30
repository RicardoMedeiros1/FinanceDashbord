import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, sleep, until, PNG } from '../support/util'
import { startFakeCloud } from '../support/fakeserver'

const TIME = undefined

test('parcelas pagas antes do app viram despesa e sincronizam', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  let cloud: any
  try {

  cloud = await startFakeCloud(4300); const rows = cloud.rows, files = cloud.files, st = cloud.state
  const b = browser
  const errs: string[] = []
  const device = async (name, pre?) => { const d = await makeDevice(browser, baseURL, { init: pre }); d.p.on('pageerror', (e) => errs.push(name + ': ' + e.message)); await d.p.goto('./'); return d }
  const login = async (p) => { await p.fill('input[type=email]', 'me@x.com'); await p.fill('input[type=password]', 'pw'); await p.click('button:has-text("Entrar")') }
  const live = (col) => [...rows.values()].filter((r) => r.collection === col && !r.deleted)

  // Aparelho A tinha o parcelamento salvo localmente (versão antiga: sem `generated`)
  const legacy = () => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('fd:installments', JSON.stringify([{ id: 'ip15', name: 'Iphone 15 Pro', lender: 'Fulano', amount: 521.71, count: 10, purchaseDate: '2026-05-20', firstDate: '2026-06-09', color: '#e0600f' }])) } }
  const A = await device('A', legacy); const a = A.p
  await login(a); await a.getByText('Dados neste aparelho').waitFor(); console.log('pergunta:', (await a.locator('.data-note').textContent()).slice(0, 60))
  await a.click('button:has-text("Enviar para a nuvem")'); await a.waitForSelector('.sync-badge.ok')
  assert.strictEqual((await a.ls('fd:txs')).length, 0, 'legado não lança histórico sozinho'); console.log('sem despesas ainda (como o usuário viu)')
  await a.click('.nav-item[aria-label="Assinaturas"]'); await a.click('[role=tab]:has-text("Parcelas")'); await a.click('.details-btn')
  const note = await a.locator('.backfill').textContent(); console.log('aviso:', note.replace(/\s+/g, ' '))
  assert(note.includes('4 parcelas pagas não estão nas despesas'))
  await a.click('.backfill button'); await sleep(300)
  const txs = await a.ls('fd:txs'); console.log('despesas:', txs.map((t) => `${t.date} ${t.description} ${t.amount}`).sort().join(' | '))
  assert.deepStrictEqual(txs.map((t) => t.date).sort(), ['2026-06-09', '2026-07-09', '2026-08-09', '2026-09-09']); assert(txs.every((t) => t.amount === 521.71 && t.type === 'expense'))
  assert.strictEqual(await a.locator('.backfill').count(), 0, 'aviso some'); assert.strictEqual((await a.ls('fd:installments'))[0].generated, 4)
  // não duplica ao recarregar
  await a.reload(); await a.waitForSelector('.sync-badge.ok'); await sleep(800); assert.strictEqual((await a.ls('fd:txs')).length, 4)
  // chega ao outro aparelho
  await until(() => live('txs').length === 4, 'servidor com 4 despesas')
  const B = await device('B'); await login(B.p); await B.p.waitForSelector('.sync-badge.ok'); await until(async () => (await B.p.ls('fd:txs'))?.length === 4, 'B recebe 4 despesas')
  console.log('B recebeu', (await B.p.ls('fd:txs')).length, 'despesas e', (await B.p.ls('fd:installments')).length, 'parcelamento')
  await B.p.waitForSelector('.stat'); await B.p.waitForTimeout(500)
  console.log('B "Despesas" (setembro):', (await B.p.locator('.stat >> nth=2').textContent()).replace(/ /g, ' '))
  // apagar uma despesa e lançar de novo pelo botão
  await a.click('.nav-item[aria-label="Transações"]'); await a.selectOption('.toolbar select', '2026-07'); await a.click('button[aria-label^="Excluir Iphone"]')
  await a.click('.nav-item[aria-label="Assinaturas"]'); await a.click('[role=tab]:has-text("Parcelas")'); await a.click('.details-btn')
  assert((await a.locator('.backfill').textContent()).includes('1 parcela paga não está')); await a.click('.backfill button'); await sleep(300); assert.strictEqual((await a.ls('fd:txs')).length, 4)
  console.log('errors', errs); assert.strictEqual(errs.length, 0); console.log('ALL OK'); ; 

  } finally {
    await cloud?.close()
  }

})
