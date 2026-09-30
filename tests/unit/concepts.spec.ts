import { expect, test } from '@playwright/test'
import { CONCEPTS, GROUP_LABEL, conceptById, searchConcepts, type ConceptCtx } from '../../src/concepts'
import { DEFAULT_PARAMS, DEFAULT_RATES } from '../../src/invest'
import { brl } from '../../src/lib'

const ctx: ConceptCtx = { rates: DEFAULT_RATES, params: DEFAULT_PARAMS, updated: '', reserve: { target: 18000, months: 6, monthlyExpense: 3000, saved: 9000 } }

test('o glossário é consistente: ids únicos, temas conhecidos, textos e ligações válidas', () => {
  const ids = CONCEPTS.map((c) => c.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(CONCEPTS.length).toBeGreaterThanOrEqual(20)
  for (const c of CONCEPTS) {
    expect(Object.keys(GROUP_LABEL), c.id).toContain(c.group)
    expect(c.title.length, c.id).toBeGreaterThan(2)
    expect(c.short.endsWith('.') || c.short.endsWith('?'), `${c.id}: frase completa`).toBe(true)
    expect(c.body.length, c.id).toBeGreaterThan(0)
    for (const r of c.related ?? []) expect(conceptById(r), `${c.id} → ${r}`).toBeTruthy()
    if (c.action) expect(['simulator', 'reserve']).toContain(c.action.to)
  }
  // os conceitos que o simulador aponta existem
  for (const id of ['selic', 'cdi', 'ipca', 'ir-regressivo', 'poupanca', 'cdb', 'lci-lca', 'tesouro-selic', 'tesouro-ipca']) expect(conceptById(id), id).toBeTruthy()
})

test('os exemplos usam as taxas do usuário e nunca mostram NaN nem undefined', () => {
  for (const c of CONCEPTS) {
    if (!c.example) continue
    const t = c.example(ctx)
    expect(t.length, c.id).toBeGreaterThan(10)
    expect(t, c.id).not.toMatch(/NaN|undefined|Infinity/)
  }
  expect(conceptById('juros-compostos')!.example!(ctx)).toContain(brl(1000 * Math.pow(1 + DEFAULT_RATES.cdi / 100, 10)))
  expect(conceptById('juros-compostos')!.example!(ctx)).toContain(brl(1000 * (1 + (DEFAULT_RATES.cdi / 100) * 10))) // simples
  expect(conceptById('selic')!.example!({ ...ctx, rates: { ...ctx.rates, selic: 10 }, updated: '29/09/2026' })).toMatch(/10,00% ao ano \(Banco Central, 29\/09\/2026\)/)
  expect(conceptById('selic')!.example!(ctx)).toContain('valor de exemplo')
  expect(conceptById('reserva-emergencia')!.example!(ctx)).toMatch(/6 meses de .*3\.000,00.* meta de .*18\.000,00/)
  expect(conceptById('reserva-emergencia')!.example!({ ...ctx, reserve: { target: 0, months: 6, monthlyExpense: 0, saved: 0 } })).toContain('Quando houver despesas')
  expect(conceptById('ir-regressivo')!.example!(ctx)).toContain('225,00') // 22,5% de R$ 1.000
  // Selic alta: a poupança rende 0,5% ao mês
  expect(conceptById('poupanca')!.example!(ctx)).toMatch(/cerca de 6,17% ao ano/)
})

test('busca ignora acento e caixa, exige todas as palavras e olha título, resumo, texto e palavras-chave', () => {
  const ids = (q: string) => searchConcepts(CONCEPTS, q).map((c) => c.id)
  expect(ids('cdi')).toContain('cdi')
  expect(ids('POUPANCA')).toContain('poupanca')
  expect(ids('inflação')).toContain('inflacao')
  expect(ids('liquidez diaria')).toContain('liquidez')
  expect(ids('copom')).toContain('selic') // palavra-chave
  expect(ids('regra dos 72')).toEqual(['juros-compostos'])
  expect(ids('')).toHaveLength(CONCEPTS.length)
  expect(ids('poupanca')[0]).toBe('poupanca') // o título vem antes de quem só cita a palavra no texto
  expect(ids('cdi')[0]).toBe('cdi')
  expect(ids('xyzxyz')).toEqual([])
  expect(ids('fgc poupanca').length).toBeGreaterThan(0)
  expect(ids('fgc zzzz')).toEqual([])
})
