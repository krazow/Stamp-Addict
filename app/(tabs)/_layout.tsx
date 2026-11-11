import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { colors } from '../../src/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My collection',
          tabBarLabel: 'Collection',
          headerRight: () => (
            <Link href="/backup" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Backup and restore" hitSlop={10} style={{ marginRight: 16 }}>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.accent} />
              </Pressable>
            </Link>
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sets"
        options={{
          title: 'Sets',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wants"
        options={{
          title: 'Want list',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
