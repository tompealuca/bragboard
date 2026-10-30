// Ready-made game setups. Picking one pre-fills the "Add game" form; everything stays editable.

import type { GameConfig, ScoringMode } from './types';

export interface GameTemplate {
  name: string;
  emoji: string;
  color: string;
  tag: 'Cards' | 'Board' | 'Party' | 'Dice' | 'Sports' | 'Video';
  config: GameConfig;
}

export const MODE_INFO: Record<ScoringMode, { title: string; description: string; icon: string }> = {
  points: { title: 'Final score', description: 'Everyone gets one score at the end', icon: 'trophy-outline' },
  rounds: { title: 'Rounds', description: 'Add scores round by round, totals add up', icon: 'repeat' },
  categories: { title: 'Score sheet', description: 'Score several categories, they add up', icon: 'grid-outline' },
  ranking: { title: 'Finishing order', description: '1st, 2nd, 3rd… like a race', icon: 'podium-outline' },
  winner: { title: 'Winner only', description: 'Just pick who won', icon: 'ribbon-outline' },
  coop: { title: 'Co-op', description: 'Everyone wins or loses together', icon: 'people-outline' },
};

/** Short label for a game's scoring, e.g. "Bids & tricks" or "Rounds · lowest wins". */
export function modeLabel(config: GameConfig, details = false) {
  const base = config.bidding ? 'Bids & tricks' : MODE_INFO[config.mode]?.title ?? '';
  if (!details) return base;
  return [
    base,
    config.lowestWins ? 'lowest wins' : null,
    config.targetScore ? `to ${config.targetScore}` : null,
    config.teams === 'always' ? 'teams' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const MODE_ORDER: ScoringMode[] = ['points', 'rounds', 'categories', 'ranking', 'winner', 'coop'];

export const TEMPLATES: GameTemplate[] = [
  // Cards
  {
    name: 'Whist',
    emoji: '🃏',
    color: '#6366F1',
    tag: 'Cards',
    config: { mode: 'rounds', bidding: { exact: 5, perTrick: 1, missPerTrick: 1 }, trackDuration: true },
  },
  {
    name: 'Oh Hell',
    emoji: '🎴',
    color: '#8B5CF6',
    tag: 'Cards',
    config: { mode: 'rounds', bidding: { exact: 10, perTrick: 1, missPerTrick: 0 } },
  },
  { name: 'Uno', emoji: '🟥', color: '#FF6B5A', tag: 'Cards', config: { mode: 'rounds', targetScore: 500 } },
  { name: 'Rummy', emoji: '🀄', color: '#2EB872', tag: 'Cards', config: { mode: 'rounds', lowestWins: true } },
  { name: 'Rentz', emoji: '👑', color: '#F2B705', tag: 'Cards', config: { mode: 'rounds' } },
  {
    name: 'Hearts',
    emoji: '♥️',
    color: '#E84393',
    tag: 'Cards',
    config: { mode: 'rounds', lowestWins: true, targetScore: 100 },
  },
  {
    name: 'Canasta',
    emoji: '🂡',
    color: '#14A3A3',
    tag: 'Cards',
    config: { mode: 'rounds', teams: 'always', targetScore: 5000 },
  },
  { name: 'Poker', emoji: '♠️', color: '#64748B', tag: 'Cards', config: { mode: 'ranking' } },
  // last player who doesn't explode wins
  { name: 'Exploding Kittens', emoji: '💣', color: '#FF9F1C', tag: 'Cards', config: { mode: 'winner' } },

  // Board
  { name: 'Catan', emoji: '🏝️', color: '#FF9F1C', tag: 'Board', config: { mode: 'points' } },
  {
    name: 'Ticket to Ride',
    emoji: '🚂',
    color: '#3B82F6',
    tag: 'Board',
    config: { mode: 'categories', categories: ['Routes', 'Tickets', 'Longest route'] },
  },
  {
    name: '7 Wonders',
    emoji: '🏛️',
    color: '#F2B705',
    tag: 'Board',
    config: {
      mode: 'categories',
      categories: ['Military', 'Treasury', 'Wonder', 'Civilian', 'Commerce', 'Guilds', 'Science'],
    },
  },
  { name: 'Carcassonne', emoji: '🏰', color: '#2EB872', tag: 'Board', config: { mode: 'points' } },
  { name: 'Scrabble', emoji: '🔤', color: '#FF9F1C', tag: 'Board', config: { mode: 'points' } },
  { name: 'Monopoly', emoji: '🎩', color: '#2EB872', tag: 'Board', config: { mode: 'winner' } },
  { name: 'Chess', emoji: '♟️', color: '#64748B', tag: 'Board', config: { mode: 'winner', allowDraw: true } },
  { name: 'Backgammon', emoji: '🎲', color: '#FF6B5A', tag: 'Board', config: { mode: 'winner' } },
  { name: 'Dixit', emoji: '🐇', color: '#E84393', tag: 'Board', config: { mode: 'points' } },
  { name: 'Pandemic', emoji: '🦠', color: '#14A3A3', tag: 'Board', config: { mode: 'coop' } },
  // the hand winner scores the pips left in the other hands; partners play as a team
  {
    name: 'Dominoes',
    emoji: '🎲',
    color: '#64748B',
    tag: 'Board',
    config: { mode: 'rounds', targetScore: 100, teams: 'optional' },
  },

  // Dice
  {
    name: 'Yahtzee',
    emoji: '🎲',
    color: '#3B82F6',
    tag: 'Dice',
    config: {
      mode: 'categories',
      categories: [
        'Ones',
        'Twos',
        'Threes',
        'Fours',
        'Fives',
        'Sixes',
        'Upper bonus',
        '3 of a kind',
        '4 of a kind',
        'Full house',
        'Small straight',
        'Large straight',
        'Yahtzee',
        'Chance',
      ],
    },
  },

  // Party
  {
    name: 'Codenames',
    emoji: '🕵️',
    color: '#FF6B5A',
    tag: 'Party',
    config: { mode: 'winner', teams: 'always', teamNames: ['Red', 'Blue'] },
  },
  { name: 'Charades', emoji: '🎭', color: '#8B5CF6', tag: 'Party', config: { mode: 'points', teams: 'always' } },
  {
    name: 'Werewolf',
    emoji: '🐺',
    color: '#64748B',
    tag: 'Party',
    config: { mode: 'winner', teams: 'always', teamNames: ['Villagers', 'Werewolves'] },
  },
  // hidden roles: put each player in the side they were dealt, then pick the side that won
  {
    name: 'Secret Hitler',
    emoji: '🗳️',
    color: '#FF6B5A',
    tag: 'Party',
    config: { mode: 'winner', teams: 'always', teamNames: ['Liberals', 'Fascists'] },
  },
  {
    name: 'Avalon',
    emoji: '⚔️',
    color: '#6366F1',
    tag: 'Party',
    config: { mode: 'winner', teams: 'always', teamNames: ['Good', 'Evil'] },
  },
  { name: 'Quiz night', emoji: '❓', color: '#6366F1', tag: 'Party', config: { mode: 'points', teams: 'optional' } },
  { name: 'Fibbage', emoji: '🤥', color: '#8B5CF6', tag: 'Party', config: { mode: 'points' } },
  { name: 'Quiplash', emoji: '💬', color: '#14A3A3', tag: 'Party', config: { mode: 'points' } },

  // Sports & video games
  { name: 'Ping pong', emoji: '🏓', color: '#FF9F1C', tag: 'Sports', config: { mode: 'points', teams: 'optional' } },
  { name: 'Darts', emoji: '🎯', color: '#FF6B5A', tag: 'Sports', config: { mode: 'winner' } },
  { name: 'Bowling', emoji: '🎳', color: '#3B82F6', tag: 'Sports', config: { mode: 'points' } },
  { name: 'FIFA', emoji: '⚽', color: '#2EB872', tag: 'Video', config: { mode: 'points', teams: 'optional' } },
  { name: 'Mario Kart', emoji: '🏎️', color: '#FF6B5A', tag: 'Video', config: { mode: 'ranking' } },
];

export const TEMPLATE_TAGS = ['Cards', 'Board', 'Dice', 'Party', 'Sports', 'Video'] as const;

export const EMOJI_CHOICES = [
  '🎲', '🃏', '♟️', '🏆', '🎯', '🧩', '🎮', '🏓', '⚽', '🏀', '🎳', '🎱',
  '🀄', '🂡', '👑', '🏝️', '🏰', '🚂', '🐺', '🦠', '🎭', '❓', '🔤', '💎',
];

/** Default config for a brand new custom game. */
export function defaultConfig(mode: ScoringMode): GameConfig {
  switch (mode) {
    case 'categories':
      return { mode, categories: ['Category 1', 'Category 2'] };
    case 'winner':
      return { mode, allowDraw: false };
    default:
      return { mode };
  }
}
