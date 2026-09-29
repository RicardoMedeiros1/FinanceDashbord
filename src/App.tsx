import { Database, Plus } from 'lucide-react'
import { useState } from 'react'
import { DataModal } from './components/DataModal'
import { Modal } from './components/Modal'
import { Sidebar } from './components/Sidebar'
import { TransactionForm } from './components/TransactionForm'
import { seedBudgets, seedGoals, seedSubscriptions, seedTransactions } from './data'
import { uid } from './lib'
import { Assistant } from './pages/Assistant'
import { Budgets } from './pages/Budgets'
import { Overview } from './pages/Overview'
import { Subscriptions } from './pages/Subscriptions'
import { Transactions } from './pages/Transactions'
import type { Budget, CategoryId, Goal, Page, Subscription, Transaction } from './types'
import { useStored } from './useStored'

const TITLES: Record<Page, { title: string; subtitle: string }> = {
  overview: { title: 'Visão geral', subtitle: 'Como está o seu dinheiro este mês' },
  transactions: { title: 'Transações', subtitle: 'Todas as receitas e despesas' },
  subscriptions: { title: 'Assinaturas', subtitle: 'Controle o que renova no seu cartão' },
  budgets: { title: 'Orçamentos', subtitle: 'Limites de gasto por categoria' },
  assistant: { title: 'Assistente', subtitle: 'Tire dúvidas sobre o seu dinheiro' },
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function App() {
  const [page, setPage] = useState<Page>('overview')
  const [txs, setTxs] = useStored<Transaction[]>('fd:txs', seedTransactions)
  const [subs, setSubs] = useStored<Subscription[]>('fd:subs', seedSubscriptions)
  const [budgets, setBudgets] = useStored<Budget[]>('fd:budgets', seedBudgets)
  const [goals, setGoals] = useStored<Goal[]>('fd:goals', seedGoals)
  const [newTx, setNewTx] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)

  const head = TITLES[page]

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={setPage} />
      <main>
        <header className="topbar">
          <div>
            <h1>{page === 'overview' ? `${greeting()}, Ricardo` : head.title}</h1>
            <p className="muted">{head.subtitle}</p>
          </div>
          <div className="topbar-right">
            <button className="btn ghost" onClick={() => setDataOpen(true)}><Database size={15} /> Dados</button>
            <button className="btn light" onClick={() => setNewTx(true)}><Plus size={16} /> Nova transação</button>
          </div>
        </header>

        {page === 'overview' && (
          <Overview
            txs={txs}
            subs={subs}
            budgets={budgets}
            goals={goals}
            onNavigate={setPage}
            onAddGoal={(g) => setGoals((l) => [...l, { ...g, id: uid(), saved: 0 }])}
            onDeposit={(id, amount) => setGoals((l) => l.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)))}
          />
        )}
        {page === 'transactions' && (
          <Transactions
            txs={txs}
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
            subs={subs}
            budgets={budgets}
            onChange={(category: CategoryId, limit) =>
              setBudgets((l) => (l.some((b) => b.category === category) ? l.map((b) => (b.category === category ? { ...b, limit } : b)) : [...l, { category, limit }]))
            }
          />
        )}
        {page === 'assistant' && <Assistant txs={txs} subs={subs} budgets={budgets} />}
      </main>
      {dataOpen && (
        <DataModal
          data={{ txs, subs, budgets, goals }}
          onClose={() => setDataOpen(false)}
          onImport={(d) => {
            setTxs(d.txs)
            setSubs(d.subs)
            setBudgets(d.budgets)
            setGoals(d.goals)
          }}
          onReset={() => {
            setTxs(seedTransactions())
            setSubs(seedSubscriptions())
            setBudgets(seedBudgets())
            setGoals(seedGoals())
          }}
        />
      )}
      {newTx && (
        <Modal title="Nova transação" onClose={() => setNewTx(false)}>
          <TransactionForm onSave={(t) => { setTxs((l) => [{ ...t, id: uid() }, ...l]); setNewTx(false) }} />
        </Modal>
      )}
    </div>
  )
}
