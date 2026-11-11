import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { photoSource } from '../data/photos';
import { colors, radius, space } from './theme';

export function Button({
  title, onPress, variant = 'primary', icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, v.box, pressed && { opacity: 0.75 }]}
    >
      {icon ? <Ionicons name={icon} size={18} color={v.text.color} /> : null}
      <Text style={[styles.buttonText, v.text]}>{title}</Text>
    </Pressable>
  );
}

const buttonVariants = {
  primary: { box: { backgroundColor: colors.accent }, text: { color: '#FFFFFF' } },
  secondary: { box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
  text: { box: { backgroundColor: 'transparent' }, text: { color: colors.accent } },
  danger: { box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.dangerBorder }, text: { color: colors.danger } },
};

export function Field({
  label, hint, error, style, ...input
}: { label: string; hint?: string; error?: string | null } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8C8A82"
        {...input}
        style={[styles.input, input.multiline && styles.inputMultiline, error ? { borderColor: colors.danger } : null, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export interface ChipOption<T extends string> { value: T; label: string }

/** A row of tappable choices. Tapping the chosen one again clears it (every field is optional). */
export function ChipSelect<T extends string>({
  label, options, value, onChange, allowClear = true,
}: {
  label?: string;
  options: ChipOption<T>[];
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  allowClear?: boolean;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipRow}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected && allowClear ? null : o.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Turns a pick list from core/types into chip options. */
export function optionsOf<T extends string>(list: { values: T[]; labels: Record<string, string> }): ChipOption<T>[] {
  return list.values.map((v) => ({ value: v, label: list.labels[v] }));
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.field, styles.toggleRow]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} accessibilityLabel={label} />
    </View>
  );
}

/** A card with a title that opens and closes. */
export function Section({
  title, hint, initiallyOpen = false, children,
}: { title: string; hint?: string; initiallyOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.sectionHeader}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {hint && !open ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export function StampThumb({ uri, width, height }: { uri?: string | null; width: number; height: number }) {
  const src = photoSource(uri);
  if (src) {
    return <Image source={src} style={{ width, height, borderRadius: 6, backgroundColor: colors.placeholder }} resizeMode="cover" />;
  }
  return (
    <View style={[styles.thumbEmpty, { width, height }]}>
      <Ionicons name="image-outline" size={Math.min(28, width / 3)} color="#8C8A82" />
    </View>
  );
}

export function Pill({ text, tone = 'plain' }: { text: string; tone?: 'plain' | 'accent' }) {
  return (
    <View style={[styles.pill, tone === 'accent' && { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
      <Text style={[styles.pillText, tone === 'accent' && { color: colors.accentPressed, fontWeight: '500' }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 48, borderRadius: radius.card, paddingHorizontal: space.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500', color: colors.text },
  input: {
    minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control,
    paddingHorizontal: space.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 88, paddingTop: space.md, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.textSecondary },
  error: { fontSize: 13, color: colors.danger },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: radius.chip, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.accentPressed, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  toggleLabel: { fontSize: 15, color: colors.text },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card },
  sectionHeader: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 14 },
  thumbEmpty: {
    borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.placeholderBorder,
    backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  pillText: { fontSize: 13, color: colors.text },
  empty: { alignItems: 'center', padding: 32, gap: space.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
