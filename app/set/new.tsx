import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { ValidationError, parseSetItems } from '../../src/core';
import { getStore } from '../../src/data/store';
import { Button, Field } from '../../src/ui/controls';
import { toNumber } from '../../src/ui/format';
import { colors, space } from '../../src/ui/theme';

export default function NewSetScreen() {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [items, setItems] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    try {
      getStore().sets.create({ name, country: country || null, year: toNumber(year), items: parseSetItems(items) });
      router.back();
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message.replace(/^items:\s*/, '').replace(/^name:\s*/, 'Set name '));
      else Alert.alert('Couldn\'t save the set', String(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Field label="Set name" value={name} onChangeText={setName} placeholder="1869 Pictorial Issue" />
        <Field label="Country" value={country} onChangeText={setCountry} placeholder="United States" />
        <Field label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" placeholder="1869" />
        <Field
          label="Stamps in the set"
          value={items}
          onChangeText={setItems}
          multiline
          placeholder={'1c Franklin | Scott 112\n2c Post Rider | Scott 113\n3c Locomotive | Scott 114'}
          hint="One stamp per line. Add | and a catalog number (Scott 112, SG 2, Michel 28) so stamps you own fill in automatically."
          style={{ minHeight: 160 }}
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Button title="Save set" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: 48 },
  error: { fontSize: 14, color: colors.danger },
});

