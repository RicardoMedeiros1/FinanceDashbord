<div align="center">

<img src="docs/img/hero.png" alt="Finn: painel de finanças pessoais, no computador e no celular" width="100%">

# Finn

**Finanças pessoais claras e seguras: gastos, cartões, contas, metas e investimentos num só lugar.**

PWA instalável · funciona offline · integração com o banco via Open Finance · verificação em duas etapas

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-opcional-3ecf8e?logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline-orange)
![Testes](https://img.shields.io/badge/testes-Playwright-45ba4b?logo=playwright&logoColor=white)

</div>

> **Sobre as imagens deste README:** todas as capturas usam uma persona **fictícia** (Marina Alves, bancos "Aurora" e "Horizonte", lojas e valores inventados) geradas automaticamente a partir de dados de exemplo. Nenhum dado real aparece aqui. Para refazê-las: `npm run screenshots`.

## Por que o Finn?

Planilhas cansam e apps de banco só mostram o próprio banco. O Finn junta tudo, **sem depender de ninguém**: você pode usá-lo só no navegador (os dados ficam no seu aparelho) ou ligar a nuvem para ter o mesmo painel no computador e no celular, com login, 2FA e leitura automática do extrato do banco.

- **Entende o seu dinheiro**: separa salário fixo de renda variável, prevê o fim do mês e avisa quando algo foge do normal.
- **Mostra para onde ele vai**: ranking por estabelecimento ("quanto gastei no Mercado Livre?") e grupos por tipo (padaria, delivery, farmácia).
- **Ajuda a começar a investir**: reserva de emergência, simulador com imposto de renda regressivo, metas com prazo e uma área de conceitos em português simples.
- **Cuida de você**: alertas de cobrança repetida e de compra fora do padrão, limites mensais por grupo de gastos e relatório do mês em PDF.
- **Leva a segurança a sério**: 2FA obrigatório, registro e bloqueio de tentativas de acesso, PIN do app, CSP e senha forte.

## Visão geral

<p align="center"><img src="docs/img/overview.png" alt="Visão geral com saldo, receitas, despesas, fluxo de caixa, contas e próximos pagamentos" width="92%"></p>

Saldo do mês, receitas, despesas e assinaturas com variação sobre o mês anterior, fluxo de caixa, saldo das contas, próximos pagamentos (parcelas, faturas, assinaturas), **previsão do mês**, **alertas** e insights automáticos.

> **Alertas** (cartão no topo, cada um pode ser dispensado): compra bem acima do que você costuma pagar naquele lugar, a mesma cobrança duas vezes em até 2 dias, assinatura que mudou de valor e gasto do mês acima do ritmo dos 3 meses anteriores. Na imagem, uma cobrança repetida numa ótica fictícia.

## Um passeio pelo app

### Transações, importação e transferências

<table>
<tr>
<td width="50%"><img src="docs/img/transactions.png" alt="Lista de transações com busca, filtros e categorias"><br><sub><b>Transações</b>: busca, filtro por mês e tipo, categorias e cartão de cada compra.</sub></td>
<td width="50%"><img src="docs/img/import.png" alt="Importação de extrato OFX/CSV com sugestão de categoria e duplicados"><br><sub><b>Importar extrato</b> (OFX ou CSV): categoria sugerida, duplicados e pagamentos de fatura sinalizados.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/img/transfers.png" alt="Aviso e revisão de transferências entre as próprias contas"><br><sub><b>Transferências entre contas</b>: o Pix para a própria reserva deixa de contar como despesa e receita.</sub></td>
<td width="50%"><img src="docs/img/assistant.png" alt="Assistente respondendo perguntas sobre os gastos"><br><sub><b>Assistente</b>: perguntas em linguagem natural, respondidas localmente sobre os seus dados.</sub></td>
</tr>
</table>

### Onde eu gasto

<table>
<tr>
<td width="50%"><img src="docs/img/spending.png" alt="Ranking dos estabelecimentos onde mais se gasta"><br><sub>Ranking por estabelecimento: grafias diferentes da mesma loja viram uma só.</sub></td>
<td width="50%"><img src="docs/img/spending-detail.png" alt="Detalhe de um grupo (padaria): total, média, maior compra e gráfico por mês"><br><sub>Busca por nome ou por tipo (<code>padaria, panificadora</code>): total, média, maior compra e evolução mensal. Dá para salvar como grupo.</sub></td>
</tr>
</table>

Cada grupo salvo aceita um **limite mensal**: o card mostra o quanto já foi gasto, avisa aos 80% e ao estourar (na Visão geral e no assistente) e o limite também aparece em *Orçamentos*.

### Cartões, contas, assinaturas e orçamentos

<table>
<tr>
<td width="50%"><img src="docs/img/cards.png" alt="Cartões de crédito com fatura atual, limite e melhor dia de compra"><br><sub><b>Cartões</b>: fechamento, vencimento, limite disponível e melhor dia de compra.</sub></td>
<td width="50%"><img src="docs/img/card-invoices.png" alt="Faturas do cartão: aberta, fechada, paga e futuras"><br><sub><b>Faturas</b>: aberta, fechada, vencida, paga e futuras; pagar a fatura não cria outra despesa.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/img/accounts.png" alt="Contas com saldo real, extrato e evolução do saldo mês a mês"><br><sub><b>Contas</b>: saldo real (inicial + entradas − saídas), extrato e <b>evolução do saldo mês a mês</b> (transferências entre contas não viram "ganho").</sub></td>
<td width="50%"><img src="docs/img/subscriptions.png" alt="Assinaturas com custo mensal, anual e próxima renovação"><br><sub><b>Assinaturas</b>: custo mensal e anual, próxima renovação, cada cobrança vira despesa.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/img/installments.png" alt="Parcelas e dívidas com quanto falta e quando termina"><br><sub><b>Parcelas e dívidas</b>: o que já venceu, quanto falta e quando termina.</sub></td>
<td width="50%"><img src="docs/img/budgets.png" alt="Orçamentos por categoria, limites por grupo e nota de saúde financeira"><br><sub><b>Orçamentos</b> por categoria, <b>limites por grupo</b> e <b>nota de saúde financeira</b> de 0 a 100.</sub></td>
</tr>
</table>

### Relatório do mês

<p align="center"><img src="docs/img/report.png" alt="Relatório do mês com receitas, despesas, categorias, estabelecimentos, orçamentos e limites" width="60%"></p>

O botão de documento no topo abre o resumo de qualquer mês: receitas, despesas e saldo com variação sobre o mês anterior, para onde foi o dinheiro, onde mais gastou, maiores despesas, orçamentos e limites, saldo nas contas e assinaturas. **Imprimir / salvar PDF** gera uma versão em papel claro, só com o relatório.

### Investir: aprender antes de começar

<table>
<tr>
<td width="50%"><img src="docs/img/invest-reserve.png" alt="Reserva de emergência com meta em meses de despesa"><br><sub><b>Reserva de emergência</b>: meta de 3 a 12 meses da sua despesa média real, quanto falta e em quanto tempo chega lá.</sub></td>
<td width="50%"><img src="docs/img/invest-simulator.png" alt="Simulador comparando poupança, CDB, LCI/LCA e Tesouro"><br><sub><b>Simulador</b>: poupança, CDB, LCI/LCA, Tesouro Selic e IPCA+ com IR regressivo, aportes e inflação. Taxas do Banco Central com um clique.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/img/invest-goals.png" alt="Metas com prazo e quanto guardar por mês"><br><sub><b>Metas com prazo</b>: quanto guardar por mês, se você está no ritmo e atalho para o simulador.</sub></td>
<td width="50%"><img src="docs/img/invest-concepts.png" alt="Conceitos de investimento explicados em português simples"><br><sub><b>Conceitos</b>: juros compostos, Selic, CDI, FGC, IR e mais, com exemplos calculados e trilha "Por onde começar".</sub></td>
</tr>
</table>

> Conteúdo educativo: o Finn **não recomenda produtos** de investimento.

### Conexão com o banco (Open Finance)

<p align="center"><img src="docs/img/bank.png" alt="Sincronização bancária: lançamentos novos, conta criada e fatura ignorada" width="55%"></p>

Com a nuvem ligada, o Finn traz contas, cartões e lançamentos do banco pelo **Meu Pluggy** (gratuito para uso pessoal). Cria a conta com saldo que fecha com o do banco, **não duplica** o que você já lançou à mão ou por arquivo e deixa de fora o pagamento da fatura. As credenciais ficam numa Edge Function do Supabase, nunca no navegador. Veja [docs/OPEN_FINANCE.md](docs/OPEN_FINANCE.md).

### No celular

<table>
<tr>
<td align="center" width="25%"><img src="docs/img/mobile-overview.png" alt="Visão geral no celular"><br><sub>Visão geral</sub></td>
<td align="center" width="25%"><img src="docs/img/mobile-spending.png" alt="Onde gasto no celular"><br><sub>Onde gasto</sub></td>
<td align="center" width="25%"><img src="docs/img/mobile-reserve.png" alt="Reserva de emergência no celular"><br><sub>Reserva</sub></td>
<td align="center" width="25%"><img src="docs/img/mobile-simulator.png" alt="Simulador no celular"><br><sub>Simulador</sub></td>
</tr>
</table>

Instalável como app (PWA), com barra de navegação inferior, e funciona **offline**.

### Privacidade

<p align="center"><img src="docs/img/privacy.png" alt="Modo privacidade escondendo os valores" width="70%"></p>

O botão do olho esconde todos os valores na tela (útil em público ou para mostrar o app a alguém).

## Segurança

Tratada como requisito, não como extra. Detalhes e limites honestos em [docs/SEGURANCA.md](docs/SEGURANCA.md).

<table>
<tr>
<td width="33%"><img src="docs/img/login.png" alt="Tela de login"><br><sub><b>Acesso restrito</b>: login por e-mail e senha (mínimo de 12 caracteres), sem cadastro público.</sub></td>
<td width="33%"><img src="docs/img/mfa-setup.png" alt="Cadastro do aplicativo autenticador com QR code"><br><sub><b>2FA obrigatório</b>: no primeiro acesso é preciso cadastrar o aplicativo autenticador (QR code fictício).</sub></td>
<td width="33%"><img src="docs/img/mfa-challenge.png" alt="Pedido do código de 6 dígitos"><br><sub>Em cada login, o código de 6 dígitos do aplicativo.</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/img/security-alert.png" alt="Aviso de tentativas de acesso com senha errada"><br><sub><b>Alerta de tentativas</b>: avisa na Visão geral quando alguém errou a senha da sua conta.</sub></td>
<td width="33%"><img src="docs/img/security.png" alt="Central de segurança: 2FA, PIN, acessos recentes e sessões"><br><sub><b>Central de segurança</b>: 2FA, PIN, acessos recentes (data, aparelho e IP) e "sair de todos os aparelhos".</sub></td>
<td width="33%"><img src="docs/img/lock.png" alt="Tela de bloqueio por PIN"><br><sub><b>Bloqueio por PIN</b>: com atrasos crescentes a cada erro e apagamento local após 10 falhas.</sub></td>
</tr>
</table>

| Camada | O que faz |
| --- | --- |
| **2FA (TOTP)** | Obrigatório; o banco recusa dados a quem não passou pelo segundo fator (regra em `supabase/security-2fa.sql`) |
| **Tentativas de acesso** | Login passa por uma Edge Function que registra cada tentativa (IP, aparelho) e bloqueia por e-mail e por IP |
| **Isolamento por usuário** | Row Level Security: cada pessoa só lê e grava os próprios registros |
| **PIN do app** | PBKDF2 (150 mil iterações), atrasos progressivos, é uma trava de tela (não criptografa o navegador) |
| **CSP** | Política de conteúdo gerada no build: sem scripts de terceiros, conexões só com o Supabase e o Banco Central |
| **Sem terceiros no navegador** | Fonte hospedada junto do app; segredos do Open Finance só no servidor |
| **Dependências** | Dependabot semanal |

## Como funciona

```mermaid
flowchart LR
  U([Você]) --> App["Finn (PWA)<br/>React + TypeScript"]
  App <--> LS[("localStorage<br/>modo local")]
  App <-- "login + 2FA" --> SB["Supabase<br/>Auth · Postgres com RLS"]
  App -- "sincroniza por registro" --> SB
  App -- "login" --> ACC["Edge Function access<br/>registro e bloqueio"]
  ACC --> SB
  App -- "sincronizar banco" --> PL["Edge Function pluggy"]
  PL <--> MP["Meu Pluggy<br/>Open Finance"]
  App -- "Selic · CDI · IPCA" --> BCB["API do Banco Central"]
```

- **Local-first**: tudo funciona sem internet e sem conta. Com a nuvem ligada, sincroniza **por registro** (não sobrescreve o banco inteiro), com resolução de conflitos.
- **Lógica de negócio em funções puras** (faturas, parcelas, recorrências, transferências, simulador, importador), testadas sem navegador.
- **Os servidores de teste são falsos e locais**: nenhum teste acessa o Supabase real.

## Tecnologias

React 19 · TypeScript · Vite · Recharts · lucide-react · vite-plugin-pwa (service worker, offline) · Supabase (Auth com MFA, Postgres com RLS, Edge Functions) · Playwright (unitários e ponta a ponta) · GitHub Actions + GitHub Pages.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Passo a passo para ligar a nuvem, o login e o 2FA |
| [docs/OPEN_FINANCE.md](docs/OPEN_FINANCE.md) | Conectar o banco pelo Meu Pluggy |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Modelo de ameaças, proteções e limites |

<details>
<summary><b>Lista completa de funcionalidades</b> (clique para abrir)</summary>

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
- **Limites por grupo**: em *Transações → Onde gasto*, cada grupo salvo pode ter um limite mensal, com barra de progresso, aviso aos 80% e ao estourar (também em *Orçamentos*, nos insights e no assistente).
- **Evolução do saldo** (*Cartões e contas → Contas*): gráfico do saldo total no fim de cada mês, variação no último mês, no período, melhor/pior mês e parte em poupança. Só compara contas que já existiam, então abrir uma conta nova ou transferir entre contas não parece ganho.
- **Alertas** (Visão geral): compra fora do padrão, cobrança repetida, assinatura que mudou de preço e gasto acima do ritmo; dá para dispensar e o assistente lista todos (*"tenho algum alerta?"*).
- **Relatório do mês**: resumo de qualquer mês (botão de documento no topo), com navegação entre meses e impressão/PDF.
- **Para outras pessoas**: passo a passo de boas-vindas na Visão geral (some sozinho ao concluir ou ao dispensar), convite por e-mail com definição de senha, modo privacidade (esconde os valores), página de privacidade e termos e exclusão da própria conta (**Dados → Excluir minha conta**).

</details>

## Rodando o projeto

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

Ficam no navegador de cada aparelho (`localStorage`). Para levar de um aparelho a outro (lançamentos, contas, cartões, metas, grupos de gastos e seus limites), use **Dados → Exportar backup** e **Importar backup**.

## Testes

- `npm test`: roda tudo (unitários + ponta a ponta com Playwright). Os testes de ponta a ponta sobem o app e, para a nuvem, um servidor falso local (`tests/support/fakeserver.ts`); nenhum acesso ao Supabase real.
- `npm run test:unit`: só a lógica pura (faturas, parcelas, assinaturas, sincronização, erros de login).
- Na primeira vez: `npx playwright install chromium`. Se você já tem um Chromium instalado, use `PW_CHROMIUM_PATH=/caminho/do/chromium npm test`.
- Os testes usam um relógio fixo (29/09/2026), então o resultado não muda com o dia em que rodam.
- No GitHub, o workflow de publicação roda o tipo-checagem e todos os testes antes de publicar; em pull requests, o workflow *Tests* roda a mesma verificação.

## Refazendo as capturas deste README

```bash
npm run screenshots   # sobe o app com dados fictícios e salva docs/img/*.png
```

As capturas vêm de `tests/screenshots/` (dados em `seed.ts`, sempre fictícios e com relógio fixo), para que o visual da documentação acompanhe o app.
