/** Uma linha da tabela `records`: qualquer item do app (transação, assinatura, meta...). */
export interface Row {
  collection: string
  id: string
  data: unknown
  deleted: boolean
  synced_at?: string
}

export interface Session {
  userId: string
  email: string
}

/** Acesso aos dados do usuário logado. Implementado pelo Supabase (e por um servidor falso nos testes). */
export interface Remote {
  fetchAll(since: string | null): Promise<Row[]>
  upsert(rows: Row[]): Promise<void>
  subscribe(onChange: () => void): () => void
  uploadFile(path: string, file: Blob, contentType: string): Promise<void>
  fileUrl(path: string): Promise<string>
  removeFile(path: string): Promise<void>
}

export interface Auth {
  getSession(): Promise<Session | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** Envia o e-mail com o link para criar uma nova senha. */
  resetPassword(email: string): Promise<void>
  /** Troca a senha do usuário logado (também usada após abrir o link de recuperação). */
  updatePassword(password: string): Promise<void>
  /** Avisa quando o usuário chegou por um link do e-mail (recuperar senha ou convite) e precisa definir a senha. */
  onRecovery(cb: (kind: 'recovery' | 'invite') => void): () => void
  /** Exclui a conta do usuário logado e todos os dados dela (irreversível). */
  deleteAccount(): Promise<void>
  onChange(cb: (s: Session | null) => void): () => void
  remote(userId: string): Remote
}
