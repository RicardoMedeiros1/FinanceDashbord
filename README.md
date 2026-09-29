# Finn — Dashboard de finanças pessoais

Dashboard para acompanhar gastos, assinaturas e orçamentos. Visual inspirado no projeto "AI Finance Dashboard" (Behance): tema escuro, laranja/coral, cartões com mini-gráficos.
React + TypeScript + Vite, gráficos com Recharts. Os dados ficam salvos no `localStorage` do navegador (nada sai da sua máquina).

## Funcionalidades

- **Visão geral**: saldo, receitas, despesas e taxa de poupança (com variação vs. mês anterior), gráfico dos últimos 6 meses, gastos por categoria, próximas cobranças e transações recentes.
- **Insights**: alertas automáticos por regras (gastos acima da renda, categorias que subiram, orçamentos perto do limite, assinaturas renovando), em um card no estilo do projeto de referência.
- **Assistente**: perguntas em linguagem natural sobre gastos, assinaturas, orçamentos e economia. Funciona por palavras-chave sobre os seus dados, localmente — não é um LLM.
- **Metas de economia**: crie metas e vá guardando valores.
- **Saúde financeira**: nota de 0 a 100 (poupança, orçamentos respeitados, peso das assinaturas), na aba Orçamentos.
- **Transações**: busca, filtro por mês/tipo, adicionar e excluir.
- **Assinaturas**: custo mensal/anual, próxima renovação, pausar/reativar, adicionar e excluir.
- **Orçamentos**: limite por categoria com barra de progresso.

## Rodando

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build de produção
```

Na primeira abertura o app carrega dados de exemplo; use "Restaurar exemplo" para recarregá-los.
