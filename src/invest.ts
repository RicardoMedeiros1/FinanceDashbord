// Simulador de investimentos (educativo): compara produtos de renda fixa com imposto, inflação e aportes mensais.
// Funções puras; as taxas vêm do usuário (ou do Banco Central) e nada aqui é recomendação de investimento.

export interface Rates {
  selic: number // % ao ano
  cdi: number // % ao ano
  ipca: number // % ao ano (acumulado em 12 meses)
}

/** Valores de exemplo (Selic de set/2026); o usuário atualiza pelo Banco Central ou à mão. */
export const DEFAULT_RATES: Rates = { selic: 13.75, cdi: 13.65, ipca: 4.5 }

export interface ProductParams {
  cdbLiquidez: number // % do CDI
  cdbPrazo: number // % do CDI
  lci: number // % do CDI
  ipcaReal: number // juro real do Tesouro IPCA+, % ao ano
}
export const DEFAULT_PARAMS: ProductParams = { cdbLiquidez: 100, cdbPrazo: 110, lci: 90, ipcaReal: 6 }

export type ProductId = 'poupanca' | 'cdb_liquidez' | 'cdb_prazo' | 'lci' | 'tesouro_selic' | 'tesouro_ipca'

export interface Product {
  id: ProductId
  name: string
  monthly: number // rendimento bruto por mês (fração)
  taxed: boolean // paga IR regressivo
  liquidity: string
  risk: string
  fgc: string
  color: string
}

/** Imposto de renda regressivo da renda fixa, pelo tempo que cada aporte ficou investido (dias). */
export const irRate = (days: number) => (days <= 180 ? 0.225 : days <= 360 ? 0.2 : days <= 720 ? 0.175 : 0.15)

const BUSINESS_DAYS_MONTH = 21
const pct = (n: number) => n / 100

/** CDI/Selic em % ao ano → rendimento mensal de quem recebe `share` (fração) do CDI, pelos dias úteis. */
const cdiMonthly = (annualPct: number, share: number) => {
  const daily = Math.pow(1 + pct(annualPct), 1 / 252) - 1
  return Math.pow(1 + daily * share, BUSINESS_DAYS_MONTH) - 1
}

export function buildProducts(r: Rates, p: ProductParams): Product[] {
  const annualToMonthly = (a: number) => Math.pow(1 + a, 1 / 12) - 1
  return [
    {
      id: 'poupanca',
      name: 'Poupança',
      // regra: Selic acima de 8,5% ao ano → 0,5% ao mês (+TR, que está perto de zero); senão 70% da Selic
      monthly: r.selic > 8.5 ? 0.005 : 0.7 * annualToMonthly(pct(r.selic)),
      taxed: false,
      liquidity: 'Diária',
      risk: 'Baixo',
      fgc: 'Sim',
      color: '#94a3b8',
    },
    { id: 'cdb_liquidez', name: `CDB liquidez diária (${p.cdbLiquidez}% do CDI)`, monthly: cdiMonthly(r.cdi, pct(p.cdbLiquidez)), taxed: true, liquidity: 'Diária', risk: 'Baixo (depende do banco)', fgc: 'Sim', color: '#3b6ef5' },
    { id: 'cdb_prazo', name: `CDB com prazo (${p.cdbPrazo}% do CDI)`, monthly: cdiMonthly(r.cdi, pct(p.cdbPrazo)), taxed: true, liquidity: 'No vencimento', risk: 'Baixo (depende do banco)', fgc: 'Sim', color: '#8b3ff5' },
    { id: 'lci', name: `LCI/LCA (${p.lci}% do CDI, isenta de IR)`, monthly: cdiMonthly(r.cdi, pct(p.lci)), taxed: false, liquidity: 'Com carência', risk: 'Baixo (depende do banco)', fgc: 'Sim', color: '#3ecf6e' },
    { id: 'tesouro_selic', name: 'Tesouro Selic', monthly: cdiMonthly(r.selic, 1), taxed: true, liquidity: 'Diária (D+1)', risk: 'Muito baixo (governo federal)', fgc: 'Não (garantia do governo)', color: '#e0600f' },
    {
      id: 'tesouro_ipca',
      name: `Tesouro IPCA+ (IPCA + ${p.ipcaReal}%)`,
      monthly: annualToMonthly((1 + pct(r.ipca)) * (1 + pct(p.ipcaReal)) - 1),
      taxed: true,
      liquidity: 'Diária, mas o preço varia',
      risk: 'Médio se vender antes do vencimento',
      fgc: 'Não (garantia do governo)',
      color: '#f472b6',
    },
  ]
}

export interface SimInput {
  initial: number
  monthly: number // aporte no fim de cada mês
  months: number
}

export interface SimPoint {
  month: number
  invested: number
  net: number // o que sobraria se resgatasse neste mês, já sem imposto
}

export interface SimResult {
  invested: number
  gross: number
  tax: number
  net: number
  gain: number // rendimento líquido
  real: number // líquido final em poder de compra de hoje (descontada a inflação)
  annualNet: number // taxa líquida equivalente ao ano (%), sobre o total investido ao longo do tempo
  series: SimPoint[]
}

/** Valor de todos os aportes se resgatasse no mês `t`: cada aporte rende pelo tempo que ficou e paga o IR da sua faixa. */
function valueAt(prod: Product, input: SimInput, t: number): { gross: number; tax: number } {
  let gross = 0
  let tax = 0
  const lot = (amount: number, age: number) => {
    const g = amount * Math.pow(1 + prod.monthly, age)
    gross += g
    if (prod.taxed) tax += Math.max(0, g - amount) * irRate(age * 30)
  }
  if (input.initial > 0) lot(input.initial, t)
  if (input.monthly > 0) for (let k = 1; k <= t; k++) lot(input.monthly, t - k) // o aporte do mês t entra no fim dele, sem render
  return { gross, tax }
}

export function simulate(prod: Product, input: SimInput, ipca: number): SimResult {
  const months = Math.max(0, Math.round(input.months))
  const series: SimPoint[] = []
  for (let t = 0; t <= months; t++) {
    const v = valueAt(prod, input, t)
    series.push({ month: t, invested: input.initial + input.monthly * t, net: v.gross - v.tax })
  }
  const end = valueAt(prod, input, months)
  const invested = input.initial + input.monthly * months
  const net = end.gross - end.tax
  const real = net / Math.pow(1 + pct(ipca), months / 12)
  // taxa equivalente ao ano: só faz sentido comparar de forma direta sem aportes; com aportes usa o tempo médio
  const avgYears = input.initial + input.monthly * months > 0 ? (input.initial * months + input.monthly * ((months - 1) * months) / 2) / (invested || 1) / 12 : 0
  const annualNet = invested > 0 && avgYears > 0 ? (Math.pow(net / invested, 1 / avgYears) - 1) * 100 : 0
  return { invested, gross: end.gross, tax: end.tax, net, gain: net - invested, real, annualNet, series }
}

/** Busca Selic, CDI e IPCA (12 meses) na API pública do Banco Central. */
export async function fetchRates(fetchFn: typeof fetch = fetch, base = 'https://api.bcb.gov.br'): Promise<Rates & { date: string }> {
  const one = async (code: number) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const r = await fetchFn(`${base}/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`, { signal: ctrl.signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = (await r.json()) as Array<{ data: string; valor: string }>
      const v = Number(String(j?.[0]?.valor).replace(',', '.'))
      if (!Number.isFinite(v) || v <= 0 || v > 100) throw new Error('valor inválido')
      return { v, date: j[0].data }
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    const [selic, cdi, ipca] = await Promise.all([one(432), one(4389), one(13522)])
    return { selic: selic.v, cdi: cdi.v, ipca: ipca.v, date: selic.date }
  } catch {
    throw new Error('Não foi possível buscar as taxas no Banco Central agora. Digite os valores à mão.')
  }
}

/** "10.000,50", "10000", "1.000" e "12,5" → número; vazio ou inválido → 0. */
export function parseNumber(s: string): number {
  const t = s.trim().replace(/[R$\s]/g, '')
  if (!t) return 0
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, '')) : Number(t)
  return Number.isFinite(n) && n > 0 ? n : 0
}
