-- 0004_video_ops.sql · Estúdio de Vídeos: um snapshot de metadados por usuário.
-- Independente das migrations Amazon antigas; pode ser aplicada sozinha.

create table if not exists public.video_ops_states (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  schema_version integer not null check (schema_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.video_ops_states enable row level security;

revoke all on table public.video_ops_states from anon;
grant select, insert, update on table public.video_ops_states to authenticated;

drop policy if exists "video_ops_select_own" on public.video_ops_states;
create policy "video_ops_select_own" on public.video_ops_states
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "video_ops_insert_own" on public.video_ops_states;
create policy "video_ops_insert_own" on public.video_ops_states
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "video_ops_update_own" on public.video_ops_states;
create policy "video_ops_update_own" on public.video_ops_states
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
