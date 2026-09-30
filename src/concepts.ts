// Glossário educativo de investimentos. Texto geral (não é recomendação); os exemplos usam as taxas do usuário.
import { normDesc } from './importer'
import { buildProducts, irRate, type ProductParams, type Rates } from './invest'
import { brl } from './lib'

export type Group = 'basico' | 'taxas' | 'produtos' | 'risco' | 'impostos'
export const GROUP_LABEL: Record<Group, string> = { basico: 'Básico', taxas: 'Taxas e índices', produtos: 'Produtos', risco: 'Risco e proteção', impostos: 'Impostos' }

export interface ConceptCtx {
  rates: Rates
  params: ProductParams
  updated: string
  reserve?: { target: number; months: number; monthlyExpense: number; saved: number }
}

export interface Concept {
  id: string
  group: Group
  title: string
  short: string // em uma frase
  body: string[]
  example?: (c: ConceptCtx) => string
  tool?: 'compound' | 'inflation'
  action?: { label: string; to: 'simulator' | 'reserve' }
  related?: string[]
  keywords?: string // palavras extras para a busca
}

const pct = (n: number, d = 2) => `${n.toFixed(d).replace('.', ',')}%`
/** Taxa anual equivalente de um rendimento mensal. */
const annual = (monthly: number) => (Math.pow(1 + monthly, 12) - 1) * 100
const source = (c: ConceptCtx) => (c.updated ? `Banco Central, ${c.updated}` : 'valor de exemplo; atualize no simulador')

export const CONCEPTS: Concept[] = [
  // ---------- básico ----------
  {
    id: 'juros-compostos',
    group: 'basico',
    title: 'Juros compostos',
    short: 'Juros sobre juros: o rendimento de cada período também passa a render.',
    body: [
      'No juro simples, você ganha sempre sobre o valor inicial. No composto, o que foi ganho entra na base do próximo período, então o crescimento acelera com o tempo.',
      'Por isso o tempo pesa tanto: dobrar o prazo faz muito mais que dobrar o resultado. E vale para dívidas também: juros compostos crescem contra você.',
      'Regra dos 72: divida 72 pela taxa anual (em %) para estimar em quantos anos o dinheiro dobra. A 12% ao ano, cerca de 6 anos.',
    ],
    example: (c) => `R$ 1.000 a ${pct(c.rates.cdi)} ao ano por 10 anos viram ${brl(1000 * Math.pow(1 + c.rates.cdi / 100, 10))} com juros compostos; com juros simples seriam ${brl(1000 * (1 + (c.rates.cdi / 100) * 10))}. (Antes do imposto.)`,
    tool: 'compound',
    action: { label: 'Simular com aportes mensais', to: 'simulator' },
    related: ['inflacao', 'cdi'],
    keywords: 'juro sobre juro regra dos 72 capitalização',
  },
  {
    id: 'inflacao',
    group: 'basico',
    title: 'Inflação e poder de compra',
    short: 'A alta geral dos preços: com o tempo, o mesmo dinheiro compra menos.',
    body: [
      'Se os preços sobem 5% em um ano, R$ 100 parados compram o que R$ 95 comprariam. Dinheiro sem render perde poder de compra todo ano.',
      'Por isso olhar só para quanto um investimento rende não basta: o que importa é quanto ele rende acima da inflação (rentabilidade real).',
    ],
    example: (c) => `Com inflação de ${pct(c.rates.ipca)} ao ano, R$ 1.000 de hoje equivalem a ${brl(1000 / (1 + c.rates.ipca / 100))} em poder de compra daqui a 1 ano, e a ${brl(1000 / Math.pow(1 + c.rates.ipca / 100, 10))} daqui a 10 anos se ficarem sem render.`,
    tool: 'inflation',
    related: ['ipca', 'rentabilidade-real'],
    keywords: 'preços alta dos preços poder aquisitivo',
  },
  {
    id: 'rentabilidade-real',
    group: 'basico',
    title: 'Rentabilidade real',
    short: 'O rendimento depois de descontar a inflação.',
    body: [
      'Rentabilidade nominal é o que o investimento rende "no papel". A real desconta a inflação: (1 + nominal) ÷ (1 + inflação) − 1.',
      'Se rende 10% e a inflação é 4%, você ganhou cerca de 5,8% de poder de compra, não 10%. Se a inflação for maior que o rendimento, você perde poder de compra mesmo vendo o saldo crescer.',
    ],
    example: (c) => {
      const cdb = buildProducts(c.rates, c.params).find((p) => p.id === 'cdb_liquidez')!
      const nominal = annual(cdb.monthly)
      const real = ((1 + nominal / 100) / (1 + c.rates.ipca / 100) - 1) * 100
      return `Um CDB de ${c.params.cdbLiquidez}% do CDI rende cerca de ${pct(nominal)} ao ano antes do imposto. Com IPCA de ${pct(c.rates.ipca)}, isso é uma rentabilidade real de cerca de ${pct(real)} ao ano.`
    },
    action: { label: 'Ver "em valores de hoje" no simulador', to: 'simulator' },
    related: ['inflacao', 'ipca'],
  },
  {
    id: 'liquidez',
    group: 'basico',
    title: 'Liquidez',
    short: 'A rapidez com que você transforma o investimento em dinheiro, sem perder valor.',
    body: [
      'Liquidez diária significa poder resgatar quando quiser (o dinheiro cai no mesmo dia ou no dia seguinte). Outros produtos têm carência ou só pagam tudo no vencimento.',
      'Quanto mais liquidez, em geral menos rende; quanto mais prazo você aceita travar, mais o mercado costuma pagar. Dinheiro que pode fazer falta deve ter liquidez; dinheiro que você não vai precisar tão cedo pode ter prazo.',
    ],
    related: ['reserva-emergencia', 'cdb'],
  },
  {
    id: 'reserva-emergencia',
    group: 'basico',
    title: 'Reserva de emergência',
    short: 'Dinheiro separado para imprevistos, com liquidez e baixo risco.',
    body: [
      'Serve para perda de renda, saúde, conserto urgente. Uma meta comum é de 3 a 6 meses de despesas; com renda que varia (como Uber e freelas), de 6 a 12.',
      'O objetivo não é render o máximo, é estar disponível na hora e não perder valor. Por isso costuma ficar em produtos de liquidez diária e baixo risco.',
    ],
    example: (c) =>
      c.reserve && c.reserve.target > 0
        ? `No seu caso: ${c.reserve.months} meses de ${brl(c.reserve.monthlyExpense)} dão uma meta de ${brl(c.reserve.target)}. Você já tem ${brl(c.reserve.saved)}.`
        : 'Quando houver despesas registradas, aqui aparece a sua meta calculada.',
    action: { label: 'Ver a minha reserva', to: 'reserve' },
    related: ['liquidez', 'poupanca', 'tesouro-selic'],
  },
  {
    id: 'prazo-objetivo',
    group: 'basico',
    title: 'Objetivo e prazo',
    short: 'Para que e para quando é o dinheiro define onde ele pode ficar.',
    body: [
      'Curto prazo (até 1 ou 2 anos, ou reserva): priorize liquidez e segurança. Um investimento que oscila muito pode estar em baixa justamente quando você precisar.',
      'Médio prazo (2 a 5 anos): dá para travar parte em produtos com prazo e aceitar alguma oscilação.',
      'Longo prazo (aposentadoria, por exemplo): o tempo ajuda a absorver oscilações, e é aí que entram, para quem estuda e aceita o risco, ações e fundos. É um passo avançado.',
    ],
    related: ['liquidez', 'renda-fixa-variavel', 'diversificacao'],
  },
  {
    id: 'renda-fixa-variavel',
    group: 'basico',
    title: 'Renda fixa e renda variável',
    short: 'Na fixa, a regra de remuneração é conhecida na compra; na variável, não.',
    body: [
      'Renda fixa (poupança, CDB, LCI/LCA, Tesouro) tem a forma de calcular o rendimento definida de antemão: um percentual do CDI, uma taxa prefixada ou a inflação mais um juro. "Fixa" não quer dizer que o valor nunca oscila nem que não tem risco.',
      'Renda variável (ações, fundos imobiliários etc.) não tem rendimento prometido: pode render muito ou dar prejuízo, e oscila bastante. Exige estudo e estômago para a volatilidade.',
    ],
    related: ['risco-credito', 'marcacao-mercado', 'diversificacao'],
  },

  // ---------- taxas ----------
  {
    id: 'selic',
    group: 'taxas',
    title: 'Selic',
    short: 'A taxa básica de juros do país, definida pelo Banco Central.',
    body: [
      'O Copom, do Banco Central, reúne-se cerca de 8 vezes por ano e decide a meta da Selic. Ela é a referência para os juros de toda a economia: quando sobe, financiar fica mais caro e a renda fixa tende a render mais; quando cai, o contrário.',
      'O Tesouro Selic acompanha essa taxa. O CDI, que referencia a maioria dos CDBs, anda quase colado nela.',
    ],
    example: (c) => `Selic usada no simulador: ${pct(c.rates.selic)} ao ano (${source(c)}).`,
    action: { label: 'Atualizar as taxas no simulador', to: 'simulator' },
    related: ['cdi', 'tesouro-selic', 'poupanca'],
    keywords: 'copom juros básicos taxa básica',
  },
  {
    id: 'cdi',
    group: 'taxas',
    title: 'CDI',
    short: 'A taxa dos empréstimos entre bancos; é o "termômetro" da renda fixa.',
    body: [
      'O CDI (Certificado de Depósito Interbancário) segue de perto a Selic, um pouco abaixo dela. Como referência, a maioria dos CDBs, LCIs e LCAs diz quanto paga como "% do CDI".',
      'Ler "100% do CDI" como "rende o que o CDI rende". "110% do CDI" rende 10% a mais que isso (não 10 pontos percentuais).',
    ],
    example: (c) => {
      const p = buildProducts(c.rates, c.params)
      const a = (id: string) => annual(p.find((x) => x.id === id)!.monthly)
      return `Com CDI de ${pct(c.rates.cdi)} ao ano (${source(c)}): 100% do CDI rende cerca de ${pct(a('cdb_liquidez'))} ao ano; ${c.params.cdbPrazo}% do CDI, cerca de ${pct(a('cdb_prazo'))}. Antes do imposto.`
    },
    related: ['selic', 'percentual-cdi', 'cdb'],
  },
  {
    id: 'percentual-cdi',
    group: 'taxas',
    title: '"% do CDI" — como comparar ofertas',
    short: 'Quanto maior a porcentagem, mais o produto paga, mas veja prazo, liquidez e imposto.',
    body: [
      'Um CDB de 110% do CDI parece melhor que um de 100%, mas se ele só libera o dinheiro em 2 anos e o outro tem liquidez diária, não são equivalentes.',
      'Também compare depois do imposto: uma LCI de 90% do CDI, isenta de IR, pode render mais líquido que um CDB de 100% do CDI dependendo do prazo. O simulador faz essa conta.',
    ],
    action: { label: 'Comparar no simulador', to: 'simulator' },
    related: ['cdi', 'ir-regressivo', 'lci-lca'],
  },
  {
    id: 'ipca',
    group: 'taxas',
    title: 'IPCA',
    short: 'O índice oficial de inflação do Brasil, calculado pelo IBGE.',
    body: [
      'Mede a variação de preços de uma cesta de consumo das famílias. É a referência dos títulos "IPCA+", que pagam a inflação do período mais um juro fixo.',
      'O IPCA "acumulado em 12 meses" é o número mais citado; é o que o simulador usa como inflação.',
    ],
    example: (c) => `IPCA usado no simulador: ${pct(c.rates.ipca)} em 12 meses (${source(c)}).`,
    related: ['inflacao', 'tesouro-ipca', 'rentabilidade-real'],
  },
  {
    id: 'pos-pre-hibrido',
    group: 'taxas',
    title: 'Pós-fixado, prefixado e híbrido',
    short: 'Três formas de definir quanto o título rende.',
    body: [
      'Pós-fixado: acompanha um índice (CDI, Selic). Você só sabe o rendimento total no fim; em geral, oscila pouco de preço.',
      'Prefixado: a taxa é travada na compra (ex.: 12% ao ano). Se vender antes do vencimento, o preço do título varia com os juros do mercado.',
      'Híbrido (IPCA+): inflação mais um juro fixo (ex.: IPCA + 6%). Protege o poder de compra, mas o preço também varia se vender antes.',
    ],
    related: ['marcacao-mercado', 'tesouro-ipca', 'cdb'],
    keywords: 'pré-fixado pós fixado ipca+',
  },

  // ---------- produtos ----------
  {
    id: 'poupanca',
    group: 'produtos',
    title: 'Poupança',
    short: 'A aplicação mais conhecida: simples, líquida e isenta de imposto, mas costuma render menos.',
    body: [
      'Com a Selic acima de 8,5% ao ano, rende 0,5% ao mês mais a TR (que tem ficado perto de zero). Com a Selic em 8,5% ou menos, rende 70% da Selic mais a TR.',
      'É isenta de IR para pessoa física, tem liquidez diária (com a "data de aniversário" mensal do rendimento) e é coberta pelo FGC. Em troca, em geral rende menos que CDBs e títulos do Tesouro atrelados à Selic/CDI.',
    ],
    example: (c) => {
      const p = buildProducts(c.rates, c.params)
      const poup = annual(p.find((x) => x.id === 'poupanca')!.monthly)
      const sel = annual(p.find((x) => x.id === 'tesouro_selic')!.monthly)
      return `Com a Selic em ${pct(c.rates.selic)}, a poupança rende cerca de ${pct(poup)} ao ano; o Tesouro Selic, cerca de ${pct(sel)} antes do imposto (o IR reduz esse número conforme o prazo).`
    },
    action: { label: 'Comparar com os outros', to: 'simulator' },
    related: ['selic', 'fgc', 'cdb'],
  },
  {
    id: 'cdb',
    group: 'produtos',
    title: 'CDB',
    short: 'Empréstimo que você faz a um banco em troca de juros.',
    body: [
      'O Certificado de Depósito Bancário é emitido por bancos. Pode ser pós-fixado (% do CDI), prefixado ou IPCA+. Existe com liquidez diária e com prazo (vencimento).',
      'Paga IR regressivo. Tem cobertura do FGC até o limite, mas o rendimento depende da saúde do banco: bancos menores pagam mais justamente porque oferecem mais risco.',
    ],
    example: (c) => `No simulador: CDB liquidez diária a ${c.params.cdbLiquidez}% do CDI e CDB com prazo a ${c.params.cdbPrazo}% do CDI (você pode ajustar as porcentagens).`,
    action: { label: 'Simular um CDB', to: 'simulator' },
    related: ['cdi', 'fgc', 'ir-regressivo', 'risco-credito'],
  },
  {
    id: 'lci-lca',
    group: 'produtos',
    title: 'LCI e LCA',
    short: 'Letras de crédito imobiliário e do agronegócio: parecem um CDB, mas são isentas de IR.',
    body: [
      'Bancos captam dinheiro por elas para financiar imóveis (LCI) ou o agronegócio (LCA). Para pessoa física, o rendimento é isento de imposto de renda.',
      'Costumam pagar um percentual do CDI menor que o CDB, mas sem IR o resultado líquido pode ser parecido ou maior. Têm prazo mínimo (carência) antes do resgate e cobertura do FGC.',
    ],
    example: (c) => `No simulador: LCI/LCA a ${c.params.lci}% do CDI, sem imposto. Em 6 meses, um CDB paga 22,5% de IR sobre o ganho; a LCI, nada.`,
    action: { label: 'Simular LCI/LCA', to: 'simulator' },
    related: ['ir-regressivo', 'isencoes', 'fgc', 'liquidez'],
  },
  {
    id: 'tesouro-selic',
    group: 'produtos',
    title: 'Tesouro Selic',
    short: 'Título do governo federal que acompanha a Selic; o mais usado para reserva.',
    body: [
      'Você empresta ao governo federal, que tem a garantia mais alta do país. Acompanha a Selic, tem liquidez diária e oscila muito pouco de preço, por isso é popular para reserva de emergência.',
      'Paga IR regressivo e tem taxas (B3 e, dependendo da corretora, outras); confira as regras atuais antes de investir. Não é coberto pelo FGC porque a garantia é o próprio governo.',
    ],
    action: { label: 'Simular Tesouro Selic', to: 'simulator' },
    related: ['selic', 'reserva-emergencia', 'ir-regressivo'],
    keywords: 'tesouro direto lft',
  },
  {
    id: 'tesouro-ipca',
    group: 'produtos',
    title: 'Tesouro IPCA+',
    short: 'Paga a inflação mais um juro fixo; bom para objetivos de longo prazo, mas o preço varia.',
    body: [
      'Se ficar até o vencimento, você recebe o que foi contratado: a inflação do período mais o juro real (ex.: IPCA + 6% ao ano). Protege o poder de compra.',
      'Se vender antes, o preço do título pode estar acima ou abaixo do que você pagou (marcação a mercado), inclusive com prejuízo. Por isso serve melhor para dinheiro que pode esperar.',
    ],
    example: (c) => `No simulador: IPCA + ${c.params.ipcaReal}% ao ano; com IPCA de ${pct(c.rates.ipca)}, isso dá cerca de ${pct(annual(buildProducts(c.rates, c.params).find((x) => x.id === 'tesouro_ipca')!.monthly))} ao ano (mantido até o vencimento, antes do imposto).`,
    action: { label: 'Simular Tesouro IPCA+', to: 'simulator' },
    related: ['ipca', 'marcacao-mercado', 'pos-pre-hibrido'],
  },

  // ---------- risco ----------
  {
    id: 'risco-credito',
    group: 'risco',
    title: 'Risco de crédito',
    short: 'A chance de quem recebeu o seu dinheiro não conseguir devolver.',
    body: [
      'Quando você compra um CDB, empresta ao banco; se ele quebrar, pode não pagar. O FGC reduz esse risco até um limite, e o Tesouro tem a garantia do governo federal.',
      'Promessas de rendimento muito acima do mercado costumam vir com risco maior. Desconfie de "retorno garantido e alto".',
    ],
    related: ['fgc', 'diversificacao'],
  },
  {
    id: 'marcacao-mercado',
    group: 'risco',
    title: 'Marcação a mercado',
    short: 'O preço de um título com taxa fixa varia se você vender antes do vencimento.',
    body: [
      'Se os juros do mercado sobem, títulos que pagam taxa menor valem menos hoje; se caem, valem mais. Só dá para garantir o resultado contratado se você ficar até o vencimento.',
      'Isso afeta principalmente Tesouro prefixado e IPCA+. No Tesouro Selic e nos CDBs pós-fixados de liquidez diária, o efeito é pequeno.',
    ],
    related: ['tesouro-ipca', 'pos-pre-hibrido', 'liquidez'],
  },
  {
    id: 'fgc',
    group: 'risco',
    title: 'FGC',
    short: 'Fundo Garantidor de Créditos: protege depósitos e alguns títulos bancários até um limite.',
    body: [
      'Se uma instituição financeira quebra, o FGC devolve o valor, até um limite por CPF e por instituição (hoje, R$ 250 mil; confira o valor e as regras atuais no site do FGC).',
      'Cobre, entre outros, poupança, CDB, LCI e LCA. Não cobre Tesouro (que tem a garantia do governo federal), ações, fundos de investimento em geral nem valores acima do limite.',
    ],
    related: ['cdb', 'lci-lca', 'diversificacao'],
  },
  {
    id: 'diversificacao',
    group: 'risco',
    title: 'Diversificação',
    short: 'Não colocar todo o dinheiro no mesmo lugar.',
    body: [
      'Dividir entre instituições, produtos e prazos reduz o estrago se um deles der problema. Com o FGC, por exemplo, vale ficar atento ao limite por instituição.',
      'Diversificar não é ter muitas coisas ao mesmo tempo; é ter o que combina com cada objetivo e prazo.',
    ],
    related: ['fgc', 'prazo-objetivo', 'risco-credito'],
  },

  // ---------- impostos ----------
  {
    id: 'ir-regressivo',
    group: 'impostos',
    title: 'Imposto de renda regressivo',
    short: 'Quanto mais tempo o dinheiro fica investido, menor a alíquota sobre o rendimento.',
    body: [
      'Na renda fixa tributada (CDB, Tesouro), o IR incide só sobre o ganho, não sobre o valor investido: 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720 dias.',
      'Quem aplica todo mês paga pela idade de cada aporte: aportes antigos têm alíquota menor que os recentes. O simulador faz essa conta aporte por aporte.',
    ],
    example: () => `Sobre um ganho de R$ 1.000: ${brl(1000 * irRate(180))} de IR se resgatar em até 180 dias; ${brl(1000 * irRate(360))} entre 181 e 360; ${brl(1000 * irRate(720))} entre 361 e 720; ${brl(1000 * irRate(721))} acima de 720 dias.`,
    action: { label: 'Ver o imposto no simulador', to: 'simulator' },
    related: ['iof', 'isencoes'],
  },
  {
    id: 'iof',
    group: 'impostos',
    title: 'IOF',
    short: 'Imposto sobre operações financeiras; nos resgates, só pesa nos primeiros dias.',
    body: [
      'Nos resgates de renda fixa em menos de 30 dias, incide IOF sobre o rendimento, com alíquota que cai a cada dia até zerar no 30º.',
      'O simulador não considera o IOF. Para dinheiro que você pode precisar logo, vale saber que sair antes de 30 dias custa um pouco.',
    ],
    related: ['ir-regressivo'],
  },
  {
    id: 'isencoes',
    group: 'impostos',
    title: 'Investimentos isentos de IR',
    short: 'Alguns produtos não cobram imposto de renda de pessoa física.',
    body: [
      'Poupança, LCI, LCA, CRI, CRA e debêntures incentivadas são isentos de IR para pessoa física (as regras podem mudar; confira a legislação atual).',
      'Isenção não significa rendimento maior: compare sempre o que sobra no final. Um produto isento que paga 90% do CDI pode render mais, líquido, que um tributado que paga 100%.',
    ],
    action: { label: 'Comparar líquido no simulador', to: 'simulator' },
    related: ['lci-lca', 'poupanca', 'ir-regressivo'],
  },
]

export const conceptById = (id: string) => CONCEPTS.find((c) => c.id === id)

/** Busca sem acento e sem caixa no título, resumo, texto e palavras-chave. */
export function searchConcepts(list: Concept[], query: string): Concept[] {
  const q = normDesc(query)
  if (!q) return list
  const words = q.split(' ')
  const hits = list.filter((c) => {
    const hay = normDesc(`${c.title} ${c.short} ${c.body.join(' ')} ${c.keywords ?? ''}`)
    return words.every((w) => hay.includes(w))
  })
  // quem tem a palavra no título vem primeiro; depois no resumo; depois só no texto
  const rank = (c: Concept) => (words.every((w) => normDesc(c.title).includes(w)) ? 0 : words.every((w) => normDesc(`${c.short} ${c.keywords ?? ''}`).includes(w)) ? 1 : 2)
  return hits.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c)
}
