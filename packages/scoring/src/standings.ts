// Round table and simple counters. Ported 1:1 from the prototype (line numbers in comments).
import type { Id, Round, StandingRow } from '@chutbol/shared';
import { score } from './basics';

type Stat = Omit<StandingRow, 'tied' | 'manual'>;

/** Points, goals and results per team. `live` also counts the match in progress. (495) */
export function teamStats(r: Round, live?: boolean): Record<Id, Stat> {
  const st: Record<Id, Stat> = {};
  r.teams.forEach(t => (st[t.id] = { id: t.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  r.matches.filter(m => m.status === 'done' || (live && m.status === 'live')).forEach(m => {
    const [h, a] = score(m);
    const H = st[m.home], A = st[m.away];
    if (!H || !A) return;
    H.p++; A.p++; H.gf += h; H.ga += a; A.gf += a; A.ga += h;
    if (h > a) { H.w++; A.l++; H.pts += 3; }
    else if (h < a) { A.w++; H.l++; A.pts += 3; }
    else { H.d++; A.d++; H.pts++; A.pts++; }
  });
  return st;
}

/** Head-to-head points of x against y. (499) */
export function h2h(r: Round, x: Id, y: Id): number {
  let p = 0;
  r.matches.filter(m => m.status === 'done' && ((m.home === x && m.away === y) || (m.home === y && m.away === x))).forEach(m => {
    const [h, a] = score(m);
    const gx = m.home === x ? h : a, gy = m.home === x ? a : h;
    p += gx > gy ? 3 : gx === gy ? 1 : 0;
  });
  return p;
}

/**
 * The round table: knockout rank first (if any), then points, goal difference, goals,
 * head-to-head, then the organiser's manual order. (500)
 */
export function standings(r: Round, live?: boolean): StandingRow[] {
  const arr = Object.values(teamStats(r, live)) as StandingRow[];
  const mo = r.manualOrder || [];
  const ix = (id: Id) => { const i = mo.indexOf(id); return i < 0 ? 999 : i; };
  const base = (a: Stat, b: Stat) => (b.pts - a.pts) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf) || (h2h(r, b.id, a.id) - h2h(r, a.id, b.id));
  const kr = r.koRank || [];
  const ki = (id: Id) => { const i = kr.indexOf(id); return i < 0 ? 999 : i; };
  arr.sort((a, b) => (kr.length ? ki(a.id) - ki(b.id) : 0) || base(a, b) || (ix(a.id) - ix(b.id)));
  arr.forEach((x, i) => {
    x.tied = i > 0 && base(arr[i - 1]!, x) === 0;
    x.manual = x.tied && ix(arr[i - 1]!.id) < 999 && ix(x.id) < 999;
  });
  return arr;
}

export interface PlayerStat { goals: number; assists: number; own: number; gkm: number; conc: number; yellow: number; red: number; disc: number }

/** Goals, assists, own goals, matches in goal, goals conceded and cards per player. (506) */
export function playerStats(rounds: Round[]): Record<Id, PlayerStat> {
  const st: Record<Id, PlayerStat> = {};
  const g = (id: Id) => st[id] || (st[id] = { goals: 0, assists: 0, own: 0, gkm: 0, conc: 0, yellow: 0, red: 0, disc: 0 });
  rounds.forEach(r => r.matches.forEach(m => {
    (m.events || []).forEach(e => {
      if (e.type === 'goal') { g(e.p!).goals++; if (e.a) g(e.a).assists++; if (e.gka && m.status === 'done') g(e.gka).conc++; }
      else if (e.type === 'own') { g(e.p!).own++; if (e.gka && m.status === 'done') g(e.gka).conc++; }
      else if (e.type === 'card') { const x = g(e.p!); if (e.c === 'y') x.yellow++; else x.red++; x.disc = x.yellow + 3 * x.red; }
    });
    if (m.status === 'done' && m.gk0) Object.values(m.gk0).forEach(pid => { if (pid) g(pid).gkm++; });
  }));
  return st;
}
