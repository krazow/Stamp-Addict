import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MINT_STATUSES, type StampSummary } from '../../src/core';
import { getStore } from '../../src/data/store';
import { Button, EmptyState, StampThumb } from '../../src/ui/controls';
import { colors, radius, space } from '../../src/ui/theme';

type ViewMode = 'grid' | 'list';

export default function CollectionScreen() {
  const [stamps, setStamps] = useState<StampSummary[]>([]);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ViewMode>('grid');
  const { width } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      const store = getStore();
      setStamps(store.stamps.list({ tag: tag ?? undefined, limit: 5000 }));
      setTags(store.stamps.allTags());
    }, [tag]),
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stamps;
    return stamps.filter((s) =>
      [s.country, s.year?.toString(), s.faceValue, s.designSubject, s.primaryCatalog]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [stamps, query]);

  const cellWidth = (width - space.xl * 2 - space.md * 2) / 3;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <View style={s.searchRow}>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search country, year, catalog #"
              placeholderTextColor="#8C8A82"
              accessibilityLabel="Search stamps"
              style={s.searchInput}
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === 'grid' ? 'Show as list' : 'Show as grid'}
            onPress={() => setMode(mode === 'grid' ? 'list' : 'grid')}
            style={s.modeButton}
          >
            <Ionicons name={mode === 'grid' ? 'list' : 'grid-outline'} size={20} color={colors.text} />
          </Pressable>
        </View>
        {tags.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ name: 'All', count: 0 }, ...tags]}
            keyExtractor={(t) => t.name}
            contentContainerStyle={{ gap: space.sm }}
            renderItem={({ item }) => {
              const selected = item.name === 'All' ? tag === null : tag === item.name;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTag(item.name === 'All' ? null : item.name)}
                  style={[s.tagChip, selected && s.tagChipOn]}
                >
                  <Text style={[s.tagText, selected && { color: '#FFFFFF', fontWeight: '600' }]}>{item.name}</Text>
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>

      {stamps.length === 0 && !tag ? (
        <EmptyState
          title="Start your collection"
          body="Photograph a stamp to make its Stamp Card. Every detail is optional; you can add them later."
          action={<Button title="Add a stamp" icon="camera-outline" onPress={() => router.push('/add')} />}
        />
      ) : (
        <FlatList
          key={mode}
          data={shown}
          keyExtractor={(i) => i.id}
          numColumns={mode === 'grid' ? 3 : 1}
          columnWrapperStyle={mode === 'grid' ? { gap: space.md } : undefined}
          contentContainerStyle={mode === 'grid' ? s.gridContent : s.listContent}
          ListEmptyComponent={<Text style={s.noMatch}>No stamps match.</Text>}
          renderItem={({ item }) =>
            mode === 'grid' ? <GridCell stamp={item} width={cellWidth} /> : <ListRow stamp={item} />
          }
        />
      )}

      <Link href="/add" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a stamp" style={s.fab}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </Pressable>
      </Link>
    </View>
  );
}

function GridCell({ stamp, width }: { stamp: StampSummary; width: number }) {
  return (
    <Link href={`/stamp/${stamp.id}`} asChild>
      <Pressable accessibilityRole="button" style={{ width, gap: 4, marginBottom: space.md }}>
        <StampThumb uri={stamp.thumbnailUri} width={width} height={width * 1.25} />
        <Text style={s.cellTitle} numberOfLines={1}>{stamp.country ?? 'Unknown'}</Text>
        {stamp.year ? <Text style={s.cellSub}>{stamp.year}</Text> : null}
      </Pressable>
    </Link>
  );
}

function ListRow({ stamp }: { stamp: StampSummary }) {
  const title = [stamp.country ?? 'Unknown', stamp.year].filter(Boolean).join(' · ');
  const detail = [stamp.faceValue, stamp.designSubject].filter(Boolean).join(' ');
  return (
    <Link href={`/stamp/${stamp.id}`} asChild>
      <Pressable accessibilityRole="button" style={s.row}>
        <StampThumb uri={stamp.thumbnailUri} width={44} height={54} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
          {detail ? <Text style={s.rowSub} numberOfLines={1}>{detail}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {stamp.primaryCatalog ? <Text style={s.catalog}>{stamp.primaryCatalog}</Text> : null}
          {stamp.mintStatus ? (
            <Text style={s.rowSub}>{shortCondition(stamp.mintStatus)}</Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

function shortCondition(v: string): string {
  const label = (MINT_STATUSES.labels as Record<string, string>)[v] ?? v;
  return label.replace(/\s*\(.*\)$/, '');
}

const s = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  searchRow: { flexDirection: 'row', gap: space.sm },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, paddingHorizontal: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  modeButton: {
    width: 44, height: 44, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  tagChip: {
    height: 34, paddingHorizontal: 14, borderRadius: radius.chip, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, justifyContent: 'center',
  },
  tagChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  tagText: { fontSize: 13, color: colors.text },
  gridContent: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: 120 },
  listContent: { paddingBottom: 120, backgroundColor: colors.surface },
  cellTitle: { fontSize: 12, fontWeight: '500', color: colors.text },
  cellSub: { fontSize: 11, color: colors.textSecondary },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, minHeight: 64,
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textSecondary },
  catalog: {
    fontSize: 12, color: colors.text, backgroundColor: colors.accentSofter, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  noMatch: { textAlign: 'center', color: colors.textSecondary, padding: 32, fontSize: 15 },
  fab: {
    position: 'absolute', right: space.xl, bottom: space.xl, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
