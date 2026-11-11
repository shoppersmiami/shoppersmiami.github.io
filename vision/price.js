// =====================================================================
// Mi Shopper Miami — lectura del precio de la etiqueta, 100% en el teléfono.
// Motor: Tesseract (tesseract.js-core, Apache-2.0) en un Web Worker propio
// (/vendor/tesseract/ms-ocr-worker.js) con el modelo tessdata_fast (Apache-2.0).
// Sin internet funciona igual una vez que el service worker guardó los archivos.
//
// Estrategia (2 pasadas):
//   1) OCR "texto disperso" (PSM 11) de la foto completa, en gris con contraste
//      estirado, para ubicar números que parecen precios.
//   2) Recorta la zona de la etiqueta alrededor de esos números, la agranda
//      (texto de ~70 px de alto), la binariza con umbral local (Sauvola)
//      y vuelve a leer como bloque (PSM 6). Se juntan ambas lecturas.
// Luego parsePriceLines() interpreta los formatos de etiquetas de EE.UU.:
//   "$19.99", "19.99", "$19⁹⁹", "Compare at $49.99", "Was/Reg/Orig/MSRP",
//   "Save $20", "40% off", dos precios (el menor = venta), etc.
// =====================================================================

let worker = null, seq = 0;
const pending = new Map();
const WORKER_URL = new URL("../vendor/tesseract/ms-ocr-worker.js", import.meta.url).href;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(WORKER_URL);
  worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.ok(e.data) : p.ko(new Error(e.data.error)); };
  worker.onerror = (e) => { for (const p of pending.values()) p.ko(new Error(e.message || "Falló el lector")); pending.clear(); worker = null; };
  return worker;
}
function call(msg, transfer) {
  return new Promise((ok, ko) => { const id = ++seq; pending.set(id, { ok, ko }); getWorker().postMessage({ id, ...msg }, transfer || []); });
}
export const initOCR = () => call({ cmd: "init" });

// ---------- Imagen ----------
async function loadBitmap(src) {
  if (src instanceof Blob) { try { return await createImageBitmap(src, { imageOrientation: "from-image" }); } catch { return await createImageBitmap(src); } }
  const img = await new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  return img;
}
function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
const toPNG = (c) => new Promise((ok) => c.toBlob(async (b) => ok(new Uint8Array(await b.arrayBuffer())), "image/png"));

// Canal más oscuro + estirar contraste (percentil 1–99). Si bin=true, umbral local (Sauvola).
function grayCanvas(img, sx, sy, sw, sh, scale, { bin = false, pad = 0, win = 40 } = {}) {
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const c = canvas(w + 2 * pad, h + 2 * pad), g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = "high";
  g.drawImage(img, sx, sy, sw, sh, pad, pad, w, h);
  const d = g.getImageData(pad, pad, w, h), px = d.data, n = w * h, Y = new Uint8ClampedArray(n), hist = new Uint32Array(256);
  // Canal más oscuro (mín. de R,G,B): los precios en rojo/colores claros quedan oscuros sobre el
  // papel blanco (en gris normal un rojo claro casi desaparece al binarizar).
  for (let i = 0, j = 0; i < n; i++, j += 4) { const y = Math.min(px[j], px[j + 1], px[j + 2]); Y[i] = y; hist[y]++; }
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < n * 0.01; lo++);
  acc = 0; for (; hi > 0 && (acc += hist[hi]) < n * 0.01; hi--);
  const k = hi > lo ? 255 / (hi - lo) : 1;
  const V = new Float32Array(n); for (let i = 0; i < n; i++) V[i] = Math.max(0, Math.min(255, (Y[i] - lo) * k));
  let B = null;
  if (bin) {
    // Umbral local de Sauvola (Sauvola & Pietikäinen 2000) con imágenes integrales: aguanta
    // etiquetas blancas sobre productos oscuros y letras chicas grises junto a precios grandes.
    const W1 = w + 1, S = new Float64Array(W1 * (h + 1)), S2 = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) { let a = 0, a2 = 0; for (let x = 0; x < w; x++) { const v = V[y * w + x]; a += v; a2 += v * v; S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + a; S2[(y + 1) * W1 + x + 1] = S2[y * W1 + x + 1] + a2; } }
    const r = Math.max(10, Math.round(win / 2)), kk = 0.3; B = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), N = (y1 - y0) * (x1 - x0);
        const sum = S[y1 * W1 + x1] - S[y0 * W1 + x1] - S[y1 * W1 + x0] + S[y0 * W1 + x0];
        const sq = S2[y1 * W1 + x1] - S2[y0 * W1 + x1] - S2[y1 * W1 + x0] + S2[y0 * W1 + x0];
        const m = sum / N, sd = Math.sqrt(Math.max(0, sq / N - m * m));
        B[y * w + x] = V[y * w + x] > m * (1 + kk * (sd / 128 - 1)) ? 255 : 0;
      }
    }
  }
  for (let i = 0, j = 0; i < n; i++, j += 4) { const v = bin ? B[i] : V[i]; px[j] = px[j + 1] = px[j + 2] = v; px[j + 3] = 255; }
  g.putImageData(d, pad, pad);
  return c;
}

// Enderezar: ángulo (±25°) que maximiza la varianza del perfil horizontal de tinta, medido solo
// cerca del precio (win = [x0,y0,x1,y1] en px del lienzo) para que rayas del producto no manden
function deskew(c, win) {
  const w = c.width, h = c.height, d = c.getContext("2d").getImageData(0, 0, w, h).data, pts = [];
  const [wx0, wy0, wx1, wy1] = win ? win.map(Math.round) : [0, 0, w, h];
  for (let y = Math.max(0, wy0); y < Math.min(h, wy1); y += 2) for (let x = Math.max(0, wx0); x < Math.min(w, wx1); x += 2) if (d[(y * w + x) * 4] < 128) pts.push(x - w / 2, y - h / 2);
  if (pts.length < 50 || pts.length > 4e5) return { c, ang: 0 };
  let best = -1, ang = 0;
  for (let a = -25; a <= 25; a += 1) {
    const t = a * Math.PI / 180, ca = Math.cos(t), sa = Math.sin(t), bins = new Float32Array(Math.ceil(Math.hypot(w, h) / 2) + 2), off = bins.length / 2;
    for (let i = 0; i < pts.length; i += 2) bins[Math.floor((pts[i] * sa + pts[i + 1] * ca) / 2 + off)]++;
    let m = 0; for (const v of bins) m += v; m /= bins.length; let v2 = 0; for (const v of bins) v2 += (v - m) ** 2;
    if (v2 > best * 1.02 || (a === 0 && v2 >= best * 0.98)) { best = Math.max(best, v2); ang = a; }
  }
  if (!ang) return { c, ang: 0 };
  const o = canvas(w, h), g = o.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2); g.rotate(ang * Math.PI / 180); g.drawImage(c, -w / 2, -h / 2);
  return { c: o, ang };
}

// ---------- TSV de Tesseract → líneas con palabras y caja ----------
function tsvLines(tsv, scale = 1, ox = 0, oy = 0) {
  const lines = new Map();
  for (const row of String(tsv || "").split("\n")) {
    const f = row.split("\t"); if (f.length < 12 || f[0] !== "5") continue;
    const text = f.slice(11).join("\t").trim(), conf = +f[10]; if (!text) continue;
    const key = `${f[2]}.${f[3]}.${f[4]}`;
    const w = { text, conf, x: +f[6] / scale + ox, y: +f[7] / scale + oy, w: +f[8] / scale, h: +f[9] / scale };
    if (!lines.has(key)) lines.set(key, []); lines.get(key).push(w);
  }
  return [...lines.values()].map((ws) => {
    const x0 = Math.min(...ws.map((w) => w.x)), y0 = Math.min(...ws.map((w) => w.y));
    const x1 = Math.max(...ws.map((w) => w.x + w.w)), y1 = Math.max(...ws.map((w) => w.y + w.h));
    return { text: ws.map((w) => w.text).join(" "), words: ws, x: x0, y: y0, w: x1 - x0, h: y1 - y0, conf: ws.reduce((a, w) => a + w.conf, 0) / ws.length };
  }).sort((a, b) => a.y - b.y || a.x - b.x);
}

// ---------- Interpretación de precios (función pura, se prueba en Node) ----------
const RE_COMPARE = /\b(compare|comp\.?|compar|cmp|c[o0]m?p\w{0,5}\.?\s*(at|a[t1l]|value)|was|reg(ular)?|orig(inal)?|msrp|retail|list\s*price|valued?|value|elsewhere|antes|before|ticketed)\b/i;
const RE_SALE = /\b(our\s*price|now|sale|you\s*pay|clearance|special|price|only|precio|ahora|final)\b/i;
const RE_SAVE = /\b(save|savings?|you\s*save|ahorr\w*|off\s*\$)\b/i;
// Arreglos típicos del OCR dentro de números
function fixDigits(s) {
  return s.replace(/(?<=[\d$])[Oo](?=[\d.,]|$)|(?<=[.,])[Oo]|[Oo](?=\d)/g, "0")
    .replace(/(?<=[\d$])[lI|](?=\d|[.,])|(?<=[.,]\d?)[lI|]/g, "1")
    .replace(/(?<=\d)[Ss](?=\d)|(?<=\$)[Ss](?=\d)/g, "5")
    .replace(/(?<=\d)B(?=\d)|(?<=\$)B(?=\d)/g, "8")
    .replace(/S(?=\d{1,4}[.,]\d{2}\b)/g, "$");
}
export function pricesInLine(text) {
  const out = []; const t = fixDigits(text);
  // a) $19.99 · 19.99 · 1,299.00 · $ 19,99 · US$19.99
  const re = /(US\s?\$|USD\s?|\$)?\s?(\d{1,3}(?:,\d{3})+|\d{1,4})\s?[.,·]\s?(\d{2})(?![\d%])/g; let m;
  while ((m = re.exec(t))) {
    if (/\d[.,]$/.test(t.slice(0, m.index))) continue; // parte de un número más largo (código)
    const v = parseFloat(m[2].replace(/,/g, "") + "." + m[3]);
    out.push({ value: v, dollar: !!m[1], cents: true, index: m.index });
  }
  // b) $19 · $199 (sin centavos) y $19 99 / $1999 con centavos en superíndice
  const re2 = /(US\s?\$|\$)\s?(\d{1,4})(?:\s(\d{2}))?(?![\d.,%])/g;
  while ((m = re2.exec(t))) {
    if (out.some((o) => Math.abs(o.index - m.index) < 3)) continue;
    let v = parseFloat(m[2]), sup = false;
    if (m[3]) { v = parseFloat(m[2] + "." + m[3]); sup = true; }
    else if (m[2].length >= 3 && /(99|98|97|95|90|49|50|00)$/.test(m[2]) && v >= 300) { v = parseFloat(m[2].slice(0, -2) + "." + m[2].slice(-2)); sup = true; }
    out.push({ value: v, dollar: true, cents: sup, sup, index: m.index });
  }
  return out.filter((o) => o.value >= 0.5 && o.value < 10000);
}
export function percentsInLine(text) {
  const out = []; const re = /(\d{1,2})\s?%\s?(off|de\s?desc|desc)?/gi; let m;
  while ((m = re.exec(fixDigits(text)))) { const v = +m[1]; if (v >= 5 && v <= 90) out.push({ value: v, off: !!m[2] || /extra|take|additional|save|ahorr/i.test(text) }); }
  // "60% cotton" / "78% polyester" no son descuentos: solo cuentan con "off", "extra", etc.
  return out.filter((p) => p.off);
}

/** lines: [{text, h}] (h = alto de la letra en px; opcional). Devuelve el precio de venta y más. */
export function parsePriceLines(lines) {
  const cands = []; const pcts = [];
  let carry = null; // etiqueta "Compare at" en una línea sin número se aplica a la siguiente
  lines.forEach((ln, i) => {
    const text = ln.text || "";
    const ps = pricesInLine(text);
    pcts.push(...percentsInLine(text));
    let label = RE_SAVE.test(text) ? "save" : RE_COMPARE.test(text) ? "compare" : RE_SALE.test(text) ? "sale" : null;
    if (!ps.length) { carry = label && label !== "sale" ? label : label === "sale" ? "sale" : null; return; }
    // Si la línea tiene "Compare at" y además otro precio, el número inmediatamente después de la palabra es el de referencia.
    const kw = text.search(RE_COMPARE), sv = text.search(RE_SAVE);
    ps.forEach((p, k) => {
      let lab = label;
      if (ps.length > 1 && label) {
        const near = (pos) => pos >= 0 && p.index > pos && ps.filter((q) => q.index > pos)[0] === p;
        lab = near(sv) ? "save" : near(kw) ? "compare" : null;
      }
      if (!lab && carry && k === 0) lab = carry;
      const words = (ln.words || []);
      const hw = words.find((w) => pricesInLine(w.text).length)?.h || ln.h || 0;
      cands.push({ ...p, label: lab, h: hw, conf: ln.conf ?? 80, line: i });
    });
    carry = null;
  });
  // Quitar duplicados (dos pasadas leen lo mismo): mismo valor → juntar
  const byVal = new Map();
  for (const c of cands) {
    const k = c.value.toFixed(2), o = byVal.get(k);
    if (!o) byVal.set(k, { ...c, n: 1 });
    else { o.n++; o.h = Math.max(o.h, c.h); o.dollar ||= c.dollar; o.cents ||= c.cents; o.label ||= c.label; o.conf = Math.max(o.conf, c.conf); }
  }
  let all = [...byVal.values()];
  // "$49" leído a medias cuando también está "$49.99": quedarse con el que tiene centavos
  all = all.filter((c) => c.cents || !all.some((o) => o.cents && Math.floor(o.value) === c.value));
  // Descartar números que no parecen precios (sin $ ni centavos ya se filtraron; también tallas tipo 7.50 sin $ muy chicas)
  const strong = all.filter((c) => c.dollar || c.cents);
  all = strong.length ? strong : all;
  const saves = all.filter((c) => c.label === "save");
  const compares = all.filter((c) => c.label === "compare");
  let pool = all.filter((c) => c.label !== "save" && c.label !== "compare");
  let compareAt = compares.length ? Math.max(...compares.map((c) => c.value)) : null;
  if (compareAt) pool = pool.filter((c) => c.value < compareAt);
  const sales = pool.filter((c) => c.label === "sale");
  const score = (c) => (c.h || 10) * (c.dollar ? 1.3 : 1) * (c.cents ? 1.2 : 1) * (c.sup ? 0.9 : 1) * (0.5 + Math.min(c.n, 3) / 4) * (0.6 + (c.conf || 50) / 250);
  let price = null;
  if (sales.length) price = sales.sort((a, b) => score(b) - score(a))[0].value;
  else if (pool.length) {
    const top = [...pool].sort((a, b) => score(b) - score(a));
    const best = top[0];
    // Dos precios sin rótulo: el menor es el de venta y el mayor el "compare at", salvo que el mayor
    // tenga letra claramente más grande (en ese caso es el precio y el chico es otra cosa).
    const vals = [...new Set(pool.map((c) => c.value))].sort((a, b) => a - b);
    if (vals.length >= 2 && !compareAt) {
      const lo = pool.find((c) => c.value === vals[0]), hi = pool.find((c) => c.value === vals[vals.length - 1]);
      if ((hi.h || 1) > (lo.h || 1) * 1.6 && hi === best) price = hi.value;
      else { price = lo.value; if (hi.value > lo.value * 1.05 && hi.value < lo.value * 12) compareAt = hi.value; }
    } else price = best.value;
  }
  // Porcentaje: si coincide con price/compareAt solo describe la rebaja; si no, es descuento extra en caja
  let extraPct = null; const off = pcts.filter((p) => p.off).map((p) => p.value);
  const pct = off[0] ?? pcts[0]?.value ?? null;
  if (pct && price) {
    const implied = compareAt ? Math.round((1 - price / compareAt) * 100) : null;
    if (implied == null || Math.abs(implied - pct) > 3) extraPct = pct;
  }
  const save = saves[0]?.value ?? null;
  if (!compareAt && save && price) compareAt = Math.round((price + save) * 100) / 100;
  const prices = [...new Set(all.filter((c) => c.label !== "save").map((c) => c.value))].sort((a, b) => a - b);
  return { price, compareAt, extraPct, save, prices };
}

// ---------- Lectura completa de una foto ----------
/** src: Blob o URL. Devuelve {price, compareAt, extraPct, prices, text, ms} */
export async function readPriceTag(src, { onStatus } = {}) {
  const t0 = performance.now();
  onStatus?.("Preparando lector de etiquetas…");
  await initOCR();
  const img = await loadBitmap(src);
  const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
  onStatus?.("Leyendo la etiqueta…");
  // Pasada 1: foto completa (lado mayor hasta ~2200 px)
  const s1 = Math.min(2, 2200 / Math.max(W, H));
  const c1 = grayCanvas(img, 0, 0, W, H, s1);
  const r1 = await call({ cmd: "recognize", image: await toPNG(c1), psm: 11 });
  let lines = tsvLines(r1.tsv, s1);
  // Pasada 2: zonas con números (la etiqueta), agrandadas y binarizadas
  const seeds = lines.flatMap((l) => l.words).filter((w) => /\d/.test(w.text) && (pricesInLine(w.text).length || /[$%]/.test(w.text) || /\d{2}/.test(w.text)) && w.h > 4);
  const boxes = [];
  for (const w of seeds.sort((a, b) => b.h - a.h)) {
    const mx = w.h * 5, my = w.h * 3.5;
    const b = [Math.max(0, w.x - mx), Math.max(0, w.y - my), Math.min(W, w.x + w.w + mx), Math.min(H, w.y + w.h + my), w.h, w.x, w.y];
    const hit = boxes.find((o) => !(b[0] > o[2] || b[2] < o[0] || b[1] > o[3] || b[3] < o[1]));
    if (hit) { hit[0] = Math.min(hit[0], b[0]); hit[1] = Math.min(hit[1], b[1]); hit[2] = Math.max(hit[2], b[2]); hit[3] = Math.max(hit[3], b[3]); hit[4] = Math.max(hit[4], b[4]); }
    else boxes.push(b);
  }
  const zones = boxes.slice(0, 3);
  // Si la pasada 1 no encontró nada, probar la foto completa binarizada y agrandada en 4 cuadrantes
  if (!zones.length) for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) zones.push([qx * W * 0.45, qy * H * 0.45, qx * W * 0.45 + W * 0.55, qy * H * 0.45 + H * 0.55, 0]);
  const extra = [];
  for (const [x0, y0, x1, y1, hh, sx0, sy0] of zones) {
    const sc = hh ? Math.max(1.2, Math.min(4, 70 / hh)) : Math.min(2.5, 1800 / Math.max(x1 - x0, y1 - y0));
    const sw = x1 - x0, sh = y1 - y0; if (sw * sc * sh * sc > 9e6) continue;
    for (const psm of hh ? [6, 11] : [11]) {
      const win = hh ? [16 + (sx0 - x0 - 4 * hh) * sc, 16 + (sy0 - y0 - 2.5 * hh) * sc, 16 + (sx0 - x0 + 6 * hh) * sc, 16 + (sy0 - y0 + 3.5 * hh) * sc] : null;
      const { c: c2, ang } = deskew(grayCanvas(img, x0, y0, sw, sh, sc, { bin: true, pad: 16, win: hh ? hh * sc * 1.2 : 50 }), win);
      const r2 = await call({ cmd: "recognize", image: await toPNG(c2), psm });
      // (con el enderezado las cajas quedan aproximadas; solo se usan para el tamaño de letra)
      extra.push(...tsvLines(r2.tsv, sc, x0 - 16 / sc, y0 - 16 / sc).map((l) => ({ ...l, ang })));
    }
  }
  img.close?.();
  const all = [...extra, ...lines];
  const res = parsePriceLines(all);
  return { ...res, text: all.map((l) => l.text).join("\n"), ms: Math.round(performance.now() - t0) };
}
