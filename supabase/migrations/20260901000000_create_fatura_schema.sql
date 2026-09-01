-- Lançamentos: uma linha por COMPRA (as parcelas são derivadas no cliente).
create table public.entries (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount integer not null check (amount >= 0),
  date date not null,
  "time" text not null default '',
  category text not null default '',
  is_credit boolean not null default false,
  installments integer not null default 1 check (installments between 1 and 72),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index entries_user_date_idx on public.entries (user_id, date desc);

-- Ajustes do cartão: uma linha por usuário.
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  card_name text not null default 'Meu cartão',
  closing_day smallint not null default 28 check (closing_day between 1 and 31),
  due_day smallint not null default 5 check (due_day between 1 and 31),
  categories jsonb not null default '[]'::jsonb,
  cats_version integer not null default 0,
  limit_total integer not null default 0,
  limit_used_at_sync integer not null default 0,
  limit_sync_at bigint not null default 0,
  limit_synced_at text not null default '',
  limit_round_cents boolean not null default true,
  limit_version integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;
alter table public.settings enable row level security;

-- Cada usuário só enxerga e altera as próprias linhas.
create policy entries_select_own on public.entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy entries_insert_own on public.entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy entries_update_own on public.entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy entries_delete_own on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));

create policy settings_select_own on public.settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy settings_insert_own on public.settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy settings_update_own on public.settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
