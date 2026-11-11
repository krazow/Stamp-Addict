import * as Crypto from 'expo-crypto';
import { openStampStore, setIdGenerator } from '../core';
import { openExpoDatabase } from '../core/adapters/expo-sqlite';

type Store = ReturnType<typeof openStampStore>;
let store: Store | null = null;

/** The app's one data store, opened (and migrated) on first use. */
export function getStore(): Store {
  if (!store) {
    setIdGenerator(() => Crypto.randomUUID());
    store = openStampStore(openExpoDatabase());
  }
  return store;
}
