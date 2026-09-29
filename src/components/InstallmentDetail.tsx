import { Check, Eye, Paperclip, RefreshCw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ACCEPT, type ReceiptMeta } from '../cloud/receipts'
import { brl, formatDate, installmentStatus, occurrence } from '../lib'
import type { Installment } from '../types'
import { Modal } from './Modal'

interface Props {
  item: Installment
  receipts: ReceiptMeta[]
  onAttach: (item: Installment, k: number, file: File) => Promise<void>
  onOpen: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onClose: () => void
}

export function InstallmentDetail({ item, receipts, onAttach, onOpen, onRemove, onClose }: Props) {
  const st = installmentStatus(item)
  const input = useRef<HTMLInputElement>(null)
  const target = useRef<number>(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title={item.name} onClose={onClose}>
      <p className="muted small detail-sub">
        {st.paid} de {item.count} pagas · anexe o comprovante das parcelas pagas.
      </p>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          const k = target.current
          e.target.value = ''
          if (f) void run(`${item.id}-p${k}`, () => onAttach(item, k, f))
        }}
      />
      <ul className="parcels">
        {Array.from({ length: item.count }, (_, k) => {
          const id = `${item.id}-p${k}`
          const paid = k < st.paid
          const r = receipts.find((x) => x.id === id)
          const working = busy === id
          return (
            <li key={k} className={paid ? '' : 'future'}>
              <span className="parcel-n">{k + 1}/{item.count}</span>
              <div className="grow">
                <strong>{brl(item.amount)}</strong>
                <span className="muted small">{formatDate(occurrence(item.firstDate, 'monthly', k))}</span>
              </div>
              {paid ? (
                <span className="pill good"><Check size={11} /> Paga</span>
              ) : (
                <span className="pill">A vencer</span>
              )}
              {paid && (
                <div className="parcel-actions">
                  {r ? (
                    <>
                      <button className="icon-btn" disabled={working} onClick={() => run(id, () => onOpen(id))} aria-label={`Ver comprovante da parcela ${k + 1}`}><Eye size={15} /></button>
                      <button className="icon-btn" disabled={working} onClick={() => { target.current = k; input.current?.click() }} aria-label={`Trocar comprovante da parcela ${k + 1}`}><RefreshCw size={15} /></button>
                      <button className="icon-btn" disabled={working} onClick={() => run(id, () => onRemove(id))} aria-label={`Remover comprovante da parcela ${k + 1}`}><Trash2 size={15} /></button>
                    </>
                  ) : (
                    <button className="pill-btn" disabled={working} onClick={() => { target.current = k; input.current?.click() }} aria-label={`Anexar comprovante da parcela ${k + 1}`}>
                      <Paperclip size={12} /> {working ? 'Enviando…' : 'Anexar'}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {error && <p className="bad-text small" role="alert">{error}</p>}
    </Modal>
  )
}
