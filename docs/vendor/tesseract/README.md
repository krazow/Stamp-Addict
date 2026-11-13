# Tesseract OCR (vendored)

Used on the device to read the printed text on a stamp photo (country name,
face value, year). Nothing is sent anywhere.

| File | From | Licence |
| --- | --- | --- |
| tesseract-core-lstm.js/.wasm, tesseract-core-simd-lstm.js/.wasm | [naptha/tesseract.js-core](https://github.com/naptha/tesseract.js-core) at acffef2b66eb44a31df297e11d905f4b39001068 2025-12-14 | Apache 2.0 (LICENSE) |
| eng.traineddata.gz | [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) eng.traineddata at 87416418657359cb625c412a48b6e1d6d41c29bd 2024-08-01, gzipped | Apache 2.0 |

The SIMD build is used where the browser supports WebAssembly SIMD, the
plain build otherwise.
