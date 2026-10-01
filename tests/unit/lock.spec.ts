import { expect, test } from '@playwright/test'

// o módulo usa localStorage: um simulador mínimo para rodar fora do navegador
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
const lock = await import('../../src/lock')

test.beforeEach(() => store.clear())

test('o PIN nunca é guardado: só um hash com sal, diferente a cada vez', async () => {
  await lock.setPin('482915', 5)
  const raw = store.get(lock.LOCK_KEY)!
  expect(raw).not.toContain('482915')
  const a = JSON.parse(raw)
  expect(a.salt.length).toBeGreaterThan(10)
  expect(a.hash.length).toBeGreaterThan(30)
  expect([a.timeout, a.fails, a.lockedUntil, a.iterations]).toEqual([5, 0, 0, 150000])
  await lock.setPin('482915', 5) // mesmo PIN, outro sal, outro hash
  const b = JSON.parse(store.get(lock.LOCK_KEY)!)
  expect(b.salt).not.toBe(a.salt)
  expect(b.hash).not.toBe(a.hash)
})

test('confere o PIN, conta erros e zera ao acertar', async () => {
  await lock.setPin('482915', 1)
  const t = 1_000_000
  expect(await lock.verifyPin('482915', t)).toEqual({ ok: true })
  expect(await lock.verifyPin('111111', t)).toMatchObject({ ok: false, fails: 1, lockedUntil: 0, wipe: false })
  expect(await lock.verifyPin('12345', t)).toMatchObject({ ok: false, fails: 2 }) // tamanho errado também é erro
  expect(await lock.verifyPin('abcdef', t)).toMatchObject({ ok: false, fails: 3, lockedUntil: t + 30_000 })
  expect(JSON.parse(store.get(lock.LOCK_KEY)!)).toMatchObject({ fails: 3, lockedUntil: t + 30_000 })
  // na espera nem confere (nem a senha certa)
  expect(await lock.verifyPin('482915', t + 1000)).toEqual({ ok: false, waiting: true, lockedUntil: t + 30_000 })
  // passada a espera, o PIN certo entra e zera a contagem
  expect(await lock.verifyPin('482915', t + 31_000)).toEqual({ ok: true })
  expect(JSON.parse(store.get(lock.LOCK_KEY)!)).toMatchObject({ fails: 0, lockedUntil: 0 })
})

test('as esperas crescem com os erros seguidos e o décimo erro pede para apagar', async () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => lock.delayAfter(n) / 1000)).toEqual([0, 0, 0, 30, 60, 300, 300, 900, 900, 3600, 3600])
  await lock.setPin('482915', 5)
  let t = 1_000_000
  let last: any
  for (let i = 1; i <= lock.MAX_FAILS; i++) {
    last = await lock.verifyPin('000001', t)
    t = (last.lockedUntil || t) + 1000 // espera o tempo de bloqueio
  }
  expect(last).toMatchObject({ ok: false, fails: 10, wipe: true })
})

test('PINs fáceis demais são recusados', () => {
  for (const p of ['000000', '111111', '123456', '654321', '012345', '121212', '123123', '987654']) expect(lock.weakPin(p), p).toBe(true)
  for (const p of ['482915', '135792', '908172']) expect(lock.weakPin(p), p).toBe(false)
  expect(lock.validPin('482915')).toBe(true)
  expect([lock.validPin('48291'), lock.validPin('4829155'), lock.validPin('48291a'), lock.validPin('')]).toEqual([false, false, false, false])
  return expect(lock.setPin('1234', 5)).rejects.toThrow('6 dígitos')
})

test('tempo para bloquear fora do app', () => {
  expect([lock.shouldLock(0, 0), lock.shouldLock(1, 0)]).toEqual([true, true]) // "ao sair do app"
  expect([lock.shouldLock(59_000, 1), lock.shouldLock(60_000, 1)]).toEqual([false, true])
  expect(lock.shouldLock(14 * 60_000, 15)).toBe(false)
  expect(lock.shouldLock(15 * 60_000, 15)).toBe(true)
})

test('sem PIN configurado nada trava', async () => {
  expect(lock.readLock()).toBeNull()
  expect(await lock.verifyPin('qualquer')).toEqual({ ok: true })
  store.set(lock.LOCK_KEY, 'lixo{') // dado corrompido não derruba
  expect(lock.readLock()).toBeNull()
})
