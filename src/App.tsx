import { Database, Eye, EyeOff, Landmark, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cloudReceiptStore, localReceiptStore, prepareFile, type ReceiptMeta } from './cloud/receipts'
import { applyChanges, COLS, countLocal, SyncEngine, type Change, type Col, type Collections, type SyncStatus } from './cloud/sync'
import type { Auth } from './cloud/types'
import { BankModal, type BankState } from './components/BankModal'
import { DataModal } from './components/DataModal'
import { InstallmentDetail } from './components/InstallmentDetail'
import { Onboarding, type OnboardingStep } from './components/Onboarding'
import { Modal } from './components/Modal'
import { ReceiptViewer } from './components/ReceiptViewer'
import { Sidebar } from './components/Sidebar'
import { SyncBadge } from './components/SyncBadge'
import { TransactionForm } from './components/TransactionForm'
import { needsAutoSync, planSync, syncRequest } from './openfinance'
import { convertedIds, matchToTransfer, singleToTransfer, type TransferMatch } from './transfers'
import { seedBudgets, seedGoals, seedSubscriptions, seedTransactions } from './data'
import { applyInstallments, applyRecurring, applySubscriptions, initialChargedUntil, installmentStatus, missingInstallmentTxs, setHideValues, skipToToday, uid } from './lib'
import { Assistant } from './pages/Assistant'
import { Budgets } from './pages/Budgets'
import { Overview } from './pages/Overview'
import { Subscriptions, type SubsTab } from './pages/Subscriptions'
import { Transactions, type TxView } from './pages/Transactions'
import { Cards, type CardsTab } from './pages/Cards'
import { Invest, type InvestTab } from './pages/Invest'
import type { Account, BankLink, Budget, SpendGroup, Card, CategoryId, Cycle, Goal, Installment, Page, Profile, Recurring, Subscription, Transaction, Transfer } from './types'
import { useStored } from './useStored'

const TITLES: Record<Page, { title: string; subtitle: string }> = {
  overview: { title: 'Visão geral', subtitle: 'Como está o seu dinheiro este mês' },
  transactions: { title: 'Transações', subtitle: 'Todas as receitas e despesas' },
  subscriptions: { title: 'Assinaturas e parcelas', subtitle: 'O que renova no cartão e o que você ainda está pagando' },
  cards: { title: 'Cartões e contas', subtitle: 'Saldo das contas, fechamento e fatura de cada cartão' },
  budgets: { title: 'Orçamentos', subtitle: 'Limites de gasto por categoria' },
  invest: { title: 'Investir', subtitle: 'Reserva de emergência e simulador, para aprender antes de investir' },
  assistant: { title: 'Assistente', subtitle: 'Tire dúvidas sobre o seu dinheiro' },
}

const PAGES = Object.keys(TITLES) as Page[]

/** A aba atual vive na URL (#/pagina/subaba): dá para recarregar, usar "voltar" e compartilhar o link. */
function parseHash(): { page: Page; sub: string } {
  const [p, sub = ''] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { page: PAGES.includes(p as Page) ? (p as Page) : 'overview', sub }
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export interface CloudSession {
  userId: string
  email: string
  auth: Auth
}

const none = () => []

export default function App({ cloud }: { cloud?: CloudSession }) {
  const [route, setRoute] = useState(parseHash)
  const { page, sub } = route
  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (p: Page, s = '') => {
    window.location.hash = `/${p}${s ? `/${s}` : ''}`
  }
  const setPage = (p: Page) => go(p)

  // Com nuvem, o app começa vazio (dados de exemplo só no modo local).
  const [txs, setTxs] = useStored<Transaction[]>('fd:txs', cloud ? none : seedTransactions)
  const [subs, setSubs] = useStored<Subscription[]>('fd:subs', cloud ? none : seedSubscriptions)
  const [budgets, setBudgets] = useStored<Budget[]>('fd:budgets', cloud ? none : seedBudgets)
  const [goals, setGoals] = useStored<Goal[]>('fd:goals', cloud ? none : seedGoals)
  const [installments, setInstallments] = useStored<Installment[]>('fd:installments', none)
  const [rules, setRules] = useStored<Recurring[]>('fd:rules', none)
  const [receipts, setReceipts] = useStored<ReceiptMeta[]>('fd:receipts', none)
  const [cards, setCards] = useStored<Card[]>('fd:cards', none)
  const [accounts, setAccounts] = useStored<Account[]>('fd:accounts', none)
  const [transfers, setTransfers] = useStored<Transfer[]>('fd:transfers', none)
  const [profile, setProfile] = useStored<Profile[]>('fd:profile', none)
  const me = profile.find((p) => p.id === 'me')
  const profileName = me?.name ?? ''
  const patchProfile = (patch: Partial<Profile>) => setProfile((l) => [{ ...(l.find((p) => p.id === 'me') ?? { id: 'me', name: '' }), ...patch }])
  const banks = useMemo(() => me?.banks ?? [], [me])
  const updateBanks = (fn: (l: BankLink[]) => BankLink[]) =>
    setProfile((l) => {
      const cur = l.find((p) => p.id === 'me') ?? { id: 'me', name: '' }
      return [{ ...cur, banks: fn(cur.banks ?? []) }]
    })
  const groups = useMemo(() => me?.groups ?? [], [me])
  const updateGroups = (fn: (l: SpendGroup[]) => SpendGroup[]) =>
    setProfile((l) => {
      const cur = l.find((p) => p.id === 'me') ?? { id: 'me', name: '' }
      return [{ ...cur, groups: fn(cur.groups ?? []) }]
    })
  // salvar com o nome de um grupo que já existe troca as palavras dele
  const saveGroup = (name: string, terms: string) =>
    updateGroups((l) => (l.some((g) => g.name.toLowerCase() === name.toLowerCase()) ? l.map((g) => (g.name.toLowerCase() === name.toLowerCase() ? { ...g, terms } : g)) : [...l, { id: uid(), name, terms }]))
  // Modo privacidade: esconde valores na tela (preferência deste aparelho)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('fd:privacy') === '1'
    } catch {
      return false
    }
  })
  setHideValues(hidden)
  const togglePrivacy = () =>
    setHidden((h) => {
      try {
        localStorage.setItem('fd:privacy', h ? '0' : '1')
      } catch {
        /* sem storage */
      }
      return !h
    })
  const [form, setForm] = useState<{ tx?: Transaction; repeat?: boolean; income?: boolean } | null>(null)
  const [dataOpen, setDataOpen] = useState(false)
  const [tick, setTick] = useState(0)

  // ---------- sincronização com a nuvem ----------
  const data: Collections = { txs, subs, budgets, goals, installments, rules, receipts, cards, profile, accounts, transfers }
  const dataRef = useRef<Collections>(data)
  // espelho síncrono do estado (o motor de sync lê daqui); `apply` também o atualiza na hora
  useLayoutEffect(() => {
    dataRef.current = data
  })

  const setters: Record<Col, (fn: (prev: never[]) => never[]) => void> = {
    txs: setTxs as never,
    subs: setSubs as never,
    budgets: setBudgets as never,
    goals: setGoals as never,
    installments: setInstallments as never,
    rules: setRules as never,
    receipts: setReceipts as never,
    cards: setCards as never,
    profile: setProfile as never,
    accounts: setAccounts as never,
    transfers: setTransfers as never,
  }
  const settersRef = useRef(setters) // os setters do React são estáveis

  const apply = useCallback((changes: Change[]) => {
    // atualiza o espelho síncrono (o motor de sync lê daqui) e o estado do React
    const next = { ...dataRef.current }
    for (const col of COLS) {
      next[col] = applyChanges(dataRef.current[col], col, changes)
      settersRef.current[col]((prev) => applyChanges(prev, col, changes) as never[])
    }
    dataRef.current = next
  }, [])

  const remote = useMemo(() => (cloud ? cloud.auth.remote(cloud.userId) : null), [cloud])
  const adoptedKey = cloud ? `fd:adopted:${cloud.userId}` : ''
  const [gate, setGate] = useState<'ready' | 'ask'>(() => {
    if (!cloud || localStorage.getItem(adoptedKey)) return 'ready'
    return countLocal(dataRef.current) > 0 ? 'ask' : 'ready'
  })
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', lastSync: null })
  const [syncReady, setSyncReady] = useState(!cloud)
  const engineRef = useRef<SyncEngine | null>(null)

  useEffect(() => {
    if (!cloud || !remote || gate !== 'ready') return
    localStorage.setItem(adoptedKey, '1')
    const engine = new SyncEngine(
      remote,
      {
        get: () => dataRef.current,
        apply,
        onStatus: (s) => {
          setStatus(s)
          if (s.state !== 'syncing') setSyncReady(true)
        },
      },
      `fd:sync:${cloud.userId}`,
    )
    engineRef.current = engine
    void engine.start()
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [cloud, remote, gate, adoptedKey, apply])

  // toda mudança local agenda um envio
  useEffect(() => {
    engineRef.current?.schedule()
  }, [txs, subs, budgets, goals, installments, rules, receipts, cards, profile, accounts, transfers])

  // ---------- comprovantes ----------
  const store = useMemo(() => (cloud && remote ? cloudReceiptStore(remote, cloud.userId) : localReceiptStore()), [cloud, remote])
  // comprovantes anexados antes de ligar a nuvem continuam no aparelho onde foram anexados
  const localStore = useMemo(() => localReceiptStore(), [])
  const storeFor = (m: ReceiptMeta) => (m.path.startsWith('local:') ? localStore : store)
  const [detail, setDetail] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; meta: ReceiptMeta } | null>(null)

  const attachReceipt = async (inst: Installment, k: number, file: File) => {
    const id = `${inst.id}-p${k}`
    const prepared = await prepareFile(file)
    const old = receipts.find((r) => r.id === id)
    const path = await store.put(id, prepared.blob, prepared.mime, prepared.ext)
    const meta: ReceiptMeta = { id, installmentId: inst.id, k, name: file.name || `comprovante.${prepared.ext}`, mime: prepared.mime, size: prepared.blob.size, path, addedAt: new Date().toISOString() }
    setReceipts((l) => [...l.filter((r) => r.id !== id), meta])
    if (old) void storeFor(old).remove(old).catch(() => undefined)
  }
  const openReceipt = async (id: string) => {
    const meta = receipts.find((r) => r.id === id)
    if (!meta) return
    setViewer({ url: await storeFor(meta).url(meta), meta })
  }
  const removeReceipt = async (id: string) => {
    const meta = receipts.find((r) => r.id === id)
    if (!meta) return
    await storeFor(meta).remove(meta)
    setReceipts((l) => l.filter((r) => r.id !== id))
  }
  const receiptIds = useMemo(() => new Set(receipts.map((r) => r.id)), [receipts])
  const detailItem = installments.find((i) => i.id === detail) ?? null
  const txIds = useMemo(() => new Set(txs.map((t) => t.id)), [txs])
  const missingTxs = detailItem ? missingInstallmentTxs(detailItem, txIds) : []
  const backfillInstallment = (i: Installment) => {
    const add = missingInstallmentTxs(i, txIds)
    if (!add.length) return
    const paid = installmentStatus(i).paid
    setTxs((l) => {
      const ids = new Set(l.map((t) => t.id))
      return [...add.filter((t) => !ids.has(t.id)), ...l]
    })
    setInstallments((l) => l.map((x) => (x.id === i.id ? { ...x, generated: Math.max(x.generated ?? 0, paid) } : x)))
  }

  // ---------- lançamentos automáticos ----------
  // Lança como despesa o que venceu: recorrências, parcelas e assinaturas. Roda ao abrir, ao mudar os dados e ao voltar para o app.
  // Com nuvem, espera a primeira sincronização para não gerar em cima de dados desatualizados.
  useEffect(() => {
    if (!syncReady) return
    const r = applyRecurring(rules)
    const q = applyInstallments(installments)
    const a = applySubscriptions(subs)
    if (r) setRules(r.rules)
    if (q) setInstallments(q.items)
    if (a) setSubs(a.items)
    const added = [...(r?.txs ?? []), ...(q?.txs ?? []), ...(a?.txs ?? [])]
    if (added.length) {
      setTxs((l) => {
        const ids = new Set(l.map((t) => t.id))
        return [...added.filter((t) => !ids.has(t.id)), ...l]
      })
    }
  }, [syncReady, rules, installments, subs, tick, setRules, setInstallments, setSubs, setTxs])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setTick((n) => n + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const saveForm = (t: Omit<Transaction, 'id' | 'ruleId'>, repeat: Cycle | null) => {
    if (form?.tx) {
      const id = form.tx.id
      setTxs((l) => l.map((x) => (x.id === id ? { ...x, ...t } : x)))
    } else if (repeat) {
      setRules((l) => [...l, { id: uid(), description: t.description, amount: t.amount, type: t.type, category: t.category, cycle: repeat, anchor: t.date, generated: 0, active: true, cardId: t.cardId, accountId: t.accountId }])
    } else {
      setTxs((l) => [{ ...t, id: uid() }, ...l])
    }
    setForm(null)
  }

  const deleteInstallment = (id: string) => {
    for (const r of receipts.filter((x) => x.installmentId === id)) void storeFor(r).remove(r).catch(() => undefined)
    setReceipts((l) => l.filter((r) => r.installmentId !== id))
    setInstallments((l) => l.filter((x) => x.id !== id))
  }

  const clearAll = () => {
    for (const r of receipts) void storeFor(r).remove(r).catch(() => undefined)
    setReceipts([])
    setCards([])
    setAccounts([])
    setTransfers([])
    setInstallments([])
    setRules([])
    setTxs([])
    setSubs([])
    setBudgets([])
    setGoals([])
  }

  const saveCard = (c: Omit<Card, 'id' | 'paid'>, id?: string) =>
    setCards((l) => (id ? l.map((x) => (x.id === id ? { ...x, ...c } : x)) : [...l, { ...c, id: uid() }]))
  const deleteCard = (id: string) => {
    // as compras ficam, só deixam de estar ligadas ao cartão
    const unlink = <T extends { cardId?: string }>(l: T[]) => l.map((x) => (x.cardId === id ? { ...x, cardId: undefined } : x))
    setTxs(unlink)
    setSubs(unlink)
    setInstallments(unlink)
    setRules(unlink)
    setCards((l) => l.filter((c) => c.id !== id))
  }
  const payInvoice = (cardId: string, key: string, opts?: { accountId: string; date: string; amount: number }) => {
    const card = cards.find((c) => c.id === cardId)
    setCards((l) => l.map((c) => (c.id === cardId && !c.paid?.includes(key) ? { ...c, paid: [...(c.paid ?? []), key] } : c)))
    if (opts && card) {
      // sai da conta, mas não vira despesa nova (as compras já contaram no dia em que foram feitas)
      setTransfers((l) => [...l, { id: uid(), date: opts.date, from: opts.accountId, amount: opts.amount, note: `Fatura ${card.name}`, kind: 'invoice', cardId, invoiceKey: key }])
    }
  }
  const unpayInvoice = (cardId: string, key: string) => {
    setCards((l) => l.map((c) => (c.id === cardId ? { ...c, paid: (c.paid ?? []).filter((k) => k !== key) } : c)))
    setTransfers((l) => l.filter((t) => !(t.kind === 'invoice' && t.cardId === cardId && t.invoiceKey === key)))
  }
  const saveAccount = (a: Omit<Account, 'id'>, id?: string) =>
    setAccounts((l) => (id ? l.map((x) => (x.id === id ? { ...x, ...a } : x)) : [...l, { ...a, id: uid() }]))
  const deleteAccount = (id: string) => {
    const unlink = <T extends { accountId?: string }>(l: T[]) => l.map((x) => (x.accountId === id ? { ...x, accountId: undefined } : x))
    setTxs(unlink)
    setSubs(unlink)
    setInstallments(unlink)
    setRules(unlink)
    setTransfers((l) => l.filter((t) => t.from !== id && t.to !== id))
    setAccounts((l) => l.filter((a) => a.id !== id))
  }

  // ---------- bancos (Open Finance / Meu Pluggy) ----------
  const [bankOpen, setBankOpen] = useState(false)
  const [bankState, setBankState] = useState<BankState>({ busy: false, error: '', result: null })
  const bankBusy = useRef(false)
  const syncBank = async (list: BankLink[] = banks) => {
    if (!cloud || list.length === 0 || bankBusy.current) return
    bankBusy.current = true
    setBankState((b) => ({ ...b, busy: true, error: '' }))
    try {
      const response = await cloud.auth.bankSync(syncRequest(list))
      const d = dataRef.current
      const plan = planSync({ response, links: list, accounts: d.accounts, cards: d.cards, txs: d.txs, transfers: d.transfers })
      if (plan.accounts.length) setAccounts((l) => [...l, ...plan.accounts])
      if (plan.cards.length) setCards((l) => [...l, ...plan.cards])
      if (plan.txs.length || plan.patches.length)
        setTxs((l) => {
          const ids = new Set(l.map((t) => t.id))
          const patch = new Map(plan.patches.map((p) => [p.id, p]))
          return [...plan.txs.filter((t) => !ids.has(t.id)), ...l.map((t) => (patch.has(t.id) && !t.accountId && !t.cardId ? { ...t, ...patch.get(t.id) } : t))]
        })
      // guarda o que mudou (mapeamentos, saldos), sem desfazer conexões adicionadas/removidas enquanto esperava
      updateBanks((cur) => cur.map((c) => plan.links.find((n) => n.id === c.id) ?? c))
      setBankState({ busy: false, error: '', result: plan })
    } catch (e) {
      setBankState((b) => ({ ...b, busy: false, error: e instanceof Error ? e.message : 'Não foi possível sincronizar.' }))
    } finally {
      bankBusy.current = false
    }
  }
  const addBank = (b: { id: string; label: string; since: string }) => {
    const link: BankLink = { ...b, map: {} }
    updateBanks((l) => [...l, link])
    void syncBank([...banks, link])
  }
  const importSkipped = (tx: Transaction) => {
    setTxs((l) => (l.some((t) => t.id === tx.id) ? l : [tx, ...l]))
    setBankState((b) => (b.result ? { ...b, result: { ...b.result, skipped: b.result.skipped.filter((s) => s.tx.id !== tx.id) } } : b))
  }
  // ao abrir o app, atualiza sozinho se faz mais de 6 horas
  const autoBank = useRef(false)
  useEffect(() => {
    if (!cloud || !syncReady || autoBank.current || banks.length === 0) return
    autoBank.current = true
    if (needsAutoSync(banks)) void syncBank()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, syncReady, banks])

  // ---------- transferências entre as suas contas ----------
  const knownIds = useMemo(() => convertedIds(transfers), [transfers])
  const convertTransfers = (list: TransferMatch[]) => {
    const gone = new Set(list.flatMap((m) => [m.expense.id, m.income.id]))
    setTxs((l) => l.filter((t) => !gone.has(t.id)))
    setTransfers((l) => [...l, ...list.map((m) => matchToTransfer(m))])
  }
  const markTransfer = (tx: Transaction, from: string, to: string) => {
    setTxs((l) => l.filter((t) => t.id !== tx.id))
    setTransfers((l) => [...l, singleToTransfer(tx, from, to)])
  }
  // desfazer: os lançamentos originais voltam (e a transferência some)
  const deleteTransfer = (id: string) => {
    const tr = transfers.find((t) => t.id === id)
    if (tr?.origin?.length) {
      setTxs((l) => {
        const ids = new Set(l.map((t) => t.id))
        return [...tr.origin!.filter((o) => !ids.has(o.id)), ...l]
      })
    }
    setTransfers((l) => l.filter((t) => t.id !== id))
  }

  const deleteAccountNow = async () => {
    if (!cloud) return
    for (const r of receipts) if (!r.path.startsWith('local:')) await store.remove(r).catch(() => undefined)
    await cloud.auth.deleteAccount()
    engineRef.current?.dispose()
    Object.keys(localStorage)
      .filter((k) => k.startsWith('fd:'))
      .forEach((k) => localStorage.removeItem(k))
    window.location.hash = ''
    window.location.reload()
  }

  // Primeiros passos: aparece enquanto a conta está quase vazia
  const steps: OnboardingStep[] = [
    { id: 'name', label: 'Diga como quer ser chamado', done: !!profileName, action: 'Definir nome', run: () => setDataOpen(true) },
    { id: 'account', label: 'Cadastre suas contas com o saldo de hoje', done: accounts.length > 0, action: 'Cadastrar contas', run: () => go('cards', 'contas') },
    { id: 'card', label: 'Cadastre seus cartões de crédito', optional: true, done: cards.length > 0, action: 'Cadastrar cartões', run: () => go('cards') },
    { id: 'income', label: 'Cadastre o seu salário (recorrente)', done: rules.some((r) => r.type === 'income') || txs.some((t) => t.category === 'salario'), action: 'Cadastrar salário', run: () => setForm({ repeat: true, income: true }) },
    { id: 'entries', label: 'Importe o extrato ou lance suas despesas', done: txs.filter((t) => t.type === 'expense').length >= 3, action: 'Ir para Transações', run: () => go('transactions') },
  ]
  const showOnboarding = !me?.onboardingHidden && txs.length < 15 && steps.some((s) => !s.optional && !s.done)

  const signOut = async () => {
    if (!cloud) return
    if (!confirm('Sair desta conta? Os dados salvos neste aparelho serão apagados daqui (eles continuam na nuvem).')) return
    engineRef.current?.dispose()
    Object.keys(localStorage)
      .filter((k) => k.startsWith('fd:'))
      .forEach((k) => localStorage.removeItem(k))
    try {
      await cloud.auth.signOut()
    } finally {
      window.location.hash = ''
      window.location.reload()
    }
  }

  const head = TITLES[page]

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={setPage} />
      <main>
        <header className="topbar">
          <div>
            <h1>{page === 'overview' ? `${greeting()}${profileName ? `, ${profileName}` : ''}` : head.title}</h1>
            <p className="muted">{head.subtitle}</p>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" onClick={togglePrivacy} aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'} title={hidden ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={hidden}>{hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            {cloud && <SyncBadge status={status} onClick={() => void engineRef.current?.sync()} />}
            {cloud && <button className="icon-btn" onClick={() => setBankOpen(true)} aria-label="Bancos (Open Finance)" title="Bancos (Open Finance)"><Landmark size={16} /></button>}
            <button className="btn ghost" onClick={() => setDataOpen(true)}><Database size={15} /> Dados</button>
            <button className="btn light" onClick={() => setForm({})}><Plus size={16} /> Nova transação</button>
          </div>
        </header>

        {page === 'overview' && (
          <Overview
            onboarding={showOnboarding ? <Onboarding steps={steps} onDismiss={() => patchProfile({ onboardingHidden: true })} /> : null}
            installments={installments}
            cards={cards}
            accounts={accounts}
            transfers={transfers}
            rules={rules}
            txs={txs}
            subs={subs}
            budgets={budgets}
            goals={goals}
            onNavigate={setPage}
            onAddGoal={(g) => setGoals((l) => [...l, { ...g, id: uid(), saved: 0 }])}
            onDeposit={(id, amount) => setGoals((l) => l.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)))}
          />
        )}
        {page === 'transactions' && (
          <Transactions
            knownIds={knownIds}
            onConvertTransfers={convertTransfers}
            onMarkTransfer={markTransfer}
            groups={groups}
            onSaveGroup={saveGroup}
            onDeleteGroup={(id) => updateGroups((l) => l.filter((g) => g.id !== id))}
            accounts={accounts}
            onImport={(list) =>
              setTxs((l) => {
                const ids = new Set(l.map((t) => t.id))
                return [...list.filter((t) => !ids.has(t.id)), ...l]
              })
            }
            cards={cards}
            txs={txs}
            rules={rules}
            receiptIds={receiptIds}
            onOpenReceipt={(id) => void openReceipt(id).catch(() => alert('Não foi possível abrir o comprovante agora.'))}
            onEdit={(tx) => setForm({ tx })}
            view={(sub === 'recurring' ? 'recurring' : sub === 'merchants' ? 'merchants' : 'list') satisfies TxView}
            onView={(v) => go('transactions', v === 'list' ? '' : v)}
            onDelete={(id) => setTxs((l) => l.filter((t) => t.id !== id))}
            onNewRecurring={() => setForm({ repeat: true })}
            onToggleRule={(id) => setRules((l) => l.map((r) => (r.id === id ? (r.active ? { ...r, active: false } : { ...skipToToday(r), active: true }) : r)))}
            onDeleteRule={(id) => setRules((l) => l.filter((r) => r.id !== id))}
          />
        )}
        {page === 'subscriptions' && (
          <Subscriptions
            cards={cards}
            accounts={accounts}
            tab={(sub === 'installments' ? 'installments' : 'subs') satisfies SubsTab}
            onTab={(t) => go('subscriptions', t === 'installments' ? 'installments' : '')}
            installments={installments}
            receiptCount={(id) => receipts.filter((r) => r.installmentId === id).length}
            onDetails={(i) => setDetail(i.id)}
            onSaveInstallment={(i, includePast, id) =>
              setInstallments((l) =>
                id
                  ? l.map((x) => (x.id === id ? { ...x, ...i } : x))
                  : [...l, { ...i, id: uid(), generated: includePast ? 0 : installmentStatus({ ...i, id: '' }).paid }],
              )
            }
            onDeleteInstallment={deleteInstallment}
            subs={subs}
            onSave={(sub, includeLast, id) =>
              setSubs((l) =>
                id
                  ? l.map((x) => (x.id === id ? { ...x, ...sub } : x))
                  : [...l, { ...sub, id: uid(), active: true, chargedUntil: initialChargedUntil({ ...sub, id: '', active: true }, includeLast) }],
              )
            }
            onToggle={(id) => setSubs((l) => l.map((s) => (s.id === id ? { ...s, active: !s.active } : s)))}
            onDelete={(id) => setSubs((l) => l.filter((s) => s.id !== id))}
          />
        )}
        {page === 'cards' && (
          <Cards
            tab={(sub === 'contas' ? 'accounts' : 'cards') satisfies CardsTab}
            onTab={(t) => go('cards', t === 'accounts' ? 'contas' : '')}
            accounts={accounts}
            transfers={transfers}
            onPayInvoice={payInvoice}
            onUnpayInvoice={unpayInvoice}
            onSaveAccount={saveAccount}
            onDeleteAccount={deleteAccount}
            onTransfer={(t) => setTransfers((l) => [...l, { ...t, id: uid(), kind: 'transfer' }])}
            onDeleteTransfer={deleteTransfer}
            cards={cards}
            txs={txs}
            sub={sub === 'contas' ? '' : sub}
            onOpen={(id) => go('cards', id)}
            onBack={() => go('cards')}
            onSave={saveCard}
            onDelete={deleteCard}
          />
        )}
        {page === 'budgets' && (
          <Budgets
            txs={txs}
            subs={subs}
            budgets={budgets}
            onChange={(category: CategoryId, limit) =>
              setBudgets((l) => (l.some((b) => b.category === category) ? l.map((b) => (b.category === category ? { ...b, limit } : b)) : [...l, { category, limit }]))
            }
          />
        )}
        {page === 'invest' && (
          <Invest
            tab={(sub === 'simulador' ? 'simulator' : 'reserve') satisfies InvestTab}
            onTab={(t) => go('invest', t === 'simulator' ? 'simulador' : '')}
            txs={txs}
            accounts={accounts}
            transfers={transfers}
            reserve={me?.reserve}
            onReserve={(reserve) => patchProfile({ reserve })}
          />
        )}
        {page === 'assistant' && <Assistant txs={txs} subs={subs} budgets={budgets} installments={installments} cards={cards} accounts={accounts} transfers={transfers} rules={rules} />}
      </main>

      {gate === 'ask' && (
        <Modal title="Dados neste aparelho" onClose={() => undefined} dismissable={false}>
          <p className="muted small data-note">
            Este aparelho já tem {countLocal(data)} {countLocal(data) === 1 ? 'registro salvo' : 'registros salvos'} (lançamentos, assinaturas, parcelas...). O que fazer com {countLocal(data) === 1 ? 'ele' : 'eles'} ao entrar na sua conta?
          </p>
          <div className="data-actions">
            <button className="btn primary" onClick={() => setGate('ready')}>Enviar para a nuvem (juntar com o que já existe)</button>
            <button
              className="btn danger"
              onClick={() => {
                if (!confirm('Descartar os dados deste aparelho e usar só os da nuvem?')) return
                clearAll()
                setGate('ready')
              }}
            >
              Descartar os deste aparelho
            </button>
          </div>
        </Modal>
      )}

      {bankOpen && cloud && (
        <BankModal
          links={banks}
          accounts={accounts}
          cards={cards}
          state={bankState}
          onAdd={addBank}
          onRemove={(id) => updateBanks((l) => l.filter((b) => b.id !== id))}
          onSync={() => void syncBank()}
          onImportSkipped={importSkipped}
          onClose={() => setBankOpen(false)}
        />
      )}
      {dataOpen && (
        <DataModal
          profileName={profileName}
          onProfileName={(name) => patchProfile({ name })}
          cloud={cloud ? { email: cloud.email, onSignOut: () => void signOut(), onChangePassword: (pw) => cloud.auth.updatePassword(pw), onDeleteAccount: deleteAccountNow } : undefined}
          data={{ txs, subs, budgets, goals, recurring: rules, installments, cards, accounts, transfers }}
          onClose={() => setDataOpen(false)}
          onImport={(d) => {
            setTxs(d.txs)
            setSubs(d.subs)
            setBudgets(d.budgets)
            setGoals(d.goals)
            setRules(d.recurring)
            setInstallments(d.installments)
            setCards(d.cards)
            setAccounts(d.accounts)
            setTransfers(d.transfers)
          }}
          onClear={clearAll}
          onReset={() => {
            setAccounts([])
            setTransfers([])
            setCards([])
            setInstallments([])
            setRules([])
            setTxs(seedTransactions())
            setSubs(seedSubscriptions())
            setBudgets(seedBudgets())
            setGoals(seedGoals())
          }}
        />
      )}
      {form && (
        <Modal title={form.tx ? 'Editar transação' : form.repeat ? 'Nova recorrente' : 'Nova transação'} onClose={() => setForm(null)}>
          <TransactionForm cards={cards} accounts={accounts} initial={form.tx} startRepeating={form.repeat} startIncome={form.income} onSave={saveForm} />
        </Modal>
      )}
      {detailItem && (
        <InstallmentDetail
          item={detailItem}
          missing={missingTxs.length}
          onBackfill={() => backfillInstallment(detailItem)}
          receipts={receipts.filter((r) => r.installmentId === detailItem.id)}
          onAttach={attachReceipt}
          onOpen={openReceipt}
          onRemove={removeReceipt}
          onClose={() => setDetail(null)}
        />
      )}
      {viewer && <ReceiptViewer url={viewer.url} meta={viewer.meta} onClose={() => setViewer(null)} />}
    </div>
  )
}
