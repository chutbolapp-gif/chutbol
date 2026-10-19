// CLI for the prototype import (see seed.ts).
//   pnpm import:seed          rewrite supabase/seed.sql
//   pnpm import:seed --check  fail if supabase/seed.sql is stale
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DATA, SEED, readDataset, seedSql } from './seed';

const sql = seedSql(readDataset(DATA));
if (process.argv.includes('--check')) {
  const now = existsSync(SEED) ? readFileSync(SEED, 'utf8') : '';
  if (now !== sql) { console.error('supabase/seed.sql is out of date. Run `pnpm import:seed`.'); process.exit(1); }
  console.log('supabase/seed.sql is up to date');
} else {
  writeFileSync(SEED, sql);
  console.log(`wrote supabase/seed.sql (${sql.length} bytes)`);
}