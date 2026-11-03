-- The daily-note push: one plan per person per day, decided once by the notify function.
-- Stored so "not the same time two days in a row" and "not the same moment as the other
-- person" are checked against what was actually planned.
create table if not exists public.daily_note_plan (
  person_id text not null references public.people(id) on delete cascade,
  day date not null,
  send boolean not null,          -- most days, not every day
  at_min smallint,                -- local minutes after midnight (null when send = false)
  at_utc timestamptz,             -- the same moment in absolute time
  created_at timestamptz not null default now(),
  primary key (person_id, day)
);
alter table public.daily_note_plan enable row level security;
revoke all on public.daily_note_plan from public, anon, authenticated;
