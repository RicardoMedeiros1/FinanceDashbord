import { Check, Circle, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { brl } from '../lib'
import { conceptById, CONCEPTS, GROUP_LABEL, searchConcepts, type Concept, type ConceptCtx, type Group } from '../concepts'
import { parseNumber } from '../invest'
import { useInvestStored } from '../investStore'
import { installmentStatus } from '../lib'
import { DEFAULT_RESERVE, reserveStatus, type ReserveSettings } from '../reserve'
import type { Account, Installment, Page, Transaction, Transfer } from '../types'

interface Props {
  txs: Transaction[]
  accounts: Account[]
  transfers: Transfer[]
  installments: Installment[]
  reserve?: ReserveSettings
  focus: string | null
  onTab: (t: 'reserve' | 'simulator') => void
  onGo: (p: Page, sub?: string) => void
}

const fmt = (n: number) => String(n).replace('.', ',')

function CompoundTool({ defaultRate }: { defaultRate: number }) {
  const [amount, setAmount] = useState('1000')
  const [rate, setRate] = useState(fmt(defaultRate))
  const [years, setYears] = useState('10')
  const a = parseNumber(amount)
  const r = parseNumber(rate) / 100
  const y = Math.min(80, parseNumber(years))
  const compound = a * Math.pow(1 + r, y)
  const simple = a * (1 + r * y)
  const double = r > 0 ? Math.log(2) / Math.log(1 + r) : 0
  return (
    <div className="concept-tool" role="group" aria-label="Calculadora de juros compostos">
      <div className="row three">
        <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Valor para juros compostos" /></label>
        <label>Taxa (% ao ano)<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Taxa para juros compostos" /></label>
        <label>Anos<input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} aria-label="Anos para juros compostos" /></label>
      </div>
      <div className="concept-results">
        <div><span className="muted small">Juros compostos</span><strong data-testid="compound-result">{brl(compound)}</strong></div>
        <div><span className="muted small">Juros simples</span><strong data-testid="simple-result">{brl(simple)}</strong></div>
        <div><span className="muted small">Dobra em</span><strong>{double > 0 ? `${fmt(Math.round(double * 10) / 10)} anos` : '—'}</strong></div>
      </div>
    </div>
  )
}

function InflationTool({ defaultRate }: { defaultRate: number }) {
  const [amount, setAmount] = useState('1000')
  const [rate, setRate] = useState(fmt(defaultRate))
  const [years, setYears] = useState('10')
  const a = parseNumber(amount)
  const r = parseNumber(rate) / 100
  const y = Math.min(80, parseNumber(years))
  const power = a / Math.pow(1 + r, y)
  const needed = a * Math.pow(1 + r, y)
  return (
    <div className="concept-tool" role="group" aria-label="Calculadora de inflação">
      <div className="row three">
        <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Valor para inflação" /></label>
        <label>Inflação (% ao ano)<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Inflação ao ano" /></label>
        <label>Anos<input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} aria-label="Anos para inflação" /></label>
      </div>
      <div className="concept-results">
        <div><span className="muted small">Poder de compra de hoje, parado</span><strong data-testid="inflation-power">{brl(power)}</strong></div>
        <div><span className="muted small">Para manter o poder de compra</span><strong data-testid="inflation-needed">{brl(needed)}</strong></div>
      </div>
    </div>
  )
}

/** Glossário de investimentos em português simples, com exemplos das suas taxas e uma trilha do que fazer primeiro. */
export function ConceptsTab({ txs, accounts, transfers, installments, reserve, focus, onTab, onGo }: Props) {
  const [saved] = useInvestStored()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<Group | 'all'>('all')
  const [open, setOpen] = useState<Set<string>>(() => new Set(focus ? [focus] : []))
  const refs = useRef<Record<string, HTMLDetailsElement | null>>({})

  const settings = { ...DEFAULT_RESERVE, ...reserve }
  const st = useMemo(() => reserveStatus(settings, txs, accounts, transfers), [settings.months, settings.essentialOnly, settings.extra, settings.accountIds, txs, accounts, transfers]) // eslint-disable-line react-hooks/exhaustive-deps
  const ctx: ConceptCtx = { rates: saved.rates, params: saved.params, updated: saved.updated, reserve: { target: st.target, months: settings.months, monthlyExpense: st.monthlyExpense, saved: st.saved } }

  // vindo de um "?" do simulador: abre e rola até o conceito
  useEffect(() => {
    if (!focus) return
    setQuery('')
    setGroup('all')
    setOpen((s) => new Set(s).add(focus))
    const t = setTimeout(() => refs.current[focus]?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50)
    return () => clearTimeout(t)
  }, [focus])

  const list = useMemo(() => searchConcepts(CONCEPTS.filter((c) => group === 'all' || c.group === group), query), [group, query])
  const show = (id: string) => {
    setQuery('')
    setGroup('all')
    setOpen((s) => new Set(s).add(id))
    setTimeout(() => refs.current[id]?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50)
  }

  const debts = installments.map((i) => ({ i, st: installmentStatus(i) })).filter((x) => x.st.remaining > 0)
  const debtMonthly = debts.reduce((s, x) => s + x.i.amount, 0)

  const steps: Array<{ id: string; title: string; text: string; state: 'done' | 'todo' | 'info'; action?: { label: string; run: () => void } }> = [
    {
      id: 'fluxo',
      title: 'Saiba para onde vai o seu dinheiro',
      state: st.monthsUsed > 0 ? 'done' : 'todo',
      text: st.monthsUsed > 0 ? `Você já tem histórico de ${st.monthsUsed} ${st.monthsUsed === 1 ? 'mês fechado' : 'meses fechados'}. Sua despesa média é de ${brl(st.monthlyExpense)} por mês.` : 'Registre ou importe alguns meses de despesas: é com eles que o app calcula a sua média e a sua reserva.',
      action: { label: 'Ver onde gasto', run: () => onGo('transactions', 'merchants') },
    },
    {
      id: 'dividas',
      title: 'Cuide das dívidas caras primeiro',
      state: 'info',
      text: `Juros de cartão rotativo e cheque especial costumam ser muito maiores que o rendimento de qualquer investimento; quitar essas dívidas costuma valer mais que investir.${debts.length ? ` Você tem ${debts.length} ${debts.length === 1 ? 'parcelamento' : 'parcelamentos'} em aberto (${brl(debtMonthly)} por mês): confira se têm juros.` : ''}`,
      action: debts.length ? { label: 'Ver parcelas', run: () => onGo('subscriptions', 'installments') } : undefined,
    },
    {
      id: 'reserva',
      title: 'Monte a reserva de emergência',
      state: st.done ? 'done' : 'todo',
      text: st.target === 0 ? 'Assim que houver despesas registradas, o app calcula a sua meta.' : st.done ? `Reserva completa: ${brl(st.saved)} cobrem cerca de ${fmt(Math.round(st.covered * 10) / 10)} meses de despesas.` : `Você está em ${Math.round(st.progress * 100)}% da meta de ${brl(st.target)}.`,
      action: { label: 'Ver a minha reserva', run: () => onTab('reserve') },
    },
    {
      id: 'simular',
      title: 'Compare os produtos no simulador',
      state: 'info',
      text: 'Veja poupança, CDB, LCI/LCA e Tesouro lado a lado, com imposto, inflação, liquidez e risco.',
      action: { label: 'Abrir o simulador', run: () => onTab('simulator') },
    },
    {
      id: 'objetivos',
      title: 'Defina objetivos e prazos',
      state: 'info',
      text: 'Dinheiro para logo pede liquidez e segurança; para o longo prazo dá para aceitar mais oscilação.',
      action: { label: 'Entender objetivo e prazo', run: () => show('prazo-objetivo') },
    },
    {
      id: 'variavel',
      title: 'Só depois, estude renda variável',
      state: 'info',
      text: 'Ações e fundos podem render mais, mas oscilam e podem dar prejuízo. Estude antes e, se decidir entrar, comece com pouco.',
      action: { label: 'Renda fixa x variável', run: () => show('renda-fixa-variavel') },
    },
  ]

  return (
    <div className="invest-tab">
      <div className="card">
        <div className="card-head"><h3>Por onde começar</h3></div>
        <p className="muted small">Uma ordem que educadores financeiros costumam sugerir. Os passos com visto usam os seus dados.</p>
        <ol className="trail">
          {steps.map((s) => (
            <li key={s.id} className={s.state} data-testid={`trail-${s.id}`}>
              <span className="trail-mark" aria-hidden>{s.state === 'done' ? <Check size={13} /> : <Circle size={9} />}</span>
              <div className="grow">
                <strong>{s.title}</strong>
                {s.state === 'done' && <span className="sr-only"> (concluído)</span>}
                <span className="muted small">{s.text}</span>
              </div>
              {s.action && <button className="pill-btn" onClick={s.action.run}>{s.action.label}</button>}
            </li>
          ))}
        </ol>
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input aria-label="Buscar conceito" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: CDI, Selic, FGC, liquidez…" />
        </div>
        <div className="segmented" role="group" aria-label="Tema">
          {(['all', ...(Object.keys(GROUP_LABEL) as Group[])] as Array<Group | 'all'>).map((g) => (
            <button key={g} className={group === g ? 'on' : ''} aria-pressed={group === g} onClick={() => setGroup(g)}>{g === 'all' ? 'Todos' : GROUP_LABEL[g]}</button>
          ))}
        </div>
      </div>

      <div className="concepts">
        {list.map((c: Concept) => (
          <details
            key={c.id}
            className="card concept"
            id={`concept-${c.id}`}
            ref={(el) => { refs.current[c.id] = el }}
            open={open.has(c.id)}
            onToggle={(e) => {
              const isOpen = (e.currentTarget as HTMLDetailsElement).open
              setOpen((s) => { const n = new Set(s); if (isOpen) n.add(c.id); else n.delete(c.id); return n })
            }}
          >
            <summary>
              <span className="tag" style={{ '--c': '#8b8b8b' } as React.CSSProperties}>{GROUP_LABEL[c.group]}</span>
              <strong>{c.title}</strong>
              <span className="muted small">{c.short}</span>
            </summary>
            <div className="concept-body">
              {c.body.map((p, i) => <p key={i}>{p}</p>)}
              {c.example && <p className="concept-example"><strong>Com as suas taxas:</strong> {c.example(ctx)}</p>}
              {c.tool === 'compound' && <CompoundTool defaultRate={saved.rates.cdi} />}
              {c.tool === 'inflation' && <InflationTool defaultRate={saved.rates.ipca} />}
              <div className="concept-foot">
                {c.action && <button className="btn" onClick={() => onTab(c.action!.to)}>{c.action.label}</button>}
                {c.related && c.related.length > 0 && (
                  <span className="muted small">
                    Veja também:{' '}
                    {c.related.map((id, i) => (
                      <span key={id}>{i > 0 ? ', ' : ''}<button className="link" onClick={() => show(id)}>{conceptById(id)?.title ?? id}</button></span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </details>
        ))}
        {list.length === 0 && <p className="muted empty-rules">Nenhum conceito encontrado. Tente outra palavra.</p>}
      </div>
      <p className="muted small">Conteúdo educativo e geral. Não é recomendação de investimento; regras, limites e taxas mudam, então confira sempre nas fontes oficiais (Banco Central, Tesouro Direto, FGC, sua instituição).</p>
    </div>
  )
}
