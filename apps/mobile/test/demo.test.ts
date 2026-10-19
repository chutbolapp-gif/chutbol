/// <reference types="node" />
// The demo screen's numbers are the golden ones (same as the prototype after an admin save).
import { describe, expect, it } from 'vitest';
import { datasets } from '../../../packages/scoring/test/helpers';
import { demoRound } from '../src/demo/round';

describe('demo round', () => {
  it('shows the golden match ratings of real round 6', () => {
    const d = datasets.find(x => x.label === 'real data')!;
    const r = demoRound();
    expect(r.number).toBe(6);
    expect(r.matches.length).toBe(15);
    const saved = d.saved.find(x => x.number === 6 && x.matches.length === 15)!;
    for (const m of r.matches) {
      const stored = saved.matches.find(x => x.id === m.id)!;
      for (const p of [...m.home.players, ...m.away.players]) expect(p.rating, p.name).toBe(stored.ratings![p.id]);
      // everyone rated appears exactly once
      expect(m.home.players.length + m.away.players.length).toBe(Object.keys(stored.ratings!).length);
    }
  });
});
