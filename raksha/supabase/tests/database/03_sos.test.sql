-- SOS lifecycle, duress cancel, evidence clips.
begin;
select plan(18);

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
create temp table t_sos as select public.start_sos('shake', 'loud') as r;
grant all on t_sos to public;
select ok((select r->>'sos_id' from t_sos) is not null and length(r->>'token') = 64, 'start_sos returns ids and a 64-char token') from t_sos;
select is((select kind from public.share_sessions where id = ((select r->>'session_id' from t_sos))::uuid), 'sos', 'an sos session is created');
select is((select (extract(epoch from (ends_at - started_at)) / 60)::int from public.share_sessions where id = ((select r->>'session_id' from t_sos))::uuid), 180, 'sos session lasts 180 minutes');
select is((select mode from public.sos_events where id = ((select r->>'sos_id' from t_sos))::uuid), 'loud', 'mode recorded');
select throws_ok($$select public.start_sos('hold', 'quiet')$$, 'P0001', 'invalid_mode', 'invalid mode rejected');
select throws_ok($$select public.start_sos('panic', 'silent')$$, 'P0001', 'invalid_trigger', 'invalid trigger rejected');

-- another user cannot resolve it
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok(format($$select public.resolve_sos(%L, false)$$, (select r->>'sos_id' from t_sos)), 'P0001', 'not_found', 'B cannot resolve A''s SOS');
select throws_ok(format($$insert into public.evidence_clips (sos_id, user_id, storage_path, seq) values (%L, %L, 'x', 1)$$, (select r->>'sos_id' from t_sos), '00000000-0000-0000-0000-00000000000b'),
  '42501', null, 'B cannot attach clips to A''s SOS');

-- A: evidence clip, then duress cancel
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok(format($$insert into public.evidence_clips (sos_id, user_id, storage_path, seq, duration_s) values (%L, %L, %L, 1, 10)$$,
  (select r->>'sos_id' from t_sos), '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/clip1.webm'), 'A can attach a clip');
select lives_ok(format($$select public.resolve_sos(%L, true)$$, (select r->>'sos_id' from t_sos)), 'duress resolve succeeds');
select is((select status from public.sos_events where id = ((select r->>'sos_id' from t_sos))::uuid), 'duress', 'event status is duress');
select is((select status from public.share_sessions where id = ((select r->>'session_id' from t_sos))::uuid), 'active', 'duress keeps the session ACTIVE');
select is((select coercion from public.share_sessions where id = ((select r->>'session_id' from t_sos))::uuid), true, 'duress flags possible coercion');

reset role;
select is((public.share_view_data((select r->>'token' from t_sos))->>'coercion')::boolean, true, 'contact view sees the coercion flag');
select is((public.share_view_data((select r->>'token' from t_sos))->>'status'), 'active', 'contact view still sees ACTIVE');
select is(json_array_length(public.share_view_data((select r->>'token' from t_sos))->'clips'), 1, 'sos view lists evidence clips');

-- the real PIN afterwards still ends it
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok(format($$select public.resolve_sos(%L, false)$$, (select r->>'sos_id' from t_sos)), 'real cancel after duress resolves');
select is((select status from public.share_sessions where id = ((select r->>'session_id' from t_sos))::uuid), 'ended', 'real cancel ends the session');

select * from finish();
rollback;
