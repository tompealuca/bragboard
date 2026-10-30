import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  ErrorBox,
  Footer,
  GameIcon,
  HScroll,
  IconButton,
  Input,
  Loading,
  Pill,
  RankBadge,
  Row,
  Screen,
  Sheet,
  Text,
} from '@/components/ui';
import { linkGuest } from '@/lib/api';
import { displayName, useMe } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { formatDay, formatDuration, formatTime } from '@/lib/format';
import { errorMessage } from '@/lib/pb';
import { keys, useDeleteSession, useFriendLists, useGames, useGamesById, useSession, useUserSearch } from '@/lib/queries';
import { entityKeys, entityName, roundScores, summarizeResults, usesTeams } from '@/lib/scoring';
import { spacing, useTheme } from '@/lib/theme';
import type { Game, PlayerResult, Session, User } from '@/lib/types';

export default function SessionDetail() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const { data: session, error, refetch, isLoading } = useSession(id);
  const game = useGamesById().get(session?.game ?? '');
  const remove = useDeleteSession();
  const [linking, setLinking] = useState<PlayerResult | null>(null);

  if (!session) {
    if (isLoading) return <Loading />;
    return (
      <Screen edges={['left', 'right']}>
        <ErrorBox error={error ?? new Error('Session not found')} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const isCreator = session.created_by === me.id;
  const results = [...session.results].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const summary = summarizeResults(session.results, game?.config);
  const teamNames = session.data.teams ?? [];

  const onDelete = async () => {
    const ok = await confirm('Delete this session?', 'Its scores disappear from everyone’s stats.', {
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(session.id, {
      onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/')),
      onError: (e) => notify("Couldn't delete", errorMessage(e)),
    });
  };

  const openPlayer = (r: PlayerResult) => {
    if (r.userId === me.id) router.push('/profile');
    else if (r.userId) router.push(`/user/${r.userId}`);
    else if (isCreator) setLinking(r);
  };

  return (
    <Screen
      edges={['left', 'right']}
      footer={
        game ? (
          <Footer>
            <Button
              title="Play again"
              icon="refresh"
              size="lg"
              onPress={() => router.push(`/play/${game.id}?from=${session.id}`)}
            />
          </Footer>
        ) : undefined
      }>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <IconButton icon="create-outline" label="Edit session" color={colors.primary} onPress={() => router.push(`/session/${session.id}/edit`)} />
              {isCreator && <IconButton icon="trash-outline" label="Delete session" color={colors.danger} onPress={onDelete} />}
            </View>
          ),
        }}
      />

      {fresh && (
        <View style={{ backgroundColor: colors.successSoft, borderRadius: 12, padding: spacing.md }}>
          <Text variant="bodyStrong" tone="success">
            ✓ Saved. Everyone in this session can see it now.
          </Text>
        </View>
      )}

      <Pressable onPress={() => game && router.push(`/game/${game.id}`)} style={{ alignItems: 'center', gap: spacing.sm }}>
        <GameIcon emoji={game?.emoji ?? '🎲'} color={game?.color ?? '#64748B'} size={72} />
        <Text variant="h1">{game?.name ?? 'Game'}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill icon="calendar-outline" text={`${formatDay(session.played_at)} · ${formatTime(session.played_at)}`} />
          {session.duration_min ? <Pill icon="time-outline" text={formatDuration(session.duration_min)} /> : null}
        </View>
      </Pressable>

      {summary ? (
        <View>
          <Pill tone="gold" center text={`👑 ${summary}`} />
        </View>
      ) : null}

      <Card style={{ paddingVertical: spacing.sm }}>
        {results.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => openPlayer(r)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}>
            <RankBadge rank={r.rank} />
            <Avatar name={r.name} id={r.key} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {r.name}
                {r.won ? ' 👑' : ''}
              </Text>
              <Text variant="small" tone="muted" numberOfLines={1}>
                {[
                  r.team !== undefined ? teamNames[r.team] || `Team ${r.team + 1}` : null,
                  r.userId ? null : isCreator ? 'Guest · tap to link account' : 'Guest',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            {typeof r.score === 'number' && <Text variant="big">{r.score}</Text>}
          </Pressable>
        ))}
      </Card>

      {game && <Breakdown game={game} session={session} />}

      {session.notes ? (
        <Card style={{ gap: spacing.xs }}>
          <Text variant="caption" tone="faint">
            Notes
          </Text>
          <Text>{session.notes}</Text>
        </Card>
      ) : null}

      {linking && <LinkGuestSheet guest={linking} onClose={() => setLinking(null)} />}
    </Screen>
  );
}

/** Round-by-round or category breakdown (read only). */
function Breakdown({ game, session }: { game: Game; session: Session }) {
  const { colors } = useTheme();
  const config = game.config;
  const data = session.data;
  if (config.mode !== 'rounds' && config.mode !== 'categories') return null;

  // Use the config the session was played with: keys come from the saved input.
  const ents = entityKeys(config, data);
  const rows: { label: string; values: (number | null | undefined)[]; sub?: string[] }[] =
    config.mode === 'rounds'
      ? roundScores(config, data).map((r, i) => ({
          label: String(i + 1),
          values: ents.map((k) => r[k]),
          sub: config.bidding ? ents.map((k) => `${data.bids?.[i]?.[k]?.bid ?? '–'}/${data.bids?.[i]?.[k]?.took ?? '–'}`) : undefined,
        }))
      : (config.categories ?? []).map((c) => ({ label: c, values: ents.map((k) => data.categories?.[k]?.[c]) }));
  if (rows.length === 0) return null;

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Text variant="caption" tone="faint" style={{ padding: spacing.md, paddingBottom: spacing.sm }}>
        {config.mode === 'rounds' ? `${rows.length} ${rows.length === 1 ? 'round' : 'rounds'}` : 'Score sheet'}
        {usesTeams(config, data) ? ' · teams' : ''}
      </Text>
      <HScroll>
          <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, paddingVertical: spacing.sm }}>
            <Text variant="caption" tone="faint" style={{ width: config.mode === 'rounds' ? 44 : 110, paddingHorizontal: spacing.md }}>
              {config.mode === 'rounds' ? '#' : ''}
            </Text>
            {ents.map((k) => (
              <Text key={k} variant="smallStrong" numberOfLines={1} style={{ flex: 1, minWidth: 70, textAlign: 'center' }}>
                {entityName(config, data, k)}
              </Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Text variant="small" tone="muted" numberOfLines={1} style={{ width: config.mode === 'rounds' ? 44 : 110, paddingHorizontal: spacing.md }}>
                {row.label}
              </Text>
              {row.values.map((v, j) => (
                <View key={j} style={{ flex: 1, minWidth: 70, alignItems: 'center' }}>
                  <Text variant="smallStrong" tone={v === null || v === undefined ? 'faint' : v < 0 ? 'danger' : 'default'}>
                    {v ?? '–'}
                  </Text>
                  {row.sub && (
                    <Text variant="small" tone="faint" style={{ fontSize: 11 }}>
                      {row.sub[j]}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </HScroll>
    </Card>
  );
}

function LinkGuestSheet({ guest, onClose }: { guest: PlayerResult; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: games } = useGames();
  const { friends } = useFriendLists();
  const [query, setQuery] = useState('');
  const search = useUserSearch(query);
  const [busy, setBusy] = useState(false);

  const candidates: User[] = query.trim().length >= 2 ? search.data ?? [] : friends.map((f) => f.user);

  const link = async (user: User) => {
    const ok = await confirm(
      `Link ${guest.name} to @${user.username}?`,
      `Every session you logged with the guest "${guest.name}" moves to ${displayName(user)}'s profile and stats.`,
      { confirmLabel: 'Link' },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const count = await linkGuest(guest.key, user, me.id, games ?? []);
      await qc.invalidateQueries({ queryKey: keys.sessions });
      await qc.invalidateQueries({ queryKey: ['session'] });
      onClose();
      notify('Linked', `${count} session${count === 1 ? '' : 's'} now belong to @${user.username}.`);
    } catch (e) {
      notify("Couldn't link", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title={`Link ${guest.name}`}>
      <Text tone="muted">
        Did {guest.name} create a Bragboard account? Link them so all your past games together show up on their profile.
      </Text>
      <Input
        icon="at"
        placeholder="Search username"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {busy ? <Loading /> : null}
      {!busy &&
        candidates.map((u) => (
          <Row
            key={u.id}
            left={<Avatar name={displayName(u)} id={`u:${u.id}`} />}
            title={displayName(u)}
            subtitle={`@${u.username}`}
            onPress={() => link(u)}
            chevron
          />
        ))}
      {!busy && candidates.length === 0 && (
        <Text tone="faint">{query ? 'No users found.' : 'Type their username to find them.'}</Text>
      )}
    </Sheet>
  );
}
