-- Deny by default. Everything is owner-scoped; the writes that must be validated go through RPCs (0003).
alter table public.profiles enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.share_sessions enable row level security;
alter table public.location_points enable row level security;
alter table public.sos_events enable row level security;
alter table public.evidence_clips enable row level security;
alter table public.reports enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ncrb_districts enable row level security;

-- Table privileges (belt and braces on top of RLS): anonymous *web* visitors (role anon) touch nothing.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- Writes to these tables only happen inside SECURITY DEFINER RPCs.
revoke insert, update, delete on public.share_sessions, public.sos_events from authenticated;
revoke all on public.reports from authenticated;
revoke update, delete on public.location_points, public.evidence_clips from authenticated;
grant select on public.ncrb_districts to anon, authenticated;

create policy profiles_owner on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy contacts_owner on public.trusted_contacts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy push_owner on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sessions: owner can read; there is NO insert/update/delete policy (start_share / end_share / start_sos / resolve_sos do that).
-- No public select: contacts read through the `share-view` edge function with a secret token.
create policy sessions_owner_select on public.share_sessions for select to authenticated
  using (user_id = (select auth.uid()));

-- Points: owner may append only to her own active, unexpired session.
create policy points_owner_select on public.location_points for select to authenticated
  using (user_id = (select auth.uid()));
create policy points_owner_insert on public.location_points for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.share_sessions s
      where s.id = session_id and s.user_id = (select auth.uid()) and s.status = 'active' and now() < s.ends_at
    )
  );

create policy sos_owner_select on public.sos_events for select to authenticated
  using (user_id = (select auth.uid()));

create policy clips_owner_select on public.evidence_clips for select to authenticated
  using (user_id = (select auth.uid()));
create policy clips_owner_insert on public.evidence_clips for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sos_events e where e.id = sos_id and e.user_id = (select auth.uid()))
  );

-- reports: RLS enabled and NO policies => nobody can select or insert directly. submit_report / get_report_aggregates only.

create policy ncrb_public_read on public.ncrb_districts for select to anon, authenticated using (true);

-- Private evidence bucket; each user may only touch objects under her own uid folder.
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict (id) do nothing;
create policy evidence_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evidence_select_own on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
