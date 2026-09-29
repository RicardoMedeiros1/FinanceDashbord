import { Database, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DataModal } from './components/DataModal'
import { Modal } from './components/Modal'
import { Sidebar } from './components/Sidebar'
import { TransactionForm } from './components/TransactionForm'
import { seedBudgets, seedGoals, seedSubscriptions, seedTransactions } from './data'
import { applyRecurring, skipToToday, uid } from './lib'
import { Assistant } from './pages/Assistant'
import { Budgets } from './pages/Budgets'
import { Overview } from './pages/Overview'
import { Subscriptions } from './pages/Subscriptions'
import { Transactions } from './pages/Transactions'
import type { Budget, CategoryId, Cycle, Goal, Page, Recurring, Subscription, Transaction } from './types'
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
  const [rules, setRules] = useStored<Recurring[]>('fd:rules', () => [])
  const [form, setForm] = useState<{ tx?: Transaction; repeat?: boolean } | null>(null)
  const [tick, setTick] = useState(0)

  // Lança as recorrências vencidas ao abrir, ao mudar as regras e ao voltar para o app.
  useEffect(() => {
    const r = applyRecurring(rules)
    if (!r) return
    setRules(r.rules)
    setTxs((l) => {
      const ids = new Set(l.map((t) => t.id))
      return [...r.txs.filter((t) => !ids.has(t.id)), ...l]
    })
  }, [rules, tick, setRules, setTxs])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setTick((n) => n + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const saveForm = (t: Omit<Transaction, 'id' | 'ruleId'>, repeat: Cycle | null) => {
    if (form?.tx) {
      const id = form.tx.id
      setTxs((l) => l.map((x) => (x.id === id ? { ...x, ...t } : x)))
    } else if (repeat) {
      setRules((l) => [...l, { id: uid(), description: t.description, amount: t.amount, type: t.type, category: t.category, cycle: repeat, anchor: t.date, generated: 0, active: true }])
    } else {
      setTxs((l) => [{ ...t, id: uid() }, ...l])
    }
    setForm(null)
  }
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
            <button className="btn light" onClick={() => setForm({})}><Plus size={16} /> Nova transação</button>
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
            rules={rules}
            onEdit={(tx) => setForm({ tx })}
            onDelete={(id) => setTxs((l) => l.filter((t) => t.id !== id))}
            onNewRecurring={() => setForm({ repeat: true })}
            onToggleRule={(id) => setRules((l) => l.map((r) => (r.id === id ? (r.active ? { ...r, active: false } : { ...skipToToday(r), active: true }) : r)))}
            onDeleteRule={(id) => setRules((l) => l.filter((r) => r.id !== id))}
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
          data={{ txs, subs, budgets, goals, recurring: rules }}
          onClose={() => setDataOpen(false)}
          onImport={(d) => {
            setTxs(d.txs)
            setSubs(d.subs)
            setBudgets(d.budgets)
            setGoals(d.goals)
            setRules(d.recurring)
          }}
          onClear={() => {
            setRules([])
            setTxs([])
            setSubs([])
            setBudgets([])
            setGoals([])
          }}
          onReset={() => {
            setRules([])
            setTxs(seedTransactions())
            setSubs(seedSubscriptions())
            setBudgets(seedBudgets())
            setGoals(seedGoals())
          }}
        />
      )}
      {form && (
        <Modal title={form.tx ? 'Editar transação' : form.repeat ? 'Nova recorrente' : 'Nova transação'} onClose={() => setForm(null)}>
          <TransactionForm initial={form.tx} startRepeating={form.repeat} onSave={saveForm} />
        </Modal>
      )}
    </div>
  )
}
