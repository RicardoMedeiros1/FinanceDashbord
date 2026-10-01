import { test } from '@playwright/test'
import { device, FIXED_NOW } from '../support/util'
import { buildSeed, OFX } from './seed'

const OUT = 'docs/img'
const seed = buildSeed()

async function open(browser: any, baseURL: string | undefined, viewport = { width: 1440, height: 900 }) {
  const d = await device(browser, baseURL, { viewport, time: FIXED_NOW })
  await d.ctx.addInitScript((data: Record<string, unknown>) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v))
  }, seed)
  return d
}
const go = async (p: any, hash: string, wait = 700) => {
  await p.goto('./' + hash)
  await p.waitForTimeout(wait)
}
const shot = (p: any, name: string, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })

test('capturas do app (modo local, dados fictícios)', async ({ browser, baseURL }) => {
  const { p } = await open(browser, baseURL)

  await go(p, '#/', 1200)
  await shot(p, 'overview', true)

  await go(p, '#/transactions')
  await shot(p, 'transactions')

  await go(p, '#/transactions/merchants')
  await shot(p, 'spending') // ranking e grupos
  await p.getByRole('button', { name: 'Ver gastos de Padaria' }).click()
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/spending-detail.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } })

  await go(p, '#/subscriptions')
  await shot(p, 'subscriptions')
  await go(p, '#/subscriptions/installments')
  await shot(p, 'installments')

  await go(p, '#/cards')
  await shot(p, 'cards')
  await p.getByRole('button', { name: /Ver faturas/ }).first().click()
  await p.waitForTimeout(600)
  await shot(p, 'card-invoices', true)

  await go(p, '#/cards/contas')
  await shot(p, 'accounts')

  await go(p, '#/budgets')
  await shot(p, 'budgets', true)

  await go(p, '#/invest')
  await shot(p, 'invest-reserve', true)
  await go(p, '#/invest/metas')
  await shot(p, 'invest-goals', true)
  await go(p, '#/invest/simulador')
  await p.getByLabel('Valor inicial').fill('10000')
  await p.getByLabel('Aporte mensal').fill('600')
  await p.getByLabel('Prazo em meses').fill('60')
  await p.waitForTimeout(900)
  await shot(p, 'invest-simulator', true)
  await go(p, '#/invest/conceitos')
  await p.locator('#concept-juros-compostos summary').click()
  await p.waitForTimeout(500)
  await shot(p, 'invest-concepts', true)

  await go(p, '#/assistant')
  for (const q of ['Quanto gastei no Mercado Central?', 'Quanto vai sobrar até o fim do mês?']) {
    await p.fill('input[aria-label="Pergunta"]', q)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(400)
  }
  await shot(p, 'assistant')

  // importar extrato (arquivo OFX fictício)
  await go(p, '#/transactions')
  await p.getByRole('button', { name: 'Importar extrato' }).click()
  await p.locator('.file-drop input').setInputFiles({ name: 'extrato-setembro.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(OFX) })
  await p.waitForTimeout(700)
  await shot(p, 'import')
  await p.click('.icon-btn[aria-label="Fechar"]')

  // transferências entre contas: um par Pix saída/entrada
  await p.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('fd:txs')!)
    t.push(
      { id: 'px1', date: '2026-09-27', description: 'Pix enviado — Reserva', amount: 500, type: 'expense', category: 'outros', accountId: 'conta-aurora' },
      { id: 'px2', date: '2026-09-27', description: 'Pix recebido — Conta Aurora', amount: 500, type: 'income', category: 'renda', accountId: 'reserva-aurora' },
    )
    localStorage.setItem('fd:txs', JSON.stringify(t))
  })
  await p.reload()
  await p.waitForTimeout(800)
  await p.getByRole('button', { name: 'Revisar' }).click()
  await p.waitForTimeout(500)
  await shot(p, 'transfers')

  // modo privacidade
  await p.evaluate(() => localStorage.setItem('fd:privacy', '1'))
  await p.goto('./#/')
  await p.reload()
  await p.waitForTimeout(1200)
  await shot(p, 'privacy')
})

test('capturas no celular (modo local, dados fictícios)', async ({ browser, baseURL }) => {
  const { p } = await open(browser, baseURL, { width: 390, height: 844 })
  const mobile = async (hash: string, name: string) => {
    await go(p, hash, 1000)
    await p.screenshot({ path: `${OUT}/${name}.png` })
  }
  await mobile('#/', 'mobile-overview')
  await mobile('#/transactions/merchants', 'mobile-spending')
  await mobile('#/cards', 'mobile-cards')
  await mobile('#/invest', 'mobile-reserve')
  await mobile('#/invest/simulador', 'mobile-simulator')
})
