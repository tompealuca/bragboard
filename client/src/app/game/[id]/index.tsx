import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SessionList } from '@/components/lists';
import { HeadToHeadCard, Leaderboard, LineChart, RecordsCard } from '@/components/stats';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  GameIcon,
  IconButton,
  Loading,
  Screen,
  SectionHeader,
  StatTile,
  Text,
  ToggleRow,
} from '@/components/ui';
import { useMe } from '@/lib/auth';
import { formatDay, formatDuration } from '@/lib/format';
import { useGames, useGameSessions, useGamesById, useSessions } from '@/lib/queries';
import {
  filterByPlayers,
  gameRecords,
  headToHead,
  leaderboard,
  playersIn,
  winsOverTime,
} from '@/lib/stats';
import { PLAYER_COLORS } from '@/lib/palette';
import { modeLabel } from '@/lib/templates';
import { spacing, useTheme } from '@/lib/theme';

export default function GamePage() {
  const { id, player } = useLocalSearchParams<{ id: string; player?: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const gamesQuery = useGames();
  const sessionsQuery = useSessions();
  const game = useGamesById().get(id);
  const sessions = useGameSessions(id);
  const players = useMemo(() => playersIn(sessions), [sessions]);
  // distinct colors per player on this page, so chart lines never look alike
  const colorOf = useMemo(() => {
    const map = new Map(players.map((p, i) => [p.key, PLAYER_COLORS[i % PLAYER_COLORS.length]]));
    return (key: string) => map.get(key) ?? PLAYER_COLORS[0];
  }, [players]);

  const [picked, setPicked] = useState<string[] | null>(player ? [player] : null);
  const [together, setTogether] = useState(false);
  const selected = picked ?? players.slice(0, 6).map((p) => p.key);

  const lowestWins = !!game?.config.lowestWins;
  const useTogether = together && selected.length > 1;
  const filtered = useMemo(
    () => (selected.length ? filterByPlayers(sessions, selected, useTogether) : sessions),
    [sessions, selected, useTogether],
  );
  const board = useMemo(() => leaderboard(filtered, selected, lowestWins), [filtered, selected, lowestWins]);
  const chart = useMemo(() => winsOverTime(filtered, selected), [filtered, selected]);
  const records = useMemo(() => gameRecords(filtered, lowestWins), [filtered, lowestWins]);
  const pairs = useMemo(() => {
    const chosen = players.filter((p) => selected.includes(p.key)).slice(0, 4);
    const out = [];
    for (let i = 0; i < chosen.length; i++)
      for (let j = i + 1; j < chosen.length; j++)
        out.push({ a: chosen[i], b: chosen[j], h2h: headToHead(filtered, chosen[i].key, chosen[j].key) });
    return out;
  }, [players, selected, filtered]);

  if (!game) {
    if (gamesQuery.isLoading) return <Loading />;
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState emoji="🤷" title="Game not found" text="It may have been deleted." />
      </Screen>
    );
  }

  const toggle = (key: string) =>
    setPicked((cur) => {
      const base = cur ?? selected;
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
    });

  const durations = filtered.map((s) => s.duration_min).filter((d): d is number => !!d);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const showScores = ['points', 'rounds', 'categories'].includes(game.config.mode) || !!game.config.coopScore;
  const nameOf = new Map(players.map((p) => [p.key, p.name]));

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={sessionsQuery.isRefetching}
      onRefresh={() => sessionsQuery.refetch()}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () =>
            game.owner === me.id ? (
              <IconButton icon="create-outline" label="Edit game" color={colors.primary} onPress={() => router.push(`/game/${game.id}/edit`)} />
            ) : null,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <GameIcon emoji={game.emoji} color={game.color} size={64} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {game.name}
          </Text>
          <Text tone="muted">{modeLabel(game.config, true)}</Text>
        </View>
      </View>

      <Button title="New session" icon="add-circle" size="lg" onPress={() => router.push(`/play/${game.id}`)} />

      {sessions.length === 0 ? (
        <Card>
          <EmptyState emoji="📊" title="No sessions yet" text="Play a round and the stats show up here." />
        </Card>
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h2">Players</Text>
              <Text
                variant="smallStrong"
                tone="primary"
                onPress={() => setPicked(selected.length === players.length ? [] : players.map((p) => p.key))}>
                {selected.length === players.length ? 'Clear' : 'Select all'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {players.map((p) => (
                <Chip key={p.key} label={p.name} avatarId={p.key} selected={selected.includes(p.key)} onPress={() => toggle(p.key)} />
              ))}
            </View>
            {selected.length > 1 && (
              <ToggleRow
                title="Only games played together"
                subtitle="Compare them on equal terms"
                value={together}
                onChange={setTogether}
              />
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <StatTile label="Sessions" value={filtered.length} />
            <StatTile label="Last played" value={filtered[0] ? formatDay(filtered[0].played_at) : '–'} />
            {avgDuration ? <StatTile label="Avg. play time" value={formatDuration(avgDuration)} /> : null}
          </View>

          {filtered.length === 0 ? (
            <Text tone="muted" style={{ textAlign: 'center' }}>
              These players haven't played together yet.
            </Text>
          ) : (
            <>
              <Leaderboard rows={board} showScores={showScores} colorOf={colorOf} />
              <LineChart
                colorOf={colorOf}
                title="Wins over time"
                series={selected
                  .filter((k) => chart.series[k]?.some((v) => v > 0))
                  .map((k) => ({ key: k, name: nameOf.get(k) ?? '?', values: chart.series[k] }))}
              />
              <HeadToHeadCard pairs={pairs} colorOf={colorOf} />
              <RecordsCard records={records} />
              <SectionHeader
                title="Sessions"
                action={filtered.length > 5 ? 'See all' : undefined}
                onAction={() => router.push(`/history?game=${game.id}`)}
              />
              <SessionList sessions={filtered.slice(0, 5)} gamesById={new Map([[game.id, game]])} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
