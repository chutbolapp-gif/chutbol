# @chutbol/mobile

Expo (SDK 57, pinned to match Expo Go on the test phone) + Expo Router app. Runs in Expo Go: no libraries with custom native code until stage 1c.

## Run

```powershell
cd apps/mobile
node node_modules/expo/bin/cli start          # scan the QR code with Expo Go
node node_modules/expo/bin/cli start --web    # or in the browser
```

Checks: `node node_modules/typescript/bin/tsc -p .` and `node node_modules/vitest/vitest.mjs run`.
Bundle check: `node node_modules/expo/bin/cli export --platform android` (or `web`).

## Layout

- `src/app/` – routes (Expo Router). `index.tsx` home, `demo/ratings.tsx` the stage 0b scoring demo.
- `src/i18n/` – `he.ts` (default) and `en.ts`; `i18n.ts` (no React Native, also used by tests);
  `language.ts` (saved choice, layout direction, reload); `LanguageProvider.tsx`.
- `src/demo/round.ts` – real round 6 from `docs/prototype/data`, scored with `@chutbol/scoring`.
  Dev only: it bundles the league's ratings doc (admin-only stars). Remove in stage 1a.

## Language and direction

Hebrew (RTL) is the default. The toggle saves the choice (AsyncStorage), sets `I18nManager`, and
reloads: `Updates.reloadAsync()` in release builds, `DevSettings.reload()` in Expo Go / dev, a page
reload on web. Expo Go resets `I18nManager` when it opens a project, so the root view also sets
`direction` itself; that keeps RTL right in Expo Go. In a dev or store build the first start with a
wrong native direction reloads once (guarded so it cannot loop).

All user-facing text comes from i18n keys. Rating breakdowns arrive from the scoring as keys + params
(`ratePart.*`, `ovrStyle.*`); `test/i18n.test.ts` checks the Hebrew against the prototype's own text
in the golden files.
