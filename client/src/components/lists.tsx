import { router } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';

import { Card, GameIcon, Ionicons, Row, Text } from '@/components/ui';
import { formatDay } from '@/lib/format';
import { summarizeResults } from '@/lib/scoring';
import { formatPercent, type GameSummary } from '@/lib/stats';
import { MAX_WIDTH, radius, spacing, useTheme } from '@/lib/theme';
import type { Game, Session } from '@/lib/types';

/** Width of one card in a responsive grid (2 columns on phones, up to 4 on wide screens). */
export function useGridItemWidth(min = 150) {
  const { width } = useWindowDimensions();
  const content = Math.min(width, MAX_WIDTH) - spacing.lg * 2;
  const columns = Math.max(2, Math.min(4, Math.floor((content + spacing.md) / (min + spacing.md))));
  return (content - spacing.md * (columns - 1)) / columns;
}

export function GameCard({
  game,
  played,
  mine,
  width,
}: {
  game: Game;
  played: number;
  mine?: GameSummary;
  width: number;
}) {
  return (
    <Card onPress={() => router.push(`/game/${game.id}`)} style={{ width, gap: spacing.md, padding: spacing.md + 2 }}>
      <GameIcon emoji={game.emoji} color={game.color} size={48} />
      <View style={{ gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {game.name}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {played === 0 ? 'Not played yet' : `${played} ${played === 1 ? 'session' : 'sessions'}`}
        </Text>
        {mine && mine.played > 0 ? (
          <Text variant="small" tone={mine.winRate >= 0.5 ? 'success' : 'faint'} numberOfLines={1}>
            You win {formatPercent(mine.winRate)}
          </Text>
        ) : (
          <Text variant="small" tone="faint">
            {' '}
          </Text>
        )}
      </View>
    </Card>
  );
}

export function AddGameCard({ width }: { width: number }) {
  const { colors } = useTheme();
  return (
    <Card
      onPress={() => router.push('/game/new')}
      style={{
        width,
        minHeight: 150,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.border,
        shadowOpacity: 0,
        elevation: 0,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.pill,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="add" size={26} color={colors.primary} />
      </View>
      <Text variant="smallStrong" tone="primary">
        Add game
      </Text>
    </Card>
  );
}

export function SessionRow({ session, game, showDate = true }: { session: Session; game?: Game; showDate?: boolean }) {
  const players = session.results.length;
  const summary = summarizeResults(session.results, game?.config);
  return (
    <Row
      onPress={() => router.push(`/session/${session.id}`)}
      left={<GameIcon emoji={game?.emoji ?? '🎲'} color={game?.color ?? '#64748B'} size={44} />}
      title={game?.name ?? 'Game'}
      subtitle={[summary, `${players} ${players === 1 ? 'player' : 'players'}`].filter(Boolean).join(' · ')}
      right={
        showDate ? (
          <Text variant="small" tone="faint">
            {formatDay(session.played_at)}
          </Text>
        ) : undefined
      }
      chevron
    />
  );
}

/** A card holding a list of sessions. */
export function SessionList({
  sessions,
  gamesById,
  showDate = true,
}: {
  sessions: Session[];
  gamesById: Map<string, Game>;
  showDate?: boolean;
}) {
  if (sessions.length === 0) return null;
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      {sessions.map((s) => (
        <SessionRow key={s.id} session={s} game={gamesById.get(s.game)} showDate={showDate} />
      ))}
    </Card>
  );
}
