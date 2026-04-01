-- User agents: store created agents with phone numbers and metadata.
-- Run this in Supabase SQL Editor or via Supabase CLI.

create table if not exists public.user_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_id text not null,
  name text not null,
  phone_number_id text,
  phone_number text,
  voice_provider text,
  voice_id text,
  language text default 'multilingual',
  first_message text,
  system_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_agents_user_id
  on public.user_agents (user_id, created_at desc);
create index if not exists idx_user_agents_assistant_id
  on public.user_agents (assistant_id);

alter table public.user_agents enable row level security;

drop policy if exists "Users can select own user_agents" on public.user_agents;
create policy "Users can select own user_agents"
  on public.user_agents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own user_agents" on public.user_agents;
create policy "Users can insert own user_agents"
  on public.user_agents for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own user_agents" on public.user_agents;
create policy "Users can update own user_agents"
  on public.user_agents for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own user_agents" on public.user_agents;
create policy "Users can delete own user_agents"
  on public.user_agents for delete
  using (auth.uid() = user_id);
