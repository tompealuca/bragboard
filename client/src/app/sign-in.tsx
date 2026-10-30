import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Button, Divider, Input, Screen, Sheet, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { defaultServerUrl, errorMessage, serverUrl, setServerUrl } from '@/lib/pb';
import { spacing } from '@/lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);

  const submit = async () => {
    if (!identity.trim() || !password) return setError('Enter your username or email and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(identity, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 440, paddingTop: spacing.xxl * 1.5 }}>
      <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Image source={require('@/assets/images/logo.png')} style={{ width: 84, height: 84 }} />
        <Text variant="title">Bragboard</Text>
        <Text tone="muted" style={{ textAlign: 'center' }}>
          Keep score of every game night.{'\n'}Earn the bragging rights.
        </Text>
      </View>

      <Input
        label="Username or email"
        value={identity}
        onChangeText={setIdentity}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        placeholder="luca or luca@example.com"
        returnKeyType="next"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        textContentType="password"
        placeholder="••••••••"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
        right={
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Text variant="smallStrong" tone="primary">
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        }
      />
      <Button title="Sign in" size="lg" onPress={submit} loading={busy} />
      <Link href="/forgot-password" asChild>
        <Pressable style={{ alignSelf: 'center', padding: spacing.sm }}>
          <Text variant="smallStrong" tone="primary">
            Forgot password?
          </Text>
        </Pressable>
      </Link>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Divider style={{ flex: 1 }} />
        <Text variant="small" tone="faint">
          New here?
        </Text>
        <Divider style={{ flex: 1 }} />
      </View>
      <Button title="Create an account" variant="secondary" size="lg" onPress={() => router.push('/sign-up')} />

      <Pressable onPress={() => setServerOpen(true)} style={{ alignSelf: 'center', padding: spacing.sm }}>
        <Text variant="small" tone="faint">
          Server: {serverUrl().replace(/^https?:\/\//, '')}
        </Text>
      </Pressable>
      <ServerSheet visible={serverOpen} onClose={() => setServerOpen(false)} />
    </Screen>
  );
}

function ServerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(serverUrl());
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setChecking(true);
    setError(null);
    try {
      const target = (url.trim() || defaultServerUrl()).replace(/\/+$/, '');
      const res = await fetch(`${target}/api/health`);
      if (!res.ok) throw new Error();
      await setServerUrl(target);
      onClose();
    } catch {
      setError("Couldn't reach a Bragboard server at that address.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Server"
      footer={
        <>
          <Button title="Save" onPress={save} loading={checking} />
          <Button title="Use default" variant="ghost" onPress={() => setUrl(defaultServerUrl())} />
        </>
      }>
      <Text tone="muted">
        Bragboard talks to your own server (for example your Raspberry Pi). You only need to change this if you
        run a different one.
      </Text>
      <Input
        label="Server address"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://bragboard.example.com"
        error={error}
      />
    </Sheet>
  );
}
