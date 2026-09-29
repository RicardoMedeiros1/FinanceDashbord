import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { seedBudgets, seedSubscriptions, seedTransactions } from './data'
import { uid } from './lib'
import { Budgets } from './pages/Budgets'
import { Overview } from './pages/Overview'
import { Subscriptions } from './pages/Subscriptions'
import { Transactions } from './pages/Transactions'
import type { Budget, CategoryId, Page, Subscription, Transaction } from './types'
import { useStored } from './useStored'

const TITLES: Record<Page, { title: string; subtitle: string }> = {
  overview: { title: 'Visão geral', subtitle: 'Como está o seu dinheiro este mês' },
  transactions: { title: 'Transações', subtitle: 'Todas as receitas e despesas' },
  subscriptions: { title: 'Assinaturas', subtitle: 'Controle o que renova no seu cartão' },
  budgets: { title: 'Orçamentos', subtitle: 'Limites de gasto por categoria' },
}

export default function App() {
  const [page, setPage] = useState<Page>('overview')
  const [txs, setTxs] = useStored<Transaction[]>('fd:txs', seedTransactions)
  const [subs, setSubs] = useStored<Subscription[]>('fd:subs', seedSubscriptions)
  const [budgets, setBudgets] = useStored<Budget[]>('fd:budgets', seedBudgets)

  const head = TITLES[page]

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={setPage} />
      <main>
        <header className="topbar">
          <div>
            <h1>{head.title}</h1>
            <p className="muted">{head.subtitle}</p>
          </div>
          <div className="topbar-right">
            <button
              className="btn ghost"
              onClick={() => {
                if (confirm('Restaurar os dados de exemplo? Suas alterações serão perdidas.')) {
                  setTxs(seedTransactions())
                  setSubs(seedSubscriptions())
                  setBudgets(seedBudgets())
                }
              }}
            >
              Restaurar exemplo
            </button>
            <span className="icon-btn" aria-hidden><Bell size={18} /></span>
          </div>
        </header>

        {page === 'overview' && <Overview txs={txs} subs={subs} budgets={budgets} onNavigate={setPage} />}
        {page === 'transactions' && (
          <Transactions
            txs={txs}
            onAdd={(t) => setTxs((l) => [{ ...t, id: uid() }, ...l])}
            onDelete={(id) => setTxs((l) => l.filter((t) => t.id !== id))}
          />
        )}
        {page === 'subscriptions' && (
          <Subscriptions
            subs={subs}
            onAdd={(s) => setSubs((l) => [...l, { ...s, id: uid(), active: true }])}
            onToggle={(id) => setSubs((l) => l.map((s) => (s.id === id ? { ...s, active: !s.active } : s)))}
            onDelete={(id) => setSubs((l) => l.filter((s) => s.id !== id))}
          />
        )}
        {page === 'budgets' && (
          <Budgets
            txs={txs}
            budgets={budgets}
            onChange={(category: CategoryId, limit) =>
              setBudgets((l) => (l.some((b) => b.category === category) ? l.map((b) => (b.category === category ? { ...b, limit } : b)) : [...l, { category, limit }]))
            }
          />
        )}
      </main>
    </div>
  )
}
