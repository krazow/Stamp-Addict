/**
 * Browser-only helpers for the web version: a small IndexedDB key-value
 * store (photos and safety copies live here; the stamp records live in
 * expo-sqlite's own browser database), plus file open and save dialogs.
 */

export type WebStoreName = 'photos' | 'backups';

const DB_NAME = 'stamp-addict-files';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
        if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request<T>(store: WebStoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error('Storage write was cancelled'));
      }),
  );
}

export const webStore = {
  get: (store: WebStoreName, key: string) => request<Blob | undefined>(store, 'readonly', (s) => s.get(key)),
  put: (store: WebStoreName, key: string, value: Blob) => request<void>(store, 'readwrite', (s) => s.put(value, key)),
  delete: (store: WebStoreName, key: string) => request<void>(store, 'readwrite', (s) => s.delete(key)),
  keys: async (store: WebStoreName) => (await request<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys())).map(String),
};

/** Asks the browser to keep this site's data even when the disk gets full. */
export async function askForPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Only a request; the app works either way.
  }
}

/**
 * Opens the browser's file chooser. Resolves null if the user cancels.
 * `capture` asks phone browsers to open the camera directly.
 */
export function chooseFile(accept: string, capture = false): Promise<globalThis.File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    let settled = false;
    const finish = (file: globalThis.File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };
    // Browsers without the 'cancel' event: when the window regains focus
    // and no file arrived shortly after, treat it as a cancel.
    const onFocus = () => setTimeout(() => finish(input.files?.[0] ?? null), 1000);
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

type SavePicker = (o: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;

/**
 * Saves a file. Edge and Chrome show a "Save as" dialog; other browsers
 * download it to the Downloads folder. Returns false if the user cancels.
 */
export async function saveFile(name: string, blob: Blob): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: 'Stamp Addict backup', accept: { 'application/zip': ['.zip'] } }],
      });
      const out = await handle.createWritable();
      await out.write(blob);
      await out.close();
      return true;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return false;
      // Some setups block the picker; fall back to a normal download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function mimeForName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : ext === 'gif' ? 'image/gif'
    : ext === 'heic' ? 'image/heic'
    : ext === 'zip' ? 'application/zip'
    : 'image/jpeg';
}
