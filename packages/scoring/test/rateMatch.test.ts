import { describe, expect, it } from 'vitest';
import { rateMatch } from '../src';
import { datasets, normalize, partLabelHe, roundsWithGolden } from './helpers';

// Golden rateMatch: every finished match with a lineup, current formula.
describe.each(datasets)('rateMatch – $label', d => {
  const rounds = roundsWithGolden(d, 'rateMatch');
  it.skipIf(!rounds.length)('has golden files', () => expect(rounds.length).toBeGreaterThan(0));
  describe.each(rounds.map(r => ({ id: r.id, r })))('round $id', ({ r }) => {
    const g = d.golden(`rateMatch/${r.id}.json`);
    it('rates the same matches', () => {
      const ids = r.matches.filter(m => m.status === 'done' && m.lu).map(m => m.id).sort();
      expect(ids).toEqual(Object.keys(g.matches).sort());
    });
    it.each(Object.keys(g.matches))('match %s', mid => {
      const m = r.matches.find(x => x.id === mid)!;
      const x = rateMatch(r, m, d.ratingsFor(r.leagueId));
      const parts = Object.fromEntries(Object.entries(x.parts).map(([p, P]) => [p, P.map(part => [partLabelHe(part), part.v])]));
      expect(normalize({ n: m.n, ratings: x.ratings, str: x.str, parts })).toEqual(g.matches[mid]);
    });
  });
});
