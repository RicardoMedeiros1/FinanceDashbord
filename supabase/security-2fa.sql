-- Finn: exigir a verificação em duas etapas (aal2) para ler e gravar dados.
--
-- QUANDO RODAR: só DEPOIS de ativar o 2FA no app (Dados → Segurança) em todos os usuários.
-- Enquanto isto não rodar, a verificação é exigida pelo app, mas o banco ainda aceitaria uma sessão sem ela.
-- Depois de rodar, uma sessão sem o código do aplicativo autenticador não lê nem grava nada, nem por fora do app.
--
-- São políticas "restritivas": valem em conjunto com as de `schema.sql` (todas precisam passar).
-- Para desfazer, apague as políticas no final deste arquivo.

drop policy if exists "records_require_aal2" on public.records;
create policy "records_require_aal2" on public.records
  as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- Comprovantes (só a pasta "receipts"; outras pastas, se existirem, não são afetadas).
drop policy if exists "receipts_require_aal2" on storage.objects;
create policy "receipts_require_aal2" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'receipts' or (select auth.jwt() ->> 'aal') = 'aal2')
  with check (bucket_id <> 'receipts' or (select auth.jwt() ->> 'aal') = 'aal2');

-- Excluir a própria conta também exige o código.
create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'two-factor verification required';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- PARA DESFAZER (se precisar voltar ao comportamento anterior):
--   drop policy if exists "records_require_aal2" on public.records;
--   drop policy if exists "receipts_require_aal2" on storage.objects;
--   e rode de novo o final do schema.sql (função delete_my_account).
