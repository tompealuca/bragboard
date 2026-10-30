import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useGridItemWidth } from '@/components/lists';
import { GameForm } from '@/components/GameForm';
import { Card, Chip, GameIcon, Input, Ionicons, Screen, Text } from '@/components/ui';
import type { GameInput } from '@/lib/api';
import { errorMessage } from '@/lib/pb';
import { useGames, useSaveGame } from '@/lib/queries';
import { modeLabel, TEMPLATE_TAGS, TEMPLATES, type GameTemplate } from '@/lib/templates';
import { radius, spacing, useTheme } from '@/lib/theme';

const CUSTOM: GameInput = { name: '', emoji: '🎲', color: '#8B5CF6', config: { mode: 'points' } };

export default function NewGame() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const [draft, setDraft] = useState<GameInput | null>(null);
  const save = useSaveGame();

  if (draft) {
    return (
      <GameForm
        initial={draft}
        saving={save.isPending}
        error={save.error ? errorMessage(save.error) : null}
        onSave={(input) =>
          save.mutate(
            { input },
            {
              onSuccess: (game) => {
                if (then === 'play') router.replace(`/play/${game.id}`);
                else router.replace(`/game/${game.id}`);
              },
            },
          )
        }
      />
    );
  }
  return <TemplatePicker onPick={setDraft} />;
}

function TemplatePicker({ onPick }: { onPick: (input: GameInput) => void }) {
  const { colors } = useTheme();
  const { data: games } = useGames();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const width = useGridItemWidth(140);

  const owned = useMemo(() => new Set((games ?? []).map((g) => g.name.toLowerCase())), [games]);
  const q = query.trim().toLowerCase();
  const templates = TEMPLATES.filter((t) => (!tag || t.tag === tag) && (!q || t.name.toLowerCase().includes(q)));

  const fromTemplate = (t: GameTemplate) =>
    onPick({ name: t.name, emoji: t.emoji, color: t.color, config: structuredCloneSafe(t.config) });

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card
        onPress={() => onPick({ ...CUSTOM, name: query.trim() })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderColor: colors.primary }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{q ? `Create "${query.trim()}"` : 'Create your own game'}</Text>
          <Text variant="small" tone="muted">
            Any game, any scoring rules
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Card>

      <Input icon="search" placeholder="Search templates" value={query} onChangeText={setQuery} autoCorrect={false} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label="All" selected={!tag} onPress={() => setTag(null)} />
        {TEMPLATE_TAGS.map((t) => (
          <Chip key={t} label={t} selected={tag === t} onPress={() => setTag(tag === t ? null : t)} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {templates.map((t) => {
          const has = owned.has(t.name.toLowerCase());
          return (
            <Pressable
              key={t.name}
              onPress={() => fromTemplate(t)}
              style={({ pressed }) => ({
                width,
                padding: spacing.md,
                gap: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <GameIcon emoji={t.emoji} color={t.color} size={40} />
                {has && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
              </View>
              <View>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {t.name}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {modeLabel(t.config)}
                  {t.config.teams === 'always' ? ' · Teams' : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {templates.length === 0 && (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          No template matches. Create it as your own game above.
        </Text>
      )}
    </Screen>
  );
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
