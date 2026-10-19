# @chutbol/scoring

Pure scoring functions ported from the prototype (`docs/prototype/soccerfriends.html`).

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
