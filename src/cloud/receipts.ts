import type { Remote } from './types'

export interface ReceiptMeta {
  id: string // `${parcelamento}-p${n}`, o mesmo id da despesa gerada
  installmentId: string
  k: number // índice da parcela (0 = 1ª)
  name: string
  mime: string
  size: number
  path: string
  addedAt: string
}

/** Onde os bytes do comprovante ficam. Os metadados sincronizam como qualquer outro registro. */
export interface ReceiptStore {
  put(id: string, blob: Blob, mime: string, ext: string): Promise<string>
  url(meta: ReceiptMeta): Promise<string>
  remove(meta: ReceiptMeta): Promise<void>
}

const MAX_BYTES = 8 * 1024 * 1024
const MAX_SIDE = 1800

export const ACCEPT = 'image/*,application/pdf'

export interface Prepared {
  blob: Blob
  mime: string
  ext: string
}

/** Fotos são reduzidas (lado maior 1800px, JPEG) para não lotar o armazenamento; PDFs passam direto. */
export async function prepareFile(file: File): Promise<Prepared> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('PDF grande demais (máximo 8 MB).')
    return { blob: file, mime: 'application/pdf', ext: 'pdf' }
  }
  if (!file.type.startsWith('image/')) throw new Error('Use uma foto ou um PDF.')
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (blob) return { blob, mime: 'image/jpeg', ext: 'jpg' }
  } catch {
    /* formato que o navegador não decodifica: envia o original se couber */
  }
  if (file.size > MAX_BYTES) throw new Error('Imagem grande demais (máximo 8 MB).')
  return { blob: file, mime: file.type, ext: (file.type.split('/')[1] ?? 'img').replace('jpeg', 'jpg') }
}

// ---- Local (IndexedDB): usado quando o app roda sem nuvem ----

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('finn-files', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('files')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction('files', mode).objectStore('files'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function localReceiptStore(): ReceiptStore {
  return {
    async put(id, blob) {
      const path = `local:${id}:${Date.now()}`
      await tx('readwrite', (s) => s.put(blob, path))
      return path
    },
    async url(meta) {
      const blob = await tx<Blob | undefined>('readonly', (s) => s.get(meta.path))
      if (!blob) throw new Error('Arquivo não encontrado neste aparelho.')
      return URL.createObjectURL(blob)
    },
    async remove(meta) {
      await tx('readwrite', (s) => s.delete(meta.path))
    },
  }
}

// ---- Nuvem (Supabase Storage, pasta privada por usuário) ----

export function cloudReceiptStore(remote: Remote, userId: string): ReceiptStore {
  return {
    async put(id, blob, mime, ext) {
      const path = `${userId}/${id}-${Date.now()}.${ext}`
      await remote.uploadFile(path, blob, mime)
      return path
    },
    url: (meta) => remote.fileUrl(meta.path),
    remove: (meta) => remote.removeFile(meta.path),
  }
}
