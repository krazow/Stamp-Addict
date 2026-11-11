import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SetCompletion } from '../../src/core/sets';
import { getStore } from '../../src/data/store';
import { Button, EmptyState } from '../../src/ui/controls';
import { colors, radius, space } from '../../src/ui/theme';

type CountryRow = { country: string; sets: number; total: number; owned: number; percent: number };

export default function SetsScreen() {
  const [sets, setSets] = useState<SetCompletion[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);

  const load = useCallback(() => {
    const store = getStore();
    const summaries = store.sets.allCompletion();
    setSets(summaries.map((x) => store.sets.completion(x.setId)));
    setCountries(store.sets.completionByCountry());
  }, []);

  useFocusEffect(load);

  const addMissing = (set: SetCompletion) => {
    const store = getStore();
    const added = store.wants.addMissingFromSet(store.sets, set.setId);
    Alert.alert(
      added.length ? 'Added to want list' : 'Already on your want list',
      added.length
        ? `${added.length} missing ${added.length === 1 ? 'stamp' : 'stamps'} from ${set.name} added.`
        : `Every missing stamp from ${set.name} is already on your want list.`,
    );
  };

  const confirmDelete = (set: SetCompletion) => {
    Alert.alert('Delete set?', `${set.name} will be removed. Your stamps stay in your collection.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { getStore().sets.delete(set.setId); load(); } },
    ]);
  };

  if (sets.length === 0) {
    return (
      <EmptyState
        title="Track a set"
        body="Add a stamp issue and the stamps it contains. Stamps you own with matching catalog numbers count automatically."
        action={<Button title="New set" icon="add" onPress={() => router.push('/set/new')} />}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Button title="New set" variant="secondary" icon="add" onPress={() => router.push('/set/new')} />

      {countries.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <Text style={s.heading}>By country</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {countries.map((c) => (
              <View key={c.country} style={s.countryCard}>
                <Text style={s.countryName}>{c.country}</Text>
                <Text style={s.countryPct}>{c.percent}%</Text>
                <Text style={s.small}>{c.owned} of {c.total}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={s.heading}>Least complete first</Text>
      {sets.map((set) => (
        <Pressable key={set.setId} onLongPress={() => confirmDelete(set)} style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.setName}>{set.name}</Text>
              <Text style={s.small}>{[set.country, set.year].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={s.counts}>{set.owned} of {set.total}</Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: set.percent }}
            accessibilityLabel={`${set.name} completion`}
            style={s.barTrack}
          >
            <View style={[s.barFill, { width: `${set.percent}%` }]} />
          </View>
          <View style={s.slots}>
            {set.items.map((it) => (
              <Text key={it.id} style={[s.slot, it.owned ? s.slotOwned : s.slotMissing]}>
                {it.faceValue || it.label}
              </Text>
            ))}
          </View>
          {set.missing.length > 0 ? (
            <Button title="Add missing to want list" variant="text" onPress={() => addMissing(set)} />
          ) : null}
        </Pressable>
      ))}
      <Text style={s.tip}>Press and hold a set to delete it.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: 48 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  countryCard: {
    minWidth: 110, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, padding: space.md, gap: 4,
  },
  countryName: { fontSize: 13, color: colors.textSecondary },
  countryPct: { fontSize: 22, fontWeight: '600', color: colors.text },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card,
    padding: 14, gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  setName: { fontSize: 16, fontWeight: '600', color: colors.text },
  counts: { fontSize: 14, fontWeight: '600', color: colors.text },
  small: { fontSize: 13, color: colors.textSecondary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.divider, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  slotOwned: { backgroundColor: colors.accentSoft, color: colors.accentPressed, fontWeight: '500' },
  slotMissing: {
    backgroundColor: colors.surface, color: colors.textSecondary, borderWidth: 1,
    borderStyle: 'dashed', borderColor: colors.placeholderBorder,
  },
  tip: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
