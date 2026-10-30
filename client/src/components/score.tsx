// Score entry for every scoring mode. Each input edits the session's raw `data`;
// totals, ranks and winners are always derived through the scoring engine.

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  haptic,
  HScroll,
  Ionicons,
  NumberField,
  RankBadge,
  Sheet,
  Text,
} from '@/components/ui';
import { ordinal } from '@/lib/format';
import { colorForKey } from '@/lib/palette';
import {
  bidPoints,
  defaultTeamName,
  entityKeys,
  entityName,
  entityRanks,
  entityTotals,
  roundScores,
  targetReached,
  usesTeams,
} from '@/lib/scoring';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { BidEntry, Game, GameConfig, SessionData } from '@/lib/types';

interface InputProps {
  game: Game;
  data: SessionData;
  onChange: (data: SessionData) => void;
}

interface Entity {
  key: string;
  name: string;
  members?: string;
}

function useEntities(config: GameConfig, data: SessionData): Entity[] {
  const teams = usesTeams(config, data);
  return entityKeys(config, data).map((key) => ({
    key,
    name: entityName(config, data, key),
    members: teams
      ? data.participants
          .filter((p) => `t:${p.team ?? 0}` === key)
          .map((p) => p.name)
          .join(', ')
      : undefined,
  }));
}

function EntityLabel({ entity, size = 36 }: { entity: Entity; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 0 }}>
      <Avatar name={entity.name} id={entity.key} size={size} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {entity.name}
        </Text>
        {entity.members ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {entity.members}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ScoreInput(props: InputProps) {
  const entities = useEntities(props.game.config, props.data);
  if (entities.length === 0)
    return (
      <Card>
        <Text tone="muted">Add players to start scoring.</Text>
      </Card>
    );
  switch (props.game.config.mode) {
    case 'points':
      return <PointsInput {...props} entities={entities} />;
    case 'rounds':
      return <RoundsInput {...props} entities={entities} />;
    case 'categories':
      return <CategoriesInput {...props} entities={entities} />;
    case 'ranking':
      return <RankingInput {...props} entities={entities} />;
    case 'winner':
      return <WinnerInput {...props} entities={entities} />;
    case 'coop':
      return <CoopInput {...props} />;
  }
}

// ---------------------------------------------------------------- points

function PointsInput({ game, data, onChange, entities }: InputProps & { entities: Entity[] }) {
  const ranks = entityRanks(game.config, data);
  const anyScore = entities.some((e) => typeof data.scores?.[e.key] === 'number');
  return (
    <Card style={{ gap: spacing.sm }}>
      {entities.map((e) => (
        <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {anyScore && <RankBadge rank={ranks[e.key]} size={28} />}
          <EntityLabel entity={e} />
          <NumberField
            value={data.scores?.[e.key] ?? null}
            onChange={(v) => onChange({ ...data, scores: { ...data.scores, [e.key]: v } })}
            width={72}
          />
        </View>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------- rounds

function RoundsInput({ game, data, onChange, entities }: InputProps & { entities: Entity[] }) {
  const { colors } = useTheme();
  const config = game.config;
  const totals = entityTotals(config, data);
  const ranks = entityRanks(config, data);
  const scores = roundScores(config, data);
  const reached = targetReached(config, data);
  const [editing, setEditing] = useState<number | null | undefined>(undefined); // undefined = closed, null = new
  const roundCount = config.bidding ? (data.bids ?? []).length : (data.rounds ?? []).length;

  return (
    <View style={{ gap: spacing.md }}>
      {/* totals */}
      <Card style={{ gap: spacing.sm }}>
        {entities.map((e) => {
          const total = totals[e.key];
          const progress = config.targetScore ? Math.max(0, Math.min(1, (total ?? 0) / config.targetScore)) : null;
          return (
            <View key={e.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {roundCount > 0 && <RankBadge rank={ranks[e.key]} size={28} />}
                <EntityLabel entity={e} />
                <Text variant="big">{total ?? 0}</Text>
              </View>
              {progress !== null && (
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                  <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: colorForKey(e.key) }} />
                </View>
              )}
            </View>
          );
        })}
        {config.targetScore ? (
          <Text variant="small" tone="muted">
            Playing to {config.targetScore}
            {config.lowestWins ? ' · lowest total wins' : ''}
          </Text>
        ) : null}
      </Card>

      {reached.length > 0 && (
        <View style={{ backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: spacing.md }}>
          <Text variant="bodyStrong" style={{ color: colors.gold }}>
            🏁 {reached.map((k) => entityName(config, data, k)).join(' & ')} reached {config.targetScore}. Save to finish!
          </Text>
        </View>
      )}

      {/* rounds table */}
      {roundCount > 0 && (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <HScroll>
              <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, paddingVertical: spacing.sm }}>
                <Cell width={52}>
                  <Text variant="caption" tone="faint">
                    #
                  </Text>
                </Cell>
                {entities.map((e) => (
                  <Cell key={e.key} flex>
                    <Text variant="smallStrong" numberOfLines={1}>
                      {e.name}
                    </Text>
                  </Cell>
                ))}
              </View>
              {scores.map((round, i) => (
                <Pressable
                  key={i}
                  onPress={() => setEditing(i)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    paddingVertical: spacing.sm + 2,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: colors.border,
                    backgroundColor: pressed ? colors.cardAlt : 'transparent',
                  })}>
                  <Cell width={52}>
                    <Text variant="smallStrong" tone="faint">
                      {i + 1}
                    </Text>
                  </Cell>
                  {entities.map((e) => {
                    const v = round[e.key];
                    const bid = config.bidding ? data.bids?.[i]?.[e.key] : undefined;
                    return (
                      <Cell key={e.key} flex>
                        {config.bidding ? (
                          <BidCell entry={bid} points={v ?? null} />
                        ) : (
                          <Text variant="bodyStrong" tone={v === null || v === undefined ? 'faint' : v < 0 ? 'danger' : 'default'}>
                            {v ?? '–'}
                          </Text>
                        )}
                      </Cell>
                    );
                  })}
                </Pressable>
              ))}
            </HScroll>
        </Card>
      )}

      <Button
        title={roundCount === 0 ? 'Add first round' : `Add round ${roundCount + 1}`}
        icon="add"
        variant="soft"
        size="lg"
        onPress={() => setEditing(null)}
      />
      {roundCount > 0 && (
        <Text variant="small" tone="faint" style={{ textAlign: 'center', marginTop: -spacing.sm }}>
          Tap a round to change it
        </Text>
      )}

      {editing !== undefined && (
        <RoundSheet
          game={game}
          data={data}
          entities={entities}
          index={editing}
          onClose={() => setEditing(undefined)}
          onChange={onChange}
        />
      )}
    </View>
  );
}

function Cell({ children, width, flex }: { children: React.ReactNode; width?: number; flex?: boolean }) {
  return (
    <View
      style={{
        width: flex ? undefined : width,
        flex: flex ? 1 : undefined,
        minWidth: flex ? 72 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}>
      {children}
    </View>
  );
}

function BidCell({ entry, points }: { entry?: BidEntry; points: number | null }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="bodyStrong" tone={points === null ? 'faint' : points < 0 ? 'danger' : 'success'}>
        {points === null ? '…' : points > 0 ? `+${points}` : points}
      </Text>
      <Text variant="small" tone="faint" style={{ fontSize: 11 }}>
        {entry?.bid ?? '–'} / {entry?.took ?? '–'}
      </Text>
    </View>
  );
}

function RoundSheet({
  game,
  data,
  entities,
  index,
  onClose,
  onChange,
}: {
  game: Game;
  data: SessionData;
  entities: Entity[];
  index: number | null;
  onClose: () => void;
  onChange: (d: SessionData) => void;
}) {
  const config = game.config;
  const bidding = config.bidding;
  const roundNumber = index === null ? (bidding ? data.bids ?? [] : data.rounds ?? []).length + 1 : index + 1;
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    index === null ? {} : { ...(data.rounds?.[index] ?? {}) },
  );
  const [bids, setBids] = useState<Record<string, BidEntry>>(() =>
    index === null ? {} : JSON.parse(JSON.stringify(data.bids?.[index] ?? {})),
  );

  const save = () => {
    if (bidding) {
      const round: Record<string, BidEntry> = {};
      for (const e of entities) round[e.key] = { bid: bids[e.key]?.bid ?? null, took: bids[e.key]?.took ?? null };
      const list = [...(data.bids ?? [])];
      if (index === null) list.push(round);
      else list[index] = round;
      onChange({ ...data, bids: list });
    } else {
      const round: Record<string, number | null> = {};
      for (const e of entities) round[e.key] = values[e.key] ?? null;
      const list = [...(data.rounds ?? [])];
      if (index === null) list.push(round);
      else list[index] = round;
      onChange({ ...data, rounds: list });
    }
    onClose();
  };

  const remove = () => {
    if (index === null) return onClose();
    if (bidding) onChange({ ...data, bids: (data.bids ?? []).filter((_, i) => i !== index) });
    else onChange({ ...data, rounds: (data.rounds ?? []).filter((_, i) => i !== index) });
    onClose();
  };

  const totalBid = entities.reduce((s, e) => s + (bids[e.key]?.bid ?? 0), 0);
  const totalTook = entities.reduce((s, e) => s + (bids[e.key]?.took ?? 0), 0);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Round ${roundNumber}`}
      footer={
        <>
          <Button title="Save round" size="lg" onPress={save} />
          {index !== null && <Button title="Delete round" variant="ghost" onPress={remove} />}
        </>
      }>
      {bidding ? (
        <>
          <Text variant="small" tone="muted">
            Enter bids at the start of the round, tricks at the end. You can save now and fill in tricks later.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, paddingRight: 40 }}>
            <Text variant="caption" tone="faint" style={{ width: 118, textAlign: 'center' }}>
              Bid
            </Text>
            <Text variant="caption" tone="faint" style={{ width: 118, textAlign: 'center' }}>
              Took
            </Text>
          </View>
          {entities.map((e) => {
            const entry = bids[e.key] ?? { bid: null, took: null };
            const points = bidPoints(entry, bidding);
            const set = (patch: Partial<BidEntry>) => setBids((b) => ({ ...b, [e.key]: { ...entry, ...patch } }));
            return (
              <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {e.name}
                  </Text>
                </View>
                <NumberField value={entry.bid} onChange={(bid) => set({ bid })} min={0} width={38} placeholder="–" />
                <NumberField value={entry.took} onChange={(took) => set({ took })} min={0} width={38} placeholder="–" />
                <Text
                  variant="bodyStrong"
                  tone={points === null ? 'faint' : points < 0 ? 'danger' : 'success'}
                  style={{ width: 36, textAlign: 'right' }}>
                  {points === null ? '' : points > 0 ? `+${points}` : points}
                </Text>
              </View>
            );
          })}
          <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
            Bids total {totalBid} · tricks taken {totalTook}
          </Text>
        </>
      ) : (
        entities.map((e, i) => (
          <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <EntityLabel entity={e} />
            <NumberField
              value={values[e.key] ?? null}
              onChange={(v) => setValues((s) => ({ ...s, [e.key]: v }))}
              width={84}
              autoFocus={i === 0 && index === null}
            />
          </View>
        ))
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------ categories

function CategoriesInput({ game, data, onChange, entities }: InputProps & { entities: Entity[] }) {
  const { colors } = useTheme();
  const categories = game.config.categories ?? [];
  const totals = entityTotals(game.config, data);
  const ranks = entityRanks(game.config, data);
  const anyScore = entities.some((e) => totals[e.key] !== null);

  const setCell = (entity: string, category: string, v: number | null) =>
    onChange({
      ...data,
      categories: { ...data.categories, [entity]: { ...(data.categories?.[entity] ?? {}), [category]: v } },
    });

  const labelWidth = 116;
  const colWidth = 76;

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <HScroll>
          <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, paddingVertical: spacing.sm }}>
            <View style={{ width: labelWidth }} />
            {entities.map((e) => (
              <View key={e.key} style={{ width: colWidth, flexGrow: 1, alignItems: 'center', gap: 4 }}>
                <Avatar name={e.name} id={e.key} size={26} />
                <Text variant="small" numberOfLines={1} style={{ maxWidth: colWidth - 8 }}>
                  {e.name}
                </Text>
              </View>
            ))}
          </View>
          {categories.map((c, i) => (
            <View
              key={c}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
              }}>
              <Text variant="smallStrong" numberOfLines={2} style={{ width: labelWidth, paddingHorizontal: spacing.md }}>
                {c}
              </Text>
              {entities.map((e) => (
                <View key={e.key} style={{ width: colWidth, flexGrow: 1, alignItems: 'center' }}>
                  <NumberField
                    value={data.categories?.[e.key]?.[c] ?? null}
                    onChange={(v) => setCell(e.key, c, v)}
                    steppers={false}
                    width={60}
                    placeholder="–"
                  />
                </View>
              ))}
            </View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.sm,
              backgroundColor: colors.primarySoft,
            }}>
            <Text variant="bodyStrong" style={{ width: labelWidth, paddingHorizontal: spacing.md }}>
              Total
            </Text>
            {entities.map((e) => (
              <View key={e.key} style={{ width: colWidth, flexGrow: 1, alignItems: 'center' }}>
                <Text variant="number">{totals[e.key] ?? 0}</Text>
                {anyScore && <RankBadge rank={ranks[e.key]} size={22} />}
              </View>
            ))}
          </View>
        </HScroll>
    </Card>
  );
}

// --------------------------------------------------------------- ranking

function RankingInput({ data, onChange, entities }: InputProps & { entities: Entity[] }) {
  const { colors } = useTheme();
  const ranks = data.ranks ?? {};
  const next = Math.max(0, ...entities.map((e) => ranks[e.key] ?? 0)) + 1;

  const tap = (key: string) => {
    haptic();
    const current = ranks[key];
    if (current) {
      // remove and close the gap
      const updated: Record<string, number> = {};
      for (const [k, r] of Object.entries(ranks)) {
        if (k === key) continue;
        updated[k] = r > current ? r - 1 : r;
      }
      onChange({ ...data, ranks: updated });
    } else {
      onChange({ ...data, ranks: { ...ranks, [key]: next } });
    }
  };

  const sorted = [...entities].sort((a, b) => (ranks[a.key] ?? 99) - (ranks[b.key] ?? 99));

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text tone="muted" style={{ flex: 1 }}>
          Tap players in the order they finished.
        </Text>
        {Object.keys(ranks).length > 0 && (
          <Button title="Reset" variant="ghost" size="sm" onPress={() => onChange({ ...data, ranks: {} })} />
        )}
      </View>
      <Card style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
        {sorted.map((e) => {
          const rank = ranks[e.key];
          return (
            <Pressable
              key={e.key}
              onPress={() => tap(e.key)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.sm,
                opacity: pressed ? 0.7 : 1,
              })}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: rank ? (rank === 1 ? colors.goldSoft : colors.primarySoft) : 'transparent',
                  borderWidth: rank ? 0 : 2,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                }}>
                <Text variant="smallStrong" style={{ color: rank === 1 ? colors.gold : colors.primary }}>
                  {rank ? ordinal(rank) : ''}
                </Text>
              </View>
              <EntityLabel entity={e} />
              {rank === 1 && <Text style={{ fontSize: 22 }}>👑</Text>}
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- winner

function WinnerInput({ game, data, onChange, entities }: InputProps & { entities: Entity[] }) {
  const { colors } = useTheme();
  const winners = new Set(data.winners ?? []);
  const toggle = (key: string) => {
    haptic();
    const next = new Set(winners);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...data, winners: [...next], draw: false });
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <Text tone="muted">Who won?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {entities.map((e) => {
          const won = winners.has(e.key);
          return (
            <Pressable
              key={e.key}
              onPress={() => toggle(e.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: won }}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: '45%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: won ? colors.gold : colors.border,
                backgroundColor: won ? colors.goldSoft : colors.card,
                opacity: pressed ? 0.8 : 1,
              })}>
              <EntityLabel entity={e} size={32} />
              <Text style={{ fontSize: 22, opacity: won ? 1 : 0.15 }}>👑</Text>
            </Pressable>
          );
        })}
      </View>
      {game.config.allowDraw && (
        <Pressable
          onPress={() => {
            haptic();
            onChange({ ...data, draw: !data.draw, winners: [] });
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 2,
            borderColor: data.draw ? colors.primary : colors.border,
            backgroundColor: data.draw ? colors.primarySoft : colors.card,
          }}>
          <Text style={{ fontSize: 18 }}>🤝</Text>
          <Text variant="bodyStrong" tone={data.draw ? 'primary' : 'default'}>
            It's a draw
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ coop

function CoopInput({ game, data, onChange }: InputProps) {
  const { colors } = useTheme();
  const option = (won: boolean, emoji: string, label: string) => {
    const active = data.coopWon === won;
    const tint = won ? colors.success : colors.danger;
    return (
      <Pressable
        onPress={() => {
          haptic();
          onChange({ ...data, coopWon: won });
        }}
        style={{
          flex: 1,
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xl,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: active ? tint : colors.border,
          backgroundColor: active ? (won ? colors.successSoft : colors.dangerSoft) : colors.card,
        }}>
        <Text style={{ fontSize: 36 }}>{emoji}</Text>
        <Text variant="bodyStrong" style={{ color: active ? tint : colors.text }}>
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {option(true, '🎉', 'We won')}
        {option(false, '😵', 'We lost')}
      </View>
      {game.config.coopScore && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Team score
          </Text>
          <NumberField value={data.coopScore ?? null} onChange={(v) => onChange({ ...data, coopScore: v })} />
        </Card>
      )}
    </View>
  );
}

// ----------------------------------------------------------------- teams

export function TeamsEditor({ data, onChange }: { data: SessionData; onChange: (d: SessionData) => void }) {
  const { colors } = useTheme();
  const names = data.teams?.length ? data.teams : [defaultTeamName(0), defaultTeamName(1)];

  const move = (key: string) => {
    haptic();
    onChange({
      ...data,
      teams: names,
      participants: data.participants.map((p) => (p.key === key ? { ...p, team: ((p.team ?? 0) + 1) % names.length } : p)),
    });
  };
  const rename = (i: number, name: string) => {
    const next = [...names];
    next[i] = name;
    onChange({ ...data, teams: next });
  };
  const addTeam = () => onChange({ ...data, teams: [...names, defaultTeamName(names.length)] });
  const removeTeam = (i: number) => {
    if (names.length <= 2) return;
    onChange({
      ...data,
      teams: names.filter((_, j) => j !== i),
      participants: data.participants.map((p) => {
        const t = p.team ?? 0;
        return { ...p, team: t === i ? 0 : t > i ? t - 1 : t };
      }),
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {names.map((name, i) => {
        const members = data.participants.filter((p) => (p.team ?? 0) === i);
        return (
          <View
            key={i}
            style={{
              borderRadius: radius.md,
              backgroundColor: colors.cardAlt,
              padding: spacing.md,
              gap: spacing.sm,
              borderLeftWidth: 4,
              borderLeftColor: colorForKey(`t:${i}`),
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput
                value={name}
                onChangeText={(t) => rename(i, t)}
                accessibilityLabel={`Team ${i + 1} name`}
                style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, paddingVertical: 2 }}
              />
              {names.length > 2 && members.length === 0 && (
                <Pressable onPress={() => removeTeam(i)} hitSlop={8} accessibilityLabel="Remove team">
                  <Ionicons name="close-circle" size={20} color={colors.textFaint} />
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {members.length === 0 && (
                <Text variant="small" tone="faint">
                  No players yet
                </Text>
              )}
              {members.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => move(p.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingLeft: 4,
                    paddingRight: spacing.sm,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                  }}>
                  <Avatar name={p.name} id={p.key} size={24} />
                  <Text variant="smallStrong">{p.name}</Text>
                  <Ionicons name="swap-horizontal" size={14} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          Tap a player to move them to the next team.
        </Text>
        {names.length < 8 && <Button title="Add team" icon="add" variant="ghost" size="sm" onPress={addTeam} />}
      </View>
    </View>
  );
}
