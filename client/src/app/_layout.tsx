import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { useRealtimeSync } from '@/lib/queries';
import { ThemeProvider, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: '(tabs)' };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 1000 * 60 * 60 * 24 * 7, retry: 1 },
  },
});

// Cached data is saved on the device, so the app opens instantly and works read-only offline.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'bragboard.cache', throttleTime: 1000 });

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { ready, user } = useAuth();
  const { colors, dark } = useTheme();
  const previousUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Refetch when the phone app comes back to the foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);

  // Never show one account's data to another.
  useEffect(() => {
    if (!ready) return;
    const id = user?.id ?? null;
    if (previousUser.current !== undefined && previousUser.current !== id) queryClient.clear();
    previousUser.current = id;
  }, [ready, user?.id]);

  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: user?.id ?? 'signed-out' }}>
      <NavigationTheme value={navigationTheme}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <RealtimeSync enabled={!!user} />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontWeight: '700', color: colors.text },
            headerTintColor: colors.primary,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="pick-game" options={{ title: 'New session', presentation: 'modal' }} />
            <Stack.Screen name="game/new" options={{ title: 'Add a game', presentation: 'modal' }} />
            <Stack.Screen name="game/[id]/index" options={{ title: '' }} />
            <Stack.Screen name="game/[id]/edit" options={{ title: 'Edit game', presentation: 'modal' }} />
            <Stack.Screen name="play/[gameId]" options={{ title: 'New session' }} />
            <Stack.Screen name="session/[id]/index" options={{ title: '' }} />
            <Stack.Screen name="session/[id]/edit" options={{ title: 'Edit session' }} />
            <Stack.Screen name="user/[id]" options={{ title: '' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack.Protected>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ title: '' }} />
            <Stack.Screen name="forgot-password" options={{ title: '' }} />
          </Stack.Protected>
        </Stack>
      </NavigationTheme>
    </PersistQueryClientProvider>
  );
}

function RealtimeSync({ enabled }: { enabled: boolean }) {
  useRealtimeSync(enabled);
  return null;
}
