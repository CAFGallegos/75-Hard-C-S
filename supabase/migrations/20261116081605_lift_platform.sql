-- Applied to personal 75-hard as version 20261116081605 on 2026-11-16.
-- Requires lift_tracker; locally tested proposal copied into a CLI-generated migration.
-- No existing challenge tables, policies or notification functions are changed.
begin;
alter table public.lift_plans add column details jsonb not null default '{}' check (jsonb_typeof(details) = 'object');
alter table public.lift_exercises add column details jsonb not null default '{}' check (jsonb_typeof(details) = 'object');
alter table public.lift_sessions add column details jsonb not null default '{}' check (jsonb_typeof(details) = 'object');
alter table public.lift_sets add column details jsonb not null default '{}' check (jsonb_typeof(details) = 'object');
alter table public.lift_exercises drop constraint lift_exercises_equipment_check;
alter table public.lift_exercises add constraint lift_exercises_equipment_check check (equipment in ('barbell','dumbbell','machine','cable','bodyweight','bands','e-z curl bar','exercise ball','foam roll','kettlebells','medicine ball','other','unspecified'));
-- Nullable FK permits temporary workout-only custom/substituted exercises.
-- Their names, muscles, apparatus and load semantics remain in set snapshots.
-- One transaction for the complete plan. Removed items are archived, preserving history
-- and accepting an offline draft that started before another device edited the plan.
create or replace function public.save_lift_plan(p_person text, p_payload jsonb) returns void
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
    plates = p_payload->'plates', bar_weight = (p_payload->>'bar_weight')::numeric, details = coalesce(p_payload->'details','{}'::jsonb), version = v + 1
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
      insert into public.lift_exercises(id, day_id, name, position, sets, rep_min, rep_max, target_rir, equipment, increment, rest_seconds, notes, details)
      values((e->>'id')::uuid, (d->>'id')::uuid, e->>'name', (e->>'position')::integer, (e->>'sets')::integer,
        (e->>'rep_min')::integer, (e->>'rep_max')::integer, (e->>'target_rir')::numeric, e->>'equipment',
        (e->>'increment')::numeric, (e->>'rest_seconds')::integer, e->>'notes', coalesce(e->'details','{}'::jsonb))
      on conflict(id) do update set day_id = excluded.day_id, name = excluded.name, position = excluded.position,
        sets = excluded.sets, rep_min = excluded.rep_min, rep_max = excluded.rep_max, target_rir = excluded.target_rir,
        equipment = excluded.equipment, increment = excluded.increment, rest_seconds = excluded.rest_seconds, notes = excluded.notes, details = excluded.details, archived = false
        where exists(select 1 from public.lift_days owned where owned.id = public.lift_exercises.day_id and owned.person_id = p_person);
      if not found then raise exception 'lift_not_owned'; end if;
    end loop;
  end loop;
end; $$;

create or replace function public.save_lift_session(p_person text, p_payload jsonb) returns jsonb
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
  if did is not null and not exists(select 1 from public.lift_days where id = did and person_id = p_person) then raise exception 'lift_not_owned'; end if;
  insert into public.lift_sessions(id, person_id, day, lift_day_id, day_name, units, started_at, finished_at, notes, details)
    values(sid, p_person, (p_payload->>'day')::date, did, p_payload->>'day_name', p_payload->>'units',
      (p_payload->>'started_at')::timestamptz, (p_payload->>'finished_at')::timestamptz, p_payload->>'notes', coalesce(p_payload->'details','{}'::jsonb));
  for s in select value from jsonb_array_elements(p_payload->'sets') loop
    if s->>'exercise_id' is not null and not exists(select 1 from public.lift_exercises e join public.lift_days d on d.id = e.day_id
      where e.id = (s->>'exercise_id')::uuid and d.person_id = p_person) then raise exception 'lift_not_owned'; end if;
    insert into public.lift_sets(session_id, exercise_id, exercise_name, set_no, is_warmup, weight, reps, rir, exercise_notes, details)
      values(sid, (s->>'exercise_id')::uuid, s->>'exercise_name', (s->>'set_no')::integer, (s->>'is_warmup')::boolean,
        (s->>'weight')::numeric, (s->>'reps')::integer, (s->>'rir')::numeric, s->>'exercise_notes', coalesce(s->'details','{}'::jsonb));
  end loop;
  return jsonb_build_object('id', sid, 'saved', true);
end; $$;

create or replace function public.get_lift_state(p_person text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'person_id', p_person,
    'plan', coalesce((select to_jsonb(p) - 'person_id' from public.lift_plans p where p.person_id = p_person),
      '{"units":"lb","default_rest_seconds":120,"plates":[45,35,25,10,5,2.5],"bar_weight":45,"version":0}'::jsonb),
    'days', coalesce((select jsonb_agg(to_jsonb(d) - 'person_id' - 'archived' || jsonb_build_object('exercises',
      coalesce((select jsonb_agg(to_jsonb(e) - 'archived' order by e.position) from public.lift_exercises e where e.day_id = d.id and not e.archived), '[]'::jsonb)) order by d.position)
      from public.lift_days d where d.person_id = p_person and not d.archived), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'details', e.details, 'archived', e.archived or d.archived) order by e.name)
      from public.lift_exercises e join public.lift_days d on d.id = e.day_id where d.person_id = p_person), '[]'::jsonb),
    'last_day_id', (select lift_day_id from public.lift_sessions where person_id = p_person order by finished_at desc, id desc limit 1),
    'recent', coalesce((select jsonb_object_agg(e.id::text,
      (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'units', s.units, 'sets',
        (select jsonb_agg(to_jsonb(ls) order by ls.is_warmup desc, ls.set_no) from public.lift_sets ls where ls.session_id = s.id and ls.exercise_id = e.id)) order by s.finished_at desc, s.id desc), '[]'::jsonb)
        from (select ss.id, ss.units, ss.finished_at from public.lift_sessions ss
          where ss.person_id = p_person and exists(select 1 from public.lift_sets x where x.session_id = ss.id and x.exercise_id = e.id and not x.is_warmup)
          order by ss.finished_at desc, ss.id desc limit 6) s))
      from public.lift_exercises e join public.lift_days d on d.id = e.day_id
      where d.person_id = p_person and not d.archived and not e.archived), '{}'::jsonb)
  );
$$;

create or replace function public.get_lift_history(p_person text, p_exercise uuid, p_before timestamptz, p_before_id uuid) returns jsonb
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

create or replace function public.export_lift_backup(p_person text) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare st jsonb; result jsonb;
begin
  if (select count(*) from public.lift_sessions where person_id=p_person)>5000 then raise exception 'lift_backup_too_large'; end if;
  st := public.get_lift_state(p_person);
  select jsonb_build_object('format','75hard-lift','version',1,'owner',p_person,'exported_at',now(),
    'revision',md5((st->'plan'->>'version') || coalesce((select string_agg(id::text,',' order by id) from public.lift_sessions where person_id=p_person),'')),
    'plan',st->'plan' || jsonb_build_object('days',st->'days'),
    'sessions',coalesce((select jsonb_agg(to_jsonb(s)-'person_id' || jsonb_build_object('sets',
      (select coalesce(jsonb_agg(to_jsonb(x) order by x.exercise_name,x.is_warmup desc,x.set_no),'[]'::jsonb)
       from public.lift_sets x where x.session_id=s.id)) order by s.finished_at desc,s.id desc)
       from public.lift_sessions s where s.person_id=p_person),'[]'::jsonb)) into result;
  return result;
end; $$;

-- The browser builds a preview of the merged/replaced snapshot. This RPC checks
-- version + owner and restores the validated snapshot in one transaction.
create or replace function public.restore_lift_backup(p_person text,p_backup jsonb,p_mode text,p_version integer,p_revision text) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare st jsonb; session jsonb; item jsonb; payload jsonb; eid uuid; d jsonb; e jsonb; incoming_day jsonb;
begin
  perform 1 from public.people where id=p_person for update;
  if not found or p_backup->>'owner' is distinct from p_person or (p_mode is null or p_mode not in ('merge','replace')) then raise exception 'lift_not_owned'; end if;
  st:=public.get_lift_state(p_person);
  if p_version is null or p_revision is null or (st->'plan'->>'version')::integer<>p_version or p_revision<>md5((st->'plan'->>'version') || coalesce((select string_agg(id::text,',' order by id) from public.lift_sessions where person_id=p_person),'')) then raise exception 'lift_conflict'; end if;
  -- Foreign UUIDs cannot delete or overwrite another person's data.
  if exists(select 1 from jsonb_array_elements(p_backup->'sessions') j join public.lift_sessions s on s.id=(j->>'id')::uuid where s.person_id<>p_person) then raise exception 'lift_not_owned'; end if;
  if p_mode='merge' then
    -- A merge must retain every current session; the client may not turn merge
    -- into an unannounced partial replacement. Compare normalized snapshots.
    for d in select value from jsonb_array_elements(st->'days') loop
      select value into incoming_day from jsonb_array_elements(p_backup->'plan'->'days') where value->>'id'=d->>'id';
      if incoming_day is null or incoming_day->>'name'<>d->>'name' then raise exception 'lift_conflict'; end if;
      for e in select value from jsonb_array_elements(d->'exercises') loop
        if not exists(select 1 from jsonb_array_elements(incoming_day->'exercises') j where j->>'id'=e->>'id' and j-'position'=e-'position'-'day_id') then raise exception 'lift_conflict'; end if;
      end loop;
    end loop;
    if exists(select 1 from public.lift_sessions s where s.person_id=p_person and not exists(
      select 1 from jsonb_array_elements(p_backup->'sessions') j where (j->>'id')::uuid=s.id
      and j->>'day_name'=s.day_name and (j->>'day')::date=s.day and j->>'units'=s.units
      and (j->>'started_at')::timestamptz=s.started_at and (j->>'finished_at')::timestamptz=s.finished_at
      and j->>'notes'=s.notes and coalesce(j->'details','{}'::jsonb)=s.details
      and (j->>'lift_day_id')::uuid is not distinct from s.lift_day_id
      and jsonb_array_length(j->'sets')=(select count(*) from public.lift_sets where session_id=s.id)
      and not exists(select 1 from public.lift_sets x where x.session_id=s.id and not exists(
        select 1 from jsonb_array_elements(j->'sets') v where (v->>'exercise_id')::uuid is not distinct from x.exercise_id
        and v->>'exercise_name'=x.exercise_name and (v->>'set_no')::integer=x.set_no and (v->>'is_warmup')::boolean=x.is_warmup
        and (v->>'weight')::numeric=x.weight and (v->>'reps')::integer=x.reps and (v->>'rir')::numeric=x.rir
        and v->>'exercise_notes'=x.exercise_notes and coalesce(v->'details','{}'::jsonb)=x.details)))) then raise exception 'lift_conflict'; end if;
    if exists(select 1 from public.lift_sessions s where s.person_id=p_person and not exists(select 1 from jsonb_array_elements(p_backup->'sessions') j where (j->>'id')::uuid=s.id)) then raise exception 'lift_conflict'; end if;
  end if;
  perform public.save_lift_plan(p_person,(p_backup->'plan') || jsonb_build_object('version',p_version));
  -- Validated full snapshot; rollback restores all rows if any later insert fails.
  delete from public.lift_sessions where person_id=p_person;
  for session in select value from jsonb_array_elements(p_backup->'sessions') loop
    -- Archived/unavailable exercise identities are kept as snapshot provenance;
    -- do not recreate an old archived plan just to restore its historical sets.
    payload := session || jsonb_build_object('sets','[]'::jsonb);
    if exists(select 1 from public.lift_days where id=(session->>'lift_day_id')::uuid and person_id<>p_person) then raise exception 'lift_not_owned'; end if;
    if not exists(select 1 from public.lift_days where id=(session->>'lift_day_id')::uuid and person_id=p_person) then payload:=payload||jsonb_build_object('lift_day_id',null); end if;
    for item in select value from jsonb_array_elements(session->'sets') loop
      eid := (item->>'exercise_id')::uuid;
      if eid is not null and not exists(select 1 from public.lift_exercises e join public.lift_days d on d.id=e.day_id where e.id=eid and d.person_id=p_person) then
        -- IDs absent locally are snapshot-only; IDs owned by another person reject.
        if exists(select 1 from public.lift_exercises where id=eid) then raise exception 'lift_not_owned'; end if;
        item:=item||jsonb_build_object('exercise_id',null,'details',coalesce(item->'details','{}'::jsonb)||jsonb_build_object('original_exercise_id',eid));
      end if;
      payload:=jsonb_set(payload,'{sets}',(payload->'sets')||jsonb_build_array(item));
    end loop;
    perform public.save_lift_session(p_person,payload);
  end loop;
  return public.get_lift_state(p_person);
end; $$;
revoke all on function public.export_lift_backup(text) from public, anon, authenticated;
revoke all on function public.restore_lift_backup(text,jsonb,text,integer,text) from public, anon, authenticated;
grant execute on function public.export_lift_backup(text), public.restore_lift_backup(text,jsonb,text,integer,text) to service_role;
create or replace function public.delete_lift_session(p_person text,p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.people where id=p_person for update;
  if not found then raise exception 'lift_not_owned'; end if;
  delete from public.lift_sessions where id=p_id and person_id=p_person;
  if not found then raise exception 'lift_not_owned'; end if;
end; $$;
revoke all on function public.delete_lift_session(text,uuid) from public, anon, authenticated;
grant execute on function public.delete_lift_session(text,uuid) to service_role;

commit;
