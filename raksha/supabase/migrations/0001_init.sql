-- Raksha schema. Every table has RLS enabled in 0002; PostGIS/pgcrypto live in the `extensions` schema (Supabase convention).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  language text not null default 'en' check (language in ('en', 'hi')),
  created_at timestamptz not null default now()
);

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  relation text check (char_length(relation) <= 20),
  contact_user_id uuid references auth.users on delete set null, -- set when the contact also uses Raksha (web push)
  created_at timestamptz not null default now()
);
create index trusted_contacts_user_idx on public.trusted_contacts (user_id);

create table public.share_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('live', 'walk', 'sos')),
  token_hash bytea not null unique,         -- sha256(token); the raw 256-bit token is never stored
  status text not null default 'active' check (status in ('active', 'ended')),
  coercion boolean not null default false,  -- set by a duress cancel
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz
);
create index share_sessions_user_idx on public.share_sessions (user_id, status);

create table public.location_points (
  id bigserial primary key,
  session_id uuid not null references public.share_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  geog extensions.geography(point, 4326) not null,
  accuracy_m real check (accuracy_m >= 0),
  battery real check (battery between 0 and 1),
  recorded_at timestamptz not null default now()
);
create index location_points_session_idx on public.location_points (session_id, recorded_at desc);

create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_id uuid not null references public.share_sessions on delete cascade,
  trigger text not null check (trigger in ('hold', 'shake', 'timer', 'checkin', 'manual')),
  mode text not null check (mode in ('silent', 'loud')),
  status text not null default 'active' check (status in ('active', 'resolved', 'duress')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index sos_events_user_idx on public.sos_events (user_id);

create table public.evidence_clips (
  id uuid primary key default gen_random_uuid(),
  sos_id uuid not null references public.sos_events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  storage_path text not null,
  seq int not null,
  duration_s real,
  created_at timestamptz not null default now(),
  unique (sos_id, seq)
);

-- Community reports: stored at hexagon level only. Exact coordinates are never persisted.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users on delete cascade,
  h3_cell text not null check (h3_cell ~ '^[0-9a-f]{15}$'),
  band text not null check (band in ('day', 'evening', 'night')),
  category text not null check (category in ('harassment', 'stalking', 'felt_unsafe', 'poor_lighting', 'no_help_nearby', 'well_lit', 'helpful_people', 'felt_safe')),
  note text check (char_length(note) <= 280),
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now()
);
create index reports_cell_idx on public.reports (h3_cell, band, created_at);
create index reports_reporter_idx on public.reports (reporter_id, created_at);

create table public.push_subscriptions (
  user_id uuid not null references auth.users on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.ncrb_districts (
  key text primary key,
  state text,
  district text,
  data jsonb
);

-- A circle is limited to 5 contacts.
create function public.enforce_max_contacts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trusted_contacts where user_id = new.user_id) >= 5 then
    raise exception 'circle_full: a circle holds at most 5 contacts' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trusted_contacts_max5 before insert on public.trusted_contacts
  for each row execute function public.enforce_max_contacts();
