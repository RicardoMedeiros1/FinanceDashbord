import { Sparkles } from 'lucide-react'
import type { Insight } from '../insights'
import type { Page } from '../types'

export function Insights({ items, onNavigate }: { items: Insight[]; onNavigate: (p: Page) => void }) {
  const [main, ...rest] = items
  return (
    <div className="card ai-card">
      <div className="card-head">
        <h3><Sparkles size={15} /> Insights</h3>
        <span className="pill">{items.length}</span>
      </div>
      {main ? (
        <>
          <h4 className={`ai-title ${main.tone}`}>{main.title}</h4>
          <p className="ai-text">{main.text}</p>
        </>
      ) : (
        <p className="ai-text">Sem novidades por enquanto.</p>
      )}
      <ul className="ai-list">
        {rest.slice(0, 3).map((i) => (
          <li key={i.id}>
            <span className={`ai-dot ${i.tone}`} />
            <div><strong>{i.title}</strong><p>{i.text}</p></div>
          </li>
        ))}
      </ul>
      <button className="btn accent" onClick={() => onNavigate('assistant')}>Perguntar ao assistente</button>
    </div>
  )
}
