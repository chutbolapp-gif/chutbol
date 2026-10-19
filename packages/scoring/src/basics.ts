// Small building blocks shared by all scoring functions.
// Ported 1:1 from docs/prototype/soccerfriends.html (line numbers in comments).
// Expressions keep the prototype's operand order, so floating-point results are identical.
import type { Id, Match, MatchEvent, RatingsDoc, Round, Team } from '@chutbol/shared';

/** [home goals, away goals]. An own goal counts for the other team. (488) */
export function score(m: Match): [number, number] {
  let h = 0, a = 0;
  for (const e of m.events || []) {
    if (e.type === 'goal') { if (e.team === m.home) h++; else a++; }
    else if (e.type === 'own') { if (e.team === m.home) a++; else h++; }
  }
  return [h, a];
}

/** The opponent of `tid` in match `m`. (493) */
export const other = (m: Match, tid: Id): Id => (tid === m.home ? m.away : m.home);

/** Team by id, or an empty placeholder. (471) */
export function team(r: Round, tid: Id): Team {
  return r.teams.find(t => t.id === tid) || { id: tid, name: '', color: '#888', players: [] };
}

/** The team whose roster has this player (undefined for an outside keeper). (472) */
export function teamOf(r: Round, pid: Id): Team | undefined {
  return r.teams.find(t => t.players.includes(pid));
}

export const isGoal = (e: MatchEvent): boolean => e.type === 'goal' || e.type === 'own'; // (878)

/** Stars, or 3 when not set. (477) */
export const rv = (v: number | null | undefined): number => (v == null ? 3 : v);

/** Stars set by the organiser for the league. (475) */
export function baseRating(doc: RatingsDoc | undefined, pid: Id): number | null {
  const v = (doc?.r || {})[pid];
  return typeof v === 'number' ? v : null;
}

/** Stars for this round: a per-round override, else the league stars. (476) */
export function roundRating(doc: RatingsDoc | undefined, r: Round, pid: Id): number | null {
  const o = doc?.rounds && doc.rounds[r.id] ? doc.rounds[r.id]![pid] : undefined;
  return typeof o === 'number' ? o : baseRating(doc, pid);
}

/** Sum of stars × 20 for a lineup. (930) */
export function teamStrength(doc: RatingsDoc | undefined, r: Round, ids: Id[]): number {
  return ids.reduce((s, p) => s + rv(roundRating(doc, r, p)) * 20, 0);
}

const side = (m: Match, t: Id) => (m.lu ? m.lu[t] : undefined);

/** Players on the pitch at kick-off per team, undoing substitutions. (928) */
export function initialLineup(m: Match): Record<Id, Id[]> {
  const lu: Record<Id, Id[]> = {};
  [m.home, m.away].forEach(t => { lu[t] = ((side(m, t) && side(m, t)!.on) || []).slice(); });
  (m.events || []).slice().reverse().forEach(e => {
    if (e.type === 'sub' && lu[e.team]) lu[e.team] = lu[e.team]!.map(p => (p === e.in ? e.out! : p));
  });
  return lu;
}

/** Everyone who played, mapped to their team. (967) */
export function playsOf(m: Match): Record<Id, Id> {
  const lu0 = initialLineup(m);
  const pl: Record<Id, Id> = {};
  [m.home, m.away].forEach(t => {
    (lu0[t] || []).forEach(p => (pl[p] = t));
    ((side(m, t) || ({} as { on?: Id[] })).on || []).forEach(p => (pl[p] = t));
  });
  (m.events || []).forEach(e => {
    if (e.type === 'sub') { pl[e.in!] = e.team; if (!pl[e.out!]) pl[e.out!] = e.team; }
  });
  return pl;
}

/** [start, end] of the match in device time. (969) */
export function matchWindow(m: Match): [number, number] {
  const s0 = m.startedAt || 0;
  let e0 = m.endedAt;
  if (!e0) {
    const ats = (m.events || []).map(e => e.at || 0);
    e0 = Math.max(s0 + ((m.timer && m.timer.acc) || (+m.dur || 7) * 60000), ...ats);
  }
  return [s0, e0];
}

/** Time intervals a player was on the pitch for `team`. (970) */
export function onIntervals(m: Match, pid: Id, teamId: Id): [number, number][] {
  const lu0 = initialLineup(m);
  const [s0, e0] = matchWindow(m);
  let cur: number | null = (lu0[teamId] || []).includes(pid) ? s0 : null;
  const iv: [number, number][] = [];
  (m.events || [])
    .filter(e => e.type === 'sub' && e.team === teamId && (e.in === pid || e.out === pid))
    .sort((a, b) => (a.at || 0) - (b.at || 0))
    .forEach(e => {
      if (e.out === pid && cur != null) { iv.push([cur, e.at || e0]); cur = null; }
      else if (e.in === pid && cur == null) cur = e.at || s0;
    });
  if (cur != null) iv.push([cur, e0]);
  return iv;
}

/** Seconds in goal per player, or null when it cannot be known (no start time, or a switch without device time). (1084) */
export function gkSeconds(m: Match): Record<Id, number> | null {
  const out: Record<Id, number> = {};
  const s0 = m.startedAt;
  if (!s0) return null;
  const end = m.endedAt || s0 + ((m.timer && m.timer.acc) || (+m.dur || 7) * 60000);
  for (const t of [m.home, m.away]) {
    let cur = (m.gk0 || {})[t] || (side(m, t) && side(m, t)!.gk);
    let since = s0;
    const sw = (m.events || []).filter(e => e.type === 'gk' && e.team === t).sort((a, b) => (a.at || 0) - (b.at || 0));
    if (sw.some(e => !e.at)) return null;
    for (const e of sw) {
      if (cur) out[cur] = (out[cur] || 0) + Math.max(0, e.at! - since) / 1000;
      cur = e.p;
      since = e.at!;
    }
    if (cur) out[cur] = (out[cur] || 0) + Math.max(0, end - since) / 1000;
  }
  return out;
}

/**
 * Who really kept goal: at least a minute in goal, or a save, or a goal conceded while in goal.
 * A player who stood in goal for a few seconds is rated as a field player. (1087)
 */
export function matchGks(m: Match): Set<Id> {
  const luGks = [m.home, m.away].map(t => side(m, t) && side(m, t)!.gk);
  const all = [...luGks, ...Object.values(m.gk0 || {}), ...(m.events || []).filter(e => e.type === 'gk').map(e => e.p)]
    .filter(Boolean) as Id[];
  const secs = gkSeconds(m);
  if (!secs) return new Set([...luGks, ...Object.values(m.gk0 || {})].filter(Boolean) as Id[]);
  const ev = m.events || [];
  return new Set(all.filter(p => (secs[p] || 0) >= 60 || ev.some(e =>
    (e.type === 'save' && e.p === p) || (e.type === 'pen' && e.res === 'saved' && e.gka === p) || ((e.type === 'goal' || e.type === 'own') && e.gka === p))));
}
