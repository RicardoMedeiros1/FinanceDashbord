import { test } from '../support/test'
import assert from 'node:assert'
import fs from 'node:fs'
import { device as makeDevice, sleep, until, PNG } from '../support/util'
import { startFakeCloud } from '../support/fakeserver'

const TIME = undefined

test('sincronização entre dois aparelhos, offline, conflito, parcelas e comprovantes', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  let cloud: any
  try {

  cloud = await startFakeCloud(4300); const rows = cloud.rows, files = cloud.files, st = cloud.state
  const b = browser
  const errs: string[] = []
  const device = async (name, pre?) => { const d = await makeDevice(browser, baseURL, { init: pre }); d.p.on('pageerror', (e) => errs.push(name + ': ' + e.message)); await d.p.goto('./'); return d }
  const login = async (p, email = 'me@x.com', pw = 'pw') => { await p.fill('input[type=email]', email); await p.fill('input[type=password]', pw); await p.click('button:has-text("Entrar")') }
  const remote = (col) => [...rows.values()].filter((r) => r.collection === col)
  const live = (col) => remote(col).filter((r) => !r.deleted)

  // ===== 1) login =====
  const A = await device('A'); const a = A.p
  await a.waitForSelector('input[type=email]'); assert(!(await a.locator('.sidebar').count()), 'app não aparece sem login')
  await login(a, 'me@x.com', 'errada'); await a.waitForSelector('[role=alert]'); console.log('1 erro:', await a.textContent('[role=alert]'))
  await login(a); await a.waitForSelector('.sidebar'); await a.waitForSelector('.sync-badge.ok')
  assert.strictEqual((await a.ls('fd:txs')).length, 0, 'sem dados de exemplo com nuvem')
  console.log('1 ok: login, app vazio, badge:', await a.textContent('.sync-badge'))

  // ===== 2) A cria transação → servidor =====
  const addTx = async (p, desc, val) => { await p.click('button:has-text("Nova transação")'); await p.fill('input[placeholder="Ex.: Mercado"]', desc); await p.fill('input[placeholder="0,00"]', val); await p.click('form button.btn.primary') }
  await addTx(a, 'Mercado', '120')
  await until(() => live('txs').length === 1, 'A→servidor'); console.log('2 ok: servidor recebeu', JSON.stringify(live('txs')[0].data.description))

  // ===== 3) B loga e recebe =====
  const B = await device('B'); const bb = B.p
  await login(bb); await bb.waitForSelector('.sidebar')
  await until(async () => (await bb.ls('fd:txs')).length === 1, 'B recebe'); console.log('3 ok: B recebeu Mercado; adoção não perguntada:', !(await bb.getByText('Dados neste aparelho').count()))

  // ===== 4) B edita → A vê (tempo real) =====
  await bb.click('.nav-item[aria-label="Transações"]'); await bb.click('button[aria-label^="Editar Mercado"]'); await bb.fill('input[placeholder="0,00"]', '150,50'); await bb.click('form button.btn.primary')
  await until(async () => (await a.ls('fd:txs'))[0]?.amount === 150.5, 'A vê edição de B', 12000); console.log('4 ok: A viu 150.5')

  // ===== 5) exclusão propaga (tombstone) =====
  await a.click('.nav-item[aria-label="Transações"]'); await a.click('button[aria-label^="Excluir Mercado"]')
  await until(async () => (await bb.ls('fd:txs')).length === 0, 'B vê exclusão', 12000); assert.strictEqual(remote('txs')[0].deleted, true); console.log('5 ok: exclusão propagou, tombstone no servidor')

  // ===== 6) offline → pendente → online =====
  await sleep(600); await fetch('http://localhost:4300/admin?offline=1')
  await addTx(a, 'Offline1', '10'); await a.waitForSelector('.sync-badge.error, .sync-badge.offline', { timeout: 8000 }); console.log('6 badge offline/erro:', await a.textContent('.sync-badge'))
  assert(!live('txs').some((r) => r.data.description === 'Offline1'))
  await fetch('http://localhost:4300/admin?offline=0'); await a.click('.sync-badge')
  await until(() => live('txs').some((r) => r.data.description === 'Offline1'), 'push após voltar'); await a.waitForSelector('.sync-badge.ok'); console.log('6 ok: envio pendente concluído')

  // ===== 7) reload não reenvia; busca incremental =====
  const upsBefore = st.upserts; await a.reload(); await a.waitForSelector('.sync-badge.ok'); await sleep(1500)
  assert.strictEqual(st.upserts, upsBefore, 'reload não reenvia'); console.log('7 ok: sem reenvio; buscas:', st.fetches.length, 'última com since=', st.fetches[st.fetches.length - 1] !== '')
  assert(st.fetches[st.fetches.length - 1] !== '')

  // ===== 8) conflito: mesma transação editada nos dois lados, A offline =====
  await bb.reload(); await bb.waitForSelector('.sync-badge.ok'); await until(async () => (await bb.ls('fd:txs')).length === 1, 'B tem Offline1')
  await A.ctx.setOffline(true)
  await a.click('.nav-item[aria-label="Transações"]'); await a.click('button[aria-label^="Editar Offline1"]'); await a.fill('input[placeholder="0,00"]', '111'); await a.click('form button.btn.primary')
  await bb.click('.nav-item[aria-label="Transações"]'); await bb.click('button[aria-label^="Editar Offline1"]'); await bb.fill('input[placeholder="0,00"]', '222'); await bb.click('form button.btn.primary')
  await until(() => live('txs').some((r) => r.data.amount === 222), 'B enviou 222')
  assert(!live('txs').some((r) => r.data.amount === 111), 'A ainda não enviou')
  await A.ctx.setOffline(false); await a.click('.sync-badge'); await until(() => live('txs').some((r) => r.data.amount === 111 && r.data.description === 'Offline1'), 'A (alteração local) vence', 10000)
  await until(async () => (await bb.ls('fd:txs')).find((t) => t.description === 'Offline1')?.amount === 111, 'B converge', 12000); console.log('8 ok: conflito resolvido, ambos com 111')

  // ===== 9) parcelas: geram uma vez só, sem duplicar entre aparelhos =====
  await a.click('.nav-item[aria-label="Assinaturas"]'); await a.click('[role=tab]:has-text("Parcelas")'); await a.click('button:has-text("Nova parcela")')
  await a.fill('input[placeholder="Ex.: iPhone 15"]', 'iPhone'); await a.fill('input[placeholder="0,00"]', '250'); await a.fill('input[placeholder="12"]', '12'); await a.fill('form input[type=date] >> nth=0', '2026-03-10'); await a.click('form button.btn.primary')
  await until(() => live('txs').filter((r) => r.data.description.startsWith('iPhone')).length === 6, '6 despesas no servidor')
  await bb.reload(); await bb.waitForSelector('.sync-badge.ok'); await until(async () => (await bb.ls('fd:txs')).filter((t) => t.description.startsWith('iPhone')).length === 6, 'B tem 6'); await sleep(1500)
  assert.strictEqual(live('txs').filter((r) => r.data.description.startsWith('iPhone')).length, 6)
  assert.strictEqual((await bb.ls('fd:txs')).filter((t) => t.description.startsWith('iPhone')).length, 6); console.log('9 ok: 6 despesas em A, B e servidor (sem duplicar)')

  // ===== 10) comprovantes =====
  const inst = (await a.ls('fd:installments'))[0]
  await a.click('.details-btn'); await a.setInputFiles('.modal input[type=file]', { name: 'pix.png', mimeType: 'image/png', buffer: PNG })
  await until(() => files.size === 1, 'arquivo no servidor'); await a.waitForSelector('button[aria-label="Ver comprovante da parcela 1"]')
  const [path] = [...files.keys()]; assert(path.startsWith('u1/') && path.includes(`${inst.id}-p0`)); await until(() => live('receipts').length === 1, 'meta no servidor'); console.log('10 arquivo:', path, '| meta no servidor:', live('receipts').length)
  assert(!(await a.locator('button[aria-label="Anexar comprovante da parcela 7"]').count()), 'parcela futura não aceita comprovante')
  await a.click('button[aria-label="Ver comprovante da parcela 1"]'); await a.waitForSelector('img.receipt-img')
  assert.strictEqual(await a.evaluate(() => { const i = document.querySelector('img.receipt-img'); return i.complete && i.naturalWidth > 0 }), true); console.log('10 ok: A visualiza a imagem')
  await a.click('.overlay:last-of-type .icon-btn[aria-label="Fechar"]'); await a.click('.icon-btn[aria-label="Fechar"]')
  // B vê o comprovante
  await bb.click('.nav-item[aria-label="Assinaturas"]'); await bb.click('[role=tab]:has-text("Parcelas")'); await until(async () => (await bb.ls('fd:receipts'))?.length === 1, 'B recebe meta')
  await bb.click('.details-btn'); await bb.click('button[aria-label="Ver comprovante da parcela 1"]'); await bb.waitForSelector('img.receipt-img')
  assert.strictEqual(await bb.evaluate(() => { const i = document.querySelector('img.receipt-img'); return i.complete && i.naturalWidth > 0 }), true); console.log('10 ok: B visualiza o mesmo comprovante')
  await bb.screenshot({ path: 'cloud-receipt.png' })
  await bb.click('.overlay:last-of-type .icon-btn[aria-label="Fechar"]')
  // B remove → arquivo some no servidor, A vê
  await bb.click('button[aria-label="Remover comprovante da parcela 1"]'); await until(() => files.size === 0, 'arquivo removido'); await until(() => live('receipts').length === 0, 'meta removida')
  await until(async () => (await a.ls('fd:receipts')).length === 0, 'A vê remoção', 12000); console.log('10 ok: remoção propagou (arquivo e metadados)')
  await bb.click('.icon-btn[aria-label="Fechar"]')

  // ===== 11) adoção de dados locais =====
  const seedLocal = () => { if (!sessionStorage.getItem('seeded') && (sessionStorage.setItem('seeded','1') || true)) localStorage.setItem('fd:txs', JSON.stringify([{ id: 'loc1', description: 'Local A', amount: 5, type: 'expense', category: 'outros', date: '2026-09-01' }])) }
  const C = await device('C', seedLocal); await login(C.p); await C.p.getByText('Dados neste aparelho').waitFor()
  await C.p.click('button:has-text("Enviar para a nuvem")'); await until(() => live('txs').some((r) => r.id === 'loc1'), 'local enviado'); console.log('11 ok: dados locais adotados e enviados')
  assert((await C.p.ls('fd:txs')).length > 1, 'C também recebeu os da nuvem')
  const D = await device('D', () => { if (!sessionStorage.getItem('seeded') && (sessionStorage.setItem('seeded','1') || true)) localStorage.setItem('fd:txs', JSON.stringify([{ id: 'loc2', description: 'Lixo demo', amount: 9, type: 'expense', category: 'outros', date: '2026-09-01' }])) })
  await login(D.p); await D.p.getByText('Dados neste aparelho').waitFor(); await D.p.click('button:has-text("Descartar os deste aparelho")')
  await D.p.waitForSelector('.sync-badge.ok'); await sleep(800); assert(!live('txs').some((r) => r.id === 'loc2'), 'lixo não vai para a nuvem'); assert(!(await D.p.ls('fd:txs')).some((t) => t.id === 'loc2'))
  assert((await D.p.ls('fd:txs')).length > 1); console.log('11 ok: descartar não polui a nuvem e baixa os dados de lá')

  // ===== 12) sair limpa o aparelho =====
  await D.p.click('button:has-text("Dados")'); await D.p.click('button:has-text("Sair desta conta")'); await D.p.waitForSelector('input[type=email]')
  const left = await D.p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fd:'))); console.log('12 ok: chaves restantes:', JSON.stringify(left)); assert.strictEqual(left.length, 0)
  await D.p.screenshot({ path: 'cloud-login.png' })
  console.log('errors:', errs); assert.strictEqual(errs.length, 0)
; 

  } finally {
    await cloud?.close()
  }

})
