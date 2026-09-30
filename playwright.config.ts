import { defineConfig } from '@playwright/test'

// Em ambientes onde o Chromium já vem instalado (ex.: sessões em nuvem), aponte para ele:
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test
const executablePath = process.env.PW_CHROMIUM_PATH

const LOCAL = 'http://localhost:4173/FinanceDashbord/'
const CLOUD = 'http://localhost:4310/FinanceDashbord/'

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  workers: 1, // os testes de nuvem compartilham a porta do servidor falso
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    viewport: { width: 1360, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'unit', testDir: 'tests/unit' },
    { name: 'local', testDir: 'tests/local', use: { baseURL: LOCAL } },
    { name: 'cloud', testDir: 'tests/cloud', use: { baseURL: CLOUD } },
  ],
  webServer: [
    {
      // build normal, sem nuvem: o app roda só local
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: LOCAL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // build de teste com o servidor falso de nuvem (nunca vai para produção)
      command: 'VITE_CLOUD=fake VITE_FAKE_URL=http://localhost:4300 npx vite build --outDir dist-test --emptyOutDir && npx vite preview --outDir dist-test --port 4310 --strictPort',
      url: CLOUD,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
