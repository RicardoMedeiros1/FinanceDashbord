// Evolução do saldo das contas mês a mês ("patrimônio nas contas"). Funções puras.
import { accountBalance } from './accounts'
import { monthKey, parseISO, shiftMonth, toISO } from './lib'
import type { Account, Transaction, Transfer } from './types'

export interface NetWorthPoint {
  month: string // yyyy-mm
  /** último dia considerado: fim do mês (ou hoje, no mês atual) */
  date: string
  total: number
  /** saldo de cada conta que já existia nessa data */
  byAccount: Record<string, number>
}

const endOfMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return toISO(new Date(y, m, 0))
}

/**
 * Saldo total no fim de cada um dos últimos `months` meses. Uma conta só entra a partir do mês da sua data inicial
 * (antes disso o saldo não é conhecido). Meses antes da primeira conta ficam de fora.
 */
export function netWorthSeries(accounts: Account[], txs: Transaction[], transfers: Transfer[], today = toISO(new Date()), months = 12): NetWorthPoint[] {
  const now = parseISO(today)
  const points: NetWorthPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const month = monthKey(shiftMonth(now, -i))
    const date = i === 0 ? today : endOfMonth(month)
    const byAccount: Record<string, number> = {}
    for (const a of accounts) {
      if (a.openingDate > date) continue
      byAccount[a.id] = accountBalance(a, txs, transfers, accounts, date)
    }
    if (Object.keys(byAccount).length === 0) continue
    points.push({ month, date, total: Object.values(byAccount).reduce((s, v) => s + v, 0), byAccount })
  }
  return points
}

export interface NetWorthStats {
  current: number
  /** mudança desde o fim do mês anterior (null se não há mês anterior) */
  sinceLastMonth: number | null
  /** mudança desde o primeiro mês da série */
  sinceStart: number
  months: number
  best: { month: string; change: number } | null
  worst: { month: string; change: number } | null
  /** parte do saldo que está em contas de poupança/reserva (0–1) */
  savedShare: number
}

/** Números que resumem a série. Só compara meses em que o conjunto de contas é o mesmo, para não confundir conta nova com economia. */
export function netWorthStats(series: NetWorthPoint[], accounts: Account[]): NetWorthStats | null {
  if (series.length === 0) return null
  const last = series[series.length - 1]
  const changes: Array<{ month: string; change: number }> = []
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1]
    const b = series[i]
    // contas que existem nos dois pontos
    const shared = Object.keys(b.byAccount).filter((id) => id in a.byAccount)
    changes.push({ month: b.month, change: shared.reduce((s, id) => s + b.byAccount[id] - a.byAccount[id], 0) })
  }
  const sorted = [...changes].sort((x, y) => y.change - x.change)
  const saved = accounts.filter((a) => a.kind === 'savings' && a.id in last.byAccount).reduce((s, a) => s + last.byAccount[a.id], 0)
  return {
    current: last.total,
    sinceLastMonth: changes.length ? changes[changes.length - 1].change : null,
    sinceStart: changes.reduce((s, c) => s + c.change, 0),
    months: series.length,
    best: sorted.length ? sorted[0] : null,
    worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    savedShare: last.total > 0 ? Math.max(0, Math.min(1, saved / last.total)) : 0,
  }
}
