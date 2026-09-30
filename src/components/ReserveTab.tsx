import { Info } from 'lucide-react'
import { accountBalance } from '../accounts'
import { brl } from '../lib'
import { parseNumber } from '../invest'
import { DEFAULT_RESERVE, reserveStatus, type ReserveSettings } from '../reserve'
import type { Account, Transaction, Transfer } from '../types'
import { useState } from 'react'

interface Props {
  txs: Transaction[]
  accounts: Account[]
  transfers: Transfer[]
  settings?: ReserveSettings
  onChange: (s: ReserveSettings) => void
  onSimulate: (seed: { initial: number; monthly: number; months: number }) => void
}

const MONTHS = [3, 6, 9, 12]

/** Reserva de emergência: meta (meses de despesa), quanto já existe e como chegar lá. */
export function ReserveTab({ txs, accounts, transfers, settings, onChange, onSimulate }: Props) {
  const s = { ...DEFAULT_RESERVE, ...settings }
  const st = reserveStatus(s, txs, accounts, transfers)
  const effectiveIds = s.accountIds ?? accounts.filter((a) => a.kind === 'savings').map((a) => a.id)
  const [extra, setExtra] = useState(s.extra ? String(s.extra).replace('.', ',') : '')
  const toggleAccount = (id: string) => onChange({ ...s, accountIds: effectiveIds.includes(id) ? effectiveIds.filter((x) => x !== id) : [...effectiveIds, id] })
  const pct = Math.round(st.progress * 100)

  return (
    <div className="invest-tab">
      <div className="card reserve-hero">
        <div className="card-head">
          <h3>Sua reserva de emergência</h3>
          <div className="segmented sm" role="group" aria-label="Meses de despesa na reserva">
            {MONTHS.map((m) => (
              <button key={m} className={s.months === m ? 'on' : ''} aria-pressed={s.months === m} onClick={() => onChange({ ...s, months: m })}>{m} meses</button>
            ))}
          </div>
        </div>

        {st.target === 0 ? (
          <p className="muted">Ainda não há despesas registradas para calcular a meta. Lance ou importe alguns gastos (Transações) e volte aqui.</p>
        ) : (
          <>
            <div className="reserve-numbers">
              <div><span className="muted">Guardado</span><strong data-testid="reserve-saved">{brl(st.saved)}</strong></div>
              <div><span className="muted">Meta ({s.months} meses)</span><strong data-testid="reserve-target">{brl(st.target)}</strong></div>
              <div><span className="muted">{st.done ? 'Sobrando' : 'Faltam'}</span><strong data-testid="reserve-missing">{brl(st.done ? st.saved - st.target : st.missing)}</strong></div>
            </div>
            <div className="bar big" role="progressbar" aria-label="Progresso da reserva" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div>
            <p className="reserve-msg" role="status">
              {st.done
                ? `Reserva completa: o que você tem guardado cobre cerca de ${st.covered.toFixed(1).replace('.', ',')} meses de despesas.`
                : `Você já tem ${pct}% da meta: cobre cerca de ${st.covered.toFixed(1).replace('.', ',')} ${st.covered === 1 ? 'mês' : 'meses'} de despesas.`}
            </p>
          </>
        )}

        <div className="reserve-base muted small">
          {st.monthsUsed > 0
            ? `Despesa média: ${brl(st.monthlyExpense)} por mês (média dos últimos ${st.monthsUsed} ${st.monthsUsed === 1 ? 'mês fechado' : 'meses fechados'}).`
            : st.monthlyExpense > 0
              ? `Despesa do mês atual até hoje: ${brl(st.monthlyExpense)}. Quando houver um mês fechado, a média passa a usá-lo.`
              : 'Sem despesas registradas ainda.'}
          <label className="check-inline">
            <input type="checkbox" checked={s.essentialOnly} onChange={(e) => onChange({ ...s, essentialOnly: e.target.checked })} />
            Contar só gastos essenciais (moradia, alimentação, transporte, saúde, educação, custos do trabalho)
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>O que conta como reserva</h3></div>
        {accounts.length === 0 ? (
          <p className="muted small">Você ainda não cadastrou contas. Cadastre uma conta do tipo <em>Poupança / reserva</em> em Cartões e contas, ou informe abaixo o valor guardado.</p>
        ) : (
          <ul className="list compact">
            {accounts.map((a) => (
              <li key={a.id}>
                <label className="check-inline reserve-acc">
                  <input type="checkbox" checked={effectiveIds.includes(a.id)} onChange={() => toggleAccount(a.id)} aria-label={`Contar ${a.name} como reserva`} />
                  <span>{a.name}</span>
                </label>
                <strong>{brl(accountBalance(a, txs, transfers, accounts))}</strong>
              </li>
            ))}
          </ul>
        )}
        <label className="form-inline">
          Guardado fora do app (R$)
          <input inputMode="decimal" value={extra} placeholder="0,00" onChange={(e) => { setExtra(e.target.value); onChange({ ...s, extra: parseNumber(e.target.value) }) }} aria-label="Valor guardado fora do app" />
        </label>
        <p className="muted small">Por padrão contam as contas do tipo Poupança / reserva. Marque outras se fizer sentido para você.</p>
      </div>

      {st.target > 0 && !st.done && (
        <div className="card">
          <div className="card-head"><h3>Como chegar lá</h3></div>
          <ul className="reserve-plan">
            <li>
              {st.surplus > 0
                ? <>Sua sobra média é de <strong>{brl(st.surplus)}</strong> por mês: guardando tudo, leva cerca de <strong>{st.monthsToGoal} {st.monthsToGoal === 1 ? 'mês' : 'meses'}</strong>.</>
                : <>Hoje, em média, não sobra dinheiro no mês. Veja em <em>Transações → Onde gasto</em> onde dá para reduzir.</>}
            </li>
            <li>Para chegar em <strong>12 meses</strong>: {brl(st.perMonthIn(12))} por mês.</li>
            <li>Para chegar em <strong>24 meses</strong>: {brl(st.perMonthIn(24))} por mês.</li>
          </ul>
          <button className="btn" onClick={() => onSimulate({ initial: Math.round(st.saved), monthly: Math.ceil(st.perMonthIn(12)), months: 12 })}>Simular onde deixar esse dinheiro</button>
        </div>
      )}

      <div className="card invest-note">
        <div className="card-head"><h3><Info size={15} /> Como funciona</h3></div>
        <ul className="plain">
          <li>A reserva de emergência é dinheiro para imprevistos: perda de renda, problema de saúde, conserto urgente.</li>
          <li>Uma regra comum é guardar de <strong>3 a 6 meses</strong> de despesas. Quem tem renda que varia (como Uber e freelas) costuma mirar <strong>6 a 12 meses</strong>.</li>
          <li>O objetivo dela não é render o máximo, e sim estar <strong>disponível na hora</strong> e não perder valor. Por isso costuma ficar em produtos de liquidez diária e baixo risco; compare no simulador.</li>
          <li>Só depois da reserva faz sentido pensar em investir para objetivos de prazo maior.</li>
        </ul>
        <p className="muted small">Informação geral e educativa; não é recomendação de investimento.</p>
      </div>
    </div>
  )
}
