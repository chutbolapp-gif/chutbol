// Per-round aggregates: relative player stats, player of the round, awards and how each team's
// evening went. Ported 1:1 from the prototype (line numbers in comments). No cache: the prototype's
// OVRC memo is dropped; every call recomputes from its inputs.
import type { Id, Match, Role, Round, RoundScore, TeamDay } from '@chutbol/shared';
import { isGoal, matchGks, matchWindow, onIntervals, playsOf, score, team, teamOf } from './basics';
import { playerStats, standings } from './standings';

export interface RawCounts { n: number; g: number; a: number; kp: number; gs: number; gd: number; pts: number; conc: number; mins: number; sv: number }

/** A player's relative (0-1 percentile) stats in one round, per role. */
export interface RoundAttr {
  n: number;
  raw: RawCounts;
  shooting?: number; passing?: number; defending?: number; mental?: number;
  gkConc?: number; reflexes?: number; gkFeet?: number;
}
export type RoundRaw = Record<Role, Record<Id, RoundAttr>>;

/**
 * Every player who played in the round, ranked against everyone else in the same role that
 * round (percentile 0..1; 0.5 when there is nothing to compare). (973)
 */
export function roundRaw(r: Round): RoundRaw {
  const out: Record<Role, Record<Id, RawCounts>> = { f: {}, g: {} };
  const st0 = standings(r);
  r.matches.forEach(m => {
    if (m.status !== 'done' || !m.lu) return;
    const pl = playsOf(m);
    const G = matchGks(m);
    const [h, aa] = score(m);
    const ev = m.events || [];
    const gkaData = ev.some(e => isGoal(e) && e.gka);
    Object.entries(pl).forEach(([pid, t]) => {
      const role: Role = G.has(pid) ? 'g' : 'f';
      const o = out[role][pid] || (out[role][pid] = { n: 0, g: 0, a: 0, kp: 0, gs: 0, gd: 0, pts: 0, conc: 0, mins: 0, sv: 0 });
      o.n++;
      const fo = t === m.home ? h : aa, ag = t === m.home ? aa : h;
      o.pts += fo > ag ? 3 : fo === ag ? 1 : 0;
      const cnt = (f: (e: (typeof ev)[number]) => boolean) => ev.filter(f).length;
      o.g += cnt(e => e.type === 'goal' && e.p === pid);
      o.a += cnt(e => e.type === 'goal' && e.a === pid);
      o.kp += cnt(e => e.type === 'key' && e.p === pid);
      o.gs += cnt(e => e.type === 'shot' && e.p === pid);
      o.gd += cnt(e => e.type === 'def' && e.p === pid);
      if (role === 'g') {
        o.conc += gkaData ? cnt(e => isGoal(e) && e.gka === pid) : ag;
        o.sv += cnt(e => (e.type === 'save' && e.p === pid) || (e.type === 'pen' && e.res === 'saved' && e.gka === pid));
      } else {
        const iv = onIntervals(m, pid, t);
        const inIv = (at: number) => iv.some(([a, b]) => at >= a && at <= b);
        o.conc += cnt(e => ((e.type === 'goal' && e.team !== t) || (e.type === 'own' && e.team === t)) && (!e.at || inIv(e.at)));
        const [ws, we] = matchWindow(m);
        const len = Math.max(1, we - ws);
        o.mins += Math.min(1, iv.reduce((s1, [a, b]) => s1 + Math.max(0, b - a), 0) / len);
      }
    });
  });
  const place = (pid: Id) => {
    const tm = teamOf(r, pid);
    return r.voided || !tm ? 0 : (st0[0] && st0[0].id === tm.id ? 1 : st0[1] && st0[1].id === tm.id ? .5 : 0);
  };
  const men = (o: RawCounts, pid: Id) => .6 * o.pts / o.n / 3 + .4 * place(pid);
  const MET: Record<Role, Record<string, (o: RawCounts, id: Id) => number | null>> = {
    f: {
      shooting: o => (o.g + .4 * o.gs) / o.n,
      passing: o => (o.a + .5 * o.kp) / o.n,
      defending: o => (o.mins >= .5 ? -(o.conc / o.mins) + .5 * o.gd / o.n : null),
      mental: men,
    },
    g: {
      gkConc: o => -(o.conc / o.n),
      reflexes: o => o.sv / o.n,
      gkFeet: o => (o.a + .5 * o.kp) / o.n,
      mental: men,
    },
  };
  const res: RoundRaw = { f: {}, g: {} };
  (['f', 'g'] as const).forEach(role => {
    const ids = Object.keys(out[role]);
    ids.forEach(id => (res[role][id] = { n: out[role][id]!.n, raw: out[role][id]! }));
    Object.entries(MET[role]).forEach(([k, fn]) => {
      const vals = ids.map(id => fn(out[role][id]!, id));
      const ok = vals.filter(v => v != null) as number[];
      ids.forEach((id, i) => {
        const v = vals[i];
        const target = res[role][id] as unknown as Record<string, number>;
        if (v == null || ok.length < 2) { target[k] = .5; return; }
        let lo = 0, eq = 0;
        ok.forEach(x => { if (x < v) lo++; else if (x === v) eq++; });
        target[k] = (lo + .5 * (eq - 1)) / (ok.length - 1);
      });
    });
  });
  return res;
}

/** A player's round stats as field player and/or keeper. (988) */
export function roundAttrs(r: Round, pid: Id): Partial<Record<Role, RoundAttr>> {
  const R0 = roundRaw(r);
  const res: Partial<Record<Role, RoundAttr>> = {};
  if (R0.f[pid]) res.f = R0.f[pid];
  if (R0.g[pid]) res.g = R0.g[pid];
  return res;
}

/** Sum and average of stored match ratings per player. kind: only keepers / only field players. (1090) */
export function ratingAgg(rounds: Round[], kind?: 'field' | 'gk'): Record<Id, { sum: number; n: number; avg: number }> {
  const a: Record<Id, { sum: number; n: number; avg: number }> = {};
  rounds.forEach(r => r.matches.forEach((m: Match) => {
    if (m.status !== 'done' || !m.ratings) return;
    const G = matchGks(m);
    Object.entries(m.ratings).forEach(([p, v]) => {
      if (kind && (kind === 'gk') !== G.has(p)) return;
      const x = a[p] || (a[p] = { sum: 0, n: 0, avg: 0 });
      x.sum += v;
      x.n++;
    });
  }));
  Object.values(a).forEach(x => (x.avg = x.sum / x.n));
  return a;
}

/** Keepers: regulars first, then score, then matches. (1115) */
export const gkSort = (a: [Id, RoundScore], b: [Id, RoundScore]): number =>
  ((b[1].q ? 1 : 0) - (a[1].q ? 1 : 0)) || (b[1].score - a[1].score) || (b[1].n - a[1].n);

/**
 * Player of the round: average stored match rating + 0.3 for the champion team, +0.15 for
 * second place (only once the round is finished and not voided). Reads `m.ratings`, so call it
 * on a round that went through recomputeRatings. (1116)
 */
export function roundScores(r: Round, kind?: 'field' | 'gk'): Record<Id, RoundScore> {
  const agg = ratingAgg([r], kind);
  const st = standings(r);
  const fin = r.status === 'done' && !r.voided;
  const t1 = fin && st[0] ? team(r, st[0].id).players : [], t2 = fin && st[1] ? team(r, st[1].id).players : [];
  const raw = kind === 'gk' ? roundRaw(r).g : {};
  const out: Record<Id, RoundScore> = {};
  Object.entries(agg).forEach(([p, x]) => {
    const b = t1.includes(p) ? .3 : t2.includes(p) ? .15 : 0;
    const rr: Partial<RawCounts> = (raw[p] || ({} as Partial<RoundAttr>)).raw || {};
    out[p] = { n: x.n, avg: x.avg, bonus: b, sv: rr.sv || 0, conc: rr.conc || 0, contrib: x.avg * x.n - 5 * x.n, score: x.avg + b };
  });
  if (kind === 'gk') {
    const mx = Math.max(0, ...Object.values(out).map(x => x.n));
    Object.values(out).forEach(x => { x.q = x.n >= Math.max(1, Math.ceil(mx / 2)); });
  }
  return out;
}

export interface RoundAwards { mvp: Id[]; gk: Id[]; top: Id[]; ast: Id[]; champ: Id[] }

/** Round titles: MVP, best keeper, top scorer, top assists, champion team. Ties share. (989) */
export function roundAwards(r: Round): RoundAwards {
  const aw: RoundAwards = { mvp: [], gk: [], top: [], ast: [], champ: [] };
  if (r.status !== 'done' || r.voided) return aw;
  const s = standings(r);
  if (s[0]) aw.champ = team(r, s[0].id).players.slice();
  const bs = (sc: Record<Id, RoundScore>) => {
    const e = Object.entries(sc);
    if (!e.length) return [];
    const mx = Math.max(...e.map(x => x[1].score));
    return e.filter(x => x[1].score === mx).map(x => x[0]);
  };
  aw.mvp = bs(roundScores(r, 'field'));
  aw.gk = (() => {
    const e = Object.entries(roundScores(r, 'gk')).sort(gkSort);
    if (!e.length) return [];
    const t = e[0]![1];
    return e.filter(x => !!x[1].q === !!t.q && x[1].score === t.score).map(x => x[0]);
  })();
  const ps = playerStats([r]);
  (['goals', 'assists'] as const).forEach((k, i) => {
    const e = Object.entries(ps).filter(x => x[1][k] > 0);
    if (!e.length) return;
    const mx = Math.max(...e.map(x => x[1][k]));
    aw[i ? 'ast' : 'top'] = e.filter(x => x[1][k] === mx).map(x => x[0]);
  });
  return aw;
}

/**
 * How each team's evening went: average table position after every match, and how close it
 * finished to the champion. A tight round (points close together) means the ratings were right. (1009)
 */
export function teamDay(r: Round): TeamDay {
  const T = r.teams.map(t => t.id);
  const pts: Record<Id, number> = {}, gd: Record<Id, number> = {}, rk: Record<Id, number> = {}, cnt: Record<Id, number> = {};
  T.forEach(t => { pts[t] = 0; gd[t] = 0; rk[t] = 0; cnt[t] = 0; });
  r.matches.filter(m => m.status === 'done').sort((a, b) => a.n - b.n).forEach(m => {
    const [h, a] = score(m);
    pts[m.home] = (pts[m.home] as number) + (h > a ? 3 : h === a ? 1 : 0);
    pts[m.away] = (pts[m.away] as number) + (a > h ? 3 : h === a ? 1 : 0);
    gd[m.home] = (gd[m.home] as number) + (h - a);
    gd[m.away] = (gd[m.away] as number) + (a - h);
    const order = T.filter(t => t in pts).slice().sort((x, y) => pts[y]! - pts[x]! || gd[y]! - gd[x]!);
    order.forEach((t, i) => { rk[t]! += T.length > 1 ? (T.length - 1 - i) / (T.length - 1) : 1; cnt[t]!++; });
  });
  const st = standings(r);
  const top = st[0] ? st[0].pts : 0;
  const mp = Math.max(1, ...st.map(x => x.p || 0));
  const spread = st.length ? (top - st[st.length - 1]!.pts) / (mp * 3) : 0;
  const out: TeamDay = { tight: spread < .25, spread, score: {} };
  st.forEach(x => {
    const avgRank = cnt[x.id] ? rk[x.id]! / cnt[x.id]! : .5;
    const gap = 1 - Math.min(1, (top - x.pts) / 6);
    out.score[x.id] = .5 * avgRank + .5 * gap;
  });
  return out;
}
