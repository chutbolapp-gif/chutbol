#!/usr/bin/env node
// Builds the synthetic edge-case fixtures in packages/scoring/fixtures/<name>/{leagues,rounds,ratings}.
// Same shape as docs/prototype/data (the prototype's own export). The JSON files are what the
// golden extractor reads; this script only exists so the cases stay readable and reviewable.
//
//   pnpm fixtures      rewrite packages/scoring/fixtures, then run `pnpm golden`
//
// Every case is a single league with one round. Teams: tA (a1..a5), tB (b1..b5), tC (c1..c5),
// tD (d1..d5) when needed. The first player listed for a team is its keeper unless a match says
// otherwise. All times are fixed numbers (no Date.now), so output is deterministic.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/scoring/fixtures');

const T0 = 1790000000000; // round created; matches start 10 minutes apart after it
const COLORS = { tA: '#FF8C3A', tB: '#3A8CFF', tC: '#2EC27E', tD: '#C061CB' };
const NAMES = { tA: 'כתומים', tB: 'כחולים', tC: 'ירוקים', tD: 'סגולים' };
const roster = tid => [1, 2, 3, 4, 5].map(i => tid[1].toLowerCase() + i);

// ---------- event helpers (sec = seconds since kick-off) ----------
const goal = (sec, team, p, a = null, extra = {}) => ({ sec, type: 'goal', team, p, a, pen: false, ...extra });
const own = (sec, team, p) => ({ sec, type: 'own', team, p });
const save = (sec, team, p) => ({ sec, type: 'save', team, p });
const gkSwap = (sec, team, p, extra = {}) => ({ sec, type: 'gk', team, p, ...extra });

/**
 * One match. opts:
 *   events   list from the helpers above
 *   acc      timer.acc in ms (how long the match actually ran); default the full 7 minutes
 *   gk       { [tid]: pid } keeper at kick-off (default: first player of the team)
 *   on       { [tid]: pid[] } players on the pitch at kick-off (default: whole team)
 *   status   default 'done'
 */
function match(n, home, away, teams, opts = {}) {
  const dur = 7;
  const acc = opts.acc ?? dur * 60000;
  const startedAt = T0 + n * 600000;
  const lu = {}, gk0 = {};
  for (const t of [home, away]) {
    const on = opts.on?.[t] ?? teams[t].slice();
    const g = opts.gk?.[t] ?? on[0];
    lu[t] = { gk: g, on };
    gk0[t] = g;
  }
  // track the current keeper per side, so goals carry the right gka (as the prototype records it)
  const cur = { [home]: lu[home].gk, [away]: lu[away].gk };
  const other = t => (t === home ? away : home);
  const events = (opts.events ?? []).slice().sort((x, y) => x.sec - y.sec).map((e, i) => {
    const { sec, noAt, ...rest } = e;
    const ev = { id: `e${n}-${i + 1}`, ...rest, min: Math.floor(sec / 60) + 1 };
    if (!noAt) ev.at = startedAt + sec * 1000;
    if (e.type === 'gk') { ev.prev = cur[e.team]; cur[e.team] = e.p; }
    if (e.type === 'goal' && !('gka' in e)) ev.gka = cur[other(e.team)];
    if (e.type === 'own' && !('gka' in e)) ev.gka = cur[e.team];
    return ev;
  });
  const status = opts.status ?? 'done';
  const m = { id: `m${n}`, n, home, away, dur, status, startedAt, lu, gk0, events, timer: { acc, run: status === 'live' } };
  if (status === 'done') m.endedAt = startedAt + acc;
  if (opts.koWinner) m.koWinner = opts.koWinner;
  return m;
}

/** One case: a league, its ratings doc and one round. */
function fixture(name, { teamIds = ['tA', 'tB', 'tC'], extraPlayers = [], stars = {}, cards = {}, round = {}, matches }) {
  const lid = `fx-${name}`;
  const teams = Object.fromEntries(teamIds.map(t => [t, roster(t)]));
  const ms = matches(teams);
  const pids = [...teamIds.flatMap(t => teams[t]), ...extraPlayers];
  const league = {
    id: lid, name: `fixture ${name}`, season: 'עונה 26/27', created: T0 - 86400000, roundOffset: 0,
    players: pids.map(id => ({ id, name: id, ...(cards[id] ? { cards: cards[id] } : {}) })),
    settings: { fee: 20, goalLimit: 2, lead: 10, minHours: 2, minMatches: 10, minutes: 7, perTeam: 5, pts1: 3, pts2: 1, seasonRounds: 25, teams: teamIds.length, tieRule: 'fewer' },
  };
  const r = {
    id: `${lid}-r1`, leagueId: lid, number: 1, season: 'עונה 26/27', created: T0, status: 'done', voided: false,
    attendees: pids.filter(p => ms.some(m => Object.values(m.lu).some(x => x.on.includes(p)))),
    teams: teamIds.map(t => ({ id: t, name: NAMES[t], color: COLORS[t], gk: null, players: teams[t] })),
    manualOrder: [], nextPair: [], nextGk: {},
    ...round,
    matches: ms,
  };
  const ratings = { id: lid, r: Object.fromEntries(pids.map(p => [p, stars[p] ?? 3])), rounds: {} };
  return { name, league, round: r, ratings };
}

// ---------- the cases ----------
const cases = [
  // 0-0 draws: field players get base 5.5; keeper clean-sheet bonus by share of the match played
  // (full = +1.5, 57% = +1, 36% = +0.5, 24% = 0 with the "only played" line).
  // tA and tC finish level on everything, so the organiser's manual order decides (manualOrder).
  fixture('draw-0-0', {
    round: { manualOrder: ['tA', 'tC', 'tB'] },
    matches: T => [
      match(1, 'tA', 'tB', T),
      match(2, 'tA', 'tC', T, { acc: 100000 }),
      match(3, 'tB', 'tC', T, { acc: 150000 }),
      match(4, 'tC', 'tA', T, { acc: 240000 }),
    ],
  }),

  // Two field players of the champion team finish level on round score -> both are MVP.
  // a2 and a3 also tie for top scorer and for top assists.
  fixture('mvp-tie', {
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [goal(60, 'tA', 'a2', 'a3'), goal(120, 'tB', 'b2'), goal(200, 'tA', 'a3', 'a2'), goal(300, 'tB', 'b3')] }),
      match(2, 'tA', 'tC', T, { events: [goal(90, 'tA', 'a2', 'a3'), goal(250, 'tA', 'a3', 'a2')] }),
      match(3, 'tB', 'tC', T, { events: [goal(150, 'tB', 'b2')] }),
    ],
  }),

  // tC plays with x1 in goal: a league member who is not on tC's roster (c1 sits out).
  // tC wins the round; x1 is rated as a keeper but gets no champion bonus, no gk count and no team.
  fixture('outside-gk', {
    extraPlayers: ['x1'],
    matches: T => {
      const withX = { tC: ['x1', 'c2', 'c3', 'c4', 'c5'] };
      return [
        match(1, 'tA', 'tB', T, { events: [goal(200, 'tA', 'a2')] }),
        match(2, 'tA', 'tC', T, { on: withX, events: [save(100, 'tC', 'x1'), goal(220, 'tC', 'c2', 'c3')] }),
        match(3, 'tB', 'tC', T, { on: withX, events: [goal(130, 'tC', 'c4'), save(300, 'tC', 'x1')] }),
      ];
    },
  }),

  // Who counts as a keeper (matchGks): at least 60s in goal, or a save, or a goal conceded in goal.
  //  m1: b1 starts in goal, swapped out after 40s, nothing happened -> rated as a field player.
  //  m2: c1 swapped out after 30s, but conceded a goal at 20s -> still a keeper.
  //  m3: a gk switch without a device time -> gkSeconds gives up; only the kick-off keepers count.
  fixture('gk-under-minute', {
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [gkSwap(40, 'tB', 'b2'), goal(300, 'tA', 'a3')] }),
      match(2, 'tA', 'tC', T, { events: [goal(20, 'tA', 'a2'), gkSwap(30, 'tC', 'c2'), goal(200, 'tC', 'c3')] }),
      match(3, 'tB', 'tC', T, { events: [gkSwap(25, 'tC', 'c3', { noAt: true }), goal(150, 'tB', 'b4')] }),
    ],
  }),

  // Knockout, 4 teams. Semis: tA 2-0 tB, tC 1-1 tD (tD on penalties). Final: tA 0-0 tD (tD on penalties).
  // koRank makes tD champion although tA has more points. rateMatch treats penalty games as draws.
  fixture('ko-penalties', {
    teamIds: ['tA', 'tB', 'tC', 'tD'],
    round: {
      format: 'knockout',
      koRank: ['tD', 'tA'],
      fixtures: [
        { id: 'f1', home: 'tA', away: 'tB', stage: 'חצי גמר', ko: 1, done: true, winner: 'tA', mid: 'm1' },
        { id: 'f2', home: 'tC', away: 'tD', stage: 'חצי גמר', ko: 1, done: true, winner: 'tD', mid: 'm2' },
        { id: 'f3', home: 'tA', away: 'tD', stage: 'גמר', ko: 2, done: true, winner: 'tD', mid: 'm3' },
      ],
    },
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [goal(100, 'tA', 'a2'), goal(280, 'tA', 'a3', 'a2')] }),
      match(2, 'tC', 'tD', T, { koWinner: 'tD', events: [goal(150, 'tC', 'c2'), goal(330, 'tD', 'd2', 'd3')] }),
      match(3, 'tA', 'tD', T, { koWinner: 'tD', events: [save(200, 'tD', 'd1')] }),
    ],
  }),

  // Tight round: double round robin, every team ends on 5 points (spread 0 < 0.25).
  // Stars are uneven, so the "tight" rule in playerOVR has expectations to hold back:
  // c2 (4 stars, losing team) would drop a point, but scored, so the tight rule keeps c2 level.
  fixture('tight-round', {
    stars: { a2: 5, a3: 4.5, b2: 1, b3: 1.5, c2: 4, c4: 1 },
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [goal(200, 'tA', 'a4')] }),
      match(2, 'tB', 'tC', T, { events: [goal(150, 'tB', 'b2', 'b3')] }),
      match(3, 'tC', 'tA', T, { events: [goal(320, 'tC', 'c4')] }),
      match(4, 'tA', 'tB', T, { events: [goal(60, 'tB', 'b2'), goal(180, 'tA', 'a5')] }),
      match(5, 'tB', 'tC', T, { events: [goal(100, 'tC', 'c3'), goal(260, 'tB', 'b3', 'b2')] }),
      match(6, 'tC', 'tA', T, { events: [goal(90, 'tA', 'a4', 'a5'), goal(240, 'tC', 'c2')] }),
    ],
  }),

  // Voided round ("stopped without points"): tA would be champion, but there are no awards and no
  // champion bonus. Goals and match ratings still count.
  fixture('voided-round', {
    round: { voided: true },
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [goal(100, 'tA', 'a2'), goal(250, 'tA', 'a2', 'a3')] }),
      match(2, 'tA', 'tC', T, { events: [goal(200, 'tA', 'a3')] }),
      match(3, 'tB', 'tC', T, { events: [goal(150, 'tC', 'c2'), goal(300, 'tB', 'b2')] }),
    ],
  }),

  // Fast wins (by timer.acc): exactly 2:00 -> +1, exactly 5:00 -> +0.5, 5:01 -> nothing.
  // Field players only; the winning keeper in a 2-minute win gets no clean-sheet bonus (under 30%).
  fixture('fast-win', {
    matches: T => [
      match(1, 'tA', 'tB', T, { acc: 120000, events: [goal(50, 'tA', 'a2'), goal(118, 'tA', 'a3', 'a2')] }),
      match(2, 'tA', 'tC', T, { acc: 300000, events: [goal(60, 'tC', 'c2'), goal(200, 'tA', 'a4'), goal(299, 'tA', 'a2', 'a5')] }),
      match(3, 'tB', 'tC', T, { acc: 301000, events: [goal(100, 'tB', 'b2'), goal(300, 'tB', 'b3')] }),
    ],
  }),

  // Last-minute winner: a goal in minute >= dur (7) that put the winner ahead for good.
  //  m1: a2 at 6:10 makes 1-0 (+2, assist a3 +1); a3's 2-0 at 6:40 is not "the" winner.
  //  m2: tA's winner at 6:30 is an own goal by c3 -> no bonus for anyone.
  //  m3: b3 at 6:59 makes 2-1 after 1-1 (+2, assist b4 +1).
  //  m4: c2 at 5:59 is minute 6 -> no bonus.
  fixture('last-minute-winner', {
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [goal(370, 'tA', 'a2', 'a3'), goal(400, 'tA', 'a3')] }),
      match(2, 'tA', 'tC', T, { events: [goal(60, 'tC', 'c2'), goal(180, 'tA', 'a4'), own(390, 'tC', 'c3')] }),
      match(3, 'tB', 'tC', T, { events: [goal(120, 'tB', 'b2'), goal(240, 'tC', 'c2'), goal(419, 'tB', 'b3', 'b4')] }),
      match(4, 'tC', 'tA', T, { events: [goal(359, 'tC', 'c2')] }),
    ],
  }),

  // Low-table team (points earlier in this round) beats or draws the leader. The bonus applies
  // to keepers too.
  //  m5: tC (0) beats tA (12): gap 12 -> 0.5, doubled for a win = +1.
  //  m8: tB (0) beats tA (18) 3-0 in 1:50: gap 18 -> 1.5, doubled = +3; b2 goes over 10 and is
  //      capped, tA field players go under 4 and are lifted to 4.
  //  m9: tC (3) draws tA (18): gap 15 -> +1.
  fixture('underdog-win', {
    matches: T => [
      match(1, 'tA', 'tB', T, { events: [goal(100, 'tA', 'a2')] }),
      match(2, 'tA', 'tC', T, { events: [goal(100, 'tA', 'a3')] }),
      match(3, 'tA', 'tB', T, { events: [goal(100, 'tA', 'a2')] }),
      match(4, 'tA', 'tC', T, { events: [goal(100, 'tA', 'a4')] }),
      match(5, 'tC', 'tA', T, { events: [goal(200, 'tC', 'c2', 'c3')] }),
      match(6, 'tA', 'tB', T, { events: [goal(100, 'tA', 'a2')] }),
      match(7, 'tA', 'tC', T, { events: [goal(100, 'tA', 'a5')] }),
      match(8, 'tB', 'tA', T, { acc: 110000, events: [goal(30, 'tB', 'b2'), goal(70, 'tB', 'b2', 'b3'), goal(105, 'tB', 'b3', 'b2')] }),
      match(9, 'tC', 'tA', T, { events: [goal(150, 'tA', 'a2'), goal(300, 'tC', 'c4')] }),
    ],
  }),

  // Keeper rotation (autoGk) during a live round. Next match is tA vs tB.
  //  tA: gkOrder [a4, a2, zz, a1] -> zz is not on the team (dropped), a3, a5 appended.
  //      a4 and a1 have kept goal once. tB's next keeper is a2 (lent to tB), so a2 is skipped.
  //      Expected: a3 (fewest times in goal, earliest in the order).
  //  tB: b1 kept goal in m1 (done) and b2 is in goal in m3 (live, counts too) -> expected b3.
  //  tC: no gkOrder -> null.
  fixture('auto-gk', {
    round: {
      status: 'live',
      gkOrder: { tA: ['a4', 'a2', 'zz', 'a1'], tB: ['b2', 'b1', 'b3', 'b4', 'b5'] },
      nextPair: ['tA', 'tB'],
      nextGk: { tB: 'a2' },
    },
    matches: T => [
      match(1, 'tA', 'tB', T, { gk: { tA: 'a4' }, events: [goal(200, 'tA', 'a2')] }),
      match(2, 'tA', 'tC', T, { events: [goal(150, 'tC', 'c2')] }),
      match(3, 'tB', 'tC', T, { status: 'live', acc: 180000, gk: { tB: 'b2' }, events: [goal(100, 'tB', 'b3')] }),
    ],
  }),
];

// ---------- write ----------
rmSync(OUT, { recursive: true, force: true });
const write = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); };
for (const c of cases) {
  const dir = join(OUT, c.name);
  write(join(dir, 'leagues', `${c.league.id}.json`), c.league);
  write(join(dir, 'rounds', `${c.round.id}.json`), c.round);
  write(join(dir, 'ratings', `${c.ratings.id}.json`), c.ratings);
}
console.log(`wrote ${cases.length} fixtures to packages/scoring/fixtures`);
