-- Chutbol core schema (stage 1a).
-- Hierarchy: league -> season -> round (evening) -> match -> event. See docs/spec.md "מבנה הנתונים"
-- and docs/scoring-data-needs.md for what the scoring reads.
--
-- Ids are text. Rows imported from the prototype keep the prototype's ids (unique strings);
-- new rows get a UUID. Live-match events get a UUID generated on the phone.
--
-- Secrets (CLAUDE.md "Data rules"): RLS filters rows, not columns, so every secret lives in its
-- own admin-only table: member_secrets (stars, cards, manual OVR stats, balance, phone),
-- rating_parts (match-rating breakdowns), ovr_history (unpublished OVR). Members read everything
-- else of their own league. Writes: league staff (admin, assistant); roster and secrets: admin only.

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  photo_url text,
  lang text not null default 'he' check (lang in ('he', 'en')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One account per person (phone login). The phone number itself stays in auth.users.';

create table public.leagues (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  kind text not null default 'pitch' check (kind in ('pitch', 'gaming')),
  -- one of the ready-made symbols, or an uploaded image: {"kind": ..., ...}
  crest jsonb,
  season text,
  settings jsonb not null default '{}',
  bylaws text,
  created_at timestamptz not null default now()
);

create table public.league_members (
  id text primary key default gen_random_uuid()::text,
  league_id text not null references public.leagues (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  role text not null default 'player' check (role in ('admin', 'assistant', 'player')),
  core boolean not null default false,
  gk boolean not null default false,
  guest boolean not null default false,
  frozen boolean not null default false,
  freeze_reason text,
  frozen_since timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, profile_id)
);
create index on public.league_members (profile_id);
create index on public.league_members (league_id);
comment on table public.league_members is 'A player in a league roster. profile_id links the roster entry to an account (null until the player logs in).';

-- 🔒 admin only
create table public.member_secrets (
  member_id text primary key references public.league_members (id) on delete cascade,
  league_id text not null references public.leagues (id) on delete cascade,
  stars numeric(2, 1) check (stars between 0 and 5),
  cards text[] not null default '{}' check (cards <@ array['att', 'def', 'fit']),
  -- manual OVR stats per role: {"f": {"pace": 80, ...}, "g": {...}}
  attr jsonb not null default '{}',
  -- per-round star overrides: {"<roundId>": 3.5}
  round_stars jsonb not null default '{}',
  balance numeric(10, 2) not null default 0,
  -- E.164 without "+", like auth.users.phone (e.g. 972501234567)
  phone text check (phone ~ '^[0-9]{8,15}$'),
  updated_at timestamptz not null default now()
);
create index on public.member_secrets (league_id);
create index on public.member_secrets (phone);
comment on table public.member_secrets is 'SECRET (admin only): stars, cards, manual OVR stats, balance, phone. A player reads only their own balance, through my_balances.';

create table public.seasons (
  id text primary key default gen_random_uuid()::text,
  league_id text not null references public.leagues (id) on delete cascade,
  name text not null,
  -- rounds played before the app (numbering only)
  round_offset int not null default 0,
  -- final results once the season is closed: champion, runner-up, kings, MVPs
  done jsonb,
  unique (league_id, name)
);

create table public.rounds (
  id text primary key default gen_random_uuid()::text,
  league_id text not null references public.leagues (id) on delete cascade,
  season text not null,
  number int not null,
  status text not null default 'setup' check (status in ('setup', 'live', 'done')),
  format text,
  voided boolean not null default false,
  manual_order text[] not null default '{}',
  ko_rank text[] not null default '{}',
  next_pair text[] not null default '{}',
  next_gk jsonb not null default '{}',
  fee numeric(10, 2),
  game_day text,
  game_time text,
  venue text,
  -- prototype fields not used by scoring yet (queue, streak, duties ...)
  extra jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.rounds (league_id, created_at);

create table public.round_players (
  round_id text not null references public.rounds (id) on delete cascade,
  member_id text not null references public.league_members (id) on delete cascade,
  status text not null default 'in' check (status in ('in', 'wait', 'no')),
  wait_rank int,
  paid boolean not null default false,
  paid_at timestamptz,
  paid_amount numeric(10, 2),
  duties text[] not null default '{}',
  primary key (round_id, member_id)
);

create table public.teams (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references public.rounds (id) on delete cascade,
  name text not null,
  color text not null,
  gk text,
  gk_order text[],
  sort int not null default 0
);
create index on public.teams (round_id);

create table public.team_players (
  team_id text not null references public.teams (id) on delete cascade,
  member_id text not null references public.league_members (id) on delete cascade,
  sort int not null default 0,
  primary key (team_id, member_id)
);

create table public.matches (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references public.rounds (id) on delete cascade,
  n int not null,
  home text not null references public.teams (id) on delete cascade,
  away text not null references public.teams (id) on delete cascade,
  dur int not null default 7,
  status text not null default 'setup' check (status in ('setup', 'live', 'done')),
  started_at timestamptz,
  ended_at timestamptz,
  timer_acc_ms int,
  pitch int,
  -- kick-off lineups: {"<teamId>": {"gk": "<memberId>", "on": ["<memberId>", ...]}}
  lineups jsonb,
  -- keeper at kick-off per team
  gk0 jsonb,
  -- team strength at kick-off, stored with the ratings and never recomputed
  str jsonb,
  ko_winner text,
  video jsonb,
  -- the phone that owns the live match (stage 1c)
  lock_owner uuid,
  unique (round_id, n)
);

create table public.fixtures (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references public.rounds (id) on delete cascade,
  home text,
  away text,
  stage text,
  ko_stage int,
  match_id text references public.matches (id) on delete set null,
  done boolean not null default false,
  winner text
);

create table public.events (
  -- generated on the recording phone; inserts are idempotent (upsert on id)
  id text primary key,
  match_id text not null references public.matches (id) on delete cascade,
  type text not null,
  team text not null,
  player text,
  assist text,
  gk_against text,
  sub_in text,
  sub_out text,
  prev text,
  res text,
  pen boolean,
  card text,
  second boolean,
  minute int,
  -- device time of the recording phone; orders the events of a match
  device_at timestamptz,
  received_at timestamptz not null default now(),
  -- order of recording within the match (tie-break after device_at)
  seq int not null default 0,
  extra jsonb not null default '{}',
  created_by uuid default auth.uid()
);
create index on public.events (match_id, device_at, seq);

-- match ratings (4-10), public to the league
create table public.ratings (
  match_id text not null references public.matches (id) on delete cascade,
  member_id text not null references public.league_members (id) on delete cascade,
  role text not null check (role in ('f', 'g')),
  score numeric(3, 1) not null check (score between 4 and 10),
  primary key (match_id, member_id)
);

-- 🔒 admin only: how each match rating was computed (i18n keys + params)
create table public.rating_parts (
  match_id text not null references public.matches (id) on delete cascade,
  member_id text not null references public.league_members (id) on delete cascade,
  parts jsonb not null,
  primary key (match_id, member_id)
);
comment on table public.rating_parts is 'SECRET (admin only): match-rating breakdowns.';

-- 🔒 admin only: OVR after each round (unpublished until the admin publishes)
create table public.ovr_history (
  member_id text not null references public.league_members (id) on delete cascade,
  role text not null check (role in ('f', 'g')),
  round_id text not null references public.rounds (id) on delete cascade,
  delta int not null,
  value int not null,
  detail jsonb,
  primary key (member_id, role, round_id)
);
comment on table public.ovr_history is 'SECRET (admin only): unpublished OVR.';

-- what members see: the OVR card as the admin published it
create table public.ovr_published (
  member_id text not null references public.league_members (id) on delete cascade,
  role text not null check (role in ('f', 'g')),
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  primary key (member_id, role)
);

create table public.goal_votes (
  round_id text not null references public.rounds (id) on delete cascade,
  voter text not null references public.league_members (id) on delete cascade,
  picks text[] not null check (cardinality(picks) <= 3),
  primary key (round_id, voter)
);

create table public.clips (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references public.rounds (id) on delete cascade,
  match_id text references public.matches (id) on delete cascade,
  member_id text references public.league_members (id) on delete set null,
  kind text not null,
  label text,
  url text not null,
  timeline jsonb
);

-- manual season corrections (rounds and titles from before the app, extra goals ...)
create table public.adjustments (
  league_id text not null references public.leagues (id) on delete cascade,
  season text not null,
  member_id text not null references public.league_members (id) on delete cascade,
  rounds int not null default 0,
  titles int not null default 0,
  seconds int not null default 0,
  goals int not null default 0,
  assists int not null default 0,
  bonus numeric not null default 0,
  primary key (league_id, season, member_id)
);

-- ---------------------------------------------------------------- access helpers
-- security definer: they read league_members etc. without going through RLS (no recursion).

create function public.my_role(lid text) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.league_members m
  where m.league_id = lid and m.profile_id = auth.uid() and m.profile_id is not null
  limit 1
$$;

create function public.is_member(lid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_role(lid) is not null
$$;

create function public.is_staff(lid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(lid) in ('admin', 'assistant'), false)
$$;

create function public.is_admin(lid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(lid) = 'admin', false)
$$;

create function public.round_league(rid text) returns text
language sql stable security definer set search_path = '' as $$
  select league_id from public.rounds where id = rid
$$;

create function public.team_league(tid text) returns text
language sql stable security definer set search_path = '' as $$
  select r.league_id from public.teams t join public.rounds r on r.id = t.round_id where t.id = tid
$$;

create function public.match_league(mid text) returns text
language sql stable security definer set search_path = '' as $$
  select r.league_id from public.matches m join public.rounds r on r.id = m.round_id where m.id = mid
$$;

create function public.member_league(mid text) returns text
language sql stable security definer set search_path = '' as $$
  select league_id from public.league_members where id = mid
$$;

-- ---------------------------------------------------------------- integrity guards

-- a child row must point at parents of the same league (stops cross-league links)
create function public.check_same_league() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lid text; other text;
begin
  if tg_table_name = 'member_secrets' then
    if public.member_league(new.member_id) is distinct from new.league_id then
      raise exception 'member_secrets.league_id must match the member''s league';
    end if;
  elsif tg_table_name = 'team_players' then
    if public.team_league(new.team_id) is distinct from public.member_league(new.member_id) then
      raise exception 'team player must belong to the round''s league';
    end if;
  elsif tg_table_name = 'round_players' then
    if public.round_league(new.round_id) is distinct from public.member_league(new.member_id) then
      raise exception 'round player must belong to the round''s league';
    end if;
  elsif tg_table_name = 'matches' then
    lid := public.round_league(new.round_id);
    if public.team_league(new.home) is distinct from lid or public.team_league(new.away) is distinct from lid then
      raise exception 'match teams must belong to the round';
    end if;
  elsif tg_table_name in ('ratings', 'rating_parts') then
    if public.match_league(new.match_id) is distinct from public.member_league(new.member_id) then
      raise exception 'rated player must belong to the match''s league';
    end if;
  elsif tg_table_name in ('ovr_history') then
    if public.round_league(new.round_id) is distinct from public.member_league(new.member_id) then
      raise exception 'ovr_history round and member must be in the same league';
    end if;
  elsif tg_table_name = 'adjustments' then
    if public.member_league(new.member_id) is distinct from new.league_id then
      raise exception 'adjustment member must belong to the league';
    end if;
  elsif tg_table_name = 'goal_votes' then
    if public.round_league(new.round_id) is distinct from public.member_league(new.voter) then
      raise exception 'voter must belong to the round''s league';
    end if;
  end if;
  return new;
end $$;

create trigger same_league before insert or update on public.member_secrets for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.team_players for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.round_players for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.matches for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.ratings for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.rating_parts for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.ovr_history for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.adjustments for each row execute function public.check_same_league();
create trigger same_league before insert or update on public.goal_votes for each row execute function public.check_same_league();

-- a league's id never moves to another league (child rows are keyed by it)
create function public.freeze_league_id() returns trigger
language plpgsql as $$
begin
  if new.league_id is distinct from old.league_id then raise exception 'league_id cannot change'; end if;
  return new;
end $$;
create trigger freeze_league_id before update on public.league_members for each row execute function public.freeze_league_id();
create trigger freeze_league_id before update on public.rounds for each row execute function public.freeze_league_id();

-- whoever creates a league becomes its admin
create function public.add_league_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.league_members (league_id, profile_id, name, role)
    select new.id, p.id, coalesce(nullif(p.name, ''), 'Admin'), 'admin' from public.profiles p where p.id = auth.uid();
  end if;
  return new;
end $$;
create trigger add_league_creator after insert on public.leagues for each row execute function public.add_league_creator();

-- ---------------------------------------------------------------- new accounts
-- On phone signup: create the profile, and link every roster entry whose secret phone matches.

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (new.id, '') on conflict (id) do nothing;
  if new.phone is not null and new.phone <> '' then
    update public.league_members m set profile_id = new.id
    from public.member_secrets s
    where s.member_id = m.id and s.phone = new.phone and m.profile_id is null
      and not exists (select 1 from public.league_members x where x.league_id = m.league_id and x.profile_id = new.id);
    update public.profiles p set name = m.name
    from public.league_members m
    where p.id = new.id and p.name = '' and m.profile_id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- own balance (spec: "view שמחזיר רק balance")

create view public.my_balances as
  select s.member_id, s.league_id, s.balance
  from public.member_secrets s
  join public.league_members m on m.id = s.member_id
  where m.profile_id = auth.uid();
comment on view public.my_balances is 'A player''s own balance in each league. Runs as the view owner, so it bypasses member_secrets RLS, but only ever returns the caller''s own rows and only the balance column.';
revoke all on public.my_balances from anon;
grant select on public.my_balances to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.member_secrets enable row level security;
alter table public.seasons enable row level security;
alter table public.rounds enable row level security;
alter table public.round_players enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.matches enable row level security;
alter table public.fixtures enable row level security;
alter table public.events enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_parts enable row level security;
alter table public.ovr_history enable row level security;
alter table public.ovr_published enable row level security;
alter table public.goal_votes enable row level security;
alter table public.clips enable row level security;
alter table public.adjustments enable row level security;

-- anonymous visitors get nothing
revoke all on all tables in schema public from anon;

-- profiles: your own, and people who share a league with you
create policy "profiles: read own and league mates" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.league_members a join public.league_members b on a.league_id = b.league_id
    where a.profile_id = auth.uid() and b.profile_id = profiles.id));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- leagues
create policy "leagues: members read" on public.leagues for select to authenticated using (public.is_member(id));
create policy "leagues: anyone signed in creates" on public.leagues for insert to authenticated with check (true);
create policy "leagues: admin updates" on public.leagues for update to authenticated using (public.is_admin(id)) with check (public.is_admin(id));
create policy "leagues: admin deletes" on public.leagues for delete to authenticated using (public.is_admin(id));

-- roster: members read, admin writes
create policy "members: read" on public.league_members for select to authenticated using (public.is_member(league_id));
create policy "members: admin inserts" on public.league_members for insert to authenticated with check (public.is_admin(league_id));
create policy "members: admin updates" on public.league_members for update to authenticated using (public.is_admin(league_id)) with check (public.is_admin(league_id));
create policy "members: admin deletes" on public.league_members for delete to authenticated using (public.is_admin(league_id));

-- 🔒 secrets: admin only, every operation
create policy "secrets: admin only" on public.member_secrets for all to authenticated
  using (public.is_admin(league_id)) with check (public.is_admin(league_id));
create policy "rating_parts: admin only" on public.rating_parts for all to authenticated
  using (public.is_admin(public.match_league(match_id))) with check (public.is_admin(public.match_league(match_id)));
create policy "ovr_history: admin only" on public.ovr_history for all to authenticated
  using (public.is_admin(public.round_league(round_id))) with check (public.is_admin(public.round_league(round_id)));

-- league-level tables: members read, staff write
create policy "seasons: read" on public.seasons for select to authenticated using (public.is_member(league_id));
create policy "seasons: staff write" on public.seasons for all to authenticated using (public.is_staff(league_id)) with check (public.is_staff(league_id));

create policy "rounds: read" on public.rounds for select to authenticated using (public.is_member(league_id));
create policy "rounds: staff write" on public.rounds for all to authenticated using (public.is_staff(league_id)) with check (public.is_staff(league_id));

create policy "adjustments: read" on public.adjustments for select to authenticated using (public.is_member(league_id));
create policy "adjustments: admin write" on public.adjustments for all to authenticated using (public.is_admin(league_id)) with check (public.is_admin(league_id));

-- round-level tables
create policy "round_players: read" on public.round_players for select to authenticated using (public.is_member(public.round_league(round_id)));
create policy "round_players: staff write" on public.round_players for all to authenticated
  using (public.is_staff(public.round_league(round_id))) with check (public.is_staff(public.round_league(round_id)));

create policy "teams: read" on public.teams for select to authenticated using (public.is_member(public.round_league(round_id)));
create policy "teams: staff write" on public.teams for all to authenticated
  using (public.is_staff(public.round_league(round_id))) with check (public.is_staff(public.round_league(round_id)));

create policy "team_players: read" on public.team_players for select to authenticated using (public.is_member(public.team_league(team_id)));
create policy "team_players: staff write" on public.team_players for all to authenticated
  using (public.is_staff(public.team_league(team_id))) with check (public.is_staff(public.team_league(team_id)));

create policy "matches: read" on public.matches for select to authenticated using (public.is_member(public.round_league(round_id)));
create policy "matches: staff write" on public.matches for all to authenticated
  using (public.is_staff(public.round_league(round_id))) with check (public.is_staff(public.round_league(round_id)));

create policy "fixtures: read" on public.fixtures for select to authenticated using (public.is_member(public.round_league(round_id)));
create policy "fixtures: staff write" on public.fixtures for all to authenticated
  using (public.is_staff(public.round_league(round_id))) with check (public.is_staff(public.round_league(round_id)));

create policy "goal_votes: read" on public.goal_votes for select to authenticated using (public.is_member(public.round_league(round_id)));
create policy "goal_votes: staff write" on public.goal_votes for all to authenticated
  using (public.is_staff(public.round_league(round_id))) with check (public.is_staff(public.round_league(round_id)));

create policy "clips: read" on public.clips for select to authenticated using (public.is_member(public.round_league(round_id)));
create policy "clips: staff write" on public.clips for all to authenticated
  using (public.is_staff(public.round_league(round_id))) with check (public.is_staff(public.round_league(round_id)));

-- match-level tables
create policy "events: read" on public.events for select to authenticated using (public.is_member(public.match_league(match_id)));
create policy "events: staff write" on public.events for all to authenticated
  using (public.is_staff(public.match_league(match_id))) with check (public.is_staff(public.match_league(match_id)));

create policy "ratings: read" on public.ratings for select to authenticated using (public.is_member(public.match_league(match_id)));
create policy "ratings: staff write" on public.ratings for all to authenticated
  using (public.is_staff(public.match_league(match_id))) with check (public.is_staff(public.match_league(match_id)));

create policy "ovr_published: read" on public.ovr_published for select to authenticated using (public.is_member(public.member_league(member_id)));
create policy "ovr_published: admin write" on public.ovr_published for all to authenticated
  using (public.is_admin(public.member_league(member_id))) with check (public.is_admin(public.member_league(member_id)));

-- the access helpers are for policies; callers only learn about their own leagues
revoke execute on all functions in schema public from anon, public;
grant execute on function public.my_role(text), public.is_member(text), public.is_staff(text), public.is_admin(text),
  public.round_league(text), public.team_league(text), public.match_league(text), public.member_league(text) to authenticated;
