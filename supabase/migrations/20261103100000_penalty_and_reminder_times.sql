-- Shared rule: how many days a missed day adds to the finish (1 = classic, 2 = double).
alter table public.app_settings
  add column if not exists miss_penalty smallint not null default 1 check (miss_penalty in (1, 2));

-- Per-person reminder times (local "HH:MM" in that person's tz) and on/off switches.
alter table public.people
  add column if not exists reminders jsonb not null default
    '{"w1":{"at":"06:45","on":true},"w2":{"at":"15:30","on":true},"evening":{"at":"20:30","on":true}}'::jsonb;
