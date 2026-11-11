// =====================================================================
// Mi Shopper Miami — medir el producto con una tarjeta de crédito/débito
// como referencia (ISO/IEC 7810 ID-1: 85,60 × 53,98 mm). 100% local, sin APIs.
//
// Cómo funciona (y de dónde sale):
//  1. Detección de la tarjeta: gradientes (Sobel) → segmentos rectos por
//     crecimiento de regiones con el mismo ángulo (versión simplificada de LSD,
//     von Gioi et al., "LSD: a Line Segment Detector", IPOL 2012) → se juntan en
//     rectas → se prueban cuadriláteros formados por 2 pares de rectas, puntuados
//     por cuánto borde real cubre cada lado y por cuán compatible es su forma con
//     un rectángulo de proporción 1,586 visto en perspectiva. Es la misma idea del
//     "escáner de documentos" de OpenCV (bordes → contorno de 4 lados → homografía,
//     p. ej. pyimagesearch "4-point getPerspectiveTransform"), pero con rectas en vez
//     de contornos, para que funcione aunque la tarjeta esté pegada al producto o un
//     dedo tape una esquina.
//  2. La forma se valida con el método de Zhang & He ("Whiteboard scanning and
//     image enhancement", Digital Signal Processing 17(2), 2007): con la homografía
//     tarjeta→foto y una cámara pinhole (centro óptico al medio), las columnas
//     h1,h2 deben cumplir K⁻¹h1 ⟂ K⁻¹h2 y |K⁻¹h1| = |K⁻¹h2|. Se busca la focal f que
//     mejor lo cumple; el error restante indica si el cuadrilátero es una tarjeta.
//  3. Esquinas afinadas a resolución completa buscando el máximo del gradiente a lo
//     largo de la normal de cada lado (subpíxel) y ajustando rectas; las esquinas
//     redondeadas de la tarjeta no molestan porque se usa la intersección de los lados.
//  4. Medición: homografía inversa foto→plano de la tarjeta (cm). Si la tarjeta está
//     acostada en la mesa, el alto se obtiene con la pose de la cámara (Zhang,
//     "A flexible new technique for camera calibration", PAMI 2000: H = K[r1 r2 t])
//     intersectando el rayo del punto superior con la vertical del punto de apoyo
//     (metrología de una sola vista, Criminisi et al., IJCV 2000).
// Mismo enfoque que apps abiertas tipo "measure object size with reference object"
// (OpenCV + objeto de tamaño conocido), aquí escrito en JS puro (~sin dependencias).
// =====================================================================

export const CARD_W_CM = 8.56, CARD_H_CM = 5.398;

// ---------- Álgebra pequeña ----------
function solve(A, b) { // Gauss con pivoteo, A n×n (se modifica)
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-12) return null;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) { const k = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= k * A[i][c]; b[r] -= k * b[i]; }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}
/** Homografía que lleva src[i] → dst[i] (4 puntos). Devuelve 3×3 (arreglo de 9). */
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b); return h ? [...h, 1] : null;
}
export const applyH = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
export function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => Math.hypot(a[0], a[1], a[2]);
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// Orden horario (en pantalla) empezando por la esquina de arriba a la izquierda
export function orderQuad(q) {
  const c = [q.reduce((s, p) => s + p[0], 0) / 4, q.reduce((s, p) => s + p[1], 0) / 4];
  const s = [...q].sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
  let k = 0; for (let i = 1; i < 4; i++) if (s[i][0] + s[i][1] < s[k][0] + s[k][1]) k = i;
  return [0, 1, 2, 3].map((i) => s[(i + k) % 4]);
}

// Rodrigues: vector de rotación ↔ matriz (filas)
function rodrigues(v) {
  const th = Math.hypot(v[0], v[1], v[2]); if (th < 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [x, y, z] = v.map((c) => c / th), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
}
function rotvec(M) {
  const tr = M[0][0] + M[1][1] + M[2][2], th = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (th < 1e-9) return [0, 0, 0];
  if (Math.PI - th < 1e-4) { // ~180°
    const x = Math.sqrt(Math.max(0, (M[0][0] + 1) / 2)), y = Math.sqrt(Math.max(0, (M[1][1] + 1) / 2)) * (M[0][1] >= 0 ? 1 : -1), z = Math.sqrt(Math.max(0, (M[2][2] + 1) / 2)) * (M[0][2] >= 0 ? 1 : -1);
    return [x * th, y * th, z * th];
  }
  const k = th / (2 * Math.sin(th));
  return [(M[2][1] - M[1][2]) * k, (M[0][2] - M[2][0]) * k, (M[1][0] - M[0][1]) * k];
}

/**
 * Ajuste de la tarjeta: para el cuadrilátero q (px de la foto W×H) busca la pose de la cámara
 * (rotación, traslación) y la focal f que proyectan un rectángulo de 8,56 × 5,398 cm lo más cerca
 * posible de las 4 esquinas (Levenberg–Marquardt, con f "a priori" de cámara de teléfono).
 * Devuelve la homografía cm→px de ese modelo (más estable que la de 4 puntos sola), su inversa,
 * el error en px (rms), la pose y la inclinación. r = error de forma (rms / lado corto).
 */
export function cardFit(quad, W, H) {
  const q = orderQuad(quad), cx = W / 2, cy = H / 2, diag = Math.hypot(W, H), f0 = 0.6 * diag; // ~26 mm equivalentes
  const lo = Math.log(0.8), hi = Math.log(1.3);
  let best = null;
  for (const o of [0, 1]) {
    const [a, b] = o ? [CARD_H_CM, CARD_W_CM] : [CARD_W_CM, CARD_H_CM], P = [[0, 0], [a, 0], [a, b], [0, b]];
    const Hm = homography(P, q); if (!Hm) continue;
    // 1) inicio: f por la condición de Zhang & He y pose por descomposición de H
    let fi = f0, ri = Infinity;
    const col = (i) => [Hm[i], Hm[3 + i], Hm[6 + i]];
    for (let s = 0; s <= 40; s++) {
      const f = f0 * Math.exp(Math.log(0.5) + (s / 40) * Math.log(3 / 0.5));
      const u1 = [(Hm[0] - cx * Hm[6]) / f, (Hm[3] - cy * Hm[6]) / f, Hm[6]], u2 = [(Hm[1] - cx * Hm[7]) / f, (Hm[4] - cy * Hm[7]) / f, Hm[7]];
      const n1 = nrm(u1), n2 = nrm(u2), lf = Math.log(f / f0);
      const r = Math.hypot(dot(u1, u2) / (n1 * n2), (n1 - n2) / (n1 + n2)) + 0.08 * Math.max(0, lf - hi, lo - lf);
      if (r < ri) { ri = r; fi = f; }
    }
    void col;
    const kinv = (h) => [(h[0] - cx * h[2]) / fi, (h[1] - cy * h[2]) / fi, h[2]];
    const g1 = kinv([Hm[0], Hm[3], Hm[6]]), g2 = kinv([Hm[1], Hm[4], Hm[7]]), g3 = kinv([Hm[2], Hm[5], Hm[8]]);
    let lam = 2 / (nrm(g1) + nrm(g2)); if (g3[2] * lam < 0) lam = -lam;
    const r1 = scl(g1, Math.sign(lam) / nrm(g1)); let r2 = scl(g2, Math.sign(lam) / nrm(g2));
    r2 = [r2[0] - dot(r1, r2) * r1[0], r2[1] - dot(r1, r2) * r1[1], r2[2] - dot(r1, r2) * r1[2]]; r2 = scl(r2, 1 / nrm(r2));
    const r3 = cross(r1, r2), M0 = [[r1[0], r2[0], r3[0]], [r1[1], r2[1], r3[1]], [r1[2], r2[2], r3[2]]];
    let p = [...rotvec(M0), ...scl(g3, lam), Math.log(fi / f0)];
    // 2) Levenberg–Marquardt sobre (rotación, traslación, log f)
    const resid = (p) => {
      const M = rodrigues(p.slice(0, 3)), f = f0 * Math.exp(p[6]), out = [];
      for (const [X, Y] of P) {
        const xc = M[0][0] * X + M[0][1] * Y + p[3], yc = M[1][0] * X + M[1][1] * Y + p[4], zc = M[2][0] * X + M[2][1] * Y + p[5];
        if (zc <= 1e-6) return null;
        out.push(f * xc / zc + cx - q[out.length / 2][0], f * yc / zc + cy - q[out.length / 2][1]);
      }
      const lf = p[6]; out.push(25 * Math.max(0, lf - hi, lo - lf) + 0.5 * lf); // prior de focal (en "px")
      return out;
    };
    let r = resid(p); if (!r) continue;
    let cost = r.reduce((s2, v) => s2 + v * v, 0), mu = 1e-3;
    for (let it = 0; it < 30; it++) {
      const J = [], eps = [1e-5, 1e-5, 1e-5, 1e-4, 1e-4, 1e-4, 1e-5];
      for (let j = 0; j < 7; j++) { const pp = [...p]; pp[j] += eps[j]; const rr = resid(pp); if (!rr) { J.push(null); continue; } J.push(rr.map((v, i) => (v - r[i]) / eps[j])); }
      if (J.some((c) => !c)) break;
      const A = Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => J[i].reduce((s2, v, k) => s2 + v * J[j][k], 0)));
      const g = J.map((c) => -c.reduce((s2, v, k) => s2 + v * r[k], 0));
      let improved = false;
      for (let tries = 0; tries < 8 && !improved; tries++) {
        const Ad = A.map((row, i) => row.map((v, j) => (i === j ? v * (1 + mu) + 1e-9 : v)));
        const d = solve(Ad, [...g]); if (!d) { mu *= 10; continue; }
        const pn = p.map((v, i) => v + d[i]), rn = resid(pn);
        const cn = rn ? rn.reduce((s2, v) => s2 + v * v, 0) : Infinity;
        if (cn < cost) { p = pn; r = rn; improved = cost - cn > 1e-10 * cost; cost = cn; mu = Math.max(1e-7, mu / 5); improved = true; } else mu *= 10;
      }
      if (!improved) break;
    }
    let se = 0; for (let i = 0; i < 4; i++) se += r[2 * i] ** 2 + r[2 * i + 1] ** 2;
    const rms = Math.sqrt(se / 4);
    if (!best || rms < best.rms) best = { rms, o, p, a, b, q };
  }
  if (!best) return null;
  const { p, o } = best, M = rodrigues(p.slice(0, 3)), f = f0 * Math.exp(p[6]);
  // H (cm → px) del modelo = K [r1 r2 t]
  const Hm = [f * M[0][0] + cx * M[2][0], f * M[0][1] + cx * M[2][1], f * p[3] + cx * p[5],
              f * M[1][0] + cy * M[2][0], f * M[1][1] + cy * M[2][1], f * p[4] + cy * p[5],
              M[2][0], M[2][1], p[5]].map((v) => v / p[5]);
  const R = [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]]; // columnas
  const sides = [0, 1, 2, 3].map((i) => Math.hypot(best.q[(i + 1) % 4][0] - best.q[i][0], best.q[(i + 1) % 4][1] - best.q[i][1]));
  const tilt = Math.acos(Math.min(1, Math.abs(M[2][2]))) * 180 / Math.PI;
  return { r: best.rms / Math.max(1, Math.min(...sides)), rms: best.rms, f, o, H: Hm, Hinv: inv3(Hm), R, t: [p[3], p[4], p[5]], cx, cy, tilt, quad: best.q, minSide: Math.min(...sides) };
}

// ---------- Mediciones ----------
export const toCard = (fit, p) => applyH(fit.Hinv, p[0], p[1]);
export const planeDist = (fit, p, q) => { const a = toCard(fit, p), b = toCard(fit, q); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
/** Alto de un objeto parado sobre el plano de la tarjeta: base (en el plano) y punta (justo encima). */
export function heightAbove(fit, base, top) {
  const { R, t, f, cx, cy } = fit; const [r1, r2, r3] = R; // columnas de R
  // R = [r1 r2 r3] por columnas → x_cam = R X + t ⇒ X = Rᵀ(x_cam − t)
  const Rt = (v) => [dot(r1, v), dot(r2, v), dot(r3, v)];
  const C = scl(Rt(t), -1);
  const d = Rt([(top[0] - cx) / f, (top[1] - cy) / f, 1]);
  const B = toCard(fit, base), P0 = [B[0], B[1], 0], e = [0, 0, 1];
  // mínima distancia entre P0 + h·e y C + s·d
  const w0 = [P0[0] - C[0], P0[1] - C[1], P0[2] - C[2]];
  const a = 1, b = dot(e, d), c = dot(d, d), dd = dot(e, w0), ee = dot(d, w0), den = a * c - b * b;
  if (Math.abs(den) < 1e-9) return null;
  const h = (b * ee - c * dd) / den;
  return Math.abs(h);
}

// ---------- Imagen → gris ----------
function grayFrom(img, maxSide) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = typeof document !== "undefined" ? document.createElement("canvas") : new OffscreenCanvas(w, h); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, Y = new Float32Array(w * h), rgb = d;
  const C = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  for (let i = 0, j = 0; i < w * h; i++, j += 4) { Y[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]; C[0][i] = d[j]; C[1][i] = d[j + 1]; C[2][i] = d[j + 2]; }
  return { Y, C, w, h, k, rgb };
}
function blur(Y, w, h) { // [1 4 6 4 1]/16 separable
  const T = new Float32Array(w * h), O = new Float32Array(w * h), K = [1, 4, 6, 4, 1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * Y[y * w + Math.min(w - 1, Math.max(0, x + k))]; T[y * w + x] = s / 16; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * T[Math.min(h - 1, Math.max(0, y + k)) * w + x]; O[y * w + x] = s / 16; }
  return O;
}

// ---------- Segmentos (LSD simplificado) ----------
// Gradiente de color (Di Zenzo 1986): bordes entre colores de brillo parecido (tarjeta celeste
// sobre madera clara) que en gris casi no se ven. Devuelve magnitud y orientación (módulo π).
function colorGradient(C, w, h) {
  const n = w * h, mag = new Float32Array(n), ang = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let xx = 0, yy = 0, xy = 0;
    for (const Y of C) {
      const a = Y[i - w - 1], b = Y[i - w], c = Y[i - w + 1], d = Y[i - 1], f = Y[i + 1], g = Y[i + w - 1], hh = Y[i + w], k = Y[i + w + 1];
      const gx = (c + 2 * f + k - a - 2 * d - g) / 8, gy = (g + 2 * hh + k - a - 2 * b - c) / 8;
      xx += gx * gx; yy += gy * gy; xy += gx * gy;
    }
    mag[i] = Math.sqrt(Math.max(0, 0.5 * (xx + yy + Math.sqrt((xx - yy) ** 2 + 4 * xy * xy))) / 1.7);
    let t = 0.5 * Math.atan2(2 * xy, xx - yy) + Math.PI / 2; if (t >= Math.PI) t -= Math.PI; if (t < 0) t += Math.PI; ang[i] = t; // ángulo de la línea de nivel
  }
  return { mag, ang };
}
function lineSegments(C, w, h) {
  const n = w * h, { mag, ang } = colorGradient(C, w, h);
  // umbral: el mayor entre 2 niveles/px y el 80% de la mediana de los píxeles con borde
  const hist = new Uint32Array(256); let cnt = 0;
  for (let i = 0; i < n; i++) { const m = Math.min(255, mag[i] | 0); if (m >= 1) { hist[m]++; cnt++; } }
  let acc = 0, med = 0; for (; med < 255 && (acc += hist[med]) < cnt * 0.5; med++);
  const T = Math.max(2.2, med * 0.8);
  // Adelgazar bordes (supresión de no-máximos, como Canny): vetas de madera o rayas paralelas a
  // pocos píxeles de un borde quedan separadas en vez de formar una sola región gruesa.
  const thin = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, m = mag[i]; if (m <= T) continue;
    let g = ang[i] - Math.PI / 2; if (g < 0) g += Math.PI; // dirección del gradiente, [0, π)
    const b = Math.round(g / (Math.PI / 4)) % 4, o = b === 0 ? 1 : b === 1 ? w + 1 : b === 2 ? w : w - 1;
    thin[i] = 1; void o; // (sin adelgazar: con bordes gruesos el ajuste robusto funciona mejor)
  }
  // semillas por magnitud descendente (bucket sort)
  const buckets = Array.from({ length: 256 }, () => []);
  for (let i = 0; i < n; i++) if (thin[i]) buckets[Math.min(255, mag[i] | 0)].push(i);
  const used = new Uint8Array(n);
  const tau = Math.PI / 8, segs = [], reg = new Int32Array(n);
  for (let bk = 255; bk >= 0; bk--) for (const s of buckets[bk]) {
    if (used[s] === 1) continue;
    let len = 0; reg[len++] = s; used[s] = 1;
    let sx = Math.cos(2 * ang[s]), sy = Math.sin(2 * ang[s]), th = ang[s], cxs = s % w, cys = (s / w) | 0, cth = Math.cos(th), sth = Math.sin(th);
    for (let r = 0; r < len; r++) {
      const p = reg[r], px = p % w, py = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx, qy = py + dy; if (qx < 1 || qy < 1 || qx >= w - 1 || qy >= h - 1) continue;
        const q = qy * w + qx; if (used[q] === 1 || !thin[q]) continue;
        let da = Math.abs(ang[q] - th); if (da > Math.PI / 2) da = Math.PI - da;
        if (da > tau) continue;
        used[q] = 1; reg[len++] = q; sx += Math.cos(2 * ang[q]); sy += Math.sin(2 * ang[q]); cxs += qx; cys += qy;
        // el ángulo de la región se fija al de la semilla hasta tener varios píxeles,
        // así una semilla en una esquina redondeada no "dobla" por los dos lados
        if (len > 12) { th = 0.5 * Math.atan2(sy, sx); if (th < 0) th += Math.PI; cth = Math.cos(th); sth = Math.sin(th); }
      }
    }
    if (len < 10) continue;
    // Rectas robustas dentro de la región (varias, una tras otra): para cada una se prueban ángulos
    // ±7° y se elige la posición con más borde a ±0,8 px (tipo Hough local); luego se corta en
    // tramos continuos. Así un borde pegado a una veta de madera paralela, un texto o la sombra no
    // lo inclina ni lo "contamina": salen como segmentos separados.
    let rest = Array.from(reg.subarray(0, len));
    for (let pass = 0; pass < 12 && rest.length >= 10; pass++) {
      let W = 0, mx = 0, my = 0, c2 = 0, s2 = 0;
      for (const p of rest) { const m = mag[p]; W += m; mx += m * (p % w); my += m * ((p / w) | 0); c2 += m * Math.cos(2 * ang[p]); s2 += m * Math.sin(2 * ang[p]); }
      mx /= W; my /= W; const th0 = 0.5 * Math.atan2(s2, c2);
      let best = -1, bA = 0, bD = 0;
      for (let st = -14; st <= 14; st++) {
        const a = th0 + st * Math.PI / 360, ca = Math.cos(a), sa = Math.sin(a), hist = new Map();
        for (const p of rest) { const b2 = Math.round((-(p % w - mx) * sa + (((p / w) | 0) - my) * ca) * 2); hist.set(b2, (hist.get(b2) || 0) + mag[p]); }
        for (const [b2, v0] of hist) { const v = v0 + (hist.get(b2 - 1) || 0) + (hist.get(b2 + 1) || 0) + 0.5 * ((hist.get(b2 - 2) || 0) + (hist.get(b2 + 2) || 0)); if (v > best) { best = v; bA = a; bD = b2 / 2; } }
      }
      const ca = Math.cos(bA), sa = Math.sin(bA), inl = [], out = [];
      for (const p of rest) { const dd = Math.abs(-(p % w - mx) * sa + (((p / w) | 0) - my) * ca - bD); if (dd <= 1.6) inl.push(p); else if (dd > 4) out.push(p); }
      rest = out; if (inl.length < 10) break;
      // tramos continuos a lo largo de la recta
      const tt = inl.map((p) => [(p % w - mx) * ca + (((p / w) | 0) - my) * sa, p]).sort((u, v) => u[0] - v[0]);
      let run = [tt[0]];
      const flush = () => {
        if (run.length < 10) return;
        const ps = run.map((r) => r[1]); let W2 = 0, ax = 0, ay = 0;
        for (const p of ps) { const m = mag[p]; W2 += m; ax += m * (p % w); ay += m * ((p / w) | 0); }
        ax /= W2; ay /= W2; let sxx = 0, syy = 0, sxy = 0;
        for (const p of ps) { const m = mag[p], x = p % w - ax, y = ((p / w) | 0) - ay; sxx += m * x * x; syy += m * y * y; sxy += m * x * y; }
        const t2 = 0.5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(t2), dy = Math.sin(t2);
        let t0 = Infinity, t1 = -Infinity, wsum = 0;
        for (const p of ps) { const x = p % w - ax, y = ((p / w) | 0) - ay, t = x * dx + y * dy, dd = -x * dy + y * dx; if (t < t0) t0 = t; if (t > t1) t1 = t; wsum += Math.abs(dd); }
        const L = t1 - t0, width = 2 * wsum / ps.length;
        if (L < 12 || width > Math.max(2.5, Math.min(4.5, L * 0.1)) || ps.length < L * 0.9) return;
        segs.push({ x1: ax + t0 * dx, y1: ay + t0 * dy, x2: ax + t1 * dx, y2: ay + t1 * dy, len: L });
      };
      for (let i = 1; i < tt.length; i++) { if (tt[i][0] - tt[i - 1][0] > 3) { flush(); run = []; } run.push(tt[i]); }
      flush();
    }
  }
  return segs;
}

// Juntar segmentos colineales en rectas con sus tramos cubiertos
function mergeLines(segs) {
  segs.sort((a, b) => b.len - a.len);
  const lines = [];
  for (const s of segs) {
    let th = Math.atan2(s.y2 - s.y1, s.x2 - s.x1); if (th < 0) th += Math.PI; if (th >= Math.PI) th -= Math.PI;
    let hit = null;
    for (const L of lines) {
      let da = Math.abs(th - L.th); da = Math.min(da, Math.PI - da);
      if (da > 0.045) continue;
      const d1 = Math.abs(L.nx * s.x1 + L.ny * s.y1 - L.c), d2 = Math.abs(L.nx * s.x2 + L.ny * s.y2 - L.c);
      if (d1 < 2 && d2 < 2) { hit = L; break; }
    }
    if (!hit) { const dx = Math.cos(th), dy = Math.sin(th); hit = { th, dx, dy, nx: -dy, ny: dx, c: -dy * s.x1 + dx * s.y1, segs: [], sup: 0 }; lines.push(hit); }
    hit.segs.push(s); hit.sup += s.len;
    // reajuste con los extremos ponderados por largo
    let W = 0, mx = 0, my = 0;
    for (const t of hit.segs) for (const [x, y] of [[t.x1, t.y1], [t.x2, t.y2]]) { W += t.len; mx += t.len * x; my += t.len * y; }
    mx /= W; my /= W; let sxx = 0, syy = 0, sxy = 0;
    for (const t of hit.segs) for (const [x, y] of [[t.x1, t.y1], [t.x2, t.y2]]) { sxx += t.len * (x - mx) ** 2; syy += t.len * (y - my) ** 2; sxy += t.len * (x - mx) * (y - my); }
    if (hit.segs.length > 1) { let t2 = 0.5 * Math.atan2(2 * sxy, sxx - syy); if (t2 < 0) t2 += Math.PI; hit.th = t2; hit.dx = Math.cos(t2); hit.dy = Math.sin(t2); hit.nx = -hit.dy; hit.ny = hit.dx; hit.c = hit.nx * mx + hit.ny * my; }
  }
  for (const L of lines) {
    const iv = L.segs.map((s) => { const a = L.dx * s.x1 + L.dy * s.y1, b = L.dx * s.x2 + L.dy * s.y2; return [Math.min(a, b), Math.max(a, b)]; }).sort((a, b) => a[0] - b[0]);
    const m = []; for (const v of iv) { if (m.length && v[0] <= m[m.length - 1][1] + 1.5) m[m.length - 1][1] = Math.max(m[m.length - 1][1], v[1]); else m.push([...v]); }
    L.iv = m;
  }
  return lines;
}
const meet = (a, b) => { const det = a.nx * b.ny - a.ny * b.nx; if (Math.abs(det) < 1e-6) return null; return [(a.c * b.ny - a.ny * b.c) / det, (a.nx * b.c - a.c * b.nx) / det]; };
function coverage(L, P, Q) {
  let a = L.dx * P[0] + L.dy * P[1], b = L.dx * Q[0] + L.dy * Q[1]; if (a > b) [a, b] = [b, a];
  // se ignora un 8% en cada punta (esquinas redondeadas de la tarjeta)
  const m = (b - a) * 0.08; a += m; b -= m; let cov = 0;
  for (const [s, e] of L.iv) cov += Math.max(0, Math.min(b, e) - Math.max(a, s));
  return cov / Math.max(1e-6, b - a);
}

// ---------- Candidatos por regiones de color ----------
// Segmentación por grafos de Felzenszwalb & Huttenlocher ("Efficient Graph-Based Image
// Segmentation", IJCV 2004): la tarjeta suele ser una mancha compacta de un color distinto a lo que
// la rodea, aunque sus bordes queden "mezclados" con vetas paralelas. Cada mancha → envolvente
// convexa → 4 vértices (Ramer–Douglas–Peucker) → candidato (luego se afina con los bordes).
function regionQuads(img) {
  const G = grayFrom(img, 460), w = G.w, h = G.h, k = G.k, n = w * h;
  const C = G.C.map((c) => blur(c, w, h));
  // aristas 8-vecinas con peso = diferencia de color, ordenadas por cubetas
  const ea = [], eb = [], ew = [];
  const add = (a, b) => { ea.push(a); eb.push(b); ew.push(Math.hypot(C[0][a] - C[0][b], C[1][a] - C[1][b], C[2][a] - C[2][b])); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x < w - 1) add(i, i + 1); if (y < h - 1) add(i, i + w); if (x < w - 1 && y < h - 1) add(i, i + w + 1); if (x > 0 && y < h - 1) add(i, i + w - 1); }
  const order = Array.from(ew.keys()).sort((a, b) => ew[a] - ew[b]);
  const par = new Int32Array(n).map((_, i) => i), sz = new Int32Array(n).fill(1), th = new Float32Array(n).fill(0);
  const K = 300, find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const tau = (c) => K / sz[c];
  const intr = new Float32Array(n);
  for (const e of order) {
    let a = find(ea[e]), b = find(eb[e]); if (a === b) continue;
    const wgt = ew[e];
    if (wgt <= Math.min(intr[a] + tau(a), intr[b] + tau(b))) { if (sz[a] < sz[b]) [a, b] = [b, a]; par[b] = a; sz[a] += sz[b]; intr[a] = Math.max(intr[a], intr[b], wgt); }
  }
  void th;
  const minSz = Math.max(20, n * 0.0008);
  for (const e of order) { const a = find(ea[e]), b = find(eb[e]); if (a !== b && (sz[a] < minSz || sz[b] < minSz)) { if (sz[a] < sz[b]) { par[a] = b; sz[b] += sz[a]; } else { par[b] = a; sz[a] += sz[b]; } } }
  const lab = new Int32Array(n); for (let i = 0; i < n; i++) lab[i] = find(i);
  const bnd = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, l = lab[i];
    if (sz[l] < n * 0.0015 || sz[l] > n * 0.3) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || lab[i - 1] !== l || lab[i + 1] !== l || lab[i - w] !== l || lab[i + w] !== l) { if (!bnd.has(l)) bnd.set(l, []); bnd.get(l).push([x, y]); }
  }
  const quads = [];
  for (const [l, pts] of bnd) {
    if (pts.some(([x, y]) => x === 0 || y === 0 || x === w - 1 || y === h - 1)) continue; // cortada por el borde de la foto
    const hull = convexHull(pts); if (hull.length < 4) continue;
    const ha = polyArea(hull); if (ha < 30) continue;
    // área con los "agujeros" (letras, chip) rellenos: inundar desde el borde de su caja
    let x0 = w, y0 = h, x1 = 0, y1 = 0; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const bw = x1 - x0 + 3, bh = y1 - y0 + 3, out = new Uint8Array(bw * bh), st = [0]; out[0] = 1; let outside = 0;
    while (st.length) { const p = st.pop(); outside++; const x = p % bw, y = (p / bw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= bw || Y >= bh) continue; const q = Y * bw + X; if (out[q]) continue;
        const ix = X + x0 - 1, iy = Y + y0 - 1; if (ix >= 0 && iy >= 0 && ix < w && iy < h && lab[iy * w + ix] === l) continue; out[q] = 1; st.push(q); } }
    const filled = bw * bh - outside;
    if (filled / ha < 0.8) continue;
    const q = hullToQuad(hull); if (!q) continue;
    if (polyArea(q) / ha < 0.75) continue;
    quads.push({ c: q.map(([x, y]) => [(x + 0.5) / k, (y + 0.5) / k]), solid: filled / ha });
  }
  return quads;
}
function convexHull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const polyArea = (q) => Math.abs(q.reduce((a, p, i) => a + p[0] * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * p[1], 0)) / 2;
// Cuadrilátero de área máxima con vértices de la envolvente (casi igual a la envolvente si es una tarjeta)
function hullToQuad(H) {
  let V = H; if (V.length > 40) { const st = V.length / 40; V = Array.from({ length: 40 }, (_, i) => H[Math.floor(i * st)]); }
  const m = V.length; let best = null, ba = -1;
  for (let a = 0; a < m; a++) for (let c = a + 2; c < m; c++) {
    let bb = -1, bv = -1, dd = -1, dv = -1;
    const ax = V[a][0], ay = V[a][1], cx = V[c][0], cy = V[c][1];
    for (let b = a + 1; b < c; b++) { const t = Math.abs((cx - ax) * (V[b][1] - ay) - (cy - ay) * (V[b][0] - ax)); if (t > bv) { bv = t; bb = b; } }
    for (let d = c + 1; d < m + a; d++) { const q = V[d % m], t = Math.abs((cx - ax) * (q[1] - ay) - (cy - ay) * (q[0] - ax)); if (t > dv) { dv = t; dd = d % m; } }
    if (bb < 0 || dd < 0) continue;
    if (bv + dv > ba) { ba = bv + dv; best = [V[a], V[bb], V[c], V[dd]]; }
  }
  return best;
}

// Fracción del interior del cuadrilátero que es "papel blanco" (claro y sin color)
function paperFraction(rgb, w, c) {
  let white = 0, tot = 0;
  for (let i = 1; i < 12; i++) for (let j = 1; j < 8; j++) {
    const u = 0.1 + 0.8 * i / 12, v = 0.1 + 0.8 * j / 8;
    const x = (1 - u) * (1 - v) * c[0][0] + u * (1 - v) * c[1][0] + u * v * c[2][0] + (1 - u) * v * c[3][0];
    const y = (1 - u) * (1 - v) * c[0][1] + u * (1 - v) * c[1][1] + u * v * c[2][1] + (1 - u) * v * c[3][1];
    const o = (Math.round(y) * w + Math.round(x)) * 4; if (!(o >= 0 && o < rgb.length)) continue;
    const mx = Math.max(rgb[o], rgb[o + 1], rgb[o + 2]), mn = Math.min(rgb[o], rgb[o + 1], rgb[o + 2]);
    tot++; if (mx > 190 && (mx - mn) < 0.16 * mx) white++;
  }
  return tot ? white / tot : 0;
}

// Cuánto borde sigue de largo más allá de las esquinas (los lados de una tarjeta terminan en
// sus esquinas; los cuadriláteros "accidentales" armados con rectas largas de repisas o cajas no)
function overshoot(L, P, Q) {
  let a = L.dx * P[0] + L.dy * P[1], b = L.dx * Q[0] + L.dy * Q[1]; if (a > b) [a, b] = [b, a];
  const m = Math.max(4, (b - a) * 0.3), g = Math.max(2, (b - a) * 0.06); let cov = 0;
  for (const [s, e] of L.iv) cov += Math.max(0, Math.min(b + m, e) - Math.max(b + g, s)) + Math.max(0, Math.min(a - g, e) - Math.max(a - m, s));
  return cov / (2 * (m - g));
}

/**
 * Busca la tarjeta en la foto. img: HTMLImageElement/ImageBitmap/canvas ya cargado.
 * Devuelve { W, H, candidates: [{quad, score, fit, cov}] } (quad en px de la foto original)
 */
export function detectCard(img, { work = 900, debug = false } = {}) {
  const t0 = performance.now();
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const G = grayFrom(img, work), w = G.w, h = G.h, k = G.k;
  const segs = lineSegments(G.C.map((c) => blur(c, w, h)), w, h);
  let lines = mergeLines(segs).filter((L) => L.sup >= 14).sort((a, b) => b.sup - a.sup).slice(0, 90);
  // pares casi paralelos (lados opuestos), con tramos que se solapan
  const pairs = [], minD = 10, area = w * h;
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const A = lines[i], B = lines[j]; let da = Math.abs(A.th - B.th); da = Math.min(da, Math.PI - da);
    if (da > 0.42) continue;
    const mA = (A.iv[0][0] + A.iv[A.iv.length - 1][1]) / 2, pA = [A.dx * mA + A.nx * A.c, A.dy * mA + A.ny * A.c];
    const dist = Math.abs(B.nx * pA[0] + B.ny * pA[1] - B.c); if (dist < minD) continue;
    pairs.push([A, B, (A.th + B.th + (Math.abs(A.th - B.th) > Math.PI / 2 ? Math.PI : 0)) / 2 % Math.PI]);
  }
  const cands = [];
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const [a1, a2, ta] = pairs[i], [b1, b2, tb] = pairs[j];
    if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
    let d = Math.abs(ta - tb); d = Math.min(d, Math.PI - d); if (d < 0.75) continue; // > 43°
    const c = [meet(a1, b1), meet(b1, a2), meet(a2, b2), meet(b2, a1)];
    if (c.some((p) => !p || p[0] < -0.03 * w || p[1] < -0.03 * h || p[0] > 1.03 * w || p[1] > 1.03 * h)) continue;
    // convexo y de tamaño razonable
    let sgn = 0, ok = true, ar = 0;
    for (let m = 0; m < 4; m++) { const p = c[m], q = c[(m + 1) % 4], r = c[(m + 2) % 4]; const z = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); if (!sgn) sgn = Math.sign(z); else if (Math.sign(z) !== sgn) { ok = false; break; } ar += p[0] * q[1] - q[0] * p[1]; }
    if (!ok) continue; ar = Math.abs(ar) / 2; if (ar < area * 0.0015 || ar > area * 0.45) continue;
    const sides = [0, 1, 2, 3].map((m) => Math.hypot(c[(m + 1) % 4][0] - c[m][0], c[(m + 1) % 4][1] - c[m][1]));
    if (Math.min(...sides) < 14) continue;
    // proporción grosera (antes del ajuste fino): lado largo/corto promedio entre 1,1 y 2,4
    const s02 = (sides[0] + sides[2]) / 2, s13 = (sides[1] + sides[3]) / 2, rr = Math.max(s02, s13) / Math.min(s02, s13);
    if (rr < 1.1 || rr > 2.4) continue;
    const cov = [coverage(a1, c[3], c[0]), coverage(b1, c[0], c[1]), coverage(a2, c[1], c[2]), coverage(b2, c[2], c[3])];
    const cm = (cov[0] + cov[1] + cov[2] + cov[3]) / 4; if (Math.min(...cov) < 0.3 || cm < 0.55) continue;
    const ov = (overshoot(a1, c[3], c[0]) + overshoot(b1, c[0], c[1]) + overshoot(a2, c[1], c[2]) + overshoot(b2, c[2], c[3])) / 4;
    cands.push({ c, cov: cm, covMin: Math.min(...cov), ar, ov });
  }
  // ajuste de forma (más caro) solo para los mejores por cobertura
  cands.sort((a, b) => b.cov - a.cov);
  // + candidatos por regiones de color (sin evidencia de rectas: cobertura "neutra" 0,75)
  let regs = []; try { regs = regionQuads(img); } catch (e) { /* opcional */ }
  for (const r of regs) {
    const c = r.c.map(([x, y]) => [x * k, y * k]);
    cands.splice(Math.min(cands.length, 300), 0, { c, cov: 0.75, covMin: 0.75, ov: 0, region: true });
    // variante "imantada": cada lado se reemplaza por una recta detectada cercana y casi paralela
    // (la mancha de color puede incluir sombra o reflejo; las rectas son más precisas)
    const side = [], covs = [];
    for (let m = 0; m < 4; m++) {
      const P = c[m], Q = c[(m + 1) % 4], len = Math.hypot(Q[0] - P[0], Q[1] - P[1]), mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
      let th = Math.atan2(Q[1] - P[1], Q[0] - P[0]); if (th < 0) th += Math.PI; if (th >= Math.PI) th -= Math.PI;
      let best = null, bc = 0.35;
      for (const L of lines) {
        let da = Math.abs(L.th - th); da = Math.min(da, Math.PI - da); if (da > 0.4) continue;
        if (Math.abs(L.nx * mx + L.ny * my - L.c) > Math.max(5, 0.3 * len)) continue;
        const cv = coverage(L, P, Q); if (cv > bc) { bc = cv; best = L; }
      }
      if (best) { side.push(best); covs.push(bc); }
      else { const dx = (Q[0] - P[0]) / len, dy = (Q[1] - P[1]) / len; side.push({ nx: -dy, ny: dx, c: -dy * P[0] + dx * P[1] }); covs.push(0.6); }
    }
    const sc = [0, 1, 2, 3].map((m) => meet(side[(m + 3) % 4], side[m]));
    if (sc.every(Boolean) && covs.some((v) => v !== 0.6)) cands.splice(Math.min(cands.length, 300), 0, { c: sc, cov: covs.reduce((a, b) => a + b, 0) / 4, covMin: Math.min(...covs), ov: 0, region: true });
  }
  const out = [];
  for (const cd of cands.slice(0, 400)) {
    const quad = cd.c.map(([x, y]) => [x / k, y / k]);
    const fit = cardFit(quad, W, H); if (!fit || fit.rms > Math.max(4, 0.08 * fit.minSide)) continue;
    // Las etiquetas de precio suelen medir ~5×8 cm (¡casi la misma proporción!), pero son papel
    // blanco; las tarjetas casi siempre tienen color. Una tarjeta blanca queda como alternativa.
    const paper = paperFraction(G.rgb, w, cd.c);
    const base = cd.cov * (0.6 + 0.4 * cd.covMin) * (paper > 0.4 ? 0.35 : 1) * (1 - 0.7 * Math.min(1, cd.ov));
    out.push({ quad: fit.quad, base, score: base * Math.exp(-((fit.rms / (cd.region ? 4 : 2)) ** 2)), fit, cov: cd.cov, ov: cd.ov, shape: fit.rms, paper, region: !!cd.region });
  }
  out.sort((a, b) => b.score - a.score);
  // quitar repetidos
  const uniq0 = [];
  for (const o of out) { if (!uniq0.some((u) => u.quad.every((p, m) => Math.hypot(p[0] - o.quad[m][0], p[1] - o.quad[m][1]) < 8 / k))) uniq0.push(o); if (uniq0.length >= 12) break; }
  // afinar las esquinas de los mejores a resolución completa y puntuar la forma con esas esquinas
  const refine = makeRefiner(img);
  for (const o of uniq0) {
    let q = o.quad; try { q = refine(q, !!o.region); } catch (e) { /* queda la aproximada */ }
    const f2 = cardFit(q, W, H) || o.fit;
    o.contrast = refine.contrast(f2.quad);
    o.quad = f2.quad; o.fit = f2; o.shape = f2.rms;
    // inclinación > 65° (tarjeta casi de canto) es muy rara en una foto real: penalizar
    const tiltF = f2.tilt > 65 ? Math.exp(-(((f2.tilt - 65) / 7) ** 2)) : 1;
    o.score = o.base * Math.exp(-((f2.rms / 1.2) ** 2)) * Math.max(0.1, Math.min(1, o.contrast / 50)) * tiltF;
  }
  uniq0.sort((a, b) => b.score - a.score);
  const uniq = [];
  for (const o of uniq0) { if (o.shape > 3.5) continue; if (!uniq.some((u) => u.quad.every((p, m) => Math.hypot(p[0] - o.quad[m][0], p[1] - o.quad[m][1]) < 8 / k))) uniq.push(o); if (uniq.length >= 6) break; }
  const res = { W, H, candidates: uniq, ms: Math.round(performance.now() - t0), nSegs: segs.length, nLines: lines.length };
  if (debug) Object.assign(res, { k, lines, cands, out });
  return res;
}

/** Igual que detectCard pero en un Web Worker (no congela la pantalla); si no se puede, en el hilo principal. */
let mWorker = null, mSeq = 0;
export async function detectCardAsync(img) {
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") throw new Error("sin worker");
    const bmp = await createImageBitmap(img);
    if (!mWorker) mWorker = new Worker(new URL("./measure-worker.js", import.meta.url), { type: "module" });
    const id = ++mSeq;
    const res = await new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new Error("tardó")), 30000);
      const on = (e) => { if (e.data.id !== id) return; clearTimeout(t); mWorker.removeEventListener("message", on); e.data.ok ? ok(e.data) : ko(new Error(e.data.error)); };
      mWorker.addEventListener("message", on); mWorker.onerror = (e) => { clearTimeout(t); ko(new Error(e.message || "worker")); };
      mWorker.postMessage({ id, bmp }, [bmp]);
    });
    return res;
  } catch (e) {
    if (mWorker && String(e.message) !== "sin worker") { mWorker.terminate(); mWorker = null; }
    return detectCard(img);
  }
}

// ---------- Afinado subpíxel de las esquinas a resolución completa ----------
export const refineQuad = (img, quad, maxSide = 2400) => makeRefiner(img, maxSide)(quad);
export function makeRefiner(img, maxSide = 2400) {
  const G = grayFrom(img, maxSide), k = G.k, w = G.w, h = G.h, CB = G.C.map((c) => blur(c, w, h));
  // 2 etapas: búsqueda amplia (±8% del lado) y luego fina alrededor de lo encontrado
  const fn = (quad, wide = false) => refineWith(wide ? refineWith(quad, CB, w, h, k, 0.08) : quad, CB, w, h, k, 0.03);
  fn.contrast = (quad) => sideContrast(quad, CB, w, h, k);
  return fn;
}
// Contraste de color entre el interior y el exterior de cada lado (mediana a lo largo del lado).
// Una tarjeta es un objeto aparte: hay un salto de color en sus 4 lados. Un cuadrilátero
// "accidental" usa alguna raya fina o un borde entre partes del mismo material → contraste bajo.
function sideContrast(quad, CB, w, h, k) {
  const q = orderQuad(quad).map(([x, y]) => [x * k, y * k]);
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const px = (x, y) => { const X = Math.round(x), Y = Math.round(y); if (X < 0 || Y < 0 || X >= w || Y >= h) return null; const i = Y * w + X; return [CB[0][i], CB[1][i], CB[2][i]]; };
  const per = [];
  for (let s = 0; s < 4; s++) {
    const P = q[s], Q = q[(s + 1) % 4], L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    let nx = -(Q[1] - P[1]) / L, ny = (Q[0] - P[0]) / L;
    const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2; if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
    const d = Math.max(3, Math.min(10, 0.06 * L)), vals = [];
    for (let m = 0; m <= 16; m++) {
      const u = 0.15 + 0.7 * m / 16, x = P[0] + (Q[0] - P[0]) * u, y = P[1] + (Q[1] - P[1]) * u;
      const a = px(x + nx * d, y + ny * d), b = px(x - nx * d, y - ny * d);
      if (a && b) vals.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
    vals.sort((a, b) => a - b); per.push(vals.length ? vals[vals.length >> 1] : 0);
  }
  return Math.min(...per);
}
function refineWith(quad, CB, w, h, k, frac = 0.03) {
  const q = orderQuad(quad).map(([x, y]) => [x * k, y * k]);
  const at = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y); if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return null; const fx = x - x0, fy = y - y0, i = y0 * w + x0; return CB.map((Y) => Y[i] * (1 - fx) * (1 - fy) + Y[i + 1] * fx * (1 - fy) + Y[i + w] * (1 - fx) * fy + Y[i + w + 1] * fx * fy); };
  const diff = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0);
  const lines = [];
  for (let s = 0; s < 4; s++) {
    const P = q[s], Q = q[(s + 1) % 4], L = Math.hypot(Q[0] - P[0], Q[1] - P[1]); if (L < 8) return quad;
    const dx = (Q[0] - P[0]) / L, dy = (Q[1] - P[1]) / L, nx = -dy, ny = dx, R = Math.max(3, Math.min(frac > 0.05 ? 16 : 10, L * frac));
    const pts = [];
    for (let m = 0; m <= 40; m++) {
      const u = 0.12 + 0.76 * (m / 40), bx = P[0] + dx * L * u, by = P[1] + dy * L * u;
      let best = -1, bi = 0; const prof = [];
      const E = 5; // muestras extra a cada lado (2,5 px) para la ventana del escalón
      for (let r = -R - 1 - E / 2; r <= R + 1 + E / 2; r += 0.5) prof.push(at(bx + nx * r, by + ny * r));
      if (prof.some((v) => !v)) continue;
      // escalón: diferencia de color entre el promedio de 1–2,5 px a un lado y al otro (una veta o
      // raya fina tiene el mismo color a ambos lados; el borde de la tarjeta no)
      const avg = (i0, i1) => { const a = [0, 0, 0]; for (let i = i0; i <= i1; i++) for (let c = 0; c < 3; c++) a[c] += prof[i][c]; return a.map((v) => v / (i1 - i0 + 1)); };
      const step = prof.map((_, i) => (i >= E + 1 && i < prof.length - E - 1 ? diff(avg(i - E, i - 2), avg(i + 2, i + E)) : 0));
      let si = -1, sb = -1; for (let i = 0; i < step.length; i++) if (step[i] > sb) { sb = step[i]; si = i; }
      if (!(sb > 6)) continue;
      const gr = prof.map((_, i) => (i && i < prof.length - 1 ? diff(prof[i + 1], prof[i - 1]) : 0));
      for (let i = Math.max(1, si - 2); i <= Math.min(prof.length - 2, si + 2); i++) if (gr[i] > best) { best = gr[i]; bi = i; }
      if (!(best > 3) || bi < 2 || bi > prof.length - 3) continue;
      const gm = gr[bi - 1], gp = gr[bi + 1], den = gm - 2 * best + gp;
      const off = den ? 0.5 * (gm - gp) / den : 0;
      const r = -R - 1 - E / 2 + (bi + Math.max(-1, Math.min(1, off))) * 0.5;
      pts.push([bx + nx * r, by + ny * r]);
    }
    if (pts.length < 10) { lines.push(null); continue; }
    // recta por mínimos cuadrados totales con descarte de atípicos
    let use = pts, Lr = null;
    for (let it = 0; it < 3; it++) {
      const mx = use.reduce((a, p) => a + p[0], 0) / use.length, my = use.reduce((a, p) => a + p[1], 0) / use.length;
      let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of use) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
      const t = 0.5 * Math.atan2(2 * sxy, sxx - syy), lx = -Math.sin(t), ly = Math.cos(t);
      Lr = { nx: lx, ny: ly, c: lx * mx + ly * my };
      const res = use.map(([x, y]) => Math.abs(lx * x + ly * y - Lr.c)), sorted = [...res].sort((a, b) => a - b), tol = Math.max(0.8, 2.5 * sorted[Math.floor(sorted.length / 2)]);
      const nu = use.filter((_, i) => res[i] <= tol); if (nu.length === use.length || nu.length < 8) break; use = nu;
    }
    lines.push(Lr);
  }
  const out = [];
  for (let s = 0; s < 4; s++) {
    const A = lines[(s + 3) % 4], B = lines[s];
    const p = A && B ? meet(A, B) : null;
    const lim = Math.max(12, 0.2 * Math.hypot(q[(s + 1) % 4][0] - q[s][0], q[(s + 1) % 4][1] - q[s][1]));
    out.push(p && Math.hypot(p[0] - q[s][0], p[1] - q[s][1]) < lim ? [p[0] / k, p[1] / k] : [q[s][0] / k, q[s][1] / k]);
  }
  return out;
}

// ---------- Sugerencia de la caja del producto ----------
// Fondo = colores del borde de la foto (k-medias, k=4: pared, mesa, repisa…). Lo que no se parece
// a ningún color de fondo es "objeto"; se elige la mancha más grande pegada a la tarjeta.
export function suggestProductBox(img, cardQuad) {
  const G = grayFrom(img, 240), w = G.w, h = G.h, k = G.k, d = G.rgb, n = w * h;
  const border = []; for (let x = 0; x < w; x += 1) for (const y of [0, 1, 2, h - 3, h - 2, h - 1]) border.push(y * w + x); for (let y = 0; y < h; y++) for (const x of [0, 1, 2, w - 3, w - 2, w - 1]) border.push(y * w + x);
  const col = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let C = [0, 0.33, 0.66, 0.99].map((f) => col(border[Math.floor(f * (border.length - 1))]));
  for (let it = 0; it < 10; it++) {
    const acc = C.map(() => [0, 0, 0, 0]);
    for (const i of border) { const c = col(i); let bj = 0; for (let j = 1; j < C.length; j++) if (dist(c, C[j]) < dist(c, C[bj])) bj = j; acc[bj][0] += c[0]; acc[bj][1] += c[1]; acc[bj][2] += c[2]; acc[bj][3]++; }
    C = acc.map((a, j) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : C[j]));
  }
  const near = (c) => Math.min(...C.map((m) => dist(c, m)));
  const bd = border.map((i) => near(col(i))).sort((a, b) => a - b);
  const T = Math.max(22, 2.5 * bd[Math.floor(bd.length * 0.6)]);
  let m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = near(col(i)) > T ? 1 : 0;
  let cq = null, ccx = w / 2, ccy = h / 2, clen = w / 6;
  if (cardQuad) {
    const q = cardQuad.map(([x, y]) => [x * k, y * k]); ccx = q.reduce((a, p) => a + p[0], 0) / 4; ccy = q.reduce((a, p) => a + p[1], 0) / 4;
    clen = Math.max(...q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1])));
    cq = q.map(([x, y]) => [ccx + (x - ccx) * 1.3, ccy + (y - ccy) * 1.3]);
    const inside = (x, y) => { let sg = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = cq[i], [bx, by] = cq[(i + 1) % 4]; const z = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax)); if (!sg) sg = z; else if (z && z !== sg) return false; } return true; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) m[y * w + x] = 0;
  }
  const morph = (src, grow) => { const o = new Uint8Array(n); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = grow ? 0 : 1; for (let dy = -1; dy <= 1 && v !== (grow ? 1 : 0); dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y2 = y + dy; const s2 = X < 0 || Y2 < 0 || X >= w || Y2 >= h ? 0 : src[Y2 * w + X]; if (grow ? s2 : !s2) { v = grow ? 1 : 0; break; } } o[y * w + x] = v; } return o; };
  m = morph(morph(m, false), true); m = morph(morph(m, true), false); // abrir (quita ruido) y cerrar (une)
  const lab = new Int32Array(n).fill(-1), comps = [];
  for (let s2 = 0; s2 < n; s2++) {
    if (!m[s2] || lab[s2] >= 0) continue;
    const st = [s2]; lab[s2] = s2; let cnt = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0; cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < n && m[q] && lab[q] < 0 && Math.abs((q % w) - x) <= 1) { lab[q] = s2; st.push(q); } }
    if (cnt < n * 0.01 || cnt > n * 0.85) continue;
    const gap = Math.max(0, x0 - ccx, ccx - x1) + Math.max(0, y0 - ccy, ccy - y1); // distancia de la caja al centro de la tarjeta
    comps.push({ cnt, gap, box: [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k] });
  }
  if (!comps.length) return null;
  const nearCard = comps.filter((c) => c.gap < clen * 1.5);
  const best = (nearCard.length ? nearCard : comps).sort((a, b) => b.cnt - a.cnt)[0];
  // si la tarjeta tapa parte del producto, juntar los pedazos que tocan la tarjeta
  const touching = comps.filter((c) => c.gap < clen * 0.35 && c.cnt > best.cnt * 0.05);
  if (touching.includes(best)) return touching.reduce((b, c) => [Math.min(b[0], c.box[0]), Math.min(b[1], c.box[1]), Math.max(b[2], c.box[2]), Math.max(b[3], c.box[3])], best.box);
  return best.box;
}

// ---------- Profundidad estimada según el tipo de producto ----------
export function estimateDepth(wcm, hcm, typeBox) {
  if (!typeBox || !(wcm > 0) || !(hcm > 0)) return null;
  const [a, b, c] = [...typeBox].sort((x, y) => y - x), [p, q] = [wcm, hcm].sort((x, y) => y - x);
  return Math.max(1, Math.round(c * ((p / a + q / b) / 2) * 2) / 2);
}
/** Caja de envío a partir de las medidas del producto (+3 cm de embalaje por lado total) */
export const shippingBox = (dims) => dims.filter((v) => v > 0).sort((a, b) => b - a).map((v) => Math.ceil(v + 3));

// =====================================================================
// Interfaz: hoja "Medir con la tarjeta"
// =====================================================================
const round05 = (v) => Math.round(v * 2) / 2;
const fmt = (v) => (v == null || !isFinite(v) ? "–" : Number(v).toLocaleString("es-CL", { maximumFractionDigits: 1 }));

/**
 * openCardMeasure({ photos:[{url,caption}], sheet, toast, esc, typeBox, initial:{w,h,d}, onSave, aiMeasure })
 * onSave({ w, h, d, dEstimated, box:[L,W,H], mode }) — se llama al tocar Guardar.
 */
export function openCardMeasure(opts) {
  const { photos, sheet, toast, esc = (s) => String(s), typeBox, initial = {}, onSave, aiMeasure } = opts;
  if (!photos?.length) return toast?.("Primero agrega una foto con la tarjeta");
  let idx = 0, mode = "plane", fit = null, cands = [], ci = 0, pts = {}, drag = null, dEst = false, detecting = false;
  sheet(`<h2>Medir con la tarjeta</h2>
    <p class="small muted ms-help" id="ms-help">Buscando la tarjeta…</p>
    ${photos.length > 1 ? `<div class="chips" id="ms-ph">${photos.map((p, i) => `<button type="button" class="chip ${i ? "" : "on"}" data-i="${i}">${esc(p.caption || (i ? "Foto " + (i + 1) : "Principal"))}</button>`).join("")}</div>` : ""}
    <div class="ms-modes seg" role="group" aria-label="Dónde está la tarjeta"><button type="button" class="on" data-mode="plane">Tarjeta parada junto al producto</button><button type="button" data-mode="table">Tarjeta acostada en la mesa</button></div>
    <div class="mstage ms-stage" id="ms-stage"><div class="ms-inner" id="ms-inner"><img id="ms-img" alt="" crossorigin="anonymous"><svg id="ms-svg"></svg></div><canvas class="ms-loupe" id="ms-loupe" width="120" height="120" hidden></canvas></div>
    <div class="row ms-tools"><button type="button" class="btn ghost sm" id="ms-zoom" hidden>🔍 Alejar</button><button type="button" class="btn ghost sm" id="ms-next" hidden>Otra tarjeta</button><button type="button" class="btn ghost sm" id="ms-auto">Buscar tarjeta</button><span class="grow"></span>${aiMeasure ? `<button type="button" class="btn ghost sm" id="ms-ai">✨ Medir con IA</button>` : ""}</div>
    <div class="ms-legend small"><span class="ms-k ms-kc">Tarjeta</span><span class="ms-k ms-kw">Ancho</span><span class="ms-k ms-kh">Alto</span><span class="ms-k ms-kd" hidden>Fondo</span></div>
    <div class="ms-warn small" id="ms-warn" hidden></div>
    <div class="ms-dims"><div><label class="f">Ancho (cm)</label><input class="in" id="ms-w" inputmode="decimal"></div><div><label class="f">Alto (cm)</label><input class="in" id="ms-h" inputmode="decimal"></div><div><label class="f">Fondo (cm)</label><input class="in" id="ms-d" inputmode="decimal"></div></div>
    <div class="small muted" id="ms-dnote"></div>
    <button class="btn coral block" id="ms-save" style="margin-top:14px">Guardar medidas</button>
    <button class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>`, (el, close) => {
    const $ = (s) => el.querySelector(s);
    const img = $("#ms-img"), svg = $("#ms-svg"), help = $("#ms-help"), warnEl = $("#ms-warn"), loupe = $("#ms-loupe"), inner = $("#ms-inner"), stage = $("#ms-stage"), zb = $("#ms-zoom");
    let zoomed = false;
    // Acercar la vista a la tarjeta + producto (en el teléfono se ven chicos y cuesta poner los puntos)
    function setZoom(on) {
      zoomed = on; zb.textContent = on ? "🔍 Alejar" : "🔍 Acercar";
      if (!on) { inner.style.transform = ""; requestAnimationFrame(draw); return; }
      const all = [...(pts.card || []), ...(pts.w || []), ...(pts.h || []), ...(pts.d || [])]; if (!all.length) return;
      const s0 = stage.clientWidth / IW(), sw = stage.clientWidth, sh = stage.clientHeight;
      let x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
      const mx = (x1 - x0) * 0.18 + 20, my = (y1 - y0) * 0.18 + 20; x0 -= mx; x1 += mx; y0 -= my; y1 += my;
      const z = Math.max(1, Math.min(3, sw / ((x1 - x0) * s0), sh / ((y1 - y0) * s0)));
      if (z < 1.25) { zb.hidden = true; inner.style.transform = ""; zoomed = false; return; }
      zb.hidden = false;
      const tx = Math.min(0, Math.max(sw - z * sw, sw / 2 - z * s0 * (x0 + x1) / 2)), ty = Math.min(0, Math.max(sh - z * sh, sh / 2 - z * s0 * (y0 + y1) / 2));
      inner.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`; requestAnimationFrame(draw);
    }
    zb.onclick = () => setZoom(!zoomed);
    const Win = $("#ms-w"), Hin = $("#ms-h"), Din = $("#ms-d"), dnote = $("#ms-dnote");
    if (initial.w) Win.value = initial.w; if (initial.h) Hin.value = initial.h; if (initial.d) Din.value = initial.d;
    let touched = { w: false, h: false, d: !!initial.d };
    Win.oninput = () => (touched.w = true); Hin.oninput = () => (touched.h = true); Din.oninput = () => { touched.d = true; dnote.textContent = ""; };
    const IW = () => img.naturalWidth || 1, IH = () => img.naturalHeight || 1;
    const toImg = (e) => { const r = img.getBoundingClientRect(), k = IW() / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };

    function placeDefaults() {
      const W = IW(), H = IH(); let box = null;
      try { box = suggestProductBox(img, pts.card); } catch (e) { console.warn(e); }
      if (!box) box = [W * 0.3, H * 0.2, W * 0.7, H * 0.8];
      const [x0, y0, x1, y1] = box, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (mode === "plane") { pts.w = [[x0, my], [x1, my]]; pts.h = [[mx, y0], [mx, y1]]; delete pts.d; }
      else { pts.w = [[x0, y1], [x1, y1]]; pts.h = [[x0 + 2, y1], [x0 + 2, y0]]; pts.d = [[x1, y1], [x1 - (x1 - x0) * 0.25, y1 - (y1 - y0) * 0.15]]; }
    }
    function setCard(q) { pts.card = orderQuad(q); fit = cardFit(pts.card, IW(), IH()); }
    function compute() {
      const warns = [];
      if (!fit) { draw(); return; }
      const cardLong = Math.max(...[0, 1, 2, 3].map((i) => Math.hypot(pts.card[(i + 1) % 4][0] - pts.card[i][0], pts.card[(i + 1) % 4][1] - pts.card[i][1])));
      if (cardLong < Math.max(IW(), IH()) * 0.07) warns.push("La tarjeta se ve muy chica: acércate para medir mejor.");
      if (fit.r > 0.06) warns.push("Las esquinas no calzan bien con una tarjeta: revisa que estén justo en los bordes.");
      let w = planeDist(fit, ...pts.w), h = null, d = null;
      if (mode === "plane") {
        h = planeDist(fit, ...pts.h);
        if (fit.tilt > 30) warns.push(`La foto está inclinada (${Math.round(fit.tilt)}°): para medir, sácala más de frente.`);
        const far = [...pts.w, ...pts.h].some((p) => { const c = toCard(fit, p); return Math.hypot(c[0] - CARD_W_CM / 2, c[1] - CARD_H_CM / 2) > 60; });
        if (far) warns.push("El producto está lejos de la tarjeta: la medida es aproximada.");
      } else {
        h = heightAbove(fit, pts.h[0], pts.h[1]);
        d = pts.d ? planeDist(fit, ...pts.d) : null;
        if (fit.tilt < 20) warns.push("Foto tomada muy desde arriba: el alto no se puede medir bien. Sácala en diagonal (unos 45°).");
      }
      if (!touched.w && w) Win.value = round05(w);
      if (!touched.h && h) Hin.value = round05(h);
      if (!touched.d) {
        if (d) { Din.value = round05(d); dEst = false; dnote.textContent = ""; }
        else { const e = estimateDepth(num(Win.value), num(Hin.value), typeBox); if (e) { Din.value = e; dEst = true; dnote.textContent = "Fondo estimado según el tipo de producto (puedes corregirlo o medirlo con la tarjeta acostada en la mesa)."; } }
      }
      warnEl.hidden = !warns.length; warnEl.innerHTML = warns.map((x) => `⚠️ ${esc(x)}`).join("<br>");
      draw();
    }
    const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
    function draw() {
      const W = IW(), H = IH(), r = img.getBoundingClientRect(), k = r.width ? W / r.width : 1;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const sw = 2.5 * k, R = 9 * k; let s = "";
      if (pts.card) s += `<polygon class="ms-card" points="${pts.card.map((p) => p.join(",")).join(" ")}" stroke-width="${sw}"/>`;
      const seg = (key, cls) => { const p = pts[key]; if (!p) return ""; return `<line class="${cls}" x1="${p[0][0]}" y1="${p[0][1]}" x2="${p[1][0]}" y2="${p[1][1]}" stroke-width="${sw * 1.4}"/>`; };
      s += seg("w", "ms-lw") + seg("h", "ms-lh") + seg("d", "ms-ld");
      // esquinas de la tarjeta: anillos chicos y huecos (la tarjeta se sigue viendo); se agarran igual a 30 px
      for (const [key, cls] of [["card", "ms-hc"], ["w", "ms-hw"], ["h", "ms-hh"], ["d", "ms-hd"]]) (pts[key] || []).forEach((p, i) => (s += `<circle class="${cls}${drag && drag.key === key && drag.i === i ? " ms-on" : ""}" cx="${p[0]}" cy="${p[1]}" r="${key === "card" ? R * 0.6 : R * 0.85}" stroke-width="${key === "card" ? sw * 1.2 : sw}"/>`));
      svg.innerHTML = s;
      el.querySelector(".ms-kd").hidden = mode !== "table";
      help.innerHTML = detecting ? "Buscando la tarjeta…" : !fit ? "Arrastra los 4 puntos naranjos a las <b>esquinas de la tarjeta</b>." :
        mode === "plane" ? "Ajusta las líneas <b>verde (ancho)</b> y <b>azul (alto)</b> a los bordes del producto. Puedes mover las esquinas de la tarjeta si no calzan."
          : "Tarjeta en la mesa: <b>verde</b> = ancho y <b>morado</b> = fondo, sobre la mesa; <b>azul</b> = alto, desde la base hasta arriba (vertical).";
    }
    function showLoupe(p) {
      const g = loupe.getContext("2d"), z = 3, s = 120 / z;
      g.fillStyle = "#000"; g.fillRect(0, 0, 120, 120);
      try { g.drawImage(img, p[0] - s / 2 * (IW() / img.getBoundingClientRect().width), p[1] - s / 2 * (IW() / img.getBoundingClientRect().width), s * (IW() / img.getBoundingClientRect().width), s * (IW() / img.getBoundingClientRect().width), 0, 0, 120, 120); } catch {}
      g.strokeStyle = "#ff4f8b"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(60, 48); g.lineTo(60, 72); g.moveTo(48, 60); g.lineTo(72, 60); g.stroke();
      const r = img.getBoundingClientRect(); loupe.classList.toggle("ms-right", (p[0] / IW()) * r.width < r.width / 2);
      loupe.hidden = false;
    }
    svg.addEventListener("pointerdown", (e) => {
      e.preventDefault(); const p = toImg(e), k = IW() / img.getBoundingClientRect().width, lim = 30 * k;
      let best = null;
      for (const key of ["w", "h", "d", "card"]) (pts[key] || []).forEach((q, i) => { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < lim && (!best || dd < best.dd)) best = { key, i, dd, off: [q[0] - p[0], q[1] - p[1]] }; });
      if (!best) return; drag = best; svg.setPointerCapture(e.pointerId); showLoupe(pts[best.key][best.i]); draw();
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return; const p = toImg(e), q = [Math.max(0, Math.min(IW(), p[0] + drag.off[0])), Math.max(0, Math.min(IH(), p[1] + drag.off[1]))];
      pts[drag.key][drag.i] = q; if (drag.key === "card") fit = cardFit(pts.card, IW(), IH());
      showLoupe(q); compute();
    });
    const end = () => { if (!drag) return; if (drag.key === "card") setCard(pts.card); drag = null; loupe.hidden = true; compute(); };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    async function detect() {
      detecting = true; draw();
      await new Promise((r) => setTimeout(r, 30));
      let res = null;
      try { res = await detectCardAsync(img); } catch (e) { console.warn(e); }
      cands = res?.candidates || []; ci = 0; detecting = false;
      if (cands.length) {
        setCard(cands[0].quad); // ya vienen afinados a resolución completa
        toast?.(cands.length > 1 ? "Tarjeta detectada (si no es esa, toca “Otra tarjeta”)" : "Tarjeta detectada");
      } else {
        const W = IW(), H = IH(), cw = W * 0.18, ch = cw / 1.586;
        setCard([[W * 0.08, H * 0.75], [W * 0.08 + cw, H * 0.75], [W * 0.08 + cw, H * 0.75 + ch], [W * 0.08, H * 0.75 + ch]]);
        toast?.("No encontré la tarjeta: arrastra las esquinas naranjas");
      }
      $("#ms-next").hidden = cands.length < 2;
      if (!pts.w) placeDefaults();
      compute(); setZoom(true);
    }
    $("#ms-next").onclick = () => { if (cands.length < 2) return; ci = (ci + 1) % cands.length; setCard(cands[ci].quad); compute(); };
    $("#ms-auto").onclick = () => { pts = {}; touched = { w: false, h: false, d: false }; detect(); };
    el.querySelectorAll(".ms-modes button").forEach((b) => (b.onclick = () => {
      mode = b.dataset.mode; el.querySelectorAll(".ms-modes button").forEach((x) => x.classList.toggle("on", x === b));
      touched = { w: false, h: false, d: false }; delete pts.w; delete pts.h; delete pts.d; placeDefaults(); compute(); setZoom(zoomed);
    }));
    el.querySelectorAll("#ms-ph .chip").forEach((c) => (c.onclick = () => { idx = +c.dataset.i; setZoom(false); el.querySelectorAll("#ms-ph .chip").forEach((x) => x.classList.toggle("on", x === c)); pts = {}; fit = null; img.src = photos[idx].url; }));
    if (aiMeasure) $("#ms-ai").onclick = async () => {
      const b = $("#ms-ai"); b.disabled = true; b.textContent = "Midiendo…";
      try { const v = await aiMeasure(photos[idx].url); if (v && v.width_cm > 0) { Win.value = round05(+v.width_cm); Hin.value = round05(+v.height_cm); touched.w = touched.h = true; toast?.("Medidas estimadas con IA"); } else toast?.("No encontré la tarjeta en la foto"); }
      catch (e) { toast?.(e.message); }
      b.disabled = false; b.textContent = "✨ Medir con IA";
    };
    $("#ms-save").onclick = () => {
      const w = num(Win.value), h = num(Hin.value), d = num(Din.value);
      if (!w || !h) return toast?.("Falta el ancho o el alto");
      onSave?.({ w, h, d: d || null, dEstimated: dEst && !touched.d, box: shippingBox([w, h, d || 0]), mode, card: pts.card, fitError: fit?.r ?? null });
      close();
    };
    window.addEventListener("resize", draw, { passive: true });
    img.onload = () => { pts = {}; fit = null; detect(); };
    img.src = photos[0].url;
    // para pruebas automáticas
    el._ms = { get pts() { return pts; }, get fit() { return fit; }, get cands() { return cands; }, set: (key, v) => { pts[key] = v; if (key === "card") setCard(v); compute(); }, setMode: (m) => el.querySelector(`.ms-modes [data-mode="${m}"]`).click() };
  });
}

// Solo para pruebas/diagnóstico
export const _internals = { grayFrom, blur, lineSegments, mergeLines, colorGradient, regionQuads };
