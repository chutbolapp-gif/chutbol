// Pure scoring functions ported from the prototype (docs/prototype/soccerfriends.html).
// No globals, no cache, no I/O, no clock. Verified against packages/scoring/golden.
export { rateMatch, recomputeRatings } from './rateMatch';
export { roundScores, roundAwards, roundRaw, roundAttrs, ratingAgg, teamDay, gkSort } from './round';
export type { RoundAttr, RoundRaw, RawCounts, RoundAwards } from './round';
export { playerOVR, starBase, pCards, manualAttr, OVR_K, OVR_MIN, OVR_MAX, STAR_OVR, dD } from './ovr';
export type { PlayerOvrInput } from './ovr';
export { gkCounts, autoGk } from './gk';
export { standings, teamStats, h2h, playerStats } from './standings';
export type { PlayerStat } from './standings';
export {
  score, other, team, teamOf, isGoal, rv, baseRating, roundRating, teamStrength,
  initialLineup, playsOf, matchWindow, onIntervals, gkSeconds, matchGks,
} from './basics';
