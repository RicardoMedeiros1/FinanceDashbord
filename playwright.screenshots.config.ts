import { defineConfig } from '@playwright/test'

// Gera as imagens do README (docs/img) com dados fictícios: npm run screenshots
const executablePath = process.env.PW_CHROMIUM_PATH
const LOCAL = 'http://localhost:4173/FinanceDashbord/'
const CLOUD = 'http://localhost:4310/FinanceDashbord/'

export default defineConfig({
  testDir: 'tests/screenshots',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
  use: { viewport: { width: 1440, height: 900 }, launchOptions: executablePath ? { executablePath } : {} },
  projects: [
    { name: 'local', testMatch: /local\.spec\.ts/, use: { baseURL: LOCAL } },
    { name: 'cloud', testMatch: /cloud\.spec\.ts/, use: { baseURL: CLOUD } },
    { name: 'hero', testMatch: /hero\.spec\.ts/ }, // depois dos outros: usa as capturas prontas
  ],
  webServer: [
    { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: LOCAL, reuseExistingServer: true, timeout: 180_000 },
    {
      command: 'VITE_CLOUD=fake VITE_FAKE_URL=http://localhost:4300 npx vite build --outDir dist-test --emptyOutDir && npx vite preview --outDir dist-test --port 4310 --strictPort',
      url: CLOUD,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
