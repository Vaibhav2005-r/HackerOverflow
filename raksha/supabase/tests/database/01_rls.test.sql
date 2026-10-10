-- RLS: nobody sees or changes anybody else's rows; anonymous (role anon) sees nothing; reports are unreadable by everyone.
begin;
select plan(24);

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- A creates her data
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-00000000000a', 'Riya')$$, 'A can create her profile');
select lives_ok($$insert into public.trusted_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-00000000000a', 'Maa', '+919876543210')$$, 'A can add a contact');
select lives_ok($$select public.start_share('live', 30)$$, 'A can start a share');
select lives_ok($$select public.start_sos('hold', 'silent')$$, 'A can start an SOS');
select lives_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-00000000000a', 'https://push.example/a', 'k', 'a')$$, 'A can store a push subscription');
insert into public.location_points (session_id, user_id, geog)
  select id, user_id, 'SRID=4326;POINT(72.85 19.2)'::extensions.geography from public.share_sessions limit 1;

-- B sees none of it
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.profiles), 0::bigint, 'B cannot read A''s profile');
select is((select count(*) from public.trusted_contacts), 0::bigint, 'B cannot read A''s contacts');
select is((select count(*) from public.share_sessions), 0::bigint, 'B cannot read A''s sessions');
select is((select count(*) from public.location_points), 0::bigint, 'B cannot read A''s points');
select is((select count(*) from public.sos_events), 0::bigint, 'B cannot read A''s SOS events');
select is((select count(*) from public.push_subscriptions), 0::bigint, 'B cannot read A''s push subscriptions');

-- B cannot modify them either (RLS filters the rows out: 0 affected)
with u as (update public.trusted_contacts set name = 'hacked' returning 1) select is((select count(*) from u), 0::bigint, 'B cannot update A''s contact');
with d as (delete from public.trusted_contacts returning 1) select is((select count(*) from d), 0::bigint, 'B cannot delete A''s contact');
select throws_ok($$insert into public.trusted_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-00000000000a', 'x', '+919876543210')$$, '42501', null, 'B cannot add a contact to A''s circle');
select throws_ok($$insert into public.share_sessions (user_id, kind, token_hash, ends_at) values ('00000000-0000-0000-0000-00000000000b', 'live', 'x'::bytea, now() + interval '1 hour')$$, '42501', null, 'sessions cannot be inserted directly (RPC only)');
select throws_ok($$update public.share_sessions set coercion = true$$, '42501', null, 'sessions cannot be updated directly');
select throws_ok($$insert into public.sos_events (user_id, session_id, trigger, mode) values ('00000000-0000-0000-0000-00000000000b', gen_random_uuid(), 'hold', 'silent')$$, '42501', null, 'SOS events cannot be inserted directly');

-- reports are unreadable and unwritable for everyone
select throws_ok($$select * from public.reports$$, '42501', null, 'authenticated cannot select reports');
select throws_ok($$insert into public.reports (reporter_id, h3_cell, band, category) values ('00000000-0000-0000-0000-00000000000b', '89608b44003ffff', 'night', 'felt_safe')$$, '42501', null, 'authenticated cannot insert reports directly');

-- anonymous (role anon, i.e. no sign-in at all) gets nothing
reset role; set local role anon;
select throws_ok($$select * from public.trusted_contacts$$, '42501', null, 'anon cannot read contacts');
select throws_ok($$select * from public.share_sessions$$, '42501', null, 'anon cannot read sessions');
select throws_ok($$select * from public.location_points$$, '42501', null, 'anon cannot read points');
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports');
select throws_ok($$select public.start_share('live', 30)$$, '42501', null, 'anon cannot call start_share');

select * from finish();
rollback;
