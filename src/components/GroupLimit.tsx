import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { brl } from '../lib'

interface Props {
  id: string
  name: string
  limit?: number
  /** gasto do mês neste grupo */
  spent: number
  onSave: (id: string, limit: number | null) => void
}

/** Limite mensal de um grupo de gastos: barra de progresso e edição no próprio lugar. */
export function GroupLimit({ id, name, limit, spent, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const pct = limit ? (spent / limit) * 100 : 0
  const state = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''

  const commit = () => {
    const v = Number(draft.replace(/\./g, '').replace(',', '.'))
    if (draft.trim() === '' ) onSave(id, null)
    else if (v > 0) onSave(id, v)
    setEditing(false)
  }

  if (editing) {
    return (
      <form className="group-limit-form" onSubmit={(e) => { e.preventDefault(); commit() }}>
        <input autoFocus inputMode="decimal" aria-label={`Limite mensal de ${name}`} placeholder="Limite por mês (R$)" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn primary">Salvar</button>
        <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancelar</button>
      </form>
    )
  }
  if (!limit) {
    return <button className="link" aria-label={`Definir limite de ${name}`} onClick={() => { setDraft(''); setEditing(true) }}>+ Limite mensal</button>
  }
  return (
    <div className="group-limit">
      <div className={`bar ${state}`} role="progressbar" aria-label={`Limite de ${name}`} aria-valuenow={Math.round(Math.min(pct, 100))} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="group-limit-row">
        <span className={`small ${state ? 'bad-text' : 'muted'}`}>
          {pct >= 100 ? `Estourou em ${brl(spent - limit)}` : `${brl(spent)} de ${brl(limit)} · restam ${brl(limit - spent)}`}
        </span>
        <button className="icon-btn" aria-label={`Editar limite de ${name}`} onClick={() => { setDraft(String(limit).replace('.', ',')); setEditing(true) }}><Pencil size={13} /></button>
      </div>
    </div>
  )
}
