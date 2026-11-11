/* Mi Shopper Miami — lector OCR mínimo (Web Worker), 100% local.
 *
 * Usa directamente el motor Tesseract compilado a WebAssembly de
 * tesseract.js-core v5.1.1 (Apache-2.0, https://github.com/naptha/tesseract.js-core)
 * y el modelo eng.traineddata de tessdata_fast (Apache-2.0,
 * https://github.com/tesseract-ocr/tessdata_fast). Reemplaza el envoltorio
 * tesseract.js (que había que bajar de jsdelivr) por ~80 líneas propias.
 *
 * Mensajes:  {id, cmd:"init"}  ·  {id, cmd:"recognize", image:Uint8Array(PNG/JPEG), psm, whitelist}
 * Respuesta: {id, ok:true, text, tsv} o {id, ok:false, error}
 */
/* eslint-env worker */
"use strict";
const BASE = self.location.href.replace(/[^/]*$/, "");
// Detección de SIMD (mismo módulo de prueba que usa wasm-feature-detect, Apache-2.0)
const SIMD = (() => { try { return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); } catch (e) { return false; } })();
let ready = null, api = null, M = null;

function init() {
  if (ready) return ready;
  ready = (async () => {
    importScripts(BASE + (SIMD ? "tesseract-core-simd-lstm.js" : "tesseract-core-lstm.js"));
    M = await self.TesseractCore({ locateFile: (f) => BASE + f });
    const r = await fetch(BASE + "eng.traineddata");
    if (!r.ok) throw new Error("No se pudo cargar eng.traineddata (" + r.status + ")");
    M.FS.writeFile("./eng.traineddata", new Uint8Array(await r.arrayBuffer()));
    api = new M.TessBaseAPI();
    if (api.Init(null, "eng", 1 /* OEM_LSTM_ONLY */, undefined) === -1) throw new Error("Tesseract no pudo iniciar");
    api.SetVariable("user_defined_dpi", "300");
    return true;
  })();
  ready.catch(() => (ready = null));
  return ready;
}

function recognize({ image, psm = 11, whitelist = "" }) {
  api.SetVariable("tessedit_pageseg_mode", String(psm));
  api.SetVariable("tessedit_char_whitelist", whitelist || "");
  M.FS.writeFile("/input", image);
  if (api.SetImageFile(1, 0) === 1) throw new Error("No se pudo leer la imagen");
  api.Recognize(null);
  const text = api.GetUTF8Text(), tsv = api.GetTSVText(0);
  api.Clear();
  return { text, tsv };
}

self.onmessage = async (e) => {
  const { id, cmd } = e.data || {};
  try {
    await init();
    if (cmd === "init") return self.postMessage({ id, ok: true, simd: SIMD });
    if (cmd === "recognize") return self.postMessage({ id, ok: true, ...recognize(e.data) });
    throw new Error("Comando desconocido: " + cmd);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
