import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../../../src/ui/alert';
import {
  CATALOGS, CENTERINGS, FORMATS, GUMS, MINT_STATUSES, NotFoundError, PAPER_TYPES, PHOTO_ROLES,
  PRINTING_METHODS, SEPARATIONS, STAMP_TYPES, TAGGINGS, ValidationError, parsePerforation,
  type Catalog, type CatalogNumberInput, type PhotoRole, type StampCard, type StampCardInput,
} from '../../../src/core';
import type { StampSet } from '../../../src/core/sets';
import { CameraPermissionError, deletePhotoFile, pickPhoto } from '../../../src/data/photos';
import { getStore } from '../../../src/data/store';
import { Button, ChipSelect, EmptyState, Field, Section, StampThumb, Toggle, optionsOf } from '../../../src/ui/controls';
import { catalogText, perforationText, toNumber, toText } from '../../../src/ui/format';
import { colors, radius, space } from '../../../src/ui/theme';

/** The form keeps numbers as text while typing; they're converted on save. */
type Form = Omit<StampCardInput, 'year' | 'grade' | 'quantity' | 'purchasePrice' | 'estimatedValue' | 'widthMm' | 'heightMm' | 'perfHorizontal' | 'perfVertical'> & {
  year: string; grade: string; quantity: string; purchasePrice: string; estimatedValue: string;
  widthMm: string; heightMm: string; perforation: string;
};

function toForm(c: StampCard): Form {
  const { year, grade, quantity, purchasePrice, estimatedValue, widthMm, heightMm, perfHorizontal, perfVertical, ...rest } = c;
  return {
    ...rest,
    year: toText(year), grade: toText(grade), quantity: toText(quantity),
    purchasePrice: toText(purchasePrice), estimatedValue: toText(estimatedValue),
    widthMm: toText(widthMm), heightMm: toText(heightMm),
    perforation: perforationText(perfHorizontal, perfVertical) ?? '',
    photos: c.photos.map(({ role, uri, width, height, caption }) => ({ role, uri, width, height, caption })),
    catalogNumbers: c.catalogNumbers.map(({ id: _id, ...n }) => n),
  };
}

export default function EditStampScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [original, setOriginal] = useState<StampCard | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [sets, setSets] = useState<StampSet[]>([]);
  const [newPhotoRole, setNewPhotoRole] = useState<PhotoRole>('detail');
  const [newCatalog, setNewCatalog] = useState<Catalog>('scott');
  const [newCatalogNumber, setNewCatalogNumber] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    try {
      const store = getStore();
      const c = store.stamps.get(id);
      setOriginal(c);
      setForm(toForm(c));
      setSets(store.sets.listWithItems());
    } catch (e) {
      if (e instanceof NotFoundError) setMissing(true);
      else throw e;
    }
  }, [id]);

  if (missing) return <EmptyState title="Stamp not found" body="It may have been deleted." />;
  if (!form || !original) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    if (error?.field === key) setError(null);
  };
  const text = (key: keyof Form) => ({
    value: (form[key] as string | null | undefined) ?? '',
    onChangeText: (v: string) => set(key, v as never),
    error: error?.field === key ? error.message : null,
  });

  const photos = form.photos ?? [];
  const catalogs = form.catalogNumbers ?? [];
  const tags = form.tags ?? [];

  const addPhoto = () => {
    const run = async (source: 'camera' | 'library') => {
      try {
        const p = await pickPhoto(source);
        if (!p) return;
        // Only one front and one back: a new one replaces the old.
        const rest = (newPhotoRole === 'front' || newPhotoRole === 'back')
          ? photos.filter((x) => x.role !== newPhotoRole) : photos;
        set('photos', [...rest, { role: newPhotoRole, ...p }]);
      } catch (e) {
        Alert.alert(
          e instanceof CameraPermissionError ? 'Camera not allowed' : 'Couldn\'t add the photo',
          e instanceof CameraPermissionError ? 'Turn on camera access for Stamp Addict in your phone\'s Settings.' : String(e),
        );
      }
    };
    Alert.alert(`Add ${PHOTO_ROLES.labels[newPhotoRole].toLowerCase()} photo`, undefined, [
      { text: 'Take photo', onPress: () => run('camera') },
      { text: 'Choose from library', onPress: () => run('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addCatalog = () => {
    const number = newCatalogNumber.trim();
    if (!number) return;
    const entry: CatalogNumberInput = { catalog: newCatalog, number };
    set('catalogNumbers', [...catalogs, entry]);
    setNewCatalogNumber('');
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) set('tags', [...tags, t]);
    setNewTag('');
  };

  const save = () => {
    const { perforation, ...f } = form;
    let perfHorizontal: number | null = null;
    let perfVertical: number | null = null;
    if (perforation.trim()) {
      const p = parsePerforation(perforation);
      if (!p) {
        setError({ field: 'perforation', message: 'Write it like 12, or 11 x 10½.' });
        return;
      }
      perfHorizontal = p.horizontal;
      perfVertical = p.vertical;
    }
    const patch: StampCardInput = {
      ...f,
      year: toNumber(f.year), grade: toNumber(f.grade),
      quantity: toNumber(f.quantity) ?? 1,
      purchasePrice: toNumber(f.purchasePrice), estimatedValue: toNumber(f.estimatedValue),
      widthMm: toNumber(f.widthMm), heightMm: toNumber(f.heightMm),
      perfHorizontal, perfVertical,
    };
    try {
      getStore().stamps.update(id, patch);
      // Remove files of photos that were taken off the card.
      const kept = new Set(photos.map((p) => p.uri));
      original.photos.filter((p) => !kept.has(p.uri)).forEach((p) => deletePhotoFile(p.uri));
      router.back();
    } catch (e) {
      if (e instanceof ValidationError) {
        const field = e.field === 'perfHorizontal' || e.field === 'perfVertical' ? 'perforation' : e.field;
        setError({ field, message: e.message.replace(/^[^:]+:\s*/, '') });
        Alert.alert('Check the form', `${friendlyField(field)}: ${e.message.replace(/^[^:]+:\s*/, '')}`);
      } else {
        Alert.alert('Couldn\'t save', String(e));
      }
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete this stamp?', 'Its Stamp Card and photos will be removed. This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          getStore().stamps.delete(id);
          original.photos.forEach((p) => deletePhotoFile(p.uri));
          router.dismissAll();
        },
      },
    ]);
  };

  const setChoices = sets.flatMap((st) => st.items.map((it) => ({ value: it.id, label: `${st.name}: ${it.faceValue || it.label}` })));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={save} hitSlop={10}>
              <Text style={s.headerSave}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Section title="Photos" initiallyOpen>
          <View style={s.photoRow}>
            {photos.map((p, i) => (
              <View key={`${p.uri}-${i}`} style={{ alignItems: 'center', gap: 4 }}>
                <StampThumb uri={p.uri} width={64} height={78} />
                <Text style={s.small}>{PHOTO_ROLES.labels[p.role]}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${PHOTO_ROLES.labels[p.role]} photo`}
                  onPress={() => set('photos', photos.filter((_, j) => j !== i))}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>
          <ChipSelect label="Next photo is a" options={optionsOf(PHOTO_ROLES)} value={newPhotoRole} onChange={(v) => v && setNewPhotoRole(v)} allowClear={false} />
          <Button title="Add photo" variant="secondary" icon="camera-outline" onPress={addPhoto} />
        </Section>

        <Section title="Basics" initiallyOpen>
          <Field label="Country" {...text('country')} autoCapitalize="words" />
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}><Field label="Year" {...text('year')} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Face value" {...text('faceValue')} placeholder="3c" /></View>
          </View>
          <Field label="Design / subject" {...text('designSubject')} placeholder="Locomotive" />
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}><Field label="Issue date" {...text('issueDate')} placeholder="1869-03-27" /></View>
            <View style={{ flex: 1 }}><Field label="Currency" {...text('currency')} /></View>
          </View>
          <Field label="Color(s)" {...text('colors')} placeholder="Ultramarine" />
          <ChipSelect label="Stamp type" options={optionsOf(STAMP_TYPES)} value={form.stampType} onChange={(v) => set('stampType', v)} />

          <View style={{ gap: 6 }}>
            <Text style={s.label}>Catalog numbers</Text>
            {catalogs.map((c, i) => (
              <View key={`${c.catalog}-${c.number}-${i}`} style={s.listRow}>
                <Text style={s.listText}>{catalogText(c)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${catalogText(c)}`}
                  onPress={() => set('catalogNumbers', catalogs.filter((_, j) => j !== i))}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
            <ChipSelect options={optionsOf(CATALOGS).filter((o) => o.value !== 'other')} value={newCatalog} onChange={(v) => v && setNewCatalog(v)} allowClear={false} />
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Field label="Number" value={newCatalogNumber} onChangeText={setNewCatalogNumber} autoCapitalize="characters" onSubmitEditing={addCatalog} />
              </View>
              <View style={{ justifyContent: 'flex-end' }}><Button title="Add" variant="secondary" onPress={addCatalog} /></View>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={s.label}>Tags</Text>
            <View style={s.tagRow}>
              {tags.map((t) => (
                <Pressable key={t} accessibilityRole="button" accessibilityLabel={`Remove tag ${t}`} onPress={() => set('tags', tags.filter((x) => x !== t))} style={s.tag}>
                  <Text style={s.tagText}>{t}</Text>
                  <Ionicons name="close" size={14} color={colors.accentPressed} />
                </Pressable>
              ))}
            </View>
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}><Field label="New tag" value={newTag} onChangeText={setNewTag} onSubmitEditing={addTag} /></View>
              <View style={{ justifyContent: 'flex-end' }}><Button title="Add" variant="secondary" onPress={addTag} /></View>
            </View>
          </View>
        </Section>

        <Section title="Physical details" hint="Perforation, watermark, paper, printing, gum">
          <Field label="Perforation" {...text('perforation')} placeholder="11 x 10½" hint="One number, or two like 11 x 10½ (sides, then top and bottom)." />
          <ChipSelect label="Separation" options={optionsOf(SEPARATIONS)} value={form.separation} onChange={(v) => set('separation', v)} />
          <Field label="Watermark" {...text('watermark')} placeholder="None" />
          <ChipSelect label="Paper" options={optionsOf(PAPER_TYPES)} value={form.paperType} onChange={(v) => set('paperType', v)} />
          <ChipSelect label="Printing method" options={optionsOf(PRINTING_METHODS)} value={form.printingMethod} onChange={(v) => set('printingMethod', v)} />
          <ChipSelect label="Gum" options={optionsOf(GUMS)} value={form.gum} onChange={(v) => set('gum', v)} />
          <ChipSelect label="Tagging" options={optionsOf(TAGGINGS)} value={form.tagging} onChange={(v) => set('tagging', v)} />
          <ChipSelect label="Format" options={optionsOf(FORMATS)} value={form.format} onChange={(v) => set('format', v)} />
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}><Field label="Width (mm)" {...text('widthMm')} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Height (mm)" {...text('heightMm')} keyboardType="decimal-pad" /></View>
          </View>
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}><Field label="Designer" {...text('designer')} /></View>
            <View style={{ flex: 1 }}><Field label="Engraver" {...text('engraver')} /></View>
          </View>
          <Field label="Printer" {...text('printer')} />
        </Section>

        <Section title="Condition" hint="Mint or used, centering, grade, faults">
          <ChipSelect label="Mint or used" options={optionsOf(MINT_STATUSES)} value={form.mintStatus} onChange={(v) => set('mintStatus', v)} />
          <ChipSelect label="Centering" options={optionsOf(CENTERINGS)} value={form.centering} onChange={(v) => set('centering', v)} />
          <Field label="Grade (1–100)" {...text('grade')} keyboardType="number-pad" />
          <Field label="Cancellation" {...text('cancellation')} />
          <Field label="Faults" {...text('faults')} placeholder="Thin, short perf…" />
          <Toggle label="Has a certificate" value={!!form.hasCertificate} onChange={(v) => set('hasCertificate', v)} />
        </Section>

        <Section title="Varieties and errors" hint="Errors, plate number, overprint, shade">
          <Field label="Error or variety" {...text('errorVariety')} placeholder="Inverted center" />
          <Field label="Plate number" {...text('plateNumber')} />
          <Field label="Overprint / surcharge" {...text('overprint')} />
          <Field label="Shade" {...text('shade')} />
        </Section>

        <Section title="Collection and value" hint="Quantity, purchase, value, where it's kept">
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}><Field label="Quantity" {...text('quantity')} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Estimated value" {...text('estimatedValue')} keyboardType="decimal-pad" /></View>
          </View>
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}><Field label="Purchase price" {...text('purchasePrice')} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Currency" {...text('purchaseCurrency')} placeholder="USD" /></View>
          </View>
          <Field label="Purchase date" {...text('purchaseDate')} placeholder="2026-11-11" />
          <Field label="Bought from" {...text('source')} />
          <Field label="Stored in" {...text('storageLocation')} placeholder="Album 1, page 4" />
          <Toggle label="Available for trade" value={!!form.forTrade} onChange={(v) => set('forTrade', v)} />
        </Section>

        <Section title="Set" hint={setChoices.length ? 'Which set this stamp belongs to' : 'Create a set on the Sets tab first'}>
          {setChoices.length ? (
            <ChipSelect options={setChoices} value={form.setItemId} onChange={(v) => set('setItemId', v)} />
          ) : (
            <Text style={s.small}>No sets yet. Create one on the Sets tab.</Text>
          )}
        </Section>

        <Section title="Notes" hint="Anything else">
          <Field label="Notes" {...text('notes')} multiline />
        </Section>

        <Button title="Save" onPress={save} />
        <Button title="Delete stamp" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyField(f: string): string {
  const map: Record<string, string> = {
    year: 'Year', grade: 'Grade', quantity: 'Quantity', perforation: 'Perforation', issueDate: 'Issue date',
    purchaseDate: 'Purchase date', purchasePrice: 'Purchase price', estimatedValue: 'Estimated value',
    widthMm: 'Width', heightMm: 'Height', photos: 'Photos',
  };
  return map[f] ?? f;
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.md, paddingBottom: 48 },
  headerSave: { fontSize: 17, fontWeight: '600', color: colors.accent },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  small: { fontSize: 12, color: colors.textSecondary },
  label: { fontSize: 13, fontWeight: '500', color: colors.text },
  twoCol: { flexDirection: 'row', gap: space.md },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44,
    paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control,
  },
  listText: { fontSize: 15, color: colors.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 10,
    borderRadius: 16, backgroundColor: colors.accentSoft,
  },
  tagText: { fontSize: 13, color: colors.accentPressed },
});

