// PocketBase client: one instance for the whole app, auth persisted in AsyncStorage
// (localStorage on web), server address configurable at runtime.

import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';
import { Platform } from 'react-native';
import EventSource from 'react-native-sse';

// Realtime uses Server-Sent Events. Browsers have EventSource, phones need a polyfill.
if (Platform.OS !== 'web' && typeof (globalThis as any).EventSource === 'undefined') {
  (globalThis as any).EventSource = EventSource;
}

const AUTH_KEY = 'bragboard.auth';
const SERVER_KEY = 'bragboard.server';

/** Server used when the user did not pick one. */
export function defaultServerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  // The web app is served by the same PocketBase that hosts the API.
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'http://127.0.0.1:8090';
}

let client: PocketBase | null = null;

export function pb(): PocketBase {
  if (!client) throw new Error('PocketBase is not initialised yet');
  return client;
}

/** Loads the saved session and server address, then creates the client. */
export async function initPocketBase(): Promise<PocketBase> {
  if (client) return client;
  const [savedAuth, savedServer] = await Promise.all([
    AsyncStorage.getItem(AUTH_KEY).catch(() => null),
    AsyncStorage.getItem(SERVER_KEY).catch(() => null),
  ]);

  const store = new BaseAuthStore();
  if (savedAuth) {
    try {
      const { token, record } = JSON.parse(savedAuth);
      store.save(token, record);
    } catch {
      // ignore a corrupted entry
    }
  }
  store.onChange((token, record) => {
    if (token) AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ token, record })).catch(() => {});
    else AsyncStorage.removeItem(AUTH_KEY).catch(() => {});
  });

  client = new PocketBase(savedServer || defaultServerUrl(), store);
  // React Query already de-duplicates requests; PocketBase's auto-cancel would abort parallel ones.
  client.autoCancellation(false);
  return client;
}

export function serverUrl() {
  return client?.baseURL ?? defaultServerUrl();
}

export async function setServerUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  const value = clean || defaultServerUrl();
  pb().baseURL = value;
  if (clean && clean !== defaultServerUrl()) await AsyncStorage.setItem(SERVER_KEY, clean);
  else await AsyncStorage.removeItem(SERVER_KEY);
}

/** Turns any PocketBase / network error into a short message for the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return "Can't reach the server. Check your connection.";
    if (error.status === 429) return 'Too many attempts. Wait a few seconds and try again.';
    const fields = error.response?.data as Record<string, { code: string; message: string }> | undefined;
    if (fields && Object.keys(fields).length > 0) {
      const [field, info] = Object.entries(fields)[0];
      if (info.code === 'validation_not_unique') return `That ${field} is already taken.`;
      if (field === 'username' && info.code === 'validation_invalid_format')
        return 'Usernames use lowercase letters, numbers, _ and . only.';
      return `${capitalize(field)}: ${info.message}`;
    }
    if (error.status === 400 && /authenticate/i.test(error.message)) return 'Wrong username/email or password.';
    if (error.status === 404) return 'Not found, or you no longer have access.';
    if (error.status === 403) return "You don't have permission to do that.";
    return error.message || 'Something went wrong.';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
