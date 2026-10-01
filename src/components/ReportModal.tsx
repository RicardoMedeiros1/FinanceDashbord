import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from '../categories'
import { brl, formatDate, toISO } from '../lib'
import { buildReport, reportMonths, type ReportInput } from '../report'
import { Modal } from './Modal'

const pct = (n: number) => `${Math.round(n * 100)}%`
const signed = (n: number) => `${n >= 0 ? '+' : '−'} ${brl(Math.abs(n))}`
const variation = (cur: number, prev: number) => (prev > 0 ? `${cur >= prev ? '+' : '−'}${Math.abs(Math.round(((cur - prev) / prev) * 100))}% vs. mês anterior` : 'sem mês anterior para comparar')

/** Relatório do mês, pronto para imprimir ou salvar como PDF (Imprimir → Salvar como PDF). */
export function ReportModal({ data, onClose }: { data: Omit<ReportInput, 'month' | 'today'>; onClose: () => void }) {
  const today = toISO(new Date())
  const months = useMemo(() => reportMonths(data.txs, today), [data.txs, today])
  const [month, setMonth] = useState(months[months.length - 1])
  const r = useMemo(() => buildReport({ ...data, month, today }), [data, month, today])
  const i = months.indexOf(month)

  // enquanto o relatório está aberto, a impressão mostra só ele
  useEffect(() => {
    document.body.classList.add('printing-report')
    return () => document.body.classList.remove('printing-report')
  }, [])

  return (
    <Modal title="Relatório do mês" onClose={onClose} wide>
      <div className="report-actions">
        <div className="report-nav">
          <button className="icon-btn" aria-label="Mês anterior" disabled={i <= 0} onClick={() => setMonth(months[i - 1])}><ChevronLeft size={16} /></button>
          <strong>{r.title}</strong>
          <button className="icon-btn" aria-label="Próximo mês" disabled={i >= months.length - 1} onClick={() => setMonth(months[i + 1])}><ChevronRight size={16} /></button>
        </div>
        <button className="btn primary" onClick={() => window.print()}><Printer size={15} /> Imprimir / salvar PDF</button>
      </div>

      <article className="report" aria-label={`Relatório de ${r.title}`}>
        <header className="report-head">
          <h2>Finn · {r.title}</h2>
          <p className="muted small">{r.partial ? `Parcial, até ${formatDate(toISO(new Date()))}` : 'Mês fechado'} · {r.count} {r.count === 1 ? 'lançamento' : 'lançamentos'}</p>
        </header>

        <section className="report-kpis">
          <div><span className="muted small">Receitas</span><strong data-testid="rp-income">{brl(r.income)}</strong><span className="muted small">{variation(r.income, r.prev.income)}</span></div>
          <div><span className="muted small">Despesas</span><strong data-testid="rp-expense">{brl(r.expense)}</strong><span className="muted small">{variation(r.expense, r.prev.expense)}</span></div>
          <div><span className="muted small">Saldo do mês</span><strong className={r.balance >= 0 ? 'pos' : 'bad-text'} data-testid="rp-balance">{signed(r.balance)}</strong><span className="muted small">{r.savingsRate === null ? 'sem receitas no mês' : `${pct(r.savingsRate)} da renda ${r.savingsRate >= 0 ? 'guardada' : 'acima do ganho'}`}</span></div>
        </section>

        {(r.incomeFixed > 0 || r.incomeVariable > 0) && (
          <p className="small report-line">
            Receita fixa (salário) <strong>{brl(r.incomeFixed)}</strong> · variável <strong>{brl(r.incomeVariable)}</strong>
            {r.workCosts > 0 && <> · custos do trabalho <strong>{brl(r.workCosts)}</strong> (líquido da renda variável <strong>{brl(r.incomeVariable - r.workCosts)}</strong>)</>}
          </p>
        )}

        <h3>Para onde foi o dinheiro</h3>
        {r.categories.length === 0 ? <p className="muted small">Nenhuma despesa neste mês.</p> : (
          <table className="report-table" aria-label="Despesas por categoria">
            <thead><tr><th>Categoria</th><th className="right">Total</th><th className="right">% das despesas</th><th className="right">vs. mês anterior</th></tr></thead>
            <tbody>
              {r.categories.map((c) => (
                <tr key={c.category}>
                  <td><span className="dot" style={{ background: CATEGORIES[c.category].color }} /> {CATEGORIES[c.category].label}</td>
                  <td className="right">{brl(c.total)}</td>
                  <td className="right">{pct(c.share)}</td>
                  <td className="right">{c.delta === null ? '—' : `${c.delta >= 0 ? '+' : '−'}${Math.abs(Math.round(c.delta * 100))}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {r.merchants.length > 0 && (
          <>
            <h3>Onde mais gastou</h3>
            <table className="report-table" aria-label="Estabelecimentos">
              <thead><tr><th>Estabelecimento</th><th className="right">Compras</th><th className="right">Total</th></tr></thead>
              <tbody>{r.merchants.map((m) => <tr key={m.key}><td>{m.name}</td><td className="right">{m.count}</td><td className="right">{brl(m.total)}</td></tr>)}</tbody>
            </table>
          </>
        )}

        {r.biggest.length > 0 && (
          <>
            <h3>Maiores despesas</h3>
            <table className="report-table" aria-label="Maiores despesas">
              <thead><tr><th>Descrição</th><th>Data</th><th className="right">Valor</th></tr></thead>
              <tbody>{r.biggest.map((t) => <tr key={t.id}><td>{t.description}</td><td>{formatDate(t.date)}</td><td className="right">{brl(t.amount)}</td></tr>)}</tbody>
            </table>
          </>
        )}

        {(r.budgets.length > 0 || r.groups.length > 0) && (
          <>
            <h3>Orçamentos e limites</h3>
            <table className="report-table" aria-label="Orçamentos e limites">
              <thead><tr><th>Item</th><th className="right">Gasto</th><th className="right">Limite</th><th className="right">Uso</th></tr></thead>
              <tbody>
                {r.budgets.map((b) => (
                  <tr key={b.category} className={b.state === 'over' ? 'row-over' : ''}>
                    <td>{CATEGORIES[b.category].label}</td><td className="right">{brl(b.spent)}</td><td className="right">{brl(b.limit)}</td>
                    <td className="right">{Math.round(b.pct)}%{b.state === 'over' ? ' — estourou' : ''}</td>
                  </tr>
                ))}
                {r.groups.map((g) => (
                  <tr key={g.group.id} className={g.state === 'over' ? 'row-over' : ''}>
                    <td>{g.group.name} (grupo)</td><td className="right">{brl(g.spent)}</td><td className="right">{brl(g.group.limit)}</td>
                    <td className="right">{Math.round(g.pct)}%{g.state === 'over' ? ' — estourou' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3>Contas e compromissos</h3>
        <ul className="report-list">
          {r.accounts && <li>Saldo nas contas: <strong>{brl(r.accounts.total)}</strong>{r.accounts.change !== null && <> ({signed(r.accounts.change)} no mês)</>}</li>}
          <li>Assinaturas ativas: <strong>{r.subsCount}</strong>, somando <strong>{brl(r.subsMonthly)}</strong> por mês</li>
        </ul>

        <p className="muted small report-foot">Gerado pelo Finn em {formatDate(toISO(new Date()))}. Valores calculados a partir dos lançamentos do app.</p>
      </article>
    </Modal>
  )
}
