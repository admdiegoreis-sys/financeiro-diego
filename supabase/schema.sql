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

comment on table public.financeiro_diego_app_state is 'Estado persistente do app Financeiro Diego. Acesso feito via Netlify Function com service role.';

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

insert into public.financeiro_diego_app_users (username, full_name, role, active, must_change_password, password_hash)
values (
  'admin',
  'Administrador',
  'admin',
  true,
  false,
  '2ccb642daba2e0364c839d5667a1ae4d2d61e5b66e697ea53c99127aa3129485'
)
on conflict (username) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  active = excluded.active,
  must_change_password = false,
  updated_at = now();

insert into public.financeiro_diego_app_users (username, full_name, role, active, must_change_password, password_hash)
values (
  'diego',
  'Diego Reis',
  'admin',
  true,
  true,
  '99a1d6ae3aec060889049e878503439a36c6a04f2f336b268377fe8b6eb29336'
)
on conflict (username) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();

alter table public.financeiro_diego_app_users enable row level security;

drop policy if exists "financeiro_diego_app_users_no_public_access" on public.financeiro_diego_app_users;
create policy "financeiro_diego_app_users_no_public_access"
on public.financeiro_diego_app_users
for all
using (false)
with check (false);

comment on table public.financeiro_diego_app_users is 'Usuarios separados do app Financeiro Diego. Acesso administrativo via Supabase/Netlify Function.';
