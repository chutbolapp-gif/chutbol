# Chutbol
Neighborhood football league app. React Native + Expo (TypeScript), Supabase backend.
Hebrew first (RTL), English second. All user-facing text via i18n keys.

## Source of truth
- docs/spec.md: the commercial spec (export of the Claude Doc "Chutbol – אפיון מסחרי ותוכנית עבודה").
- docs/prototype/soccerfriends.html: the working prototype (single HTML file). When behavior or wording is unclear, match the prototype. The prototype is frozen: never edit it.
- docs/prototype/data: real league data exported from the prototype (leagues, rounds, ratings). Use it for tests and for the import script. It has NO phone numbers and NO photos (those need a separate export).
- packages/scoring/golden: expected outputs produced by running the prototype's own functions on docs/prototype/data. This is what "same as the prototype" means. Regenerate with `pnpm golden`; `pnpm golden:check` fails if they are stale.
- Ratings policy (owner decision, 2026-10-18): the CURRENT formula is the truth. Ratings stored in old round files came from an older formula; they are recomputed (prototype updateRatings) before roundScores/playerOVR. Differences: packages/scoring/golden/stored-vs-current.json.

## Scoring package (packages/scoring)
- Port rateMatch, roundScores, playerOVR, teamDay, gkCounts/autoGk together with their FULL dependency tree (standings, roundAwards, roundAttrs, ratingAgg, roundRaw, teamStrength, initialLineup, matchGks, starBase, pCards, manualAttr, leagueRounds, teamOf and anything else they call, plus constants like OVR_K, OVR_MIN/MAX, STAR_OVR, and the OVRC cache). The full, generated list is docs/scoring-deps.md. GF, GKS, LP and TD are local variables inside rateMatch/playerOVR, not globals.
- Pure functions only: no globals, no UI state (the prototype's playerOVR reads S.admin; pass that in as an explicit argument), no I/O, no Date.now(). Inputs and outputs are typed in packages/shared.
- Every change must keep all golden tests green. Never "fix" a formula to make a test pass; if the prototype looks wrong, stop and ask.
- Real data covers only one played evening (round 6), so synthetic edge-case fixtures live in packages/scoring/fixtures (written by `pnpm fixtures`, scripts/make-fixtures). Prototype behaviours the owner chose to keep are listed in docs/scoring-data-needs.md.

## Data rules
- Postgres RLS filters ROWS, not columns. Secret data lives in separate tables that only admins can read: member_secrets (stars, cards, balance, phone), rating_parts, unpublished OVR. Never put a secret column in a table that members can read.
- Never show secret data (stars, cards, rating breakdowns, unpublished OVR, phone numbers, balances) to non-admins. Exceptions: a player can read their own balance. Enforce in RLS and test it with SQL tests that run as a regular member.

## Offline and sync (live match)
- Live match screens must work offline and sync later. One tap per action.
- Every event gets a client-generated UUID, is written first to a local outbox (expo-sqlite) and sent when online. Server inserts are idempotent (upsert on id).
- Store both device time and server receive time. Event order in a match uses the device time of the recording phone.
- One phone "owns" the live match (holds the lock). A second admin sees it read-only until they take over.

## Dev environment
- Expo SDK is pinned to 57 (owner's phone: Expo Go SDK 57, tested on a real Android phone 2026-10-19). Do not upgrade expo or run `expo install expo@latest` until Expo Go on the owner's phone supports the new SDK; ask first.
- After any SDK change: delete pnpm-lock.yaml and every node_modules (root, apps/*, packages/*), then `pnpm install`. Otherwise pnpm keeps old-SDK peer packages (e.g. @expo/log-box) from the lockfile and Metro fails with UnableToResolveError.
- Stages 0 to 1b must run in Expo Go: no libraries that need custom native code (no MMKV, RevenueCat, Sentry native yet). Local storage: expo-sqlite / AsyncStorage.
- Move to an EAS development build at stage 1c (live match), when native modules are needed.
- Phone login in development uses Supabase test phone numbers with a fixed OTP. No SMS provider until beta. Test numbers and who they are: supabase/README.md (050-0000001 = admin of league A, code 123456). On the remote project they are set by hand in the dashboard (Authentication → Phone), with a placeholder Twilio provider.
- Supabase: local stack needs Docker Desktop running (`node node_modules/supabase/dist/supabase.js start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`, then `... test db`). Remote project yjsjkziinpjaiduufbbp: `supabase login` does not work on this machine, so push with scripts/db-push-remote.ps1 (connection string in gitignored supabase/.env.db.local). Push only after local tests pass. supabase/seed.sql is generated (`pnpm import:seed`); never edit it by hand.
- RTL: Hebrew is the default direction. Switching language between RTL and LTR requires an app reload; handle it explicitly.

## Working rules
- The owner prefers autonomous work (Auto mode): decide technical details yourself, run everything, and do not ask for approval on technical choices.
- Stop and ask ONLY for product decisions: the prototype looks wrong, two behaviours are possible and players would see a difference, or a result makes no football sense. Ask in simple Hebrew, recommendation first.
- Commit to Git after every step that works (tests and typecheck green).
- Always reply to the owner in Hebrew, in plain, simple words: explain what you are doing and what you need from them. Code, comments and commit messages stay in English.
- Windows note: running pnpm through Git Bash is very slow here (minutes); use PowerShell, or call node / vitest / tsc directly.
