import { Bot, CreditCard, LayoutDashboard, PiggyBank, Receipt } from 'lucide-react'
import type { Page } from '../types'

const ITEMS: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transações', icon: Receipt },
  { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard },
  { id: 'budgets', label: 'Orçamentos', icon: PiggyBank },
  { id: 'assistant', label: 'Assistente', icon: Bot },
]

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="Finn">
        <span className="brand-mark" />
      </div>
      <nav>
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onNavigate(id)} title={label} aria-label={label}>
            <Icon size={19} />
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
