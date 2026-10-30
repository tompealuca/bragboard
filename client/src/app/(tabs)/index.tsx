import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AddGameCard, GameCard, SessionList, useGridItemWidth } from '@/components/lists';
import { Avatar, Button, Card, EmptyState, ErrorBox, GameIcon, Ionicons, Screen, SectionHeader, Text } from '@/components/ui';
import { displayName, useMe } from '@/lib/auth';
import { useDrafts } from '@/lib/drafts';
import { formatTime } from '@/lib/format';
import { useGames, useGamesById, useGamesByRecency, useSessions } from '@/lib/queries';
import { perGameStats } from '@/lib/stats';
import { spacing, useTheme } from '@/lib/theme';

export default function Home() {
  const me = useMe();
  const { colors } = useTheme();
  const gamesQuery = useGames();
  const sessionsQuery = useSessions();
  const games = useGamesByRecency();
  const gamesById = useGamesById();
  const drafts = useDrafts();
  const cardWidth = useGridItemWidth();

  const sessions = sessionsQuery.data ?? [];
  const mine = useMemo(() => new Map(perGameStats(sessions, `u:${me.id}`).map((g) => [g.gameId, g])), [sessions, me.id]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) map.set(s.game, (map.get(s.game) ?? 0) + 1);
    return map;
  }, [sessions]);

  const firstName = displayName(me).split(' ')[0];
  const openDrafts = (drafts.data ?? []).filter((d) => gamesById.has(d.gameId));
  const loading = gamesQuery.isLoading && !gamesQuery.data;

  return (
    <Screen
      refreshing={gamesQuery.isRefetching || sessionsQuery.isRefetching}
      onRefresh={() => {
        gamesQuery.refetch();
        sessionsQuery.refetch();
        drafts.refetch();
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">Hi, {firstName} 👋</Text>
          <Text tone="muted">
            {sessions.length > 0 ? `${sessions.length} sessions logged so far` : 'Ready for game night?'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Your profile">
          <Avatar name={displayName(me)} id={`u:${me.id}`} size={44} />
        </Pressable>
      </View>

      {openDrafts.map((d) => {
        const game = gamesById.get(d.gameId)!;
        return (
          <Card
            key={d.gameId}
            onPress={() => router.push(`/play/${d.gameId}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderColor: colors.primary }}>
            <GameIcon emoji={game.emoji} color={game.color} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Continue {game.name}</Text>
              <Text variant="small" tone="muted">
                Started {formatTime(d.startedAt)} · {d.data.participants.length} players
              </Text>
            </View>
            <Ionicons name="play-circle" size={32} color={colors.primary} />
          </Card>
        );
      })}

      <Button title="New session" size="lg" icon="add-circle" onPress={() => router.push('/pick-game')} />

      {gamesQuery.error && !gamesQuery.data ? <ErrorBox error={gamesQuery.error} onRetry={() => gamesQuery.refetch()} /> : null}

      <SectionHeader title="Your games" action="Add game" onAction={() => router.push('/game/new')} />
      {!loading && games.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🎲"
            title="No games yet"
            text="Add the games you play: pick a ready-made one like Catan, Uno or Whist, or set up your own scoring."
            action="Add your first game"
            onAction={() => router.push('/game/new')}
          />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {games.map((g) => (
            <GameCard key={g.id} game={g} played={counts.get(g.id) ?? 0} mine={mine.get(g.id)} width={cardWidth} />
          ))}
          <AddGameCard width={cardWidth} />
        </View>
      )}

      {sessions.length > 0 && (
        <>
          <SectionHeader title="Recent sessions" action="See all" onAction={() => router.push('/history')} />
          <SessionList sessions={sessions.slice(0, 5)} gamesById={gamesById} />
        </>
      )}
    </Screen>
  );
}
