-- Row level security: who can read and write what. Run with `supabase test db`.
-- Roles: anonymous, regular member of league A, admin of league A, admin of league B, and a
-- signed-in outsider. Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------- fixture (as the database owner)
insert into auth.users (id, aud, role, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', '972511111111'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', '972522222222'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', '972533333333'),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', '972544444444');
-- a = admin of A, b = regular member of A, c = admin of B, d = outsider

insert into public.leagues (id, name, season) values ('LA', 'League A', 's1'), ('LB', 'League B', 's1');
insert into public.league_members (id, league_id, profile_id, name, role) values
  ('a-admin', 'LA', '00000000-0000-0000-0000-00000000000a', 'Admin A', 'admin'),
  ('a-member', 'LA', '00000000-0000-0000-0000-00000000000b', 'Member A', 'player'),
  ('a-plain', 'LA', null, 'Roster only A', 'player'),
  ('b-admin', 'LB', '00000000-0000-0000-0000-00000000000c', 'Admin B', 'admin'),
  ('b-plain', 'LB', null, 'Roster only B', 'player');
insert into public.member_secrets (member_id, league_id, stars, cards, balance, phone) values
  ('a-admin', 'LA', 4, '{att}', 0, '972511111111'),
  ('a-member', 'LA', 3, '{def}', -40, '972522222222'),
  ('a-plain', 'LA', 2, '{}', 20, null),
  ('b-admin', 'LB', 5, '{}', 0, '972533333333'),
  ('b-plain', 'LB', 1, '{fit}', 10, null);
insert into public.rounds (id, league_id, season, number, status) values ('RA', 'LA', 's1', 1, 'done'), ('RB', 'LB', 's1', 1, 'done');
insert into public.teams (id, round_id, name, color) values ('TA1', 'RA', 'x', '#f00'), ('TA2', 'RA', 'y', '#00f'), ('TB1', 'RB', 'x', '#f00'), ('TB2', 'RB', 'y', '#00f');
insert into public.team_players (team_id, member_id) values ('TA1', 'a-admin'), ('TA2', 'a-member'), ('TB1', 'b-admin'), ('TB2', 'b-plain');
insert into public.matches (id, round_id, n, home, away, status) values ('MA', 'RA', 1, 'TA1', 'TA2', 'done'), ('MB', 'RB', 1, 'TB1', 'TB2', 'done');
insert into public.events (id, match_id, type, team, player) values ('EA', 'MA', 'goal', 'TA1', 'a-admin'), ('EB', 'MB', 'goal', 'TB1', 'b-admin');
insert into public.ratings (match_id, member_id, role, score) values ('MA', 'a-admin', 'f', 7), ('MA', 'a-member', 'f', 5), ('MB', 'b-admin', 'f', 7);
insert into public.rating_parts (match_id, member_id, parts) values ('MA', 'a-admin', '[]'), ('MA', 'a-member', '[]'), ('MB', 'b-admin', '[]');
insert into public.ovr_history (member_id, role, round_id, delta, value) values ('a-member', 'f', 'RA', 1, 90), ('b-admin', 'f', 'RB', 0, 96);
insert into public.ovr_published (member_id, role, snapshot) values ('a-member', 'f', '{"ovr": 89}'), ('b-admin', 'f', '{"ovr": 96}');

-- ---------------------------------------------------------------- schema-wide guarantees
select is((select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0, 'every public table has RLS enabled');
select is_empty($$ select table_name from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' $$,
  'anonymous has no privilege on any public table or view');
select is_empty($$
  select table_name || '.' || column_name from information_schema.columns
  where table_schema = 'public' and column_name in ('stars', 'cards', 'balance', 'phone', 'parts', 'attr', 'round_stars')
    and table_name not in ('member_secrets', 'rating_parts', 'my_balances')
$$, 'secret columns live only in the admin-only tables');

-- ---------------------------------------------------------------- anonymous
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select * from public.leagues', '42501', null, 'anon: cannot read leagues');
select throws_ok('select * from public.league_members', '42501', null, 'anon: cannot read rosters');
select throws_ok('select * from public.member_secrets', '42501', null, 'anon: cannot read secrets');
select throws_ok('select * from public.rating_parts', '42501', null, 'anon: cannot read rating breakdowns');
select throws_ok('select * from public.events', '42501', null, 'anon: cannot read events');
select throws_ok('select * from public.my_balances', '42501', null, 'anon: cannot read balances');
select throws_ok($$ insert into public.leagues (name) values ('x') $$, '42501', null, 'anon: cannot create a league');
reset role;

-- ---------------------------------------------------------------- regular member of A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);
select results_eq('select id from public.leagues', $$ values ('LA') $$, 'member: sees only their league');
select is((select count(*)::int from public.league_members), 3, 'member: sees the roster of their league only');
select is_empty('select * from public.member_secrets', 'member: no secret rows at all (stars, cards, balance, phone)');
select is_empty('select * from public.rating_parts', 'member: no rating breakdowns');
select is_empty('select * from public.ovr_history', 'member: no unpublished OVR');
select results_eq('select member_id, balance from public.my_balances', $$ values ('a-member'::text, -40::numeric(10,2)) $$, 'member: reads only their own balance');
select results_eq('select member_id from public.ratings order by member_id', $$ values ('a-admin'::text), ('a-member') $$, 'member: reads match ratings of their league');
select results_eq('select id from public.events', $$ values ('EA'::text) $$, 'member: reads events of their league only');
select results_eq('select member_id from public.ovr_published', $$ values ('a-member'::text) $$, 'member: reads published OVR of their league only');
select is_empty($$ select * from public.rounds where league_id = 'LB' $$, 'member: no rounds of another league');
select throws_ok($$ insert into public.events (id, match_id, type, team) values ('E-m', 'MA', 'goal', 'TA2') $$, '42501', null, 'member: cannot record events');
select throws_ok($$ insert into public.member_secrets (member_id, league_id, stars) values ('a-plain', 'LA', 5) $$, '42501', null, 'member: cannot write secrets');
select throws_ok($$ insert into public.league_members (id, league_id, name) values ('x', 'LA', 'x') $$, '42501', null, 'member: cannot add players');
update public.league_members set role = 'admin' where id = 'a-member';
update public.leagues set name = 'hacked' where id = 'LA';
update public.ratings set score = 10 where member_id = 'a-member';
select is((select count(*)::int from public.profiles), 2, 'member: sees own profile and league mates only');
reset role;
select is((select role from public.league_members where id = 'a-member'), 'player', 'member: cannot make themselves admin');
select is((select name from public.leagues where id = 'LA'), 'League A', 'member: cannot rename the league');
select is((select score from public.ratings where member_id = 'a-member'), 5.0, 'member: cannot change ratings');

-- ---------------------------------------------------------------- admin of A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);
select results_eq('select id from public.leagues', $$ values ('LA') $$, 'admin A: sees only league A');
select is((select count(*)::int from public.member_secrets), 3, 'admin A: reads the secrets of league A');
select is_empty($$ select * from public.member_secrets where league_id = 'LB' $$, 'admin A: no secrets of league B');
select is((select count(*)::int from public.rating_parts), 2, 'admin A: reads rating breakdowns of league A only');
select is((select count(*)::int from public.ovr_history), 1, 'admin A: reads unpublished OVR of league A only');
select lives_ok($$ insert into public.events (id, match_id, type, team, player) values ('E-a', 'MA', 'save', 'TA1', 'a-admin') $$, 'admin A: records events in league A');
select lives_ok($$ insert into public.events (id, match_id, type, team, player) values ('E-a', 'MA', 'save', 'TA1', 'a-admin') on conflict (id) do nothing $$, 'admin A: re-sending the same event is a no-op (idempotent)');
select lives_ok($$ update public.member_secrets set stars = 4.5 where member_id = 'a-plain' $$, 'admin A: edits stars in league A');
select throws_ok($$ insert into public.events (id, match_id, type, team) values ('E-x', 'MB', 'goal', 'TB1') $$, '42501', null, 'admin A: cannot record events in league B');
select throws_ok($$ insert into public.member_secrets (member_id, league_id, stars) values ('b-plain', 'LA', 5) $$, 'P0001', null, 'admin A: cannot attach a league B player''s secrets to league A');
select throws_ok($$ insert into public.team_players (team_id, member_id) values ('TA1', 'b-plain') $$, 'P0001', null, 'admin A: cannot put a league B player in a league A team');
select throws_ok($$ insert into public.rounds (league_id, season, number) values ('LB', 's1', 9) $$, '42501', null, 'admin A: cannot create rounds in league B');
select throws_ok($$ update public.rounds set league_id = 'LB' where id = 'RA' $$, null, null, 'admin A: cannot move a round to league B');
update public.leagues set name = 'hacked' where id = 'LB';
update public.member_secrets set stars = 0.5 where member_id = 'b-plain';
delete from public.league_members where id = 'b-plain';
delete from public.events where id = 'EB';
select is_empty($$ select * from public.profiles where id = '00000000-0000-0000-0000-00000000000c' $$, 'admin A: cannot see league B people''s profiles');
reset role;
select is((select name from public.leagues where id = 'LB'), 'League B', 'admin A: cannot rename league B');
select is((select stars from public.member_secrets where member_id = 'b-plain'), 1.0, 'admin A: cannot change league B stars');
select isnt_empty($$ select * from public.league_members where id = 'b-plain' $$, 'admin A: cannot delete league B players');
select isnt_empty($$ select * from public.events where id = 'EB' $$, 'admin A: cannot delete league B events');
select is((select stars from public.member_secrets where member_id = 'a-plain'), 4.5, 'admin A: the league A edit went through');

-- ---------------------------------------------------------------- admin of B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);
select results_eq('select id from public.leagues', $$ values ('LB') $$, 'admin B: sees only league B');
select is_empty($$ select * from public.member_secrets where league_id = 'LA' $$, 'admin B: no secrets of league A');
select is_empty($$ select * from public.rating_parts where match_id = 'MA' $$, 'admin B: no rating breakdowns of league A');
select is_empty($$ select * from public.events where match_id = 'MA' $$, 'admin B: no events of league A');
select throws_ok($$ insert into public.ratings (match_id, member_id, role, score) values ('MA', 'a-plain', 'f', 9) $$, '42501', null, 'admin B: cannot write league A ratings');
update public.member_secrets set balance = 0 where member_id = 'a-member';
reset role;
select is((select balance from public.member_secrets where member_id = 'a-member'), -40.00, 'admin B: cannot change league A balances');

-- ---------------------------------------------------------------- signed-in outsider
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}', true);
select is_empty('select * from public.leagues', 'outsider: sees no league');
select is_empty('select * from public.league_members', 'outsider: sees no roster');
select is_empty('select * from public.my_balances', 'outsider: has no balance');
reset role;

-- ---------------------------------------------------------------- phone signup links the roster entry
insert into public.league_members (id, league_id, name) values ('a-new', 'LA', 'New Player');
insert into public.member_secrets (member_id, league_id, phone) values ('a-new', 'LA', '972555555555');
insert into auth.users (id, aud, role, phone) values ('00000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', '972555555555');
select is((select profile_id from public.league_members where id = 'a-new'), '00000000-0000-0000-0000-00000000000e'::uuid, 'signup: the roster entry with that phone is linked to the new account');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000e'), 'New Player', 'signup: the profile takes the roster name');

select * from finish();
rollback;
