import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { SessionList } from '@/components/lists';
import { Avatar, Card, EmptyState, GameIcon, Row, SectionHeader, StatTile, Text } from '@/components/ui';
import { displayName, useMe } from '@/lib/auth';
import { useGamesById, useSessions } from '@/lib/queries';
import { formatPercent, headToHead, overview, perGameStats } from '@/lib/stats';
import { spacing } from '@/lib/theme';
import type { User } from '@/lib/types';

/** Profile with stats. For other people it only uses sessions you can see (the ones you share). */
export function ProfileView({ user, actions }: { user: User; actions?: ReactNode }) {
  const me = useMe();
  const isMe = user.id === me.id;
  const { data: allSessions } = useSessions();
  const gamesById = useGamesById();
  const key = `u:${user.id}`;

  const sessions = useMemo(
    () => (allSessions ?? []).filter((s) => s.results.some((r) => r.key === key)),
    [allSessions, key],
  );
  const stats = useMemo(() => overview(sessions, key), [sessions, key]);
  const games = useMemo(() => perGameStats(sessions, key), [sessions, key]);
  const vsMe = useMemo(() => (isMe ? null : headToHead(sessions, `u:${me.id}`, key)), [sessions, isMe, me.id, key]);

  const favorite = stats.favoriteGameId ? gamesById.get(stats.favoriteGameId) : undefined;
  const best = stats.bestGameId ? gamesById.get(stats.bestGameId) : undefined;
  const since = user.created ? new Date(user.created.replace(' ', 'T')) : null;

  return (
    <>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Avatar name={displayName(user)} id={key} size={84} />
        <Text variant="h1" style={{ marginTop: spacing.sm }}>
          {displayName(user)}
        </Text>
        <Text tone="muted">
          @{user.username}
          {since && !Number.isNaN(since.getTime())
            ? ` · since ${since.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
            : ''}
        </Text>
        {actions}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatTile label="Sessions" value={stats.played} />
        <StatTile label="Wins" value={stats.wins} />
        <StatTile label="Win rate" value={stats.played ? formatPercent(stats.winRate) : '–'} />
        <StatTile label="Best streak" value={stats.longestStreak} />
      </View>

      {vsMe && vsMe.games > 0 && (
        <Card style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Text variant="caption" tone="faint">
            You vs {displayName(user).split(' ')[0]}
          </Text>
          <Text variant="big">
            {vsMe.aAhead} – {vsMe.bAhead}
          </Text>
          <Text variant="small" tone="muted">
            in {vsMe.games} games together{vsMe.ties ? ` · ${vsMe.ties} ${vsMe.ties === 1 ? 'tie' : 'ties'}` : ''}
          </Text>
        </Card>
      )}

      {(favorite || best) && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {favorite && <Highlight label="Most played" emoji={favorite.emoji} name={favorite.name} />}
          {best && <Highlight label="Best at" emoji={best.emoji} name={best.name} />}
        </View>
      )}

      <SectionHeader title={isMe ? 'Your games' : 'Games together'} />
      {games.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🎲"
            title="No games yet"
            text={isMe ? 'Sessions you play show up here.' : `You haven't played with ${displayName(user)} yet.`}
          />
        </Card>
      ) : (
        <Card style={{ paddingVertical: spacing.sm }}>
          {games.map((g) => {
            const game = gamesById.get(g.gameId);
            return (
              <Row
                key={g.gameId}
                left={<GameIcon emoji={game?.emoji ?? '🎲'} color={game?.color ?? '#64748B'} size={40} />}
                title={game?.name ?? 'Game'}
                subtitle={`${g.played} played · ${g.wins} ${g.wins === 1 ? 'win' : 'wins'}`}
                right={<Text variant="number">{formatPercent(g.winRate)}</Text>}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: g.gameId, player: key } })}
                chevron
              />
            );
          })}
        </Card>
      )}

      {sessions.length > 0 && (
        <>
          <SectionHeader title="Recent sessions" />
          <SessionList sessions={sessions.slice(0, 5)} gamesById={gamesById} />
        </>
      )}
    </>
  );
}

function Highlight({ label, emoji, name }: { label: string; emoji: string; name: string }) {
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {emoji} {name}
      </Text>
    </Card>
  );
}
