// Scoring engine: turns the raw input of a session into totals, ranks and winners.
// Pure functions, no React / network, so they are easy to test and reuse.

import type {
  BiddingRules,
  BidEntry,
  GameConfig,
  Participant,
  PlayerResult,
  SessionData,
} from './types';

export const TEAM_LETTERS = 'ABCDEFGH';
export const teamKey = (index: number) => `t:${index}`;
export const defaultTeamName = (index: number) => `Team ${TEAM_LETTERS[index] ?? index + 1}`;

/** The name a new session gives team `index`: the game's own team name, else "Team A", "Team B"… */
export function teamNameFor(config: GameConfig, index: number) {
  return config.teamNames?.[index]?.trim() || defaultTeamName(index);
}

/** The two teams a new session starts with. */
export function defaultTeams(config: GameConfig) {
  return [teamNameFor(config, 0), teamNameFor(config, 1)];
}

export function guestKey(name: string) {
  return `g:${name.trim().toLowerCase()}`;
}
export function userKey(userId: string) {
  return `u:${userId}`;
}

/** Whether the session is played in teams. */
export function usesTeams(config: GameConfig, data: SessionData) {
  if (config.mode === 'coop') return false;
  if (config.teams === 'always') return true;
  if (config.teams === 'optional') return !!data.useTeams;
  return false;
}

/** Indexes of teams that have at least one member, in order. */
export function activeTeams(data: SessionData): number[] {
  const set = new Set<number>();
  for (const p of data.participants) if (p.team !== undefined && p.team !== null) set.add(p.team);
  return [...set].sort((a, b) => a - b);
}

/** The keys that are scored: participant keys, or team keys when playing in teams. */
export function entityKeys(config: GameConfig, data: SessionData): string[] {
  if (usesTeams(config, data)) return activeTeams(data).map(teamKey);
  return data.participants.map((p) => p.key);
}

export function entityName(config: GameConfig, data: SessionData, key: string): string {
  if (key.startsWith('t:')) {
    const index = Number(key.slice(2));
    return data.teams?.[index] || teamNameFor(config, index);
  }
  return data.participants.find((p) => p.key === key)?.name ?? '?';
}

export function entityOf(config: GameConfig, data: SessionData, participant: Participant): string {
  return usesTeams(config, data) ? teamKey(participant.team ?? 0) : participant.key;
}

export const DEFAULT_BIDDING: BiddingRules = { exact: 5, perTrick: 1, missPerTrick: 1 };

/** Points for one bid in one round, or null while the round is incomplete. */
export function bidPoints(entry: BidEntry | undefined, rules: BiddingRules): number | null {
  if (!entry || entry.bid === null || entry.took === null) return null;
  if (entry.bid === entry.took) return rules.exact + entry.bid * rules.perTrick;
  return -Math.abs(entry.took - entry.bid) * rules.missPerTrick;
}

/** Score of every entity in every round (rounds mode). */
export function roundScores(config: GameConfig, data: SessionData): Record<string, number | null>[] {
  if (config.bidding) {
    const rules = config.bidding;
    return (data.bids ?? []).map((round) => {
      const out: Record<string, number | null> = {};
      for (const key of Object.keys(round)) out[key] = bidPoints(round[key], rules);
      return out;
    });
  }
  return data.rounds ?? [];
}

function sum(values: (number | null | undefined)[]): number | null {
  let total = 0;
  let any = false;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

/** Current total of each entity (null when nothing was entered yet). */
export function entityTotals(config: GameConfig, data: SessionData): Record<string, number | null> {
  const keys = entityKeys(config, data);
  const totals: Record<string, number | null> = {};
  for (const key of keys) {
    switch (config.mode) {
      case 'points':
        totals[key] = data.scores?.[key] ?? null;
        break;
      case 'rounds':
        totals[key] = sum(roundScores(config, data).map((r) => r[key]));
        break;
      case 'categories': {
        const sheet = data.categories?.[key] ?? {};
        totals[key] = sum((config.categories ?? []).map((c) => sheet[c]));
        break;
      }
      case 'coop':
        totals[key] = data.coopScore ?? null;
        break;
      default:
        totals[key] = null;
    }
  }
  return totals;
}

/** Competition ranking ("1, 1, 3"). Missing totals count as 0. */
export function rankByTotals(totals: Record<string, number | null>, lowestWins = false) {
  const keys = Object.keys(totals);
  const value = (k: string) => totals[k] ?? 0;
  const sorted = [...keys].sort((a, b) => (lowestWins ? value(a) - value(b) : value(b) - value(a)));
  const ranks: Record<string, number> = {};
  sorted.forEach((key, i) => {
    const prev = sorted[i - 1];
    ranks[key] = i > 0 && value(prev) === value(key) ? ranks[prev] : i + 1;
  });
  return ranks;
}

/** Ranks of every entity for the current input. */
export function entityRanks(config: GameConfig, data: SessionData): Record<string, number> {
  const keys = entityKeys(config, data);
  switch (config.mode) {
    case 'points':
    case 'rounds':
    case 'categories':
      return rankByTotals(entityTotals(config, data), config.lowestWins);
    case 'ranking': {
      const given = data.ranks ?? {};
      const last = Math.max(0, ...keys.map((k) => given[k] ?? 0)) + 1;
      const out: Record<string, number> = {};
      for (const k of keys) out[k] = given[k] ?? last;
      return out;
    }
    case 'winner': {
      const out: Record<string, number> = {};
      const winners = new Set(data.winners ?? []);
      for (const k of keys) out[k] = data.draw || winners.has(k) ? 1 : 2;
      return out;
    }
    case 'coop':
    default: {
      const out: Record<string, number> = {};
      for (const k of keys) out[k] = 1;
      return out;
    }
  }
}

/** Final per-participant results, stored with the session and used for statistics. */
export function computeResults(config: GameConfig, data: SessionData): PlayerResult[] {
  const keys = entityKeys(config, data);
  const totals = entityTotals(config, data);
  const ranks = entityRanks(config, data);
  const allFirst = keys.length > 1 && keys.every((k) => ranks[k] === 1);
  const solo = keys.length === 1;

  return data.participants.map((p) => {
    const entity = entityOf(config, data, p);
    const rank = ranks[entity] ?? keys.length;
    let won: boolean;
    let draw = false;
    if (config.mode === 'coop') {
      won = !!data.coopWon;
    } else if (config.mode === 'winner') {
      draw = !!data.draw || allFirst;
      won = !draw && (data.winners ?? []).includes(entity);
    } else if (solo) {
      won = false;
    } else {
      draw = allFirst;
      won = rank === 1 && !allFirst;
    }
    const result: PlayerResult = {
      key: p.key,
      name: p.name,
      score: totals[entity] ?? null,
      rank,
      won,
    };
    if (p.userId) result.userId = p.userId;
    if (p.team !== undefined && usesTeams(config, data)) result.team = p.team;
    if (draw) result.draw = true;
    return result;
  });
}

/** Entities that reached the target score (rounds mode), else an empty list. */
export function targetReached(config: GameConfig, data: SessionData): string[] {
  if (config.mode !== 'rounds' || !config.targetScore) return [];
  const target = config.targetScore;
  const totals = entityTotals(config, data);
  return Object.keys(totals).filter((k) => (totals[k] ?? 0) >= target);
}

/** A human readable reason the session cannot be saved yet, or null when it is complete. */
export function validateSession(config: GameConfig, data: SessionData): string | null {
  if (data.participants.length === 0) return 'Add at least one player.';
  const keys = entityKeys(config, data);
  if (usesTeams(config, data)) {
    if (data.participants.some((p) => p.team === undefined || p.team === null))
      return 'Put every player in a team.';
    if (keys.length < 2) return 'You need at least two teams.';
  }
  switch (config.mode) {
    case 'points': {
      const totals = entityTotals(config, data);
      if (keys.every((k) => totals[k] === null)) return 'Enter at least one score.';
      return null;
    }
    case 'rounds': {
      const rounds = roundScores(config, data);
      if (rounds.length === 0) return 'Add at least one round.';
      if (config.bidding && rounds.some((r) => keys.some((k) => r[k] === null || r[k] === undefined)))
        return 'Every round needs a bid and tricks for everyone.';
      return null;
    }
    case 'categories': {
      const totals = entityTotals(config, data);
      if (keys.every((k) => totals[k] === null)) return 'Fill in the score sheet.';
      return null;
    }
    case 'ranking': {
      const ranks = data.ranks ?? {};
      if (keys.length > 1 && keys.filter((k) => ranks[k]).length < keys.length - 1)
        return 'Set the finishing order.';
      return null;
    }
    case 'winner':
      if (!data.draw && (data.winners ?? []).length === 0) return 'Pick the winner.';
      return null;
    case 'coop':
      if (data.coopWon === null || data.coopWon === undefined) return 'Did you win or lose?';
      return null;
  }
  return null;
}

/** Fresh, empty input for a new session. */
export function emptySessionData(config: GameConfig, participants: Participant[]): SessionData {
  const useTeams = config.teams === 'always';
  return {
    v: 1,
    participants: participants.map((p, i) =>
      useTeams ? { ...p, team: p.team ?? i % 2 } : { key: p.key, name: p.name, userId: p.userId },
    ),
    useTeams,
    teams: useTeams ? defaultTeams(config) : undefined,
    scores: {},
    rounds: [],
    bids: [],
    categories: {},
    ranks: {},
    winners: [],
    draw: false,
    coopWon: null,
    coopScore: null,
  };
}

/**
 * Drops input that belongs to players or teams no longer in the session,
 * so stale numbers never leak into totals.
 */
export function pruneSessionData(config: GameConfig, data: SessionData): SessionData {
  const keys = new Set(entityKeys(config, data));
  const pick = <T,>(obj: Record<string, T> | undefined) => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(obj ?? {})) if (keys.has(k)) out[k] = v;
    return out;
  };
  return {
    ...data,
    scores: pick(data.scores),
    rounds: (data.rounds ?? []).map((r) => pick(r)),
    bids: (data.bids ?? []).map((r) => pick(r)),
    categories: pick(data.categories),
    ranks: pick(data.ranks),
    winners: (data.winners ?? []).filter((k) => keys.has(k)),
  };
}

/**
 * Replaces one participant (usually a guest) by another identity everywhere in the
 * input, e.g. when a guest is linked to their new account. Returns null when the
 * new identity already plays in this session.
 */
export function replaceParticipant(
  data: SessionData,
  oldKey: string,
  next: { key: string; userId?: string; name: string },
): SessionData | null {
  if (oldKey === next.key) return data;
  if (data.participants.some((p) => p.key === next.key)) return null;
  const rekey = <T,>(obj: Record<string, T> | undefined) => {
    if (!obj) return obj;
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(obj)) out[k === oldKey ? next.key : k] = v;
    return out;
  };
  return {
    ...data,
    participants: data.participants.map((p) =>
      p.key === oldKey ? { ...p, key: next.key, userId: next.userId, name: next.name } : p,
    ),
    scores: rekey(data.scores),
    rounds: data.rounds?.map((r) => rekey(r)!),
    bids: data.bids?.map((r) => rekey(r)!),
    categories: rekey(data.categories),
    ranks: rekey(data.ranks),
    winners: data.winners?.map((k) => (k === oldKey ? next.key : k)),
  };
}

/** One line summary like "Ana won · 82 pts" for lists. */
export function summarizeResults(results: PlayerResult[], config?: GameConfig): string {
  if (results.length === 0) return '';
  if (config?.mode === 'coop') return results[0]?.won ? 'Won together' : 'Lost together';
  if (results.some((r) => r.draw)) return 'Draw';
  const winners = results.filter((r) => r.won);
  if (winners.length === 0) {
    const best = [...results].sort((a, b) => a.rank - b.rank)[0];
    return best?.score !== null && best?.score !== undefined ? `${best.name} · ${best.score}` : '';
  }
  const names = winners.map((w) => w.name);
  const label = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(' & ');
  const score = winners[0].score;
  return score !== null && score !== undefined ? `${label} won · ${score}` : `${label} won`;
}
