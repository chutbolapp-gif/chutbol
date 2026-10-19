// Database rows (supabase/migrations) and how they turn back into the prototype shapes the
// scoring reads (Round, League, RatingsDoc). Used by the app (rows from Supabase) and by the
// import script's round-trip test. Pure: no Supabase client here.
import type {
  Id, KnockoutFixture, League, LineupSide, ManualAttr, Match, MatchEvent, PlayerCard, RatingsDoc, Role, Round, Team,
} from './index';

/** Timestamps come back from Postgres as ISO strings. */
type Ts = string;

export interface LeagueRow {
  id: Id; name: string; kind: 'pitch' | 'gaming'; crest: unknown; season: string | null;
  settings: Record<string, unknown>; bylaws: string | null; created_at: Ts;
}
export interface MemberRow {
  id: Id; league_id: Id; profile_id: string | null; name: string; role: 'admin' | 'assistant' | 'player';
  core: boolean; gk: boolean; guest: boolean; frozen: boolean; freeze_reason: string | null; frozen_since: Ts | null;
}
/** 🔒 admin only */
export interface MemberSecretRow {
  member_id: Id; league_id: Id; stars: number | null; cards: PlayerCard[];
  attr: Partial<Record<Role, ManualAttr>>;
  round_stars: Record<Id, number>; balance: number; phone: string | null;
}
export interface RoundRow {
  id: Id; league_id: Id; season: string; number: number; status: string; format: string | null; voided: boolean;
  manual_order: Id[]; ko_rank: Id[]; next_pair: Id[]; next_gk: Record<Id, Id>;
  fee: number | null; game_day: string | null; game_time: string | null; venue: string | null;
  extra: Record<string, unknown>; created_at: Ts;
}
export interface TeamRow { id: Id; round_id: Id; name: string; color: string; gk: Id | null; gk_order: Id[] | null; sort: number }
export interface TeamPlayerRow { team_id: Id; member_id: Id; sort: number }
export interface MatchRow {
  id: Id; round_id: Id; n: number; home: Id; away: Id; dur: number; status: string;
  started_at: Ts | null; ended_at: Ts | null; timer_acc_ms: number | null; pitch: number | null;
  lineups: Record<Id, LineupSide> | null; gk0: Record<Id, Id | null> | null; str: Record<Id, number> | null;
  ko_winner: Id | null; video: Record<string, unknown> | null;
}
export interface FixtureRow {
  id: Id; round_id: Id; home: Id | null; away: Id | null; stage: string | null; ko_stage: number | null;
  match_id: Id | null; done: boolean; winner: Id | null;
}
export interface EventRow {
  id: Id; match_id: Id; type: string; team: Id; player: Id | null; assist: Id | null; gk_against: Id | null;
  sub_in: Id | null; sub_out: Id | null; prev: Id | null; res: string | null; pen: boolean | null;
  card: string | null; second: boolean | null; minute: number | null; device_at: Ts | null; seq: number;
  extra: Record<string, unknown>;
}
export interface RatingRow { match_id: Id; member_id: Id; role: 'f' | 'g'; score: number }
/** 🔒 admin only */
export interface RatingPartsRow { match_id: Id; member_id: Id; parts: unknown }

const ms = (t: Ts | null | undefined): number | undefined => (t == null ? undefined : Date.parse(t));
/** Postgres numeric can arrive as a string from some clients. */
const num = (v: unknown): number => (typeof v === 'string' ? Number(v) : (v as number));

/** Event order inside a match: device time of the recording phone, then recording order. */
export function compareEvents(a: EventRow, b: EventRow): number {
  const x = ms(a.device_at), y = ms(b.device_at);
  if (x !== y) { if (x === undefined) return -1; if (y === undefined) return 1; return x - y; }
  return a.seq - b.seq;
}

export function eventFromRow(e: EventRow): MatchEvent {
  const out: MatchEvent = { id: e.id, type: e.type, team: e.team };
  if (e.player != null) out.p = e.player;
  if (e.assist != null) out.a = e.assist;
  if (e.gk_against != null) out.gka = e.gk_against;
  if (e.sub_in != null) out.in = e.sub_in;
  if (e.sub_out != null) out.out = e.sub_out;
  if (e.prev != null) out.prev = e.prev;
  if (e.res != null) out.res = e.res;
  if (e.pen != null) out.pen = e.pen;
  if (e.card != null) out.c = e.card;
  if (e.second != null) out.second = e.second;
  if (e.minute != null) out.min = e.minute;
  const at = ms(e.device_at);
  if (at !== undefined) out.at = at;
  return out;
}

export interface RoundRows {
  round: RoundRow;
  teams: TeamRow[];
  teamPlayers: TeamPlayerRow[];
  matches: MatchRow[];
  events: EventRow[];
  ratings: RatingRow[];
  fixtures?: FixtureRow[];
}

/** One round, as the scoring reads it (with the stored match ratings). */
export function roundFromRows({ round: r, teams, teamPlayers, matches, events, ratings, fixtures }: RoundRows): Round {
  const teamList: Team[] = teams.slice().sort((a, b) => a.sort - b.sort).map(t => ({
    id: t.id, name: t.name, color: t.color, gk: t.gk,
    players: teamPlayers.filter(p => p.team_id === t.id).sort((a, b) => a.sort - b.sort).map(p => p.member_id),
  }));
  const gkOrder: Record<Id, Id[]> = {};
  teams.forEach(t => { if (t.gk_order) gkOrder[t.id] = t.gk_order; });
  const matchList: Match[] = matches.slice().sort((a, b) => a.n - b.n).map(m => {
    const out: Match = { id: m.id, n: m.n, home: m.home, away: m.away, dur: m.dur, status: m.status };
    const s = ms(m.started_at), e = ms(m.ended_at);
    if (s !== undefined) out.startedAt = s;
    if (e !== undefined) out.endedAt = e;
    if (m.timer_acc_ms != null) out.timer = { acc: m.timer_acc_ms, run: m.status === 'live' };
    if (m.lineups) out.lu = m.lineups;
    if (m.gk0) out.gk0 = m.gk0;
    if (m.str) out.str = m.str;
    if (m.ko_winner) out.koWinner = m.ko_winner;
    out.events = events.filter(x => x.match_id === m.id).sort(compareEvents).map(eventFromRow);
    const rs = ratings.filter(x => x.match_id === m.id);
    if (rs.length) out.ratings = Object.fromEntries(rs.map(x => [x.member_id, num(x.score)]));
    return out;
  });
  const round: Round = {
    id: r.id, leagueId: r.league_id, number: r.number, season: r.season, created: Date.parse(r.created_at),
    status: r.status, voided: r.voided, teams: teamList, matches: matchList,
    manualOrder: r.manual_order, nextPair: r.next_pair, nextGk: r.next_gk,
  };
  if (r.ko_rank.length) round.koRank = r.ko_rank;
  if (r.format) round.format = r.format;
  if (Object.keys(gkOrder).length) round.gkOrder = gkOrder;
  if (fixtures && fixtures.length) {
    round.fixtures = fixtures.map((f): KnockoutFixture => ({
      id: f.id, home: f.home ?? '', away: f.away, stage: f.stage ?? '', done: f.done,
      ...(f.ko_stage != null ? { ko: f.ko_stage } : {}), ...(f.winner != null ? { winner: f.winner } : {}), ...(f.match_id != null ? { mid: f.match_id } : {}),
    }));
  }
  return round;
}

/**
 * The league as the scoring reads it. Cards are secret: pass `secrets` only when the caller is an
 * admin (RLS returns no rows to anyone else anyway).
 */
export function leagueFromRows(l: LeagueRow, members: MemberRow[], secrets: MemberSecretRow[] = []): League {
  return {
    id: l.id, name: l.name, season: l.season ?? '', settings: l.settings,
    players: members.map(m => {
      const s = secrets.find(x => x.member_id === m.id);
      return s && s.cards.length ? { id: m.id, name: m.name, cards: s.cards } : { id: m.id, name: m.name };
    }),
  };
}

/** 🔒 The league's ratings doc (stars, per-round stars, manual stats), rebuilt from member_secrets. */
export function ratingsDocFromSecrets(leagueId: Id, secrets: MemberSecretRow[]): RatingsDoc {
  const doc: RatingsDoc = { id: leagueId, r: {}, rounds: {}, attr: {} };
  for (const s of secrets) {
    if (s.stars != null) doc.r[s.member_id] = num(s.stars);
    for (const [rid, v] of Object.entries(s.round_stars || {})) (doc.rounds![rid] ??= {})[s.member_id] = num(v);
    if (s.attr && Object.keys(s.attr).length) doc.attr![s.member_id] = s.attr;
  }
  return doc;
}
