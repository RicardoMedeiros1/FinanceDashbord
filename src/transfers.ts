// Transferências entre as suas próprias contas: aparecem no extrato do banco como uma saída numa conta e uma entrada
// em outra. Não são despesa nem receita; aqui achamos esses pares e os transformamos em "transferência".
import { normDesc } from './importer'
import { parseISO, uid } from './lib'
import type { Account, Transaction, Transfer } from './types'

/** Palavras que costumam aparecer nas transferências entre contas. */
const HINT = /transfer|\bpix\b|\bted\b|\bdoc\b|resgate|aplicacao|caixinha|entre contas|mesma titular|reserva|poupanca|cofrinho|investimento/

export interface TransferMatch {
  expense: Transaction
  income: Transaction
  confidence: 'high' | 'low'
  days: number
}

const dayDiff = (a: string, b: string) => Math.round(Math.abs(parseISO(a).getTime() - parseISO(b).getTime()) / 86400000)

/** Ids de lançamentos que já viraram transferência: o banco/importador não deve trazê-los de volta. */
export const convertedIds = (transfers: Transfer[]) => transfers.flatMap((t) => t.origin?.map((o) => o.id) ?? [])

/**
 * Pares "saiu de uma conta / entrou em outra" com o mesmo valor, até 3 dias de distância.
 * Confiança alta: a descrição lembra transferência (pix, ted, resgate...) ou as datas são iguais; senão, baixa (não vem marcada).
 * Cada lançamento entra em no máximo um par.
 */
export function findTransferMatches(txs: Transaction[], accounts: Account[], maxDays = 3): TransferMatch[] {
  const ids = new Set(accounts.map((a) => a.id))
  const ok = (t: Transaction) => !!t.accountId && !t.cardId && ids.has(t.accountId)
  const out = txs.filter((t) => t.type === 'expense' && ok(t))
  const inc = txs.filter((t) => t.type === 'income' && ok(t))
  const cents = (n: number) => Math.round(n * 100)

  const cands: TransferMatch[] = []
  for (const e of out) {
    for (const i of inc) {
      if (e.accountId === i.accountId || cents(e.amount) !== cents(i.amount)) continue
      const days = dayDiff(e.date, i.date)
      if (days > maxDays) continue
      const hint = HINT.test(normDesc(e.description)) || HINT.test(normDesc(i.description))
      cands.push({ expense: e, income: i, days, confidence: hint || days === 0 ? 'high' : 'low' })
    }
  }
  // melhores primeiro: confiança alta, depois datas mais próximas
  cands.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1) || a.days - b.days || a.expense.date.localeCompare(b.expense.date))
  const used = new Set<string>()
  const result: TransferMatch[] = []
  for (const c of cands) {
    if (used.has(c.expense.id) || used.has(c.income.id)) continue
    used.add(c.expense.id)
    used.add(c.income.id)
    result.push(c)
  }
  return result.sort((a, b) => b.expense.date.localeCompare(a.expense.date))
}

/** Um par vira uma transferência: o saldo das duas contas continua igual, mas some da soma de receitas e despesas. */
export function matchToTransfer(m: TransferMatch, newId: () => string = uid): Transfer {
  return {
    id: newId(),
    date: m.expense.date,
    from: m.expense.accountId,
    to: m.income.accountId,
    amount: m.expense.amount,
    note: m.expense.description === m.income.description ? m.expense.description : `${m.expense.description} → ${m.income.description}`,
    kind: 'transfer',
    origin: [m.expense, m.income],
  }
}

/**
 * Um lançamento só (o outro lado está numa conta que não está no app) vira transferência de/para uma conta.
 * `from` e `to` vazios = "conta de fora do app".
 */
export function singleToTransfer(t: Transaction, from: string, to: string, newId: () => string = uid): Transfer {
  return { id: newId(), date: t.date, from: from || undefined, to: to || undefined, amount: t.amount, note: t.description, kind: 'transfer', origin: [t] }
}
