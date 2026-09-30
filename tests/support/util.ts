import type { Browser, BrowserContext, Page } from '@playwright/test'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Espera uma condição (assíncrona) ficar verdadeira. */
export async function until(fn: () => unknown | Promise<unknown>, what: string, ms = 12000) {
  const t = Date.now()
  while (Date.now() - t < ms) {
    try {
      if (await fn()) return
    } catch {
      /* tenta de novo */
    }
    await sleep(150)
  }
  throw new Error(`timeout: ${what}`)
}

/** Data fixa dos testes: os resultados não dependem do dia em que rodam. */
export const FIXED_NOW = '2026-09-29T12:00:00'

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

export interface Device {
  ctx: BrowserContext
  p: Page & { ls: (k: string) => Promise<any>; errors: string[] }
}

/**
 * Um "aparelho": contexto isolado (localStorage próprio) com o relógio fixo.
 * `click` espera um instante para a interface assentar (o roteamento por URL é assíncrono).
 */
export async function device(
  browser: Browser,
  baseURL: string | undefined,
  opts: { time?: string; viewport?: { width: number; height: number }; init?: () => void } = {},
): Promise<Device> {
  const ctx = await browser.newContext({ baseURL, viewport: opts.viewport ?? { width: 1360, height: 900 }, acceptDownloads: true })
  await ctx.clock.install({ time: new Date(opts.time ?? FIXED_NOW) })
  if (opts.init) await ctx.addInitScript(opts.init)
  const p = (await ctx.newPage()) as Device['p']
  p.errors = []
  p.on('pageerror', (e) => p.errors.push(e.message))
  p.on('dialog', (d) => void d.accept())
  const click = p.click.bind(p)
  p.click = (async (...a: Parameters<Page['click']>) => {
    const r = await click(...a)
    await sleep(150)
    return r
  }) as Page['click']
  p.ls = (k: string) => p.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), k)
  return { ctx, p }
}

/** Texto sem espaços não separáveis (o "R$ 1,00" usa NBSP). */
export const norm = (t: string | null | undefined) => (t ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ')
