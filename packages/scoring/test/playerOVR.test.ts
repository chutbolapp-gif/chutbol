import { describe, expect, it } from 'vitest';
import type { PlayerOvr } from '@chutbol/shared';
import { playerOVR } from '../src';
import { datasets, normalize, STYLE_HE } from './helpers';

// The prototype's result in the golden shape: style as Hebrew text, hist with round ids under `r`,
// plus the fields the prototype always fills with the same constant (the port leaves them out).
const asGolden = (o: PlayerOvr | null) => o && {
  ...o,
  pos: STYLE_HE[o.pos],
  hist: o.hist.map(({ roundId, ...h }) => ({ r: roundId, ...h })),
  raw: o.ovr, scaled: o.ovr, capped: false, attS: null, top: {}, bonus: 0, aw: { mvp: 0, top: 0, ast: 0, champ: 0 }, blendW: 0,
};

describe.each(datasets)('playerOVR – $label', d => {
  describe.each(d.leagues.map(l => ({ id: l.id, l })))('league $id', ({ l }) => {
    const g = d.golden(`playerOVR/${l.id}.json`);
    it('covers the same players', () => {
      const pids = new Set([...l.players.map(p => p.id), ...d.saved.filter(r => r.leagueId === l.id).flatMap(r => r.teams.flatMap(t => t.players))]);
      expect([...pids].sort()).toEqual(Object.keys(g.players).sort());
    });
    it.each(Object.keys(g.players))('player %s', pid => {
      for (const role of ['f', 'g'] as const) for (const isAdmin of [true, false]) {
        const v = playerOVR({ league: l, rounds: d.saved, ratings: d.ratingsFor(l.id), pid, role, isAdmin });
        expect(normalize(asGolden(v)), `${role} ${isAdmin ? 'admin' : 'member'}`).toEqual(g.players[pid][role][isAdmin ? 'admin' : 'member'] ?? null);
      }
    });
  });
});
