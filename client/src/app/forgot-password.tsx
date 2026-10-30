import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/pb';
import { spacing } from '@/lib/theme';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} contentStyle={{ maxWidth: 440 }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Reset password</Text>
        <Text tone="muted">We'll email you a link to choose a new password.</Text>
      </View>
      {sent ? (
        <Text variant="bodyStrong" tone="success">
          If an account uses that email, a reset link is on its way.
        </Text>
      ) : (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={error}
            onSubmitEditing={submit}
          />
          <Button title="Send reset link" size="lg" onPress={submit} loading={busy} disabled={!email.trim()} />
        </>
      )}
    </Screen>
  );
}
