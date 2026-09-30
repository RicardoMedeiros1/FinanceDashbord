import { expect, test } from '../support/test'
import { device, norm } from '../support/util'

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260910120000[-3:GMT]
<TRNAMT>-45,90
<FITID>A1
<MEMO>COMPRA MERCADO EXTRA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260905
<TRNAMT>5000.00
<FITID>A2
<NAME>SALARIO
<MEMO>EMPRESA XYZ
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260920
<TRNAMT>-700.00
<FITID>A3
<MEMO>PAGAMENTO DE FATURA CARTAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260911
<TRNAMT>-8.00
<FITID>A4
<MEMO>Café da Esquina
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260912
<TRNAMT>-55.90
<FITID>A5
<MEMO>NETFLIX.COM
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

test('importar OFX: acentos, duplicados, fatura, conta, reimportação e categorias', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, {
    init: () => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      const set = (k: string, v: unknown) => localStorage.setItem('fd:' + k, JSON.stringify(v))
      set('accounts', [{ id: 'a', name: 'Nubank', kind: 'checking', openingBalance: 1000, openingDate: '2026-09-01', color: '#8b3ff5' }])
      set('cards', [{ id: 'c', name: 'Visa', closingDay: 5, dueDay: 12, color: '#3b6ef5' }])
      set('txs', [{ id: 'm1', description: 'Mercado (lancei à mão)', amount: 45.9, type: 'expense', category: 'alimentacao', date: '2026-09-10' }])
    },
  })
  await p.goto('./')
  await p.click('.nav-item[aria-label="Transações"]')
  await p.click('button:has-text("Importar extrato")')
  // arquivo OFX em windows-1252 (como os bancos exportam)
  await p.locator('.file-drop input').setInputFiles({ name: 'extrato.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(OFX, 'latin1') })
  await expect(p.locator('.import-table tbody tr')).toHaveCount(5)
  const rows = await p.locator('.import-table tbody tr').allTextContents()
  const text = norm(rows.join('|'))
  expect(text).toContain('Café da Esquina') // acento preservado
  expect(text).toContain('Possível duplicado') // Mercado: mesma data e valor já lançados
  expect(text).toContain('Pagamento/estorno de fatura')
  const checked = await p.locator('.import-table tbody input[type=checkbox]:checked').count()
  expect(checked).toBe(3) // salário, café, netflix (mercado e fatura vêm desmarcados)
  // categorias sugeridas
  expect(await p.locator('select[aria-label="Categoria de NETFLIX.COM"]').inputValue()).toBe('assinaturas')
  expect(await p.locator('select[aria-label^="Categoria de SALARIO"]').inputValue()).toBe('salario')
  expect(await p.locator('select[aria-label="Categoria de Café da Esquina"]').inputValue()).toBe('alimentacao')
  // o usuário corrige uma categoria antes de importar
  await p.locator('select[aria-label="Categoria de Café da Esquina"]').selectOption('lazer')
  await p.getByLabel('Importar para').selectOption({ label: 'Nubank' })
  await expect(p.locator('.import-foot')).toContainText('3 selecionados')
  await p.click('button:has-text("Importar 3 lançamentos")')
  await expect(p.getByRole('status')).toContainText('3 lançamentos importados')
  await p.click('button:has-text("Fechar")')

  const txs = await p.ls('fd:txs')
  expect(txs).toHaveLength(4)
  const cafe = txs.find((t: any) => t.description === 'Café da Esquina')
  expect(cafe).toMatchObject({ category: 'lazer', amount: 8, type: 'expense', accountId: 'a', date: '2026-09-11' })
  expect(txs.find((t: any) => t.description.startsWith('SALARIO'))).toMatchObject({ type: 'income', category: 'salario', amount: 5000, accountId: 'a' })
  expect(txs.every((t: any) => t.id === 'm1' || t.id.startsWith('imp-'))).toBe(true)

  // o saldo da conta acompanha: 1000 + 5000 − 8 − 55,90
  await p.click('.nav-item[aria-label="Visão geral"]')
  await expect(p.getByTestId('accounts-total')).toContainText('R$ 5.936,10')

  // reimportar o mesmo arquivo: nada novo (tudo "já importado")
  await p.click('.nav-item[aria-label="Transações"]')
  await p.click('button:has-text("Importar extrato")')
  await p.locator('.file-drop input').setInputFiles({ name: 'extrato.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(OFX, 'latin1') })
  await expect(p.locator('.badge.imported')).toHaveCount(3)
  await expect(p.locator('.import-foot')).toContainText('0 selecionados')
  await expect(p.locator('.import-foot button.btn.primary')).toBeDisabled()
  // marcar o "possível duplicado" de propósito importa mesmo assim
  await p.locator('input[aria-label="Importar COMPRA MERCADO EXTRA"]').check()
  await p.click('button:has-text("Importar 1 lançamento")')
  await p.click('button:has-text("Fechar")')
  expect(await p.ls('fd:txs')).toHaveLength(5)
  expect(p.errors).toEqual([])
})

test('importar fatura de cartão em CSV e mapear colunas de um formato desconhecido', async ({ browser, baseURL }) => {
  const { p } = await device(browser, baseURL, {
    init: () => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('fd:cards', JSON.stringify([{ id: 'c', name: 'Visa', closingDay: 5, dueDay: 12, color: '#3b6ef5' }]))
    },
  })
  await p.goto('./')
  await p.click('.nav-item[aria-label="Transações"]')

  // fatura (positivo = despesa); "Pagamento recebido" não é receita
  await p.click('button:has-text("Importar extrato")')
  const csv = 'date,category,title,amount\n2026-09-03,restaurante,Ifood *Restaurante,42.90\n2026-09-08,transporte,Uber *Trip,23.50\n2026-09-05,,Pagamento recebido,-1500.00\n'
  await p.locator('.file-drop input').setInputFiles({ name: 'fatura.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await p.getByLabel('Importar para').selectOption({ label: 'Visa' })
  await expect(p.getByLabel('Como ler os valores')).toHaveValue('card') // escolhido sozinho ao selecionar um cartão
  await expect(p.locator('.import-foot')).toContainText('2 selecionados')
  expect(norm(await p.locator('.import-table').textContent())).toContain('Estorno/crédito: não importado')
  await p.click('button:has-text("Importar 2 lançamentos")')
  await p.click('button:has-text("Fechar")')
  const txs = await p.ls('fd:txs')
  expect(txs.map((t: any) => [t.description, t.amount, t.type, t.cardId, t.category])).toEqual(expect.arrayContaining([
    ['Ifood *Restaurante', 42.9, 'expense', 'c', 'alimentacao'],
    ['Uber *Trip', 23.5, 'expense', 'c', 'transporte'],
  ]))
  // cai na fatura certa: 03/09 → fatura que fechou dia 5; 08/09 → a seguinte
  await p.click('.nav-item[aria-label="Cartões e contas"]')
  await p.click('.cc:has-text("Visa") button:has-text("Ver faturas")')
  expect(norm(await p.locator('.invoice:has-text("Vencida")').textContent())).toContain('R$ 42,90')
  expect(norm(await p.locator('.invoice:has-text("Aberta")').textContent())).toContain('R$ 23,50')

  // formato desconhecido, com duas colunas numéricas: o app pega o saldo por engano e você corrige nas colunas
  await p.click('.nav-item[aria-label="Transações"]')
  await p.click('button:has-text("Importar extrato")')
  const weird = 'Quando;O que;Saldo;Quanto\n10/09/2026;Loja do Zé;1000,00;-30,00\n11/09/2026;Pix da Ana;1120,00;120,00\n'
  await p.locator('.file-drop input').setInputFiles({ name: 'estranho.csv', mimeType: 'text/csv', buffer: Buffer.from(weird) })
  await expect(p.locator('.import-table tbody tr')).toHaveCount(2)
  expect(norm(await p.locator('.import-table').textContent())).toContain('+ R$ 1.000,00') // pegou o saldo
  await p.click('button:has-text("Ajustar colunas")')
  await expect(p.getByText('Diga qual coluna é cada coisa')).toBeVisible()
  await p.getByLabel('Valor').selectOption({ label: '4. Quanto' })
  await expect(p.getByText('Prévia:')).toBeVisible()
  await p.click('button:has-text("Usar essas colunas")')
  await expect(p.locator('.import-table tbody tr')).toHaveCount(2)
  const t2 = norm(await p.locator('.import-table').textContent())
  expect(t2).toContain('− R$ 30,00')
  expect(t2).toContain('+ R$ 120,00')
  await p.click('button:has-text("Importar 2 lançamentos")')
  await p.click('button:has-text("Fechar")')
  const all = await p.ls('fd:txs')
  expect(all.find((t: any) => t.description === 'Pix da Ana')).toMatchObject({ type: 'income', amount: 120, category: 'renda' })
  expect(all.find((t: any) => t.description === 'Loja do Zé')).toMatchObject({ type: 'expense', amount: 30 })

  // arquivo sem lançamentos: mensagem clara
  await p.click('button:has-text("Importar extrato")')
  await p.locator('.file-drop input').setInputFiles({ name: 'vazio.txt', mimeType: 'text/plain', buffer: Buffer.from('nada aqui') })
  await expect(p.getByRole('alert')).toContainText('Não encontrei lançamentos')
  expect(p.errors).toEqual([])
})
