import { describe, expect, it } from 'vitest';
import { roundScores } from '../src';
import { datasets, normalize, roundsWithGolden } from './helpers';

// Golden roundScores: field players, keepers and everyone, after ratings were recomputed.
describe.each(datasets)('roundScores – $label', d => {
  it.each(roundsWithGolden(d, 'roundScores').map(r => ({ id: r.id, r })))('round $id', ({ r }) => {
    const g = d.golden(`roundScores/${r.id}.json`);
    expect(normalize(roundScores(r, 'field'))).toEqual(g.field);
    expect(normalize(roundScores(r, 'gk'))).toEqual(g.gk);
    expect(normalize(roundScores(r))).toEqual(g.all);
  });
});
