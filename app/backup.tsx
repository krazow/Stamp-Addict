import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../src/ui/alert';
import { BackupError, summarizeDatabase, type BackupSummary } from '../src/core';
import {
  backupIsDue, lastBackupAt, pickBackup, restoreFromBackup, safetyCopies, shareBackup, shareFile,
} from '../src/data/backupFiles';
import { getStore } from '../src/data/store';
import { Button } from '../src/ui/controls';
import { colors, radius, space } from '../src/ui/theme';

/** "this phone" in the phone app, "this browser" in the web version. */
const here = Platform.OS === 'web' ? 'this browser' : 'this phone';

function describe(s: BackupSummary): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [part(s.stamps, 'stamp', 'stamps'), part(s.photos, 'photo', 'photos'), part(s.sets, 'set', 'sets'), part(s.wants, 'want', 'wants')].join(', ');
}

function when(d: Date | null): string {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return days === 0 ? `Today (${date})` : days === 1 ? `Yesterday (${date})` : `${days} days ago (${date})`;
}

export default function BackupScreen() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [last, setLast] = useState<Date | null>(null);
  const [due, setDue] = useState(false);
  const [copies, setCopies] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setSummary(summarizeDatabase(getStore().db));
    setLast(lastBackupAt());
    setDue(backupIsDue());
    setCopies(safetyCopies().length);
  }, []);
  useFocusEffect(load);

  const backUp = async () => {
    setBusy('Making your backup…');
    try {
      const { missingPhotos } = await shareBackup();
      if (missingPhotos.length) {
        Alert.alert(
          'Backup made, with gaps',
          `${missingPhotos.length} ${missingPhotos.length === 1 ? 'photo was' : 'photos were'} missing from ${here} and couldn't be included. Everything else is in the backup.`,
        );
      }
    } catch (e) {
      Alert.alert('Couldn\'t make the backup', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      load();
    }
  };

  const restore = async () => {
    let backup;
    setBusy('Reading the backup…');
    try {
      backup = await pickBackup();
    } catch (e) {
      setBusy(null);
      Alert.alert('Can\'t use this file', e instanceof BackupError ? e.message : String(e));
      return;
    }
    setBusy(null);
    if (!backup) return;
    const chosen = backup;

    const made = chosen.manifest.createdAt ? new Date(backup.manifest.createdAt).toLocaleString() : 'an unknown date';
    const gaps = chosen.missingPhotos.length ? `\n\n${chosen.missingPhotos.length} photos are missing from this file.` : '';
    const current = summary && summary.stamps > 0
      ? `\n\nThis replaces the ${summary.stamps} stamps in the app now. A copy of them is saved in ${here} first.`
      : '';
    Alert.alert('Restore this backup?', `Made ${made}: ${describe(chosen.manifest.counts)}.${current}${gaps}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: async () => {
          setBusy('Restoring…');
          try {
            const result = await restoreFromBackup(chosen);
            Alert.alert('Restored', `Your collection now has ${describe(result)}.`);
          } catch (e) {
            Alert.alert('Restore failed', e instanceof BackupError ? e.message : `${String(e)}\n\nYour collection was not changed.`);
          } finally {
            setBusy(null);
            load();
          }
        },
      },
    ]);
  };

  const shareSafetyCopy = async () => {
    const [latest] = safetyCopies();
    if (latest) await shareFile(latest);
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardLabel}>Your collection</Text>
        <Text style={s.cardValue}>{summary ? describe(summary) : '…'}</Text>
        <Text style={s.cardLabel}>Last backup</Text>
        <Text style={[s.cardValue, due && { color: colors.danger }]}>{when(last)}</Text>
      </View>

      <Text style={s.body}>
        {Platform.OS === 'web'
          ? 'Your collection is stored only in this browser on this computer. Clearing the browser\'s site data deletes it. A backup is one file holding every Stamp Card, photo, set and want. Save it somewhere safe, such as OneDrive, Google Drive or a USB drive. The same file restores on a phone.'
          : 'Your collection is stored only on this phone. A backup is one file holding every Stamp Card, photo, set and want. Save it somewhere off the phone: Files, iCloud Drive, Google Drive, or email it to yourself.'}
      </Text>

      {busy ? (
        <View style={s.busy}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.body}>{busy}</Text>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title="Back up now" icon="cloud-upload-outline" onPress={backUp} />
          <Button title="Restore from a backup" variant="secondary" icon="cloud-download-outline" onPress={restore} />
        </View>
      )}

      <View style={s.tips}>
        <Text style={s.tipTitle}>Good to know</Text>
        <Text style={s.tip}>• The backup also contains stamps.csv, a spreadsheet of your collection you can open in Excel, Google Sheets or Numbers without the app.</Text>
        <Text style={s.tip}>• Restoring replaces everything in the app with the backup. It doesn't merge.</Text>
        <Text style={s.tip}>• Before a restore, the app keeps a copy of your current collection in {here} (the last three).</Text>
        <Text style={s.tip}>• Back up after any big session of adding stamps. The app reminds you after 30 days.</Text>
      </View>

      {copies > 0 && !busy ? (
        <Button title={Platform.OS === 'web' ? 'Save the copy made before the last restore' : 'Share the copy saved before the last restore'} variant="text" onPress={shareSafetyCopy} />
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card,
    padding: space.lg, gap: 4,
  },
  cardLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  cardValue: { fontSize: 16, fontWeight: '500', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  tips: { backgroundColor: colors.accentSofter, borderRadius: radius.card, padding: space.lg, gap: 6 },
  tipTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  tip: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
