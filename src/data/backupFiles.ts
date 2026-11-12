import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  META_LAST_BACKUP, backupFileName, createBackupZip, readBackupZip, restoreBackup,
  type BackupSummary, type ParsedBackup,
} from '../core';
import { getStore } from './store';

/** How many "before restore" safety copies to keep on the phone. */
const SAFETY_COPIES_KEPT = 3;

async function readPhoto(path: string): Promise<Uint8Array | null> {
  const file = new File(Paths.document, path);
  return file.exists ? await file.bytes() : null;
}

// File.write() returns a promise from SDK 58 on (it returned nothing before),
// so it's always awaited; awaiting a non-promise is harmless on older SDKs.
async function writePhoto(path: string, bytes: Uint8Array): Promise<void> {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create();
  const file = new File(dir, path.slice('photos/'.length));
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
}

function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create();
  return dir;
}

async function writeBackupFile(dir: Directory, name: string) {
  const created = await createBackupZip(getStore().db, { readPhoto }, { appVersion: Constants.expoConfig?.version ?? null });
  const file = new File(ensureDir(dir), name);
  if (file.exists) file.delete();
  file.create();
  await file.write(created.bytes);
  return { file, created };
}

/**
 * Makes a backup file and opens the phone's share sheet so the user can
 * save it somewhere safe (Files, iCloud Drive, Google Drive, email…).
 */
export async function shareBackup(): Promise<{ summary: BackupSummary; missingPhotos: string[] }> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('This device can\'t share files.');
  }
  const { file, created } = await writeBackupFile(new Directory(Paths.cache, 'backups'), backupFileName());
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
    dialogTitle: 'Save your Stamp Addict backup',
  });
  getStore().meta.set(META_LAST_BACKUP, new Date().toISOString());
  return { summary: created.manifest.counts, missingPhotos: created.missingPhotos };
}

/** Lets the user choose a backup file and checks it. Null if they cancel. Throws BackupError for a bad file. */
export async function pickBackup(): Promise<ParsedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const bytes = await new File(result.assets[0].uri).bytes();
  return readBackupZip(bytes);
}

/**
 * Replaces the collection with a backup. First saves a safety copy of the
 * current collection on the phone, so a restore can be undone.
 */
export async function restoreFromBackup(backup: ParsedBackup): Promise<BackupSummary> {
  const store = getStore();
  const stampCount = store.stamps.list({ limit: 1 }).length;
  if (stampCount > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeBackupFile(new Directory(Paths.document, 'backups'), `Before restore ${stamp}.zip`);
    pruneSafetyCopies();
  }
  const summary = await restoreBackup(store.db, backup, { writePhoto });
  removeUnusedPhotoFiles();
  return summary;
}

/** The safety copies saved before each restore, newest first. */
export function safetyCopies(): File[] {
  try {
    const dir = new Directory(Paths.document, 'backups');
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((x): x is File => x instanceof File && x.name.endsWith('.zip'))
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

function pruneSafetyCopies(): void {
  safetyCopies().slice(SAFETY_COPIES_KEPT).forEach((f) => {
    try { f.delete(); } catch { /* not worth failing over */ }
  });
}

/** After a restore, photo files no record uses any more are deleted to free space. */
function removeUnusedPhotoFiles(): void {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) return;
    const used = new Set(
      getStore().db.all<{ uri: string }>('SELECT uri FROM photos').map((r) => r.uri),
    );
    for (const item of dir.list()) {
      if (item instanceof File && !used.has(`photos/${item.name}`)) item.delete();
    }
  } catch {
    // Leftover files only cost space; never fail a restore over them.
  }
}

/** Shares a safety copy, so it can be restored or kept elsewhere. */
export async function shareFile(file: File): Promise<void> {
  await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive' });
}

export function lastBackupAt(): Date | null {
  const v = getStore().meta.get(META_LAST_BACKUP);
  return v ? new Date(v) : null;
}

/** True when there's something to lose and no backup in the last 30 days. */
export function backupIsDue(): boolean {
  const hasStamps = getStore().stamps.list({ limit: 1 }).length > 0;
  if (!hasStamps) return false;
  const last = lastBackupAt();
  return !last || Date.now() - last.getTime() > 30 * 24 * 60 * 60 * 1000;
}
