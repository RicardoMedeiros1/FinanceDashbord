import { CreditCard, LayoutDashboard, PiggyBank, Receipt, Sparkles } from 'lucide-react'
import type { Page } from '../types'

const ITEMS: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transações', icon: Receipt },
  { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard },
  { id: 'budgets', label: 'Orçamentos', icon: PiggyBank },
]

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Sparkles size={18} />
        </span>
        <span>Finn</span>
      </div>
      <nav>
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
