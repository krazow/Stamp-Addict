import type { SqlDatabase } from './db';
import { migrate } from './migrations';
import { SetRepository } from './sets';
import { StampRepository } from './stamps';
import { WantListRepository } from './wantlist';
import { MetaRepository } from './meta';

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
    /** The database itself, for backup and export. */
    db,
    stamps: new StampRepository(db),
    sets: new SetRepository(db),
    wants: new WantListRepository(db),
    meta: new MetaRepository(db),
  };
}
export { parseSetItems } from './setText';
export { MetaRepository, META_LAST_BACKUP } from './meta';
export { SCHEMA_VERSION } from './migrations';
export { BackupError, summarizeDatabase, type BackupSummary } from './backup';
export { stampsToCsv } from './csv';
export { createBackupZip, readBackupZip, restoreBackup, backupFileName, type ParsedBackup } from './backupZip';
