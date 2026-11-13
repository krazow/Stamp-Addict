// Backup and restore in the browser: saving the backup file, reading one
// back, and the copies kept in the browser before each restore.
import { backupFileName, createBackupZip, readBackupZip, restoreBackup } from './backup.js';
import { files } from './idb.js';
import { deletePhoto, readPhoto, storedPhotoPaths, writePhoto } from './photos.js';
import { META_LAST_BACKUP } from './repos.js';
import { chooseFile, giveFile } from './ui.js';

export const APP_VERSION = '0.5.0';
const SAFETY_COPIES_KEPT = 3;

let copyNames = [];
export async function loadSafetyCopies() {
  copyNames = (await files.keys('backups')).sort((a, b) => b.localeCompare(a));
}
export const safetyCopies = () => [...copyNames];

const makeBackup = (db) => createBackupZip(db, { readPhoto }, { appVersion: APP_VERSION });

/** Makes a backup and hands it to the user. Returns null if they cancel. */
export async function saveBackup(repos) {
  const made = await makeBackup(repos.db);
  const ok = await giveFile(backupFileName(), new Blob([made.bytes], { type: 'application/zip' }));
  if (!ok) return null;
  repos.db.setMeta(META_LAST_BACKUP, new Date().toISOString());
  return made;
}

/** Lets the user choose a backup file and checks it. Null if they cancel; throws BackupError for a bad file. */
export async function pickBackup() {
  const file = await chooseFile('.zip,application/zip,application/x-zip-compressed');
  if (!file) return null;
  return readBackupZip(new Uint8Array(await file.arrayBuffer()));
}

/** Replaces the collection with a backup, after keeping a copy of the current one. */
export async function restoreFromBackup(repos, backup) {
  const db = repos.db;
  if (db.rows('stamps').length > 0) {
    const made = await makeBackup(db);
    const name = `Before restore ${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    await files.put('backups', name, new Blob([made.bytes], { type: 'application/zip' }));
    await loadSafetyCopies();
    for (const old of copyNames.slice(SAFETY_COPIES_KEPT)) await files.delete('backups', old).catch(() => {});
    await loadSafetyCopies();
  }
  const summary = await restoreBackup(db, backup, { writePhoto });
  await db.flush();
  const used = new Set(db.rows('photos').map((p) => p.uri));
  for (const path of storedPhotoPaths()) if (!used.has(path)) deletePhoto(path);
  return summary;
}

export async function saveSafetyCopy(name) {
  const blob = await files.get('backups', name);
  if (blob) await giveFile(name, blob);
}

export function lastBackupAt(repos) {
  const v = repos.db.getMeta(META_LAST_BACKUP);
  return v ? new Date(v) : null;
}

/** True when there's something to lose and no backup in the last 30 days. */
export function backupIsDue(repos) {
  if (!repos.db.rows('stamps').length) return false;
  const last = lastBackupAt(repos);
  return !last || Date.now() - last.getTime() > 30 * 24 * 60 * 60 * 1000;
}
