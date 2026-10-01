import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serve o projeto em /<nome-do-repo>/. Sobrescreva com BASE_PATH se usar outro host.
const base = process.env.BASE_PATH ?? '/FinanceDashbord/'

/**
 * Política de segurança de conteúdo (CSP) no build: o app só carrega código e fala com quem precisa.
 * (No GitHub Pages não dá para mandar cabeçalhos HTTP, então vai numa tag <meta>.)
 * Quem for sempre permitido: o próprio app, o seu Supabase e a API pública do Banco Central (taxas do simulador).
 */
function csp(mode: string): Plugin {
  return {
    name: 'finn-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const origins = new Set<string>()
      for (const raw of [env.VITE_SUPABASE_URL, env.VITE_CLOUD === 'fake' ? env.VITE_FAKE_URL : '']) {
        try {
          if (raw) origins.add(new URL(raw.includes('://') ? raw : `https://${raw}`).origin)
        } catch {
          /* ignora valor inválido */
        }
      }
      const hosts = [...origins]
      const ws = hosts.filter((o) => o.startsWith('https:')).map((o) => o.replace('https:', 'wss:'))
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: ${hosts.join(' ')}`.trim(),
        "font-src 'self' data:",
        `connect-src 'self' ${[...hosts, ...ws, 'https://api.bcb.gov.br'].join(' ')}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base,
  plugins: [
    react(),
    csp(mode),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Finn – Finanças pessoais',
        short_name: 'Finn',
        description: 'Controle seus gastos, assinaturas e orçamentos.',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0b0b0b',
        theme_color: '#0b0b0b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
}))
