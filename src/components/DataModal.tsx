import { Download, KeyRound, LogOut, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Budget, Card, Goal, Installment, Recurring, Subscription, Transaction } from '../types'
import { PasswordForm } from '../cloud/PasswordForm'
import { Modal } from './Modal'

export interface AppData {
  txs: Transaction[]
  subs: Subscription[]
  budgets: Budget[]
  goals: Goal[]
  recurring: Recurring[]
  installments: Installment[]
  cards: Card[]
}

export interface CloudInfo {
  email: string
  onSignOut: () => void
  onChangePassword: (password: string) => Promise<void>
}

interface Props {
  profileName: string
  onProfileName: (name: string) => void
  cloud?: CloudInfo
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
  return { txs: raw.txs, subs: raw.subs, budgets: raw.budgets, goals: Array.isArray(raw.goals) ? raw.goals : [], recurring: Array.isArray(raw.recurring) ? raw.recurring : [], installments: Array.isArray(raw.installments) ? raw.installments : [], cards: Array.isArray(raw.cards) ? raw.cards : [] }
}

export function DataModal({ profileName, onProfileName, cloud, data, onImport, onReset, onClear, onClose }: Props) {
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [name, setName] = useState(profileName)
  const [pwOpen, setPwOpen] = useState(false)

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
      if (!confirm(cloud ? 'Importar este backup? Os dados atuais serão substituídos aqui e nos seus outros aparelhos.' : 'Importar este backup? Os dados atuais deste aparelho serão substituídos.')) return
      onImport(parsed)
      setMsg({ ok: true, text: 'Backup importado.' })
    } catch {
      setMsg({ ok: false, text: 'Arquivo inválido. Use um backup exportado pelo Finn.' })
    }
  }

  return (
    <Modal title="Seus dados" onClose={onClose}>
      <form
        className="profile-row"
        onSubmit={(e) => {
          e.preventDefault()
          onProfileName(name.trim())
          setMsg({ ok: true, text: 'Nome salvo.' })
        }}
      >
        <label>
          Seu nome (aparece na saudação)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado" maxLength={40} />
        </label>
        <button className="btn" disabled={name.trim() === profileName}>Salvar</button>
      </form>
      {cloud ? (
        <p className="muted small data-note">
          Conectado como <strong>{cloud.email}</strong>. Seus dados ficam na sua conta e sincronizam entre os aparelhos. O backup é uma cópia extra em arquivo; comprovantes não entram nele.
        </p>
      ) : (
        <p className="muted small data-note">
          Os dados ficam salvos só neste aparelho. Para levar para outro (ou guardar uma cópia), exporte um backup e importe lá. Comprovantes não entram no backup.
        </p>
      )}
      <div className="data-actions">
        <button className="btn" onClick={exportFile}><Download size={16} /> Exportar backup</button>
        <button className="btn" onClick={() => file.current?.click()}><Upload size={16} /> Importar backup</button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm(cloud ? 'Começar do zero? Isso apaga TODAS as transações, assinaturas, parcelas, orçamentos, metas e comprovantes da sua conta, em todos os aparelhos. Exporte um backup antes se quiser guardá-los.' : 'Começar do zero? Isso apaga TODAS as transações, assinaturas, orçamentos e metas deste aparelho. Exporte um backup antes se quiser guardá-los.')) {
              onClear()
              setMsg({ ok: true, text: 'Tudo limpo. Pode começar a lançar seus dados.' })
            }
          }}
        >
          <Trash2 size={16} /> Começar do zero
        </button>
        {!cloud && (
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
        )}
        {cloud && (
          <button className="btn" onClick={() => setPwOpen(true)}><KeyRound size={16} /> Trocar senha</button>
        )}
        {cloud && (
          <button className="btn ghost" onClick={cloud.onSignOut}><LogOut size={16} /> Sair desta conta</button>
        )}
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
      {pwOpen && cloud && (
        <Modal title="Trocar senha" onClose={() => setPwOpen(false)}>
          <PasswordForm
            submitLabel="Salvar nova senha"
            onSubmit={cloud.onChangePassword}
            onDone={() => {
              setPwOpen(false)
              setMsg({ ok: true, text: 'Senha alterada.' })
            }}
          />
        </Modal>
      )}
    </Modal>
  )
}
