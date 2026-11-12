// Browser storage (IndexedDB): the collection's tables, device settings,
// photos, and the copies kept before each restore.

const DB_NAME = 'stamp-addict';
const STORES = ['tables', 'meta', 'photos', 'backups'];
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Stamp Addict is open in another tab that needs to close first.'));
    });
  }
  return dbp;
}

/** Runs fn(stores) in one transaction; resolves when it's committed. */
async function tx(names, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
    let result;
    Promise.resolve(fn(stores)).then((r) => { result = r; }, (e) => { t.abort(); reject(e); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Saving was cancelled'));
  });
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** Everything needed at start-up: tables and settings. */
export async function loadAll() {
  return tx(['tables', 'meta'], 'readonly', async ({ tables, meta }) => {
    const [tKeys, tVals, mKeys, mVals] = await Promise.all([
      req(tables.getAllKeys()), req(tables.getAll()), req(meta.getAllKeys()), req(meta.getAll()),
    ]);
    return {
      tables: Object.fromEntries(tKeys.map((k, i) => [k, tVals[i]])),
      meta: Object.fromEntries(mKeys.map((k, i) => [k, mVals[i]])),
    };
  });
}

/** Saver for store.js: writes changed tables (and settings) in one transaction. */
export function saveChanges({ tables, meta }) {
  return tx(['tables', 'meta'], 'readwrite', ({ tables: ts, meta: ms }) => {
    for (const [name, rows] of Object.entries(tables)) ts.put(rows, name);
    if (meta) {
      ms.clear();
      for (const [k, v] of Object.entries(meta)) ms.put(v, k);
    }
  });
}

export const files = {
  get: (store, key) => tx([store], 'readonly', (s) => req(s[store].get(key))),
  put: (store, key, blob) => tx([store], 'readwrite', (s) => { s[store].put(blob, key); }),
  delete: (store, key) => tx([store], 'readwrite', (s) => { s[store].delete(key); }),
  keys: (store) => tx([store], 'readonly', (s) => req(s[store].getAllKeys())).then((k) => k.map(String)),
  entries: (store) => tx([store], 'readonly', async (s) => {
    const [k, v] = await Promise.all([req(s[store].getAllKeys()), req(s[store].getAll())]);
    return k.map((key, i) => [String(key), v[i]]);
  }),
};

/** Asks the browser not to clear this site's data when the disk fills up. */
export async function askForPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist();
    return true;
  } catch {
    return false;
  }
}
