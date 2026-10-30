import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { userParticipant } from '@/components/PlayerPicker';
import { SessionEditor, type EditorInitial } from '@/components/SessionEditor';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { useMe } from '@/lib/auth';
import { clearDraft, loadDraft, useInvalidateDrafts } from '@/lib/drafts';
import { useGames, useGameSessions, useGamesById, useSessions } from '@/lib/queries';
import { defaultTeamName, emptySessionData } from '@/lib/scoring';
import type { Game, Participant, Session, User } from '@/lib/types';

/** A new session starts with the players (and teams) of the last one, so "play again" is one tap. */
function freshSession(game: Game, me: User, source?: Session): EditorInitial {
  const participants: Participant[] = source
    ? source.results.map((r) => ({ key: r.key, userId: r.userId, name: r.name, team: r.team }))
    : [userParticipant(me)];
  const data = emptySessionData(game.config, participants);

  const hadTeams = participants.some((p) => p.team !== undefined && p.team !== null);
  if (hadTeams && game.config.teams && game.config.teams !== 'off') {
    const maxTeam = Math.max(1, ...participants.map((p) => p.team ?? 0));
    data.useTeams = true;
    data.participants = participants;
    data.teams = Array.from({ length: maxTeam + 1 }, (_, i) => source?.data?.teams?.[i] || defaultTeamName(i));
  }
  return { data, playedAt: new Date(), notes: '', durationMin: null, startedAt: new Date().toISOString() };
}

export default function Play() {
  const { gameId, from } = useLocalSearchParams<{ gameId: string; from?: string }>();
  const me = useMe();
  const gamesQuery = useGames();
  const game = useGamesById().get(gameId);
  const sessions = useGameSessions(gameId);
  const sessionsLoading = useSessions().isLoading;
  const invalidateDrafts = useInvalidateDrafts();
  const [initial, setInitial] = useState<EditorInitial | null>(null);
  const [resumed, setResumed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // wait for past sessions, so the last players can be pre-filled
    if (!game || initial || sessionsLoading) return;
    let cancelled = false;
    (async () => {
      const draft = from ? null : await loadDraft(me.id, game.id);
      if (cancelled) return;
      if (draft) {
        setInitial({
          data: draft.data,
          playedAt: new Date(draft.playedAt),
          notes: draft.notes,
          durationMin: null,
          startedAt: draft.startedAt,
        });
        setResumed(true);
      } else {
        const source = from ? sessions.find((s) => s.id === from) : sessions[0];
        setInitial(freshSession(game, me, source));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, sessionsLoading]);

  if (!game) {
    if (gamesQuery.isLoading) return <Loading />;
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState emoji="🤷" title="Game not found" action="Back to games" onAction={() => router.replace('/')} />
      </Screen>
    );
  }
  if (!initial) return <Loading />;

  return (
    <SessionEditor
      key={version}
      game={game}
      initial={initial}
      resumed={resumed}
      onStartOver={async () => {
        await clearDraft(me.id, game.id);
        invalidateDrafts();
        setResumed(false);
        setInitial(freshSession(game, me, sessions[0]));
        setVersion((v) => v + 1);
      }}
      onSaved={(session) => router.replace(`/session/${session.id}?fresh=1`)}
    />
  );
}
