// Smoke test: opens the app in a real browser and checks the main things work.
// Edit CHECKS below for this app's own important actions. Run with: npm test
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync('release.json', 'utf8'));
const SITE = path.resolve(cfg.site || '.');
const APP = path.relative(SITE, path.resolve(cfg.app || cfg.site || '.')).split(path.sep).join('/');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let f = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/${APP && APP !== '.' ? APP + '/' : ''}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}

await page.goto(URL_, { waitUntil: 'load' });

const CHECKS = [
  ['the app opens without errors', async () => { await page.waitForTimeout(1000); if (errors.length) throw new Error(errors.join('; ')); }],
  ['the page has a title', async () => { if (!(await page.title())) throw new Error('empty <title>'); }],
  ['the service worker installs (offline use)', async () => {
    const ok = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]));
    if (!ok) throw new Error('no active service worker after 8 s');
  }],
  ['it still opens offline', async () => {
    await page.context().setOffline(true);
    try { await page.reload({ waitUntil: 'load' }); } finally { await page.context().setOffline(false); }
  }],
  ['the app shows its name', async () => {
    await page.waitForTimeout(500);
    if (!/Stamp Addict/i.test(await page.textContent('body') + await page.title())) throw new Error('"Stamp Addict" not on the page');
  }],
  ['no errors after starting up', async () => { if (errors.length) throw new Error(errors.join('; ')); }],
];
for (const [name, fn] of CHECKS) await check(name, fn);

await browser.close();
server.close();
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('All smoke checks passed');
