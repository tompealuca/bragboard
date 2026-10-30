// React Query hooks: cached, shared data for every screen.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import * as api from './api';
import { useMe } from './auth';
import { pb } from './pb';
import { newestFirst } from './stats';
import type { Friend, Game, Session, User } from './types';

export const keys = {
  games: ['games'] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  friends: ['friends'] as const,
  user: (id: string) => ['user', id] as const,
  userSearch: (q: string) => ['userSearch', q] as const,
};

export function useGames() {
  return useQuery({ queryKey: keys.games, queryFn: api.listGames });
}

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: api.listSessions });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: keys.session(id ?? ''),
    queryFn: () => api.getSession(id!),
    enabled: !!id,
  });
}

export function useFriends() {
  return useQuery({ queryKey: keys.friends, queryFn: api.listFriends });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: keys.user(id ?? ''),
    queryFn: () => api.getUser(id!),
    enabled: !!id,
  });
}

export function useUserSearch(query: string) {
  const me = useMe();
  const q = query.trim().replace(/^@/, '').toLowerCase();
  return useQuery({
    queryKey: keys.userSearch(q),
    queryFn: () => api.searchUsers(q, me.id),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
}

// ------------------------------------------------------------ derived data

export function useGamesById() {
  const { data } = useGames();
  return useMemo(() => new Map((data ?? []).map((g) => [g.id, g])), [data]);
}

/** Games, most recently played first (never played ones last, alphabetically). */
export function useGamesByRecency() {
  const { data: games } = useGames();
  const { data: sessions } = useSessions();
  return useMemo(() => {
    const last = new Map<string, string>();
    for (const s of sessions ?? []) {
      const prev = last.get(s.game);
      if (!prev || s.played_at > prev) last.set(s.game, s.played_at);
    }
    return [...(games ?? [])].sort((a, b) => {
      const la = last.get(a.id) ?? '';
      const lb = last.get(b.id) ?? '';
      return lb.localeCompare(la) || a.name.localeCompare(b.name);
    });
  }, [games, sessions]);
}

export function useGameSessions(gameId: string | undefined) {
  const { data } = useSessions();
  return useMemo(() => newestFirst((data ?? []).filter((s) => s.game === gameId)), [data, gameId]);
}

/** Friends you added, people who added you (and you haven't added back). */
export function useFriendLists() {
  const me = useMe();
  const query = useFriends();
  const lists = useMemo(() => {
    const all = query.data ?? [];
    const mine = all.filter((f) => f.owner === me.id && f.expand?.friend);
    const myIds = new Set(mine.map((f) => f.friend));
    const addedMe = all.filter((f) => f.friend === me.id && f.expand?.owner && !myIds.has(f.owner));
    return {
      friends: mine.map((f) => ({ record: f, user: f.expand!.friend as User })),
      addedMe: addedMe.map((f) => ({ record: f, user: f.expand!.owner as User })),
      friendIds: myIds,
    };
  }, [query.data, me.id]);
  return { ...query, ...lists };
}

// ---------------------------------------------------------------- mutations

export function useSaveGame() {
  const qc = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: api.GameInput }) =>
      id ? api.updateGame(id, input) : api.createGame(input, me.id),
    onSuccess: (game) => {
      qc.setQueryData<Game[]>(keys.games, (old) => {
        const rest = (old ?? []).filter((g) => g.id !== game.id);
        return [...rest, game].sort((a, b) => a.name.localeCompare(b.name));
      });
      qc.invalidateQueries({ queryKey: keys.games });
    },
  });
}

export function useDeleteGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteGame,
    onSuccess: (_, id) => {
      qc.setQueryData<Game[]>(keys.games, (old) => (old ?? []).filter((g) => g.id !== id));
      qc.setQueryData<Session[]>(keys.sessions, (old) => (old ?? []).filter((s) => s.game !== id));
      qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

export function useSaveSession() {
  const qc = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: (input: api.SessionInput) => api.saveSession(input, me.id),
    onSuccess: (session) => {
      qc.setQueryData(keys.session(session.id), session);
      qc.setQueryData<Session[]>(keys.sessions, (old) => [
        session,
        ...(old ?? []).filter((s) => s.id !== session.id),
      ]);
      qc.invalidateQueries({ queryKey: keys.sessions });
      qc.invalidateQueries({ queryKey: keys.games });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSession,
    onSuccess: (_, id) => {
      qc.setQueryData<Session[]>(keys.sessions, (old) => (old ?? []).filter((s) => s.id !== id));
      qc.removeQueries({ queryKey: keys.session(id) });
    },
  });
}

export function useAddFriend() {
  const qc = useQueryClient();
  const me = useMe();
  return useMutation({
    mutationFn: (friendId: string) => api.addFriend(me.id, friendId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.friends }),
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Friend) => api.removeFriend(record.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.friends }),
  });
}

// ---------------------------------------------------------------- realtime

/** Live updates: when a friend saves a session with you, it appears without refreshing. */
export function useRealtimeSync(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubs: (() => Promise<void>)[] = [];
    const watch = async (collection: string, onEvent: (e: any) => void) => {
      try {
        const unsub = await pb().collection(collection).subscribe('*', onEvent);
        if (cancelled) unsub();
        else unsubs.push(unsub);
      } catch {
        // realtime is a nice-to-have; screens still refresh on focus / pull
      }
    };
    watch('sessions', (e) => {
      qc.invalidateQueries({ queryKey: keys.sessions });
      if (e?.record?.id) qc.invalidateQueries({ queryKey: keys.session(e.record.id) });
    });
    watch('games', () => qc.invalidateQueries({ queryKey: keys.games }));
    watch('friends', () => qc.invalidateQueries({ queryKey: keys.friends }));
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u().catch(() => {}));
    };
  }, [enabled, qc]);
}
