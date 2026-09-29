import { Plus } from 'lucide-react'
import { useState } from 'react'
import { brl } from '../lib'
import type { Goal } from '../types'
import { Modal } from './Modal'

interface Props {
  goals: Goal[]
  onAdd: (g: Omit<Goal, 'id' | 'saved'>) => void
  onDeposit: (id: string, amount: number) => void
}

const COLORS = ['#e0600f', '#3b6ef5', '#8b3ff5', '#e84a45', '#3ecf6e']

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#262626" strokeWidth="4" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} transform="rotate(-90 20 20)" />
    </svg>
  )
}

export function GoalsCard({ goals, onAdd, onDeposit }: Props) {
  const [modal, setModal] = useState<'new' | string | null>(null)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const num = Number(value.replace(',', '.'))

  const close = () => {
    setModal(null)
    setName('')
    setValue('')
  }
  const target = goals.find((g) => g.id === modal)

  return (
    <div className="card">
      <div className="card-head">
        <h3>Metas de economia</h3>
        <button className="icon-btn" onClick={() => setModal('new')} aria-label="Nova meta"><Plus size={16} /></button>
      </div>
      <ul className="list">
        {goals.map((g) => {
          const pct = (g.saved / g.target) * 100
          return (
            <li key={g.id}>
              <Ring pct={pct} color={g.color} />
              <div className="grow">
                <strong>{g.name}</strong>
                <span className="muted small">{brl(g.saved)} de {brl(g.target)}</span>
              </div>
              <button className="pill-btn" onClick={() => setModal(g.id)}>+ Guardar</button>
            </li>
          )
        })}
        {goals.length === 0 && <li className="muted">Crie sua primeira meta.</li>}
      </ul>

      {modal === 'new' && (
        <Modal title="Nova meta" onClose={close}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (name.trim() && num > 0) { onAdd({ name: name.trim(), target: num, color }); close() } }}>
            <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem" autoFocus /></label>
            <label>Valor da meta (R$)<input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0,00" /></label>
            <div className="swatches">
              {COLORS.map((c) => <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />)}
            </div>
            <button className="btn primary" disabled={!name.trim() || !(num > 0)}>Criar meta</button>
          </form>
        </Modal>
      )}
      {target && (
        <Modal title={`Guardar para ${target.name}`} onClose={close}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (num > 0) { onDeposit(target.id, num); close() } }}>
            <label>Valor (R$)<input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus /></label>
            <button className="btn primary" disabled={!(num > 0)}>Guardar</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
