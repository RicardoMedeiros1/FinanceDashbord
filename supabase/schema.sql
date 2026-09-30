-- Finn: esquema do Supabase. Cole no SQL Editor do seu projeto e execute uma vez.

-- Todos os dados do app (transações, assinaturas, metas...) ficam numa tabela só, um registro por linha.
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, collection, id)
);

create index if not exists records_user_synced_idx on public.records (user_id, synced_at);

-- O relógio do servidor marca cada gravação (usado para buscar só o que mudou).
create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at = clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_synced_at();

-- Segurança: cada usuário só enxerga e altera as próprias linhas.
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;
create policy "records_select_own" on public.records for select to authenticated using (auth.uid() = user_id);
create policy "records_insert_own" on public.records for insert to authenticated with check (auth.uid() = user_id);
create policy "records_update_own" on public.records for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records_delete_own" on public.records for delete to authenticated using (auth.uid() = user_id);

-- Atualização em tempo real entre aparelhos.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null;
end $$;

-- Comprovantes: pasta privada; cada usuário só acessa a subpasta com o próprio id.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_select_own" on storage.objects;
drop policy if exists "receipts_insert_own" on storage.objects;
drop policy if exists "receipts_update_own" on storage.objects;
drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- Excluir a própria conta (o app chama esta função em "Dados → Excluir minha conta").
-- Apaga o usuário; as linhas de `records` saem junto (on delete cascade). Os arquivos de comprovantes
-- são removidos pelo próprio app, pela API de armazenamento, antes desta chamada.
create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
