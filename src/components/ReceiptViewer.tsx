import { Download, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import type { ReceiptMeta } from '../cloud/receipts'
import { Modal } from './Modal'

export function ReceiptViewer({ url, meta, onClose }: { url: string; meta: ReceiptMeta; onClose: () => void }) {
  // libera a URL temporária dos arquivos locais
  useEffect(() => () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url) }, [url])
  const isPdf = meta.mime === 'application/pdf'
  return (
    <Modal title="Comprovante" onClose={onClose}>
      {isPdf ? (
        <p className="muted">Este comprovante é um PDF. Abra em uma nova aba para ver.</p>
      ) : (
        <img className="receipt-img" src={url} alt={`Comprovante ${meta.name}`} />
      )}
      <div className="receipt-actions">
        <a className="btn" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Abrir</a>
        <a className="btn" href={url} download={meta.name}><Download size={15} /> Baixar</a>
      </div>
    </Modal>
  )
}
