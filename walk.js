/* Shoppers Miami — caminata real en primera persona por el mall (escena v2 de Codex).
 * Reproduce, tramo a tramo, la ruta más corta entre la tienda de origen y la de destino (mall/v2/walk.json),
 * con los afiches reales de las ofertas pegados detrás del vidrio de cada vitrina (esquinas por cuadro,
 * con oclusión) y termina en el encuadre exacto de la vitrina estática.
 * API:  MallWalk.play({ from, to, label, done, picks(cat) -> [{o,img,brand,title,price,badge}], open(pick) }) -> bool
 * El mapeo de las 10 tiendas de la escena a las tiendas de la app vive SOLO en mall/v2/tiendas.json.
 */
(function () {
  "use strict";
  const BASE = "mall/v2/";
  const S = { data: null, tiendas: null, cur: null };
  const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const bust = () => "?v=" + ((S.data && S.data.version) || "0");

  async function load() {
    try {
      const [w, t] = await Promise.all([fetch(BASE + "walk.json", { cache: "no-cache" }), fetch(BASE + "tiendas.json", { cache: "no-cache" })]);
      if (!w.ok || !t.ok) return;
      S.data = await w.json(); S.tiendas = await t.json();
    } catch (e) { /* sin caminata: la app usa su transición de siempre */ }
  }
  const loading = load();

  // ---------- mapeo escena <-> app ----------
  function sceneOf(cat) {
    const T = S.tiendas; if (!T || !cat) return null;
    if (T.destino_de_app && T.destino_de_app[cat]) return T.destino_de_app[cat];
    const e = T.escena_a_app || {};
    return Object.keys(e).sort().find((k) => e[k] === cat) || null;
  }
  const catOf = (sid) => (S.tiendas && S.tiendas.escena_a_app || {})[sid] || null;
  const sceneName = (sid) => (S.tiendas && S.tiendas.nombres_escena || {})[sid] || sid;

  // ---------- geometría: imagen maestra -> pantalla ----------
  function variant() { return innerWidth / Math.max(1, innerHeight) < 1 ? "m" : "d"; }
  function mapping(v) {
    const D = S.data, r = D.crops[v].rect, VW = innerWidth, VH = innerHeight;
    const k = Math.max(VW / r[2], VH / r[3]);
    return { k, ox: (VW - r[2] * k) / 2 - r[0] * k, oy: (VH - r[3] * k) / 2 - r[1] * k };
  }
  // homografía rectángulo -> cuadrilátero (CSS matrix3d)
  const adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
  const mm = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s; } return c; };
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const basis = (p) => { const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1]; const v = mv(adj(m), [p[6], p[7], 1]); return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
  function quadMatrix(w, h, q) {   // q: TL,TR,BR,BL (x,y) en pantalla
    const s = basis([0, 0, w, 0, 0, h, w, h]), d = basis([q[0], q[1], q[2], q[3], q[6], q[7], q[4], q[5]]);
    const t = mm(d, adj(s)); for (let i = 0; i < 9; i++) t[i] /= t[8];
    return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
  }

  // ---------- afiches (canvas con la foto real, papel, precio y reflejo de vidrio) ----------
  const PW = 236, PH = 334;                       // A1: 59,4 × 84,1 cm
  const imgCache = new Map();
  function photo(url) {
    if (!url) return null;
    if (!imgCache.has(url)) { const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async"; im.src = url; imgCache.set(url, im); }
    return imgCache.get(url);
  }
  function drawPoster(cv, p, mask) {
    const g = cv.getContext("2d"); g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, PW, PH);
    g.fillStyle = "#f7f3ec"; g.fillRect(0, 0, PW, PH);
    const ph = photo(p.img), py = 14, pw = PW - 28, phh = Math.round(PH * 0.66);
    if (ph && ph.complete && ph.naturalWidth) {
      const s = Math.max(pw / ph.naturalWidth, phh / ph.naturalHeight), iw = ph.naturalWidth * s, ih = ph.naturalHeight * s;
      g.save(); g.beginPath(); g.rect(14, py, pw, phh); g.clip(); g.drawImage(ph, 14 + (pw - iw) / 2, py + (phh - ih) / 2, iw, ih); g.restore();
    } else { g.fillStyle = "#d9d1c4"; g.fillRect(14, py, pw, phh); }
    g.fillStyle = "#1d1a17"; g.textBaseline = "alphabetic";
    let y = py + phh + 30;
    if (p.brand) { g.font = "600 15px 'Jost', system-ui, sans-serif"; g.fillStyle = "#8a6d3b"; g.fillText(String(p.brand).toUpperCase().slice(0, 22), 16, y); y += 24; }
    g.font = "500 17px 'Jost', system-ui, sans-serif"; g.fillStyle = "#1d1a17"; g.fillText(String(p.title || "").slice(0, 24), 16, y); y += 34;
    g.font = "700 26px 'Jost', system-ui, sans-serif"; g.fillText(p.price || "", 16, Math.min(y, PH - 16));
    if (p.badge) {
      g.fillStyle = "#b3122e"; g.beginPath(); g.arc(PW - 40, 42, 32, 0, 2 * Math.PI); g.fill();
      g.fillStyle = "#fff"; g.font = "700 19px 'Jost', system-ui, sans-serif"; g.textAlign = "center"; g.fillText(p.badge, PW - 40, 49); g.textAlign = "start";
    }
    // luz de la escena y leve reflejo del vidrio
    g.fillStyle = "rgba(24,21,18,.24)"; g.fillRect(0, 0, PW, PH);            // detrás del vidrio extraclaro: algo menos de luz
    const r = g.createLinearGradient(0, 0, PW * .9, PH);
    r.addColorStop(0, "rgba(214,228,240,.26)"); r.addColorStop(.33, "rgba(214,228,240,.07)"); r.addColorStop(.55, "rgba(214,228,240,0)"); r.addColorStop(.8, "rgba(214,228,240,.05)"); r.addColorStop(1, "rgba(214,228,240,.14)");
    g.fillStyle = r; g.fillRect(0, 0, PW, PH);
    if (mask) {   // oclusión 6×8 (macetero, palmera, pilastra delante del afiche): borde suave
      const m = document.createElement("canvas"); m.width = 6; m.height = 8;
      const mg = m.getContext("2d"), id = mg.createImageData(6, 8);
      const bits = BigInt("0x" + mask).toString(2).padStart(48, "0");
      for (let i = 0; i < 48; i++) { id.data[4 * i + 3] = bits[i] === "1" ? 255 : 0; }
      mg.putImageData(id, 0, 0);
      g.globalCompositeOperation = "destination-in"; g.imageSmoothingEnabled = true; g.drawImage(m, 0, 0, PW, PH);
      g.globalCompositeOperation = "source-over";
    }
  }
  const ZONES_BY_N = { 1: [4], 2: [0, 1], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

  // ---------- reproductor ----------
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function play(opts) {
    const D = S.data;
    if (!D || !S.tiendas || reduce()) return false;
    if (S.cur) return true;                       // ya hay una caminata en curso
    const fromId = opts.from ? sceneOf(opts.from) : null, toId = opts.to ? sceneOf(opts.to) : null;
    if (!toId || (opts.from && !fromId) || fromId === toId) return false;
    const key = (fromId ? "S" + fromId : "E") + ">S" + toId;
    const route = D.routes[key];
    if (!route || !route.length) return false;
    const clips = route.map((id) => ({ id, ...(D.clips[id] || {}) }));
    const anyReady = clips.some((c) => c.ready), endStill = D.stills && D.stills[toId];
    if (!anyReady && !endStill) return false;     // nada renderizado aún: transición de siempre
    new Walk(opts, clips, fromId, toId).start();
    return true;
  }

  class Walk {
    constructor(opts, clips, fromId, toId) {
      this.o = opts; this.clips = clips; this.fromId = fromId; this.toId = toId;
      this.v = variant(); this.i = -1; this.dead = false; this.paused = false;
      this.meters = clips.reduce((a, c) => a + (c.meters || 0), 0);
      this.total = clips.reduce((a, c) => a + (c.seconds || 0), 0); this.elapsed = 0;
      this.picks = new Map(); this.af = new Map(); this.posters = new Map();
    }
    start() {
      S.cur = this;
      const ov = this.ov = el("div", "mw mw-" + this.v);
      ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", this.o.label || "Caminando por el mall");
      ov.innerHTML = `<div class="mw-stage"><video class="mw-vid" muted playsinline preload="auto" aria-hidden="true"></video><video class="mw-vid" muted playsinline preload="auto" aria-hidden="true"></video>
          <img class="mw-img mw-a" alt="" aria-hidden="true"><img class="mw-img mw-b" alt="" aria-hidden="true"><div class="mw-posters"></div></div>
        <div class="mw-ui"><button type="button" class="mw-btn mw-back" aria-label="Volver sin caminar"><span aria-hidden="true">←</span> Volver</button>
          <button type="button" class="mw-btn mw-skip" aria-label="Saltar la caminata">Saltar <span aria-hidden="true">»</span></button>
          <div class="mw-foot"><div class="mw-label">${esc(this.o.label || "")}</div><div class="mw-meta">${Math.round(this.meters)} m · ${Math.max(1, Math.round(this.total))} s a pie</div>
          <div class="mw-bar"><i></i></div></div></div>`;
      document.body.appendChild(ov); document.body.classList.add("mw-on");
      this.vids = [...ov.querySelectorAll(".mw-vid")]; this.imgs = [ov.querySelector(".mw-a"), ov.querySelector(".mw-b")];
      this.layer = ov.querySelector(".mw-posters"); this.bar = ov.querySelector(".mw-bar i");
      ov.querySelector(".mw-back").onclick = () => this.cancel();
      ov.querySelector(".mw-skip").onclick = () => this.finish(true);
      this.onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); this.cancel(); } };
      document.addEventListener("keydown", this.onKey);
      this.onResize = () => { const nv = variant(); if (nv !== this.v) { this.v = nv; ov.className = ov.className.replace(/mw-[md]\b/, "mw-" + nv); this.reloadVariant(); } this.drawPosters(); };
      addEventListener("resize", this.onResize);
      // primera imagen: la vitrina de origen (misma pose que el primer cuadro de la salida)
      const st0 = this.fromId && S.data.stills[this.fromId];
      if (st0) this.showStill(this.imgs[0], st0.image); else this.imgs[0].removeAttribute("src");
      requestAnimationFrame(() => ov.classList.add("go"));
      this.prefetch(0); this.prefetch(1);
      setTimeout(() => this.next(), st0 ? 260 : 120);
    }
    src(c, kind) { return BASE + "c/" + encodeURIComponent(c.id) + kind + bust(); }
    prefetch(i) {
      const c = this.clips[i]; if (!c || !c.ready || this.af.has(c.id)) return;
      this.af.set(c.id, fetch(this.src(c, ".json")).then((r) => r.json()).then((j) => j.afiches).catch(() => []));
    }
    showStill(img, rel) {   // foto maestra completa ubicada con el mismo recorte que el video
      const M = mapping(this.v), [W, H] = S.data.master;
      img.src = BASE + rel + bust();
      Object.assign(img.style, { left: M.ox + "px", top: M.oy + "px", width: W * M.k + "px", height: H * M.k + "px", objectFit: "fill" });
      img.classList.add("on");
    }
    async next() {
      if (this.dead) return;
      this.i++;
      const c = this.clips[this.i];
      if (!c) return this.finish(false);
      this.prefetch(this.i); this.prefetch(this.i + 1);
      if (!c.ready) return this.bridge(c);
      const vid = this.vids[this.i % 2], other = this.vids[(this.i + 1) % 2];
      if (!vid.dataset.clip || vid.dataset.clip !== c.id) { vid.src = this.src(c, "_" + this.v + ".mp4"); vid.dataset.clip = c.id; }
      this.afiches = await this.af.get(c.id); this.clip = c;
      if (this.dead) return;
      try { vid.currentTime = 0; await vid.play(); } catch (e) { return this.bridge(c); }
      vid.classList.add("on"); other.classList.remove("on"); other.pause();
      this.imgs.forEach((im) => im.classList.remove("on"));
      // precarga del tramo siguiente en el otro video (sin cortes entre tramos)
      const n = this.clips[this.i + 1];
      if (n && n.ready) { other.src = this.src(n, "_" + this.v + ".mp4"); other.dataset.clip = n.id; other.load(); }
      this.loop(vid, c);
      let stall = null;
      vid.onwaiting = () => { clearTimeout(stall); stall = setTimeout(() => { if (!this.dead && vid.paused === false && vid.readyState < 3) { vid.onended = null; this.elapsed += c.seconds - vid.currentTime; this.bridge(null); } }, 4000); };
      vid.onplaying = () => clearTimeout(stall);
      vid.onended = () => { clearTimeout(stall); vid.onended = null; this.elapsed += c.seconds; this.next(); };
    }
    loop(vid, c) {
      const step = (now, meta) => {
        if (this.dead || this.clip !== c) return;
        const t = meta ? meta.mediaTime : vid.currentTime;
        this.pos = t * 12; this.drawPosters();
        this.bar.style.width = Math.min(100, (100 * (this.elapsed + t)) / Math.max(1, this.total)) + "%";
        if (!vid.ended) vid.requestVideoFrameCallback ? vid.requestVideoFrameCallback(step) : requestAnimationFrame(() => step(0, null));
      };
      vid.requestVideoFrameCallback ? vid.requestVideoFrameCallback(step) : requestAnimationFrame(() => step(0, null));
    }
    // tramo aún sin renderizar: se acerca suavemente al siguiente encuadre disponible (sin saltos bruscos)
    bridge(c) {
      if (this.dead) return;
      this.clip = null; this.layer.textContent = ""; this.posters.clear();
      let j = this.i + 1; while (this.clips[j] && !this.clips[j].ready) j++;
      const nx = this.clips[j], last = j >= this.clips.length;
      const cur = this.ov.querySelector(".mw-vid.on, .mw-img.on");
      const to = this.imgs[cur === this.imgs[0] ? 1 : 0];
      const endSt = S.data.stills[this.toId];
      if (nx) { to.src = this.src(nx, "_" + this.v + ".jpg"); Object.assign(to.style, { left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover" }); }
      else if (endSt) this.showStill(to, endSt.image);
      else { const pv = this.clips[this.clips.length - 1]; if (pv && pv.ready) { to.src = this.src(pv, "_" + this.v + "e.jpg"); Object.assign(to.style, { left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover" }); } }
      const secs = this.clips.slice(this.i, j).reduce((a, x) => a + (x.seconds || 0), 0);
      const dur = Math.min(1700, 700 + secs * 70);
      this.ov.classList.add("mw-bridging");
      if (cur) { cur.classList.add("mw-leave"); cur.style.transitionDuration = dur + "ms"; }
      to.classList.remove("on"); to.classList.add("mw-enter"); to.style.transitionDuration = dur + "ms";
      const go = () => requestAnimationFrame(() => requestAnimationFrame(() => { to.classList.add("on"); to.classList.remove("mw-enter"); }));
      to.complete ? go() : (to.onload = go, to.onerror = go);
      this.bar.style.transition = `width ${dur}ms linear`; this.elapsed += secs; this.bar.style.width = Math.min(100, (100 * this.elapsed) / Math.max(1, this.total)) + "%";
      setTimeout(() => {
        if (this.dead) return;
        this.bar.style.transition = "";
        if (cur) { cur.classList.remove("on", "mw-leave"); cur.style.transitionDuration = ""; if (cur.pause) cur.pause(); }
        this.ov.classList.remove("mw-bridging");
        this.i = j - 1;
        if (last) this.finish(false); else this.next();
      }, dur + 40);
    }
    reloadVariant() {   // giro del teléfono a mitad de camino: mismo tramo, otro recorte
      const vid = this.ov.querySelector(".mw-vid.on"); if (!vid || !this.clip) return;
      const t = vid.currentTime, c = this.clip;
      vid.src = this.src(c, "_" + this.v + ".mp4"); vid.currentTime = t; vid.play().catch(() => {});
      this.vids.forEach((x) => { if (x !== vid) x.removeAttribute("src"), (x.dataset.clip = ""); });
      this.loop(vid, c);
    }
    picksFor(sidx) {
      const cat = catOf(String(sidx + 1).padStart(2, "0"));
      if (!cat || typeof this.o.picks !== "function") return [];
      if (!this.picks.has(cat)) { let p = []; try { p = (this.o.picks(cat) || []).slice(0, 4); } catch (e) {} this.picks.set(cat, p); }
      return this.picks.get(cat);
    }
    drawPosters() {
      const A = this.afiches; if (!A || !A.length || this.pos == null) return;
      const k0 = Math.max(0, Math.min(A.length - 1, Math.floor(this.pos))), k1 = Math.min(A.length - 1, k0 + 1), f = Math.min(1, Math.max(0, this.pos - k0));
      const M = mapping(this.v);
      const b = new Map(); for (const e of A[k1] || []) b.set(e[0] + ":" + e[1], e);
      const seen = new Set();
      for (const a of A[k0] || []) {
        const ps = this.picksFor(a[0]); if (!ps.length) continue;
        const zones = ZONES_BY_N[Math.min(4, ps.length)], zi = zones.indexOf(a[1]); if (zi < 0) continue;
        const key = a[0] + ":" + a[1], e1 = b.get(key) || a, p = ps[zi];
        const q = []; for (let i = 2; i < 10; i++) { const v = a[i] + (e1[i] - a[i]) * f; q.push(i % 2 ? M.oy + v * M.k : M.ox + v * M.k); }
        let P = this.posters.get(key);
        if (!P) {
          const cv = el("canvas", "mw-poster"); cv.width = PW; cv.height = PH; cv.tabIndex = 0; cv.setAttribute("role", "button");
          cv.setAttribute("aria-label", `${p.title || "Oferta"}${p.brand ? ", " + p.brand : ""}${p.price ? ", " + p.price : ""}. Ver la oferta`);
          const open = (ev) => { ev.preventDefault(); ev.stopPropagation(); this.openPick(p); };
          cv.addEventListener("click", open); cv.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") open(ev); });
          P = { cv, mask: undefined, pick: p }; this.posters.set(key, P); this.layer.appendChild(cv);
          const ph = photo(p.img); if (ph && !ph.complete) ph.addEventListener("load", () => drawPoster(cv, p, P.mask), { once: true });
        }
        const mask = f < 0.5 ? a[10] : e1[10];
        if (P.mask !== mask) { P.mask = mask; drawPoster(P.cv, p, mask); }
        P.cv.style.transform = quadMatrix(PW, PH, q); P.cv.style.visibility = "visible";
        seen.add(key);
      }
      for (const [key, P] of this.posters) if (!seen.has(key)) P.cv.style.visibility = "hidden";
    }
    openPick(p) {
      if (typeof this.o.open !== "function") return;
      const vid = this.ov.querySelector(".mw-vid.on"); if (vid) vid.pause(); this.paused = true;
      this.o.open(p);
      const root = document.getElementById("sheet-root");
      const mo = new MutationObserver(() => {
        if (root.firstElementChild) return;
        mo.disconnect(); this.paused = false;
        if (!this.dead && vid && !vid.ended) vid.play().catch(() => {});
      });
      mo.observe(root, { childList: true });
    }
    teardown() {
      this.dead = true; S.cur = null; document.body.classList.remove("mw-on");
      document.removeEventListener("keydown", this.onKey); removeEventListener("resize", this.onResize);
      this.vids.forEach((v) => { v.pause(); v.onended = v.onwaiting = v.onplaying = null; });
    }
    cancel() {   // Volver: se queda donde estaba, sin llegar
      if (this.dead) return; this.teardown();
      this.ov.classList.add("out"); setTimeout(() => this.ov.remove(), 420);
    }
    finish(skipped) {
      if (this.dead) return;
      const atEnd = !skipped;
      this.teardown();
      const M = mapping(this.v), endSt = S.data.stills[this.toId];
      try { this.o.done(); } catch (e) { console.error(e); }
      window.scrollTo(0, 0);
      // cierre: la última imagen (pose exacta de vitrina) se lleva al encuadre de la vitrina estática
      const ov = this.ov, [W, H] = S.data.master;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = document.querySelector(".vf3-img");
        const same = target && endSt && target.currentSrc && target.currentSrc.indexOf(endSt.image.split("/").pop()) >= 0;
        if (atEnd && same) {
          const im = el("img", "mw-fly"); im.alt = ""; im.src = target.currentSrc;
          Object.assign(im.style, { left: M.ox + "px", top: M.oy + "px", width: W * M.k + "px", height: H * M.k + "px" });
          ov.appendChild(im); this.layer.style.opacity = "0";
          const r = target.getBoundingClientRect();
          requestAnimationFrame(() => {
            ov.classList.add("mw-landing");
            Object.assign(im.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
            setTimeout(() => ov.classList.add("out"), 520);
            setTimeout(() => ov.remove(), 900);
          });
        } else {
          ov.classList.add("out"); setTimeout(() => ov.remove(), 520);
        }
      }));
    }
  }

  window.MallWalk = {
    play, ready: () => !!(S.data && S.tiendas), loading,
    // estado para pruebas y depuración
    _state: () => ({ data: !!S.data, cur: S.cur ? { i: S.cur.i, clip: S.cur.clip && S.cur.clip.id, pos: S.cur.pos, route: S.cur.clips.map((c) => c.id + (c.ready ? "" : "*")) } : null }),
    _cur: () => S.cur,
    _route: (from, to) => { const a = from ? sceneOf(from) : null, b = sceneOf(to); return S.data && S.data.routes[(a ? "S" + a : "E") + ">S" + b]; },
  };
})();
