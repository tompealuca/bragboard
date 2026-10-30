import { describe, expect, it } from 'vitest';

import {
  bidPoints,
  computeResults,
  emptySessionData,
  entityTotals,
  pruneSessionData,
  rankByTotals,
  replaceParticipant,
  summarizeResults,
  targetReached,
  validateSession,
} from '../scoring';
import type { GameConfig, Participant, SessionData } from '../types';

const ana: Participant = { key: 'u:ana', userId: 'ana', name: 'Ana' };
const bob: Participant = { key: 'u:bob', userId: 'bob', name: 'Bob' };
const cid: Participant = { key: 'g:cid', name: 'Cid' };

function data(config: GameConfig, patch: Partial<SessionData>, players = [ana, bob, cid]): SessionData {
  return { ...emptySessionData(config, players), ...patch };
}

const byKey = (results: ReturnType<typeof computeResults>) =>
  Object.fromEntries(results.map((r) => [r.key, r]));

describe('rankByTotals', () => {
  it('uses competition ranking for ties', () => {
    expect(rankByTotals({ a: 10, b: 10, c: 5 })).toEqual({ a: 1, b: 1, c: 3 });
  });
  it('supports lowest wins', () => {
    expect(rankByTotals({ a: 10, b: 3, c: 5 }, true)).toEqual({ b: 1, c: 2, a: 3 });
  });
});

describe('points mode', () => {
  const config: GameConfig = { mode: 'points' };
  it('ranks by final score and marks the winner', () => {
    const r = byKey(computeResults(config, data(config, { scores: { 'u:ana': 10, 'u:bob': 12, 'g:cid': 7 } })));
    expect(r['u:bob']).toMatchObject({ rank: 1, won: true, score: 12, userId: 'bob' });
    expect(r['u:ana']).toMatchObject({ rank: 2, won: false });
    expect(r['g:cid']).toMatchObject({ rank: 3, won: false });
    expect(r['g:cid'].userId).toBeUndefined();
  });
  it('shares a win on a tie for first', () => {
    const r = byKey(computeResults(config, data(config, { scores: { 'u:ana': 10, 'u:bob': 10, 'g:cid': 7 } })));
    expect(r['u:ana'].won && r['u:bob'].won).toBe(true);
    expect(r['g:cid'].won).toBe(false);
  });
  it('is a draw when everyone ties', () => {
    const results = computeResults(config, data(config, { scores: { 'u:ana': 3, 'u:bob': 3 } }, [ana, bob]));
    expect(results.every((r) => r.draw && !r.won)).toBe(true);
    expect(summarizeResults(results)).toBe('Draw');
  });
  it('lowest wins', () => {
    const low: GameConfig = { mode: 'points', lowestWins: true };
    const r = byKey(computeResults(low, data(low, { scores: { 'u:ana': 10, 'u:bob': 12, 'g:cid': 7 } })));
    expect(r['g:cid'].won).toBe(true);
  });
  it('needs at least one score', () => {
    expect(validateSession(config, data(config, {}))).toMatch(/score/);
    expect(validateSession(config, data(config, { scores: { 'u:ana': 1 } }))).toBeNull();
  });
  it('a solo session is never a win', () => {
    const results = computeResults(config, data(config, { scores: { 'u:ana': 50 } }, [ana]));
    expect(results[0]).toMatchObject({ rank: 1, won: false, score: 50 });
  });
});

describe('rounds mode', () => {
  const config: GameConfig = { mode: 'rounds', targetScore: 100 };
  const rounds = [
    { 'u:ana': 30, 'u:bob': 20, 'g:cid': 0 },
    { 'u:ana': 40, 'u:bob': 90, 'g:cid': 10 },
  ];
  it('sums rounds', () => {
    expect(entityTotals(config, data(config, { rounds }))).toEqual({ 'u:ana': 70, 'u:bob': 110, 'g:cid': 10 });
  });
  it('detects the target score', () => {
    expect(targetReached(config, data(config, { rounds }))).toEqual(['u:bob']);
  });
  it('requires a round', () => {
    expect(validateSession(config, data(config, {}))).toMatch(/round/);
  });
});

describe('bidding (whist)', () => {
  const rules = { exact: 5, perTrick: 1, missPerTrick: 1 };
  const config: GameConfig = { mode: 'rounds', bidding: rules };
  it('scores exact bids and misses', () => {
    expect(bidPoints({ bid: 2, took: 2 }, rules)).toBe(7);
    expect(bidPoints({ bid: 0, took: 0 }, rules)).toBe(5);
    expect(bidPoints({ bid: 3, took: 1 }, rules)).toBe(-2);
    expect(bidPoints({ bid: 1, took: null }, rules)).toBeNull();
  });
  it('totals bids over rounds', () => {
    const bids = [
      { 'u:ana': { bid: 1, took: 1 }, 'u:bob': { bid: 0, took: 1 } },
      { 'u:ana': { bid: 2, took: 0 }, 'u:bob': { bid: 1, took: 1 } },
    ];
    const d = data(config, { bids }, [ana, bob]);
    expect(entityTotals(config, d)).toEqual({ 'u:ana': 6 - 2, 'u:bob': -1 + 6 });
    expect(byKey(computeResults(config, d))['u:bob'].won).toBe(true);
  });
  it('rejects incomplete rounds', () => {
    const d = data(config, { bids: [{ 'u:ana': { bid: 1, took: null }, 'u:bob': { bid: 0, took: 0 } }] }, [ana, bob]);
    expect(validateSession(config, d)).toMatch(/bid/);
  });
});

describe('categories mode', () => {
  const config: GameConfig = { mode: 'categories', categories: ['Military', 'Science'] };
  it('sums only configured categories', () => {
    const d = data(config, {
      categories: { 'u:ana': { Military: 5, Science: 20, Old: 100 }, 'u:bob': { Military: -2, Science: 30 } },
    });
    expect(entityTotals(config, d)).toEqual({ 'u:ana': 25, 'u:bob': 28, 'g:cid': null });
    const r = byKey(computeResults(config, d));
    expect(r['u:bob'].won).toBe(true);
    expect(r['g:cid'].rank).toBe(3);
  });
});

describe('ranking mode', () => {
  const config: GameConfig = { mode: 'ranking' };
  it('uses the given order and puts unranked players last', () => {
    const r = byKey(computeResults(config, data(config, { ranks: { 'g:cid': 1, 'u:ana': 2 } })));
    expect(r['g:cid'].won).toBe(true);
    expect(r['u:bob'].rank).toBe(3);
  });
  it('allows leaving the last player unranked', () => {
    expect(validateSession(config, data(config, { ranks: { 'g:cid': 1, 'u:ana': 2 } }))).toBeNull();
    expect(validateSession(config, data(config, { ranks: { 'g:cid': 1 } }))).toMatch(/order/);
  });
});

describe('winner mode', () => {
  const config: GameConfig = { mode: 'winner', allowDraw: true };
  it('marks the picked winner', () => {
    const r = byKey(computeResults(config, data(config, { winners: ['u:ana'] })));
    expect(r['u:ana']).toMatchObject({ won: true, rank: 1, score: null });
    expect(r['u:bob']).toMatchObject({ won: false, rank: 2 });
  });
  it('supports draws', () => {
    const results = computeResults(config, data(config, { draw: true }));
    expect(results.every((r) => r.draw && !r.won && r.rank === 1)).toBe(true);
  });
  it('requires a winner', () => {
    expect(validateSession(config, data(config, {}))).toMatch(/winner/);
  });
});

describe('teams', () => {
  const config: GameConfig = { mode: 'points', teams: 'always' };
  const players = [ana, bob, cid, { key: 'g:dan', name: 'Dan' }];
  it('splits players into two teams by default and scores per team', () => {
    const d = emptySessionData(config, players);
    expect(d.participants.map((p) => p.team)).toEqual([0, 1, 0, 1]);
    const results = computeResults(config, { ...d, scores: { 't:0': 10, 't:1': 8 } });
    const r = byKey(results);
    expect(r['u:ana']).toMatchObject({ won: true, team: 0, score: 10 });
    expect(r['g:cid']).toMatchObject({ won: true, team: 0 });
    expect(r['u:bob']).toMatchObject({ won: false, team: 1, score: 8 });
  });
  it('needs two teams', () => {
    const d = emptySessionData(config, players);
    d.participants = d.participants.map((p) => ({ ...p, team: 0 }));
    expect(validateSession(config, { ...d, scores: { 't:0': 1 } })).toMatch(/two teams/);
  });
  it('optional teams only apply when switched on', () => {
    const optional: GameConfig = { mode: 'points', teams: 'optional' };
    const d = emptySessionData(optional, [ana, bob]);
    expect(d.useTeams).toBe(false);
    expect(computeResults(optional, { ...d, scores: { 'u:ana': 2, 'u:bob': 1 } })[0].won).toBe(true);
  });
});

describe('coop mode', () => {
  const config: GameConfig = { mode: 'coop' };
  it('everyone wins or loses together', () => {
    expect(computeResults(config, data(config, { coopWon: true })).every((r) => r.won)).toBe(true);
    expect(computeResults(config, data(config, { coopWon: false })).every((r) => !r.won)).toBe(true);
    expect(validateSession(config, data(config, {}))).toMatch(/win or lose/);
  });
});

describe('pruneSessionData', () => {
  it('drops input of removed players', () => {
    const config: GameConfig = { mode: 'points' };
    const d = data(config, { scores: { 'u:ana': 1, 'u:bob': 2, 'g:cid': 3 } }, [ana, bob, cid]);
    const pruned = pruneSessionData(config, { ...d, participants: [ana] });
    expect(pruned.scores).toEqual({ 'u:ana': 1 });
  });
});

describe('replaceParticipant', () => {
  const config: GameConfig = { mode: 'rounds' };
  it('moves every trace of a guest to the linked account', () => {
    const d = data(config, { rounds: [{ 'g:cid': 5, 'u:ana': 2 }], winners: ['g:cid'] });
    const next = replaceParticipant(d, 'g:cid', { key: 'u:cid1', userId: 'cid1', name: 'Cid' })!;
    expect(next.participants.find((p) => p.key === 'u:cid1')).toMatchObject({ userId: 'cid1', name: 'Cid' });
    expect(next.rounds?.[0]).toEqual({ 'u:cid1': 5, 'u:ana': 2 });
    expect(next.winners).toEqual(['u:cid1']);
    expect(computeResults(config, next).find((r) => r.key === 'u:cid1')?.won).toBe(true);
  });
  it('refuses when the account already plays in the session', () => {
    expect(replaceParticipant(data(config, {}), 'g:cid', { key: 'u:ana', userId: 'ana', name: 'Ana' })).toBeNull();
  });
});
