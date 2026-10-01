// Dados 100% fictícios para as capturas de tela do README (pessoa, bancos, lojas e valores inventados).
// Tudo é determinístico: o mesmo resultado a cada execução.

export const PERSONA = { name: 'Marina', email: 'marina.alves@exemplo.com' }

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

export function buildSeed() {
  const r = rng(2026)
  const between = (a: number, b: number) => Math.round((a + r() * (b - a)) * 100) / 100
  const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)]

  const ACC = 'conta-aurora'
  const SAV = 'reserva-aurora'
  const GOLD = 'cartao-gold'
  const HORIZONTE = 'cartao-horizonte'

  const txs: Array<Record<string, unknown>> = []
  let n = 0
  const add = (date: string, description: string, amount: number, category: string, extra: Record<string, unknown> = {}) =>
    txs.push({ id: `t${++n}`, date, description, amount, type: 'expense', category, accountId: ACC, ...extra })
  const income = (date: string, description: string, amount: number, category: string) =>
    txs.push({ id: `t${++n}`, date, description, amount, type: 'income', category, accountId: ACC })

  // abril a setembro de 2026 (o relógio das capturas é 29/09/2026)
  for (let m = 4; m <= 9; m++) {
    const last = m === 9 ? 29 : 28
    const ok = (d: number) => d <= last
    const day = (a: number, b: number) => Math.min(last, a + Math.floor(r() * (b - a + 1)))

    for (const d of [3, 10, 17, 24]) if (ok(d)) add(iso(2026, m, d), 'Mercado Central', between(170, 340), 'alimentacao')
    for (let i = 0; i < 5; i++) add(iso(2026, m, day(2, 27)), 'Padaria Pão Quente', between(11, 38), 'alimentacao')
    for (const d of [day(4, 12), day(18, 26)]) add(iso(2026, m, d), 'Posto Estrela', between(190, 245), 'transporte')
    add(iso(2026, m, day(5, 25)), 'Farmácia Vida', between(42, 135), 'saude')
    add(iso(2026, m, day(6, 26)), 'Cantina Bella', between(72, 148), 'alimentacao', { accountId: undefined, cardId: GOLD })
    add(iso(2026, m, day(8, 27)), 'Cantina Bella', between(60, 110), 'alimentacao', { accountId: undefined, cardId: GOLD })
    add(iso(2026, m, day(9, 25)), 'Cinema Lumière', between(48, 72), 'lazer', { accountId: undefined, cardId: GOLD })
    add(iso(2026, m, day(3, 26)), 'ShopFácil', between(95, 430), 'compras', { accountId: undefined, cardId: pick([GOLD, HORIZONTE]) })
    if (m % 2 === 0) add(iso(2026, m, day(10, 24)), 'ShopFácil', between(60, 260), 'compras', { accountId: undefined, cardId: HORIZONTE })
    add(iso(2026, m, 12), 'Luz Brasil', between(138, 192), 'moradia')
    add(iso(2026, m, 15), 'FibraNet Internet', 99.9, 'moradia')
    add(iso(2026, m, 8), 'Condomínio Jardim das Palmeiras', 420, 'moradia')
    add(iso(2026, m, 14), 'Licença de software de design', 59.9, 'trabalho', { accountId: undefined, cardId: GOLD })
    if (ok(11)) income(iso(2026, m, 11), 'Projeto Estúdio Lume', between(1400, 2400), 'variavel')
    if (m % 2 === 1 && ok(22)) income(iso(2026, m, 22), 'Projeto Casa Verde', between(700, 1300), 'variavel')
  }

  // uma cobrança que parece repetida (dispara um alerta na visão geral)
  add('2026-09-27', 'Ótica Visão', 289, 'saude', { accountId: undefined, cardId: GOLD })
  add('2026-09-28', 'Ótica Visão', 289, 'saude', { accountId: undefined, cardId: GOLD })

  return {
    'fd:profile': [
      {
        id: 'me',
        name: PERSONA.name,
        onboardingHidden: true,
        groups: [
          { id: 'g-padaria', name: 'Padaria', terms: 'padaria, panificadora, padoca', limit: 120 },
          { id: 'g-mercado', name: 'Supermercado', terms: 'mercado central', limit: 1100 },
          { id: 'g-delivery', name: 'Restaurantes', terms: 'cantina', limit: 400 },
        ],
      },
    ],
    'fd:accounts': [
      { id: ACC, name: 'Conta Aurora', kind: 'checking', openingBalance: 3200, openingDate: '2026-04-01', color: '#3b6ef5' },
      { id: SAV, name: 'Reserva Aurora', kind: 'savings', openingBalance: 9000, openingDate: '2026-04-01', color: '#3ecf6e' },
    ],
    'fd:cards': [
      { id: GOLD, name: 'Aurora Gold', closingDay: 20, dueDay: 28, limit: 9000, color: '#e0600f' },
      { id: HORIZONTE, name: 'Horizonte Platinum', closingDay: 5, dueDay: 12, limit: 4500, color: '#8b3ff5' },
    ],
    'fd:txs': txs,
    // o app gera sozinho as ocorrências desde a data inicial (como no uso real)
    'fd:rules': [
      { id: 'r-salario', description: 'Salário — Agência Lume', amount: 6500, type: 'income', category: 'salario', cycle: 'monthly', anchor: '2026-04-05', generated: 0, active: true, accountId: ACC },
      { id: 'r-aluguel', description: 'Aluguel', amount: 1850, type: 'expense', category: 'moradia', cycle: 'monthly', anchor: '2026-04-01', generated: 0, active: true, accountId: ACC },
    ],
    'fd:subs': [
      { id: 's-stream', name: 'StreamMax', price: 39.9, cycle: 'monthly', billingDate: '2026-04-09', color: '#e84a45', active: true, category: 'assinaturas', chargedUntil: '2026-03-31', cardId: GOLD },
      { id: 's-music', name: 'MusicFlow', price: 21.9, cycle: 'monthly', billingDate: '2026-04-14', color: '#3ecf6e', active: true, category: 'assinaturas', chargedUntil: '2026-03-31', cardId: GOLD },
      { id: 's-cloud', name: 'CloudBox 200GB', price: 12.99, cycle: 'monthly', billingDate: '2026-04-20', color: '#3b6ef5', active: true, category: 'assinaturas', chargedUntil: '2026-03-31', cardId: HORIZONTE },
      { id: 's-gym', name: 'Academia FitLife', price: 119.9, cycle: 'monthly', billingDate: '2026-04-03', color: '#e0600f', active: true, category: 'saude', chargedUntil: '2026-03-31', accountId: ACC },
      { id: 's-course', name: 'Escola Código Online', price: 89.9, cycle: 'monthly', billingDate: '2026-04-18', color: '#8b3ff5', active: true, category: 'educacao', chargedUntil: '2026-03-31', cardId: HORIZONTE },
      { id: 's-seguro', name: 'Seguro Viva Mais', price: 1188, cycle: 'yearly', billingDate: '2026-11-22', color: '#22d3ee', active: true, category: 'saude', chargedUntil: '2026-09-29', accountId: ACC },
    ],
    'fd:installments': [
      { id: 'i-notebook', name: 'Notebook Tecno+ 14"', lender: 'Loja Tecno+ (cartão)', amount: 389.9, count: 10, purchaseDate: '2026-07-04', firstDate: '2026-07-10', color: '#3b6ef5', category: 'compras', generated: 0, cardId: GOLD },
      { id: 'i-sofa', name: 'Sofá retrátil', lender: 'Casa&Estilo', amount: 295, count: 6, purchaseDate: '2026-05-28', firstDate: '2026-06-05', color: '#e0600f', category: 'moradia', generated: 0, accountId: ACC },
      { id: 'i-amigo', name: 'Celular do Pedro', lender: 'Pedro (cartão dele)', amount: 210, count: 8, purchaseDate: '2026-08-12', firstDate: '2026-09-12', color: '#8b3ff5', category: 'compras', generated: 0 },
    ],
    'fd:transfers': [4, 5, 6, 7, 8, 9].map((m) => ({ id: `tr${m}`, date: iso(2026, m, 6), from: ACC, to: SAV, amount: 2000, note: 'Guardar do mês', kind: 'transfer' })),
    'fd:budgets': [
      { category: 'moradia', limit: 2800 },
      { category: 'alimentacao', limit: 1500 },
      { category: 'transporte', limit: 520 },
      { category: 'lazer', limit: 320 },
      { category: 'compras', limit: 650 },
      { category: 'saude', limit: 300 },
    ],
    'fd:goals': [
      { id: 'g-viagem', name: 'Viagem à Patagônia', target: 18000, saved: 7200, color: '#3b6ef5', deadline: '2027-03-31', createdAt: '2026-04-10' },
      { id: 'g-note', name: 'Mesa digitalizadora', target: 3200, saved: 2650, color: '#e0600f', deadline: '2026-12-15', createdAt: '2026-06-01' },
      { id: 'g-curso', name: 'Curso de fotografia', target: 2400, saved: 600, color: '#8b3ff5', deadline: '2027-01-31', createdAt: '2026-08-20' },
    ],
  }
}

/** Extrato fictício em OFX para a tela de importação. */
export const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
${[
  ['20260927', -42.5, 'Padaria Pão Quente'],
  ['20260926', -318.4, 'Mercado Central'],
  ['20260925', -89.9, 'Escola Código Online'],
  ['20260924', 1650, 'Projeto Estúdio Lume'],
  ['20260923', -212.0, 'Posto Estrela'],
  ['20260922', -64.9, 'Farmácia Vida'],
  ['20260921', -119.9, 'Academia FitLife'],
  ['20260920', -58.0, 'Cinema Lumière'],
]
  .map(([d, v, t], i) => `<STMTTRN><TRNTYPE>OTHER<DTPOSTED>${d}<TRNAMT>${v}<FITID>aurora${i}<MEMO>${t}</STMTTRN>`)
  .join('\n')}
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
