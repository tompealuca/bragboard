import { Redirect, useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/ProfileView';
import { Button, ErrorBox, Loading, Screen } from '@/components/ui';
import { useMe } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { errorMessage } from '@/lib/pb';
import { useAddFriend, useFriendLists, useRemoveFriend, useUser } from '@/lib/queries';
import { spacing } from '@/lib/theme';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data: user, error, isLoading, refetch } = useUser(id);
  const { friends } = useFriendLists();
  const add = useAddFriend();
  const remove = useRemoveFriend();

  if (id === me.id) return <Redirect href="/profile" />;
  if (!user) {
    if (isLoading) return <Loading />;
    return (
      <Screen edges={['left', 'right']}>
        <ErrorBox error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const friendship = friends.find((f) => f.user.id === user.id)?.record;

  const action = friendship ? (
    <Button
      title="Friends ✓"
      variant="secondary"
      size="sm"
      style={{ marginTop: spacing.sm }}
      loading={remove.isPending}
      onPress={async () => {
        if (await confirm(`Remove @${user.username} from friends?`, ''))
          remove.mutate(friendship, { onError: (e) => notify("Couldn't remove", errorMessage(e)) });
      }}
    />
  ) : (
    <Button
      title="Add friend"
      icon="person-add"
      size="sm"
      style={{ marginTop: spacing.sm }}
      loading={add.isPending}
      onPress={() => add.mutate(user.id, { onError: (e) => notify("Couldn't add", errorMessage(e)) })}
    />
  );

  return (
    <Screen edges={['left', 'right']}>
      <ProfileView user={user} actions={action} />
    </Screen>
  );
}
