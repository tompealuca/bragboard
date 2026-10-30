import { router } from 'expo-router';
import { View } from 'react-native';

import { ProfileView } from '@/components/ProfileView';
import { IconButton, Screen } from '@/components/ui';
import { useMe } from '@/lib/auth';
import { useSessions } from '@/lib/queries';

export default function Profile() {
  const me = useMe();
  const sessions = useSessions();
  return (
    <Screen refreshing={sessions.isRefetching} onRefresh={() => sessions.refetch()}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -48, zIndex: 1 }}>
        <IconButton icon="settings-outline" label="Settings" soft onPress={() => router.push('/settings')} />
      </View>
      <ProfileView user={me} />
    </Screen>
  );
}
