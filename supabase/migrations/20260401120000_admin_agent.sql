-- Admin agent metadata table for /admin page.
-- Stores per-user assistant settings snapshots managed by the admin UI.

create table if not exists public."admin-agent" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_id text not null,
  name text not null,
  phone_number_id text,
  voice_provider text,
  voice_id text,
  language text default 'multilingual',
  first_message text,
  system_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_agent_user_assistant_unique unique (user_id, assistant_id)
);

create index if not exists idx_admin_agent_user_id
  on public."admin-agent" (user_id, updated_at desc);

create index if not exists idx_admin_agent_assistant_id
  on public."admin-agent" (assistant_id);

alter table public."admin-agent" enable row level security;

drop policy if exists "Users can select own admin-agent" on public."admin-agent";
create policy "Users can select own admin-agent"
  on public."admin-agent" for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own admin-agent" on public."admin-agent";
create policy "Users can insert own admin-agent"
  on public."admin-agent" for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own admin-agent" on public."admin-agent";
create policy "Users can update own admin-agent"
  on public."admin-agent" for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own admin-agent" on public."admin-agent";
create policy "Users can delete own admin-agent"
  on public."admin-agent" for delete
  using (auth.uid() = user_id);
