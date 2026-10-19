/// <reference types="node" />
// The app's Hebrew for rating breakdowns must be the prototype's text exactly: checked against the
// prototype's own text in the golden rateMatch files (real data and all fixtures), and for every key
// against packages/scoring/test/helpers.ts (partLabelHe, STYLE_HE).
import { describe, expect, it } from 'vitest';
import type { OvrStyle, RatePart, RatePartKey } from '@chutbol/shared';
import { rateMatch } from '@chutbol/scoring';
import { datasets, partLabelHe, roundsWithGolden, STYLE_HE } from '../../../packages/scoring/test/helpers';
import { en } from '../src/i18n/en';
import { he } from '../src/i18n/he';
import { createI18n, partLabel, partValue, styleLabel } from '../src/i18n/i18n';

const ALL_KEYS: RatePartKey[] = [
  'base', 'draw00', 'teamScored', 'teamConceded', 'gkConceded', 'cleanSheet', 'cleanSheetShort',
  'goals', 'assists', 'saves', 'lateWinner', 'lateWinnerAssist', 'fastWin', 'lowTableWin', 'lowTableDraw',
  'clampMin', 'clampMax',
];

/** Every breakdown line of every golden match: the port's part and the prototype's own Hebrew text. */
function goldenParts(): { part: RatePart; label: string }[] {
  const out: { part: RatePart; label: string }[] = [];
  for (const d of datasets) {
    for (const r of roundsWithGolden(d, 'rateMatch')) {
      const g = d.golden<{ matches: Record<string, { parts: Record<string, [string, number][]> }> }>(`rateMatch/${r.id}.json`)!;
      for (const [mid, gm] of Object.entries(g.matches)) {
        const x = rateMatch(r, r.matches.find(m => m.id === mid)!, d.ratingsFor(r.leagueId));
        for (const [pid, ps] of Object.entries(x.parts)) ps.forEach((part, i) => out.push({ part, label: gm.parts[pid]![i]![0] }));
      }
    }
  }
  return out;
}

const keyPaths = (o: object, pre = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [pre + k] : keyPaths(v as object, `${pre}${k}.`)));

describe('i18n', () => {
  const t = createI18n('he').t;

  it('Hebrew breakdown lines are the prototype text for every golden part', () => {
    const parts = goldenParts();
    expect(parts.length).toBeGreaterThan(100);
    for (const { part, label } of parts) expect(partLabel(t, part)).toBe(label);
  });

  it('Hebrew matches the prototype for every key, with sample params', () => {
    const params = { n: 3, pct: 45, time: '1:52', pts: 0, oppPts: 12 };
    for (const key of ALL_KEYS) {
      const x: RatePart = { key, v: 1, params };
      expect(partLabel(t, x)).toBe(partLabelHe(x));
    }
  });

  it('style names match the prototype', () => {
    for (const s of Object.keys(STYLE_HE) as OvrStyle[]) expect(styleLabel(t, s)).toBe(STYLE_HE[s]);
  });

  it('English has the same keys and placeholders as Hebrew', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(he).sort());
    const get = (o: object, p: string) => p.split('.').reduce<any>((a, k) => a[k], o) as string;
    const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
    for (const p of keyPaths(he)) expect(vars(get(en, p)), p).toEqual(vars(get(he, p)));
  });

  it('English breakdown fills in the numbers', () => {
    const tEn = createI18n('en').t;
    expect(partLabel(tEn, { key: 'goals', v: 2, params: { n: 2 } })).toBe('⚽ 2 goals');
    expect(partLabel(tEn, { key: 'fastWin', v: 1, params: { time: '1:52' } })).toBe('⚡ Fast win (1:52 minutes)');
  });

  it('values are formatted like the prototype', () => {
    expect(partValue({ key: 'base', v: 5 })).toBe('5');
    expect(partValue({ key: 'goals', v: 2, params: { n: 2 } })).toBe('+2');
    expect(partValue({ key: 'teamConceded', v: -1.5, params: { n: 3 } })).toBe('-1.5');
    expect(partValue({ key: 'assists', v: 0.5, params: { n: 1 } })).toBe('+0.5');
  });
});
