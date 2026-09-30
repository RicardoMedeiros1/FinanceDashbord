import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, norm as _norm, sleep, until, PNG, PDF } from '../support/util'

const TIME = '2026-09-29T12:00:00'

test('comprovantes no modo local (IndexedDB)', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)

  const b = browser
  const { p } = await makeDevice(browser, baseURL, { time: TIME })
  const errs = p.errors
  const _c = p.click.bind(p)
  const ls = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k)
  await p.goto('./'); await p.waitForSelector('.stat')
  console.log('modo local: sem login, sem badge:', !(await p.locator('input[type=email]').count()) && !(await p.locator('.sync-badge').count()))
  await p.click('button:has-text("Dados")'); await p.click('button:has-text("Começar do zero")'); await p.click('.icon-btn[aria-label="Fechar"]')
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.click('[role=tab]:has-text("Parcelas")'); await p.click('button:has-text("Nova parcela")')
  await p.fill('input[placeholder="Ex.: iPhone 15"]', 'iPhone 15'); await p.fill('input[placeholder="0,00"]', '250'); await p.fill('input[placeholder="12"]', '12'); await p.fill('form input[type=date] >> nth=0', '2026-03-10'); await p.click('form button.btn.primary')
  await p.click('.details-btn'); 
  // só parcelas pagas têm botão
  assert.strictEqual(await p.locator('button[aria-label^="Anexar comprovante"]').count(), 6)
  // PDF na parcela 2, foto na 1
  await p.setInputFiles('.modal input[type=file]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') }) // tipo inválido não é anexado (input escondido sem alvo → parcela 0 por padrão)
  await p.waitForSelector('[role=alert]'); console.log('tipo inválido:', await p.textContent('[role=alert]'))
  await p.click('button[aria-label="Anexar comprovante da parcela 1"]', { trial: true }).catch(() => {})
  const fc1 = p.waitForEvent('filechooser'); await _c('button[aria-label="Anexar comprovante da parcela 1"]'); await (await fc1).setFiles({ name: 'pix.png', mimeType: 'image/png', buffer: PNG })
  await p.waitForSelector('button[aria-label="Ver comprovante da parcela 1"]')
  const fc2 = p.waitForEvent('filechooser'); await _c('button[aria-label="Anexar comprovante da parcela 2"]'); await (await fc2).setFiles({ name: 'boleto.pdf', mimeType: 'application/pdf', buffer: PDF })
  await p.waitForSelector('button[aria-label="Ver comprovante da parcela 2"]')
  const metas = await ls('fd:receipts'); console.log('metas:', metas.map((m) => `${m.k}:${m.mime}:${m.path.slice(0, 12)}`).join(' '))
  assert.strictEqual(metas.length, 2); assert(metas.find((m) => m.k === 0).mime === 'image/jpeg' && metas.find((m) => m.k === 1).mime === 'application/pdf')
  
  // ver imagem
  await p.click('button[aria-label="Ver comprovante da parcela 1"]'); await p.waitForSelector('img.receipt-img')
  assert(await p.evaluate(() => { const i = document.querySelector('img.receipt-img'); return i.complete && i.naturalWidth > 0 })); console.log('imagem local abre')
  await p.click('.overlay:last-of-type .icon-btn[aria-label="Fechar"]')
  // pdf: mostra aviso + link
  await p.click('button[aria-label="Ver comprovante da parcela 2"]'); await p.getByText('Este comprovante é um PDF').waitFor(); await p.click('.overlay:last-of-type .icon-btn[aria-label="Fechar"]')
  // trocar → antigo removido do IndexedDB
  const idbCount = () => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('finn-files', 1); r.onsuccess = () => { const q = r.result.transaction('files').objectStore('files').count(); q.onsuccess = () => res(q.result) } }))
  assert.strictEqual(await idbCount(), 2)
  const fc3 = p.waitForEvent('filechooser'); await _c('button[aria-label="Trocar comprovante da parcela 1"]'); await (await fc3).setFiles({ name: 'novo.png', mimeType: 'image/png', buffer: PNG })
  await sleep(600); assert.strictEqual(await idbCount(), 2); console.log('trocar mantém 1 arquivo por parcela')
  // ícone de clipe nas Transações
  await p.click('.icon-btn[aria-label="Fechar"]'); await p.click('.nav-item[aria-label="Transações"]'); await p.selectOption('.toolbar select', '2026-04')
  assert.strictEqual(await p.locator('button[aria-label^="Ver comprovante de iPhone 15 (1/12)"]').count(), 1); console.log('clipe aparece na despesa da parcela 1')
  await p.click('button[aria-label^="Ver comprovante de iPhone 15 (1/12)"]'); await p.waitForSelector('img.receipt-img'); await p.click('.icon-btn[aria-label="Fechar"]')
  // remover
  await p.click('.nav-item[aria-label="Assinaturas"]'); await p.click('[role=tab]:has-text("Parcelas")'); await p.click('.details-btn')
  await p.click('button[aria-label="Remover comprovante da parcela 2"]'); await sleep(400); assert.strictEqual((await ls('fd:receipts')).length, 1); assert.strictEqual(await idbCount(), 1)
  // excluir parcelamento apaga comprovantes
  await p.click('.icon-btn[aria-label="Fechar"]'); await p.click('button[aria-label="Excluir iPhone 15"]'); await sleep(500)
  assert.strictEqual((await ls('fd:receipts')).length, 0); assert.strictEqual(await idbCount(), 0); console.log('excluir parcelamento limpa comprovantes e arquivos')
  console.log('errors', errs); assert.strictEqual(errs.length, 0); console.log('ALL OK'); 

})
