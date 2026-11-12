import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { prepareStorage } from '../src/data/prepare';
import { AlertHost } from '../src/ui/alert';
import { colors, contentMaxWidth, space } from '../src/ui/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prepareStorage()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!ready) {
    return (
      <View style={s.center}>
        {error ? (
          <>
            <Text style={s.title}>Stamp Addict can't open your collection</Text>
            <Text style={s.body}>{error}</Text>
          </>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  return (
    <View style={s.outer}>
      <View style={s.column}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.text },
            // A solid header color keeps screen content below the header on iOS 26+
            // (SDK 58 otherwise makes headers transparent and lets content slide under).
            headerStyle: { backgroundColor: colors.ground },
            headerShadowVisible: false,
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
        <AlertHost />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: Platform.OS === 'web' ? colors.divider : colors.ground },
  column: {
    flex: 1, width: '100%', alignSelf: 'center', backgroundColor: colors.ground,
    ...(Platform.OS === 'web' ? { maxWidth: contentMaxWidth } : null),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.ground },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', maxWidth: 480, lineHeight: 22 },
});
