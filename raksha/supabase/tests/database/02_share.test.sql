-- Share sessions: hashed tokens, point-insert rules, and the helper the share-view edge function uses.
begin;
select plan(25);

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-00000000000a', 'Riya');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t_share as select public.start_share('live', 30) as r;
grant all on t_share to public;
select is(length((select r->>'token' from t_share)), 64, 'token is 64 hex chars (256-bit)');
select matches((select r->>'token' from t_share), '^[0-9a-f]{64}$', 'token is lowercase hex');
select is((select encode(token_hash, 'hex') from public.share_sessions where id = ((select r->>'session_id' from t_share))::uuid),
          encode(extensions.digest((select r->>'token' from t_share), 'sha256'), 'hex'), 'only sha256(token) is stored');
select is((select count(*) from public.share_sessions where encode(token_hash, 'hex') = (select r->>'token' from t_share)), 0::bigint, 'the raw token is not stored');
select throws_ok($$select public.start_share('sos', 30)$$, 'P0001', 'invalid_kind', 'sos sessions only via start_sos');
select throws_ok($$select public.start_share('live', 4)$$, 'P0001', 'invalid_duration', 'minutes below 5 rejected');
select throws_ok($$select public.start_share('live', 241)$$, 'P0001', 'invalid_duration', 'minutes above 240 rejected');
select throws_ok($$select public.start_share('weird', 30)$$, 'P0001', 'invalid_kind', 'unknown kind rejected');

-- appending points
select lives_ok(format($$insert into public.location_points (session_id, user_id, geog, accuracy_m, battery) values (%L, %L, 'SRID=4326;POINT(72.85 19.2)', 8, 0.8)$$,
  (select r->>'session_id' from t_share), '00000000-0000-0000-0000-00000000000a'), 'owner can append to her active session');
select throws_ok(format($$insert into public.location_points (session_id, user_id, geog) values (%L, %L, 'SRID=4326;POINT(72.85 19.2)')$$,
  (select r->>'session_id' from t_share), '00000000-0000-0000-0000-00000000000b'), '42501', null, 'cannot insert a point under another user_id');
select throws_ok(format($$insert into public.location_points (session_id, user_id, geog, accuracy_m) values (%L, %L, 'SRID=4326;POINT(72.85 19.2)', -1)$$,
  (select r->>'session_id' from t_share), '00000000-0000-0000-0000-00000000000a'), '23514', null, 'negative accuracy rejected');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok(format($$insert into public.location_points (session_id, user_id, geog) values (%L, %L, 'SRID=4326;POINT(72.85 19.2)')$$,
  (select r->>'session_id' from t_share), '00000000-0000-0000-0000-00000000000b'), '42501', null, 'B cannot append to A''s session');
select throws_ok(format($$select public.end_share(%L)$$, (select r->>'session_id' from t_share)), 'P0001', 'not_found', 'B cannot end A''s session');

-- ended / expired sessions refuse points
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t_ended as select public.start_share('walk', 30) as r;
grant all on t_ended to public;
select lives_ok(format($$select public.end_share(%L)$$, (select r->>'session_id' from t_ended)), 'owner can end her session');
select throws_ok(format($$insert into public.location_points (session_id, user_id, geog) values (%L, %L, 'SRID=4326;POINT(72.85 19.2)')$$,
  (select r->>'session_id' from t_ended), '00000000-0000-0000-0000-00000000000a'), '42501', null, 'ended session refuses points');
create temp table t_exp as select public.start_share('walk', 30) as r;
grant all on t_exp to public;
reset role;
update public.share_sessions set ends_at = now() - interval '1 minute' where id = ((select r->>'session_id' from t_exp))::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok(format($$insert into public.location_points (session_id, user_id, geog) values (%L, %L, 'SRID=4326;POINT(72.85 19.2)')$$,
  (select r->>'session_id' from t_exp), '00000000-0000-0000-0000-00000000000a'), '42501', null, 'expired session refuses points');

-- share_view_data (service role only)
select throws_ok($$select public.share_view_data('00')$$, '42501', null, 'authenticated users cannot call share_view_data');
reset role;
select is((public.share_view_data((select r->>'token' from t_share))->>'name'), 'Riya', 'valid token returns the sharer''s name');
select is((public.share_view_data((select r->>'token' from t_share))->>'status'), 'active', 'valid token returns active status');
select is((public.share_view_data((select r->>'token' from t_share))->'last'->>'lat')::numeric, 19.2::numeric, 'last position is returned');
select is((public.share_view_data(repeat('0', 64)))::text, null, 'wrong token returns nothing');
select is((public.share_view_data('not-a-token'))::text, null, 'malformed token returns nothing');
select is((public.share_view_data((select r->>'token' from t_ended))->>'status'), 'ended', 'recently ended session is still viewable, marked ended');
update public.share_sessions set ended_at = now() - interval '2 hours' where id = ((select r->>'session_id' from t_ended))::uuid;
select is((public.share_view_data((select r->>'token' from t_ended)))::text, null, 'session ended > 1 h ago is gone');
update public.share_sessions set ends_at = now() - interval '3 hours' where id = ((select r->>'session_id' from t_exp))::uuid;
select is((public.share_view_data((select r->>'token' from t_exp)))::text, null, 'session expired > 1 h ago is gone');

select * from finish();
rollback;
