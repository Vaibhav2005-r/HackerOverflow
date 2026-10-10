-- Community reports: validation, anti-spam limits, privacy (cell-level only), decayed aggregates.
begin;
select plan(21);

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com');

-- the table has no coordinate columns at all
select columns_are('public', 'reports', array['id', 'reporter_id', 'h3_cell', 'band', 'category', 'note', 'status', 'created_at'], 'reports store a cell, never coordinates');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
-- cell centre ≈ (19.2000, 72.8500); reporter 50 m away
select lives_ok($$select public.submit_report(19.2004, 72.8500, 19.2000, 72.8500, '89608b44003ffff', 'night', 'harassment', 'followed me')$$, 'a nearby report is accepted');
select throws_ok($$select public.submit_report(19.2004, 72.8500, 19.2000, 72.8500, '89608b44003ffff', 'night', 'stalking')$$, 'P0001', 'duplicate', 'same cell + band twice in 24 h is rejected');
select lives_ok($$select public.submit_report(19.2004, 72.8500, 19.2000, 72.8500, '89608b44003ffff', 'evening', 'poor_lighting')$$, 'another band in the same cell is fine');
select throws_ok($$select public.submit_report(19.2100, 72.8500, 19.2000, 72.8500, '89608b44007ffff', 'night', 'felt_unsafe')$$, 'P0001', 'too_far', 'a reporter > 400 m from the cell centre is rejected');
select throws_ok($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b44007ffff', 'night', 'bogus')$$, 'P0001', 'invalid_category', 'unknown category rejected');
select throws_ok($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b44007ffff', 'dusk', 'felt_safe')$$, 'P0001', 'invalid_band', 'unknown band rejected');
select throws_ok($$select public.submit_report(19.2, 72.85, 19.2, 72.85, 'ZZZ', 'night', 'felt_safe')$$, 'P0001', 'invalid_cell', 'malformed cell rejected');
select throws_ok(format($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b44007ffff', 'night', 'felt_safe', %L)$$, repeat('x', 281)), 'P0001', 'note_too_long', 'notes over 280 chars rejected');
select lives_ok(format($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b4400bffff', 'day', 'well_lit', %L)$$, 'bright' || chr(7) || chr(10) || ' street'), 'control characters in notes are accepted but stripped');
select lives_ok($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b4400fffff', 'day', 'felt_safe')$$, '4th report');
select lives_ok($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b44013ffff', 'day', 'felt_safe')$$, '5th report');
select throws_ok($$select public.submit_report(19.2, 72.85, 19.2, 72.85, '89608b44017ffff', 'day', 'felt_safe')$$, 'P0001', 'rate_limited', 'the 6th report in 24 h is rejected');

reset role;
select is((select note from public.reports where h3_cell = '89608b4400bffff'), 'bright street', 'control characters were stripped from the note');

-- aggregates: decay, band factor, poor_lighting rule, 120-day cut-off
delete from public.reports;
insert into public.reports (reporter_id, h3_cell, band, category, created_at) values
  ('00000000-0000-0000-0000-00000000000b', '89608b44003ffff', 'night', 'harassment', now()),
  ('00000000-0000-0000-0000-00000000000c', '89608b44003ffff', 'night', 'harassment', now() - interval '45 days'),
  ('00000000-0000-0000-0000-00000000000c', '89608b44003ffff', 'night', 'poor_lighting', now()),
  ('00000000-0000-0000-0000-00000000000c', '89608b44003ffff', 'night', 'felt_safe', now() - interval '130 days'),
  ('00000000-0000-0000-0000-00000000000b', '89608b44007ffff', 'night', 'helpful_people', now());
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
create temp table agg as select * from public.get_report_aggregates(array['89608b44003ffff', '89608b44007ffff']);
grant all on agg to public;
select is((select round(neg_w::numeric, 3) from agg where h3_cell = '89608b44003ffff' and band = 'night'), round((1 + exp(-1.0) + 0.5)::numeric, 3), 'night: fresh + 45-day-old harassment (×e⁻¹) + poor_lighting 0.5');
select is((select round(neg_w::numeric, 3) from agg where h3_cell = '89608b44003ffff' and band = 'day'), round((0.3 * (1 + exp(-1.0)))::numeric, 3), 'day: other-band reports count ×0.3 and poor_lighting is excluded');
select is((select pos_w from agg where h3_cell = '89608b44003ffff' and band = 'night'), 0::double precision, 'reports older than 120 days are ignored');
select is((select round(pos_w::numeric, 3) from agg where h3_cell = '89608b44007ffff' and band = 'evening'), round((0.6 * 0.3)::numeric, 3), 'positive reports weigh in with the same band factor');
select is((select n from agg where h3_cell = '89608b44003ffff' and band = 'night'), 3::bigint, 'n counts contributing reports');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid = 'agg'::regclass and attnum > 0), array['h3_cell', 'band', 'neg_w', 'pos_w', 'n', 'last_at'], 'aggregates expose no reporter ids or notes');
select throws_ok($$select * from public.get_report_aggregates(array_fill('89608b44003ffff'::text, array[501]))$$, 'P0001', 'too_many_cells', 'more than 500 cells rejected');

select * from finish();
rollback;
