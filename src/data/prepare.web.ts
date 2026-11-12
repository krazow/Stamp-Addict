import { loadSafetyCopies } from './backupFiles.web';
import { loadPhotoUrls } from './photos.web';
import { getStore } from './store';
import { askForPersistentStorage } from './webStorage';

export class BrowserNotSupportedError extends Error {}

function addInstallTags(): void {
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  };
  // These let Edge and Chrome offer "Install Stamp Addict" as an app.
  add('link', { rel: 'manifest', href: '/manifest.json' });
  add('link', { rel: 'apple-touch-icon', href: '/icon-192.png' });
  add('meta', { name: 'theme-color', content: '#1F5F8B' });
  document.title = 'Stamp Addict';
}

export async function prepareStorage(): Promise<void> {
  addInstallTags();
  // The browser database needs a "cross-origin isolated" page. The dev
  // server and the hosting headers (public/_headers) provide it.
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    throw new BrowserNotSupportedError(
      'This page is missing the security headers the collection database needs. ' +
        'Start it with "npm run web", or check the hosting headers.',
    );
  }
  await askForPersistentStorage();
  getStore();
  await Promise.all([loadPhotoUrls(), loadSafetyCopies()]);
}
