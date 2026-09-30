import { FileUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../categories'
import { buildCandidates, csvToRows, decodeText, parseStatement, type Candidate, type CsvTable, type ImportRow, type Interpretation } from '../importer'
import { brl, formatDate } from '../lib'
import type { Account, Card, CategoryId, Transaction } from '../types'
import { Modal } from './Modal'
import { payIds, PaymentSelect } from './PaymentSelect'

interface Props {
  txs: Transaction[]
  cards: Card[]
  accounts: Account[]
  onImport: (list: Transaction[]) => void
  onClose: () => void
}

const BADGE: Record<Candidate['status'], string> = {
  ok: '',
  imported: 'Já importado',
  maybe: 'Possível duplicado',
  invoice: 'Pagamento/estorno de fatura',
}

/** Mapeamento manual de colunas do CSV, para arquivos de bancos que não reconhecemos sozinhos. */
function ColumnMapper({ table, onApply }: { table: CsvTable; onApply: (rows: ImportRow[]) => void }) {
  const header = table.headerIndex >= 0 ? table.rows[table.headerIndex] : table.rows[0] ?? []
  const label = (i: number) => (header[i] ? `${i + 1}. ${header[i]}` : `Coluna ${i + 1}`)
  const [date, setDate] = useState(String(table.columns.date))
  const [desc, setDesc] = useState(String(table.columns.description))
  const [amount, setAmount] = useState(String(table.columns.amount))
  const opts = header.map((_, i) => (
    <option key={i} value={i}>{label(i)}</option>
  ))
  const cols = { date: +date, description: +desc, amount: +amount, credit: -1, debit: -1 }
  const preview = csvToRows({ ...table, headerIndex: table.headerIndex >= 0 ? table.headerIndex : -1 }, cols).slice(0, 3)
  return (
    <div className="form">
      <p className="muted small">Não consegui identificar as colunas sozinho. Diga qual coluna é cada coisa:</p>
      <label>Data<select value={date} onChange={(e) => setDate(e.target.value)}><option value="-1">—</option>{opts}</select></label>
      <label>Descrição<select value={desc} onChange={(e) => setDesc(e.target.value)}><option value="-1">—</option>{opts}</select></label>
      <label>Valor<select value={amount} onChange={(e) => setAmount(e.target.value)}><option value="-1">—</option>{opts}</select></label>
      {preview.length > 0 && (
        <p className="preview small">Prévia: {preview.map((r) => `${formatDate(r.date)} · ${r.description} · ${brl(r.amount)}`).join('  |  ')}</p>
      )}
      <button className="btn primary" disabled={+date < 0 || +amount < 0} onClick={() => onApply(csvToRows(table, cols))}>Usar essas colunas</button>
    </div>
  )
}

export function ImportModal({ txs, cards, accounts, onImport, onClose }: Props) {
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [table, setTable] = useState<CsvTable | undefined>()
  const [format, setFormat] = useState<'ofx' | 'csv'>('csv')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [mapping, setMapping] = useState(false)
  const [pay, setPay] = useState('')
  const [mode, setMode] = useState<Interpretation | null>(null)
  const [cats, setCats] = useState<Record<string, CategoryId>>({})
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const target = payIds(pay)
  const effMode: Interpretation = mode ?? (target.cardId ? 'card' : 'account')
  const candidates = useMemo(() => (rows ? buildCandidates(rows, effMode, txs) : []), [rows, effMode, txs])
  const selectable = (c: Candidate) => c.status !== 'imported' && !(target.cardId && c.type === 'income')
  const selected = picked ?? new Set(candidates.filter((c) => c.status === 'ok' && selectable(c)).map((c) => c.id))
  const chosen = candidates.filter((c) => selected.has(c.id) && selectable(c))
  const inSum = chosen.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0)
  const outSum = chosen.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0)

  const load = async (f: File) => {
    setError('')
    try {
      const parsed = parseStatement(decodeText(await f.arrayBuffer()))
      setFileName(f.name)
      setFormat(parsed.format)
      setTable(parsed.table)
      setPicked(null)
      setCats({})
      if (parsed.rows.length === 0) {
        if (parsed.table && parsed.table.rows.some((r) => r.length >= 2)) {
          setRows(null)
          setMapping(true)
          setError('Não encontrei lançamentos automaticamente. Ajuste as colunas abaixo.')
        } else setError('Não encontrei lançamentos nesse arquivo. Use o extrato em OFX ou CSV exportado pelo banco.')
        return
      }
      setMapping(false)
      setRows(parsed.rows)
    } catch {
      setError('Não consegui ler esse arquivo.')
    }
  }

  const doImport = () => {
    const list: Transaction[] = chosen.map((c) => ({
      id: c.id,
      description: c.description.slice(0, 120),
      amount: c.amount,
      type: c.type,
      category: cats[c.id] ?? c.category,
      date: c.date,
      cardId: c.type === 'expense' ? target.cardId : undefined,
      accountId: target.accountId,
    }))
    onImport(list)
    setDone(list.length)
  }

  if (done !== null) {
    return (
      <Modal title="Importação concluída" onClose={onClose}>
        <p role="status">{done} {done === 1 ? 'lançamento importado' : 'lançamentos importados'} para as Transações.</p>
        <button className="btn primary" onClick={onClose}>Fechar</button>
      </Modal>
    )
  }

  return (
    <Modal title="Importar extrato" onClose={onClose}>
      {!rows && !mapping && (
        <div className="form">
          <p className="muted small">
            Escolha o extrato ou a fatura exportado pelo banco (arquivo <strong>OFX</strong> ou <strong>CSV</strong>). O arquivo é lido aqui no seu navegador; nada é enviado, só os lançamentos que você confirmar.
          </p>
          <label className="file-drop">
            <FileUp size={20} />
            <span>Escolher arquivo</span>
            <input type="file" accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void load(f) }} />
          </label>
          {error && <p className="bad-text small" role="alert">{error}</p>}
        </div>
      )}

      {mapping && table && (
        <>
          {error && <p className="bad-text small" role="alert">{error}</p>}
          <ColumnMapper
            table={table}
            onApply={(r) => {
              if (r.length === 0) setError('Com essas colunas não sobrou nenhum lançamento.')
              else {
                setError('')
                setMapping(false)
                setRows(r)
              }
            }}
          />
        </>
      )}

      {rows && (
        <div className="import">
          <p className="muted small">{fileName} · {format.toUpperCase()} · {rows.length} linhas</p>
          <div className="row">
            <PaymentSelect label="Importar para" none="Nenhum (só registrar)" value={pay} onChange={(v) => { setPay(v); setMode(null); setPicked(null) }} accounts={accounts} cards={cards} />
            <label>
              Como ler os valores
              <select value={effMode} onChange={(e) => { setMode(e.target.value as Interpretation); setPicked(null) }}>
                <option value="account">Extrato de conta (negativo = despesa)</option>
                <option value="card">Fatura de cartão (positivo = despesa)</option>
              </select>
            </label>
          </div>
          {format === 'csv' && table && (
            <button className="link" onClick={() => { setRows(null); setMapping(true) }}>Ajustar colunas</button>
          )}
          <div className="import-actions">
            <button className="link" onClick={() => setPicked(new Set(candidates.filter(selectable).map((c) => c.id)))}>Marcar tudo</button>
            <button className="link" onClick={() => setPicked(new Set())}>Desmarcar tudo</button>
          </div>
          <div className="import-table">
            <table>
              <thead>
                <tr><th /><th>Data</th><th>Descrição</th><th>Categoria</th><th className="right">Valor</th></tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const on = selected.has(c.id) && selectable(c)
                  const list = c.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
                  return (
                    <tr key={c.id} className={on ? '' : 'skip'}>
                      <td>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!selectable(c)}
                          aria-label={`Importar ${c.description}`}
                          onChange={(e) => {
                            const next = new Set(selected)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            setPicked(next)
                          }}
                        />
                      </td>
                      <td className="muted">{formatDate(c.date)}</td>
                      <td>
                        {c.description}
                        {c.status !== 'ok' && <span className={`badge ${c.status}`}>{BADGE[c.status]}</span>}
                        {target.cardId && c.type === 'income' && <span className="badge invoice">Estorno/crédito: não importado</span>}
                      </td>
                      <td>
                        <select value={cats[c.id] ?? c.category} onChange={(e) => setCats((m) => ({ ...m, [c.id]: e.target.value as CategoryId }))} aria-label={`Categoria de ${c.description}`}>
                          {list.map((k) => (
                            <option key={k} value={k}>{CATEGORIES[k].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`right ${c.type === 'income' ? 'pos' : ''}`}>{c.type === 'income' ? '+' : '−'} {brl(c.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="import-foot">
            <span className="muted small">{chosen.length} selecionados · <span className="pos">+ {brl(inSum)}</span> · − {brl(outSum)}</span>
            <button className="btn primary" disabled={chosen.length === 0} onClick={doImport}>Importar {chosen.length} {chosen.length === 1 ? 'lançamento' : 'lançamentos'}</button>
          </div>
          <p className="muted small hint">Pagamentos de fatura e linhas já importadas vêm desmarcados. Compras iguais já lançadas (mesma data e valor) aparecem como possível duplicado.</p>
        </div>
      )}
    </Modal>
  )
}
