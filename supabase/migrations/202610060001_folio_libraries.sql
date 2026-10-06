begin;

create table public.folio_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) < 200000
  ),
  updated_at timestamptz not null default now()
);

alter table public.folio_libraries enable row level security;

create policy "Own folio library select" on public.folio_libraries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own folio library insert" on public.folio_libraries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own folio library update" on public.folio_libraries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.folio_libraries from anon;
grant select, insert, update on public.folio_libraries to authenticated;

commit;
