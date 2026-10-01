import { BookOpen, PiggyBank, Target, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { ConceptsTab } from '../components/ConceptsTab'
import { GoalsTab } from '../components/GoalsTab'
import { ReserveTab } from '../components/ReserveTab'
import { SimulatorTab, type SimSeed } from '../components/SimulatorTab'
import { Tabs } from '../components/Tabs'
import type { ReserveSettings } from '../reserve'
import type { Account, Goal, Installment, Page, Transaction, Transfer } from '../types'

export type InvestTab = 'reserve' | 'goals' | 'simulator' | 'concepts'

interface Props {
  tab: InvestTab
  onTab: (t: InvestTab) => void
  txs: Transaction[]
  accounts: Account[]
  transfers: Transfer[]
  installments: Installment[]
  goals: Goal[]
  onSaveGoal: (g: { name: string; target: number; saved?: number; color: string; deadline?: string }, id?: string) => void
  onDeleteGoal: (id: string) => void
  onDepositGoal: (id: string, amount: number) => void
  reserve?: ReserveSettings
  onReserve: (s: ReserveSettings) => void
  onGo: (p: Page, sub?: string) => void
}

export function Invest({ tab, onTab, txs, accounts, transfers, installments, goals, onSaveGoal, onDeleteGoal, onDepositGoal, reserve, onReserve, onGo }: Props) {
  const [seed, setSeed] = useState<SimSeed>({ initial: 0, monthly: 0, months: 12 })
  const [focus, setFocus] = useState<string | null>(null) // conceito aberto pelo "?" do simulador
  const [run, setRun] = useState(0) // muda quando vem da reserva, para o simulador recomeçar com os valores novos

  return (
    <div className="invest">
      <Tabs
        label="Investir"
        active={tab}
        onChange={onTab}
        tabs={[
          { id: 'reserve', label: 'Reserva de emergência', icon: <PiggyBank size={13} /> },
          { id: 'goals', label: 'Metas', icon: <Target size={13} />, count: goals.length },
          { id: 'simulator', label: 'Simulador', icon: <TrendingUp size={13} /> },
          { id: 'concepts', label: 'Conceitos', icon: <BookOpen size={13} /> },
        ]}
      />
      {tab === 'reserve' ? (
        <ReserveTab
          txs={txs}
          accounts={accounts}
          transfers={transfers}
          settings={reserve}
          onChange={onReserve}
          onSimulate={(s) => {
            setSeed(s)
            setRun((n) => n + 1)
            onTab('simulator')
          }}
        />
      ) : tab === 'goals' ? (
        <GoalsTab
          goals={goals}
          onSave={onSaveGoal}
          onDelete={onDeleteGoal}
          onDeposit={onDepositGoal}
          onSimulate={(s) => {
            setSeed(s)
            setRun((n) => n + 1)
            onTab('simulator')
          }}
        />
      ) : tab === 'simulator' ? (
        <SimulatorTab key={run} seed={seed} onLearn={(id) => { setFocus(id); onTab('concepts') }} />
      ) : (
        <ConceptsTab txs={txs} accounts={accounts} transfers={transfers} installments={installments} reserve={reserve} focus={focus} onTab={(t) => { setFocus(null); onTab(t) }} onGo={onGo} />
      )}
    </div>
  )
}
