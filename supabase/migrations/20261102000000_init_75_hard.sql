-- Applied to the 75-hard project via the Supabase MCP. Kept here for reference.
-- Person rows (with key hashes) and app_secrets values are inserted separately and are not in the repo.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.people (
  id text primary key, name text not null, key_hash text not null unique, tz text not null,
  photo_mode text not null default 'phone' check (photo_mode in ('phone','album','cloud','checkbox')),
  onboarded boolean not null default false, tips jsonb not null default '{}'::jsonb,
  pending_photo_day date, created_at timestamptz not null default now()
);
create table public.app_settings (id int primary key default 1 check (id = 1), start_date date not null default '2026-11-03', updated_at timestamptz not null default now());
insert into public.app_settings (id) values (1);
create table public.app_secrets (name text primary key, value text not null);
create table public.entries (
  person_id text not null references public.people(id) on delete cascade, day date not null,
  w1 boolean not null default false, w2 boolean not null default false, diet boolean not null default false,
  water smallint not null default 0 check (water between 0 and 8), read boolean not null default false,
  photo boolean not null default false, updated_at timestamptz not null default now(), primary key (person_id, day)
);
create table public.push_subscriptions (
  id bigint generated always as identity primary key, person_id text not null references public.people(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz not null default now()
);
create table public.push_log (person_id text not null references public.people(id) on delete cascade, kind text not null, day date not null, sent_at timestamptz not null default now(), primary key (person_id, kind, day));
create table public.photos (
  id uuid primary key default gen_random_uuid(), person_id text not null references public.people(id) on delete cascade,
  day date not null, path text not null unique, bytes int, created_at timestamptz not null default now(), unique (person_id, day)
);
-- RLS on, no policies, no grants for browser roles: only the service role (edge functions) can read/write.
alter table public.people enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_secrets enable row level security;
alter table public.entries enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
alter table public.photos enable row level security;

revoke all on table public.people from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;
revoke all on table public.app_secrets from anon, authenticated;
revoke all on table public.entries from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.push_log from anon, authenticated;
revoke all on table public.photos from anon, authenticated;
revoke all on sequence public.push_subscriptions_id_seq from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg']);
-- cron: '75hard-notify' every 5 min -> net.http_post(.../functions/v1/notify, x-cron-secret from app_secrets)
