import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  CENTERINGS, FORMATS, GUMS, MINT_STATUSES, NotFoundError, PAPER_TYPES, PHOTO_ROLES, PRINTING_METHODS,
  SEPARATIONS, STAMP_TYPES, TAGGINGS, type StampCard,
} from '../../src/core';
import { photoSource } from '../../src/data/photos';
import { getStore } from '../../src/data/store';
import { EmptyState, Pill, StampThumb } from '../../src/ui/controls';
import { catalogLongName, perforationText, stampSubtitle, stampTitle } from '../../src/ui/format';
import { colors, radius, space } from '../../src/ui/theme';

type Row = [label: string, value: string | number | null | undefined];

function label(list: { labels: Record<string, string> }, v: string | null | undefined) {
  return v ? list.labels[v] ?? v : null;
}

export default function StampCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<StampCard | null>(null);
  const [missing, setMissing] = useState(false);
  const [setInfo, setSetInfo] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const { width } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      try {
        const store = getStore();
        const c = store.stamps.get(id);
        setCard(c);
        setMissing(false);
        const found = c.setItemId ? store.sets.findItem(c.setItemId) : null;
        setSetInfo(found ? `${found.setName} · ${found.item.faceValue || found.item.label}` : null);
        setPhotoIndex((i) => Math.min(i, Math.max(0, c.photos.length - 1)));
      } catch (e) {
        if (e instanceof NotFoundError) setMissing(true);
        else throw e;
      }
    }, [id]),
  );

  if (missing) return <EmptyState title="Stamp not found" body="It may have been deleted." />;
  if (!card) return null;

  const photo = card.photos[photoIndex];
  const big = Math.min(width - space.xl * 2, 280);

  const allSections: { title: string; rows: Row[] }[] = [
    {
      title: 'Identification',
      rows: [
        ['Country', card.country], ['Year', card.year], ['Issue date', card.issueDate],
        ['Face value', card.faceValue], ['Currency', card.currency], ['Color', card.colors],
        ['Design', card.designSubject], ['Type', label(STAMP_TYPES, card.stampType)],
        ['Designer', card.designer], ['Engraver', card.engraver], ['Printer', card.printer],
      ],
    },
    {
      title: 'Catalog numbers',
      rows: card.catalogNumbers.map((c): Row => [
        c.catalog === 'other' ? c.catalogLabel || 'Other' : catalogLongName(c.catalog),
        [c.number, c.catalogValue != null ? `value ${c.catalogValue}${c.valueCurrency ? ' ' + c.valueCurrency : ''}` : null,
          c.edition ? `(${c.edition})` : null].filter(Boolean).join(' · '),
      ]),
    },
    {
      title: 'Physical details',
      rows: [
        ['Perforation', perforationText(card.perfHorizontal, card.perfVertical)],
        ['Separation', label(SEPARATIONS, card.separation)], ['Watermark', card.watermark],
        ['Paper', label(PAPER_TYPES, card.paperType)], ['Printing', label(PRINTING_METHODS, card.printingMethod)],
        ['Gum', label(GUMS, card.gum)], ['Tagging', label(TAGGINGS, card.tagging)],
        ['Format', label(FORMATS, card.format)],
        ['Size', card.widthMm && card.heightMm ? `${card.widthMm} × ${card.heightMm} mm` : null],
      ],
    },
    {
      title: 'Condition',
      rows: [
        ['Mint or used', label(MINT_STATUSES, card.mintStatus)], ['Centering', label(CENTERINGS, card.centering)],
        ['Grade', card.grade], ['Cancellation', card.cancellation], ['Faults', card.faults],
        ['Certificate', card.hasCertificate == null ? null : card.hasCertificate ? 'Yes' : 'No'],
      ],
    },
    {
      title: 'Varieties',
      rows: [['Error or variety', card.errorVariety], ['Plate number', card.plateNumber], ['Overprint', card.overprint], ['Shade', card.shade]],
    },
    {
      title: 'Collection',
      rows: [
        ['Quantity', card.quantity], ['Purchase price', card.purchasePrice != null ? `${card.purchasePrice}${card.purchaseCurrency ? ' ' + card.purchaseCurrency : ''}` : null],
        ['Purchase date', card.purchaseDate], ['Bought from', card.source], ['Estimated value', card.estimatedValue],
        ['Stored in', card.storageLocation], ['For trade', card.forTrade ? 'Yes' : null],
      ],
    },
  ];
  const sections = allSections
    .map((sec) => ({ ...sec, rows: sec.rows.filter(([, v]) => v !== null && v !== undefined && v !== '') }))
    .filter((sec) => sec.rows.length > 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href={`/stamp/edit/${card.id}`} asChild>
              <Pressable accessibilityRole="button" hitSlop={10}>
                <Text style={s.edit}>Edit</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          {photo ? (
            <Image
              source={photoSource(photo.uri)!}
              style={{ width: big, height: big * 1.2, borderRadius: 8, backgroundColor: colors.placeholder }}
              resizeMode="contain"
              accessibilityLabel={`${PHOTO_ROLES.labels[photo.role]} photo`}
            />
          ) : (
            <StampThumb uri={null} width={big * 0.7} height={big * 0.85} />
          )}
          {card.photos.length > 1 ? (
            <View style={s.thumbs} accessibilityRole="tablist">
              {card.photos.map((p, i) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: i === photoIndex }}
                  accessibilityLabel={PHOTO_ROLES.labels[p.role]}
                  onPress={() => setPhotoIndex(i)}
                  style={[s.thumbWrap, i === photoIndex && s.thumbOn]}
                >
                  <StampThumb uri={p.uri} width={46} height={56} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {photo && card.photos.length > 1 ? <Text style={s.small}>{PHOTO_ROLES.labels[photo.role]}</Text> : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={s.title}>{stampTitle(card)}</Text>
          {stampSubtitle(card) ? <Text style={s.subtitle}>{stampSubtitle(card)}</Text> : null}
          {card.tags.length || setInfo ? (
            <View style={s.pills}>
              {card.tags.map((t) => <Pill key={t} text={t} />)}
              {setInfo ? <Pill text={setInfo} tone="accent" /> : null}
            </View>
          ) : null}
        </View>

        {sections.map((sec) => (
          <View key={sec.title} style={s.card}>
            <Text style={s.cardTitle}>{sec.title}</Text>
            {sec.rows.map(([k, v], i) => (
              <View key={`${k}-${i}`} style={s.row}>
                <Text style={s.rowKey}>{k}</Text>
                <Text style={s.rowValue}>{String(v)}</Text>
              </View>
            ))}
          </View>
        ))}

        {card.notes ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Notes</Text>
            <Text style={s.notes}>{card.notes}</Text>
          </View>
        ) : null}

        <Text style={s.small}>Fields you haven't filled in are hidden here. Tap Edit to add more.</Text>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: 48 },
  edit: { fontSize: 17, fontWeight: '600', color: colors.accent },
  thumbs: { flexDirection: 'row', gap: space.sm },
  thumbWrap: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  thumbOn: { borderColor: colors.accent },
  title: { fontSize: 24, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 10, marginBottom: 4 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  rowKey: { fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 14, color: colors.text, flexShrink: 1, textAlign: 'right' },
  notes: { fontSize: 15, color: colors.text, lineHeight: 22, paddingBottom: 12 },
  small: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
