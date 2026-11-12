/**
 * Web version of photos.ts. Photos are kept in the browser's IndexedDB
 * under the same relative paths the phone uses ("photos/<name>"), so
 * backups move freely between phone and computer.
 */
import { chooseFile, mimeForName, webStore } from './webStorage';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

export class CameraPermissionError extends Error {}

/** Object URLs for stored photos, so <Image> can show them without waiting. */
const urls = new Map<string, string>();

/** Loads every stored photo's URL. Called once at start-up. */
export async function loadPhotoUrls(): Promise<void> {
  for (const key of await webStore.keys('photos')) {
    const blob = await webStore.get('photos', key);
    if (blob) urls.set(key, URL.createObjectURL(blob));
  }
}

/** Stores a photo under a relative path and makes it showable right away. */
export async function storePhoto(path: string, blob: Blob): Promise<void> {
  await webStore.put('photos', path, blob);
  const old = urls.get(path);
  if (old) URL.revokeObjectURL(old);
  urls.set(path, URL.createObjectURL(blob));
}

export function storedPhotoPaths(): string[] {
  return [...urls.keys()];
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * On a computer both choices open the file chooser; on a phone's browser
 * "camera" opens the camera. There's no crop step on the web.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const file = await chooseFile('image/*', source === 'camera');
  if (!file) return null;
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const ext = /^(jpe?g|png|webp|gif|heic)$/.test(fromName) ? fromName : 'jpg';
  const path = `photos/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const blob = file.type ? file : new Blob([file], { type: mimeForName(path) });
  await storePhoto(path, blob);
  return { uri: path, ...(await imageSize(blob)) };
}

export function photoSource(uri: string | null | undefined): { uri: string } | null {
  if (!uri) return null;
  if (/^(https?|data|blob):/.test(uri)) return { uri };
  const url = urls.get(uri);
  return url ? { uri: url } : null;
}

export function deletePhotoFile(uri: string): void {
  const url = urls.get(uri);
  if (!url) return;
  URL.revokeObjectURL(url);
  urls.delete(uri);
  webStore.delete('photos', uri).catch(() => {
    // Leftover photos only cost space.
  });
}
