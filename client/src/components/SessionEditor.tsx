import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { PlayerPicker } from '@/components/PlayerPicker';
import { ScoreInput, TeamsEditor } from '@/components/score';
import {
  Button,
  Card,
  Chip,
  Footer,
  GameIcon,
  IconButton,
  Input,
  NumberField,
  Screen,
  SectionHeader,
  Text,
  ToggleRow,
} from '@/components/ui';
import { useMe } from '@/lib/auth';
import { clearDraft, saveDraft, useInvalidateDrafts } from '@/lib/drafts';
import { formatDay, formatTime } from '@/lib/format';
import { errorMessage } from '@/lib/pb';
import { useSaveSession } from '@/lib/queries';
import { defaultTeams, usesTeams, validateSession } from '@/lib/scoring';
import { modeLabel } from '@/lib/templates';
import { spacing } from '@/lib/theme';
import type { Game, Participant, Session, SessionData } from '@/lib/types';

export interface EditorInitial {
  data: SessionData;
  playedAt: Date;
  notes: string;
  durationMin: number | null;
  startedAt: string;
}

function hasScoreInput(d: SessionData) {
  const filled = (o?: Record<string, unknown>) => Object.values(o ?? {}).some((v) => v !== null && v !== undefined);
  return (
    filled(d.scores) ||
    (d.rounds?.length ?? 0) > 0 ||
    (d.bids?.length ?? 0) > 0 ||
    Object.values(d.categories ?? {}).some((c) => filled(c)) ||
    filled(d.ranks) ||
    (d.winners?.length ?? 0) > 0 ||
    !!d.draw ||
    (d.coopWon !== null && d.coopWon !== undefined)
  );
}

export function SessionEditor({
  game,
  initial,
  sessionId,
  resumed,
  onSaved,
  onStartOver,
}: {
  game: Game;
  initial: EditorInitial;
  /** set when editing an existing session (no drafts then) */
  sessionId?: string;
  resumed?: boolean;
  onSaved: (session: Session) => void;
  onStartOver?: () => void;
}) {
  const me = useMe();
  const config = game.config;
  const [data, setData] = useState<SessionData>(initial.data);
  const [playedAt, setPlayedAt] = useState(initial.playedAt);
  const [notes, setNotes] = useState(initial.notes);
  const [durationMin, setDurationMin] = useState<number | null>(initial.durationMin);
  const [pickerOpen, setPickerOpen] = useState(false);
  const save = useSaveSession();
  const invalidateDrafts = useInvalidateDrafts();
  const isNew = !sessionId;

  // Keep an unfinished new session on the device while playing.
  const savedOnce = useRef(false);
  useEffect(() => {
    if (!isNew || !me.id) return;
    const t = setTimeout(() => {
      if (savedOnce.current) return;
      if (hasScoreInput(data)) {
        saveDraft(me.id, {
          gameId: game.id,
          data,
          startedAt: initial.startedAt,
          playedAt: playedAt.toISOString(),
          notes,
          updatedAt: new Date().toISOString(),
        }).then(invalidateDrafts);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, playedAt, notes]);

  const teams = usesTeams(config, data);
  const problem = validateSession(config, data);
  const autoMinutes = Math.max(1, Math.round((Date.now() - new Date(initial.startedAt).getTime()) / 60000));

  const setParticipants = (participants: Participant[]) => {
    setData((d) => {
      if (!usesTeams(config, d)) return { ...d, participants: participants.map(({ team, ...p }) => p) };
      const names = d.teams?.length ? d.teams : defaultTeams(config);
      // newcomers join the smallest team
      const next = participants.map((p) => {
        const existing = d.participants.find((x) => x.key === p.key);
        return existing ? { ...p, team: existing.team } : { ...p, team: undefined };
      });
      for (const p of next) {
        if (p.team !== undefined) continue;
        const sizes = names.map((_, i) => next.filter((x) => x.team === i).length);
        p.team = sizes.indexOf(Math.min(...sizes));
      }
      return { ...d, teams: names, participants: next };
    });
  };

  const setUseTeams = (on: boolean) =>
    setData((d) => ({
      ...d,
      useTeams: on,
      teams: on ? (d.teams?.length ? d.teams : defaultTeams(config)) : d.teams,
      participants: d.participants.map((p, i) => (on ? { ...p, team: p.team ?? i % 2 } : p)),
    }));

  const submit = () => {
    if (problem) return;
    const minutes = durationMin ?? (isNew && config.trackDuration ? autoMinutes : null);
    savedOnce.current = true;
    save.mutate(
      { id: sessionId, game, data, playedAt, durationMin: minutes, notes },
      {
        onSuccess: async (session) => {
          if (isNew) {
            await clearDraft(me.id, game.id);
            invalidateDrafts();
          }
          onSaved(session);
        },
        onError: () => {
          savedOnce.current = false;
        },
      },
    );
  };

  const shiftDay = (days: number) => setPlayedAt((d) => new Date(d.getTime() + days * 86400000));

  return (
    <Screen
      edges={['left', 'right']}
      footer={
        <Footer>
          {(problem || save.error) && (
            <Text variant="small" tone={save.error ? 'danger' : 'muted'} style={{ textAlign: 'center' }}>
              {save.error ? errorMessage(save.error) : problem}
            </Text>
          )}
          <Button
            title={isNew ? 'Save session' : 'Save changes'}
            icon="checkmark"
            size="lg"
            onPress={submit}
            disabled={!!problem}
            loading={save.isPending}
          />
        </Footer>
      }>
      <Stack.Screen options={{ title: isNew ? game.name : `Edit · ${game.name}` }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <GameIcon emoji={game.emoji} color={game.color} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="h1" numberOfLines={1}>
            {game.name}
          </Text>
          <Text variant="small" tone="muted">
            {modeLabel(config, true)}
          </Text>
        </View>
      </View>

      {resumed && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            Picked up your unfinished session from {formatTime(initial.startedAt)}.
          </Text>
          {onStartOver && <Button title="Start over" variant="ghost" size="sm" onPress={onStartOver} />}
        </Card>
      )}

      <Card style={{ gap: spacing.md }}>
        <SectionHeader title="Players" action="Edit" onAction={() => setPickerOpen(true)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {data.participants.map((p) => (
            <Chip
              key={p.key}
              label={p.name}
              avatarId={p.key}
              onPress={() => setPickerOpen(true)}
              onRemove={() => setParticipants(data.participants.filter((x) => x.key !== p.key))}
            />
          ))}
          <Chip label="Add" icon="add" onPress={() => setPickerOpen(true)} />
        </View>
        {config.teams === 'optional' && (
          <ToggleRow title="Play in teams" value={!!data.useTeams} onChange={setUseTeams} />
        )}
        {teams && <TeamsEditor data={data} onChange={setData} />}
      </Card>

      <Text variant="h2">Score</Text>
      <ScoreInput game={game} data={data} onChange={setData} />

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Played
          </Text>
          <IconButton icon="chevron-back" label="Previous day" soft size={18} onPress={() => shiftDay(-1)} />
          <Text variant="bodyStrong" style={{ minWidth: 110, textAlign: 'center' }}>
            {formatDay(playedAt)}
          </Text>
          <IconButton icon="chevron-forward" label="Next day" soft size={18} onPress={() => shiftDay(1)} />
        </View>
        {(config.trackDuration || !isNew) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Play time (min)</Text>
              {isNew && durationMin === null && (
                <Text variant="small" tone="muted">
                  Auto: {autoMinutes} min so far
                </Text>
              )}
            </View>
            <NumberField
              value={durationMin}
              onChange={(v) => setDurationMin(v === null ? null : Math.max(0, Math.round(v)))}
              placeholder={isNew ? 'auto' : '–'}
              step={5}
              min={0}
            />
          </View>
        )}
        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="House rules, funny moments, expansions…"
          multiline
          maxLength={2000}
        />
      </Card>

      <PlayerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={data.participants}
        onChange={setParticipants}
      />
    </Screen>
  );
}
