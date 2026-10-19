// Stage 0b demo: one real round from the prototype export, scored by @chutbol/scoring inside the app.
// Dev only. It bundles the league's ratings doc (stars are admin-only data), so it goes away in
// stage 1a, when data comes from Supabase with RLS.
import { matchGks, playsOf, rateMatch, recomputeRatings, score, team } from '@chutbol/scoring';
import type { Id, League, RatePart, RatingsDoc, Round } from '@chutbol/shared';
import leagueJson from '../../../../docs/prototype/data/leagues/27yhw7ktexr.json';
import ratingsJson from '../../../../docs/prototype/data/ratings/27yhw7ktexr.json';
import roundJson from '../../../../docs/prototype/data/rounds/wvwdfkwkos1.json';

export interface DemoPlayer {
  id: Id;
  name: string;
  rating: number;
  gk: boolean;
  parts: RatePart[];
}

export interface DemoSide {
  teamId: Id;
  name: string;
  color: string;
  goals: number;
  players: DemoPlayer[];
}

export interface DemoMatch {
  id: Id;
  n: number;
  home: DemoSide;
  away: DemoSide;
}

export interface DemoRound {
  number: number;
  matches: DemoMatch[];
}

export function buildDemoRound(league: League, ratings: RatingsDoc, stored: Round): DemoRound {
  // owner policy: the current formula is the truth, so recompute what old files stored
  const r = recomputeRatings(stored, ratings);
  const nameOf = (pid: Id) => league.players.find(p => p.id === pid)?.name ?? pid;
  const matches = r.matches
    .filter(m => m.status === 'done' && m.lu)
    .map((m): DemoMatch => {
      const x = rateMatch(r, m, ratings);
      const [h, a] = score(m);
      const gks = matchGks(m);
      const plays = playsOf(m);
      const side = (teamId: Id, goals: number): DemoSide => {
        const t = team(r, teamId);
        const players = Object.keys(x.ratings)
          .filter(pid => plays[pid] === teamId)
          .map(pid => ({ id: pid, name: nameOf(pid), rating: x.ratings[pid] ?? 0, gk: gks.has(pid), parts: x.parts[pid] ?? [] }))
          .sort((p, q) => q.rating - p.rating);
        return { teamId, name: t.name, color: t.color, goals, players };
      };
      return { id: m.id, n: m.n, home: side(m.home, h), away: side(m.away, a) };
    });
  return { number: r.number, matches };
}

let cache: DemoRound | undefined;
export const demoRound = (): DemoRound =>
  (cache ??= buildDemoRound(leagueJson as League, ratingsJson as RatingsDoc, roundJson as unknown as Round));
