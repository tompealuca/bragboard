import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth, USERNAME_RE } from '@/lib/auth';
import { errorMessage } from '@/lib/pb';
import { spacing } from '@/lib/theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameError = username && !USERNAME_RE.test(username) ? '3–20 characters: a–z, 0–9, _ and .' : null;

  const submit = async () => {
    if (!name.trim()) return setError('Tell us your name.');
    if (!USERNAME_RE.test(username)) return setError('Pick a valid username.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    setError(null);
    try {
      await signUp({ name, username, email, password });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} contentStyle={{ maxWidth: 440 }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Create account</Text>
        <Text tone="muted">Friends add you to games with your username.</Text>
      </View>
      <Input label="Name" value={name} onChangeText={setName} placeholder="Luca" autoComplete="name" textContentType="name" />
      <Input
        label="Username"
        value={username}
        onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
        placeholder="luca"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        icon="at"
        error={usernameError}
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
      />
      <Button title="Create account" size="lg" onPress={submit} loading={busy} />
      <Text variant="small" tone="faint" style={{ textAlign: 'center' }}>
        Your email stays private. Other players only see your name and username.
      </Text>
    </Screen>
  );
}
