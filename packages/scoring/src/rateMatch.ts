// Player match ratings (4-10). Ported 1:1 from the prototype's rateMatch (932) and updateRatings (955).
// The prototype builds Hebrew breakdown lines; here each line is an i18n key + params.
import type { Id, Match, RatePart, RatePartKey, RateMatchResult, RatingsDoc, Round } from '@chutbol/shared';
import { initialLineup, matchGks, other, score, teamStrength } from './basics';

export function rateMatch(r: Round, m: Match, ratings?: RatingsDoc): RateMatchResult {
  const [h, a] = score(m);
  const GF: Record<Id, number> = { [m.home]: h, [m.away]: a };
  const ev = m.events || [];
  const lu = m.lu || {};
  const lu0 = initialLineup(m);
  const plays: Record<Id, Id> = {};
  [m.home, m.away].forEach(t => {
    lu0[t]!.forEach(p => (plays[p] = t));
    (lu[t]!.on || []).forEach(p => (plays[p] = t));
  });
  ev.forEach(e => { if (e.type === 'sub') { plays[e.in!] = e.team; if (!plays[e.out!]) plays[e.out!] = e.team; } });
  const win = h > a ? m.home : a > h ? m.away : null;
  const str = m.str || { [m.home]: teamStrength(ratings, r, lu0[m.home]!), [m.away]: teamStrength(ratings, r, lu0[m.away]!) };
  const clock = (m.timer && m.timer.acc) || 0;

  // last-minute winner: the goal that put the winner ahead for good, scored in minute >= dur (936)
  let wg: (typeof ev)[number] | null = null;
  if (win) {
    const sc: Record<Id, number> = { [m.home]: 0, [m.away]: 0 };
    const lose = other(m, win);
    let cand: (typeof ev)[number] | null = null;
    ev.filter(e => e.type === 'goal' || e.type === 'own').forEach(e => {
      const st = e.type === 'goal' ? e.team : other(m, e.team);
      const before = sc[win]! - sc[lose]!;
      sc[st]!++;
      const after = sc[win]! - sc[lose]!;
      if (st === win && before === 0 && after === 1) cand = e;
      if (after <= 0) cand = null;
    });
    const c = cand as (typeof ev)[number] | null;
    if (c && c.type === 'goal' && c.min! >= m.dur) wg = c;
  }

  const out: Record<Id, number> = {}, parts: Record<Id, RatePart[]> = {};
  // points each team collected earlier in this round (940)
  const LP: Record<Id, number> = { [m.home]: 0, [m.away]: 0 };
  r.matches.filter(x => x.status === 'done' && x.n < m.n).forEach(x => {
    const [xh, xa] = score(x);
    ([[x.home, xh, xa], [x.away, xa, xh]] as const).forEach(([tid, f, g]) => { if (tid in LP) LP[tid]! += f > g ? 3 : f === g ? 1 : 0; });
  });
  const hasGka = ev.some(e => (e.type === 'goal' || e.type === 'own') && e.gka);
  const fr = Math.min(1, clock / ((+m.dur || 7) * 60000));
  const GKS = matchGks(m);

  Object.entries(plays).forEach(([p, t]) => {
    const o = other(m, t);
    const isGk = GKS.has(p);
    const P: RatePart[] = [{ key: 'base', v: 5 }];
    const add = (key: RatePartKey, v: number, params?: RatePart['params']) => { if (v) P.push(params ? { key, v, params } : { key, v }); };
    if (h === 0 && a === 0 && !isGk) add('draw00', .5);
    if (!isGk) add('teamScored', .5 * GF[t]!, { n: GF[t]! });
    if (isGk) {
      const c = hasGka ? ev.filter(e => (e.type === 'goal' || e.type === 'own') && e.gka === p).length : GF[o]!;
      if (c > 0) add('gkConceded', .5 - .5 * (c - 1), { n: c });
      if (GF[o] === 0) {
        const b = fr > .7 ? 1.5 : fr >= .5 ? 1 : fr >= .3 ? .5 : 0;
        add('cleanSheet', b, { pct: Math.round(fr * 100) });
        if (!b) P.push({ key: 'cleanSheetShort', v: 0, params: { pct: Math.round(fr * 100) } });
      }
    } else add('teamConceded', -.5 * GF[o]!, { n: GF[o]! });
    const g = ev.filter(e => e.type === 'goal' && e.p === p).length,
      as = ev.filter(e => e.type === 'goal' && e.a === p).length,
      sv = ev.filter(e => (e.type === 'save' && e.p === p) || (e.type === 'pen' && e.res === 'saved' && e.gka === p)).length;
    add('goals', g, { n: g }); add('assists', .5 * as, { n: as }); add('saves', .5 * sv, { n: sv });
    if (wg) { if (wg.p === p) add('lateWinner', 2); if (wg.a === p) add('lateWinnerAssist', 1); }
    if (win === t && !isGk) {
      const mm = Math.floor(clock / 60000) + ':' + String(Math.floor(clock % 60000 / 1000)).padStart(2, '0');
      if (clock <= 120000) add('fastWin', 1, { time: mm }); else if (clock <= 300000) add('fastWin', .5, { time: mm });
    }
    {
      const gap = LP[o]! - LP[t]!;
      const b = gap > 15 ? 1.5 : gap > 12 ? 1 : gap > 9 ? .5 : 0;
      if (b && (win === t || !win)) {
        const params = { pts: LP[t]!, oppPts: LP[o]! };
        if (win === t) add('lowTableWin', b * 2, params); else add('lowTableDraw', b, params);
      }
    }
    const raw = P.reduce((acc, x) => acc + x.v, 0);
    const fin = Math.round(Math.max(4, Math.min(10, raw)) * 10) / 10;
    if (fin !== Math.round(raw * 10) / 10) P.push({ key: fin === 4 ? 'clampMin' : 'clampMax', v: Math.round((fin - raw) * 10) / 10 });
    out[p] = fin;
    parts[p] = P;
  });
  return { ratings: out, str, parts };
}

/**
 * What the prototype does when an admin saves a round (updateRatings): every finished match
 * with a lineup gets fresh `ratings` and `str`. Returns a new round; the input is not changed.
 * roundScores, roundAwards and playerOVR read these stored ratings.
 */
export function recomputeRatings(r: Round, ratings?: RatingsDoc): Round {
  const matches = r.matches.slice();
  const next: Round = { ...r, matches };
  matches.forEach((m, i) => {
    if (m.status !== 'done' || !m.lu) return;
    const x = rateMatch(next, m, ratings);
    matches[i] = { ...m, str: x.str, ratings: x.ratings };
  });
  return next;
}
