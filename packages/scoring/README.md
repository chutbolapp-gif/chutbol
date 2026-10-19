# @chutbol/scoring

Pure scoring functions ported from the prototype (`docs/prototype/soccerfriends.html`).

## Using it

```ts
import { rateMatch, recomputeRatings, roundScores, teamDay, playerOVR, gkCounts, autoGk } from '@chutbol/scoring';

rateMatch(round, match, ratingsDoc);          // { ratings, str, parts } – parts are i18n keys + params
const saved = recomputeRatings(round, ratingsDoc); // what an admin "save" does: fresh m.ratings / m.str
roundScores(saved, 'field' | 'gk' | undefined);
teamDay(round);
playerOVR({ league, rounds: savedRounds, ratings: ratingsDoc, pid, role: 'f' | 'g', isAdmin });
gkCounts(round, teamId); autoGk(round, teamId);
```

roundScores, roundAwards and playerOVR read the stored match ratings (`m.ratings`), so pass rounds
that went through `recomputeRatings` (owner policy: the current formula is the truth).
Pure functions: no globals, no cache, no clock. Types live in `@chutbol/shared`.

Tests: one file per function in `test/`, each comparing with every golden file (real data and all
fixtures). `golden-up-to-date.test.ts` fails if the golden files are stale.

## Files

- `golden/` – expected outputs, produced by `pnpm golden` (never edit by hand).
  - `rateMatch/<roundId>.json` – rating and breakdown (parts) for every player in every match
  - `roundScores/<roundId>.json` – `field`, `gk` and `all`
  - `teamDay/<roundId>.json`
  - `gk/<roundId>.json` – `gkCounts` and `autoGk` per team
  - `playerOVR/<leagueId>.json` – every player × role (`f`, `g`) × viewer (`admin`, `member`)
  - `stored-vs-current.json` – stored match ratings that differ from the current formula
  - `_meta.json` – hashes of the prototype and every input file
- Policy: the current formula is the truth. Stored ratings are recomputed (the prototype's own
  `updateRatings`) before anything that reads them.
- `fixtures/<name>/{leagues,rounds,ratings}` – synthetic edge cases, written by `pnpm fixtures`
  (scripts/make-fixtures, where each case is described). Each gets golden output under
  `golden/fixtures/<name>/`. After changing a case: `pnpm fixtures`, then `pnpm golden`.
