# Finn — Dashboard de finanças pessoais

Dashboard para acompanhar gastos, assinaturas e orçamentos. Visual inspirado no projeto "AI Finance Dashboard" (Behance): tema escuro, laranja/coral, cartões com mini-gráficos.
React + TypeScript + Vite, gráficos com Recharts. Os dados ficam salvos no `localStorage` do navegador (nada sai da sua máquina).

## Funcionalidades

- **Visão geral**: saldo, receitas, despesas e taxa de poupança (com variação vs. mês anterior), gráfico dos últimos 6 meses, gastos por categoria, próximas cobranças e transações recentes.
- **Insights**: alertas automáticos por regras (gastos acima da renda, categorias que subiram, orçamentos perto do limite, assinaturas renovando), em um card no estilo do projeto de referência.
- **Assistente**: perguntas em linguagem natural sobre gastos, assinaturas, orçamentos e economia. Funciona por palavras-chave sobre os seus dados, localmente — não é um LLM.
- **Metas de economia**: crie metas com valor e **prazo opcional**; o app calcula quantos meses faltam, **quanto guardar por mês** (sem render e, como estimativa, rendendo como o Tesouro Selic, já com imposto), se você está **no ritmo** e leva ao simulador já preenchido. Dá para editar, ajustar o valor guardado e excluir (menu *Investir → Metas*).
- **Saúde financeira**: nota de 0 a 100 (poupança, orçamentos respeitados, peso das assinaturas), na aba Orçamentos.
- **Transações**: busca, filtro por mês/tipo, adicionar, **editar** e excluir.
- **Receitas por tipo**: *Salário fixo*, *Renda variável (Uber, freelas)* e *Outras receitas*. A Visão geral mostra a divisão do mês, e os insights comparam o salário fixo com as despesas e calculam a renda variável líquida (descontando a categoria *Custos do trabalho*).
- **Importar extrato** (Transações → *Importar extrato*): lê arquivos **OFX** ou **CSV** do banco direto no navegador (nada é enviado). Reconhece acentos (windows-1252), datas e valores em pt-BR, colunas de crédito/débito e faturas de cartão; sugere a categoria (aprendendo com o seu histórico), sinaliza duplicados e pagamentos de fatura, não repete ao importar o mesmo arquivo de novo e permite ajustar as colunas se o formato for desconhecido.
- **Onde gasto** (Transações → *Onde gasto*): ranking dos estabelecimentos onde você mais gasta (as várias grafias da mesma loja viram uma só: `MERCADOLIVRE*12AB` e `Mercado Livre`), busca por nome ou por tipo (`mercado livre`, `padaria, panificadora`) com total, número de compras, média, maior compra, gráfico por mês e a lista das compras, por período (mês, 3, 6, 12 meses ou tudo). Grupos prontos (padaria, supermercado, delivery, Uber/99, farmácia...) e grupos seus, salvos na conta. O Assistente também responde *"quanto gastei no Mercado Livre?"*.
- **Transferências entre contas**: quando uma saída numa conta e uma entrada em outra têm o mesmo valor em até 3 dias (típico de Pix para a própria reserva), o app avisa em Transações e, se você confirmar, transforma o par em *transferência*: some da soma de receitas e despesas e o saldo das contas não muda. Também dá para marcar um lançamento só (o outro lado está fora do app, ex.: investimentos). Dá para desfazer no extrato da conta, e o banco/extrato não trazem de volta o que já virou transferência.
- **Investir** (menu *Investir*), para aprender antes de investir: **reserva de emergência** (meta de 3 a 12 meses de despesa a partir da sua média real, quanto já está guardado nas contas de poupança ou em outras que você marcar, quanto falta, em quantos meses chega e quanto guardar por mês) e **simulador** que compara poupança, CDB, LCI/LCA, Tesouro Selic e Tesouro IPCA+ com imposto de renda regressivo por aporte, aportes mensais, inflação e gráfico. As taxas (Selic, CDI, IPCA) vêm do Banco Central com um clique, ou você digita. A aba **Conceitos** explica em português simples juros compostos, inflação, Selic, CDI, IPCA, poupança, CDB, LCI/LCA, Tesouro, liquidez, FGC, imposto de renda regressivo e mais (com busca, exemplos calculados com as suas taxas, calculadoras e uma trilha *Por onde começar* que usa os seus dados); o simulador tem um "?" que abre o conceito certo. É educativo: não recomenda produtos.
- **Recorrentes**: cadastre salário, aluguel e contas fixas (semanal, mensal ou anual) uma vez; o app lança sozinho quando a data chega, sem duplicar e sem recriar o que você apagou. Dá para pausar, reativar e excluir a regra (os lançamentos já gerados ficam).
- **Assinaturas**: custo mensal/anual, próxima renovação, pausar/reativar, adicionar, editar e excluir. **Cada cobrança vira uma despesa** (categoria à sua escolha) no dia da renovação. O app não inventa histórico: só lança a partir do cadastro, e ao criar você pode incluir a cobrança do mês atual que já passou. Assinaturas pausadas não lançam nada. Se você já lança uma assinatura como transação ou recorrente, não cadastre aqui, para não contar duas vezes.
- **Parcelas e dívidas** (aba dentro de Assinaturas): informe o que comprou, com quem, a data da compra, o valor e o número de parcelas. O app calcula quantas já venceram, quanto falta e quando termina, e **lança cada parcela como despesa** (categoria à sua escolha) no dia do vencimento, até a última. Se a compra já tem parcelas vencidas, você escolhe se elas entram no histórico de despesas. Aparecem em "Próximos pagamentos", nos insights e no assistente.
- **Cartões de crédito**: cadastre cada cartão com dia de fechamento, vencimento e limite. Ao lançar uma despesa (ou assinatura, recorrente ou parcela em cartão próprio) escolha o cartão, e o app monta as faturas: aberta, fechada a pagar, vencida, paga e futuras, com total, datas, limite disponível e melhor dia de compra. As compras contam nos totais do mês no dia da compra; marcar a fatura como paga não cria outra despesa.
- **Contas**: corrente, carteira e poupança com saldo real (saldo inicial + entradas − saídas), transferências entre contas e extrato. Receitas e despesas escolhem a conta; o pagamento da fatura do cartão sai da conta sem virar despesa nova.
- **Previsão do mês**: quanto ainda entra e sai até o fim do mês (recorrentes, assinaturas, parcelas) e a sobra prevista; com contas, também o saldo previsto no fim do mês, descontando faturas a vencer.
- **Orçamentos**: limite por categoria com barra de progresso.
- **Bancos (Open Finance)**: com a nuvem ligada, traz contas, cartões e transações do banco pelo Meu Pluggy (gratuito para uso pessoal), sem duplicar o que você já lançou. As credenciais ficam numa Edge Function do Supabase. Veja [docs/OPEN_FINANCE.md](docs/OPEN_FINANCE.md).
- **Segurança** (detalhes em [docs/SEGURANCA.md](docs/SEGURANCA.md)): verificação em duas etapas obrigatória (aplicativo autenticador), registro e bloqueio de tentativas de acesso com aviso no app, sair de todos os aparelhos, bloqueio do app com PIN, política de conteúdo (CSP) e senha de 12+ caracteres. O banco pode exigir o 2FA por regra (`supabase/security-2fa.sql`).
- **Para outras pessoas**: passo a passo de boas-vindas na Visão geral (some sozinho ao concluir ou ao dispensar), convite por e-mail com definição de senha, modo privacidade (esconde os valores), página de privacidade e termos e exclusão da própria conta (**Dados → Excluir minha conta**).

## Rodando

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build de produção
```

Na primeira abertura o app carrega dados de exemplo; use "Restaurar exemplo" para recarregá-los.

## App instalável (PWA) e publicação

O projeto é um PWA: depois de publicado, abra o link no celular e use **Adicionar à tela inicial** (Safari/iOS: Compartilhar → Adicionar à Tela de Início; Chrome/Android: menu → Instalar app). Funciona offline.

### Publicando no GitHub Pages

1. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Faça push na branch configurada em `.github/workflows/deploy.yml` (ou rode o workflow em **Actions → Deploy to GitHub Pages → Run workflow**).
3. O app fica em `https://<seu-usuario>.github.io/FinanceDashbord/`.

Se usar outro nome de repositório ou domínio, ajuste `BASE_PATH` (padrão `/FinanceDashbord/`, ver `vite.config.ts`).

### Navegação

O menu lateral (ou a barra de baixo no celular) e as abas de cada página são clicáveis e só mostram o conteúdo da aba escolhida. A aba fica na URL (`#/subscriptions/installments`), então recarregar, voltar e favoritar funcionam.

### Login e sincronização (opcional)

Para ter os mesmos dados em todos os aparelhos, com login por e-mail e senha e comprovantes guardados na nuvem, configure o
Supabase seguindo [docs/SUPABASE.md](docs/SUPABASE.md). Sem isso o app continua funcionando só local.

- O app é local-first: funciona offline e sincroniza quando há internet, por registro (não sobrescreve o banco inteiro).
- Cada usuário só acessa os próprios dados (regras de segurança no banco). Com o cadastro desligado, só você entra.
- **Comprovantes** (foto ou PDF) podem ser anexados às parcelas pagas: em Assinaturas → Parcelas → *Parcelas e comprovantes*. Fotos são reduzidas antes de enviar. Sem nuvem, ficam guardados no aparelho.

### Seus dados

Ficam no navegador de cada aparelho (`localStorage`). Para levar de um aparelho a outro, use **Dados → Exportar backup** e **Importar backup**.

## Testes

- `npm test`: roda tudo (unitários + ponta a ponta com Playwright). Os testes de ponta a ponta sobem o app e, para a nuvem, um servidor falso local (`tests/support/fakeserver.ts`); nenhum acesso ao Supabase real.
- `npm run test:unit`: só a lógica pura (faturas, parcelas, assinaturas, sincronização, erros de login).
- Na primeira vez: `npx playwright install chromium`. Se você já tem um Chromium instalado, use `PW_CHROMIUM_PATH=/caminho/do/chromium npm test`.
- Os testes usam um relógio fixo (29/09/2026), então o resultado não muda com o dia em que rodam.
- No GitHub, o workflow de publicação roda o tipo-checagem e todos os testes antes de publicar; em pull requests, o workflow *Tests* roda a mesma verificação.
