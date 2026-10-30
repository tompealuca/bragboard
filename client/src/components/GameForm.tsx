import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  Footer,
  GameIcon,
  IconButton,
  Input,
  Ionicons,
  NumberField,
  Screen,
  Segmented,
  Text,
  ToggleRow,
} from '@/components/ui';
import type { GameInput } from '@/lib/api';
import { GAME_COLORS } from '@/lib/palette';
import { DEFAULT_BIDDING } from '@/lib/scoring';
import { defaultConfig, EMOJI_CHOICES, MODE_INFO, MODE_ORDER } from '@/lib/templates';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { GameConfig, ScoringMode, TeamsSetting } from '@/lib/types';

export function GameForm({
  initial,
  saving,
  error,
  onSave,
  onDelete,
  isEdit,
}: {
  initial: GameInput;
  saving: boolean;
  error?: string | null;
  onSave: (input: GameInput) => void;
  onDelete?: () => void;
  isEdit?: boolean;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState(initial.color);
  const [config, setConfig] = useState<GameConfig>(initial.config);
  const [localError, setLocalError] = useState<string | null>(null);

  const patch = (p: Partial<GameConfig>) => setConfig((c) => ({ ...c, ...p }));
  const setMode = (mode: ScoringMode) =>
    setConfig((c) => ({
      ...defaultConfig(mode),
      teams: mode === 'coop' ? undefined : c.teams,
      trackDuration: c.trackDuration,
      categories: mode === 'categories' ? (c.categories?.length ? c.categories : defaultConfig(mode).categories) : undefined,
    }));

  const save = () => {
    if (!name.trim()) return setLocalError('Give the game a name.');
    const clean: GameConfig = { ...config };
    if (clean.mode === 'categories') {
      clean.categories = (clean.categories ?? []).map((c) => c.trim()).filter(Boolean);
      if (clean.categories.length === 0) return setLocalError('Add at least one category.');
      if (new Set(clean.categories).size !== clean.categories.length) return setLocalError('Categories need different names.');
    }
    setLocalError(null);
    onSave({ name: name.trim(), emoji: emoji || '🎲', color, config: clean });
  };

  const scoreBased = config.mode === 'points' || config.mode === 'rounds' || config.mode === 'categories';

  return (
    <Screen
      edges={['left', 'right']}
      footer={
        <Footer>
          {(localError || error) && (
            <Text variant="small" tone="danger" style={{ textAlign: 'center' }}>
              {localError || error}
            </Text>
          )}
          <Button title={isEdit ? 'Save changes' : 'Save game'} size="lg" onPress={save} loading={saving} />
        </Footer>
      }>
      {/* identity */}
      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
          <GameIcon emoji={emoji} color={color} size={56} />
          <View style={{ flex: 1 }}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Catan" maxLength={60} />
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="smallStrong" tone="muted">
            Icon
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <TextInput
              value={EMOJI_CHOICES.includes(emoji) ? '' : emoji}
              onChangeText={(t) => setEmoji([...t].slice(-2).join(''))}
              placeholder="✏️"
              accessibilityLabel="Custom emoji"
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: colors.cardAlt,
                textAlign: 'center',
                fontSize: 22,
                color: colors.text,
              }}
            />
            {EMOJI_CHOICES.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityLabel={`Icon ${e}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: emoji === e ? colors.primarySoft : colors.cardAlt,
                  borderWidth: 2,
                  borderColor: emoji === e ? colors.primary : 'transparent',
                }}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="smallStrong" tone="muted">
            Color
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {GAME_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityLabel={`Color ${c}`}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: c,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {color === c && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {/* scoring mode */}
      <Text variant="h2">How is it scored?</Text>
      {isEdit && (
        <Text variant="small" tone="muted" style={{ marginTop: -spacing.sm }}>
          Changes apply to new sessions. Saved sessions keep their results.
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MODE_ORDER.map((mode) => {
          const info = MODE_INFO[mode];
          const active = config.mode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setMode(mode)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={{
                flexGrow: 1,
                flexBasis: '45%',
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: active ? colors.primarySoft : colors.card,
                borderWidth: 2,
                borderColor: active ? colors.primary : colors.border,
                gap: 4,
              }}>
              <Ionicons name={info.icon as any} size={22} color={active ? colors.primary : colors.textMuted} />
              <Text variant="bodyStrong">{info.title}</Text>
              <Text variant="small" tone="muted">
                {info.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* options */}
      <Text variant="h2">Options</Text>
      <Card style={{ gap: spacing.md }}>
        {scoreBased && (
          <ToggleRow
            title="Lowest score wins"
            subtitle="Like golf or Hearts"
            value={!!config.lowestWins}
            onChange={(v) => patch({ lowestWins: v })}
          />
        )}

        {config.mode === 'rounds' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Play to a score</Text>
                <Text variant="small" tone="muted">
                  We'll tell you when someone reaches it
                </Text>
              </View>
              <NumberField
                value={config.targetScore ?? null}
                onChange={(v) => patch({ targetScore: v && v > 0 ? v : null })}
                placeholder="–"
                width={80}
                steppers={false}
              />
            </View>
            <ToggleRow
              title="Bids & tricks"
              subtitle="Whist style: bid each round, score when you hit it"
              value={!!config.bidding}
              onChange={(v) => patch({ bidding: v ? DEFAULT_BIDDING : null })}
            />
            {config.bidding && (
              <View style={{ gap: spacing.sm, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.primarySoft }}>
                <BidRule
                  label="Points for an exact bid"
                  value={config.bidding.exact}
                  onChange={(exact) => patch({ bidding: { ...config.bidding!, exact } })}
                />
                <BidRule
                  label="Plus points per trick bid"
                  value={config.bidding.perTrick}
                  onChange={(perTrick) => patch({ bidding: { ...config.bidding!, perTrick } })}
                />
                <BidRule
                  label="Minus points per trick off"
                  value={config.bidding.missPerTrick}
                  onChange={(missPerTrick) => patch({ bidding: { ...config.bidding!, missPerTrick } })}
                />
                <Text variant="small" tone="muted">
                  Example: bid 2 and take 2 = {config.bidding.exact + 2 * config.bidding.perTrick} points. Bid 2 and take 0 ={' '}
                  {-2 * config.bidding.missPerTrick}.
                </Text>
              </View>
            )}
          </>
        )}

        {config.mode === 'categories' && (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Score sheet categories</Text>
            {(config.categories ?? []).map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={c}
                    placeholder={`Category ${i + 1}`}
                    onChangeText={(t) => {
                      const next = [...(config.categories ?? [])];
                      next[i] = t;
                      patch({ categories: next });
                    }}
                  />
                </View>
                <IconButton
                  icon="trash-outline"
                  label="Remove category"
                  color={colors.danger}
                  onPress={() => patch({ categories: (config.categories ?? []).filter((_, j) => j !== i) })}
                />
              </View>
            ))}
            <Button
              title="Add category"
              icon="add"
              variant="soft"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => patch({ categories: [...(config.categories ?? []), ''] })}
            />
          </View>
        )}

        {config.mode === 'winner' && (
          <ToggleRow
            title="Draws are possible"
            subtitle="Like chess"
            value={!!config.allowDraw}
            onChange={(v) => patch({ allowDraw: v })}
          />
        )}

        {config.mode === 'coop' && (
          <ToggleRow
            title="Also keep a score"
            subtitle="Record how well the group did"
            value={!!config.coopScore}
            onChange={(v) => patch({ coopScore: v })}
          />
        )}

        {config.mode !== 'coop' && (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Teams</Text>
            <Segmented<TeamsSetting>
              value={config.teams ?? 'off'}
              onChange={(teams) => patch({ teams })}
              options={[
                { value: 'off', label: 'No teams' },
                { value: 'optional', label: 'Sometimes' },
                { value: 'always', label: 'Always' },
              ]}
            />
          </View>
        )}

        <ToggleRow
          title="Track play time"
          subtitle="Remember how long each session took"
          value={!!config.trackDuration}
          onChange={(v) => patch({ trackDuration: v })}
        />
      </Card>

      {onDelete && <Button title="Delete game" variant="danger" icon="trash-outline" onPress={onDelete} />}
    </Screen>
  );
}

function BidRule({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <NumberField value={value} onChange={(v) => onChange(v ?? 0)} min={0} width={56} />
    </View>
  );
}
