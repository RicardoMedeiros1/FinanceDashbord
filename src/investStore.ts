import { DEFAULT_PARAMS, DEFAULT_RATES, type ProductParams, type Rates } from './invest'
import { useStored } from './useStored'

export interface InvestStored {
  rates: Rates
  params: ProductParams
  updated: string // data da última atualização pelo Banco Central ('' = valores de exemplo)
}

/** Taxas e ajustes do simulador, guardados neste aparelho e compartilhados com a aba de conceitos. */
export const useInvestStored = () => useStored<InvestStored>('fd:invest', () => ({ rates: DEFAULT_RATES, params: DEFAULT_PARAMS, updated: '' }))
