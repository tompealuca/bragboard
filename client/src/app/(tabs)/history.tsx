import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SessionRow } from '@/components/lists';
import { Button, Card, Chip, EmptyState, Screen, Text } from '@/components/ui';
import { formatMonth } from '@/lib/format';
import { useGamesById, useGamesByRecency, useSessions } from '@/lib/queries';
import { spacing } from '@/lib/theme';
import type { Session } from '@/lib/types';

const PAGE = 40;

export default function History() {
  const params = useLocalSearchParams<{ game?: string }>();
  const sessionsQuery = useSessions();
  const gamesById = useGamesById();
  const games = useGamesByRecency();
  const [filter, setFilter] = useState<string | null>(params.game ?? null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (params.game) setFilter(params.game);
  }, [params.game]);

  const all = sessionsQuery.data ?? [];
  const sessions = filter ? all.filter((s) => s.game === filter) : all;
  const groups = useMemo(() => {
    const out: { title: string; items: Session[] }[] = [];
    for (const s of sessions.slice(0, limit)) {
      const title = formatMonth(s.played_at);
      if (out[out.length - 1]?.title !== title) out.push({ title, items: [] });
      out[out.length - 1].items.push(s);
    }
    return out;
  }, [sessions, limit]);

  const playedGames = games.filter((g) => all.some((s) => s.game === g.id));

  return (
    <Screen refreshing={sessionsQuery.isRefetching} onRefresh={() => sessionsQuery.refetch()}>
      <Text variant="title">History</Text>

      {playedGames.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="All games" selected={!filter} onPress={() => setFilter(null)} />
          {playedGames.map((g) => (
            <Chip
              key={g.id}
              label={`${g.emoji} ${g.name}`}
              selected={filter === g.id}
              onPress={() => setFilter(filter === g.id ? null : g.id)}
            />
          ))}
        </ScrollView>
      )}

      {sessions.length === 0 && !sessionsQuery.isLoading ? (
        <Card>
          <EmptyState
            emoji="🗓️"
            title="Nothing here yet"
            text="Every session you play, or friends log with you, shows up here."
            action="Start a session"
            onAction={() => router.push('/pick-game')}
          />
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.title} style={{ gap: spacing.sm }}>
            <Text variant="caption" tone="faint">
              {g.title}
            </Text>
            <Card style={{ paddingVertical: spacing.sm }}>
              {g.items.map((s) => (
                <SessionRow key={s.id} session={s} game={gamesById.get(s.game)} />
              ))}
            </Card>
          </View>
        ))
      )}

      {sessions.length > limit && (
        <Button title="Show more" variant="secondary" onPress={() => setLimit((l) => l + PAGE)} />
      )}
    </Screen>
  );
}
