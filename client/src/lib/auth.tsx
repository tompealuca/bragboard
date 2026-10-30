import { ClientResponseError } from 'pocketbase';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { initPocketBase, pb } from './pb';
import type { User } from './types';

interface AuthValue {
  ready: boolean;
  user: User | null;
  signIn: (identity: string, password: string) => Promise<void>;
  signUp: (input: { name: string; username: string; email: string; password: string }) => Promise<void>;
  signOut: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  /** Re-reads the signed-in user (after a profile edit). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

/** Usernames are stored lowercase; emails are used as-is. */
export function normalizeIdentity(identity: string) {
  const v = identity.trim();
  return v.includes('@') ? v : v.toLowerCase().replace(/^@/, '');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    initPocketBase().then((client) => {
      setUser(client.authStore.isValid ? (client.authStore.record as unknown as User) : null);
      unsubscribe = client.authStore.onChange((token, record) => {
        setUser(token && record ? (record as unknown as User) : null);
      });
      setReady(true);

      // Refresh the token in the background. Only sign out if the server rejects it;
      // when offline we keep the saved session.
      if (client.authStore.isValid) {
        client
          .collection('users')
          .authRefresh()
          .catch((e) => {
            if (e instanceof ClientResponseError && [401, 403, 404].includes(e.status)) client.authStore.clear();
          });
      }
    });
    return () => unsubscribe?.();
  }, []);

  const value: AuthValue = {
    ready,
    user,
    async signIn(identity, password) {
      await pb().collection('users').authWithPassword(normalizeIdentity(identity), password);
    },
    async signUp({ name, username, email, password }) {
      const cleanUsername = normalizeIdentity(username);
      await pb().collection('users').create({
        name: name.trim(),
        username: cleanUsername,
        email: email.trim(),
        password,
        passwordConfirm: password,
      });
      await pb().collection('users').authWithPassword(cleanUsername, password);
    },
    signOut() {
      pb().realtime.unsubscribe().catch(() => {});
      pb().authStore.clear();
    },
    async requestPasswordReset(email) {
      await pb().collection('users').requestPasswordReset(email.trim());
    },
    async refresh() {
      await pb().collection('users').authRefresh();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

const SIGNED_OUT: User = { id: '', username: '', name: '', created: '' };

/** The signed-in user. Use inside screens that require sign-in (briefly empty while signing out). */
export function useMe(): User {
  const { user } = useAuth();
  return user ?? SIGNED_OUT;
}

export function displayName(user: Pick<User, 'name' | 'username'>) {
  return user.name?.trim() || user.username;
}
