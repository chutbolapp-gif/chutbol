// Keeper rotation. Ported 1:1 from the prototype's gkCounts (1843) and autoGk (1844).
import type { Id, Round } from '@chutbol/shared';
import { matchGks, team } from './basics';

/** How many finished or live matches each roster player kept goal for this team. Outside keepers are not counted. */
export function gkCounts(r: Round, tid: Id): Record<Id, number> {
  const t = team(r, tid);
  const c: Record<Id, number> = {};
  r.matches.filter(m => (m.status === 'done' || m.status === 'live') && (m.home === tid || m.away === tid)).forEach(m => {
    const g = matchGks(m);
    const side = new Set(((m.lu || {})[tid] || { on: [] }).on || []);
    [...g].filter(p => side.has(p) && t.players.includes(p)).forEach(p => { c[p] = (c[p] || 0) + 1; });
  });
  return c;
}

/**
 * Next keeper for a team: from the drawn order (players no longer on the team dropped, new
 * players appended), skipping the player the opponent picked as keeper for the next match,
 * the one who kept goal the fewest times this evening, earliest in the order. Null without a drawn order.
 */
export function autoGk(r: Round, tid: Id): Id | null {
  const o = (r.gkOrder || {})[tid];
  if (!o) return null;
  const t = team(r, tid);
  const order = o.filter(p => t.players.includes(p)).concat(t.players.filter(p => !o.includes(p)));
  if (!order.length) return null;
  const cnt = gkCounts(r, tid);
  const opp = (r.nextPair || []).find(x => x !== tid);
  const oppGk = opp ? (r.nextGk || {})[opp] : null;
  const cand = order.filter(p => p !== oppGk);
  return cand.slice().sort((a, b) => (cnt[a] || 0) - (cnt[b] || 0) || order.indexOf(a) - order.indexOf(b))[0] || null;
}
