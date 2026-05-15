# Publicacao com Netlify + Supabase

Este app deve usar uma base separada do projeto AHAV. A estrutura abaixo segue o mesmo modelo de acesso: o navegador fala com uma funcao do Netlify, e a funcao grava no Supabase usando `service_role`.

## 1. Criar tabela no Supabase

No Supabase, abra o SQL Editor e execute:

```sql
create table if not exists public.financeiro_diego_app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.financeiro_diego_app_state enable row level security;

drop policy if exists "financeiro_diego_app_state_no_public_access" on public.financeiro_diego_app_state;
create policy "financeiro_diego_app_state_no_public_access"
on public.financeiro_diego_app_state
for all
using (false)
with check (false);

create table if not exists public.financeiro_diego_app_users (
  id bigserial primary key,
  username text not null unique,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financeiro_diego_app_users enable row level security;

drop policy if exists "financeiro_diego_app_users_no_public_access" on public.financeiro_diego_app_users;
create policy "financeiro_diego_app_users_no_public_access"
on public.financeiro_diego_app_users
for all
using (false)
with check (false);
```

O mesmo conteudo esta em `supabase/schema.sql`. O arquivo `supabase/setup_financeiro_users.sql` contem apenas a parte dos usuarios.

## 2. Variaveis no Netlify

Em `Site configuration > Environment variables`, cadastrar:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_STATE_TABLE=financeiro_diego_app_state
APP_STATE_ID=financeiro-diego-prod
```

Use a `service_role key` apenas no Netlify. Ela nao fica exposta no navegador.

## 3. Build no Netlify

Configuracoes:

```text
Publish directory: app
Functions directory: netlify/functions
Build command: vazio
```

O arquivo `netlify.toml` ja contem essas definicoes.

## 4. Como a persistencia funciona

- O app continua carregando a base inicial de `app/finance-data.json`.
- As alteracoes do usuario sao gravadas em `financeiro_diego_app_state.data` no Supabase.
- Os acessos ficam em `financeiro_diego_app_users`, separado do AHAV.
- A funcao `netlify/functions/state.js` le e salva o estado.
- Se o app for aberto por `file://`, usa `localStorage` como fallback.
- Se o app estiver no Netlify, usa Supabase automaticamente.

## 5. Teste local com Netlify CLI

```bash
npm install
npm run dev
```

Depois abrir o endereco local informado pelo Netlify.
