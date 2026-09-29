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
- **Recorrentes**: cadastre salário, aluguel e contas fixas (semanal, mensal ou anual) uma vez; o app lança sozinho quando a data chega, sem duplicar e sem recriar o que você apagou. Dá para pausar, reativar e excluir a regra (os lançamentos já gerados ficam).
- **Assinaturas**: custo mensal/anual, próxima renovação, pausar/reativar, adicionar e excluir.
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

### Seus dados

Ficam no navegador de cada aparelho (`localStorage`). Para levar de um aparelho a outro, use **Dados → Exportar backup** e **Importar backup**.
