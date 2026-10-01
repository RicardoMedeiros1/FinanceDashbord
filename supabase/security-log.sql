-- Finn: registro de tentativas de acesso (usado pela função "access" e por Dados → Segurança).
-- Rode no SQL Editor do Supabase. É seguro rodar de novo.

create table if not exists public.login_attempts (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  email  text        not null,
  ok     boolean     not null,                -- true = entrou
  locked boolean     not null default false,  -- true = nem chegou a conferir a senha (bloqueio por excesso de erros)
  ip     text,
  ua     text                                  -- navegador/aparelho
);

create index if not exists login_attempts_email_at_idx on public.login_attempts (email, at desc);
create index if not exists login_attempts_ip_at_idx on public.login_attempts (ip, at desc);

alter table public.login_attempts enable row level security;

-- Quem grava é só a função (chave de serviço); o usuário logado só LÊ as tentativas do próprio e-mail.
revoke all on public.login_attempts from anon, authenticated;
grant select on public.login_attempts to authenticated;

drop policy if exists "login_attempts_select_own" on public.login_attempts;
create policy "login_attempts_select_own" on public.login_attempts
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
