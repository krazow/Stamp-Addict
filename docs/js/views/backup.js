import { app, go, refresh } from '../app.js';
import { BackupError, summarizeTables } from '../backup.js';
import {
  backupIsDue, lastBackupAt, pickBackup, restoreFromBackup, safetyCopies, saveBackup, saveSafetyCopy,
} from '../backupfiles.js';
import { ask, button, h, icon, tell } from '../ui.js';

const part = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const describe = (s) => [part(s.stamps, 'stamp', 'stamps'), part(s.photos, 'photo', 'photos'), part(s.sets, 'set', 'sets'), part(s.wants, 'want', 'wants')].join(', ');

function when(d) {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return days === 0 ? `Today (${date})` : days === 1 ? `Yesterday (${date})` : `${days} days ago (${date})`;
}

export function backupView() {
  const repos = app.repos;
  const summary = summarizeTables(repos.db.t);
  const busy = h('div', { class: 'busy', hidden: true }, h('div', { class: 'spinner' }), h('span', {}));
  const actions = h('div', { class: 'stack-tight' });
  const setBusy = (text) => {
    busy.hidden = !text;
    busy.lastChild.textContent = text ?? '';
    actions.hidden = !!text;
  };

  const backUp = async () => {
    setBusy('Making your backup…');
    try {
      const made = await saveBackup(repos);
      if (made?.missingPhotos.length) {
        await tell('Backup made, with gaps', `${part(made.missingPhotos.length, 'photo was', 'photos were')} missing from this device and couldn't be included. Everything else is in the backup.`);
      } else if (made) {
        await tell('Backup saved', `${describe(made.manifest.counts)}. Keep the file somewhere safe, off this device.`);
      }
    } catch (e) {
      tell('Couldn\'t make the backup', String(e?.message ?? e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const restore = async () => {
    let backup;
    try {
      backup = await pickBackup();
    } catch (e) {
      tell('Can\'t use this file', e instanceof BackupError ? e.message : String(e?.message ?? e));
      return;
    }
    if (!backup) return;
    const made = backup.manifest.createdAt ? new Date(backup.manifest.createdAt).toLocaleString() : 'an unknown date';
    const gaps = backup.missingPhotos.length ? ` ${part(backup.missingPhotos.length, 'photo is', 'photos are')} missing from this file.` : '';
    const current = summary.stamps > 0 ? ` This replaces the ${part(summary.stamps, 'stamp', 'stamps')} in the app now. A copy of them is kept on this device first.` : '';
    const yes = await ask('Restore this backup?', `Made ${made}: ${describe(backup.manifest.counts)}.${current}${gaps}`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', value: true },
    ]);
    if (!yes) return;
    setBusy('Restoring…');
    try {
      const result = await restoreFromBackup(repos, backup);
      await tell('Restored', `Your collection now has ${describe(result)}.`);
    } catch (e) {
      tell('Restore failed', e instanceof BackupError ? e.message : `${String(e?.message ?? e)} Your collection was not changed.`);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const copies = safetyCopies();
  actions.append(
    button(h('span', { class: 'with-icon' }, icon('download', 20), 'Back up now'), backUp),
    button('Restore from a backup', restore, 'secondary'),
    button('Import stamps from a spreadsheet (CSV)', () => go('import'), 'text'),
  );

  return {
    title: 'Backup and restore',
    body: h('div', { class: 'stack' },
      h('section', { class: 'card' },
        h('div', { class: 'small muted' }, 'Your collection'), h('div', { class: 'strong' }, describe(summary)),
        h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Last backup'),
        h('div', { class: `strong${backupIsDue(repos) ? ' danger' : ''}` }, when(lastBackupAt(repos)))),
      h('p', {}, 'Your collection is stored only in this browser on this device. Clearing the browser\'s site data deletes it. A backup is one file holding every Stamp Card, photo, set and want. Save it somewhere off this device: OneDrive, Google Drive, a USB drive, or email it to yourself. The same file restores on any device, including the phone version.'),
      actions, busy,
      h('section', { class: 'tips' },
        h('h3', {}, 'Good to know'),
        h('ul', {},
          h('li', {}, 'The backup also contains stamps.csv, a spreadsheet of your collection you can open in Excel, Google Sheets or Numbers without the app.'),
          h('li', {}, 'Restoring replaces everything in the app with the backup. It doesn\'t merge.'),
          h('li', {}, 'Before a restore, the app keeps a copy of your current collection on this device (the last three).'),
          h('li', {}, 'To move your collection to another device: back up here, then restore the file there.'),
          h('li', {}, 'Back up after any big session of adding stamps. The app reminds you after 30 days.'))),
      copies.length ? button('Save the copy made before the last restore', () => saveSafetyCopy(copies[0]), 'text') : null),
  };
}
