// Reading the printed text on a stamp photo, on the device.
const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
let worker = null;
let seq = 0;
const waiting = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ocr-worker.js', import.meta.url));
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data);
    };
    worker.onerror = (e) => {
      for (const w of waiting.values()) w.reject(new Error(e.message || 'The text reader stopped.'));
      waiting.clear();
      worker = null;
    };
  }
  return worker;
}

/** Greyscale, sized for reading (long side about 1800 px), as PNG bytes. */
async function prepare(blob) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = Math.min(2, 1800 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.25)';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const png = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  return new Uint8Array(await png.arrayBuffer());
}

/** Resolves { text, confidence }. The first call downloads the reader (about 5 MB). */
export async function readStampText(blob) {
  const image = await prepare(blob);
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, base: BASE, image, psm: 11 }, [image.buffer]);
  });
}
