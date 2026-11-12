// Stamp photos, kept in the browser's IndexedDB under the same relative
// paths the phone app uses ("photos/<name>"), so backups move freely.
import { files } from './idb.js';

const urls = new Map();
const MAX_SIDE = 2400; // plenty for perforations and watermarks, without filling the device

export async function loadPhotoUrls() {
  for (const [path, blob] of await files.entries('photos')) urls.set(path, URL.createObjectURL(blob));
}

export function photoUrl(path) {
  if (!path) return null;
  if (/^(https?|data|blob):/.test(path)) return path;
  return urls.get(path) ?? null;
}

export function storedPhotoPaths() { return [...urls.keys()]; }

export async function storePhoto(path, blob) {
  await files.put('photos', path, blob);
  const old = urls.get(path);
  if (old) URL.revokeObjectURL(old);
  urls.set(path, URL.createObjectURL(blob));
}

export async function readPhoto(path) {
  const blob = await files.get('photos', path);
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

export function mimeFor(path) {
  const ext = path.split('.').pop().toLowerCase();
  return { png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' }[ext] ?? 'image/jpeg';
}

export async function writePhoto(path, bytes) {
  await storePhoto(path, new Blob([bytes], { type: mimeFor(path) }));
}

export function deletePhoto(path) {
  const url = urls.get(path);
  if (url) URL.revokeObjectURL(url);
  urls.delete(path);
  return files.delete('photos', path).catch(() => {});
}

/** Shrinks a big camera photo to MAX_SIDE; small or undecodable images are kept as they are. */
async function prepare(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { blob: file, width: null, height: null, ext: (file.name.split('.').pop() || 'jpg').toLowerCase() };
  }
  const { width, height } = bmp;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const keep = scale === 1 && file.size < 3_000_000 && /^image\/(jpeg|png|webp)$/.test(file.type);
  if (keep) {
    bmp.close();
    return { blob: file, width, height, ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg' };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  return { blob: blob ?? file, width: w, height: h, ext: 'jpg' };
}

/** Saves a chosen image file as a new stamp photo. Returns { uri, width, height }. */
export async function addPhotoFile(file) {
  const p = await prepare(file);
  const ext = /^(jpe?g|png|webp|gif|heic)$/.test(p.ext) ? p.ext.replace('jpeg', 'jpg') : 'jpg';
  const path = `photos/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  await storePhoto(path, p.blob);
  return { uri: path, width: p.width, height: p.height };
}
