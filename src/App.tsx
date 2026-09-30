import { Database, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cloudReceiptStore, localReceiptStore, prepareFile, type ReceiptMeta } from './cloud/receipts'
import { applyChanges, COLS, countLocal, SyncEngine, type Change, type Col, type Collections, type SyncStatus } from './cloud/sync'
import type { Auth } from './cloud/types'
import { DataModal } from './components/DataModal'
import { InstallmentDetail } from './components/InstallmentDetail'
import { Modal } from './components/Modal'
import { ReceiptViewer } from './components/ReceiptViewer'
import { Sidebar } from './components/Sidebar'
import { SyncBadge } from './components/SyncBadge'
import { TransactionForm } from './components/TransactionForm'
import { seedBudgets, seedGoals, seedSubscriptions, seedTransactions } from './data'
import { applyInstallments, applyRecurring, applySubscriptions, initialChargedUntil, installmentStatus, missingInstallmentTxs, skipToToday, uid } from './lib'
import { Assistant } from './pages/Assistant'
import { Budgets } from './pages/Budgets'
import { Overview } from './pages/Overview'
import { Subscriptions, type SubsTab } from './pages/Subscriptions'
import { Transactions, type TxView } from './pages/Transactions'
import { Cards } from './pages/Cards'
import type { Budget, Card, CategoryId, Cycle, Goal, Installment, Page, Profile, Recurring, Subscription, Transaction } from './types'
import { useStored } from './useStored'

const TITLES: Record<Page, { title: string; subtitle: string }> = {
  overview: { title: 'Visão geral', subtitle: 'Como está o seu dinheiro este mês' },
  transactions: { title: 'Transações', subtitle: 'Todas as receitas e despesas' },
  subscriptions: { title: 'Assinaturas e parcelas', subtitle: 'O que renova no cartão e o que você ainda está pagando' },
  cards: { title: 'Cartões', subtitle: 'Fechamento, vencimento e fatura de cada cartão' },
  budgets: { title: 'Orçamentos', subtitle: 'Limites de gasto por categoria' },
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
  const [profile, setProfile] = useStored<Profile[]>('fd:profile', none)
  const profileName = profile.find((p) => p.id === 'me')?.name ?? ''
  const [form, setForm] = useState<{ tx?: Transaction; repeat?: boolean } | null>(null)
  const [dataOpen, setDataOpen] = useState(false)
  const [tick, setTick] = useState(0)

  // ---------- sincronização com a nuvem ----------
  const data: Collections = { txs, subs, budgets, goals, installments, rules, receipts, cards, profile }
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
  }, [txs, subs, budgets, goals, installments, rules, receipts, cards, profile])

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
      setRules((l) => [...l, { id: uid(), description: t.description, amount: t.amount, type: t.type, category: t.category, cycle: repeat, anchor: t.date, generated: 0, active: true, cardId: t.cardId }])
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
  const toggleInvoicePaid = (cardId: string, key: string) =>
    setCards((l) => l.map((c) => (c.id === cardId ? { ...c, paid: c.paid?.includes(key) ? c.paid.filter((k) => k !== key) : [...(c.paid ?? []), key] } : c)))

  const signOut = async () => {
    if (!cloud) return
    if (!confirm('Sair desta conta? Os dados salvos neste aparelho serão apagados daqui (eles continuam na nuvem).')) return
    engineRef.current?.dispose()
    Object.keys(localStorage)
      .filter((k) => k.startsWith('fd:'))
      .forEach((k) => localStorage.removeItem(k))
    await cloud.auth.signOut()
    window.location.reload()
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
            {cloud && <SyncBadge status={status} onClick={() => void engineRef.current?.sync()} />}
            <button className="btn ghost" onClick={() => setDataOpen(true)}><Database size={15} /> Dados</button>
            <button className="btn light" onClick={() => setForm({})}><Plus size={16} /> Nova transação</button>
          </div>
        </header>

        {page === 'overview' && (
          <Overview
            installments={installments}
            cards={cards}
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
            cards={cards}
            txs={txs}
            rules={rules}
            receiptIds={receiptIds}
            onOpenReceipt={(id) => void openReceipt(id).catch(() => alert('Não foi possível abrir o comprovante agora.'))}
            onEdit={(tx) => setForm({ tx })}
            view={(sub === 'recurring' ? 'recurring' : 'list') satisfies TxView}
            onView={(v) => go('transactions', v === 'recurring' ? 'recurring' : '')}
            onDelete={(id) => setTxs((l) => l.filter((t) => t.id !== id))}
            onNewRecurring={() => setForm({ repeat: true })}
            onToggleRule={(id) => setRules((l) => l.map((r) => (r.id === id ? (r.active ? { ...r, active: false } : { ...skipToToday(r), active: true }) : r)))}
            onDeleteRule={(id) => setRules((l) => l.filter((r) => r.id !== id))}
          />
        )}
        {page === 'subscriptions' && (
          <Subscriptions
            cards={cards}
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
            cards={cards}
            txs={txs}
            sub={sub}
            onOpen={(id) => go('cards', id)}
            onBack={() => go('cards')}
            onSave={saveCard}
            onDelete={deleteCard}
            onTogglePaid={toggleInvoicePaid}
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
        {page === 'assistant' && <Assistant txs={txs} subs={subs} budgets={budgets} installments={installments} cards={cards} />}
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

      {dataOpen && (
        <DataModal
          profileName={profileName}
          onProfileName={(name) => setProfile(name ? [{ id: 'me', name }] : [])}
          cloud={cloud ? { email: cloud.email, onSignOut: () => void signOut(), onChangePassword: (pw) => cloud.auth.updatePassword(pw) } : undefined}
          data={{ txs, subs, budgets, goals, recurring: rules, installments, cards }}
          onClose={() => setDataOpen(false)}
          onImport={(d) => {
            setTxs(d.txs)
            setSubs(d.subs)
            setBudgets(d.budgets)
            setGoals(d.goals)
            setRules(d.recurring)
            setInstallments(d.installments)
            setCards(d.cards)
          }}
          onClear={clearAll}
          onReset={() => {
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
          <TransactionForm cards={cards} initial={form.tx} startRepeating={form.repeat} onSave={saveForm} />
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
