// Typed wrappers around the PocketBase REST API.

import { pb } from './pb';
import { computeResults, pruneSessionData, replaceParticipant } from './scoring';
import type { Friend, Game, GameConfig, Session, SessionData, User } from './types';

/** PocketBase returns "2026-01-02 18:30:00.000Z"; Hermes wants the ISO "T" separator. */
export function isoDate(value: string) {
  return value ? value.replace(' ', 'T') : value;
}

function toSession(record: any): Session {
  return {
    ...record,
    played_at: isoDate(record.played_at),
    created: isoDate(record.created),
    updated: isoDate(record.updated),
    duration_min: record.duration_min || null,
    data: record.data ?? { v: 1, participants: [] },
    results: record.results ?? [],
  };
}

function toGame(record: any): Game {
  return { ...record, config: record.config ?? { mode: 'points' } };
}

// ---------------------------------------------------------------- games

export async function listGames(): Promise<Game[]> {
  const items = await pb().collection('games').getFullList({ sort: 'name' });
  return items.map(toGame);
}

export interface GameInput {
  name: string;
  emoji: string;
  color: string;
  description?: string;
  config: GameConfig;
}

export async function createGame(input: GameInput, ownerId: string): Promise<Game> {
  return toGame(await pb().collection('games').create({ ...input, owner: ownerId }));
}

export async function updateGame(id: string, input: GameInput): Promise<Game> {
  return toGame(await pb().collection('games').update(id, input));
}

export async function deleteGame(id: string) {
  await pb().collection('games').delete(id);
}

// ------------------------------------------------------------- sessions

/** Everything needed for lists and statistics; the raw input (`data`) is loaded per session. */
const SESSION_LIST_FIELDS = 'id,game,created_by,players,played_at,duration_min,notes,results,created,updated';

export async function listSessions(): Promise<Session[]> {
  const items = await pb()
    .collection('sessions')
    .getFullList({ sort: '-played_at,-created', fields: SESSION_LIST_FIELDS, batch: 500 });
  return items.map(toSession);
}

export async function getSession(id: string): Promise<Session> {
  return toSession(await pb().collection('sessions').getOne(id));
}

export interface SessionInput {
  id?: string;
  game: Game;
  data: SessionData;
  playedAt: Date;
  durationMin: number | null;
  notes: string;
}

export async function saveSession(input: SessionInput, meId: string): Promise<Session> {
  const data = pruneSessionData(input.game.config, input.data);
  const results = computeResults(input.game.config, data);
  const players = [...new Set(data.participants.map((p) => p.userId).filter(Boolean) as string[])];
  const body = {
    game: input.game.id,
    players,
    played_at: input.playedAt.toISOString(),
    duration_min: input.durationMin ?? 0,
    notes: input.notes.trim(),
    data,
    results,
  };
  const record = input.id
    ? await pb().collection('sessions').update(input.id, body)
    : await pb().collection('sessions').create({ ...body, created_by: meId });
  return toSession(record);
}

export async function deleteSession(id: string) {
  await pb().collection('sessions').delete(id);
}

/**
 * Links a guest to a real account in every session you created, so their
 * history shows up on their profile. Returns how many sessions were updated.
 */
export async function linkGuest(guestKey: string, user: User, meId: string, games: Game[]): Promise<number> {
  const sessions = await pb()
    .collection('sessions')
    .getFullList({ filter: pb().filter('created_by = {:me} && results ~ {:key}', { me: meId, key: `"${guestKey}"` }) });
  const gamesById = new Map(games.map((g) => [g.id, g]));
  let updated = 0;
  for (const raw of sessions) {
    const session = toSession(raw);
    const game = gamesById.get(session.game);
    if (!game) continue;
    const data = replaceParticipant(session.data, guestKey, {
      key: `u:${user.id}`,
      userId: user.id,
      name: user.name?.trim() || user.username,
    });
    if (!data) continue;
    await saveSession(
      {
        id: session.id,
        game,
        data,
        playedAt: new Date(session.played_at),
        durationMin: session.duration_min,
        notes: session.notes,
      },
      meId,
    );
    updated++;
  }
  return updated;
}

// ---------------------------------------------------------------- users

export async function getUser(id: string): Promise<User> {
  return pb().collection('users').getOne<User>(id);
}

export async function findUserByUsername(username: string): Promise<User | null> {
  try {
    return await pb()
      .collection('users')
      .getFirstListItem<User>(pb().filter('username = {:u}', { u: username.toLowerCase().replace(/^@/, '') }));
  } catch {
    return null;
  }
}

export async function searchUsers(query: string, excludeId: string): Promise<User[]> {
  const q = query.trim().replace(/^@/, '');
  if (q.length < 2) return [];
  const res = await pb()
    .collection('users')
    .getList<User>(1, 10, {
      filter: pb().filter('id != {:me} && (username ~ {:q} || name ~ {:q})', { q, me: excludeId }),
      sort: 'username',
    });
  return res.items;
}

export async function updateProfile(id: string, input: { name: string; username: string }) {
  await pb()
    .collection('users')
    .update(id, { name: input.name.trim(), username: input.username.trim().toLowerCase() });
}

export async function deleteAccount(id: string) {
  await pb().collection('users').delete(id);
}

// -------------------------------------------------------------- friends

export async function listFriends(): Promise<Friend[]> {
  return pb().collection('friends').getFullList<Friend>({ expand: 'owner,friend', sort: '-created' });
}

export async function addFriend(meId: string, friendId: string) {
  await pb().collection('friends').create({ owner: meId, friend: friendId });
}

export async function removeFriend(recordId: string) {
  await pb().collection('friends').delete(recordId);
}
