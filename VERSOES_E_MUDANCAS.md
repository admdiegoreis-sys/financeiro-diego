# Versoes e mudancas

## v0.1.0 - Base publicada

- App financeiro criado a partir da planilha consolidada.
- Dashboard operacional com filtros por ano e meses.
- Fluxo de caixa com hierarquia, totalizadores e saldos.
- Cadastros de categorias, contas e investimentos.
- Lancamentos e cartao de credito em abas separadas.
- Importacao de lancamentos, investimentos e proventos.
- Dashboard de investimentos e proventos.
- Netlify configurado com `netlify.toml`.
- Supabase preparado com tabelas separadas do AHAV:
  - `financeiro_diego_app_state`
  - `financeiro_diego_app_users`
- Function de persistencia criada em `netlify/functions/state.js`.

## Pendencia critica

O deploy atual do Netlify foi feito por Drop e esta sem a Function `/api/state`. Para salvar mudancas no Supabase, publicar por GitHub, Netlify CLI ou API.
