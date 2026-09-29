import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** false: não fecha ao clicar fora (decisões obrigatórias). */
  dismissable?: boolean
}

export function Modal({ title, onClose, children, dismissable = true }: Props) {
  return (
    <div className="overlay" onMouseDown={dismissable ? onClose : undefined}>
      <div className="modal" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          {dismissable && (
            <button className="icon-btn" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
