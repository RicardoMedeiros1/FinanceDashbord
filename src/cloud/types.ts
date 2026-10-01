import type { BankSyncResponse } from '../openfinance'

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

/** Cadastro do aplicativo autenticador (verificação em duas etapas). */
export interface MfaEnrollment {
  factorId: string
  qr: string // imagem do QR code (data URI)
  secret: string // chave para digitar à mão
  uri: string // otpauth://...
}

export interface MfaStatus {
  enrolled: boolean // já tem um aplicativo autenticador cadastrado
  verified: boolean // esta sessão já passou pelo código
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
  /** Pede à função do servidor (Open Finance / Meu Pluggy) as contas e transações das conexões informadas. */
  bankSync(req: { action: 'sync'; items: string[]; from?: string }): Promise<BankSyncResponse>
  /** Estado da verificação em duas etapas desta sessão. */
  mfaStatus(): Promise<MfaStatus>
  /** Gera um novo cadastro (QR code + chave); só vale depois de confirmado com um código. */
  mfaEnroll(): Promise<MfaEnrollment>
  /** Confere o código de 6 dígitos (cadastro novo ou login); a sessão passa a ser verificada. */
  mfaVerify(code: string, factorId?: string): Promise<void>
  /** Remove o aplicativo autenticador atual (para cadastrar outro). Exige a sessão verificada. */
  mfaUnenroll(): Promise<void>
  onChange(cb: (s: Session | null) => void): () => void
  remote(userId: string): Remote
}
