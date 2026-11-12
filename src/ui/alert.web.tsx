/**
 * Web stand-in for React Native's Alert, which does nothing in a browser.
 * Same call shape — Alert.alert(title, message?, buttons?) — drawn as an
 * in-page dialog by <AlertHost /> (rendered once in the root layout).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from './theme';

type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type Dialog = { title: string; message?: string; buttons: AlertButton[] };

const queue: Dialog[] = [];
let notify: (() => void) | null = null;

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
    notify?.();
  },
};

export function AlertHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);

  useEffect(() => {
    notify = () => setDialog((cur) => cur ?? queue.shift() ?? null);
    notify();
    return () => {
      notify = null;
    };
  }, []);

  const close = (button?: AlertButton) => {
    setDialog(queue.shift() ?? null);
    button?.onPress?.();
  };

  if (!dialog) return null;
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  // Cancel first, then the rest in order — like Android.
  const ordered = [...dialog.buttons.filter((b) => b.style === 'cancel'), ...dialog.buttons.filter((b) => b.style !== 'cancel')];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(cancel)}>
      <Pressable style={s.backdrop} onPress={() => cancel && close(cancel)}>
        <Pressable style={s.card} accessibilityRole="alert" onPress={() => {}}>
          <Text style={s.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={s.message}>{dialog.message}</Text> : null}
          <View style={s.buttons}>
            {ordered.map((b, i) => {
              const primary = b.style !== 'cancel' && i === ordered.length - 1;
              const danger = b.style === 'destructive';
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  accessibilityRole="button"
                  onPress={() => close(b)}
                  style={({ pressed }) => [
                    s.button,
                    primary && { backgroundColor: danger ? colors.danger : colors.accent, borderColor: danger ? colors.danger : colors.accent },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[s.buttonText, primary ? { color: '#FFFFFF' } : danger && { color: colors.danger }]}>
                    {b.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.card, padding: space.xl, gap: space.md,
    width: '100%', maxWidth: 420,
  },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  message: { fontSize: 15, color: colors.text, lineHeight: 22 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  button: {
    minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.control, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '500', color: colors.text },
});
