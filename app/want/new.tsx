import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Alert } from '../../src/ui/alert';
import { CATALOGS, MINT_STATUSES, PRIORITIES, ValidationError, type Catalog, type MintStatus, type Priority } from '../../src/core';
import { getStore } from '../../src/data/store';
import { Button, ChipSelect, Field, optionsOf } from '../../src/ui/controls';
import { toNumber } from '../../src/ui/format';
import { colors, space } from '../../src/ui/theme';

export default function NewWantScreen() {
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>('scott');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [condition, setCondition] = useState<MintStatus | null>(null);
  const [maxPrice, setMaxPrice] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    try {
      getStore().wants.add({
        description,
        country: country || null,
        year: toNumber(year),
        catalog: catalogNumber.trim() ? catalog : null,
        catalogNumber: catalogNumber.trim() || null,
        wantedCondition: condition,
        maxPrice: toNumber(maxPrice),
        priority,
        notes: notes || null,
      });
      router.back();
    } catch (e) {
      if (e instanceof ValidationError) {
        setError(e.field === 'description' ? 'Describe the stamp you want.' : e.message);
      } else {
        Alert.alert('Couldn\'t save', String(e));
      }
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Field label="What are you looking for?" value={description} onChangeText={setDescription} placeholder="Inverted Jenny" error={error} />
        <Field label="Country" value={country} onChangeText={setCountry} />
        <Field label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" />
        <ChipSelect label="Catalog" options={optionsOf(CATALOGS).filter((o) => o.value !== 'other')} value={catalog} onChange={setCatalog} />
        <Field
          label="Catalog number"
          value={catalogNumber}
          onChangeText={setCatalogNumber}
          autoCapitalize="characters"
          hint="With a catalog number, the app spots this want when you add the stamp."
        />
        <ChipSelect label="Condition wanted" options={optionsOf(MINT_STATUSES)} value={condition} onChange={setCondition} />
        <Field label="Most you'd pay" value={maxPrice} onChangeText={setMaxPrice} keyboardType="decimal-pad" />
        <ChipSelect label="Priority" options={optionsOf(PRIORITIES)} value={priority} onChange={(v) => v && setPriority(v)} allowClear={false} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        {error && error !== 'Describe the stamp you want.' ? <Text style={s.error}>{error}</Text> : null}
        <Button title="Save" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: 48 },
  error: { fontSize: 14, color: colors.danger },
});
