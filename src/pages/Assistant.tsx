import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { answer, SUGGESTIONS } from '../insights'
import type { Budget, Subscription, Transaction } from '../types'

interface Msg { from: 'me' | 'bot'; text: string }

export function Assistant({ txs, subs, budgets }: { txs: Transaction[]; subs: Subscription[]; budgets: Budget[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [msgs])

  const ask = (q: string) => {
    if (!q.trim()) return
    setMsgs((m) => [...m, { from: 'me', text: q }, { from: 'bot', text: answer(q, txs, subs, budgets) }])
    setText('')
  }

  return (
    <div className="assistant">
      {msgs.length === 0 ? (
        <div className="assistant-hero">
          <div className="orb" />
          <h2>O que você quer saber?</h2>
          <p className="muted">Pergunte sobre seus gastos, assinaturas e orçamentos. As respostas usam os seus dados, direto no navegador.</p>
        </div>
      ) : (
        <div className="chat">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.from}`}>{m.text}</div>
          ))}
          <div ref={end} />
        </div>
      )}
      <div className="assistant-input">
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip-btn" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(text) }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Pergunte qualquer coisa…" aria-label="Pergunta" />
          <button className="send" aria-label="Enviar" disabled={!text.trim()}><ArrowUp size={18} /></button>
        </form>
      </div>
    </div>
  )
}
