-- The prototype import (supabase/seed.sql, from scripts/import-prototype) landed completely.
-- Runs after `supabase db reset`, which applies the seed. The numbers are those of docs/prototype/data.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select is((select count(*)::int from public.leagues), 2, 'two leagues');
select is((select count(*)::int from public.league_members where league_id = '27yhw7ktexr'), 38, 'league A roster: 38 players');
select is((select count(*)::int from public.league_members where league_id = 'v2qbymr09us'), 20, 'league B roster: 20 players');
select is((select count(*)::int from public.member_secrets), 58, 'every player has a secrets row');
select is((select count(*)::int from public.rounds), 5, 'five rounds');
select is((select count(*)::int from public.matches m join public.rounds r on r.id = m.round_id where r.league_id = '27yhw7ktexr' and r.number = 6), 15, 'round 6 has 15 matches');
select is((select count(*)::int from public.events), 47, '47 match events');
select is((select count(*)::int from public.teams), 14, '14 teams');
select is((select count(*)::int from public.rating_parts), (select count(*)::int from public.ratings), 'every stored rating has its (admin-only) breakdown');
select is_empty($$
  select m.id from public.matches m where m.status = 'done' and m.lineups is not null
  and not exists (select 1 from public.ratings r where r.match_id = m.id)
$$, 'every finished match with a lineup has ratings');
select is((select count(*)::int from public.member_secrets where phone is not null), 3, 'three dev test phones');
select is((select role from public.league_members where id = '2i29lvdtl7t'), 'admin', 'test phone 1 is the admin of league A');
select is((select round_offset from public.seasons where league_id = '27yhw7ktexr' and name = 'עונה 26/27'), 5, 'league A season offset (rounds before the app)');

select * from finish();
rollback;
