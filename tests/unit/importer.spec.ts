import { expect, test } from '../support/test'
import { buildCandidates, buildHistory, decodeText, isInvoicePayment, normDesc, parseAmount, parseDate, parseOfx, parseStatement, suggestCategory } from '../../src/importer'
import type { Transaction } from '../../src/types'

const tx = (id: string, description: string, amount: number, date: string, category: Transaction['category'] = 'compras', type: Transaction['type'] = 'expense'): Transaction => ({ id, description, amount, type, category, date })

test('valores em vários formatos', () => {
  const cases: [string, number | null][] = [
    ['1.234,56', 1234.56], ['-1.234,56', -1234.56], ['R$ 1.234,56', 1234.56], ['-R$ 45,90', -45.9], ['(123,45)', -123.45], ['123,45-', -123.45],
    ['1234.56', 1234.56], ['-1234.56', -1234.56], ['45,9', 45.9], ['1.234', 1234], ['12.345.678', 12345678], ['1,234.56', 1234.56], ['0,99', 0.99],
    ['1.234.567,89', 1234567.89], ['abc', null], ['', null], ['12/03/2026', null],
  ]
  for (const [input, expected] of cases) expect(parseAmount(input), input).toBe(expected)
})

test('datas em vários formatos', () => {
  const cases: [string, string | null][] = [
    ['20260930', '2026-09-30'], ['20260930120000[-3:BRT]', '2026-09-30'], ['2026-09-30', '2026-09-30'], ['2026-09-30T10:00:00', '2026-09-30'],
    ['30/09/2026', '2026-09-30'], ['3/9/2026', '2026-09-03'], ['30/09/26', '2026-09-30'], ['30-09-2026', '2026-09-30'], ['30.09.2026', '2026-09-30'],
    ['05 out 2026', '2026-10-05'], ['5 de outubro de 2026', '2026-10-05'], ['31/02/2026', null], ['2026-13-01', null], ['texto', null], ['05/10', null],
  ]
  for (const [input, expected] of cases) expect(parseDate(input), input).toBe(expected)
})

test('OFX 1.x (SGML, sem tags de fechamento) e 2.x (XML)', () => {
  const sgml = `OFXHEADER:100\r\nDATA:OFXSGML\r\nCHARSET:1252\r\n\r\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>\r\n<TRNTYPE>DEBIT\r\n<DTPOSTED>20260910120000[-3:GMT]\r\n<TRNAMT>-45,90\r\n<FITID>ABC123\r\n<MEMO>COMPRA MERCADO EXTRA\r\n</STMTTRN>
<STMTTRN>\r\n<TRNTYPE>CREDIT\r\n<DTPOSTED>20260905\r\n<TRNAMT>5000.00\r\n<FITID>ABC124\r\n<NAME>SALARIO\r\n<MEMO>PAGAMENTO EMPRESA XYZ\r\n</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
  expect(parseOfx(sgml)).toEqual([
    { date: '2026-09-10', description: 'COMPRA MERCADO EXTRA', amount: -45.9, fitid: 'ABC123' },
    { date: '2026-09-05', description: 'SALARIO - PAGAMENTO EMPRESA XYZ', amount: 5000, fitid: 'ABC124' },
  ])
  const xml = '<OFX><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260911</DTPOSTED><TRNAMT>-10.00</TRNAMT><FITID>Z1</FITID><MEMO>Caf&amp;eacute; &amp; Cia</MEMO></STMTTRN></OFX>'
  expect(parseOfx(xml)[0]).toMatchObject({ date: '2026-09-11', amount: -10, description: 'Caf&eacute; & Cia' })
  expect(parseOfx('<OFX><STMTTRN><DTPOSTED>lixo<TRNAMT>x</STMTTRN></OFX>')).toEqual([]) // linha inválida é ignorada
})

test('codificação: UTF-8 e windows-1252', () => {
  const utf8 = new TextEncoder().encode('Crédito é ção').buffer as ArrayBuffer
  expect(decodeText(utf8)).toBe('Crédito é ção')
  const latin1 = Uint8Array.from([0x43, 0x72, 0xe9, 0x64, 0x69, 0x74, 0x6f]).buffer as ArrayBuffer // "Crédito" em 1252
  expect(decodeText(latin1)).toBe('Crédito')
})

test('CSV de conta com ponto e vírgula, aspas e valores em pt-BR', () => {
  const csv = 'Extrato da conta\nPeríodo: 01/09/2026 a 30/09/2026\n\nData;Histórico;Valor\n10/09/2026;"COMPRA; MERCADO EXTRA";-45,90\n05/09/2026;PIX RECEBIDO JOAO;1.250,00\n'
  const { format, rows } = parseStatement(csv)
  expect(format).toBe('csv')
  expect(rows).toEqual([
    { date: '2026-09-10', description: 'COMPRA; MERCADO EXTRA', amount: -45.9 },
    { date: '2026-09-05', description: 'PIX RECEBIDO JOAO', amount: 1250 },
  ])
})

test('CSV com colunas separadas de crédito e débito', () => {
  const csv = 'Data,Descrição,Débito,Crédito\n03/09/2026,Aluguel,2000.00,\n05/09/2026,Salário,,5000.00\n'
  expect(parseStatement(csv).rows).toEqual([
    { date: '2026-09-03', description: 'Aluguel', amount: -2000 },
    { date: '2026-09-05', description: 'Salário', amount: 5000 },
  ])
})

test('CSV de fatura de cartão (formato tipo Nubank: date,category,title,amount)', () => {
  const csv = 'date,category,title,amount\n2026-09-03,restaurante,Ifood *Restaurante,42.90\n2026-09-05,,Pagamento recebido,-1500.00\n'
  const { rows } = parseStatement(csv)
  expect(rows).toHaveLength(2)
  expect(rows[0]).toEqual({ date: '2026-09-03', description: 'Ifood *Restaurante', amount: 42.9 })
  // na fatura, positivo é despesa
  const c = buildCandidates(rows, 'card', [])
  expect(c[0]).toMatchObject({ type: 'expense', amount: 42.9, category: 'alimentacao', status: 'ok' })
  expect(c[1]).toMatchObject({ type: 'income', status: 'invoice' }) // "Pagamento recebido" não é receita de verdade
})

test('CSV sem cabeçalho: adivinha as colunas pelo conteúdo', () => {
  const csv = '10/09/2026;Padaria Central;-12,50\n11/09/2026;Uber *Trip;-23,00\n'
  expect(parseStatement(csv).rows.map((r) => [r.date, r.description, r.amount])).toEqual([['2026-09-10', 'Padaria Central', -12.5], ['2026-09-11', 'Uber *Trip', -23]])
})

test('categorias: histórico do usuário vence as regras; regras cobrem o resto', () => {
  const history = buildHistory([tx('1', 'Mercado Extra', 100, '2026-09-01', 'alimentacao'), tx('2', 'Mercado Extra', 90, '2026-08-01', 'alimentacao'), tx('3', 'Uber Trip', 20, '2026-08-01', 'trabalho')])
  expect(suggestCategory('MERCADO EXTRA 123', 'expense', history)).toBe('alimentacao') // por 2 primeiras palavras
  expect(suggestCategory('Uber Trip', 'expense', history)).toBe('trabalho') // histórico do usuário (Uber de trabalho) vence a regra de transporte
  expect(suggestCategory('Uber Trip', 'expense', new Map())).toBe('transporte')
  expect(suggestCategory('NETFLIX.COM', 'expense', new Map())).toBe('assinaturas')
  expect(suggestCategory('Drogaria São Paulo', 'expense', new Map())).toBe('saude')
  expect(suggestCategory('Loja qualquer', 'expense', new Map())).toBe('outros')
  expect(suggestCategory('SALARIO EMPRESA', 'income', new Map())).toBe('salario')
  expect(suggestCategory('Repasse Uber', 'income', new Map())).toBe('variavel')
  expect(suggestCategory('Pix de Maria', 'income', new Map())).toBe('renda')
  expect(normDesc('  Padaría  ÇÃO ')).toBe('padaria cao')
})

test('pagamento de fatura é reconhecido', () => {
  for (const d of ['Pagamento de fatura', 'PAGTO FATURA CARTAO', 'Pagamento recebido', 'Fatura do cartão Visa']) expect(isInvoicePayment(d), d).toBe(true)
  for (const d of ['Padaria', 'Pagamento de aluguel']) expect(isInvoicePayment(d), d).toBe(false)
})

test('duplicados: reimportar não repete e compra igual já lançada é sinalizada', () => {
  const rows = [
    { date: '2026-09-10', description: 'MERCADO', amount: -45.9, fitid: 'A1' },
    { date: '2026-09-11', description: 'CAFE', amount: -8 },
    { date: '2026-09-11', description: 'CAFE', amount: -8 }, // duas compras idênticas no mesmo dia
  ]
  const first = buildCandidates(rows, 'account', [])
  expect(new Set(first.map((c) => c.id)).size).toBe(3) // ids distintos mesmo para linhas idênticas
  expect(first.every((c) => c.status === 'ok')).toBe(true)
  // já importado: mesmos ids
  const imported = first.map((c) => tx(c.id, c.description, c.amount, c.date))
  expect(buildCandidates(rows, 'account', imported).map((c) => c.status)).toEqual(['imported', 'imported', 'imported'])
  // lançado à mão com mesma data e valor: possível duplicado
  const manual = [tx('m1', 'Mercado (manual)', 45.9, '2026-09-10')]
  expect(buildCandidates(rows, 'account', manual).map((c) => c.status)).toEqual(['maybe', 'ok', 'ok'])
  // o id não depende da ordem das outras linhas
  expect(buildCandidates(rows.slice(0, 1), 'account', [])[0].id).toBe(first[0].id)
})
