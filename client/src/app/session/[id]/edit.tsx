import { router, useLocalSearchParams } from 'expo-router';

import { SessionEditor } from '@/components/SessionEditor';
import { ErrorBox, Loading, Screen } from '@/components/ui';
import { useGamesById, useSession } from '@/lib/queries';

export default function EditSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session, error, refetch } = useSession(id);
  const game = useGamesById().get(session?.game ?? '');

  if (error && !session)
    return (
      <Screen edges={['left', 'right']}>
        <ErrorBox error={error} onRetry={() => refetch()} />
      </Screen>
    );
  if (!session || !game) return <Loading />;

  return (
    <SessionEditor
      game={game}
      sessionId={session.id}
      initial={{
        data: session.data,
        playedAt: new Date(session.played_at),
        notes: session.notes ?? '',
        durationMin: session.duration_min,
        startedAt: session.created,
      }}
      onSaved={() => router.back()}
    />
  );
}
