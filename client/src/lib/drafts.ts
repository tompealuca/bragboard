// Unfinished sessions are kept on the device while you play, so closing the app
// mid-game loses nothing. They are uploaded only when you press Save.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useMe } from './auth';
import type { SessionData } from './types';

export interface Draft {
  gameId: string;
  data: SessionData;
  startedAt: string;
  playedAt: string;
  notes: string;
  updatedAt: string;
}

const PREFIX = 'bragboard.draft.';
const draftKey = (userId: string, gameId: string) => `${PREFIX}${userId}.${gameId}`;

export async function loadDraft(userId: string, gameId: string): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId, gameId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(userId: string, draft: Draft) {
  await AsyncStorage.setItem(draftKey(userId, draft.gameId), JSON.stringify(draft)).catch(() => {});
}

export async function clearDraft(userId: string, gameId: string) {
  await AsyncStorage.removeItem(draftKey(userId, gameId)).catch(() => {});
}

async function listDrafts(userId: string): Promise<Draft[]> {
  const all = await AsyncStorage.getAllKeys();
  const mine = all.filter((k) => k.startsWith(`${PREFIX}${userId}.`));
  if (mine.length === 0) return [];
  const entries = await AsyncStorage.multiGet(mine);
  return entries
    .map(([, v]) => {
      try {
        return v ? (JSON.parse(v) as Draft) : null;
      } catch {
        return null;
      }
    })
    .filter((d): d is Draft => !!d)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useDrafts() {
  const me = useMe();
  return useQuery({
    queryKey: ['drafts', me.id],
    queryFn: () => listDrafts(me.id),
    enabled: !!me.id,
    staleTime: 0,
  });
}

export function useInvalidateDrafts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['drafts'] });
}
