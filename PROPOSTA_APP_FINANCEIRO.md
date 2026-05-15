# Proposta de aplicativo financeiro baseado na planilha Financeiro_Diego_Consolidado

## 1. O que entendi da planilha

A planilha atual funciona como um sistema financeiro pessoal/familiar consolidado. Ela não é apenas um controle simples de despesas; ela já contém um modelo relativamente completo de fluxo de caixa, investimentos, dívidas, cartões, extratos, balanço patrimonial e dashboards executivos.

O arquivo possui 70 abas. A estrutura principal parece ser:

- `Cockpit_Exec`, `Cockpit_Caixa`, `Cockpit_Invest`: painéis de acompanhamento.
- `Fluxo_Caixa`: motor principal de consolidação mensal por categorias e códigos.
- `Gráfico`, `Cartões`, `Extratos`, `Balanço`: visões auxiliares e resumos.
- Abas transacionais por instituição/tipo: `Itaú_B`, `Itaú_C`, `Inter_B`, `Inter_C`, `BTG_B`, `BTG_C`, `BTG_I`, `Nu_B`, `Nu_C`, `STD_B`, `STD_C`, `CEF_B`, `Clear_I`, `Rico_I`, `Caixa`.
- Abas de investimentos e ativos: `Investimentos`, `Rendimentos`, `Cotação`, `Dolar` e diversas abas por ativo/imóvel/produto.

O núcleo operacional está nas abas transacionais. Elas seguem praticamente o mesmo padrão:

| Campo atual | Interpretação |
|---|---|
| `Descrição` | texto original/importado do banco, cartão ou corretora |
| `Titular` | pessoa/descrição vinculada ao lançamento |
| `Valor (R$)` | valor do lançamento, positivo ou negativo |
| `COD` | código de classificação financeira |
| `Natureza` | categoria derivada do código |
| `Competência` | mês/data de competência |
| `Previsão` | data prevista |
| `Pagamento` | data efetiva |
| `Ano` / `Mês` | campos auxiliares calculados |

Foram identificados aproximadamente 15.375 lançamentos nas 15 abas transacionais padronizadas, cobrindo principalmente o período entre 2021 e 2026. O modelo soma esses lançamentos por `COD`, ano e mês dentro de `Fluxo_Caixa`.

## 2. Como o fluxo de caixa funciona hoje

A aba `Fluxo_Caixa` é o coração do modelo. Ela contém:

- receitas fixas e variáveis;
- despesas fixas essenciais;
- despesas fixas não essenciais;
- despesas temporárias;
- financiamentos;
- investimentos;
- resultado do período;
- saldo anterior;
- saldo final.

Os lançamentos são classificados por códigos numéricos. Exemplos:

- `101` Pró-Labore - Diego
- `102` Pró-Labore - Daianne
- `401` Supermercado
- `501` Plano de Saúde
- `601` Combustível
- `901` Restaurantes
- `1001` Juros e Multas
- `1801` Aplicações - RF
- `1806` Resgate - RF
- `1501` Dividendos Recebidos
- `1904` Obra - FGR_Capri_1602 - SOL

As fórmulas do `Fluxo_Caixa` fazem algo equivalente a:

1. procurar lançamentos em todas as abas de origem;
2. filtrar por `COD`;
3. filtrar por ano e mês do pagamento;
4. somar valores;
5. consolidar os subtotais por grupo.

Em um aplicativo, essa lógica deve sair das fórmulas e virar uma camada de dados: lançamentos únicos em uma tabela central, com categorias e regras de classificação.

## 3. Principais dores que o app deve resolver

1. A informação está fragmentada em muitas abas.
2. O mesmo tipo de lançamento é repetido por banco/cartão/corretora.
3. A classificação depende de `COD` e fórmulas de busca.
4. É difícil auditar rapidamente de onde veio cada número do fluxo.
5. Ajustes em categorias exigem mexer na planilha e nas fórmulas.
6. Forecast, realizado, investimentos e contas pessoais convivem no mesmo arquivo, mas sem uma camada formal de regras.
7. Importação bancária e conciliação provavelmente exigem muito trabalho manual.

## 4. Proposta de aplicativo

Criar um aplicativo de gestão financeira pessoal/familiar com foco em fluxo de caixa consolidado, usando a planilha atual como base de migração.

Nome provisório: **Fluxo Pessoal**

### Objetivo

Centralizar todos os lançamentos financeiros, classificar automaticamente receitas/despesas/investimentos/financiamentos e gerar uma visão clara de fluxo de caixa mensal, realizado versus previsto.

## 5. Módulos principais

### 5.1 Dashboard executivo

Tela inicial com:

- saldo atual consolidado;
- resultado do mês;
- receitas do mês;
- despesas do mês;
- investimentos/aportes/resgates;
- financiamentos;
- variação versus mês anterior;
- realizado versus forecast;
- alertas de categorias fora do padrão.

Equivalente moderno ao `Cockpit_Exec`.

### 5.2 Lançamentos financeiros

Tabela central com filtros e edição rápida:

- data de competência;
- data prevista;
- data de pagamento;
- descrição;
- conta/instituição;
- cartão, banco ou corretora;
- titular;
- valor;
- tipo: receita, despesa, investimento, financiamento, transferência;
- categoria;
- subcategoria;
- código legado da planilha;
- status: previsto, pago, conciliado, ignorado;
- origem: importado, manual, recorrente;
- observações/anexos.

Essa tela substitui as abas `Itaú_B`, `Itaú_C`, `BTG_B`, `BTG_C`, etc.

### 5.3 Plano de categorias

Cadastro hierárquico inspirado no `Fluxo_Caixa`:

- grupo macro: Receita, Despesa, Financiamento, Investimento;
- grupo intermediário: Habitação, Alimentação, Saúde, Transporte, Lazer, etc.;
- categoria final: Supermercado, Restaurantes, Combustível, Dividendos, Aplicações RF;
- código legado;
- essencial/não essencial;
- fixo/variável/temporário;
- pessoa/responsável opcional;
- meta/orçamento mensal.

### 5.4 Fluxo de caixa

Visão mensal com:

- colunas por mês;
- linhas por grupo/categoria;
- drill-down para abrir os lançamentos que compõem cada valor;
- alternância entre realizado, previsto e realizado + previsto;
- saldo anterior, resultado do período e saldo final;
- comparação com anos anteriores.

Essa é a evolução direta da aba `Fluxo_Caixa`.

### 5.5 Importação e conciliação

Importação de:

- extratos bancários CSV/OFX;
- faturas de cartão;
- lançamentos de corretoras;
- importação inicial da própria planilha.

Recursos:

- detectar duplicados;
- sugerir categoria por descrição;
- manter regras automáticas;
- separar transferência entre contas para não distorcer receita/despesa;
- conciliar lançamentos previstos com realizados.

### 5.6 Recorrências e previsões

Cadastro de lançamentos recorrentes:

- salário/pró-labore;
- financiamentos;
- prestação da casa;
- academia;
- assinaturas;
- seguros;
- contas fixas;
- aportes mensais;
- despesas parceladas.

O app deve gerar forecast automaticamente e permitir ajustar mês a mês.

### 5.7 Cartões

Controle por cartão:

- fatura aberta/fechada;
- vencimento;
- competência da compra;
- data de pagamento;
- parcelas;
- estabelecimento;
- categoria;
- titular;
- impacto no fluxo por data de pagamento.

### 5.8 Investimentos

Módulo separado para:

- posição consolidada por ativo;
- quantidade;
- preço médio;
- valor aplicado;
- valor atualizado;
- corretora;
- moeda;
- dividendos/rendimentos;
- aportes e resgates;
- rentabilidade;
- integração futura com cotações.

Equivalente às abas `Investimentos`, `Rendimentos`, `Cotação`, `Dolar` e abas por ativo.

### 5.9 Balanço patrimonial

Visão de patrimônio:

- bancos/caixa;
- investimentos;
- imóveis;
- veículos;
- dívidas;
- patrimônio líquido;
- evolução mensal.

Equivalente à aba `Balanço`, com dados vindo automaticamente dos lançamentos e saldos.

## 6. Modelo de dados inicial

### Tabelas principais

#### `accounts`

Contas financeiras.

- id
- nome
- instituição
- tipo: banco, cartão, corretora, caixa, investimento
- moeda
- saldo_inicial
- ativa

#### `transactions`

Lançamentos.

- id
- account_id
- description
- holder
- amount
- currency
- category_id
- legacy_code
- competence_date
- due_date
- payment_date
- status
- source
- source_sheet
- external_id/hash
- notes

#### `categories`

Plano de categorias.

- id
- parent_id
- legacy_code
- name
- macro_type: receita, despesa, financiamento, investimento, transferência
- behavior: fixa, variável, temporária
- essentiality: essencial, não essencial, n/a
- active

#### `classification_rules`

Regras automáticas.

- id
- match_text
- account_id opcional
- amount_signal
- suggested_category_id
- confidence
- active

#### `recurring_transactions`

Previsões recorrentes.

- id
- description
- account_id
- category_id
- amount
- frequency
- start_date
- end_date
- due_day
- status

#### `investment_positions`

Posições de investimento.

- id
- asset
- broker_account_id
- quantity
- average_price
- currency
- strategy
- target_allocation

#### `asset_prices`

Cotações.

- id
- asset
- date
- price
- currency
- source

## 7. MVP recomendado

### MVP 1: Fluxo de caixa operacional

Entregar primeiro:

- importação da planilha atual;
- cadastro de contas;
- cadastro do plano de categorias;
- tela de lançamentos;
- fluxo de caixa mensal;
- dashboard executivo;
- regras simples de classificação;
- exportação para Excel/CSV.

Foco: substituir as abas transacionais e a aba `Fluxo_Caixa`.

### MVP 2: Previsões, recorrências e cartões

Adicionar:

- contas recorrentes;
- parcelamentos;
- faturas de cartão;
- previsto versus realizado;
- conciliação básica.

### MVP 3: Investimentos e patrimônio

Adicionar:

- carteira de investimentos;
- rendimentos/dividendos;
- cotações;
- imóveis/ativos;
- balanço patrimonial.

### MVP 4: Automação e inteligência

Adicionar:

- importação bancária recorrente;
- regras inteligentes por descrição;
- alerta de gasto fora do padrão;
- sugestão de orçamento;
- análise de tendência;
- previsão de saldo futuro.

## 8. Telas sugeridas

1. **Dashboard**
2. **Fluxo de Caixa**
3. **Lançamentos**
4. **Importar Extratos**
5. **Categorias**
6. **Contas**
7. **Cartões**
8. **Recorrências**
9. **Investimentos**
10. **Patrimônio**
11. **Relatórios**
12. **Configurações**

## 9. Regras importantes de negócio

- Transferência entre contas não deve contar como receita/despesa real.
- Cartão deve impactar o caixa na data de pagamento da fatura, mas manter a competência original da compra.
- Todo lançamento deve ter uma categoria final, mas pode nascer como "Não identificado".
- Alterar uma categoria deve recalcular relatórios retroativamente.
- O app deve manter o código legado da planilha para migração e auditoria.
- O fluxo de caixa deve permitir enxergar realizado, previsto e combinado.
- Investimentos devem ser separados do resultado operacional, como já acontece na planilha.
- Financiamentos devem ser separados de despesas operacionais.

## 10. Stack técnica sugerida

Para construir rápido e com boa base:

- Frontend: React + TypeScript
- Backend: Node.js/NestJS ou Next.js full-stack
- Banco: PostgreSQL
- ORM: Prisma
- Autenticação: login simples inicialmente
- Importação: CSV/XLSX/OFX
- Gráficos: Recharts ou Tremor
- Deploy: Vercel/Render/Supabase, dependendo do escopo

Se o objetivo for uso pessoal/local no começo, uma versão desktop/web local também funcionaria bem:

- Next.js
- SQLite
- Prisma
- importador direto da planilha

## 11. Próximo passo recomendado

Antes de programar, eu criaria um protótipo navegável com estas telas:

1. Dashboard
2. Lançamentos
3. Fluxo de Caixa
4. Categorias
5. Importação

Depois, faria a migração inicial da planilha para um banco estruturado, preservando:

- aba de origem;
- conta/instituição;
- código legado;
- descrição original;
- datas;
- valores;
- categoria/natureza atual.

Essa abordagem permite validar o app com seus próprios dados reais desde o começo.
