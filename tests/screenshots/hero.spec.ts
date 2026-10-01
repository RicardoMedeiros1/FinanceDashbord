import { test } from '@playwright/test'
import fs from 'node:fs'

// Monta a imagem de capa do README (docs/img/hero.png) com as capturas já geradas.
const b64 = (f: string) => `data:image/png;base64,${fs.readFileSync(`docs/img/${f}.png`).toString('base64')}`

test('imagem de capa', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:1600px;height:900px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#f5f5f5;
      background:radial-gradient(1200px 700px at 85% -10%,rgba(224,96,15,.35),transparent 60%),radial-gradient(900px 600px at -10% 110%,rgba(139,63,245,.28),transparent 60%),#0b0b0b}
    .copy{position:absolute;left:84px;top:120px;width:520px}
    .logo{display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px;margin-bottom:34px}
    .mark{width:46px;height:46px;border-radius:50%;background:linear-gradient(90deg,#fff 50%,#e0600f 50%)}
    h1{font-size:60px;line-height:1.04;letter-spacing:-.03em;margin-bottom:22px}
    h1 span{color:#e0600f}
    p{font-size:21px;line-height:1.5;color:#b9b9b9;margin-bottom:30px}
    .chips{display:flex;flex-wrap:wrap;gap:10px}
    .chips b{font-weight:500;font-size:16px;padding:9px 15px;border:1px solid #333;border-radius:99px;background:#161616;color:#ddd}
    .win{position:absolute;left:600px;top:110px;width:800px;border-radius:16px;overflow:hidden;border:1px solid #2c2c2c;box-shadow:0 40px 90px rgba(0,0,0,.6);background:#111}
    .bar{height:32px;background:#1a1a1a;display:flex;align-items:center;gap:8px;padding:0 14px}
    .bar i{width:11px;height:11px;border-radius:50%;background:#444;display:block}
    .win img{display:block;width:800px;height:520px;object-fit:cover;object-position:top}
    .ph{position:absolute;left:1290px;top:300px;width:236px;height:520px;border-radius:36px;border:7px solid #232323;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.7);background:#000}
    .ph img{display:block;width:100%}
  </style></head><body>
    <div class="copy">
      <div class="logo"><span class="mark"></span>Finn</div>
      <h1>Suas finanças,<br><span>claras e seguras.</span></h1>
      <p>Gastos, cartões, contas, metas e investimentos num só lugar. Funciona offline, instala no celular e protege seus dados com verificação em duas etapas.</p>
      <div class="chips"><b>PWA</b><b>Open Finance</b><b>Verificação em 2 etapas</b><b>Simulador de investimentos</b></div>
    </div>
    <div class="win"><div class="bar"><i></i><i></i><i></i></div><img src="${b64('overview')}"></div>
    <div class="ph"><img src="${b64('mobile-overview')}"></div>
  </body></html>`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'docs/img/hero.png' })
  await page.close()
})
