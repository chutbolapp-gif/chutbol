/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('golden files', () => {
  it('match what the prototype produces today, and are deterministic', () => {
    // Fails if the prototype, the data or the extractor changed without `pnpm golden`.
    const out = execFileSync(process.execPath, ['scripts/extract-golden/index.mjs', '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('golden is up to date');
  }, 60_000);
});
