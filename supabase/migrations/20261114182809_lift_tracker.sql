-- NOT APPLIED. Carlos applies this before deploying api, then publishing the PWA.
-- No seed: the supplied split is still "PASTE SPLIT HERE".
begin;
create table public.lift_plans (
  person_id text primary key references public.people(id) on delete cascade,
  units text not null default 'lb' check (units in ('lb','kg')),
  default_rest_seconds integer not null default 120 check (default_rest_seconds between 0 and 3600),
  plates jsonb not null default '[45,35,25,10,5,2.5]' check (jsonb_typeof(plates) = 'array'),
  bar_weight numeric not null default 45 check (bar_weight between 0 and 500),
  version integer not null default 0
);
create table public.lift_days (
  id uuid primary key, person_id text not null references public.people(id) on delete cascade,
  name text not null check (length(name) between 1 and 100), position integer not null check (position >= 0),
  archived boolean not null default false
);
create index lift_days_person on public.lift_days(person_id, position);
create table public.lift_exercises (
  id uuid primary key, day_id uuid not null references public.lift_days(id) on delete cascade,
  name text not null check (length(name) between 1 and 120), position integer not null check (position >= 0),
  sets integer not null check (sets between 1 and 20), rep_min integer not null check (rep_min between 1 and 100),
  rep_max integer not null check (rep_max between rep_min and 100), target_rir numeric not null check (target_rir between 0 and 10),
  equipment text not null check (equipment in ('barbell','dumbbell','machine','cable','bodyweight')),
  increment numeric not null check (increment > 0 and increment <= 500),
  rest_seconds integer check (rest_seconds between 0 and 3600), notes text not null default '' check (length(notes) <= 1000),
  archived boolean not null default false
);
create index lift_exercises_day on public.lift_exercises(day_id, position);
create table public.lift_sessions (
  -- Client UUID makes a lost-response retry return the same session, never a second copy.
  id uuid primary key, person_id text not null references public.people(id) on delete cascade,
  day date not null, lift_day_id uuid references public.lift_days(id) on delete set null,
  day_name text not null, units text not null check (units in ('lb','kg')),
  started_at timestamptz not null, finished_at timestamptz not null check (finished_at >= started_at),
  notes text not null default '' check (length(notes) <= 2000)
);
create index lift_sessions_person_day on public.lift_sessions(person_id, day);
create index lift_sessions_person_finished on public.lift_sessions(person_id, finished_at desc, id desc);
create index lift_sessions_lift_day on public.lift_sessions(lift_day_id);
create table public.lift_sets (
  session_id uuid not null references public.lift_sessions(id) on delete cascade,
  exercise_id uuid references public.lift_exercises(id) on delete set null,
  exercise_name text not null, set_no integer not null check (set_no between 1 and 30),
  is_warmup boolean not null default false, weight numeric not null check (weight between 0 and 5000),
  reps integer not null check (reps between 1 and 1000), rir numeric not null check (rir between 0 and 10),
  exercise_notes text not null default '' check (length(exercise_notes) <= 1000),
  unique (session_id, exercise_id, is_warmup, set_no)
);
create index lift_sets_exercise on public.lift_sets(exercise_id, session_id);
alter table public.lift_plans enable row level security;
alter table public.lift_days enable row level security;
alter table public.lift_exercises enable row level security;
alter table public.lift_sessions enable row level security;
alter table public.lift_sets enable row level security;
revoke all on public.lift_plans, public.lift_days, public.lift_exercises, public.lift_sessions, public.lift_sets from public, anon, authenticated;
grant all on public.lift_plans, public.lift_days, public.lift_exercises, public.lift_sessions, public.lift_sets to service_role;

-- One transaction for the complete plan. Removed items are archived, preserving history
-- and accepting an offline draft that started before another device edited the plan.
create function public.save_lift_plan(p_person text, p_payload jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare d jsonb; e jsonb; v integer;
begin
  perform 1 from public.people where id = p_person for update;
  if not found then raise exception 'lift_not_owned'; end if;
  insert into public.lift_plans(person_id) values(p_person) on conflict do nothing;
  select version into v from public.lift_plans where person_id = p_person;
  if v <> (p_payload->>'version')::integer then raise exception 'lift_conflict'; end if;
  update public.lift_plans set units = p_payload->>'units',
    default_rest_seconds = (p_payload->>'default_rest_seconds')::integer,
    plates = p_payload->'plates', bar_weight = (p_payload->>'bar_weight')::numeric, version = v + 1
    where person_id = p_person;
  update public.lift_exercises set archived = true where day_id in (select id from public.lift_days where person_id = p_person);
  update public.lift_days set archived = true where person_id = p_person;
  for d in select value from jsonb_array_elements(p_payload->'days') loop
    if exists(select 1 from public.lift_days where id = (d->>'id')::uuid and person_id <> p_person) then raise exception 'lift_not_owned'; end if;
    insert into public.lift_days(id, person_id, name, position) values((d->>'id')::uuid, p_person, d->>'name', (d->>'position')::integer)
      on conflict(id) do update set name = excluded.name, position = excluded.position, archived = false
      where public.lift_days.person_id = p_person;
    if not found then raise exception 'lift_not_owned'; end if;
    for e in select value from jsonb_array_elements(d->'exercises') loop
      if exists(select 1 from public.lift_exercises x join public.lift_days y on y.id = x.day_id
        where x.id = (e->>'id')::uuid and y.person_id <> p_person) then raise exception 'lift_not_owned'; end if;
      insert into public.lift_exercises(id, day_id, name, position, sets, rep_min, rep_max, target_rir, equipment, increment, rest_seconds, notes)
      values((e->>'id')::uuid, (d->>'id')::uuid, e->>'name', (e->>'position')::integer, (e->>'sets')::integer,
        (e->>'rep_min')::integer, (e->>'rep_max')::integer, (e->>'target_rir')::numeric, e->>'equipment',
        (e->>'increment')::numeric, (e->>'rest_seconds')::integer, e->>'notes')
      on conflict(id) do update set day_id = excluded.day_id, name = excluded.name, position = excluded.position,
        sets = excluded.sets, rep_min = excluded.rep_min, rep_max = excluded.rep_max, target_rir = excluded.target_rir,
        equipment = excluded.equipment, increment = excluded.increment, rest_seconds = excluded.rest_seconds, notes = excluded.notes, archived = false
        where exists(select 1 from public.lift_days owned where owned.id = public.lift_exercises.day_id and owned.person_id = p_person);
      if not found then raise exception 'lift_not_owned'; end if;
    end loop;
  end loop;
end; $$;

create function public.save_lift_session(p_person text, p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare sid uuid := (p_payload->>'id')::uuid; did uuid := (p_payload->>'lift_day_id')::uuid; s jsonb; owner_id text;
begin
  perform 1 from public.people where id = p_person for update;
  if not found then raise exception 'lift_not_owned'; end if;
  select person_id into owner_id from public.lift_sessions where id = sid;
  if found then
    if owner_id <> p_person then raise exception 'lift_not_owned'; end if;
    return jsonb_build_object('id', sid, 'saved', true);
  end if;
  if not exists(select 1 from public.lift_days where id = did and person_id = p_person) then raise exception 'lift_not_owned'; end if;
  insert into public.lift_sessions(id, person_id, day, lift_day_id, day_name, units, started_at, finished_at, notes)
    values(sid, p_person, (p_payload->>'day')::date, did, p_payload->>'day_name', p_payload->>'units',
      (p_payload->>'started_at')::timestamptz, (p_payload->>'finished_at')::timestamptz, p_payload->>'notes');
  for s in select value from jsonb_array_elements(p_payload->'sets') loop
    if not exists(select 1 from public.lift_exercises e join public.lift_days d on d.id = e.day_id
      where e.id = (s->>'exercise_id')::uuid and d.person_id = p_person) then raise exception 'lift_not_owned'; end if;
    insert into public.lift_sets(session_id, exercise_id, exercise_name, set_no, is_warmup, weight, reps, rir, exercise_notes)
      values(sid, (s->>'exercise_id')::uuid, s->>'exercise_name', (s->>'set_no')::integer, (s->>'is_warmup')::boolean,
        (s->>'weight')::numeric, (s->>'reps')::integer, (s->>'rir')::numeric, s->>'exercise_notes');
  end loop;
  return jsonb_build_object('id', sid, 'saved', true);
end; $$;

create function public.get_lift_state(p_person text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'person_id', p_person,
    'plan', coalesce((select to_jsonb(p) - 'person_id' from public.lift_plans p where p.person_id = p_person),
      '{"units":"lb","default_rest_seconds":120,"plates":[45,35,25,10,5,2.5],"bar_weight":45,"version":0}'::jsonb),
    'days', coalesce((select jsonb_agg(to_jsonb(d) - 'person_id' - 'archived' || jsonb_build_object('exercises',
      coalesce((select jsonb_agg(to_jsonb(e) - 'archived' order by e.position) from public.lift_exercises e where e.day_id = d.id and not e.archived), '[]'::jsonb)) order by d.position)
      from public.lift_days d where d.person_id = p_person and not d.archived), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'archived', e.archived or d.archived) order by e.name)
      from public.lift_exercises e join public.lift_days d on d.id = e.day_id where d.person_id = p_person), '[]'::jsonb),
    'last_day_id', (select lift_day_id from public.lift_sessions where person_id = p_person order by finished_at desc, id desc limit 1),
    'recent', coalesce((select jsonb_object_agg(e.id::text,
      (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'units', s.units, 'sets',
        (select jsonb_agg(to_jsonb(ls) order by ls.is_warmup desc, ls.set_no) from public.lift_sets ls where ls.session_id = s.id and ls.exercise_id = e.id)) order by s.finished_at desc, s.id desc), '[]'::jsonb)
        from (select ss.id, ss.units, ss.finished_at from public.lift_sessions ss
          where ss.person_id = p_person and exists(select 1 from public.lift_sets x where x.session_id = ss.id and x.exercise_id = e.id and not x.is_warmup)
          order by ss.finished_at desc, ss.id desc limit 2) s))
      from public.lift_exercises e join public.lift_days d on d.id = e.day_id
      where d.person_id = p_person and not d.archived and not e.archived), '{}'::jsonb)
  );
$$;

create function public.get_lift_history(p_person text, p_exercise uuid, p_before timestamptz, p_before_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s) - 'person_id' || jsonb_build_object('sets',
    (select coalesce(jsonb_agg(to_jsonb(x) order by x.exercise_name, x.is_warmup desc, x.set_no), '[]'::jsonb)
     from public.lift_sets x where x.session_id = s.id and (p_exercise is null or x.exercise_id = p_exercise)))
    order by s.finished_at desc, s.id desc), '[]'::jsonb)
  from (select ss.* from public.lift_sessions ss where ss.person_id = p_person
    and (p_before is null or (ss.finished_at, ss.id) < (p_before, p_before_id))
    and (p_exercise is null or exists(select 1 from public.lift_sets x where x.session_id = ss.id and x.exercise_id = p_exercise))
    order by ss.finished_at desc, ss.id desc limit 21) s;
$$;

revoke all on function public.save_lift_plan(text,jsonb) from public, anon, authenticated;
revoke all on function public.save_lift_session(text,jsonb) from public, anon, authenticated;
revoke all on function public.get_lift_state(text) from public, anon, authenticated;
revoke all on function public.get_lift_history(text,uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.save_lift_plan(text,jsonb), public.save_lift_session(text,jsonb),
  public.get_lift_state(text), public.get_lift_history(text,uuid,timestamptz,uuid) to service_role;
commit;
