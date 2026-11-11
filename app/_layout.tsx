import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/ui/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.ground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ title: 'New stamp', presentation: 'modal' }} />
        <Stack.Screen name="stamp/[id]" options={{ title: 'Stamp Card' }} />
        <Stack.Screen name="stamp/edit/[id]" options={{ title: 'Edit stamp' }} />
        <Stack.Screen name="set/new" options={{ title: 'New set', presentation: 'modal' }} />
        <Stack.Screen name="want/new" options={{ title: 'Add a want', presentation: 'modal' }} />
        <Stack.Screen name="backup" options={{ title: 'Backup and restore' }} />
      </Stack>
    </>
  );
}
