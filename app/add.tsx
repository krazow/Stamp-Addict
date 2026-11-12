import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../src/ui/alert';
import { CATALOGS, ValidationError, type Catalog, type StampCardInput } from '../src/core';
import { CameraPermissionError, pickPhoto, type PickedPhoto } from '../src/data/photos';
import { getStore } from '../src/data/store';
import { Button, ChipSelect, Field, StampThumb, optionsOf } from '../src/ui/controls';
import { toNumber } from '../src/ui/format';
import { colors, radius, space } from '../src/ui/theme';

const MAIN_CATALOGS = optionsOf(CATALOGS).filter((o) => o.value !== 'other');

export default function AddStampScreen() {
  const [front, setFront] = useState<PickedPhoto | null>(null);
  const [back, setBack] = useState<PickedPhoto | null>(null);
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [faceValue, setFaceValue] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>('scott');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<{ field: string; message: string } | null>(null);

  useEffect(() => {
    setKnownTags(getStore().stamps.allTags().map((t) => t.name));
  }, []);

  const choosePhoto = (side: 'front' | 'back') => {
    const run = async (source: 'camera' | 'library') => {
      try {
        const photo = await pickPhoto(source);
        if (photo) (side === 'front' ? setFront : setBack)(photo);
      } catch (e) {
        if (e instanceof CameraPermissionError) {
          Alert.alert('Camera not allowed', 'Turn on camera access for Stamp Addict in your phone\'s Settings, or pick a photo from your library.');
        } else {
          Alert.alert('Couldn\'t add the photo', String(e));
        }
      }
    };
    Alert.alert(side === 'front' ? 'Front photo' : 'Back photo', undefined, [
      { text: 'Take photo', onPress: () => run('camera') },
      { text: 'Choose from library', onPress: () => run('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const toggleTag = (name: string) =>
    setTags((cur) => (cur.includes(name) ? cur.filter((t) => t !== name) : [...cur, name]));

  const addNewTag = () => {
    const name = newTag.trim();
    if (!name) return;
    if (!knownTags.some((t) => t.toLowerCase() === name.toLowerCase())) setKnownTags([...knownTags, name]);
    if (!tags.some((t) => t.toLowerCase() === name.toLowerCase())) setTags([...tags, name]);
    setNewTag('');
  };

  const reset = () => {
    setFront(null); setBack(null); setCountry(''); setYear(''); setFaceValue('');
    setCatalogNumber(''); setTags([]); setError(null);
  };

  /** Saves the card; returns its id, or null if something needs fixing. */
  const save = (): string | null => {
    const input: StampCardInput = {
      country: country || null,
      year: toNumber(year),
      faceValue: faceValue || null,
      tags,
      photos: [
        ...(front ? [{ role: 'front' as const, ...front }] : []),
        ...(back ? [{ role: 'back' as const, ...back }] : []),
      ],
      catalogNumbers: catalog && catalogNumber.trim() ? [{ catalog, number: catalogNumber.trim() }] : [],
    };
    try {
      const store = getStore();
      const card = store.stamps.create(input);
      setError(null);
      offerWantCheckOff(card.id);
      return card.id;
    } catch (e) {
      if (e instanceof ValidationError) {
        setError({ field: e.field, message: e.message.replace(/^[^:]+:\s*/, '') });
        return null;
      }
      Alert.alert('Couldn\'t save the stamp', String(e));
      return null;
    }
  };

  const errorFor = (field: string) => (error?.field === field ? error.message : null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.photos}>
          <PhotoSlot label="Front" photo={front} onPress={() => choosePhoto('front')} />
          <PhotoSlot label="Back" photo={back} onPress={() => choosePhoto('back')} />
        </View>
        <Text style={s.note}>Everything is optional. You can save with just a photo and add details later.</Text>

        <Field label="Country" value={country} onChangeText={setCountry} placeholder="United States" autoCapitalize="words" />
        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Year" value={year} onChangeText={setYear} placeholder="1869" keyboardType="number-pad" error={errorFor('year')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Face value" value={faceValue} onChangeText={setFaceValue} placeholder="3c" />
          </View>
        </View>

        <ChipSelect label="Catalog" options={MAIN_CATALOGS} value={catalog} onChange={setCatalog} />
        <Field
          label="Catalog number"
          value={catalogNumber}
          onChangeText={setCatalogNumber}
          placeholder="114"
          autoCapitalize="characters"
          error={errorFor('catalogNumbers[0].number')}
        />

        <View style={{ gap: 6 }}>
          <Text style={s.label}>Tags</Text>
          <View style={s.tagRow}>
            {knownTags.map((t) => {
              const on = tags.includes(t);
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => toggleTag(t)}
                  style={[s.tag, on && s.tagOn]}
                >
                  <Text style={[s.tagText, on && { color: colors.accentPressed, fontWeight: '600' }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="New tag" value={newTag} onChangeText={setNewTag} placeholder="Birds" onSubmitEditing={addNewTag} returnKeyType="done" />
            </View>
            <View style={{ justifyContent: 'flex-end' }}>
              <Button title="Add" variant="secondary" onPress={addNewTag} />
            </View>
          </View>
        </View>

        {error && !['year', 'catalogNumbers[0].number'].includes(error.field) ? (
          <Text style={s.error}>{error.message}</Text>
        ) : null}

        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button title="Save" onPress={() => { const id = save(); if (id) router.replace(`/stamp/${id}`); }} />
          <Button title="Save and add another" variant="secondary" onPress={() => { if (save()) reset(); }} />
          <Button title="Save and add more details" variant="text" onPress={() => { const id = save(); if (id) router.replace(`/stamp/edit/${id}`); }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PhotoSlot({ label, photo, onPress }: { label: string; photo: PickedPhoto | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${photo ? 'Change' : 'Add'} ${label.toLowerCase()} photo`} onPress={onPress} style={{ alignItems: 'center', gap: 6 }}>
      {photo ? (
        <StampThumb uri={photo.uri} width={120} height={150} />
      ) : (
        <View style={s.addPhoto}>
          <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
          <Text style={s.addPhotoText}>Add</Text>
        </View>
      )}
      <Text style={s.photoLabel}>{label}</Text>
    </Pressable>
  );
}

/** If the new stamp fills something on the want list, offer to check it off. */
function offerWantCheckOff(stampId: string) {
  const store = getStore();
  const matches = store.wants.matchesForStamp(stampId);
  if (!matches.length) return;
  Alert.alert(
    'On your want list',
    `This stamp matches: ${matches.map((m) => m.description).join(', ')}. Check it off?`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Check off', onPress: () => matches.forEach((m) => store.wants.markAcquired(m.id, stampId)) },
    ],
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: 48 },
  photos: { flexDirection: 'row', gap: space.lg },
  addPhoto: {
    width: 120, height: 150, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.placeholderBorder, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPhotoText: { fontSize: 13, color: colors.textSecondary },
  photoLabel: { fontSize: 12, color: colors.textSecondary },
  note: { fontSize: 13, color: colors.textSecondary },
  twoCol: { flexDirection: 'row', gap: space.md },
  label: { fontSize: 13, fontWeight: '500', color: colors.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: {
    minHeight: 36, paddingHorizontal: 12, borderRadius: radius.chip, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center',
  },
  tagOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tagText: { fontSize: 14, color: colors.text },
  error: { fontSize: 14, color: colors.danger },
});
