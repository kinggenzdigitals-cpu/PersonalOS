-- Launch readiness foundations: synced focus settings, richer habit scheduling,
-- task organization, and calendar sync metadata.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  focus_settings jsonb not null default '{}'::jsonb,
  app_lock_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_owner_all" on public.user_preferences;
create policy "user_preferences_owner_all" on public.user_preferences
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.habits
  add column if not exists target_count_per_day int not null default 1 check (target_count_per_day between 1 and 20),
  add column if not exists target_count_per_week int check (target_count_per_week is null or target_count_per_week between 1 and 140),
  add column if not exists paused_from date,
  add column if not exists paused_until date;

alter table public.habit_logs
  add column if not exists completion_count int not null default 0 check (completion_count >= 0);

create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

drop trigger if exists task_projects_set_updated_at on public.task_projects;
create trigger task_projects_set_updated_at
  before update on public.task_projects
  for each row execute function public.set_updated_at();

alter table public.task_projects enable row level security;

drop policy if exists "task_projects_owner_all" on public.task_projects;
create policy "task_projects_owner_all" on public.task_projects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.tasks
  add column if not exists project_id uuid references public.task_projects (id) on delete set null,
  add column if not exists parent_task_id uuid references public.tasks (id) on delete cascade,
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_anchor date,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists assigned_to_email text,
  add column if not exists dependency_task_ids uuid[] not null default '{}'::uuid[];

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists task_comments_set_updated_at on public.task_comments;
create trigger task_comments_set_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();

alter table public.task_comments enable row level security;

drop policy if exists "task_comments_owner_all" on public.task_comments;
create policy "task_comments_owner_all" on public.task_comments
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.calendar_events
  add column if not exists source_provider text,
  add column if not exists external_id text,
  add column if not exists sync_status text,
  add column if not exists last_synced_at timestamptz;

create index if not exists tasks_user_project_idx on public.tasks (user_id, project_id);
create index if not exists tasks_user_tags_idx on public.tasks using gin (tags);
create index if not exists calendar_events_user_provider_idx on public.calendar_events (user_id, source_provider);
