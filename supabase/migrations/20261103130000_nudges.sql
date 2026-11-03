-- Nudges: a small push to the other person. Not a chat: no history is shown, and rows are
-- deleted by the daily cleanup job. 3 per sender per (sender's local) day.
create table if not exists public.nudges (
  id bigint generated always as identity primary key,
  from_id text not null references public.people(id) on delete cascade,
  to_id text not null references public.people(id) on delete cascade,
  day date not null, -- the sender's local day, for the daily limit
  body text not null check (char_length(body) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists nudges_to_idx on public.nudges (to_id, created_at desc);
create index if not exists nudges_from_day_idx on public.nudges (from_id, day);
alter table public.nudges enable row level security;
revoke all on public.nudges from public, anon, authenticated;
revoke all on sequence public.nudges_id_seq from public, anon, authenticated;

-- Insert a nudge only if the sender has sends left today. Returns the new count (1..limit),
-- or -1 when the limit is reached. The advisory lock makes two quick taps safe.
create or replace function public.send_nudge(p_from text, p_to text, p_day date, p_body text, p_limit int)
returns int
language plpgsql
set search_path = public
as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtext('nudge:' || p_from || ':' || p_day::text));
  select count(*) into n from public.nudges where from_id = p_from and day = p_day;
  if n >= p_limit then
    return -1;
  end if;
  insert into public.nudges (from_id, to_id, day, body) values (p_from, p_to, p_day, p_body);
  return n + 1;
end;
$$;
revoke all on function public.send_nudge(text, text, date, text, int) from public, anon, authenticated;
grant execute on function public.send_nudge(text, text, date, text, int) to service_role;

-- Nightly cleanup (pg_cron, 04:17 UTC): nudges expire; old note plans are pruned.
select cron.schedule('75hard-cleanup', '17 4 * * *', $cron$
  delete from net._http_response where created < now() - interval '2 days';
  delete from public.push_log where day < current_date - 30;
  delete from public.nudges where created_at < now() - interval '30 hours';
  delete from public.daily_note_plan where day < current_date - 30;
$cron$);
