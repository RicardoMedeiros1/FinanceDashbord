import { brl } from '../lib'

/** Valor em reais com os centavos esmaecidos, como na referência. */
export function Money({ value }: { value: number }) {
  const [int, cents] = brl(value).split(',')
  return (
    <>
      {int}
      {cents !== undefined && <span className="cents">,{cents}</span>}
    </>
  )
}
