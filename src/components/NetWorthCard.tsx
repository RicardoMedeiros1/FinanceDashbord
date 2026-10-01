import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMemo } from 'react'
import { brl, brlShort, monthLabel, monthLong } from '../lib'
import { netWorthSeries, netWorthStats } from '../networth'
import type { Account, Transaction, Transfer } from '../types'
import { Money } from './Money'

const signed = (n: number) => `${n >= 0 ? '+' : '−'} ${brl(Math.abs(n))}`

/** Evolução do saldo das contas, mês a mês. */
export function NetWorthCard({ accounts, txs, transfers }: { accounts: Account[]; txs: Transaction[]; transfers: Transfer[] }) {
  const series = useMemo(() => netWorthSeries(accounts, txs, transfers), [accounts, txs, transfers])
  const stats = useMemo(() => netWorthStats(series, accounts), [series, accounts])
  if (!stats) return null
  const data = series.map((p) => ({ name: monthLabel(new Date(`${p.month}-01T12:00:00`)), month: p.month, total: Math.round(p.total * 100) / 100 }))

  return (
    <div className="card networth" aria-label="Evolução do saldo">
      <div className="card-head">
        <h3>Evolução do saldo</h3>
        <span className="muted small">fim de cada mês · só contas</span>
      </div>
      <div className="networth-stats">
        <div>
          <span className="muted small">Hoje</span>
          <strong data-testid="nw-current"><Money value={stats.current} /></strong>
        </div>
        {stats.sinceLastMonth !== null && (
          <div>
            <span className="muted small">No último mês</span>
            <strong className={stats.sinceLastMonth >= 0 ? 'pos' : 'bad-text'} data-testid="nw-month">{signed(stats.sinceLastMonth)}</strong>
          </div>
        )}
        {stats.months > 2 && (
          <div>
            <span className="muted small">Em {stats.months - 1} meses</span>
            <strong className={stats.sinceStart >= 0 ? 'pos' : 'bad-text'} data-testid="nw-start">{signed(stats.sinceStart)}</strong>
          </div>
        )}
        {stats.savedShare > 0 && (
          <div>
            <span className="muted small">Em poupança/reserva</span>
            <strong data-testid="nw-saved">{Math.round(stats.savedShare * 100)}%</strong>
          </div>
        )}
      </div>
      {data.length >= 2 ? (
        <div className="chart-fill short" role="img" aria-label={`Saldo total das contas de ${monthLong(data[0].month)} a ${monthLong(data[data.length - 1].month)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart accessibilityLayer={false} data={data} margin={{ top: 10, left: 0, right: 8 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e0600f" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#e0600f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="name" stroke="#6b6b6b" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#6b6b6b" tickLine={false} axisLine={false} fontSize={12} width={66} tickFormatter={(v) => brlShort(Number(v))} />
              <Tooltip
                cursor={{ stroke: '#555' }}
                contentStyle={{ background: '#161616', border: '1px solid #2c2c2c', borderRadius: 10 }}
                labelFormatter={(_, p) => (p?.[0]?.payload?.month ? monthLong(p[0].payload.month) : '')}
                formatter={(v) => [brl(Number(v)), 'Saldo']}
              />
              <Area isAnimationActive={false} dataKey="total" type="monotone" stroke="#e0600f" strokeWidth={2} fill="url(#nw)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted small">O gráfico aparece quando houver pelo menos dois meses de histórico nas contas (a partir da data do saldo inicial). Contas ligadas ao banco trazem o histórico sozinhas.</p>
      )}
      {stats.best && stats.worst && stats.best.month !== stats.worst.month && (
        <p className="muted small networth-note">
          Melhor mês: <strong>{monthLong(stats.best.month)}</strong> ({signed(stats.best.change)}) · Pior: <strong>{monthLong(stats.worst.month)}</strong> ({signed(stats.worst.change)}).
        </p>
      )}
    </div>
  )
}
