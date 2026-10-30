import { router, useLocalSearchParams } from 'expo-router';

import { GameForm } from '@/components/GameForm';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { useMe } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { errorMessage } from '@/lib/pb';
import { useDeleteGame, useGameSessions, useGamesById, useSaveGame } from '@/lib/queries';

export default function EditGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const game = useGamesById().get(id);
  const sessions = useGameSessions(id);
  const save = useSaveGame();
  const remove = useDeleteGame();

  if (!game) return <Loading />;
  if (game.owner !== me.id)
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState emoji="🔒" title="Only the creator can edit this game" />
      </Screen>
    );

  const onDelete = async () => {
    const others = sessions.filter((s) => s.created_by !== me.id).length;
    if (others > 0) {
      notify('Game is in use', `Friends logged ${others} session(s) of ${game.name}, so it can't be deleted.`);
      return;
    }
    const ok = await confirm(
      `Delete ${game.name}?`,
      sessions.length ? `This also deletes its ${sessions.length} session(s) and their stats.` : '',
      { confirmLabel: 'Delete', destructive: true },
    );
    if (!ok) return;
    remove.mutate(game.id, {
      onSuccess: () => router.dismissTo('/'),
      onError: (e) => notify("Couldn't delete", errorMessage(e)),
    });
  };

  return (
    <GameForm
      isEdit
      initial={{ name: game.name, emoji: game.emoji, color: game.color, config: game.config }}
      saving={save.isPending}
      error={save.error ? errorMessage(save.error) : null}
      onSave={(input) => save.mutate({ id: game.id, input }, { onSuccess: () => router.back() })}
      onDelete={onDelete}
    />
  );
}
