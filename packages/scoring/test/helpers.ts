/// <reference types="node" />
// Loads every dataset the golden extractor runs on (real data + each fixture) and the matching
// golden files, so each test can compare the port with the prototype's own output.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { League, RatePart, RatingsDoc, Round } from '@chutbol/shared';
import { recomputeRatings } from '../src';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const GOLDEN = join(ROOT, 'packages/scoring/golden');
const FIXTURES = join(ROOT, 'packages/scoring/fixtures');

export interface Dataset {
  label: string;
  leagues: League[];
  /** rounds exactly as stored (old ratings included) */
  rounds: Round[];
  /** rounds after an admin "save": match ratings recomputed with the current formula (owner policy) */
  saved: Round[];
  ratingsFor: (leagueId: string) => RatingsDoc | undefined;
  /** golden file for this dataset, or undefined when the extractor wrote none */
  golden: <T = any>(rel: string) => T | undefined;
}

const readDir = <T>(dir: string): T[] =>
  existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T) : [];

function load(label: string, dir: string, prefix: string): Dataset {
  const leagues = readDir<League>(join(dir, 'leagues'));
  const rounds = readDir<Round>(join(dir, 'rounds'));
  const docs = readDir<RatingsDoc>(join(dir, 'ratings'));
  const ratingsFor = (lid: string) => docs.find(d => d.id === lid);
  const saved = rounds.map(r => recomputeRatings(r, ratingsFor(r.leagueId)));
  const golden = (rel: string) => {
    const p = join(GOLDEN, prefix, rel);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined;
  };
  return { label, leagues, rounds, saved, ratingsFor, golden };
}

export const datasets: Dataset[] = [
  load('real data', join(ROOT, 'docs/prototype/data'), ''),
  ...(existsSync(FIXTURES) ? readdirSync(FIXTURES).sort().map(n => load(`fixture ${n}`, join(FIXTURES, n), `fixtures/${n}`)) : []),
];

/** Same normalisation the extractor applies before writing JSON (sorted keys, Sets as arrays, no undefined). */
export function normalize(v: unknown): unknown {
  const tag = Object.prototype.toString.call(v);
  if (tag === '[object Set]') return [...(v as Set<unknown>)].map(normalize);
  if (tag === '[object Map]') return normalize(Object.fromEntries(v as Map<unknown, unknown>));
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) if ((v as Record<string, unknown>)[k] !== undefined) out[k] = normalize((v as Record<string, unknown>)[k]);
    return out;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return { $number: String(v) };
  return v;
}

/**
 * Hebrew text of a rating breakdown line, exactly as the prototype writes it. Lets the tests check
 * that each i18n key carries every number the prototype shows. (The app's i18n files come in stage 0b.)
 */
export function partLabelHe(x: RatePart): string {
  const p = x.params || {};
  switch (x.key) {
    case 'base': return 'בסיס';
    case 'draw00': return 'תיקו 0-0: בסיס 5.5';
    case 'teamScored': return `הקבוצה כבשה ${p.n} (0.5 לשער)`;
    case 'teamConceded': return `הקבוצה ספגה ${p.n} (0.5- לשער)`;
    case 'gkConceded': return `🧤 ספג ${p.n} (שער אחד = 5.5, כל שער נוסף −0.5)`;
    case 'cleanSheet': return `🧤 שער נקי, שוחקו ${p.pct}% מהמשחק`;
    case 'cleanSheetShort': return `🧤 שער נקי, אבל שוחקו רק ${p.pct}% (פחות מ-30%)`;
    case 'goals': return `⚽ ${p.n} גולים`;
    case 'assists': return `👟 ${p.n} בישולים`;
    case 'saves': return `🧤 ${p.n} הצלות`;
    case 'lateWinner': return '⏱ גול ניצחון בדקה האחרונה';
    case 'lateWinnerAssist': return '⏱ בישול לגול ניצחון בדקה האחרונה';
    case 'fastWin': return `⚡ ניצחון מהיר (${p.time} דקות)`;
    case 'lowTableWin': return `📊 נמוכה בטבלת המחזור (${p.pts} מול ${p.oppPts} נק׳), ניצחה (כפול)`;
    case 'lowTableDraw': return `📊 נמוכה בטבלת המחזור (${p.pts} מול ${p.oppPts} נק׳), תיקו`;
    case 'clampMin': return 'הציון המינימלי הוא 4';
    case 'clampMax': return 'הציון המקסימלי הוא 10';
  }
}

/** The prototype's style text for each OvrStyle key. */
export const STYLE_HE = { gk: 'שוער', complete: 'שחקן שלם', attacking: 'התקפי', defensive: 'הגנתי', engine: 'מנוע', balanced: 'מאוזן' } as const;

/** Golden files a dataset has for a given function folder, e.g. "teamDay" -> round ids. */
export const roundsWithGolden = (d: Dataset, fn: string, list: Round[] = d.saved) => list.filter(r => d.golden(`${fn}/${r.id}.json`) !== undefined);
