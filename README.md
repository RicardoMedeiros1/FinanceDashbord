# Finn — Dashboard de finanças pessoais

Dashboard para acompanhar gastos, assinaturas e orçamentos. Visual inspirado no projeto "AI Finance Dashboard" (Behance): tema escuro, laranja/coral, cartões com mini-gráficos.
React + TypeScript + Vite, gráficos com Recharts. Os dados ficam salvos no `localStorage` do navegador (nada sai da sua máquina).

## Funcionalidades

- **Visão geral**: saldo, receitas, despesas e taxa de poupança (com variação vs. mês anterior), gráfico dos últimos 6 meses, gastos por categoria, próximas cobranças e transações recentes.
- **Insights**: alertas automáticos por regras (gastos acima da renda, categorias que subiram, orçamentos perto do limite, assinaturas renovando), em um card no estilo do projeto de referência.
- **Assistente**: perguntas em linguagem natural sobre gastos, assinaturas, orçamentos e economia. Funciona por palavras-chave sobre os seus dados, localmente — não é um LLM.
- **Metas de economia**: crie metas e vá guardando valores.
- **Saúde financeira**: nota de 0 a 100 (poupança, orçamentos respeitados, peso das assinaturas), na aba Orçamentos.
- **Transações**: busca, filtro por mês/tipo, adicionar, **editar** e excluir.
- **Receitas por tipo**: *Salário fixo*, *Renda variável (Uber, freelas)* e *Outras receitas*. A Visão geral mostra a divisão do mês, e os insights comparam o salário fixo com as despesas e calculam a renda variável líquida (descontando a categoria *Custos do trabalho*).
- **Recorrentes**: cadastre salário, aluguel e contas fixas (semanal, mensal ou anual) uma vez; o app lança sozinho quando a data chega, sem duplicar e sem recriar o que você apagou. Dá para pausar, reativar e excluir a regra (os lançamentos já gerados ficam).
- **Assinaturas**: custo mensal/anual, próxima renovação, pausar/reativar, adicionar, editar e excluir. **Cada cobrança vira uma despesa** (categoria à sua escolha) no dia da renovação. O app não inventa histórico: só lança a partir do cadastro, e ao criar você pode incluir a cobrança do mês atual que já passou. Assinaturas pausadas não lançam nada. Se você já lança uma assinatura como transação ou recorrente, não cadastre aqui, para não contar duas vezes.
- **Parcelas e dívidas** (aba dentro de Assinaturas): informe o que comprou, com quem, a data da compra, o valor e o número de parcelas. O app calcula quantas já venceram, quanto falta e quando termina, e **lança cada parcela como despesa** (categoria à sua escolha) no dia do vencimento, até a última. Se a compra já tem parcelas vencidas, você escolhe se elas entram no histórico de despesas. Aparecem em "Próximos pagamentos", nos insights e no assistente.
- **Orçamentos**: limite por categoria com barra de progresso.

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
