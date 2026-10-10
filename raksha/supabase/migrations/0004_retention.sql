-- Retention (spec §8.5). Runs daily via pg_cron when the extension exists (always on Supabase).
create function public.retention_cleanup() returns json
language plpgsql security definer set search_path = public, extensions as $$
declare n_end int; n_pts int; n_sos int; n_rep int;
begin
  -- auto-end sessions past their expiry
  update public.share_sessions set status = 'ended', ended_at = coalesce(ended_at, ends_at) where status = 'active' and ends_at < now();
  get diagnostics n_end = row_count;
  -- live/walk trails: gone 24 h after the session ended
  delete from public.location_points p using public.share_sessions s
   where p.session_id = s.id and s.kind in ('live', 'walk') and coalesce(s.ended_at, s.ends_at) < now() - interval '24 hours';
  get diagnostics n_pts = row_count;
  -- SOS sessions (points, clips, events via cascade): kept 30 days
  delete from public.share_sessions where kind = 'sos' and started_at < now() - interval '30 days';
  get diagnostics n_sos = row_count;
  delete from public.reports where created_at < now() - interval '180 days';
  get diagnostics n_rep = row_count;
  return json_build_object('ended', n_end, 'points', n_pts, 'sos_sessions', n_sos, 'reports', n_rep);
end $$;
revoke execute on function public.retention_cleanup() from public, anon, authenticated;
grant execute on function public.retention_cleanup() to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('raksha-retention', '17 3 * * *', 'select public.retention_cleanup()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;
