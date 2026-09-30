import { CircleHelp, Info, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { brl, brlShort, valuesHidden } from '../lib'
import { buildProducts, fetchRates, parseNumber, simulate, type ProductParams, type Rates } from '../invest'
import { useInvestStored } from '../investStore'

export interface SimSeed {
  initial: number
  monthly: number
  months: number
}

const HORIZONS = [12, 24, 60, 120]
const fmt = (n: number) => String(n).replace('.', ',')

function Learn({ id, label, onLearn }: { id: string; label: string; onLearn?: (id: string) => void }) {
  if (!onLearn) return null
  return <button type="button" className="learn" onClick={() => onLearn(id)} aria-label={`Entender: ${label}`} title={`O que é ${label}?`}><CircleHelp size={13} /></button>
}
const LEARN: Record<string, string> = { poupanca: 'poupanca', cdb_liquidez: 'cdb', cdb_prazo: 'cdb', lci: 'lci-lca', tesouro_selic: 'tesouro-selic', tesouro_ipca: 'tesouro-ipca' }
const tooltipStyle = { background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 10, color: '#f5f5f5' }

/** Simulador educativo: compara renda fixa com imposto e inflação; as taxas podem ser atualizadas pelo Banco Central. */
export function SimulatorTab({ seed, onLearn }: { seed: SimSeed; onLearn?: (id: string) => void }) {
  const [saved, setSaved] = useInvestStored()
  const { rates, params } = saved
  const [initial, setInitial] = useState(seed.initial ? fmt(seed.initial) : '10000')
  const [monthly, setMonthly] = useState(seed.monthly ? fmt(seed.monthly) : '500')
  const [months, setMonths] = useState(String(seed.months || 12))
  const [real, setReal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const n = Math.min(480, Math.max(1, Math.round(parseNumber(months)) || 1))
  const input = { initial: parseNumber(initial), monthly: parseNumber(monthly), months: n }
  const products = useMemo(() => buildProducts(rates, params), [rates, params])
  const results = useMemo(() => products.map((p) => ({ p, r: simulate(p, input, rates.ipca) })), [products, input.initial, input.monthly, input.months, rates.ipca]) // eslint-disable-line react-hooks/exhaustive-deps
  const best = results.reduce((b, x) => (x.r.net > b.r.net ? x : b), results[0])
  const invested = results[0]?.r.invested ?? 0
  const inflation = Math.pow(1 + rates.ipca / 100, n / 12) - 1

  const step = n > 120 ? 6 : n > 36 ? 3 : 1
  const chart = useMemo(() => {
    const out: Array<Record<string, number>> = []
    for (let t = 0; t <= n; t += step) {
      const f = real ? Math.pow(1 + rates.ipca / 100, t / 12) : 1
      const row: Record<string, number> = { month: t, invested: (input.initial + input.monthly * t) / (real ? f : 1) }
      for (const { p, r } of results) row[p.id] = Math.round((r.series[t]?.net ?? 0) / f)
      out.push(row)
    }
    return out
  }, [results, n, step, real, rates.ipca]) // eslint-disable-line react-hooks/exhaustive-deps

  const setRate = (k: keyof Rates, v: string) => setSaved((s) => ({ ...s, rates: { ...s.rates, [k]: parseNumber(v) } }))
  const setParam = (k: keyof ProductParams, v: string) => setSaved((s) => ({ ...s, params: { ...s.params, [k]: parseNumber(v) } }))

  const update = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await fetchRates()
      setSaved((s) => ({ ...s, rates: { selic: r.selic, cdi: r.cdi, ipca: r.ipca }, updated: r.date }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="invest-tab">
      <div className="card">
        <div className="card-head"><h3>Quanto você quer simular?</h3></div>
        <div className="form sim-form">
          <div className="row">
            <label>Valor inicial (R$)<input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} aria-label="Valor inicial" /></label>
            <label>Aporte por mês (R$)<input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} aria-label="Aporte mensal" /></label>
          </div>
          <label>
            Prazo (meses)
            <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} aria-label="Prazo em meses" />
          </label>
          <div className="segmented sm" role="group" aria-label="Prazos comuns">
            {HORIZONS.map((h) => (
              <button key={h} className={n === h ? 'on' : ''} aria-pressed={n === h} onClick={() => setMonths(String(h))}>{h >= 24 ? `${h / 12} anos` : '1 ano'}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Taxas (% ao ano)</h3>
          <button className="btn" onClick={() => void update()} disabled={busy}><RefreshCw size={15} /> {busy ? 'Buscando…' : 'Atualizar pelo Banco Central'}</button>
        </div>
        <div className="form">
          <div className="row three">
            <label><span>Selic <Learn id="selic" label="Selic" onLearn={onLearn} /></span><input inputMode="decimal" value={fmt(rates.selic)} onChange={(e) => setRate('selic', e.target.value)} aria-label="Taxa Selic" /></label>
            <label><span>CDI <Learn id="cdi" label="CDI" onLearn={onLearn} /></span><input inputMode="decimal" value={fmt(rates.cdi)} onChange={(e) => setRate('cdi', e.target.value)} aria-label="Taxa CDI" /></label>
            <label><span>Inflação (IPCA 12 meses) <Learn id="ipca" label="IPCA" onLearn={onLearn} /></span><input inputMode="decimal" value={fmt(rates.ipca)} onChange={(e) => setRate('ipca', e.target.value)} aria-label="Inflação IPCA" /></label>
          </div>
        </div>
        <p className="muted small" role="status">
          {saved.updated ? `Taxas do Banco Central de ${saved.updated}.` : 'Valores de exemplo (Selic de setembro de 2026). Atualize pelo Banco Central ou digite as taxas de hoje.'}
        </p>
        {error && <p className="bad-text small" role="alert">{error}</p>}
        <details className="sim-params">
          <summary>Ajustar os produtos</summary>
          <div className="form">
            <div className="row three">
              <label>CDB liquidez diária (% do CDI)<input inputMode="decimal" value={fmt(params.cdbLiquidez)} onChange={(e) => setParam('cdbLiquidez', e.target.value)} aria-label="CDB liquidez diária, percentual do CDI" /></label>
              <label>CDB com prazo (% do CDI)<input inputMode="decimal" value={fmt(params.cdbPrazo)} onChange={(e) => setParam('cdbPrazo', e.target.value)} aria-label="CDB com prazo, percentual do CDI" /></label>
              <label>LCI/LCA (% do CDI)<input inputMode="decimal" value={fmt(params.lci)} onChange={(e) => setParam('lci', e.target.value)} aria-label="LCI e LCA, percentual do CDI" /></label>
            </div>
            <label>Juro real do Tesouro IPCA+ (% ao ano, além da inflação)<input inputMode="decimal" value={fmt(params.ipcaReal)} onChange={(e) => setParam('ipcaReal', e.target.value)} aria-label="Juro real do Tesouro IPCA+" /></label>
          </div>
        </details>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Resultado em {n >= 12 && n % 12 === 0 ? `${n / 12} ${n === 12 ? 'ano' : 'anos'}` : `${n} ${n === 1 ? 'mês' : 'meses'}`}</h3>
          <span className="muted small">Total investido: <strong data-testid="sim-invested">{brl(invested)}</strong> · inflação no período: {(inflation * 100).toFixed(1).replace('.', ',')}%</span>
        </div>
        {invested === 0 ? (
          <p className="muted">Informe um valor inicial ou um aporte mensal para simular.</p>
        ) : (
          <div className="table-wrap">
            <table className="sim-table">
              <thead>
                <tr><th>Produto</th><th className="right">Valor líquido final</th><th className="right">Rendimento líquido</th><th className="right">Imposto <Learn id="ir-regressivo" label="imposto de renda regressivo" onLearn={onLearn} /></th><th className="right">Em valores de hoje</th></tr>
              </thead>
              <tbody>
                {results.map(({ p, r }) => (
                  <tr key={p.id} data-testid={`sim-${p.id}`} className={p.id === best.p.id ? 'best' : ''}>
                    <td>
                      <span className="dot" style={{ background: p.color }} /> <strong>{p.name}</strong>
                      {p.id === best.p.id && <span className="badge">Maior valor nesta simulação</span>}
                      <div className="muted small">Liquidez: {p.liquidity} · Risco: {p.risk} · FGC: {p.fgc} <Learn id={LEARN[p.id]} label={p.name.split(' (')[0]} onLearn={onLearn} /></div>
                    </td>
                    <td className="right" data-testid={`sim-net-${p.id}`}>{brl(r.net)}</td>
                    <td className={`right ${r.gain >= 0 ? 'pos' : ''}`}>{brl(r.gain)}</td>
                    <td className="right muted">{brl(r.tax)}</td>
                    <td className="right">{brl(r.real)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invested > 0 && (
        <div className="card chart-card">
          <div className="card-head">
            <h3>Evolução</h3>
            <label className="check-inline">
              <input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} /> Em valores de hoje (descontando a inflação)
            </label>
          </div>
          <div className="sim-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart accessibilityLayer={false} data={chart}>
                <CartesianGrid stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="month" stroke="#6b6b6b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(m: number) => (m % 12 === 0 ? `${m / 12}a` : '')} interval="preserveStartEnd" />
                <YAxis stroke="#6b6b6b" tickLine={false} axisLine={false} width={62} fontSize={11} tickFormatter={(v: number) => (valuesHidden() ? '' : brlShort(v))} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(m) => `Mês ${m}`} formatter={(v) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="invested" name="Total investido" stroke="#e9e9e9" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                {products.map((p) => (
                  <Line key={p.id} type="monotone" dataKey={p.id} name={p.name.split(' (')[0]} stroke={p.color} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card invest-note">
        <div className="card-head"><h3><Info size={15} /> Leia antes de decidir</h3></div>
        <ul className="plain">
          <li>É uma <strong>simulação educativa</strong>, não uma recomendação de investimento. As taxas mudam e os resultados reais podem ser diferentes.</li>
          <li>O imposto usa a tabela regressiva (22,5% até 180 dias; 20% até 360; 17,5% até 720; 15% acima), contada para cada aporte. LCI/LCA e poupança são isentas para pessoa física.</li>
          <li>Não entram: IOF (resgates em menos de 30 dias), taxas de corretora ou custódia, e a variação de preço do Tesouro se você vender antes do vencimento.</li>
          <li>O FGC protege depósitos e títulos bancários até um limite por CPF e por instituição; confira o valor e as regras atuais no site do FGC. Tesouro tem a garantia do governo federal.</li>
          <li>Produto de liquidez diária serve bem para reserva; o de prazo fixo serve para dinheiro que você não vai precisar antes. O rendimento maior não é tudo: veja liquidez e risco.</li>
        </ul>
      </div>
    </div>
  )
}
