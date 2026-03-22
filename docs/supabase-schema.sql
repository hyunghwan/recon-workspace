create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default Workspace',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  merchant text not null,
  memo text not null,
  amount numeric not null,
  source text not null,
  status text not null,
  matched_docs integer not null default 0,
  note text not null default '',
  activity jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.transactions enable row level security;

create policy "Users can read own workspaces"
on public.workspaces for select
using (auth.uid() = owner_user_id);

create policy "Users can insert own workspaces"
on public.workspaces for insert
with check (auth.uid() = owner_user_id);

create policy "Users can update own workspaces"
on public.workspaces for update
using (auth.uid() = owner_user_id);

create policy "Users can read own transactions"
on public.transactions for select
using (auth.uid() = user_id);

create policy "Users can insert own transactions"
on public.transactions for insert
with check (auth.uid() = user_id);

create policy "Users can update own transactions"
on public.transactions for update
using (auth.uid() = user_id);

create policy "Users can delete own transactions"
on public.transactions for delete
using (auth.uid() = user_id);
