import { describe, expect, it } from 'vitest';
import { autoGk } from '../src';
import { datasets, roundsWithGolden } from './helpers';

describe.each(datasets)('autoGk – $label', d => {
  it.each(roundsWithGolden(d, 'gk').map(r => ({ id: r.id, r })))('round $id', ({ r }) => {
    const g = d.golden(`gk/${r.id}.json`);
    for (const t of r.teams) expect(autoGk(r, t.id), t.id).toEqual(g.teams[t.id].auto);
  });
});

it('the auto-gk fixture really picks players (the real data never does)', () => {
  const d = datasets.find(x => x.label === 'fixture auto-gk')!;
  const r = d.saved[0]!;
  expect([autoGk(r, 'tA'), autoGk(r, 'tB'), autoGk(r, 'tC')]).toEqual(['a3', 'b3', null]);
});
