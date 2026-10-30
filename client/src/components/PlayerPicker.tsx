import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Avatar, Button, Input, Ionicons, Sheet, Text } from '@/components/ui';
import { displayName, useMe } from '@/lib/auth';
import { useFriendLists, useSessions, useUserSearch } from '@/lib/queries';
import { guestKey, userKey } from '@/lib/scoring';
import { playersIn } from '@/lib/stats';
import { spacing, useTheme } from '@/lib/theme';
import type { Participant, User } from '@/lib/types';

export function userParticipant(user: Pick<User, 'id' | 'name' | 'username'>): Participant {
  return { key: userKey(user.id), userId: user.id, name: displayName(user) };
}

interface Option {
  participant: Participant;
  subtitle?: string;
}

export function PlayerPicker({
  visible,
  onClose,
  selected,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  selected: Participant[];
  onChange: (next: Participant[]) => void;
}) {
  const me = useMe();
  const [query, setQuery] = useState('');
  const { friends } = useFriendLists();
  const { data: sessions } = useSessions();
  const search = useUserSearch(query);
  const selectedKeys = new Set(selected.map((p) => p.key));

  const toggle = (p: Participant) => {
    if (selectedKeys.has(p.key)) onChange(selected.filter((s) => s.key !== p.key));
    else onChange([...selected, p]);
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    const matches = (o: Option) =>
      !q || o.participant.name.toLowerCase().includes(q) || (o.subtitle ?? '').toLowerCase().includes(q);
    const seen = new Set<string>();
    const take = (list: Option[]) =>
      list.filter((o) => {
        if (seen.has(o.participant.key) || !matches(o)) return false;
        seen.add(o.participant.key);
        return true;
      });

    const you = take([{ participant: userParticipant(me), subtitle: `@${me.username} · you` }]);
    const friendOptions = take(
      friends.map(({ user }) => ({ participant: userParticipant(user), subtitle: `@${user.username}` })),
    );
    const recent = take(
      playersIn(sessions ?? []).map((p) => ({
        participant: { key: p.key, userId: p.userId, name: p.name },
        subtitle: p.userId ? 'account' : 'guest',
      })),
    );
    const found = take(
      (search.data ?? []).map((u) => ({ participant: userParticipant(u), subtitle: `@${u.username}` })),
    );
    return [
      { title: 'You', items: you },
      { title: 'Friends', items: friendOptions },
      { title: 'Played with', items: recent },
      { title: 'Bragboard users', items: found },
    ].filter((s) => s.items.length > 0);
  }, [query, me, friends, sessions, search.data]);

  const guestName = query.trim().replace(/^@/, '');
  const guestExists = guestName && (selectedKeys.has(guestKey(guestName)) || sections.some((s) => s.items.some((o) => o.participant.name.toLowerCase() === guestName.toLowerCase())));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Players"
      footer={<Button title={`Done · ${selected.length} ${selected.length === 1 ? 'player' : 'players'}`} onPress={onClose} />}>
      <Input
        icon="search"
        placeholder="Name or @username"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        right={search.isFetching ? <ActivityIndicator size="small" /> : undefined}
      />

      {guestName.length > 0 && !guestExists && (
        <OptionRow
          option={{ participant: { key: guestKey(guestName), name: guestName }, subtitle: 'Add as guest (no account)' }}
          selected={false}
          guest
          onPress={() => {
            toggle({ key: guestKey(guestName), name: guestName });
            setQuery('');
          }}
        />
      )}

      {sections.map((section) => (
        <View key={section.title} style={{ gap: 2 }}>
          <Text variant="caption" tone="faint" style={{ marginTop: spacing.sm }}>
            {section.title}
          </Text>
          {section.items.map((o) => (
            <OptionRow
              key={o.participant.key}
              option={o}
              selected={selectedKeys.has(o.participant.key)}
              onPress={() => toggle(o.participant)}
            />
          ))}
        </View>
      ))}

      {sections.length === 0 && !guestName && (
        <Text tone="muted">Type a name to add a guest, or an @username to find a friend.</Text>
      )}
    </Sheet>
  );
}

function OptionRow({
  option,
  selected,
  onPress,
  guest,
}: {
  option: Option;
  selected: boolean;
  onPress: () => void;
  guest?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}>
      {guest ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="person-add-outline" size={18} color={colors.primary} />
        </View>
      ) : (
        <Avatar name={option.participant.name} id={option.participant.key} />
      )}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {option.participant.name}
        </Text>
        {option.subtitle && (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {option.subtitle}
          </Text>
        )}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : guest ? 'add-circle-outline' : 'ellipse-outline'}
        size={26}
        color={selected || guest ? colors.primary : colors.textFaint}
      />
    </Pressable>
  );
}
