// English. Where the prototype has an English translation (its I18N_P / I18N_RX tables) it is used.
import type { Dict } from './he';

export const en: Dict = {
  app: {
    name: 'Chutbol',
    title: "The crew's league",
    tagline: 'Rounds, season table, top scorer and top assister.',
  },
  common: {
    back: 'Back',
    close: 'Close',
    total: 'Total',
    loading: 'Loading…',
  },
  lang: {
    toggle: 'עב',
    toggleA11y: 'Language',
    reloadFailed: 'Could not reload. Close and reopen the app to switch the language.',
  },
  home: {
    demoTitle: '⭐ Match ratings',
    demoHint: 'Real data from round {{n}}, computed in the app.',
  },
  demo: {
    round: 'Round {{n}}',
    matchRatings: 'Match {{n}} ratings',
    matchLine: 'Match {{n}}: {{home}} {{h}} - {{a}} {{away}}',
    tapHint: 'Tap a player to see how the match score was calculated. Only you see the breakdown.',
    devNote: 'Stage 0b test screen: shows that the scoring package runs inside the app.',
    gk: 'Goalkeeper',
  },
  ratePart: {
    base: 'Base',
    draw00: '0-0 draw: base 5.5',
    teamScored: 'Team scored {{n}} (0.5 per goal)',
    teamConceded: 'Team conceded {{n}} (-0.5 per goal)',
    gkConceded: '🧤 Conceded {{n}} (one goal = 5.5, each extra goal −0.5)',
    cleanSheet: '🧤 Clean sheet, played {{pct}}% of the match',
    cleanSheetShort: '🧤 Clean sheet, but played only {{pct}}% (less than 30%)',
    goals: '⚽ {{n}} goals',
    assists: '👟 {{n}} assists',
    saves: '🧤 {{n}} saves',
    lateWinner: '⏱ Last-minute winning goal',
    lateWinnerAssist: '⏱ Assist for a last-minute winning goal',
    fastWin: '⚡ Fast win ({{time}} minutes)',
    lowTableWin: '📊 Lower in the round table ({{pts}} vs {{oppPts}} pts), won (double)',
    lowTableDraw: '📊 Lower in the round table ({{pts}} vs {{oppPts}} pts), draw',
    clampMin: 'The minimum score is 4',
    clampMax: 'The maximum score is 10',
  },
  ovrStyle: {
    gk: 'Goalkeeper',
    complete: 'Complete player',
    attacking: 'Attacking',
    defensive: 'Defensive',
    engine: 'Engine',
    balanced: 'Balanced',
  },
};
