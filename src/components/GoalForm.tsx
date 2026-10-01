import { useState } from 'react'
import { parseNumber } from '../invest'
import type { Goal } from '../types'

const COLORS = ['#e0600f', '#3b6ef5', '#8b3ff5', '#e84a45', '#3ecf6e']

interface Props {
  initial?: Goal
  onSave: (g: { name: string; target: number; saved?: number; color: string; deadline?: string }) => void
}

/** Criar ou editar uma meta: nome, valor, prazo (opcional) e, ao editar, quanto já foi guardado. */
export function GoalForm({ initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial ? String(initial.target).replace('.', ',') : '')
  const [saved, setSaved] = useState(initial ? String(initial.saved).replace('.', ',') : '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const t = parseNumber(target)
  const valid = name.trim() && t > 0

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), target: t, color, deadline: deadline || undefined, ...(initial ? { saved: parseNumber(saved) } : {}) })
      }}
    >
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem" autoFocus /></label>
      <div className="row">
        <label>Valor da meta (R$)<input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="0,00" aria-label="Valor da meta" /></label>
        <label>Prazo (opcional)<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Prazo da meta" /></label>
      </div>
      {initial && <label>Já guardado (R$)<input value={saved} onChange={(e) => setSaved(e.target.value)} inputMode="decimal" placeholder="0,00" aria-label="Já guardado na meta" /></label>}
      <div className="swatches">
        {COLORS.map((c) => <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />)}
      </div>
      <button className="btn primary" disabled={!valid}>{initial ? 'Salvar meta' : 'Criar meta'}</button>
    </form>
  )
}
