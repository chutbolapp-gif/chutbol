// Overall player rating (OVR, 83-99, FIFA style). Ported 1:1 from the prototype's playerOVR (1014).
// Differences from the prototype, by design:
//   - explicit inputs (league, rounds, ratings doc, isAdmin) instead of the global app state
//   - no module cache (OVRC)
//   - hist holds round ids, not whole round objects
//   - the playing style is a key (OvrStyle), not Hebrew text
//   - fields the prototype always fills with the same constant (raw, scaled, capped, attS, top,
//     bonus, aw, blendW) are left out
import type { Id, League, ManualAttr, OvrHistEntry, OvrStatKey, OvrStyle, PlayerCard, PlayerOvr, RatingsDoc, Role, Round } from '@chutbol/shared';
import { baseRating, rv, teamOf } from './basics';
import { roundAttrs, roundAwards, roundRaw, teamDay } from './round';

/** Stats on the card, per role. (960) */
export const OVR_K: Record<Role, OvrStatKey[]> = {
  f: ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'mental'],
  g: ['gkConc', 'reflexes', 'gkFeet', 'physical', 'mental'],
};
/** Starting OVR by stars. (1001) */
export const STAR_OVR: Record<number, number> = { 0.5: 83, 1: 85, 1.5: 86, 2: 87, 2.5: 88, 3: 89, 3.5: 90, 4: 92, 4.5: 94, 5: 96 };
export const OVR_MIN = 83, OVR_MAX = 99; // (1002)
/** 0..1 -> 40..99 (965) */
export const dD = (v: number): number => Math.round(40 + 59 * v);

/** Organiser's cards on a player. (1004) */
export function pCards(l: League, pid: Id): PlayerCard[] {
  const p = (l.players || []).find(x => x.id === pid);
  return (p && p.cards) || [];
}

/** Stars (rounded to half) and the starting OVR they give. (1005) */
export function starBase(ratings: RatingsDoc | undefined, pid: Id): { st: number; base: number } {
  const st = rv(baseRating(ratings, pid));
  if (!st) return { st: 0, base: 86 };
  const k = Math.max(.5, Math.min(5, Math.round(st * 2) / 2));
  return { st: k, base: STAR_OVR[k]! };
}

/** Manual stats the organiser set for a player in a role. (995) */
export function manualAttr(ratings: RatingsDoc | undefined, pid: Id, role: Role): ManualAttr {
  return (((ratings && ratings.attr) || {})[pid] || {})[role] || {};
}

export interface PlayerOvrInput {
  league: League;
  /** rounds of any league; only this league's finished rounds are used, ordered by `created` */
  rounds: Round[];
  /** the league's ratings doc (secret) */
  ratings: RatingsDoc | undefined;
  pid: Id;
  role: Role;
  /** admins see manual stats; members do not */
  isAdmin: boolean;
}

/**
 * Starts from the organiser's stars, then moves at most one point per round (rounds where the
 * player played at least 2 matches in that role), by personal performance and team results
 * compared with what is expected at their level. Returns null for a player with no stars and no rounds.
 * Reads stored match ratings (via roundAwards), so pass rounds that went through recomputeRatings.
 */
export function playerOVR({ league: l, rounds, ratings, pid, role, isAdmin }: PlayerOvrInput): PlayerOvr | null {
  const all = rounds.filter(r => r.leagueId === l.id).sort((a, b) => a.created - b.created).filter(r => r.status === 'done');
  const { st, base } = starBase(ratings, pid);
  let ovr = base;
  const hist: OvrHistEntry[] = [];
  all.forEach(r => {
    const x = roundAttrs(r, pid)[role];
    if (!x || x.n < 2) return;
    // a player is judged by what they are best at: strongest skill 60%, average of all 40%
    const sk = (role === 'g' ? [x.gkConc, x.reflexes] : [x.shooting, x.passing, x.defending]) as number[];
    const personal = .6 * Math.max(...sk) + .4 * sk.reduce((a, b) => a + b, 0) / sk.length;
    const TD = teamDay(r);
    const tm = teamOf(r, pid);
    const tv = Object.values(TD.score);
    const tmean = tv.length ? tv.reduce((a, b) => a + b, 0) / tv.length : .5;
    const team = tm && TD.score[tm.id] != null ? Math.max(0, Math.min(1, .5 + (TD.score[tm.id]! - tmean))) : x.mental!;
    // expectation is relative to who played that night
    const peers = Object.keys(roundRaw(r)[role] || {});
    const pb = peers.map(p => starBase(ratings, p).base);
    const myb = starBase(ratings, pid).base;
    let lo = 0, eq = 0;
    pb.forEach(b => { if (b < myb) lo++; else if (b === myb) eq++; });
    const pct = pb.length > 1 ? (lo + .5 * (eq - 1)) / (pb.length - 1) : .5;
    const c = .5 * personal + .5 * team;
    const e = .2 + .6 * pct;
    const thr = TD.tight ? .2 : .14;
    const A = roundAwards(r);
    const award = (role === 'g' ? A.gk : A.mvp).includes(pid) || (role === 'f' && (A.top.includes(pid) || A.ast.includes(pid))) || A.champ.includes(pid);
    let d = c - e > thr ? 1 : c - e < -thr ? -1 : 0;
    if (award && d < 0) d = 0;
    // tight round: move only when the player's own game clearly says so
    if (TD.tight) { if (d < 0 && personal >= e - .15) d = 0; if (d > 0 && personal <= e + .15) d = 0; }
    const before = ovr;
    ovr = Math.max(OVR_MIN, Math.min(OVR_MAX, ovr + d));
    hist.push({ roundId: r.id, personal, team, c, e, d: ovr - before, ovr, tight: TD.tight });
  });
  const played = hist.length;
  if (!st && !played) return null;

  const cards = pCards(l, pid);
  const man: ManualAttr = isAdmin ? Object.assign({}, manualAttr(ratings, pid, role)) : {};
  if (man.dribbling == null && man.control != null) man.dribbling = man.control;
  // card face: everything starts a little under the overall; cards lift stats; recent rounds nudge the data stats
  const avgP = (kk: OvrStatKey) => {
    const v = all.slice().reverse().map(r => ((roundAttrs(r, pid)[role] || {}) as Record<string, unknown>)[kk] as number | undefined)
      .filter(v => v != null).slice(0, 5) as number[];
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const boost: Record<PlayerCard, Partial<Record<OvrStatKey, number>>> = { att: { shooting: 7, dribbling: 6 }, def: { defending: 8, physical: 3 }, fit: { pace: 7, physical: 6 } };
  const keys = OVR_K[role];
  const stats: PlayerOvr['stats'] = {}, auto: PlayerOvr['auto'] = {}, src: PlayerOvr['src'] = {};
  keys.forEach(kk => {
    let v = ovr - 5;
    if (role === 'f' && cards.length) { let b = 0; cards.forEach(c => { b += (boost[c] || {})[kk] || 0; }); v += b ? b : -2; }
    const pv = avgP(kk);
    if (pv != null) { v += Math.round((pv - .5) * 10); auto[kk] = dD(pv); }
    v = Math.max(60, Math.min(99, Math.round(v)));
    if (man[kk] != null) { stats[kk] = man[kk]; src[kk] = 'man'; }
    else { stats[kk] = v; src[kk] = pv != null ? 'auto' : 'card'; }
  });
  const has = (c: PlayerCard) => cards.includes(c);
  const pos: OvrStyle = role === 'g' ? 'gk' : has('att') && has('def') ? 'complete' : has('att') ? 'attacking' : has('def') ? 'defensive' : has('fit') ? 'engine' : 'balanced';
  const stamina = man.stamina != null ? man.stamina : has('fit') ? Math.min(99, ovr + 2) : null;
  return { ovr, pos, base, stars: st, hist, cards, complete: has('att') && has('def'), stats, auto, src, man, rounds: played, keys, stamina };
}
