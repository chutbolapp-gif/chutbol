// What the round screen shows, computed with @chutbol/scoring from a round loaded from Supabase.
// Pure (no React, no network), so tests run it on the imported data.
import { matchGks, playsOf, roundScores, score, standings, team } from '@chutbol/scoring';
import type { Id, RatePart, Round, StandingRow } from '@chutbol/shared';

export interface ViewPlayer { id: Id; name: string; rating: number; gk: boolean; parts: RatePart[] | null }
export interface ViewSide { teamId: Id; name: string; color: string; goals: number; players: ViewPlayer[] }
export interface ViewMatch { id: Id; n: number; home: ViewSide; away: ViewSide }
export interface ViewTableRow extends StandingRow { name: string; color: string }
export interface ViewScore { id: Id; name: string; n: number; avg: number; bonus: number; score: number }

export interface RoundView {
  number: number;
  status: string;
  voided: boolean;
  table: ViewTableRow[];
  /** player of the round (field) and keepers, best first */
  field: ViewScore[];
  keepers: ViewScore[];
  matches: ViewMatch[];
}

/**
 * @param names roster names by member id
 * @param parts 🔒 rating breakdowns (admin only); omit for members
 */
export function buildRoundView(r: Round, names: Record<Id, string>, parts: Record<Id, Record<Id, RatePart[]>> = {}): RoundView {
  const nameOf = (pid: Id) => names[pid] ?? pid;
  const table = standings(r).map(s => ({ ...s, name: team(r, s.id).name, color: team(r, s.id).color }));
  const scores = (kind: 'field' | 'gk'): ViewScore[] =>
    Object.entries(roundScores(r, kind))
      .filter(([, x]) => kind === 'field' || x.q)
      .map(([id, x]) => ({ id, name: nameOf(id), n: x.n, avg: x.avg, bonus: x.bonus, score: x.score }))
      .sort((a, b) => b.score - a.score || b.n - a.n);
  const matches = r.matches
    .filter(m => m.status === 'done' && m.lu)
    .map((m): ViewMatch => {
      const [h, a] = score(m);
      const gks = matchGks(m);
      const plays = playsOf(m);
      const ratings = m.ratings ?? {};
      const side = (teamId: Id, goals: number): ViewSide => {
        const t = team(r, teamId);
        const players = Object.keys(ratings)
          .filter(pid => plays[pid] === teamId)
          .map(pid => ({ id: pid, name: nameOf(pid), rating: ratings[pid]!, gk: gks.has(pid), parts: parts[m.id]?.[pid] ?? null }))
          .sort((p, q) => Number(q.gk) - Number(p.gk) || q.rating - p.rating);
        return { teamId, name: t.name, color: t.color, goals, players };
      };
      return { id: m.id, n: m.n, home: side(m.home, h), away: side(m.away, a) };
    });
  return {
    number: r.number, status: r.status, voided: !!r.voided, table,
    field: scores('field'), keepers: scores('gk'), matches,
  };
}
