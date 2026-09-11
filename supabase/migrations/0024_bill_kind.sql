-- Recurring schedules can represent money coming in or going out.
alter table public.bills
  add column if not exists kind category_kind not null default 'expense';

create index if not exists bills_user_kind_due_idx
  on public.bills (user_id, kind, next_due_date);
