-- =============================================================================
-- SUPABASE FINAL SETUP — Echo (echo.eburon.ai)
-- Paste this entire file into Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS / DROP IF EXISTS)
-- =============================================================================

-- #############################################################################
-- 1. TTS HISTORY — per-user storage for generated TTS (text + audio path)
-- #############################################################################

create table if not exists public.tts_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  voice_id text not null,
  voice_name text not null,
  audio_path text not null,
  created_at timestamptz not null default now()
);

alter table public.tts_history enable row level security;

drop policy if exists "Users can select own tts_history" on public.tts_history;
create policy "Users can select own tts_history"
  on public.tts_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own tts_history" on public.tts_history;
create policy "Users can insert own tts_history"
  on public.tts_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tts_history" on public.tts_history;
create policy "Users can delete own tts_history"
  on public.tts_history for delete
  using (auth.uid() = user_id);

-- Storage bucket for TTS audio files (private; paths like user_id/filename.mp3)
insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own tts-audio" on storage.objects;
create policy "Users can read own tts-audio"
  on storage.objects for select
  using (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can insert own tts-audio" on storage.objects;
create policy "Users can insert own tts-audio"
  on storage.objects for insert
  with check (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own tts-audio" on storage.objects;
create policy "Users can delete own tts-audio"
  on storage.objects for delete
  using (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- #############################################################################
-- 2. USER ASSISTANTS — one VAPI assistant per user (unique reference)
-- #############################################################################

create table if not exists public.user_assistants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assistant_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_assistants enable row level security;

drop policy if exists "Users can select own user_assistants" on public.user_assistants;
create policy "Users can select own user_assistants"
  on public.user_assistants for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own user_assistants" on public.user_assistants;
create policy "Users can insert own user_assistants"
  on public.user_assistants for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own user_assistants" on public.user_assistants;
create policy "Users can update own user_assistants"
  on public.user_assistants for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own user_assistants" on public.user_assistants;
create policy "Users can delete own user_assistants"
  on public.user_assistants for delete
  using (auth.uid() = user_id);

-- #############################################################################
-- 3. API KEYS + USAGE TRACKING
-- #############################################################################

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default key',
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_api_keys_user_created
  on public.api_keys (user_id, created_at desc);
create index if not exists idx_api_keys_key_hash
  on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

drop policy if exists "Users can select own api_keys" on public.api_keys;
create policy "Users can select own api_keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own api_keys" on public.api_keys;
create policy "Users can insert own api_keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own api_keys" on public.api_keys;
create policy "Users can update own api_keys"
  on public.api_keys for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own api_keys" on public.api_keys;
create policy "Users can delete own api_keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);

create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  endpoint text not null,
  method text not null,
  status_code integer not null,
  latency_ms integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_usage_user_created
  on public.api_usage (user_id, created_at desc);
create index if not exists idx_api_usage_endpoint_created
  on public.api_usage (endpoint, created_at desc);

alter table public.api_usage enable row level security;

drop policy if exists "Users can select own api_usage" on public.api_usage;
create policy "Users can select own api_usage"
  on public.api_usage for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own api_usage" on public.api_usage;
create policy "Users can insert own api_usage"
  on public.api_usage for insert
  with check (auth.uid() = user_id);

-- #############################################################################
-- 4. USER AGENTS — created agents with phone numbers & metadata
-- #############################################################################

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

-- #############################################################################
-- 5. ADMIN AGENT — per-user assistant settings snapshots
-- #############################################################################

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

-- #############################################################################
-- 6. ADMIN AGENT KNOWLEDGE — file metadata + storage bucket
-- #############################################################################

create table if not exists public.admin_agent_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_id text,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes integer not null,
  vapi_file_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_agent_knowledge_user_id
  on public.admin_agent_knowledge (user_id, created_at desc);
create index if not exists idx_admin_agent_knowledge_assistant_id
  on public.admin_agent_knowledge (assistant_id);

alter table public.admin_agent_knowledge enable row level security;

drop policy if exists "Users can select own admin_agent_knowledge" on public.admin_agent_knowledge;
create policy "Users can select own admin_agent_knowledge"
  on public.admin_agent_knowledge for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own admin_agent_knowledge" on public.admin_agent_knowledge;
create policy "Users can insert own admin_agent_knowledge"
  on public.admin_agent_knowledge for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own admin_agent_knowledge" on public.admin_agent_knowledge;
create policy "Users can update own admin_agent_knowledge"
  on public.admin_agent_knowledge for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own admin_agent_knowledge" on public.admin_agent_knowledge;
create policy "Users can delete own admin_agent_knowledge"
  on public.admin_agent_knowledge for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('admin-agent-kb', 'admin-agent-kb', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own admin-agent-kb" on storage.objects;
create policy "Users can read own admin-agent-kb"
  on storage.objects for select
  using (bucket_id = 'admin-agent-kb' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can insert own admin-agent-kb" on storage.objects;
create policy "Users can insert own admin-agent-kb"
  on storage.objects for insert
  with check (bucket_id = 'admin-agent-kb' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own admin-agent-kb" on storage.objects;
create policy "Users can delete own admin-agent-kb"
  on storage.objects for delete
  using (bucket_id = 'admin-agent-kb' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- DONE — all 8 tables + 2 storage buckets + RLS + indexes created
-- =============================================================================
