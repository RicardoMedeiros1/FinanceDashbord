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
  outros: { label: 'Outros', color: '#94a3b8' },
  renda: { label: 'Renda', color: '#4ade80' },
}

export const EXPENSE_CATEGORIES = (Object.keys(CATEGORIES) as CategoryId[]).filter(
  (c) => c !== 'renda',
)
