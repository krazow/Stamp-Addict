import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import type { Want } from '../../src/core/wantlist';
import { getStore } from '../../src/data/store';
import { Button, EmptyState } from '../../src/ui/controls';
import { catalogText } from '../../src/ui/format';
import { colors, radius, space } from '../../src/ui/theme';

const GROUPS = [
  { key: 'high', title: 'High priority' },
  { key: 'medium', title: 'Medium priority' },
  { key: 'low', title: 'Low priority' },
] as const;

export default function WantsScreen() {
  const [wants, setWants] = useState<Want[]>([]);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(() => {
    setWants(getStore().wants.list({ includeAcquired: true }));
  }, []);
  useFocusEffect(load);

  const open = wants.filter((w) => !w.acquiredAt);
  const done = wants.filter((w) => w.acquiredAt);

  const sections: { title: string; data: Want[] }[] = GROUPS
    .map((g) => ({ title: g.title as string, data: open.filter((w) => w.priority === g.key) }))
    .filter((sec) => sec.data.length > 0);
  if (showDone && done.length) sections.push({ title: 'Checked off', data: done });

  const checkOff = (w: Want) => {
    getStore().wants.markAcquired(w.id);
    load();
  };

  const remove = (w: Want) => {
    Alert.alert('Remove from want list?', w.description, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { getStore().wants.remove(w.id); load(); } },
    ]);
  };

  if (wants.length === 0) {
    return (
      <EmptyState
        title="Your want list is empty"
        body="Add stamps you're looking for. When you save a Stamp Card that matches one, the app offers to check it off."
        action={<Button title="Add a want" icon="add" onPress={() => router.push('/want/new')} />}
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(w) => w.id}
      contentContainerStyle={s.content}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ marginBottom: space.sm }}>
          <Button title="Add a want" icon="add" onPress={() => router.push('/want/new')} />
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={s.heading}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable onLongPress={() => remove(item)} style={s.row}>
          {item.acquiredAt ? (
            <Ionicons name="checkbox" size={26} color={colors.accent} accessibilityLabel="Checked off" />
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel={`Got it: ${item.description}`}
              onPress={() => checkOff(item)}
              hitSlop={10}
            >
              <Ionicons name="square-outline" size={26} color={colors.textSecondary} />
            </Pressable>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[s.title, item.acquiredAt ? s.titleDone : null]}>{item.description}</Text>
            <Text style={s.sub}>
              {[item.country, item.year, item.maxPrice != null ? `up to ${item.maxPrice}` : null]
                .filter(Boolean).join(' · ')}
            </Text>
          </View>
          {item.catalog && item.catalogNumber ? (
            <Text style={s.catalog}>{catalogText({ catalog: item.catalog, number: item.catalogNumber })}</Text>
          ) : null}
        </Pressable>
      )}
      ListFooterComponent={
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {done.length > 0 ? (
            <Button
              title={showDone ? 'Hide checked off' : `Show checked off · ${done.length}`}
              variant="secondary"
              onPress={() => setShowDone(!showDone)}
            />
          ) : null}
          <Text style={s.tip}>Press and hold a want to remove it.</Text>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, paddingBottom: 48 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: space.lg, marginBottom: space.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, marginBottom: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card,
  },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  sub: { fontSize: 13, color: colors.textSecondary },
  catalog: {
    fontSize: 12, color: colors.text, backgroundColor: colors.accentSofter, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  tip: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
