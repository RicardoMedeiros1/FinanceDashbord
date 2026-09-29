import { Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Budget, Goal, Installment, Recurring, Subscription, Transaction } from '../types'
import { Modal } from './Modal'

export interface AppData {
  txs: Transaction[]
  subs: Subscription[]
  budgets: Budget[]
  goals: Goal[]
  recurring: Recurring[]
  installments: Installment[]
}

interface Props {
  data: AppData
  onImport: (d: AppData) => void
  onReset: () => void
  onClear: () => void
  onClose: () => void
}

/** Valida o mínimo necessário para não quebrar o app com um arquivo errado. */
function parse(text: string): AppData {
  const raw = JSON.parse(text)
  const ok = (k: string) => Array.isArray(raw?.[k])
  if (!ok('txs') || !ok('subs') || !ok('budgets')) throw new Error('formato')
  return { txs: raw.txs, subs: raw.subs, budgets: raw.budgets, goals: Array.isArray(raw.goals) ? raw.goals : [], recurring: Array.isArray(raw.recurring) ? raw.recurring : [], installments: Array.isArray(raw.installments) ? raw.installments : [] }
}

export function DataModal({ data, onImport, onReset, onClear, onClose }: Props) {
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const exportFile = () => {
    const blob = new Blob([JSON.stringify({ version: 1, ...data }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `finn-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg({ ok: true, text: 'Backup baixado.' })
  }

  const importFile = async (f: File) => {
    try {
      const parsed = parse(await f.text())
      if (!confirm('Importar este backup? Os dados atuais deste aparelho serão substituídos.')) return
      onImport(parsed)
      setMsg({ ok: true, text: 'Backup importado.' })
    } catch {
      setMsg({ ok: false, text: 'Arquivo inválido. Use um backup exportado pelo Finn.' })
    }
  }

  return (
    <Modal title="Seus dados" onClose={onClose}>
      <p className="muted small data-note">
        Os dados ficam salvos só neste aparelho. Para levar para outro (ou guardar uma cópia), exporte um backup e importe lá.
      </p>
      <div className="data-actions">
        <button className="btn" onClick={exportFile}><Download size={16} /> Exportar backup</button>
        <button className="btn" onClick={() => file.current?.click()}><Upload size={16} /> Importar backup</button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Começar do zero? Isso apaga TODAS as transações, assinaturas, orçamentos e metas deste aparelho. Exporte um backup antes se quiser guardá-los.')) {
              onClear()
              setMsg({ ok: true, text: 'Tudo limpo. Pode começar a lançar seus dados.' })
            }
          }}
        >
          <Trash2 size={16} /> Começar do zero
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            if (confirm('Restaurar os dados de exemplo? Suas alterações serão perdidas.')) {
              onReset()
              setMsg({ ok: true, text: 'Dados de exemplo restaurados.' })
            }
          }}
        >
          <RotateCcw size={16} /> Restaurar exemplo
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void importFile(f)
          e.target.value = ''
        }}
      />
      {msg && <p className={`small ${msg.ok ? 'pos' : 'bad-text'}`} role="status">{msg.text}</p>}
    </Modal>
  )
}
