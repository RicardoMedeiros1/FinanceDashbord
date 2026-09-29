import { Landmark, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORIES } from '../categories'
import { Insights } from '../components/Insights'
import { StatCard } from '../components/StatCard'
import { buildInsights, spendByCategory } from '../insights'
import { brl, brlShort, daysUntil, formatDate, inMonth, monthKey, monthLabel, nextCharge, shiftMonth, sumBy, toISO } from '../lib'
import type { Budget, Page, Subscription, Transaction } from '../types'

const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

const tooltipStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
}

export function Overview({ txs, subs, budgets, onNavigate }: { txs: Transaction[]; subs: Subscription[]; budgets: Budget[]; onNavigate: (p: Page) => void }) {
  const now = new Date()
  const cur = monthKey(now)
  const prev = monthKey(shiftMonth(now, -1))

  const m = useMemo(() => {
    const c = txs.filter((t) => inMonth(t, cur))
    const p = txs.filter((t) => inMonth(t, prev))
    return { income: sumBy(c, 'income'), expense: sumBy(c, 'expense'), pIncome: sumBy(p, 'income'), pExpense: sumBy(p, 'expense') }
  }, [txs, cur, prev])

  const balance = m.income - m.expense
  const pBalance = m.pIncome - m.pExpense
  const rate = m.income > 0 ? (balance / m.income) * 100 : 0

  const series = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = shiftMonth(now, i - 5)
        const k = monthKey(d)
        const list = txs.filter((t) => inMonth(t, k))
        return { name: monthLabel(d), Receitas: sumBy(list, 'income'), Despesas: sumBy(list, 'expense') }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txs, cur],
  )

  const categories = useMemo(
    () =>
      [...spendByCategory(txs.filter((t) => inMonth(t, cur)))]
        .map(([id, value]) => ({ id, name: CATEGORIES[id].label, value, color: CATEGORIES[id].color }))
        .sort((a, b) => b.value - a.value),
    [txs, cur],
  )

  const insights = useMemo(() => buildInsights(txs, subs, budgets), [txs, subs, budgets])

  const upcoming = subs
    .filter((s) => s.active)
    .map((s) => ({ s, date: nextCharge(s) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 4)

  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <>
      <div className="grid stats">
        <StatCard label="Saldo do mês" value={brl(balance)} icon={<Landmark size={16} />} delta={pBalance > 0 ? pct(balance, pBalance) : null} />
        <StatCard label="Receitas" value={brl(m.income)} icon={<TrendingUp size={16} />} delta={pct(m.income, m.pIncome)} />
        <StatCard label="Despesas" value={brl(m.expense)} icon={<TrendingDown size={16} />} delta={pct(m.expense, m.pExpense)} invert />
        <StatCard label="Taxa de poupança" value={`${rate.toFixed(0)}%`} icon={<PiggyBank size={16} />} hint="da renda do mês" />
      </div>

      <div className="grid main">
        <div className="card chart-card">
          <div className="card-head">
            <h3>Receitas x Despesas</h3>
            <span className="muted small">últimos 6 meses</span>
          </div>
          <div className="chart-fill">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={brlShort} width={64} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v) => brl(Number(v))} />
              <Bar dataKey="Receitas" fill="var(--green)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Despesas" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <Insights items={insights} />

        <div className="card">
          <div className="card-head">
            <h3>Gastos por categoria</h3>
            <span className="muted small">mês atual</span>
          </div>
          {categories.length === 0 ? (
            <p className="muted">Nenhuma despesa neste mês.</p>
          ) : (
            <div className="donut-wrap">
              <div className="donut">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categories} dataKey="value" innerRadius={56} outerRadius={82} paddingAngle={3} stroke="none">
                      {categories.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span className="muted small">Total</span>
                  <strong>{brl(m.expense)}</strong>
                </div>
              </div>
              <ul className="legend">
                {categories.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <span className="dot" style={{ background: c.color }} />
                    <span>{c.name}</span>
                    <strong>{brl(c.value)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Próximas cobranças</h3>
            <button className="link" onClick={() => onNavigate('subscriptions')}>Ver todas</button>
          </div>
          <ul className="list">
            {upcoming.map(({ s, date }) => {
              const d = daysUntil(date)
              return (
                <li key={s.id}>
                  <span className="logo" style={{ background: s.color }}>{s.name[0]}</span>
                  <div className="grow">
                    <strong>{s.name}</strong>
                    <span className="muted small">{d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `em ${d} dias`} · {formatDate(toISO(date))}</span>
                  </div>
                  <strong>{brl(s.price)}</strong>
                </li>
              )
            })}
            {upcoming.length === 0 && <li className="muted">Nenhuma assinatura ativa.</li>}
          </ul>
        </div>

        <div className="card wide">
          <div className="card-head">
            <h3>Transações recentes</h3>
            <button className="link" onClick={() => onNavigate('transactions')}>Ver todas</button>
          </div>
          <ul className="list">
            {recent.map((t) => (
              <li key={t.id}>
                <span className="dot lg" style={{ background: CATEGORIES[t.category].color }} />
                <div className="grow">
                  <strong>{t.description}</strong>
                  <span className="muted small">{CATEGORIES[t.category].label} · {formatDate(t.date)}</span>
                </div>
                <strong className={t.type === 'income' ? 'pos' : ''}>{t.type === 'income' ? '+' : '−'} {brl(t.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
