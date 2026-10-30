import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, IconButton, Input, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { displayName, useMe } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { errorMessage } from '@/lib/pb';
import { useAddFriend, useFriendLists, useRemoveFriend, useSessions, useUserSearch } from '@/lib/queries';
import { playersIn } from '@/lib/stats';
import { spacing, useTheme } from '@/lib/theme';
import type { Friend, User } from '@/lib/types';

export default function Friends() {
  const me = useMe();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const lists = useFriendLists();
  const { data: sessions } = useSessions();
  const search = useUserSearch(query);
  const add = useAddFriend();
  const remove = useRemoveFriend();

  // People you played with who have an account but aren't your friends yet.
  const suggestions = useMemo(
    () =>
      playersIn(sessions ?? []).filter((p) => p.userId && p.userId !== me.id && !lists.friendIds.has(p.userId)),
    [sessions, me.id, lists.friendIds],
  );

  const addFriend = (user: { id: string }) =>
    add.mutate(user.id, { onError: (e) => notify("Couldn't add friend", errorMessage(e)) });

  const removeFriend = async (record: Friend, user: User) => {
    if (await confirm(`Remove @${user.username}?`, 'Your games together stay in your history.', { confirmLabel: 'Remove', destructive: true }))
      remove.mutate(record, { onError: (e) => notify("Couldn't remove", errorMessage(e)) });
  };

  const q = query.trim();
  const results = (search.data ?? []).filter((u) => u.id !== me.id);

  return (
    <Screen refreshing={lists.isRefetching} onRefresh={() => lists.refetch()}>
      <Text variant="title">Friends</Text>
      <Text tone="muted" style={{ marginTop: -spacing.sm }}>
        Add friends by username to pick them in one tap. Your username is{' '}
        <Text variant="bodyStrong" tone="primary">
          @{me.username}
        </Text>
      </Text>

      <Input
        icon="search"
        placeholder="Find people by @username or name"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        right={search.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
      />

      {q.length >= 2 && (
        <Card style={{ paddingVertical: spacing.sm }}>
          {results.length === 0 && !search.isFetching ? (
            <Text tone="muted" style={{ paddingVertical: spacing.sm }}>
              No one found for "{q}".
            </Text>
          ) : (
            results.map((u) => {
              const isFriend = lists.friendIds.has(u.id);
              return (
                <Row
                  key={u.id}
                  left={<Avatar name={displayName(u)} id={`u:${u.id}`} />}
                  title={displayName(u)}
                  subtitle={`@${u.username}`}
                  onPress={() => router.push(`/user/${u.id}`)}
                  right={
                    isFriend ? (
                      <Text variant="smallStrong" tone="success">
                        Friend ✓
                      </Text>
                    ) : (
                      <Button title="Add" size="sm" icon="person-add" onPress={() => addFriend(u)} />
                    )
                  }
                />
              );
            })
          )}
        </Card>
      )}

      {lists.addedMe.length > 0 && (
        <>
          <SectionHeader title="Added you" />
          <Card style={{ paddingVertical: spacing.sm }}>
            {lists.addedMe.map(({ user }) => (
              <Row
                key={user.id}
                left={<Avatar name={displayName(user)} id={`u:${user.id}`} />}
                title={displayName(user)}
                subtitle={`@${user.username}`}
                onPress={() => router.push(`/user/${user.id}`)}
                right={<Button title="Add back" size="sm" onPress={() => addFriend(user)} />}
              />
            ))}
          </Card>
        </>
      )}

      <SectionHeader title={`Your friends${lists.friends.length ? ` · ${lists.friends.length}` : ''}`} />
      {lists.friends.length === 0 ? (
        <Card>
          <EmptyState
            emoji="👋"
            title="No friends yet"
            text="Search for a username above. Friends are quick to add when you log a session."
          />
        </Card>
      ) : (
        <Card style={{ paddingVertical: spacing.sm }}>
          {lists.friends.map(({ record, user }) => (
            <Row
              key={record.id}
              left={<Avatar name={displayName(user)} id={`u:${user.id}`} />}
              title={displayName(user)}
              subtitle={`@${user.username}`}
              onPress={() => router.push(`/user/${user.id}`)}
              right={
                <IconButton
                  icon="person-remove-outline"
                  label={`Remove ${user.username}`}
                  color={colors.textFaint}
                  size={20}
                  onPress={() => removeFriend(record, user)}
                />
              }
            />
          ))}
        </Card>
      )}

      {suggestions.length > 0 && (
        <>
          <SectionHeader title="You played with" />
          <Card style={{ paddingVertical: spacing.sm }}>
            {suggestions.map((p) => (
              <Row
                key={p.key}
                left={<Avatar name={p.name} id={p.key} />}
                title={p.name}
                subtitle={`${p.count} ${p.count === 1 ? 'game' : 'games'} together`}
                onPress={() => router.push(`/user/${p.userId}`)}
                right={<Button title="Add" size="sm" variant="soft" onPress={() => addFriend({ id: p.userId! })} />}
              />
            ))}
          </Card>
        </>
      )}
      <View style={{ height: spacing.lg }} />
    </Screen>
  );
}
