/// <reference types="node" />
// The round screen, fed with the imported rows exactly as Supabase returns them, shows the golden
// numbers: stored match ratings, player-of-the-round scores and the round table.
import { describe, expect, it } from 'vitest';
import { standings } from '@chutbol/scoring';
import { roundFromRows } from '@chutbol/shared';
import { datasets } from '../../../packages/scoring/test/helpers';
import { readDataset, DATA, TEST_USERS } from '../../../scripts/import-prototype/seed';
import { toRows } from '../../../scripts/import-prototype/rows';
import { buildRoundView } from '../src/data/roundView';

const rows = toRows(readDataset(DATA), TEST_USERS);
const round6 = rows.rounds.find(r => r.league_id === '27yhw7ktexr' && r.number === 6)!;
const mids = new Set(rows.matches.filter(m => m.round_id === round6.id).map(m => m.id));
const round = roundFromRows({
  round: round6,
  teams: rows.teams.filter(t => t.round_id === round6.id),
  teamPlayers: rows.teamPlayers.filter(p => rows.teams.some(t => t.round_id === round6.id && t.id === p.team_id)),
  matches: rows.matches.filter(m => m.round_id === round6.id),
  events: rows.events.filter(e => mids.has(e.match_id)),
  ratings: rows.ratings.filter(r => mids.has(r.match_id)),
});
const names = Object.fromEntries(rows.members.map(m => [m.id, m.name]));
const golden = datasets.find(d => d.label === 'real data')!;

describe('round screen (real round 6 from the imported rows)', () => {
  const view = buildRoundView(round, names);

  it('shows every finished match with the golden ratings', () => {
    expect(view.number).toBe(6);
    expect(view.matches.length).toBe(15);
    const g = golden.golden(`rateMatch/${round.id}.json`);
    for (const m of view.matches) {
      const players = [...m.home.players, ...m.away.players];
      expect(players.length, m.id).toBe(Object.keys(g.matches[m.id].ratings).length);
      for (const p of players) expect(p.rating, p.name).toBe(g.matches[m.id].ratings[p.id]);
      // members get no breakdown
      expect(players.every(p => p.parts === null)).toBe(true);
    }
  });

  it('player-of-the-round scores are the golden roundScores', () => {
    const g = golden.golden(`roundScores/${round.id}.json`);
    for (const x of view.field) expect(x.score, x.name).toBe(g.field[x.id].score);
    expect(view.field.length).toBe(Object.keys(g.field).length);
    for (let i = 1; i < view.field.length; i++) expect(view.field[i - 1]!.score).toBeGreaterThanOrEqual(view.field[i]!.score);
  });

  it('the table is the scoring standings with team names', () => {
    expect(view.table.map(r => r.id)).toEqual(standings(round).map(r => r.id));
    expect(view.table.every(r => r.name && r.color)).toBe(true);
  });

  it('admins get the breakdown they pass in', () => {
    const parts = { [view.matches[0]!.id]: { [view.matches[0]!.home.players[0]!.id]: [{ key: 'base' as const, v: 5 }] } };
    const v = buildRoundView(round, names, parts);
    expect(v.matches[0]!.home.players[0]!.parts).toEqual([{ key: 'base', v: 5 }]);
  });
});