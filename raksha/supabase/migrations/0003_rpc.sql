-- RPCs. All SECURITY DEFINER with a pinned search_path; every input is validated; errors use stable message prefixes the client maps.

-- internal: create a share session and return the one-time raw token (never retrievable again)
create function public._new_session(p_uid uuid, p_kind text, p_minutes int)
returns table (session_id uuid, token text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');   -- 256-bit, 64 hex chars
begin
  insert into public.share_sessions (user_id, kind, token_hash, ends_at)
  values (p_uid, p_kind, digest(v_token, 'sha256'), now() + make_interval(mins => p_minutes))
  returning id into session_id;
  token := v_token;
  return next;
end $$;

create function public.start_share(p_kind text, p_minutes int default 120) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_kind is null or p_kind not in ('live', 'walk') then raise exception 'invalid_kind'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 240 then raise exception 'invalid_duration'; end if;
  select * into v from public._new_session(v_uid, p_kind, p_minutes);
  return json_build_object('session_id', v.session_id, 'token', v.token);
end $$;

create function public.end_share(p_session_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.share_sessions set status = 'ended', ended_at = now()
  where id = p_session_id and user_id = v_uid and status = 'active';
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.start_sos(p_trigger text, p_mode text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v record; v_sos uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_trigger is null or p_trigger not in ('hold', 'shake', 'timer', 'checkin', 'manual') then raise exception 'invalid_trigger'; end if;
  if p_mode is null or p_mode not in ('silent', 'loud') then raise exception 'invalid_mode'; end if;
  select * into v from public._new_session(v_uid, 'sos', 180);
  insert into public.sos_events (user_id, session_id, trigger, mode) values (v_uid, v.session_id, p_trigger, p_mode) returning id into v_sos;
  return json_build_object('sos_id', v_sos, 'session_id', v.session_id, 'token', v.token);
end $$;

-- duress = true: the app shows "cancelled", but the session stays active and is flagged as possible coercion.
create function public.resolve_sos(p_sos_id uuid, p_duress boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v public.sos_events;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v from public.sos_events where id = p_sos_id and user_id = v_uid and status in ('active', 'duress') for update;
  if not found then raise exception 'not_found'; end if;
  if p_duress then
    update public.sos_events set status = 'duress' where id = v.id;
    update public.share_sessions set coercion = true where id = v.session_id;
  else
    update public.sos_events set status = 'resolved', resolved_at = now() where id = v.id;
    update public.share_sessions set status = 'ended', ended_at = now() where id = v.session_id;
  end if;
end $$;

-- Community report. Stores the H3 cell only. The reporter's position is checked against the cell centre (400 m) as
-- best-effort anti-spam, not proof: Postgres has no H3 here, so the client computes the centre.
create function public.submit_report(
  p_lat float8, p_lng float8, p_cell_lat float8, p_cell_lng float8,
  p_h3_cell text, p_band text, p_category text, p_note text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_note text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_lat is null or p_lng is null or p_cell_lat is null or p_cell_lng is null
     or p_lat not between -90 and 90 or p_cell_lat not between -90 and 90
     or p_lng not between -180 and 180 or p_cell_lng not between -180 and 180 then raise exception 'invalid_position'; end if;
  if p_h3_cell is null or p_h3_cell !~ '^[0-9a-f]{15}$' then raise exception 'invalid_cell'; end if;
  if p_band is null or p_band not in ('day', 'evening', 'night') then raise exception 'invalid_band'; end if;
  if p_category is null or p_category not in ('harassment', 'stalking', 'felt_unsafe', 'poor_lighting', 'no_help_nearby', 'well_lit', 'helpful_people', 'felt_safe') then
    raise exception 'invalid_category'; end if;
  v_note := nullif(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]', '', 'g')), '');
  if v_note is not null and char_length(v_note) > 280 then raise exception 'note_too_long'; end if;

  if st_distance(st_makepoint(p_lng, p_lat)::geography, st_makepoint(p_cell_lng, p_cell_lat)::geography) > 400 then
    raise exception 'too_far'; end if;
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited'; end if;
  if exists (select 1 from public.reports where reporter_id = v_uid and h3_cell = p_h3_cell and band = p_band and created_at > now() - interval '24 hours') then
    raise exception 'duplicate'; end if;

  insert into public.reports (reporter_id, h3_cell, band, category, note) values (v_uid, p_h3_cell, p_band, p_category, v_note);
end $$;

-- Decayed report weights per (cell, target band): |w|·exp(−age/45 d), reports filed in another band count ×0.3,
-- poor_lighting never applies to DAY, reports older than 120 days are ignored. No reporter ids, no notes.
create function public.get_report_aggregates(p_cells text[])
returns table (h3_cell text, band text, neg_w double precision, pos_w double precision, n bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_cells is null or coalesce(array_length(p_cells, 1), 0) > 500 then raise exception 'too_many_cells'; end if;
  return query
  with w(category, weight) as (values
    ('harassment', -1.0), ('stalking', -1.0), ('felt_unsafe', -0.7), ('poor_lighting', -0.5), ('no_help_nearby', -0.4),
    ('well_lit', 0.5), ('helpful_people', 0.6), ('felt_safe', 0.7)),
  b(band) as (values ('day'), ('evening'), ('night')),
  x as (
    select r.h3_cell, b.band, w.weight, r.created_at,
           extract(epoch from (now() - r.created_at)) / 86400.0 as age_days,
           case when r.band = b.band then 1.0 else 0.3 end as band_factor
    from public.reports r join w on w.category = r.category cross join b
    where r.h3_cell = any (p_cells) and r.status = 'active'
      and not (r.category = 'poor_lighting' and b.band = 'day')
  )
  select x.h3_cell, x.band,
         coalesce(sum(case when x.weight < 0 then abs(x.weight) * x.band_factor * exp(-x.age_days / 45.0) end), 0)::double precision,
         coalesce(sum(case when x.weight > 0 then x.weight * x.band_factor * exp(-x.age_days / 45.0) end), 0)::double precision,
         count(*), max(x.created_at)
  from x where x.age_days <= 120
  group by x.h3_cell, x.band;
end $$;

-- Everything belonging to the caller. Storage objects are removed by the client (storage API) / delete-account function.
create function public.delete_my_data() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.reports where reporter_id = v_uid;
  delete from public.share_sessions where user_id = v_uid;   -- cascades points, sos events, clips
  delete from public.push_subscriptions where user_id = v_uid;
  delete from public.trusted_contacts where user_id = v_uid;
  delete from public.profiles where id = v_uid;
end $$;

-- Used only by the share-view edge function (service role). Returns null for any invalid / expired token (no detail).
create function public.share_view_data(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.share_sessions; v_status text; v_last json; v_trail json; v_clips json; v_name text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into s from public.share_sessions where token_hash = digest(p_token, 'sha256');
  if not found then return null; end if;
  v_status := case when s.status = 'active' and now() < s.ends_at then 'active' else 'ended' end;
  -- an ended session stays visible for one hour
  if v_status = 'ended' and coalesce(s.ended_at, s.ends_at) < now() - interval '1 hour' then return null; end if;

  select coalesce(display_name, 'Someone') into v_name from public.profiles where id = s.user_id;
  select json_build_object('lat', st_y(geog::geometry), 'lng', st_x(geog::geometry), 'accuracy', accuracy_m, 'battery', battery,
                           't', (extract(epoch from recorded_at) * 1000)::bigint)
    into v_last from public.location_points where session_id = s.id order by recorded_at desc, id desc limit 1;
  select coalesce(json_agg(p order by p.t), '[]'::json) into v_trail from (
    select st_y(geog::geometry) as lat, st_x(geog::geometry) as lng, accuracy_m as accuracy, battery,
           (extract(epoch from recorded_at) * 1000)::bigint as t
    from public.location_points where session_id = s.id and recorded_at > now() - interval '30 minutes'
    order by recorded_at desc, id desc limit 360) p;
  v_clips := '[]'::json;
  if s.kind = 'sos' then
    select coalesce(json_agg(json_build_object('seq', c.seq, 'storage_path', c.storage_path) order by c.seq), '[]'::json) into v_clips
    from public.evidence_clips c join public.sos_events e on e.id = c.sos_id where e.session_id = s.id;
  end if;
  return json_build_object('name', coalesce(v_name, 'Someone'), 'kind', s.kind, 'status', v_status, 'coercion', s.coercion,
                           'started_at', (extract(epoch from s.started_at) * 1000)::bigint, 'last', v_last, 'trail', v_trail, 'clips', v_clips);
end $$;

-- Execute grants: nothing is public by default.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.start_share(text, int), public.end_share(uuid), public.start_sos(text, text), public.resolve_sos(uuid, boolean),
  public.submit_report(float8, float8, float8, float8, text, text, text, text), public.get_report_aggregates(text[]), public.delete_my_data()
  to authenticated;
grant execute on function public.share_view_data(text) to service_role;
