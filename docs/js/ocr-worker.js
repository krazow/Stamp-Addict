// Runs Tesseract (vendor/tesseract) in a background thread so the page
// stays responsive. Loaded on first use; the photo never leaves the device.
/* global TesseractCore, importScripts */
let ready = null;
let M = null;
let api = null;

// WebAssembly SIMD makes recognition faster where the browser has it.
function hasSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
}

async function init(base) {
  const name = hasSimd() ? 'tesseract-core-simd-lstm' : 'tesseract-core-lstm';
  importScripts(`${base}${name}.js`);
  M = await TesseractCore({ locateFile: (file) => `${base}${file}`, print: () => {}, printErr: () => {} });
  const res = await fetch(`${base}eng.traineddata.gz`);
  if (!res.ok) throw new Error('The text reader couldn\'t be downloaded.');
  const data = new Uint8Array(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  M.FS.writeFile('./eng.traineddata', data);
  api = new M.TessBaseAPI();
  if (api.Init(null, 'eng', 1) === -1) throw new Error('The text reader couldn\'t start.');
}

self.onmessage = async (e) => {
  const { id, base, image, psm } = e.data;
  try {
    if (!ready) ready = init(base).catch((err) => { ready = null; throw err; });
    await ready;
    M.FS.writeFile('/input', new Uint8Array(image));
    api.SetVariable('tessedit_pageseg_mode', String(psm ?? 11));
    if (api.SetImageFile(1, 0) === 1) throw new Error('The photo couldn\'t be read.');
    api.Recognize(null);
    self.postMessage({ id, text: api.GetUTF8Text() ?? '', confidence: api.MeanTextConf() });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) });
  }
};
