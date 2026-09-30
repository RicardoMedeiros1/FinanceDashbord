import { PiggyBank, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { ReserveTab } from '../components/ReserveTab'
import { SimulatorTab, type SimSeed } from '../components/SimulatorTab'
import { Tabs } from '../components/Tabs'
import type { ReserveSettings } from '../reserve'
import type { Account, Transaction, Transfer } from '../types'

export type InvestTab = 'reserve' | 'simulator'

interface Props {
  tab: InvestTab
  onTab: (t: InvestTab) => void
  txs: Transaction[]
  accounts: Account[]
  transfers: Transfer[]
  reserve?: ReserveSettings
  onReserve: (s: ReserveSettings) => void
}

export function Invest({ tab, onTab, txs, accounts, transfers, reserve, onReserve }: Props) {
  const [seed, setSeed] = useState<SimSeed>({ initial: 0, monthly: 0, months: 12 })
  const [run, setRun] = useState(0) // muda quando vem da reserva, para o simulador recomeçar com os valores novos

  return (
    <div className="invest">
      <Tabs
        label="Investir"
        active={tab}
        onChange={onTab}
        tabs={[
          { id: 'reserve', label: 'Reserva de emergência', icon: <PiggyBank size={13} /> },
          { id: 'simulator', label: 'Simulador', icon: <TrendingUp size={13} /> },
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
      ) : (
        <SimulatorTab key={run} seed={seed} />
      )}
    </div>
  )
}
