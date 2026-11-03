-- Atomic helpers for the api edge function. Applied to the live project 2026-11-03.

-- save_entry: apply only the fields in p_patch to one day's row, in one transaction.
-- The row lock serializes overlapping saves, so two quick taps on different fields both stick.
-- Returns the stored row plus whether the day was complete before and after (same rule as
-- _shared/rules.ts isComplete: diet, water >= 8, read, photo, and w1 or w2).
create or replace function public.save_entry(p_person_id text, p_day date, p_patch jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  before_row public.entries;
  after_row public.entries;
begin
  insert into public.entries (person_id, day) values (p_person_id, p_day)
  on conflict (person_id, day) do nothing;

  select * into before_row from public.entries where person_id = p_person_id and day = p_day for update;

  update public.entries set
    w1 = coalesce((p_patch ->> 'w1')::boolean, w1),
    w2 = coalesce((p_patch ->> 'w2')::boolean, w2),
    diet = coalesce((p_patch ->> 'diet')::boolean, diet),
    water = coalesce((p_patch ->> 'water')::smallint, water),
    read = coalesce((p_patch ->> 'read')::boolean, read),
    photo = coalesce((p_patch ->> 'photo')::boolean, photo),
    updated_at = now()
  where person_id = p_person_id and day = p_day
  returning * into after_row;

  return jsonb_build_object(
    'was_complete', before_row.diet and before_row.water >= 8 and before_row.read and before_row.photo
      and (before_row.w1 or before_row.w2),
    'is_complete', after_row.diet and after_row.water >= 8 and after_row.read and after_row.photo
      and (after_row.w1 or after_row.w2),
    'entry', jsonb_build_object(
      'day', after_row.day, 'w1', after_row.w1, 'w2', after_row.w2, 'diet', after_row.diet,
      'water', after_row.water, 'read', after_row.read, 'photo', after_row.photo
    )
  );
end;
$$;

-- replace_photo: point the day's photo record at the newly uploaded object and return the
-- previous object path (null if none) so the caller deletes the old file only after this commits.
-- The advisory lock serializes concurrent replacements for the same person and day.
create or replace function public.replace_photo(p_person_id text, p_day date, p_path text, p_bytes int)
returns text
language plpgsql
set search_path = public
as $$
declare
  old_path text;
begin
  perform pg_advisory_xact_lock(hashtext(p_person_id || ':' || p_day::text));

  select path into old_path from public.photos where person_id = p_person_id and day = p_day;

  insert into public.photos (person_id, day, path, bytes) values (p_person_id, p_day, p_path, p_bytes)
  on conflict (person_id, day) do update
    set path = excluded.path, bytes = excluded.bytes, created_at = now();

  return old_path;
end;
$$;

revoke all on function public.save_entry(text, date, jsonb) from public, anon, authenticated;
revoke all on function public.replace_photo(text, date, text, int) from public, anon, authenticated;
grant execute on function public.save_entry(text, date, jsonb) to service_role;
grant execute on function public.replace_photo(text, date, text, int) to service_role;
