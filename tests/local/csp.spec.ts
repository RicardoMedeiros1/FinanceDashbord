import { expect, test } from '../support/test'
import { device } from '../support/util'

const PAGES = ['#/', '#/transactions', '#/transactions/merchants', '#/subscriptions', '#/cards', '#/cards/contas', '#/budgets', '#/invest', '#/invest/metas', '#/invest/simulador', '#/invest/conceitos', '#/assistant', '#/privacy']

test('o app roda inteiro sob a política de segurança (CSP), sem pedir nada de fora e sem violações', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  const violations: string[] = []
  const origins = new Set<string>()
  p.on('console', (m) => {
    if (/content security policy|refused to/i.test(m.text())) violations.push(m.text())
  })
  p.on('request', (r) => origins.add(new URL(r.url()).origin))
  await p.goto('./')
  await expect(p.locator('head meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
  const policy = await p.locator('head meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain("script-src 'self'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).not.toContain('unsafe-eval')
  expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/) // script inline continua proibido
  await expect(p.locator('head meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')

  for (const hash of PAGES) {
    await p.goto('./' + hash)
    await p.waitForTimeout(250)
  }
  await p.getByRole('button', { name: 'Atualizar pelo Banco Central' }).count() // só garante que a aba carregou
  expect(violations).toEqual([])
  expect(p.errors).toEqual([])
  // nada de fontes ou scripts de terceiros: só o próprio servidor
  expect([...origins]).toEqual(['http://localhost:4173'])
})

test('a CSP bloqueia script inline injetado (o que um XSS tentaria)', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await p.waitForSelector('.sidebar')
  const ran = await p.evaluate(() => {
    const s = document.createElement('script')
    s.textContent = 'window.__pwned = true'
    document.body.appendChild(s)
    return Boolean((window as unknown as { __pwned?: boolean }).__pwned)
  })
  expect(ran).toBe(false)
})
