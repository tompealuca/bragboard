import { router, Tabs } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import { haptic, Ionicons, type IconName } from '@/components/ui';
import { useTheme } from '@/lib/theme';

function icon(name: IconName, focusedName: IconName) {
  return ({ color, focused }: { color: unknown; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={24} color={color as string} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Games', tabBarIcon: icon('grid-outline', 'grid') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen
        name="new"
        options={{
          title: 'New',
          tabBarAccessibilityLabel: 'New session',
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New session"
                onPress={() => {
                  haptic();
                  router.push('/pick-game');
                }}
                style={({ pressed }) => ({
                  width: 52,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}>
                <Ionicons name="add" size={28} color={colors.primaryText} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: icon('people-outline', 'people') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
