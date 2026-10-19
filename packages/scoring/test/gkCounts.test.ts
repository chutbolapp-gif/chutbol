import { describe, expect, it } from 'vitest';
import { gkCounts } from '../src';
import { datasets, normalize, roundsWithGolden } from './helpers';

describe.each(datasets)('gkCounts – $label', d => {
  it.each(roundsWithGolden(d, 'gk').map(r => ({ id: r.id, r })))('round $id', ({ r }) => {
    const g = d.golden(`gk/${r.id}.json`);
    expect(Object.keys(g.teams).sort()).toEqual(r.teams.map(t => t.id).sort());
    for (const t of r.teams) expect(normalize(gkCounts(r, t.id)), t.id).toEqual(g.teams[t.id].counts);
  });
});
