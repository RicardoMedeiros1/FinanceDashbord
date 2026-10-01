import { test } from '@playwright/test'
import QRCode from 'qrcode'
import { startFakeCloud } from '../support/fakeserver'
import { device, FIXED_NOW } from '../support/util'
import { keyOf, COLS, type Col } from '../../src/cloud/sync'
import { acct, card, item, ITEM, tx } from '../support/pluggydata'
import { buildSeed, PERSONA } from './seed'

const OUT = 'docs/img'
const seed = buildSeed()
const PASSWORD = 'frase-longa-de-exemplo-2026'
const UA_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
const NOW = new Date(FIXED_NOW).getTime() // o relógio do app nas capturas (29/09/2026, meio-dia)
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString()

test('capturas da nuvem: login, 2FA, acessos, PIN e banco (servidor de teste, dados fictícios)', async ({ browser, baseURL }) => {
  const cloud = await startFakeCloud(4300)
  try {
    cloud.state.email = PERSONA.email
    cloud.state.password = PASSWORD
    cloud.state.mfa.enforce = true
    cloud.state.fakeNow = NOW
    cloud.state.loginIp = '203.0.113.77'
    cloud.state.mfa.qr = await QRCode.toDataURL(`otpauth://totp/Finn:${encodeURIComponent(PERSONA.email)}?secret=JBSWY3DPEHPK3PXP&issuer=Finn`, { margin: 1, width: 352 })

    // dados fictícios já na "nuvem"
    let n = 0
    for (const col of COLS as readonly Col[]) {
      for (const it of ((seed as Record<string, any[]>)[`fd:${col}`] ?? [])) {
        const id = keyOf(col, it)
        cloud.rows.set(`${col}/${id}`, { collection: col, id, data: it, deleted: false, synced_at: new Date(Date.now() - 3_600_000 + ++n).toISOString() })
      }
    }
    // acessos anteriores: o último login foi no iPhone; depois alguém errou a senha 3 vezes de outro lugar
    const email = PERSONA.email
    cloud.state.attempts.push(
      { at: ago(60 * 20), ok: false, locked: false, ip: '198.51.100.23', ua: UA_ANDROID, email },
      { at: ago(60 * 20 + 2), ok: false, locked: false, ip: '198.51.100.23', ua: UA_ANDROID, email },
      { at: ago(60 * 20 + 4), ok: false, locked: false, ip: '198.51.100.23', ua: UA_ANDROID, email },
      { at: ago(60 * 26), ok: true, locked: false, ip: '203.0.113.45', ua: UA_IPHONE, email },
      { at: ago(60 * 70), ok: true, locked: false, ip: '203.0.113.12', ua: UA_WIN, email },
    )

    const { p, ctx } = await device(browser, baseURL, { viewport: { width: 1000, height: 720 }, time: FIXED_NOW, userAgent: UA_WIN })
    const login = async (page: any) => {
      await page.fill('input[type=email]', PERSONA.email)
      await page.fill('input[type=password]', PASSWORD)
      await page.click('button:has-text("Entrar")')
    }

    // login
    await p.goto('./')
    await p.fill('input[type=email]', PERSONA.email)
    await p.fill('input[type=password]', '••••••••••••')
    await p.screenshot({ path: `${OUT}/login.png` })
    await p.fill('input[type=password]', PASSWORD)
    await p.click('button:has-text("Entrar")')

    // cadastro do aplicativo autenticador (QR code)
    await p.waitForSelector('[data-testid=mfa-secret]')
    await p.setViewportSize({ width: 1000, height: 900 })
    await p.waitForTimeout(500)
    await p.screenshot({ path: `${OUT}/mfa-setup.png` })
    await p.getByLabel('Código de 6 dígitos').fill('123456')
    await p.getByRole('button', { name: 'Ativar' }).click()
    await p.waitForSelector('.sync-badge.ok')

    // aviso de tentativas erradas + registro de acessos
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.goto('./#/')
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${OUT}/security-alert.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } })
    await p.click('button:has-text("Dados")')
    await p.click('button:has-text("Segurança")')
    await p.waitForTimeout(800)
    await p.setViewportSize({ width: 1440, height: 1500 })
    await p.waitForTimeout(500)
    await p.locator('.modal').screenshot({ path: `${OUT}/security.png` })

    // bloqueio por PIN
    const sec = p.getByRole('region', { name: 'Bloqueio com PIN' })
    await sec.getByLabel('Novo PIN').fill('482915')
    await sec.getByLabel('Repita o PIN').fill('482915')
    await sec.getByRole('button', { name: 'Ativar bloqueio' }).click()
    await p.click('.icon-btn[aria-label="Fechar"]')
    await p.setViewportSize({ width: 1000, height: 720 })
    await p.reload()
    await p.waitForSelector('[aria-label="Finn bloqueado"]')
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${OUT}/lock.png` })
    await p.getByLabel('PIN').fill('482915')

    // Open Finance: banco fictício
    cloud.state.pluggy.data = {
      items: [item({ connector: 'MeuPluggy' })],
      accounts: [acct({ name: 'Conta Digital', balance: 5230.4 }), card({ name: 'Cartão Platinum', creditLimit: 12000, availableCredit: 9800 })],
      transactions: [
        tx('b1', 'acc-1', '2026-09-26', 'Mercado Central', 241.7, 'out'),
        tx('b2', 'acc-1', '2026-09-25', 'Projeto Estúdio Lume', 1900, 'in'),
        tx('b3', 'acc-1', '2026-09-24', 'Padaria Pão Quente', 27.5, 'out'),
        tx('b4', 'card-1', '2026-09-23', 'Livraria Páginas', 86.9, 'out'),
        tx('b5', 'card-1', '2026-09-22', 'Cantina Bella', 124.0, 'out'),
        tx('b6', 'acc-1', '2026-09-21', 'Pagamento de fatura Platinum', 1480.0, 'out'),
      ],
    }
    await p.setViewportSize({ width: 1440, height: 1100 })
    await p.waitForTimeout(800)
    await p.click('button[aria-label="Bancos (Open Finance)"]')
    const modal = p.getByRole('dialog', { name: 'Bancos (Open Finance)' })
    await modal.getByLabel('Nome do banco').fill('Banco Aurora')
    await modal.getByLabel('Item ID da conexão (Pluggy)').fill(ITEM)
    await modal.getByRole('button', { name: 'Conectar e importar' }).click()
    await modal.getByRole('status').waitFor()
    await p.waitForTimeout(600)
    await p.locator('.modal').screenshot({ path: `${OUT}/bank.png` })

    // outro aparelho: pede o código
    const b = await device(browser, baseURL, { viewport: { width: 1000, height: 720 }, time: FIXED_NOW, userAgent: UA_IPHONE })
    await b.p.goto('./')
    await login(b.p)
    await b.p.waitForSelector('text=Verificação em duas etapas')
    await b.p.waitForTimeout(400)
    await b.p.screenshot({ path: `${OUT}/mfa-challenge.png` })
    await ctx.close()
  } finally {
    await cloud.close()
  }
})
