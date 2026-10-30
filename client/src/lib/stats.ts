// Statistics engine. Works on the computed `results` stored with every session,
// so it is the same for every scoring mode.

import type { PlayerResult, Session } from './types';

export interface PlayerInfo {
  key: string;
  name: string;
  userId?: string;
  count: number;
  lastPlayed: string;
}

export interface PlayerStats {
  key: string;
  name: string;
  userId?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0..1 */
  winRate: number;
  avgScore: number | null;
  bestScore: number | null;
  avgRank: number | null;
  currentStreak: number;
  longestStreak: number;
  lastPlayed: string | null;
}

export interface HeadToHead {
  games: number;
  aAhead: number;
  bAhead: number;
  ties: number;
}

export interface GameRecord {
  name: string;
  value: number;
  sessionId?: string;
  date?: string;
}

const time = (s: Session) => new Date(s.played_at).getTime() || 0;

/** Oldest first. */
export function chronological(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => time(a) - time(b) || a.created.localeCompare(b.created));
}

/** Newest first. */
export function newestFirst(sessions: Session[]): Session[] {
  return chronological(sessions).reverse();
}

export function resultFor(session: Session, key: string): PlayerResult | undefined {
  return (session.results ?? []).find((r) => r.key === key);
}

/** Everyone who appears in the sessions, most frequent first. Names come from the latest session. */
export function playersIn(sessions: Session[]): PlayerInfo[] {
  const map = new Map<string, PlayerInfo>();
  for (const s of chronological(sessions)) {
    for (const r of s.results ?? []) {
      const prev = map.get(r.key);
      map.set(r.key, {
        key: r.key,
        name: r.name,
        userId: r.userId ?? prev?.userId,
        count: (prev?.count ?? 0) + 1,
        lastPlayed: s.played_at,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Sessions of the selected players. With `together`, only sessions where all of
 * them played; otherwise sessions where any of them played.
 */
export function filterByPlayers(sessions: Session[], keys: string[], together: boolean): Session[] {
  if (keys.length === 0) return sessions;
  return sessions.filter((s) => {
    const present = new Set((s.results ?? []).map((r) => r.key));
    return together ? keys.every((k) => present.has(k)) : keys.some((k) => present.has(k));
  });
}

export function playerStats(sessions: Session[], key: string, lowestWins = false): PlayerStats {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let best: number | null = null;
  let rankSum = 0;
  let streak = 0;
  let longest = 0;
  let name = '';
  let userId: string | undefined;
  let lastPlayed: string | null = null;

  for (const s of chronological(sessions)) {
    const r = resultFor(s, key);
    if (!r) continue;
    played++;
    name = r.name;
    userId = r.userId ?? userId;
    lastPlayed = s.played_at;
    rankSum += r.rank;
    if (r.won) {
      wins++;
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 0;
      if (r.draw) draws++;
    }
    if (typeof r.score === 'number') {
      scoreSum += r.score;
      scoreCount++;
      if (best === null || (lowestWins ? r.score < best : r.score > best)) best = r.score;
    }
  }

  return {
    key,
    name,
    userId,
    played,
    wins,
    draws,
    losses: played - wins - draws,
    winRate: played ? wins / played : 0,
    avgScore: scoreCount ? scoreSum / scoreCount : null,
    bestScore: best,
    avgRank: played ? rankSum / played : null,
    currentStreak: streak,
    longestStreak: longest,
    lastPlayed,
  };
}

/** Stats for each selected player, best first. */
export function leaderboard(sessions: Session[], keys: string[], lowestWins = false): PlayerStats[] {
  return keys
    .map((k) => playerStats(sessions, k, lowestWins))
    .filter((s) => s.played > 0)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        (a.avgRank ?? 99) - (b.avgRank ?? 99) ||
        a.name.localeCompare(b.name),
    );
}

/** Who finished ahead of whom, over the sessions both played. */
export function headToHead(sessions: Session[], a: string, b: string): HeadToHead {
  const out: HeadToHead = { games: 0, aAhead: 0, bAhead: 0, ties: 0 };
  for (const s of sessions) {
    const ra = resultFor(s, a);
    const rb = resultFor(s, b);
    if (!ra || !rb) continue;
    out.games++;
    if (ra.rank < rb.rank) out.aAhead++;
    else if (rb.rank < ra.rank) out.bAhead++;
    else out.ties++;
  }
  return out;
}

/** Cumulative wins per player after each session (oldest first). */
export function winsOverTime(sessions: Session[], keys: string[]) {
  const totals: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const series: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]));
  const dates: string[] = [];
  for (const s of chronological(sessions)) {
    for (const k of keys) {
      if (resultFor(s, k)?.won) totals[k]++;
      series[k].push(totals[k]);
    }
    dates.push(s.played_at);
  }
  return { dates, series };
}

/** Notable records for a game. */
export function gameRecords(sessions: Session[], lowestWins = false) {
  let bestScore: GameRecord | undefined;
  let biggestWin: GameRecord | undefined;
  const ordered = chronological(sessions);

  for (const s of ordered) {
    const results = s.results ?? [];
    for (const r of results) {
      if (typeof r.score !== 'number') continue;
      if (!bestScore || (lowestWins ? r.score < bestScore.value : r.score > bestScore.value))
        bestScore = { name: r.name, value: r.score, sessionId: s.id, date: s.played_at };
    }
    const winners = results.filter((r) => r.won);
    const winnerScore = winners[0]?.score;
    if (winners.length > 0 && typeof winnerScore === 'number') {
      const others = results
        .filter((r) => !r.won && typeof r.score === 'number' && (r.team === undefined || r.team !== winners[0].team))
        .map((r) => r.score as number);
      if (others.length > 0) {
        const runnerUp = lowestWins ? Math.min(...others) : Math.max(...others);
        const margin = Math.abs(winnerScore - runnerUp);
        if (!biggestWin || margin > biggestWin.value) {
          const name = winners.map((w) => w.name).join(' & ');
          biggestWin = { name, value: margin, sessionId: s.id, date: s.played_at };
        }
      }
    }
  }

  let longestStreak: GameRecord | undefined;
  let mostWins: GameRecord | undefined;
  for (const p of playersIn(ordered)) {
    const st = playerStats(ordered, p.key, lowestWins);
    if (st.longestStreak > 1 && (!longestStreak || st.longestStreak > longestStreak.value))
      longestStreak = { name: st.name, value: st.longestStreak };
    if (st.wins > 0 && (!mostWins || st.wins > mostWins.value)) mostWins = { name: st.name, value: st.wins };
  }

  return { bestScore, biggestWin, longestStreak, mostWins };
}

export interface GameSummary {
  gameId: string;
  played: number;
  wins: number;
  winRate: number;
  lastPlayed: string;
}

/** Per game totals for one player, most played first. */
export function perGameStats(sessions: Session[], key: string): GameSummary[] {
  const map = new Map<string, GameSummary>();
  for (const s of chronological(sessions)) {
    const r = resultFor(s, key);
    if (!r) continue;
    const prev = map.get(s.game) ?? { gameId: s.game, played: 0, wins: 0, winRate: 0, lastPlayed: s.played_at };
    prev.played++;
    if (r.won) prev.wins++;
    prev.winRate = prev.wins / prev.played;
    prev.lastPlayed = s.played_at;
    map.set(s.game, prev);
  }
  return [...map.values()].sort((a, b) => b.played - a.played || b.lastPlayed.localeCompare(a.lastPlayed));
}

/** Headline numbers for a profile. */
export function overview(sessions: Session[], key: string) {
  const st = playerStats(sessions, key);
  const games = perGameStats(sessions, key);
  const best = games
    .filter((g) => g.played >= 3)
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played)[0];
  return {
    played: st.played,
    wins: st.wins,
    draws: st.draws,
    winRate: st.winRate,
    currentStreak: st.currentStreak,
    longestStreak: st.longestStreak,
    gamesCount: games.length,
    favoriteGameId: games[0]?.gameId,
    bestGameId: best?.gameId,
  };
}

export function formatPercent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}
