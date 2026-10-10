-- Circle limit, phone validation, delete-all-my-data, retention job.
begin;
select plan(13);

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$insert into public.trusted_contacts (user_id, name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'c1', '+919876543201'), ('00000000-0000-0000-0000-00000000000a', 'c2', '+919876543202'),
  ('00000000-0000-0000-0000-00000000000a', 'c3', '+919876543203'), ('00000000-0000-0000-0000-00000000000a', 'c4', '+919876543204'),
  ('00000000-0000-0000-0000-00000000000a', 'c5', '+919876543205')$$, 'five contacts are fine');
select throws_ok($$insert into public.trusted_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-00000000000a', 'c6', '+919876543206')$$, 'P0001', null, 'a sixth contact is rejected by the trigger');
select throws_ok($$insert into public.trusted_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-00000000000b', 'c6', '12')$$, '42501', null, 'cannot add into someone else''s circle');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok($$insert into public.trusted_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-00000000000b', 'bad', 'not a phone')$$, '23514', null, 'malformed phone numbers are rejected');
select lives_ok($$insert into public.trusted_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-00000000000b', 'Dad', '9876543299')$$, 'B has her own circle (limit is per user)');
select lives_ok($$select public.start_share('live', 30)$$, 'B starts a share');

-- A wipes her data; B keeps hers
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.start_sos('hold', 'silent')$$, 'A starts an SOS');
select lives_ok($$select public.delete_my_data()$$, 'A deletes her data');
reset role;
select is((select count(*) from public.trusted_contacts where user_id = '00000000-0000-0000-0000-00000000000a'), 0::bigint, 'A''s contacts are gone');
select is((select count(*) from public.share_sessions where user_id = '00000000-0000-0000-0000-00000000000a'), 0::bigint, 'A''s sessions (and their SOS events) are gone');
select is((select count(*) from public.trusted_contacts where user_id = '00000000-0000-0000-0000-00000000000b'), 1::bigint, 'B''s data is untouched');

-- retention
insert into public.share_sessions (user_id, kind, token_hash, started_at, ends_at, ended_at) values
  ('00000000-0000-0000-0000-00000000000b', 'live', 'old'::bytea, now() - interval '3 days', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000000b', 'sos', 'oldsos'::bytea, now() - interval '31 days', now() - interval '31 days', now() - interval '31 days');
insert into public.location_points (session_id, user_id, geog) select id, user_id, 'SRID=4326;POINT(72.85 19.2)'::extensions.geography from public.share_sessions where token_hash = 'old'::bytea;
select public.retention_cleanup();
select is((select count(*) from public.location_points p join public.share_sessions s on s.id = p.session_id where s.token_hash = 'old'::bytea), 0::bigint, 'live trails are deleted 24 h after the session ended');
select is((select count(*) from public.share_sessions where token_hash = 'oldsos'::bytea), 0::bigint, 'SOS sessions are deleted after 30 days');

select * from finish();
rollback;
