import { CalendarClock } from 'lucide-react'
import { useState } from 'react'
import type { Forecast, ForecastItem } from '../forecast'
import { brl, formatDate } from '../lib'
import { Money } from './Money'

const SOURCE = { recorrente: 'recorrente', assinatura: 'assinatura', parcela: 'parcela', fatura: 'fatura' } as const

function Items({ items, sign }: { items: ForecastItem[]; sign: '+' | '−' }) {
  if (!items.length) return null
  return (
    <>
      {items.map((i) => (
        <li key={i.id}>
          <div className="grow">
            <strong>{i.name}</strong>
            <span className="muted small">{formatDate(i.date)} · {SOURCE[i.source]}{i.onCard ? ' · no cartão' : ''}</span>
          </div>
          <strong className={sign === '+' ? 'pos' : ''}>{sign} {brl(i.amount)}</strong>
        </li>
      ))}
    </>
  )
}

/** Previsão do mês: o que já aconteceu, o que ainda vai acontecer e quanto deve sobrar. */
export function ForecastCard({ f }: { f: Forecast }) {
  const [open, setOpen] = useState(false)
  const restIn = f.upcomingIncome.reduce((s, i) => s + i.amount, 0)
  const restOut = f.upcomingExpense.reduce((s, i) => s + i.amount, 0)
  const empty = f.upcomingIncome.length === 0 && f.upcomingExpense.length === 0
  return (
    <div className="card forecast">
      <div className="card-head">
        <h3><CalendarClock size={16} /> Previsão do mês</h3>
        <span className="muted small">até {formatDate(f.monthEnd)}</span>
      </div>
      <div className="forecast-main">
        <span className="muted small">Sobra prevista no mês</span>
        <div className={`stat-value ${f.leftover < 0 ? 'bad-text' : ''}`} data-testid="forecast-leftover"><Money value={f.leftover} /></div>
      </div>
      <div className="forecast-cols">
        <div>
          <span className="muted small">Receitas</span>
          <div>já entrou <strong>{brl(f.incomeSoFar)}</strong></div>
          <div className="muted">falta entrar <strong className="pos">{brl(restIn)}</strong></div>
        </div>
        <div>
          <span className="muted small">Despesas</span>
          <div>já saiu <strong>{brl(f.expenseSoFar)}</strong></div>
          <div className="muted">falta sair <strong>{brl(restOut)}</strong></div>
        </div>
      </div>
      {f.variableAvg > 0 && <p className="muted small">Renda variável: média de {brl(f.variableAvg)}/mês nos 3 meses anteriores (não incluída, não é garantida).</p>}
      {f.cash && (
        <p className="forecast-cash" data-testid="forecast-cash">
          Saldo previsto nas contas no fim do mês: <strong className={f.cash.expected < 0 ? 'bad-text' : ''}>{brl(f.cash.expected)}</strong>
          <span className="muted small"> (hoje {brl(f.cash.balance)} + entradas {brl(f.cash.income)} − saídas {brl(f.cash.outflows)} − faturas {brl(f.cash.invoices.reduce((s, i) => s + i.amount, 0))})</span>
        </p>
      )}
      {!empty && (
        <button className="link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Ocultar detalhes' : 'Ver o que falta acontecer'}</button>
      )}
      {open && (
        <ul className="list compact">
          <Items items={f.upcomingIncome} sign="+" />
          <Items items={f.upcomingExpense} sign="−" />
          {f.cash && <Items items={f.cash.invoices} sign="−" />}
        </ul>
      )}
    </div>
  )
}
