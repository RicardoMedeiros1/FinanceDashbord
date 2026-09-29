import type { CategoryId } from './types'

export const CATEGORIES: Record<CategoryId, { label: string; color: string }> = {
  moradia: { label: 'Moradia', color: '#8b5cf6' },
  alimentacao: { label: 'Alimentação', color: '#f59e0b' },
  transporte: { label: 'Transporte', color: '#38bdf8' },
  lazer: { label: 'Lazer', color: '#f472b6' },
  saude: { label: 'Saúde', color: '#34d399' },
  assinaturas: { label: 'Assinaturas', color: '#a3e635' },
  compras: { label: 'Compras', color: '#fb7185' },
  educacao: { label: 'Educação', color: '#22d3ee' },
  trabalho: { label: 'Custos do trabalho (Uber)', color: '#fb923c' },
  outros: { label: 'Outros', color: '#94a3b8' },
  salario: { label: 'Salário fixo', color: '#4ade80' },
  variavel: { label: 'Renda variável (Uber, freelas)', color: '#2dd4bf' },
  renda: { label: 'Outras receitas', color: '#86efac' },
}

/** Categorias de receita (não entram em orçamentos nem em gastos por categoria). */
export const INCOME_CATEGORIES: CategoryId[] = ['salario', 'variavel', 'renda']

export const EXPENSE_CATEGORIES = (Object.keys(CATEGORIES) as CategoryId[]).filter(
  (c) => !INCOME_CATEGORIES.includes(c),
)
