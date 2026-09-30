import { expect, test as base } from '@playwright/test'

/**
 * `test` com limpeza automática: fecha os contextos ("aparelhos") criados em cada teste.
 * Sem isso, páginas de um teste continuam sincronizando com o servidor falso do teste seguinte.
 */
export const test = base.extend<{ closeDevices: void }>({
  closeDevices: [
    async ({ browser }, use) => {
      await use()
      for (const ctx of browser.contexts()) await ctx.close()
    },
    { auto: true },
  ],
})

export { expect }
