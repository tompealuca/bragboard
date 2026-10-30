import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Input, Screen, Segmented, Text } from '@/components/ui';
import { deleteAccount, updateProfile } from '@/lib/api';
import { useAuth, useMe, USERNAME_RE } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { errorMessage, serverUrl } from '@/lib/pb';
import { spacing, useTheme, type ThemePreference } from '@/lib/theme';

export default function Settings() {
  const me = useMe();
  const { refresh, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== me.name || username !== me.username;

  const save = async () => {
    if (!name.trim()) return setError('Your name cannot be empty.');
    if (!USERNAME_RE.test(username)) return setError('Usernames are 3–20 characters: a–z, 0–9, _ and .');
    setBusy(true);
    setError(null);
    try {
      await updateProfile(me.id, { name, username });
      await refresh();
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    const ok = await confirm(
      'Delete your account?',
      'Your login and friend list are removed. Sessions you played stay in your friends’ history under your name.',
      { confirmLabel: 'Delete account', destructive: true },
    );
    if (!ok) return;
    try {
      await deleteAccount(me.id);
      signOut();
    } catch (e) {
      notify("Couldn't delete account", errorMessage(e));
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Card style={{ gap: spacing.md }}>
        <Text variant="h2">Profile</Text>
        <Input label="Name" value={name} onChangeText={(t) => { setName(t); setSaved(false); }} />
        <Input
          label="Username"
          icon="at"
          value={username}
          onChangeText={(t) => {
            setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
            setSaved(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
        />
        <Text variant="small" tone="muted">
          Email: {me.email || 'hidden'}
        </Text>
        <Button title={saved && !dirty ? 'Saved ✓' : 'Save profile'} onPress={save} loading={busy} disabled={!dirty} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text variant="h2">Appearance</Text>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">About</Text>
        <Text tone="muted">Bragboard {Constants.expoConfig?.version ?? ''}</Text>
        <Text tone="muted" selectable>
          Server: {serverUrl()}
        </Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button title="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
        <Button title="Delete account" variant="danger" onPress={removeAccount} />
      </View>
    </Screen>
  );
}
