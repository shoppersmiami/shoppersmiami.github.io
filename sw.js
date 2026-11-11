// Shoppers Miami — service worker: deja la app y el lector de etiquetas
// funcionando sin internet después de la primera visita.
//  · App (HTML/JS/CSS/config): red primero (siempre la versión nueva si hay señal),
//    copia guardada si no hay internet. Respeta el "no-cache" de _headers.
//  · /vendor/ (motor OCR + modelo), /fonts/, /mall/ (renders): caché primero.
//  · cdn.jsdelivr.net (supabase-js, transformers.js + onnxruntime para reconocer el
//    tipo de producto): caché primero y se actualiza en segundo plano.
//    El modelo CLIP (huggingface.co) lo guarda transformers.js en su propia caché
//    ("transformers-cache"), así que aquí no se duplica.
const SHELL = "ms-shell-v5", STATIC = "ms-static-v1", CDN = "ms-cdn-v1";
const SIMD = (() => { try { return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); } catch (e) { return false; } })();
const CORE = SIMD ? "tesseract-core-simd-lstm" : "tesseract-core-lstm";
const SHELL_FILES = ["./", "index.html", "app.js", "tiendas.js", "styles.css", "finanzas.js", "finanzas.css", "material.css", "gender.css", "clientes.js", "clientes.css", "encargos.js", "encargos.css", "campanas.js", "campanas.css", "cuentas.js", "cuentas.css", "ordenes.js", "ordenes.css", "theme_miami.css", "arrows.css", "arrows.js", "layout.css", "layout.js", "splash.css", "splash.js", "img/miami/noche.jpg", "img/miami/caliza.jpg", "img/mat/trav.jpg", "img/mat/portoro.jpg", "img/mat/brass.jpg", "img/mat/bronze.jpg", "img/mat/teak.jpg", "config.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "vision/price.js", "vision/measure.js", "vision/measure-worker.js"];
const VISION_FILES = ["vendor/tesseract/ms-ocr-worker.js", `vendor/tesseract/${CORE}.js`, `vendor/tesseract/${CORE}.wasm`, "vendor/tesseract/eng.traineddata"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(SHELL_FILES.map((f) => c.add(new Request(f, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  const keep = [SHELL, STATIC, CDN];
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ms-") && !keep.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// La app pide guardar el lector de etiquetas (solo la shopper lo necesita: ~7 MB)
self.addEventListener("message", (e) => {
  if (e.data === "ms-precache-vision") e.waitUntil(caches.open(STATIC).then(async (c) => {
    for (const f of VISION_FILES) { const u = new URL(f, self.registration.scope).href; if (!(await c.match(u))) await c.add(u).catch(() => {}); }
    e.source?.postMessage?.("ms-vision-ready");
  }));
});

async function cacheFirst(req, name) {
  const c = await caches.open(name), hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") c.put(req, r.clone()).catch(() => {});
  return r;
}
async function networkFirst(req) {
  const c = await caches.open(SHELL);
  try {
    const r = await fetch(req);
    const u = new URL(req.url);
    if (r.ok) c.put(req.mode === "navigate" ? new URL("index.html", self.registration.scope).href : u.origin + u.pathname, r.clone()).catch(() => {});
    return r;
  } catch (err) {
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await c.match("index.html") : null);
    if (hit) return hit;
    throw err;
  }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(CDN), hit = await c.match(req);
  const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()).catch(() => {}); return r; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (u.pathname.endsWith(".mp4")) return;   // caminata (walk.js): video con peticiones por rango, lo maneja el navegador
    if (/\/(vendor|fonts|mall)\//.test(u.pathname) && !u.pathname.endsWith(".json")) return e.respondWith(cacheFirst(req, STATIC));
    if (u.pathname.endsWith("/sw.js")) return;
    return e.respondWith(networkFirst(req));
  }
  if (u.hostname === "cdn.jsdelivr.net") return e.respondWith(staleWhileRevalidate(req));
});
