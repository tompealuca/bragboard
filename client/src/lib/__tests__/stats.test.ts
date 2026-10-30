import { describe, expect, it } from 'vitest';

import {
  filterByPlayers,
  gameRecords,
  headToHead,
  leaderboard,
  overview,
  perGameStats,
  playerStats,
  playersIn,
  winsOverTime,
} from '../stats';
import type { PlayerResult, Session } from '../types';

let n = 0;
function session(game: string, date: string, results: Partial<PlayerResult>[]): Session {
  n++;
  return {
    id: `s${n}`,
    game,
    created_by: 'ana',
    players: [],
    played_at: date,
    duration_min: null,
    notes: '',
    data: { v: 1, participants: [] },
    results: results.map((r) => ({ key: '', name: '', score: null, rank: 1, won: false, ...r })),
    created: date,
    updated: date,
  };
}

const A = { key: 'u:ana', name: 'Ana' };
const B = { key: 'u:bob', name: 'Bob' };
const C = { key: 'g:cid', name: 'Cid' };

const sessions = [
  session('catan', '2026-01-01', [
    { ...A, score: 10, rank: 1, won: true },
    { ...B, score: 8, rank: 2 },
  ]),
  session('catan', '2026-01-02', [
    { ...A, score: 12, rank: 1, won: true },
    { ...B, score: 7, rank: 2 },
    { ...C, score: 3, rank: 3 },
  ]),
  session('catan', '2026-01-03', [
    { ...A, score: 6, rank: 2 },
    { ...C, score: 9, rank: 1, won: true },
  ]),
  session('chess', '2026-01-04', [
    { ...A, rank: 1, draw: true },
    { ...B, rank: 1, draw: true },
  ]),
];
const catan = sessions.filter((s) => s.game === 'catan');

describe('stats', () => {
  it('lists players by frequency', () => {
    expect(playersIn(sessions).map((p) => p.key)).toEqual(['u:ana', 'u:bob', 'g:cid']);
  });

  it('computes player stats with streaks', () => {
    const st = playerStats(catan, 'u:ana');
    expect(st).toMatchObject({ played: 3, wins: 2, losses: 1, bestScore: 12, longestStreak: 2, currentStreak: 0 });
    expect(st.avgScore).toBeCloseTo(28 / 3);
    expect(st.winRate).toBeCloseTo(2 / 3);
  });

  it('counts draws apart from losses', () => {
    expect(playerStats(sessions, 'u:bob')).toMatchObject({ played: 3, wins: 0, draws: 1, losses: 2 });
  });

  it('filters sessions played together', () => {
    expect(filterByPlayers(catan, ['u:ana', 'g:cid'], true).map((s) => s.id)).toEqual(['s2', 's3']);
    expect(filterByPlayers(catan, ['u:bob', 'g:cid'], false)).toHaveLength(3);
  });

  it('builds a sorted leaderboard', () => {
    expect(leaderboard(catan, ['g:cid', 'u:bob', 'u:ana']).map((s) => s.key)).toEqual(['u:ana', 'g:cid', 'u:bob']);
  });

  it('computes head to head', () => {
    expect(headToHead(catan, 'u:ana', 'g:cid')).toEqual({ games: 2, aAhead: 1, bAhead: 1, ties: 0 });
    expect(headToHead(sessions, 'u:ana', 'u:bob')).toEqual({ games: 3, aAhead: 2, bAhead: 0, ties: 1 });
  });

  it('tracks cumulative wins', () => {
    expect(winsOverTime(catan, ['u:ana', 'g:cid']).series).toEqual({ 'u:ana': [1, 2, 2], 'g:cid': [0, 0, 1] });
  });

  it('finds records', () => {
    const rec = gameRecords(catan);
    expect(rec.bestScore).toMatchObject({ name: 'Ana', value: 12 });
    expect(rec.biggestWin).toMatchObject({ name: 'Ana', value: 5 });
    expect(rec.longestStreak).toMatchObject({ name: 'Ana', value: 2 });
    expect(rec.mostWins).toMatchObject({ name: 'Ana', value: 2 });
  });

  it('summarises per game and overall', () => {
    expect(perGameStats(sessions, 'u:ana').map((g) => [g.gameId, g.played, g.wins])).toEqual([
      ['catan', 3, 2],
      ['chess', 1, 0],
    ]);
    expect(overview(sessions, 'u:ana')).toMatchObject({ played: 4, wins: 2, gamesCount: 2, favoriteGameId: 'catan' });
  });
});
