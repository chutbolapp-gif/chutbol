# What the scoring reads from the data (input for stage 1a)

> בקצרה: זו רשימת כל השדות שחבילת הציונים קוראת. כל שדה כאן חייב להישמר בבסיס הנתונים (Supabase) בשלב 1א,
> אחרת הציונים לא ייצאו זהים לאב-הטיפוס. השדות המסומנים 🔒 סודיים: רק מנהל קורא אותם.

Source of truth for the shapes: `packages/shared/src/index.ts` (TypeScript types) and the prototype export in
`docs/prototype/data`. Field names below are the prototype's; the database may use snake_case, but the import
script and the app must map them back exactly.

## Who reads what

| Function | Reads |
| --- | --- |
| `rateMatch(round, match, ratings)` | match: home, away, n, dur, status, lu, gk0, startedAt, endedAt, timer.acc, events, str · round: matches (earlier results this round) · 🔒 ratings: stars (only when the match has no stored `str`) |
| `recomputeRatings(round, ratings)` | everything rateMatch reads; writes `match.ratings` and `match.str` |
| `roundScores(round, kind)` | round: status, voided, teams, matches (status, lu, events, **stored ratings**), manualOrder, koRank |
| `teamDay(round)` | round: teams, matches (status, n, events), manualOrder, koRank |
| `playerOVR({league, rounds, ratings, pid, role, isAdmin})` | all finished rounds of the league (created, status, voided, teams, matches, stored ratings) · league: players[].cards 🔒 · ratings 🔒: r (stars), attr (manual stats, admin only) |
| `gkCounts(round, team)` | round: teams, matches (status done/live, lu, gk0, events, startedAt, endedAt, timer.acc) |
| `autoGk(round, team)` | gkCounts inputs + round: gkOrder, nextPair, nextGk |

## Fields

### League
| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `players[]` | `{ id, name, cards? }` | roster of the league. |
| `players[].cards` 🔒 | `('att' \| 'def' \| 'fit')[]` | organiser's cards. Shape the OVR card face and playing style. Secret: belongs in `member_secrets`, not the public players table. |

Not read by scoring: settings, balances, ovrPub (published OVR is what members see; it is a copy of
playerOVR output taken when the admin publishes).

### Ratings doc 🔒 (one per league, admin only)
| Field | Type | Notes |
| --- | --- | --- |
| `r[playerId]` | number 0.5-5 | stars. Missing = 3. Sets team strength and the starting OVR (STAR_OVR). |
| `rounds[roundId][playerId]` | number | per-round star override, used only for team strength in that round. |
| `attr[playerId][role]` | `{ pace, shooting, …, stamina, control? }` 30-99 | manual OVR stats. Only applied when `isAdmin`. `control` is an old name for dribbling. |

Suggested tables: `member_secrets` (stars, cards), `rating_parts` / `ovr_manual` (attr). Members must never
read any of these (RLS + SQL tests as a regular member).

### Round
| Field | Type | Notes |
| --- | --- | --- |
| `id`, `leagueId` | id | |
| `created` | ms timestamp | orders the rounds of a league for playerOVR. Must be stable and unique per league. |
| `status` | `'setup' \| 'live' \| 'done'` | only `done` rounds count for OVR, awards and champion bonus. |
| `voided` | boolean | "stopped without points": no champion bonus, no awards, `place` = 0 in mental. |
| `teams[]` | `{ id, players: id[] }` | roster per team **for this round**. An outside keeper is NOT in `players`. |
| `matches[]` | Match | see below. |
| `manualOrder` | id[] | organiser's order for teams level on everything (table tie-break). |
| `koRank` | `[championId, runnerUpId]` | knockout result; overrides points in the table. |
| `gkOrder[teamId]` | id[] | drawn keeper rotation order. |
| `nextPair` | `[teamId, teamId]` | teams of the next match. |
| `nextGk[teamId]` | id | keeper already chosen for the next match. |

Not read by scoring: number, season, attendees (charges), fixtures/format (only drive the UI that sets koRank
and koWinner), clips, queue, streak.

### Match
| Field | Type | Notes |
| --- | --- | --- |
| `id` | id | |
| `n` | int | order in the round. "Points earlier in the round" (low-table bonus) and teamDay use it. |
| `home`, `away` | team id | |
| `dur` | minutes | planned length. Last-minute winner = goal with `min >= dur`. |
| `status` | `'setup' \| 'live' \| 'done'` | scoring uses `done` (gkCounts also `live`). |
| `startedAt`, `endedAt` | ms (device time) | keeper seconds, minutes on pitch. Without `startedAt` keeper detection falls back to kick-off keepers. |
| `timer.acc` | ms | how long the match actually ran. Drives fast-win bonus and clean-sheet share. |
| `lu[teamId]` | `{ gk, on: id[] }` | kick-off lineup and keeper. A match without `lu` is ignored entirely. |
| `gk0[teamId]` | id | keeper at kick-off (kept separately because `lu.gk` changes during the match). |
| `events[]` | Event | see below. |
| `ratings[playerId]` | number 4-10 | stored match ratings. roundScores, awards and OVR read these. |
| `str[teamId]` | number | team strength at kick-off, stored with ratings. Once stored it is never recomputed. |
| `koWinner` | team id | knockout draw decided on penalties. Read by the UI only; **match ratings treat it as a draw**. |

Decision for 1a (recommended): store `ratings` and `str` on the server, written by the same code
(`recomputeRatings`) every time a finished match or round is saved, so reads are cheap and history is fixed.

### Event
Every event: client-generated UUID `id`, `type`, `team`, `min` (1-based clock minute), `at` (device time of the
recording phone). Server also stores its receive time, but scoring uses only `at` and `min`.

| type | fields read | used for |
| --- | --- | --- |
| `goal` | team, p (scorer), a (assist), gka (keeper beaten), min, at | score, ratings, last-minute winner, keeper conceded, defending |
| `own` | team (team of the player who scored it), p, gka (own keeper), at | score (counts for the other team), keeper conceded |
| `save` | p (keeper) | keeper saves, keeper detection |
| `pen` | res (`saved`/`miss`), gka | a saved penalty counts as a save for `gka` |
| `key` | p | key passes (passing, gkFeet) |
| `shot` | p | good shots (shooting) |
| `def` | p | defensive actions (defending) |
| `sub` | team, in, out, at | lineups, minutes on pitch |
| `gk` | team, p (new keeper), at | keeper seconds. **A `gk` event without `at` disables keeper timing for the whole match.** |
| `card` | p, c, second | playerStats only (not ratings) |

Rules that matter for the schema:
- `gka` must be filled when the goal is recorded (the keeper on the other side at that moment; for an own goal,
  the player's own keeper). If no goal in a match has `gka`, keepers are charged with all goals against.
- `at` must always be set for `sub` and `gk` events (offline: device time is fine).
- `min` is what the clock showed (`floor(elapsed / 60s) + 1`), not computed later from `at`.

## Prototype behaviours kept as they are (owner decision, 2026-10-19)

The port reproduces these exactly; each is covered by a fixture. Change only by a new owner decision.
1. Knockout draw decided on penalties: match ratings treat it as a draw for both teams (no win bonus for the
   team that went through). Only the table/champion use `koRank`. (fixture `ko-penalties`)
2. teamDay score can go above 1 for a team that has more points than the knockout champion. (`ko-penalties`)
3. Fast win of 2 minutes or less: the winning keeper gets neither the fast-win bonus nor a clean-sheet bonus
   (under 30% of the match played). (`fast-win`)
4. A voided round still moves players' OVR (it is a finished round); only awards and the title bonus are
   removed. (`voided-round`)

Also worth knowing: when a team is not in `nextPair`, `autoGk` treats the first team of `nextPair` as its
opponent; a keeper who is detected by time but conceded no tracked goal in a match where goals were scored
gets neither "conceded" nor "clean sheet" lines (`gk-under-minute`, m2).
