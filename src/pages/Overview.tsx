import { CreditCard, Landmark, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORIES } from '../categories'
import { GoalsCard } from '../components/GoalsCard'
import { Insights } from '../components/Insights'
import { Money } from '../components/Money'
import { StatCard } from '../components/StatCard'
import { buildInsights } from '../insights'
import { brl, brlShort, daysUntil, formatDate, installmentStatus, parseISO, inMonth, monthKey, monthLabel, monthlyCost, nextCharge, shiftMonth, sumBy, toISO } from '../lib'
import { nextInvoiceToPay } from '../cards'
import type { Budget, Card, Goal, Installment, Page, Subscription, Transaction } from '../types'

const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

const tooltipStyle = { background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 10, color: '#f5f5f5' }

interface Props {
  txs: Transaction[]
  subs: Subscription[]
  installments: Installment[]
  cards: Card[]
  budgets: Budget[]
  goals: Goal[]
  onNavigate: (p: Page) => void
  onAddGoal: (g: Omit<Goal, 'id' | 'saved'>) => void
  onDeposit: (id: string, amount: number) => void
}

export function Overview({ txs, subs, installments, cards, budgets, goals, onNavigate, onAddGoal, onDeposit }: Props) {
  const [range, setRange] = useState<'30d' | '6m'>('30d')

  const months = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = shiftMonth(new Date(), i - 5)
        const list = txs.filter((t) => inMonth(t, monthKey(d)))
        const income = sumBy(list, 'income')
        const expense = sumBy(list, 'expense')
        return { name: monthLabel(d), Receitas: income, Despesas: expense, balance: income - expense }
      }),
    [txs],
  )
  const m = months[5]
  const p = months[4]

  // detalhamento da receita do mês: salário fixo x renda variável
  const curKey = monthKey(new Date())
  const inc = (cat: string) => txs.filter((t) => t.type === 'income' && t.category === cat && inMonth(t, curKey)).reduce((a, t) => a + t.amount, 0)
  const fixedIn = inc('salario')
  const varIn = inc('variavel')
  const incomeSplit = fixedIn > 0 || varIn > 0 ? `Fixa ${brlShort(fixedIn)} · Variável ${brlShort(varIn)}` : undefined

  const activeSubs = subs.filter((s) => s.active)
  const subsMonthly = activeSubs.reduce((s, x) => s + monthlyCost(x), 0)

  const daily = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        const iso = toISO(d)
        const list = txs.filter((t) => t.date === iso)
        return { name: String(d.getDate()).padStart(2, '0'), Receitas: sumBy(list, 'income'), Despesas: sumBy(list, 'expense') }
      }),
    [txs],
  )

  const insights = useMemo(() => buildInsights(txs, subs, budgets, installments, cards), [txs, subs, budgets, installments, cards])

  const upcoming = [
    ...activeSubs.map((x) => ({ id: x.id, name: x.name, color: x.color, date: nextCharge(x), price: x.price, note: '' })),
    ...installments.flatMap((x) => {
      const st = installmentStatus(x)
      return st.next ? [{ id: x.id, name: x.name, color: x.color, date: parseISO(st.next), price: x.amount, note: `parcela ${st.paid + 1}/${x.count}` }] : []
    }),
    ...cards.flatMap((c) => {
      const inv = nextInvoiceToPay(c, txs)
      return inv.total > 0 ? [{ id: `card-${c.id}`, name: `Fatura ${c.name}`, color: c.color, date: parseISO(inv.due), price: inv.total, note: inv.status === 'open' ? 'em aberto' : 'fechada' }] : []
    }),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6)

  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const chart = range === '30d' ? daily : months

  return (
    <>
      <div className="grid stats">
        <StatCard label="Saldo do mês" icon={<Landmark size={13} />} value={<Money value={m.balance} />} spark={months.map((x) => x.balance)} color="#3b6ef5" delta={p.balance > 0 ? pct(m.balance, p.balance) : null} />
        <StatCard label="Receitas" icon={<TrendingUp size={13} />} value={<Money value={m.Receitas} />} spark={months.map((x) => x.Receitas)} color="#8b3ff5" delta={pct(m.Receitas, p.Receitas)} foot={incomeSplit} />
        <StatCard label="Despesas" icon={<TrendingDown size={13} />} value={<Money value={m.Despesas} />} spark={months.map((x) => x.Despesas)} color="#e0600f" delta={pct(m.Despesas, p.Despesas)} invert />
        <StatCard label="Assinaturas / mês" icon={<CreditCard size={13} />} value={<Money value={subsMonthly} />} spark={activeSubs.map((s) => monthlyCost(s))} color="#e84a45" foot={`${activeSubs.length} ativas`} />
      </div>

      <div className="grid main">
        <div className="col">
          <div className="card chart-card">
            <div className="card-head">
              <h3>Fluxo de caixa</h3>
              <div className="segmented sm">
                <button className={range === '30d' ? 'on' : ''} onClick={() => setRange('30d')}>30 dias</button>
                <button className={range === '6m' ? 'on' : ''} onClick={() => setRange('6m')}>6 meses</button>
              </div>
            </div>
            <div className="chart-fill">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} barGap={1} barCategoryGap={range === '30d' ? '18%' : '30%'}>
                  <CartesianGrid stroke="#1f1f1f" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b6b6b" tickLine={false} axisLine={false} interval={range === '30d' ? 4 : 0} fontSize={11} />
                  <YAxis stroke="#6b6b6b" tickLine={false} axisLine={false} tickFormatter={brlShort} width={62} fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v) => brl(Number(v))} />
                  <Bar dataKey="Despesas" fill="#e9e9e9" radius={[2, 2, 0, 0]} />
                  {range === '6m' && <Bar dataKey="Receitas" fill="#e0600f" radius={[2, 2, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              <span><i style={{ background: '#e9e9e9' }} /> Despesas</span>
              {range === '6m' && <span><i style={{ background: '#e0600f' }} /> Receitas</span>}
            </div>
          </div>

          <div className="card">
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
            {recent.length === 0 && <p className="muted">Nenhuma transação ainda. Toque em “Nova transação” para começar.</p>}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-head">
              <h3>Próximos pagamentos</h3>
              <button className="link" onClick={() => onNavigate('subscriptions')}>Ver todos</button>
            </div>
            <ul className="list compact">
              {upcoming.map((s) => {
                const date = s.date
                const d = daysUntil(date)
                return (
                  <li key={s.id}>
                    <span className="logo" style={{ background: s.color }}>{s.name[0]}</span>
                    <div className="grow">
                      <strong>{s.name}</strong>
                      <span className="muted small">{d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : formatDate(toISO(date))}{s.note ? ` · ${s.note}` : ''}</span>
                    </div>
                    <strong>{brl(s.price)}</strong>
                  </li>
                )
              })}
              {upcoming.length === 0 && <li className="muted">Nenhum pagamento à vista.</li>}
            </ul>
          </div>
          <Insights items={insights} onNavigate={onNavigate} />
          <GoalsCard goals={goals} onAdd={onAddGoal} onDeposit={onDeposit} />
        </div>
      </div>
    </>
  )
}
