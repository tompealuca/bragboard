import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

const light = {
  bg: '#F5F5F8',
  card: '#FFFFFF',
  cardAlt: '#F0EFF5',
  border: '#E6E5EC',
  text: '#16151C',
  textMuted: '#6B6A76',
  textFaint: '#9C9BA6',
  primary: '#6D4AFF',
  primaryText: '#FFFFFF',
  primarySoft: '#EEEAFF',
  gold: '#E09B00',
  goldSoft: '#FFF4D6',
  success: '#1F9D63',
  successSoft: '#E3F6EC',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  overlay: 'rgba(10, 9, 20, 0.45)',
};

const dark: typeof light = {
  bg: '#0E0D12',
  card: '#1A1920',
  cardAlt: '#25242D',
  border: '#2E2D37',
  text: '#F4F3F8',
  textMuted: '#A3A2AE',
  textFaint: '#6F6E7A',
  primary: '#8B70FF',
  primaryText: '#FFFFFF',
  primarySoft: '#2A2445',
  gold: '#FFC23D',
  goldSoft: '#3A2F12',
  success: '#3CCB86',
  successSoft: '#163527',
  danger: '#FF6369',
  dangerSoft: '#3B1D20',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export type Colors = typeof light;
export type ThemePreference = 'system' | 'light' | 'dark';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const MAX_WIDTH = 760;
export const isWeb = Platform.OS === 'web';

interface ThemeValue {
  colors: Colors;
  dark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: light,
  dark: false,
  preference: 'system',
  setPreference: () => {},
});

const PREF_KEY = 'bragboard.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
    return {
      colors: isDark ? dark : light,
      dark: isDark,
      preference,
      setPreference: (p) => {
        setPref(p);
        AsyncStorage.setItem(PREF_KEY, p).catch(() => {});
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
