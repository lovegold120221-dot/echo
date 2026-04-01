-- Admin Agent Knowledge Base metadata + storage bucket

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
