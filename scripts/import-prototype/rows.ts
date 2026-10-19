// Maps the prototype export (docs/prototype/data shape) to database rows (supabase/migrations).
// Pure: no I/O. Used by index.ts (writes supabase/seed.sql) and by the round-trip test.
//
// Match ratings follow the owner's policy: the current formula is the truth, so every round is
// "re-saved" (recomputeRatings) and the breakdown (rating_parts, admin only) comes from rateMatch.
import { matchGks, rateMatch, recomputeRatings } from '@chutbol/scoring';
import type {
  EventRow, FixtureRow, Id, League, LeagueRow, MatchRow, MemberRow, MemberSecretRow, PlayerCard, RatingPartsRow,
  RatingRow, RatingsDoc, Round, RoundRow, TeamPlayerRow, TeamRow,
} from '@chutbol/shared';

/** Prototype league fields the shared League type does not declare. */
export interface ProtoLeague extends League {
  created?: number;
  crest?: unknown;
  bylaws?: string;
  /** rounds before the app, per season */
  roundOffset?: Record<string, number> | number;
  balances?: Record<Id, number>;
  ovrPub?: Record<Id, Partial<Record<'f' | 'g', Record<string, unknown> & { at?: number }>>>;
  adjust?: Record<string, Record<Id, { rounds?: number; titles?: number; seconds?: number; goals?: number; assists?: number; bonus?: number }>>;
  seasonsDone?: Record<string, unknown>;
  players: (League['players'][number] & { core?: boolean; gk?: boolean; guest?: boolean; freeze?: { reason?: string; since?: number } })[];
}

/** Prototype round fields the shared Round type does not declare. */
export type ProtoRound = Round & Record<string, unknown> & {
  attendees?: Id[]; waitlist?: Id[]; declined?: Id[]; paid?: Record<Id, number>; paidAmt?: Record<Id, number>;
  duties?: Record<string, Id[]>; fee?: number; gameDay?: string; gameTime?: string; venue?: string;
  clips?: { id: Id; kind: string; label?: string; url: string; mid?: Id; pid?: Id }[];
};

export interface Dataset { leagues: ProtoLeague[]; rounds: ProtoRound[]; ratings: RatingsDoc[] }

/** Dev test accounts: fake phone numbers with a fixed OTP (supabase/config.toml [auth.sms.test_otp]). */
export interface TestUser { phone: string; leagueId: Id; memberId: Id; role: 'admin' | 'player' }

export interface Rows {
  leagues: LeagueRow[];
  members: MemberRow[];
  secrets: MemberSecretRow[];
  seasons: { id: Id; league_id: Id; name: string; round_offset: number; done: unknown }[];
  rounds: RoundRow[];
  roundPlayers: { round_id: Id; member_id: Id; status: 'in' | 'wait' | 'no'; wait_rank: number | null; paid: boolean; paid_at: string | null; paid_amount: number | null; duties: string[] }[];
  teams: TeamRow[];
  teamPlayers: TeamPlayerRow[];
  matches: MatchRow[];
  fixtures: FixtureRow[];
  events: EventRow[];
  ratings: RatingRow[];
  ratingParts: RatingPartsRow[];
  ovrPublished: { member_id: Id; role: 'f' | 'g'; snapshot: unknown; published_at: string }[];
  adjustments: { league_id: Id; season: string; member_id: Id; rounds: number; titles: number; seconds: number; goals: number; assists: number; bonus: number }[];
  clips: { id: Id; round_id: Id; match_id: Id | null; member_id: Id | null; kind: string; label: string | null; url: string; timeline: unknown }[];
}

const iso = (t: number | undefined | null): string | null => (t == null ? null : new Date(t).toISOString());

/** Round fields that have their own columns or tables; everything else goes to rounds.extra. */
const ROUND_COLUMNS = new Set([
  'id', 'leagueId', 'number', 'season', 'created', 'status', 'voided', 'format', 'manualOrder', 'koRank', 'nextPair', 'nextGk',
  'teams', 'matches', 'fixtures', 'gkOrder', 'attendees', 'waitlist', 'declined', 'paid', 'paidAmt', 'duties',
  'fee', 'gameDay', 'gameTime', 'venue', 'clips',
]);
const EVENT_COLUMNS = new Set(['id', 'type', 'team', 'p', 'a', 'gka', 'in', 'out', 'prev', 'res', 'pen', 'c', 'second', 'min', 'at']);

export function toRows(data: Dataset, testUsers: TestUser[] = []): Rows {
  const rows: Rows = {
    leagues: [], members: [], secrets: [], seasons: [], rounds: [], roundPlayers: [], teams: [], teamPlayers: [],
    matches: [], fixtures: [], events: [], ratings: [], ratingParts: [], ovrPublished: [], adjustments: [], clips: [],
  };
  const docOf = (lid: Id) => data.ratings.find(d => d.id === lid);

  for (const l of data.leagues) {
    rows.leagues.push({
      id: l.id, name: l.name, kind: 'pitch', crest: l.crest ?? null, season: l.season ?? null,
      settings: (l.settings ?? {}) as Record<string, unknown>, bylaws: l.bylaws ?? null,
      created_at: iso(l.created) ?? new Date(0).toISOString(),
    });
    const doc = docOf(l.id);
    for (const p of l.players) {
      const tu = testUsers.find(u => u.leagueId === l.id && u.memberId === p.id);
      rows.members.push({
        id: p.id, league_id: l.id, profile_id: null, name: p.name, role: tu?.role ?? 'player',
        core: !!p.core, gk: !!p.gk, guest: !!p.guest, frozen: !!p.freeze,
        freeze_reason: p.freeze?.reason ?? null, frozen_since: iso(p.freeze?.since),
      });
      const roundStars: Record<Id, number> = {};
      for (const [rid, m] of Object.entries(doc?.rounds ?? {})) if (typeof m[p.id] === 'number') roundStars[rid] = m[p.id]!;
      rows.secrets.push({
        member_id: p.id, league_id: l.id,
        stars: typeof doc?.r[p.id] === 'number' ? doc!.r[p.id]! : null,
        cards: (p.cards ?? []) as PlayerCard[],
        attr: (doc?.attr ?? {})[p.id] ?? {},
        round_stars: roundStars,
        balance: l.balances?.[p.id] ?? 0,
        phone: tu?.phone ?? null,
      });
    }
    for (const [pid, roles] of Object.entries(l.ovrPub ?? {})) {
      for (const role of ['f', 'g'] as const) {
        const snap = roles[role];
        if (snap) rows.ovrPublished.push({ member_id: pid, role, snapshot: snap, published_at: iso(snap.at) ?? new Date(0).toISOString() });
      }
    }
    for (const [season, byPlayer] of Object.entries(l.adjust ?? {})) {
      for (const [pid, a] of Object.entries(byPlayer)) {
        rows.adjustments.push({
          league_id: l.id, season, member_id: pid, rounds: a.rounds ?? 0, titles: a.titles ?? 0, seconds: a.seconds ?? 0,
          goals: a.goals ?? 0, assists: a.assists ?? 0, bonus: a.bonus ?? 0,
        });
      }
    }
    const seasonNames = new Set<string>([...(l.season ? [l.season] : []), ...data.rounds.filter(r => r.leagueId === l.id).map(r => r.season)]);
    Object.keys(l.seasonsDone ?? {}).forEach(s => seasonNames.add(s));
    for (const s of [...seasonNames].sort()) {
      const off = typeof l.roundOffset === 'object' ? l.roundOffset[s] ?? 0 : s === l.season ? l.roundOffset ?? 0 : 0;
      rows.seasons.push({ id: `${l.id}:${s}`, league_id: l.id, name: s, round_offset: off, done: (l.seasonsDone ?? {})[s] ?? null });
    }
  }

  for (const stored of data.rounds) {
    const doc = docOf(stored.leagueId);
    const r = recomputeRatings(stored, doc) as ProtoRound;
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(stored)) if (!ROUND_COLUMNS.has(k) && v !== undefined) extra[k] = v;
    rows.rounds.push({
      id: r.id, league_id: r.leagueId, season: r.season, number: r.number, status: r.status, format: r.format ?? null,
      voided: !!r.voided, manual_order: r.manualOrder ?? [], ko_rank: r.koRank ?? [], next_pair: r.nextPair ?? [],
      next_gk: r.nextGk ?? {}, fee: stored.fee ?? null, game_day: stored.gameDay ?? null, game_time: stored.gameTime ?? null,
      venue: stored.venue ?? null, extra, created_at: iso(r.created)!,
    });

    // attendance: in (attendees), wait (waitlist, in order), no (declined)
    const rp = new Map<Id, Rows['roundPlayers'][number]>();
    const put = (pid: Id, status: 'in' | 'wait' | 'no', rank: number | null) => {
      if (!rp.has(pid)) rp.set(pid, { round_id: r.id, member_id: pid, status, wait_rank: rank, paid: false, paid_at: null, paid_amount: null, duties: [] });
    };
    (stored.attendees ?? []).forEach(p => put(p, 'in', null));
    (stored.waitlist ?? []).forEach((p, i) => put(p, 'wait', i + 1));
    (stored.declined ?? []).forEach(p => put(p, 'no', null));
    for (const [pid, at] of Object.entries(stored.paid ?? {})) { put(pid, 'in', null); const x = rp.get(pid)!; x.paid = true; x.paid_at = iso(at); }
    for (const [pid, amt] of Object.entries(stored.paidAmt ?? {})) { put(pid, 'in', null); rp.get(pid)!.paid_amount = amt; }
    for (const [duty, pids] of Object.entries(stored.duties ?? {})) for (const pid of pids) { put(pid, 'in', null); rp.get(pid)!.duties.push(duty); }
    rows.roundPlayers.push(...rp.values());

    r.teams.forEach((t, i) => {
      rows.teams.push({ id: t.id, round_id: r.id, name: t.name, color: t.color, gk: t.gk ?? null, gk_order: r.gkOrder?.[t.id] ?? null, sort: i });
      t.players.forEach((p, j) => rows.teamPlayers.push({ team_id: t.id, member_id: p, sort: j }));
    });

    for (const m of r.matches) {
      const video: Record<string, unknown> = {};
      for (const k of ['vidUrl', 'vidOff', 'vidSplit', 'vidUrl2']) if ((m as unknown as Record<string, unknown>)[k] !== undefined) video[k] = (m as unknown as Record<string, unknown>)[k];
      rows.matches.push({
        id: m.id, round_id: r.id, n: m.n, home: m.home, away: m.away, dur: m.dur, status: m.status,
        started_at: iso(m.startedAt), ended_at: iso(m.endedAt), timer_acc_ms: m.timer?.acc ?? null, pitch: null,
        lineups: m.lu ?? null, gk0: m.gk0 ?? null, str: m.str ?? null, ko_winner: m.koWinner ?? null,
        video: Object.keys(video).length ? video : null,
      });
      (m.events ?? []).forEach((e, seq) => {
        const extra: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(e)) if (!EVENT_COLUMNS.has(k) && v !== undefined) extra[k] = v;
        rows.events.push({
          id: e.id ?? `${m.id}-${seq}`, match_id: m.id, type: e.type, team: e.team, player: e.p ?? null, assist: e.a ?? null,
          gk_against: e.gka ?? null, sub_in: e.in ?? null, sub_out: e.out ?? null, prev: e.prev ?? null, res: e.res ?? null,
          pen: e.pen ?? null, card: e.c ?? null, second: e.second ?? null, minute: e.min ?? null, device_at: iso(e.at), seq, extra,
        });
      });
      if (m.status === 'done' && m.lu) {
        const gks = matchGks(m);
        const x = rateMatch(r, m, doc);
        for (const [pid, score] of Object.entries(m.ratings ?? {})) {
          rows.ratings.push({ match_id: m.id, member_id: pid, role: gks.has(pid) ? 'g' : 'f', score });
          rows.ratingParts.push({ match_id: m.id, member_id: pid, parts: x.parts[pid] ?? [] });
        }
      }
    }
    for (const f of r.fixtures ?? []) {
      rows.fixtures.push({
        id: f.id, round_id: r.id, home: f.home ?? null, away: f.away ?? null, stage: f.stage ?? null, ko_stage: f.ko ?? null,
        match_id: f.mid ?? null, done: !!f.done, winner: f.winner ?? null,
      });
    }
    for (const c of stored.clips ?? []) {
      rows.clips.push({ id: c.id, round_id: r.id, match_id: c.mid ?? null, member_id: c.pid ?? null, kind: c.kind, label: c.label || null, url: c.url, timeline: null });
    }
  }
  return rows;
}
