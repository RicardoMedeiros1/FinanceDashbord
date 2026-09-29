import type { ReactNode } from 'react'

export interface TabItem<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  count?: number
}

interface Props<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  label: string
}

/** Abas clicáveis (e navegáveis com as setas do teclado). Só o conteúdo da aba ativa deve ser renderizado. */
export function Tabs<T extends string>({ tabs, active, onChange, label }: Props<T>) {
  const move = (dir: number) => {
    const i = tabs.findIndex((t) => t.id === active)
    onChange(tabs[(i + dir + tabs.length) % tabs.length].id)
  }
  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') move(1)
        if (e.key === 'ArrowLeft') move(-1)
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          className={`tab ${t.id === active ? 'on' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          {t.label}
          {t.count ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
