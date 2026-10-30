// Shared data types. These mirror the PocketBase collections in server/pb_migrations.

/** How a game is scored. */
export type ScoringMode =
  | 'points' // one final score per player (Catan, Scrabble)
  | 'rounds' // scores added round by round (Uno, Rummy, Whist)
  | 'categories' // score sheet with categories (7 Wonders, Yahtzee)
  | 'ranking' // finishing order (Mario Kart, Poker)
  | 'winner' // just pick the winner(s) (Chess, Codenames)
  | 'coop'; // everyone wins or loses together (Pandemic)

export type TeamsSetting = 'off' | 'optional' | 'always';

/** Trick-taking bids: exact bid scores `exact + bid * perTrick`, a miss loses `|diff| * missPerTrick`. */
export interface BiddingRules {
  exact: number;
  perTrick: number;
  missPerTrick: number;
}

export interface GameConfig {
  mode: ScoringMode;
  /** points / rounds / categories: lowest total wins (golf, Hearts). */
  lowestWins?: boolean;
  /** rounds: the game ends when someone reaches this total. */
  targetScore?: number | null;
  teams?: TeamsSetting;
  /** winner: a game can end in a draw. */
  allowDraw?: boolean;
  /** categories: the rows of the score sheet. */
  categories?: string[];
  /** rounds: players bid and take tricks each round. */
  bidding?: BiddingRules | null;
  /** coop: also record a shared score. */
  coopScore?: boolean;
  /** remember how long the session took. */
  trackDuration?: boolean;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  config: GameConfig;
  owner: string;
  created: string;
  updated: string;
}

/**
 * Someone who took part in a session. `key` is stable across sessions:
 * `u:<userId>` for accounts, `g:<lowercase name>` for guests.
 */
export interface Participant {
  key: string;
  userId?: string;
  name: string;
  /** team index when the session is played in teams */
  team?: number;
}

export interface BidEntry {
  bid: number | null;
  took: number | null;
}

/** Raw score input of a session. Keys are participant keys, or `t:<index>` when playing in teams. */
export interface SessionData {
  v: 1;
  participants: Participant[];
  useTeams?: boolean;
  teams?: string[];
  scores?: Record<string, number | null>;
  rounds?: Record<string, number | null>[];
  bids?: Record<string, BidEntry>[];
  categories?: Record<string, Record<string, number | null>>;
  ranks?: Record<string, number>;
  winners?: string[];
  draw?: boolean;
  coopWon?: boolean | null;
  coopScore?: number | null;
}

/** Computed outcome for one participant; this is what statistics are built from. */
export interface PlayerResult {
  key: string;
  userId?: string;
  name: string;
  team?: number;
  score: number | null;
  /** 1 = first place; ties share a rank */
  rank: number;
  won: boolean;
  draw?: boolean;
}

export interface Session {
  id: string;
  game: string;
  created_by: string;
  players: string[];
  played_at: string;
  duration_min: number | null;
  notes: string;
  data: SessionData;
  results: PlayerResult[];
  created: string;
  updated: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatar?: string;
  created: string;
}

export interface Friend {
  id: string;
  owner: string;
  friend: string;
  created: string;
  expand?: { owner?: User; friend?: User };
}
