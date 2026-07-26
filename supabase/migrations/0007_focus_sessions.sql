-- ============================================================================
-- Finance & Habit Tracker — 0007 Focus sessions (Pomodoro)
-- Records each completed or aborted focus/break session, optionally linked to a
-- task or habit. Powers the daily focus summary.
-- ============================================================================

create type focus_session_type as enum ('focus', 'short_break', 'long_break');

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_type focus_session_type not null default 'focus',
  task_id uuid references public.tasks (id) on delete set null,
  habit_id uuid references public.habits (id) on delete set null,
  planned_minutes int not null default 25,
  actual_seconds int not null default 0,
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index focus_sessions_user_idx
  on public.focus_sessions (user_id, started_at desc);

alter table public.focus_sessions enable row level security;
create policy "focus_sessions_owner_all" on public.focus_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
