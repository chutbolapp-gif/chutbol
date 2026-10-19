// Domain types shared by scoring, the app and the import script.
// Shapes follow the prototype's own export (docs/prototype/data). Only the fields the
// scoring reads are required; everything else the prototype stores is optional or omitted.

export type Id = string;
/** f = field player, g = goalkeeper. A player has a separate OVR card for each. */
export type Role = 'f' | 'g';
/** Organiser's "cards" on a player: attacker, defender, fitness. */
export type PlayerCard = 'att' | 'def' | 'fit';

export type EventType =
  | 'goal' | 'own' | 'save' | 'pen' | 'key' | 'shot' | 'def' | 'card' | 'sub' | 'gk'
  // the prototype records more kinds (fouls, highlights ...) that scoring ignores
  | (string & {});

/** One thing that happened in a match. Which fields are set depends on `type`. */
export interface MatchEvent {
  id?: Id;
  type: EventType;
  /** team the event belongs to (for 'own': the team whose player scored into his own net) */
  team: Id;
  /** main player: scorer, saver, keeper who went in ('gk'), card receiver ... */
  p?: Id;
  /** assist (goal) */
  a?: Id | null;
  /** keeper the ball went past / who faced the penalty */
  gka?: Id | null;
  /** penalty outcome */
  res?: 'saved' | 'miss' | (string & {});
  pen?: boolean;
  /** 1-based match minute, as shown on the clock */
  min?: number;
  /** device time (ms since epoch) on the recording phone */
  at?: number;
  /** substitution */
  in?: Id;
  out?: Id;
  /** keeper switch: previous keeper */
  prev?: Id | null;
  /** card colour and whether it was a second yellow */
  c?: 'y' | 'r' | (string & {});
  second?: boolean;
}

export interface LineupSide {
  /** keeper at kick-off (may be an "outside" keeper who is not on the team roster) */
  gk?: Id | null;
  /** players on the pitch at kick-off */
  on: Id[];
}

export type MatchStatus = 'setup' | 'live' | 'done' | (string & {});

export interface Match {
  id: Id;
  /** order of the match in the round, 1-based */
  n: number;
  home: Id;
  away: Id;
  /** planned length in minutes */
  dur: number;
  status: MatchStatus;
  startedAt?: number;
  endedAt?: number;
  timer?: { acc?: number; run?: boolean; since?: number };
  /** missing until the lineup is set; scoring skips matches without it */
  lu?: Record<Id, LineupSide>;
  /** keeper at kick-off per team */
  gk0?: Record<Id, Id | null>;
  events?: MatchEvent[];
  /** match ratings, written when the round is saved (see recomputeRatings) */
  ratings?: Record<Id, number>;
  /** team strength at kick-off, written together with ratings */
  str?: Record<Id, number>;
  /** knockout: who went through on penalties after a draw */
  koWinner?: Id;
}

export interface Team {
  id: Id;
  name: string;
  color: string;
  gk?: Id | null;
  players: Id[];
}

export interface KnockoutFixture {
  id: Id;
  home: Id;
  away: Id | null;
  stage: string;
  ko?: number;
  done?: boolean;
  winner?: Id | null;
  mid?: Id;
}

export type RoundStatus = 'setup' | 'live' | 'done' | (string & {});

export interface Round {
  id: Id;
  leagueId: Id;
  number: number;
  season: string;
  /** creation time; orders the rounds of a league */
  created: number;
  status: RoundStatus;
  /** "stopped without points": no champion, no awards */
  voided?: boolean;
  teams: Team[];
  matches: Match[];
  attendees?: Id[];
  /** organiser's order for teams that are level on everything */
  manualOrder?: Id[];
  /** knockout result: [champion, runner-up] */
  koRank?: Id[];
  format?: 'knockout' | (string & {});
  fixtures?: KnockoutFixture[];
  /** keeper rotation: drawn order per team */
  gkOrder?: Record<Id, Id[]>;
  /** the two teams of the next match */
  nextPair?: Id[];
  /** keeper chosen for the next match, per team */
  nextGk?: Record<Id, Id>;
}

export interface LeaguePlayer {
  id: Id;
  name: string;
  cards?: PlayerCard[];
}

export interface League {
  id: Id;
  name: string;
  season: string;
  players: LeaguePlayer[];
  settings?: Record<string, unknown>;
}

/** Manual OVR stats (30-99) set by the organiser. `control` is an old name for dribbling. */
export type ManualAttr = Partial<Record<OvrStatKey | 'control' | 'stamina', number>> & { pos?: string };

/** Secret, admin-only: stars and manual attributes per league. */
export interface RatingsDoc {
  id: Id;
  /** stars (0.5-5) per player */
  r: Record<Id, number>;
  /** per-round star override: rounds[roundId][playerId] */
  rounds?: Record<Id, Record<Id, number>>;
  attr?: Record<Id, Partial<Record<Role, ManualAttr>>>;
}

// ---------- scoring outputs ----------

/** One line of a match-rating breakdown. `key` + `params` are rendered by i18n. */
export type RatePartKey =
  | 'base' | 'draw00' | 'teamScored' | 'teamConceded'
  | 'gkConceded' | 'cleanSheet' | 'cleanSheetShort'
  | 'goals' | 'assists' | 'saves'
  | 'lateWinner' | 'lateWinnerAssist' | 'fastWin'
  | 'lowTableWin' | 'lowTableDraw'
  | 'clampMin' | 'clampMax';

export interface RatePart {
  key: RatePartKey;
  v: number;
  /** n: a count; pct: share of the match played; time: "m:ss"; pts / oppPts: round points */
  params?: { n?: number; pct?: number; time?: string; pts?: number; oppPts?: number };
}

export interface RateMatchResult {
  ratings: Record<Id, number>;
  str: Record<Id, number>;
  parts: Record<Id, RatePart[]>;
}

export interface StandingRow {
  id: Id;
  p: number; w: number; d: number; l: number;
  gf: number; ga: number; pts: number;
  /** level with the team above on points, goal difference, goals and head-to-head */
  tied: boolean;
  /** that tie is resolved by the organiser's manual order */
  manual: boolean;
}

export interface RoundScore {
  n: number;
  avg: number;
  bonus: number;
  sv: number;
  conc: number;
  contrib: number;
  score: number;
  /** keepers only: played at least half as often as the busiest keeper */
  q?: boolean;
}

export interface TeamDay {
  tight: boolean;
  spread: number;
  score: Record<Id, number>;
}

export type OvrStatKey =
  | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'mental'
  | 'gkConc' | 'reflexes' | 'gkFeet';

/** Playing style shown on the card. */
export type OvrStyle = 'gk' | 'complete' | 'attacking' | 'defensive' | 'engine' | 'balanced';

export interface OvrHistEntry {
  roundId: Id;
  personal: number;
  team: number;
  c: number;
  e: number;
  d: number;
  ovr: number;
  tight: boolean;
}

export interface PlayerOvr {
  ovr: number;
  pos: OvrStyle;
  base: number;
  stars: number;
  hist: OvrHistEntry[];
  cards: PlayerCard[];
  complete: boolean;
  stats: Partial<Record<OvrStatKey, number>>;
  auto: Partial<Record<OvrStatKey, number>>;
  src: Partial<Record<OvrStatKey, 'man' | 'auto' | 'card'>>;
  man: ManualAttr;
  rounds: number;
  keys: OvrStatKey[];
  stamina: number | null;
}

export * from './db';
