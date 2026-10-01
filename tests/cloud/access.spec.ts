import { expect, test } from '../support/test'
import { startFakeCloud, type FakeCloud } from '../support/fakeserver'
import { device } from '../support/util'

let cloud: FakeCloud
test.beforeEach(async () => {
  cloud = await startFakeCloud(4300)
})
test.afterEach(async () => {
  await cloud.close()
})

const fill = async (p: any, password: string) => {
  await p.fill('input[type=email]', 'me@x.com')
  await p.fill('input[type=password]', password)
  await p.click('button:has-text("Entrar")')
}
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const attempt = (ok: boolean, min: number, locked = false) => ({ at: ago(min), ok, locked, ip: '203.0.113.7', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0 Safari/537.36', email: 'me@x.com' })

test('5 senhas erradas bloqueiam o login (até com a senha certa) e tudo fica registrado', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await fill(p, 'errada1')
  await expect(p.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await fill(p, 'errada2')
  await fill(p, 'errada3')
  await expect(p.getByRole('alert')).toContainText('Restam 2 tentativas antes do bloqueio')
  await fill(p, 'errada4')
  await expect(p.getByRole('alert')).toContainText('Restam 1 tentativa antes do bloqueio')
  await fill(p, 'errada5')
  await fill(p, 'pw') // a senha certa também fica bloqueada
  await expect(p.getByRole('alert')).toContainText('Muitas tentativas erradas')
  await expect(p.locator('.sidebar')).toHaveCount(0)
  expect(cloud.state.attempts.filter((a) => !a.ok && !a.locked)).toHaveLength(5)
  expect(cloud.state.attempts[0]).toMatchObject({ ok: false, locked: true })

  // passado o tempo do bloqueio, entra
  cloud.state.attempts.length = 0
  await fill(p, 'pw')
  await expect(p.locator('.sidebar')).toBeVisible()
  expect(cloud.state.attempts[0]).toMatchObject({ ok: true })
})

test('aviso de tentativas erradas desde o último acesso: aparece, leva ao histórico e some depois de dispensado', async ({ browser, baseURL }) => {
  cloud.state.attempts.push(attempt(false, 90), attempt(false, 100), attempt(true, 300)) // 2 erros depois do último acesso
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await fill(p, 'pw')
  const banner = p.getByRole('alert').filter({ hasText: 'tentativas de acesso' })
  await expect(banner).toContainText('2 tentativas de acesso com senha errada')
  await banner.getByRole('button', { name: 'Ver acessos' }).click()

  const sec = p.getByRole('dialog', { name: 'Segurança' })
  const list = sec.getByRole('region', { name: 'Acessos recentes' })
  await expect(list.getByText('Senha ou e-mail errado').first()).toBeVisible()
  await expect(list.getByText('Entrou').first()).toBeVisible()
  await expect(list).toContainText('Chrome no Windows')
  await expect(list).toContainText('IP 203.0.113.7')
  expect(await list.locator('li').count()).toBeGreaterThanOrEqual(4) // 2 erros, o login anterior e o atual
  await p.keyboard.press('Escape').catch(() => undefined)
  await p.click('.icon-btn[aria-label="Fechar"]')

  // ver os acessos dispensa o aviso; recarregar não traz de volta
  await expect(banner).toHaveCount(0)
  await p.reload()
  await p.waitForSelector('.sync-badge.ok')
  await expect(banner).toHaveCount(0)

  // alguém tentando agora (depois do login): aparece de novo
  cloud.state.attempts.unshift(attempt(false, 0))
  await p.reload()
  await expect(p.getByRole('alert').filter({ hasText: '1 tentativa de acesso com senha errada' })).toBeVisible()
  await p.getByRole('button', { name: 'Dispensar aviso de acessos' }).click()
  await expect(p.getByRole('alert').filter({ hasText: 'tentativa' })).toHaveCount(0)
})

test('o próprio erro de digitação antes de entrar não gera aviso', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.goto('./')
  await fill(p, 'errada')
  await fill(p, 'pw')
  await expect(p.locator('.sidebar')).toBeVisible()
  await p.waitForSelector('.sync-badge.ok')
  await expect(p.getByRole('alert').filter({ hasText: 'tentativa' })).toHaveCount(0)
  // mas o erro continua no histórico
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  await expect(p.getByRole('region', { name: 'Acessos recentes' })).toContainText('Senha ou e-mail errado')
})

test('sair de todos os aparelhos encerra esta sessão e as dos outros', async ({ browser, baseURL }) => {
  const a = await device(browser, baseURL)
  const b = await device(browser, baseURL)
  for (const d of [a, b]) {
    await d.p.goto('./')
    await fill(d.p, 'pw')
    await d.p.waitForSelector('.sync-badge.ok')
  }
  await a.p.click('button:has-text("Dados")')
  await a.p.click('button:has-text("Segurança")')
  await a.p.getByRole('button', { name: 'Sair de todos os aparelhos' }).click() // confirmação aceita pelo helper
  await expect(a.p.locator('input[type=email]')).toBeVisible()
  expect(cloud.state.dead.size).toBeGreaterThan(0)

  // o outro aparelho perde o acesso ao abrir de novo
  await b.p.reload()
  await expect(b.p.locator('input[type=email]')).toBeVisible()
  await expect(b.p.locator('.sidebar')).toHaveCount(0)
  // e dá para entrar de novo normalmente
  await fill(b.p, 'pw')
  await expect(b.p.locator('.sidebar')).toBeVisible()
})

test('sem o registro ativado no servidor, o histórico explica o que fazer e o app segue normal', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL)
  await p.route('**/access-log**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto('./')
  await fill(p, 'pw')
  await p.waitForSelector('.sync-badge.ok')
  await expect(p.getByRole('alert').filter({ hasText: 'tentativa' })).toHaveCount(0)
  await p.click('button:has-text("Dados")')
  await p.click('button:has-text("Segurança")')
  await expect(p.getByRole('region', { name: 'Acessos recentes' })).toContainText('security-log.sql')
})
