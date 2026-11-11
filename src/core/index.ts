import type { SqlDatabase } from './db';
import { migrate } from './migrations';
import { SetRepository } from './sets';
import { StampRepository } from './stamps';
import { WantListRepository } from './wantlist';

export * from './db';
export * from './types';
export { migrate } from './migrations';
export { StampRepository } from './stamps';
export { SetRepository } from './sets';
export { WantListRepository } from './wantlist';
export { validateStampInput, parsePerforation, formatPerforation } from './validation';

/** Opens the app's data layer on a database: runs migrations, returns the repositories. */
export function openStampStore(db: SqlDatabase) {
  migrate(db);
  return {
    stamps: new StampRepository(db),
    sets: new SetRepository(db),
    wants: new WantListRepository(db),
  };
}
export { parseSetItems } from './setText';
