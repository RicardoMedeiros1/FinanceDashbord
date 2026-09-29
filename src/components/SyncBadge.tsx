import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import type { SyncStatus } from '../cloud/sync'

const TEXT = {
  idle: 'Conectando…',
  syncing: 'Sincronizando…',
  ok: 'Sincronizado',
  offline: 'Sem conexão',
  error: 'Erro ao sincronizar',
} as const

export function SyncBadge({ status, onClick }: { status: SyncStatus; onClick: () => void }) {
  const Icon = status.state === 'offline' || status.state === 'error' ? CloudOff : status.state === 'syncing' ? RefreshCw : Cloud
  const time = status.lastSync ? ` · última vez ${new Date(status.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''
  return (
    <button className={`sync-badge ${status.state}`} onClick={onClick} title={`${TEXT[status.state]}${time}${status.error ? ` — ${status.error}` : ''}. Toque para sincronizar agora.`} aria-label={TEXT[status.state]}>
      <Icon size={14} />
      <span>{TEXT[status.state]}</span>
    </button>
  )
}
