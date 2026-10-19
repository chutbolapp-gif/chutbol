import { describe, expect, it } from 'vitest';
import { teamDay } from '../src';
import { datasets, normalize, roundsWithGolden } from './helpers';

describe.each(datasets)('teamDay – $label', d => {
  it.each(roundsWithGolden(d, 'teamDay').map(r => ({ id: r.id, r })))('round $id', ({ r }) => {
    expect(normalize(teamDay(r))).toEqual(d.golden(`teamDay/${r.id}.json`).teamDay);
  });
});
