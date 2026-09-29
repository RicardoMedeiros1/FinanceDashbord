import { useEffect, useState } from 'react'

/** useState persistido em localStorage. */
export function useStored<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      /* ignora dados corrompidos */
    }
    return initial()
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage indisponível */
    }
  }, [key, value])
  return [value, setValue] as const
}
