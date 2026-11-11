// Mi Shopper Miami — detección de la tarjeta en segundo plano (no congela la pantalla).
import { detectCard } from "./measure.js";
self.onmessage = (e) => {
  const { id, bmp } = e.data || {};
  try {
    const r = detectCard(bmp);
    bmp.close?.();
    self.postMessage({ id, ok: true, W: r.W, H: r.H, ms: r.ms, candidates: r.candidates.map((c) => ({ quad: c.quad, score: c.score, shape: c.shape, paper: c.paper, contrast: c.contrast })) });
  } catch (err) { self.postMessage({ id, ok: false, error: String((err && err.message) || err) }); }
};
