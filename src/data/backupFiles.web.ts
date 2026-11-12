/**
 * Web version of backupFiles.ts. Same backup zip as the phone, so a backup
 * made on either one restores on the other. Backups are saved with the
 * browser's "Save as" dialog; safety copies made before a restore are kept
 * in the browser's IndexedDB.
 */
import Constants from 'expo-constants';
import {
  META_LAST_BACKUP, backupFileName, createBackupZip, readBackupZip, restoreBackup,
  type BackupSummary, type ParsedBackup,
} from '../core';
import { deletePhotoFile, storePhoto, storedPhotoPaths } from './photos.web';
import { getStore } from './store';
import { blobBytes, chooseFile, mimeForName, saveFile, webStore } from './webStorage';

const SAFETY_COPIES_KEPT = 3;

/** A "before restore" copy kept in the browser. */
export interface SafetyCopy {
  name: string;
}

let copyNames: string[] = [];

/** Loads the list of safety copies. Called once at start-up. */
export async function loadSafetyCopies(): Promise<void> {
  copyNames = (await webStore.keys('backups')).sort((a, b) => b.localeCompare(a));
}

async function readPhoto(path: string): Promise<Uint8Array | null> {
  try {
    const blob = await webStore.get('photos', path);
    return blob ? await blobBytes(blob) : null;
  } catch {
    return null;
  }
}

async function writePhoto(path: string, bytes: Uint8Array): Promise<void> {
  await storePhoto(path, new Blob([bytes as BlobPart], { type: mimeForName(path) }));
}

async function makeBackup() {
  return createBackupZip(getStore().db, { readPhoto }, { appVersion: Constants.expoConfig?.version ?? null });
}

/** Makes a backup and saves it where the user chooses. */
export async function shareBackup(): Promise<{ summary: BackupSummary; missingPhotos: string[] }> {
  const created = await makeBackup();
  const saved = await saveFile(backupFileName(), new Blob([created.bytes as BlobPart], { type: 'application/zip' }));
  // Cancelled "Save as": nothing saved, so don't count it as a backup.
  if (!saved) return { summary: created.manifest.counts, missingPhotos: [] };
  getStore().meta.set(META_LAST_BACKUP, new Date().toISOString());
  return { summary: created.manifest.counts, missingPhotos: created.missingPhotos };
}

/** Lets the user choose a backup file and checks it. Null if they cancel. */
export async function pickBackup(): Promise<ParsedBackup | null> {
  const file = await chooseFile('.zip,application/zip,application/x-zip-compressed');
  if (!file) return null;
  return readBackupZip(await blobBytes(file));
}

export async function restoreFromBackup(backup: ParsedBackup): Promise<BackupSummary> {
  const store = getStore();
  if (store.stamps.list({ limit: 1 }).length > 0) {
    const created = await makeBackup();
    const name = `Before restore ${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    await webStore.put('backups', name, new Blob([created.bytes as BlobPart], { type: 'application/zip' }));
    await loadSafetyCopies();
    for (const old of copyNames.slice(SAFETY_COPIES_KEPT)) await webStore.delete('backups', old).catch(() => {});
    await loadSafetyCopies();
  }
  const summary = await restoreBackup(store.db, backup, { writePhoto });
  removeUnusedPhotoFiles();
  return summary;
}

export function safetyCopies(): SafetyCopy[] {
  return copyNames.map((name) => ({ name }));
}

function removeUnusedPhotoFiles(): void {
  try {
    const used = new Set(getStore().db.all<{ uri: string }>('SELECT uri FROM photos').map((r) => r.uri));
    for (const path of storedPhotoPaths()) if (!used.has(path)) deletePhotoFile(path);
  } catch {
    // Leftover photos only cost space.
  }
}

/** Saves a safety copy to a file of the user's choice. */
export async function shareFile(copy: SafetyCopy): Promise<void> {
  const blob = await webStore.get('backups', copy.name);
  if (blob) await saveFile(copy.name, blob);
}

export function lastBackupAt(): Date | null {
  const v = getStore().meta.get(META_LAST_BACKUP);
  return v ? new Date(v) : null;
}

export function backupIsDue(): boolean {
  const hasStamps = getStore().stamps.list({ limit: 1 }).length > 0;
  if (!hasStamps) return false;
  const last = lastBackupAt();
  return !last || Date.now() - last.getTime() > 30 * 24 * 60 * 60 * 1000;
}
