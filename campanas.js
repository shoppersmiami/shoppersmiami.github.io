// =====================================================================
// Shoppers Miami — "Afiches de la vitrina": 4 pantallas por tienda
//  · Cada vitrina tiene 4 afiches (2×2 en el vidrio, numerados 1–4 en orden de lectura). En "Mis tiendas"
//    → tienda, Cheryl ve las 4 "pantallas" (como un switch de TV): toca una, sube una foto o busca una de
//    sus ofertas, ve la vista previa y toca "Aprobar y publicar". "Quitar" deja la pantalla en automático.
//  · Modelo (una sola verdad para el panel, la vitrina 2D y el mall 3D → screens(cat)):
//      - pantalla con OFERTA  = oferta destacada (featured) con vitrina_pos = número de pantalla − 1
//      - pantalla con FOTO    = settings.campaigns[cat].slots[i] = { img, title, updated_at }  (demo)
//                               fila (cat, slot) de public.store_campaigns                     (Supabase)
//      - pantalla sin elegir  = "Automático": la oferta con mayor descuento que no esté ya en el vidrio
//                               (si la tienda no tiene ofertas, queda "Vacía")
//  · Formato viejo de un solo afiche { img, title, offer_id } → slot 0 (migración idempotente).
//  · El mall 3D (walk3d If(cat, picks, campaign)) recibe picks(cat) = las 4 pantallas en orden; las
//    fotos van con campaign:true (walk3d las dibuja sin precio, con su título) y campaign(cat) = null,
//    así If() no duplica ni corre el orden.
//  · Cada cambio (pantallas u ofertas publicadas/editadas/eliminadas/movidas) avisa a la caminata
//    con window.MallWalk.refreshOffers().
// Script clásico: se carga ANTES de app.js (módulo); app.js le pasa sus utilidades por window.MSApp.
// =====================================================================
(function () {
  "use strict";

  var A = function () { return window.MSApp || {}; };
  var S = function () { return A().state || {}; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var nowIso = function () { return new Date().toISOString(); };
  var toast = function (m) { (A().toast || console.log)(m); };
  var SEED_FLAG = "mig_campaigns";
  var N = 4;               // pantallas por vitrina (= VITRINA_MAX de app.js)
  var local = null;        // demo: { db, save }
  var remote = null;       // Supabase: { cat: { slots: [rec|null ×4] } } leído de store_campaigns
  var TEXT_MAX = 60, TITLE_INPUT_MAX = 40;

  // ---------------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------------
  var isDemo = function () { var st = S(); return !st.api || !!st.api.demo; };
  var cleanRec = function (r) {
    if (!r || typeof r !== "object" || typeof r.img !== "string" || !r.img.trim()) return null;
    var o = { img: r.img, title: String(r.title || "").slice(0, TEXT_MAX), updated_at: r.updated_at || nowIso() };
    if (r.offer_id) o.offer_id = r.offer_id;
    return o;
  };
  // { slots: [rec|null ×4] } desde cualquier formato (nuevo, o el viejo de un solo afiche → slot 0)
  function norm(v) {
    var slots = [null, null, null, null];
    if (v && Array.isArray(v.slots)) for (var i = 0; i < N; i++) slots[i] = cleanRec(v.slots[i]);
    else if (v && typeof v === "object") slots[0] = cleanRec(v);
    return { slots: slots };
  }
  function all() {
    if (isDemo()) return (local && local.db.settings && local.db.settings.campaigns) || (S().settings && S().settings.campaigns) || {};
    return remote || {};
  }
  var slotsOf = function (cat) { return norm(all()[cat]).slots; };
  var photoSlots = function (cat) { var s = slotsOf(cat), r = []; for (var i = 0; i < N; i++) if (s[i]) r.push(i); return r; };
  // Demo: 3 tiendas con un afiche sembrado (formato viejo → migra a slot 0). Idempotente.
  function attachLocal(db, save) {
    local = { db: db, save: save };
    var ch = false;
    if (!db.settings) { db.settings = {}; ch = true; }
    if (!db.settings.campaigns || typeof db.settings.campaigns !== "object" || Array.isArray(db.settings.campaigns)) { db.settings.campaigns = {}; ch = true; }
    var c = db.settings.campaigns;
    if (!db[SEED_FLAG]) {
      var t = nowIso();
      if (!c.Carteras) c.Carteras = { img: "demo/img/carteras/11.jpg", title: "Nueva colección de carteras", offer_id: null, updated_at: t };
      if (!c.Relojes) c.Relojes = { img: "demo/img/relojes/03.jpg", title: "Relojes para regalar · hasta −40%", offer_id: null, updated_at: t };
      if (!c.Invierno) c.Invierno = { img: "demo/img/invierno/02.jpg", title: "Parkas para el invierno en Chile", offer_id: null, updated_at: t };
      db[SEED_FLAG] = t; ch = true;
    }
    // migración: { img, title, offer_id } → { slots: [rec, null, null, null] } (lo ya migrado no cambia)
    Object.keys(c).forEach(function (k) {
      var v = c[k];
      if (v && Array.isArray(v.slots) && v.slots.length === N) return;
      var n = norm(v);
      if (n.slots.some(Boolean)) c[k] = n; else delete c[k];
      ch = true;
    });
    if (ch) save();
  }
  // Supabase: lee todas las pantallas con foto (lectura pública). Sin la columna slot (esquema viejo) → slot 0.
  async function load() {
    var st = S(); if (isDemo() || !st.api || !st.api.sb) return all();
    try {
      var r = await st.api.sb.from("store_campaigns").select("cat, slot, img_url, title, offer_id, updated_at");
      if (r.error && /slot/.test(r.error.message || "")) r = await st.api.sb.from("store_campaigns").select("cat, img_url, title, offer_id, updated_at");
      if (r.error) throw r.error;
      var m = {};
      (r.data || []).forEach(function (x) {
        var i = Number(x.slot) || 0; if (i < 0 || i >= N) return;
        m[x.cat] = m[x.cat] || { slots: [null, null, null, null] };
        m[x.cat].slots[i] = cleanRec({ img: x.img_url, title: x.title, offer_id: x.offer_id, updated_at: x.updated_at });
      });
      remote = m;
    } catch (e) { console.warn("Pantallas de la vitrina", e); if (!remote) remote = {}; }
    refreshWalk();
    return remote;
  }
  // Guarda (rec) o vacía (null) la pantalla i de una tienda
  async function putSlot(cat, i, rec) {
    var st = S(); i = Number(i);
    if (!(i >= 0 && i < N)) throw new Error("Pantalla inválida");
    rec = rec ? cleanRec({ img: rec.img, title: rec.title, offer_id: rec.offer_id, updated_at: nowIso() }) : null;
    if (isDemo()) {
      var next = Object.assign({}, all()), n = norm(next[cat]);
      n.slots[i] = rec;
      if (n.slots.some(Boolean)) next[cat] = n; else delete next[cat];
      var saved = await st.api.saveSettings({ campaigns: next });
      st.settings.campaigns = (saved && saved.campaigns) || next;
    } else {
      var r = rec
        ? await st.api.sb.from("store_campaigns").upsert({ cat: cat, slot: i, img_url: rec.img, title: rec.title || null, offer_id: null, updated_at: rec.updated_at }, { onConflict: "cat,slot" })
        : await st.api.sb.from("store_campaigns").delete().eq("cat", cat).eq("slot", i);
      if (r.error) throw new Error(r.error.message);
      remote = Object.assign({}, remote || {});
      var m = norm(remote[cat]); m.slots[i] = rec; remote[cat] = m;
    }
    return rec;
  }
  // Compatibilidad con la API anterior (un solo afiche = pantalla 1)
  var put = function (cat, rec) { return putSlot(cat, 0, rec); };
  async function del(cat) { var s = slotsOf(cat); for (var i = 0; i < N; i++) if (s[i]) await putSlot(cat, i, null); }
  // Foto de la pantalla: ~1400 px JPEG 0,85 (resizeImage de app.js). En la demo queda en el teléfono
  // como data: (si pesa mucho se baja un poco para cuidar el espacio); en Supabase va al bucket "photos".
  async function upload(file) {
    var app = A(), st = S();
    var blob = await app.resizeImage(file, 1400, 0.85);
    if (!blob) throw new Error("No pudimos leer esa foto. Prueba con otra.");
    if (isDemo()) {
      if (blob.size > 520e3) blob = await app.resizeImage(file, 1100, 0.8);
      return await app.blobToDataURL(blob);
    }
    return await st.api.uploadPhoto(blob, "campaigns");
  }

  // ---------------------------------------------------------------------------
  // Las 4 pantallas: lo que eligió Cheryl (foto u oferta) y, en lo que falte, el automático
  // ---------------------------------------------------------------------------
  var photo = function (o) { var app = A(); var p = app.photosOf ? app.photosOf(o)[0] : null; return (p && p.url) || o.photo_url || ""; };
  var pct = function (o) { return Number(o.discount_pct) > 0 && Number(o.tag_price_usd) > 0 ? Number(o.discount_pct) : 0; };
  var newest = function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); };
  var posOf = function (o) { var p = o.vitrina_pos; return p === null || p === undefined || p === "" || !Number.isFinite(+p) ? 99 : +p; };
  function pool(cat) {
    var app = A(); if (!app.offersIn) return [];
    var now = Date.now();
    return app.offersIn(cat, S().offers || []).filter(function (o) { return o.status !== "gone" && !o.reserved_for && (!o.expires_at || new Date(o.expires_at).getTime() > now); });
  }
  // opt.gender: catálogo elegido por la clienta (solo ordena el automático)
  function screens(cat, opt) {
    opt = opt || {};
    var app = A(), list = pool(cat), ph = slotsOf(cat), out = [null, null, null, null], used = {};
    for (var i = 0; i < N; i++) if (ph[i]) out[i] = { pos: i, kind: "photo", rec: ph[i] };
    var feats = list.filter(function (o) { return o.featured; }).sort(function (a, b) { return posOf(a) - posOf(b) || newest(a, b); });
    var rest = [];
    // cada destacada va a su pantalla (vitrina_pos); si está ocupada o no tiene número, a la primera libre
    feats.forEach(function (o) { var p = posOf(o); if (p >= 0 && p < N && p === Math.floor(p) && !out[p]) { out[p] = { pos: p, kind: "offer", o: o }; used[o.id] = 1; } else rest.push(o); });
    rest.forEach(function (o) { var p = out.indexOf(null); if (p < 0) return; out[p] = { pos: p, kind: "offer", o: o }; used[o.id] = 1; });
    var g = opt.gender !== undefined ? opt.gender : app.shopNeedsGender && app.getGender && app.shopNeedsGender(cat) ? app.getGender() : "";
    var gOk = function (o) { return !g || !app.genderOk || app.genderOk(o, g); };
    var auto = list.filter(function (o) { return !used[o.id]; }).sort(function (a, b) {
      return (gOk(b) ? 1 : 0) - (gOk(a) ? 1 : 0) || (photo(b) ? 1 : 0) - (photo(a) ? 1 : 0) || pct(b) - pct(a) || newest(a, b);
    });
    for (var j = 0; j < N; j++) if (!out[j]) { var o = auto.shift(); out[j] = o ? { pos: j, kind: "auto", o: o } : { pos: j, kind: "empty" }; }
    return out;
  }
  // Para la vitrina 2D (vf3 / vf): ofertas tal cual y fotos como { __photo, id, img, title, slot }
  function vitrinaItems(cat, opt) {
    return screens(cat, opt).filter(function (s) { return s.kind !== "empty"; }).map(function (s) {
      return s.kind === "photo" ? { __photo: true, id: "cp-" + cat + "-" + s.pos, img: s.rec.img, title: s.rec.title || "", slot: s.pos } : s.o;
    });
  }
  // Para el mall 3D: wPick(o) = afiche de oferta de app.js; las fotos van como campaña (sin precio, con título)
  function picks3d(cat, wPick) {
    return vitrinaItems(cat).map(function (x) { return x.__photo ? { img: x.img, title: x.title, campaign: true, slot: x.slot } : wPick ? wPick(x) : x; });
  }
  // Ya no hay un afiche aparte: las fotos están dentro de picks(cat) en su pantalla. walk3d recibe null.
  function campaignFor() { return null; }
  // Automático (compatibilidad): la oferta con foto de mayor descuento
  function defaultFor(cat) {
    var s = screens(cat).filter(function (x) { return x.kind === "auto" && photo(x.o); })[0];
    return s ? { img: photo(s.o), title: s.o.title || "", offer_id: s.o.id } : null;
  }
  function info(cat) { return screens(cat); }

  // ---------------------------------------------------------------------------
  // Avisar a la caminata. Con pausa corta: un cambio de orden guarda varias ofertas seguidas.
  // ---------------------------------------------------------------------------
  var tRefresh = null;
  function refreshWalk() { try { window.MallWalk && window.MallWalk.refreshOffers && window.MallWalk.refreshOffers(); } catch (e) { console.warn("MallWalk.refreshOffers", e); } }
  function offersChanged() {
    clearTimeout(tRefresh);
    tRefresh = setTimeout(async function () {
      var st = S();
      try { if (st.api) st.offers = await st.api.listOffers(); } catch (e) {}
      refreshWalk();
    }, 150);
  }
  // Envuelve publicar / editar / eliminar / mover ofertas de la API para avisar a la caminata
  function attach(api) {
    if (!api || api.__camp) return api;
    ["createOffer", "updateOffer", "deleteOffer"].forEach(function (k) {
      var f = api[k]; if (typeof f !== "function") return;
      api[k] = async function () { var r = await f.apply(api, arguments); offersChanged(); return r; };
    });
    api.__camp = true;
    if (!api.demo) load();
    return api;
  }

  // ---------------------------------------------------------------------------
  // Aplicar un nuevo arreglo de pantallas: next = [ {kind:"photo",rec} | {kind:"offer",o} | null ] ×4
  // (null = automático). Las ofertas que salen del vidrio pasan adentro de la tienda.
  // ---------------------------------------------------------------------------
  var explicit = function (cat) { return screens(cat).map(function (s) { return s.kind === "photo" ? { kind: "photo", rec: s.rec } : s.kind === "offer" ? { kind: "offer", o: s.o } : null; }); };
  async function applyLayout(cat, next) {
    var st = S(), cur = explicit(cat), i;
    var nextIds = {}; next.forEach(function (x) { if (x && x.kind === "offer") nextIds[x.o.id] = 1; });
    // 1) ofertas que salen
    for (i = 0; i < N; i++) { var c = cur[i]; if (c && c.kind === "offer" && !nextIds[c.o.id]) await st.api.updateOffer(c.o.id, { featured: false, vitrina_pos: null }); }
    // 2) fotos
    for (i = 0; i < N; i++) {
      var a = cur[i] && cur[i].kind === "photo" ? cur[i].rec : null, b = next[i] && next[i].kind === "photo" ? next[i].rec : null;
      if (!a && !b) continue;
      if (a && b && a.img === b.img && (a.title || "") === (b.title || "")) continue;
      await putSlot(cat, i, b);
    }
    // 3) ofertas que entran o cambian de pantalla
    for (i = 0; i < N; i++) {
      var x = next[i]; if (!x || x.kind !== "offer") continue;
      if (!x.o.featured || posOf(x.o) !== i) await st.api.updateOffer(x.o.id, { featured: true, vitrina_pos: i });
    }
    try { st.offers = await st.api.listOffers(); } catch (e) {}
    refreshWalk();
  }

  // ---------------------------------------------------------------------------
  // Afiche (mismo diseño que el del mall 3D): foto + marca · nombre + precio + descuento, o foto + título
  // ---------------------------------------------------------------------------
  function offerBits(o) {
    var app = A(), fmt = app.fmtPct || String;
    var price = ""; try { price = app.clp && app.quote ? app.clp(app.quote(o.price_usd, o).clp) : ""; } catch (e) {}
    var d1 = Number(o.discount1_pct) > 0 && Number(o.discount2_pct) > 0;
    var badge = pct(o) ? "−" + fmt(d1 ? o.discount1_pct : o.discount_pct) + "%" : o.promo === "2x1" ? "2×1" : "";
    var badge2 = d1 && pct(o) ? "−" + fmt(o.discount2_pct) + "% extra" : "";
    return { img: photo(o), brand: o.brand || "", title: o.title || "", price: price, badge: badge, badge2: badge2 };
  }
  function posterHTML(s) {
    if (!s || s.kind === "empty") return '<span class="ps-void"><b>Vacía</b><span>toca para elegir</span></span>';
    if (s.kind === "photo") {
      var r = s.rec;
      return '<span class="ps-post ps-pphoto' + (r.title ? "" : " ps-notitle") + '"><span class="ps-pimg"><img src="' + esc(r.img) + '" alt="" loading="lazy"></span>' +
        (r.title ? '<b class="ps-ptitle"><span>' + esc(r.title) + "</span></b>" : "") + "</span>";
    }
    var b = offerBits(s.o);
    return '<span class="ps-post ps-poffer"><span class="ps-pimg">' + (b.img ? '<img src="' + esc(b.img) + '" alt="" loading="lazy">' : '<span class="ps-pno">' + esc((b.brand || b.title).charAt(0)) + "</span>") + "</span>" +
      '<span class="ps-pinfo"><span class="ps-pname">' + esc((b.brand ? b.brand.toUpperCase() + " · " : "") + b.title) + '</span><b class="ps-pprice">' + esc(b.price) + '</b><span class="ps-pcl">puesto en Chile</span></span>' +
      (b.badge ? '<span class="ps-badge">' + esc(b.badge) + "</span>" : "") + (b.badge2 ? '<span class="ps-badge ps-b2">' + esc(b.badge2) + "</span>" : "") + "</span>";
  }
  function capHTML(s) {
    if (s.kind === "photo") return '<span class="ps-k">Foto subida</span>' + (s.rec.title ? "<span>" + esc(s.rec.title) + "</span>" : "<span>sin título</span>");
    if (s.kind === "offer") { var b = offerBits(s.o); return '<span class="ps-k">Oferta</span><span>' + esc(s.o.title) + "</span>" + (b.badge ? '<em>' + esc(b.badge) + "</em>" : ""); }
    if (s.kind === "auto") return '<span class="ps-k">Automático:</span><span>' + esc(s.o.title) + "</span>";
    return '<span class="ps-k">Vacía</span><span>toca para elegir</span>';
  }
  var aria = function (s) {
    var n = "Pantalla " + (s.pos + 1) + ": ";
    if (s.kind === "photo") return n + "foto subida" + (s.rec.title ? ", " + s.rec.title : "") + ". Toca para cambiarla";
    if (s.kind === "offer") return n + "oferta " + s.o.title + ". Toca para cambiarla";
    if (s.kind === "auto") return n + "automático, " + s.o.title + ". Toca para elegir";
    return n + "vacía. Toca para elegir";
  };
  var fold = function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };

  // ---------------------------------------------------------------------------
  // Panel de Cheryl: "Afiches de la vitrina" (Mis tiendas → tienda). onChange: repintar el panel.
  // ---------------------------------------------------------------------------
  function section(anchor, cat, onChange) {
    if (!anchor || !anchor.parentNode) return;
    var sec = document.createElement("section");
    sec.className = "pn-zone ps-zone"; sec.setAttribute("aria-label", "Afiches de la vitrina");
    anchor.parentNode.insertBefore(sec, anchor);
    var done = async function () { if (typeof onChange === "function") await onChange(); else paint(); };
    var paint = function () {
      var sc = screens(cat);
      sec.innerHTML =
        '<h3 class="pn-zh">Afiches de la vitrina <span>4 pantallas, en el orden en que se ven en el vidrio y en el mall</span></h3>' +
        '<div class="ps-wall">' + sc.map(function (s) {
          return '<button type="button" class="ps-scr ps-k-' + s.kind + '" data-ps="' + s.pos + '" aria-label="' + esc(aria(s)) + '">' +
            '<span class="ps-tv"><span class="ps-num" aria-hidden="true">' + (s.pos + 1) + '</span><span class="ps-glass">' + posterHTML(s) + "</span></span>" +
            '<span class="ps-cap">' + capHTML(s) + "</span></button>";
        }).join("") + "</div>" +
        '<p class="ps-note">Toca una pantalla para subir una foto o elegir una oferta. Las que no elijas se llenan solas con la oferta de mayor descuento <span class="ps-autodot">automático</span>.</p>';
      sec.querySelectorAll("[data-ps]").forEach(function (b) { b.onclick = function () { editor(cat, Number(b.dataset.ps), done, b); }; });
    };
    paint();
    return sec;
  }

  // Editor de una pantalla (hoja inferior): subir foto o buscar oferta → vista previa → Aprobar y publicar
  function editor(cat, i, onDone, from) {
    var app = A(), sc = screens(cat), cur = sc[i], draft = null, busy = false, tab = cur.kind === "photo" || !pool(cat).length ? "up" : "find";
    var nowTxt = function (s) { return s.kind === "photo" ? "Ahora: foto subida" : s.kind === "offer" ? "Ahora: oferta elegida" : s.kind === "auto" ? "Ahora: automático (mayor descuento)" : "Ahora: vacía"; };
    var hasOwn = cur.kind === "photo" || cur.kind === "offer";
    app.sheet(
      '<div class="ps-ed" data-ps-ed="' + i + '">' +
      '<h2>Pantalla ' + (i + 1) + ' <span class="ps-of">de 4</span></h2>' +
      '<p class="ps-lede">Lo que apruebes aquí se ve en el afiche ' + (i + 1) + ' de la vitrina y en el mall 3D.</p>' +
      '<div class="ps-edgrid">' +
        '<div class="ps-edprev"><span class="ps-tv ps-tvbig"><span class="ps-num" aria-hidden="true">' + (i + 1) + '</span><span class="ps-glass" id="ps-prev" aria-live="polite"></span></span>' +
          '<span class="ps-state" id="ps-state"></span></div>' +
        '<div class="ps-edctl">' +
          '<div class="ps-tabs" role="tablist" aria-label="Cómo llenar la pantalla">' +
            '<button type="button" role="tab" class="ps-tab" data-tab="up">Subir foto</button>' +
            '<button type="button" role="tab" class="ps-tab" data-tab="find">Buscar en mis ofertas</button></div>' +
          '<div class="ps-pane" data-pane="up">' +
            '<div class="ps-upb"><label class="ps-b ps-main" for="ps-cam">Tomar foto</label><input type="file" id="ps-cam" accept="image/*" capture="environment" hidden>' +
            '<label class="ps-b" for="ps-file">Elegir de la galería</label><input type="file" id="ps-file" accept="image/*" hidden></div>' +
            '<label class="ps-l" for="ps-title">Título del afiche <span>(opcional)</span></label>' +
            '<input class="in ps-in" id="ps-title" maxlength="' + TITLE_INPUT_MAX + '" placeholder="Por ejemplo: Nueva colección" value="' + esc(cur.kind === "photo" ? cur.rec.title || "" : "") + '">' +
          "</div>" +
          '<div class="ps-pane" data-pane="find">' +
            '<input class="in ps-in" id="ps-q" type="search" placeholder="Buscar por nombre o marca" aria-label="Buscar en mis ofertas por nombre o marca" autocomplete="off">' +
            '<div class="ps-list" id="ps-list" role="listbox" aria-label="Ofertas de esta tienda"></div>' +
          "</div>" +
          (hasOwn ? '<div class="ps-move" role="group" aria-label="Mover este afiche"><span class="ps-l ps-mvl">Mover este afiche</span>' +
            '<button type="button" class="ps-b ps-mv" data-mv="-1"' + (i ? "" : " disabled") + '>← A la pantalla ' + Math.max(1, i) + "</button>" +
            '<button type="button" class="ps-b ps-mv" data-mv="1"' + (i < N - 1 ? "" : " disabled") + ">A la pantalla " + Math.min(N, i + 2) + " →</button></div>" : "") +
        "</div>" +
      "</div>" +
      '<div class="ps-foot"><button type="button" class="ps-b ps-ok" id="ps-ok" disabled>Aprobar y publicar</button>' +
        '<button type="button" class="ps-b ps-del" id="ps-del"' + (hasOwn ? "" : " disabled") + ">Quitar</button>" +
        '<button type="button" class="ps-b ps-cancel" data-close>Cancelar</button></div>' +
      "</div>",
      function (el, close) {
        var sh = el.closest(".sheet"); if (sh) sh.classList.add("ps-sheet");
        var $ = function (q) { return el.querySelector(q); };
        var title = $("#ps-title"), q = $("#ps-q");
        var view = function () { return draft || cur; };
        var paint = function () {
          var v = view();
          $("#ps-prev").innerHTML = posterHTML(v);
          $("#ps-state").innerHTML = draft ? '<b class="ps-draft">Vista previa · sin publicar</b>' : esc(nowTxt(cur)) + (cur.kind === "auto" ? ": " + esc(cur.o.title) : "");
          $("#ps-state").className = "ps-state" + (draft ? " on" : "") + (!draft && cur.kind === "auto" ? " auto" : "");
          $("#ps-ok").disabled = !draft || busy;
          $("#ps-del").disabled = (!hasOwn && !draft) || busy;
          var mv = $(".ps-move"); if (mv) mv.hidden = !!draft;   // con una vista previa sin publicar no se mueve lo publicado
        };
        var setTab = function (t) {
          tab = t;
          el.querySelectorAll(".ps-tab").forEach(function (b) { var on = b.dataset.tab === t; b.setAttribute("aria-selected", on ? "true" : "false"); b.classList.toggle("on", on); });
          el.querySelectorAll(".ps-pane").forEach(function (p) { p.hidden = p.dataset.pane !== t; });
        };
        var where = {}; sc.forEach(function (s) { if (s.kind === "offer") where[s.o.id] = s.pos; });
        var list = pool(cat).slice().sort(function (a, b) { return (photo(b) ? 1 : 0) - (photo(a) ? 1 : 0) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || pct(b) - pct(a) || newest(a, b); });
        var paintList = function () {
          var t = fold(q.value.trim());
          var hits = list.filter(function (o) { return !t || fold(o.title).indexOf(t) >= 0 || fold(o.brand).indexOf(t) >= 0; }).slice(0, 60);
          $("#ps-list").innerHTML = hits.length ? hits.map(function (o) {
            var b = offerBits(o), sel = draft && draft.kind === "offer" && draft.o.id === o.id;
            return '<button type="button" class="ps-o' + (sel ? " on" : "") + '" role="option" aria-selected="' + (sel ? "true" : "false") + '" data-pso="' + esc(o.id) + '">' +
              '<span class="ps-oimg">' + (b.img ? '<img src="' + esc(b.img) + '" alt="" loading="lazy">' : "") + "</span>" +
              '<span class="ps-ot"><b>' + esc(o.title) + "</b><small>" + esc([o.brand, b.price].filter(Boolean).join(" · ")) + "</small></span>" +
              (b.badge ? '<em class="ps-obadge">' + esc(b.badge) + "</em>" : "") +
              (where[o.id] !== undefined ? '<span class="ps-on">en pantalla ' + (where[o.id] + 1) + "</span>" : "") + "</button>";
          }).join("") : '<div class="ps-none">' + (list.length ? "Ninguna oferta con ese nombre o marca." : "Esta tienda todavía no tiene ofertas. Sube una foto.") + "</div>";
          el.querySelectorAll("[data-pso]").forEach(function (b) {
            b.onclick = function () {
              var o = list.find(function (x) { return String(x.id) === b.dataset.pso; }); if (!o) return;
              draft = { pos: i, kind: "offer", o: o }; paint(); paintList();
              toast("Mira la vista previa y toca Aprobar y publicar");
            };
          });
        };
        el.querySelectorAll(".ps-tab").forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });
        var onFile = async function (e) {
          var f = e.target.files && e.target.files[0]; e.target.value = "";
          if (!f || busy) return; busy = true; paint();
          toast("Preparando la foto…");
          try { var url = await upload(f); draft = { pos: i, kind: "photo", rec: { img: url, title: title.value.trim() } }; toast("Foto lista: revisa la vista previa y toca Aprobar y publicar"); }
          catch (err) { toast(err.message || "No pudimos leer esa foto"); }
          finally { busy = false; paint(); }
        };
        $("#ps-cam").onchange = onFile; $("#ps-file").onchange = onFile;
        title.oninput = function () {
          var t = title.value.trim();
          if (draft && draft.kind === "photo") draft.rec.title = t;
          else if (!draft && cur.kind === "photo") draft = { pos: i, kind: "photo", rec: { img: cur.rec.img, title: t } };
          paint();
        };
        q.oninput = paintList;
        // Aprobar y publicar: la pantalla queda con lo de la vista previa (si la oferta estaba en otra pantalla, se mueve aquí)
        $("#ps-ok").onclick = async function () {
          if (!draft || busy) return;
          var next = explicit(cat);
          if (draft.kind === "offer") {
            var o = draft.o;
            var V = app.vitrinasOf ? app.vitrinasOf(o) : [];
            var full = V.find(function (c) { return c !== cat && explicit(c).filter(function (x) { return x && !(x.kind === "offer" && x.o.id === o.id); }).length >= N && !o.featured; });
            if (full) return toast("La vitrina de " + ((app.shopName && app.shopName(full)) || full) + " también la mostraría y está llena: libera una pantalla allá primero");
            next = next.map(function (x) { return x && x.kind === "offer" && x.o.id === o.id ? null : x; });
            next[i] = { kind: "offer", o: o };
          } else next[i] = { kind: "photo", rec: { img: draft.rec.img, title: String(draft.rec.title || "").slice(0, TEXT_MAX) } };
          busy = true; paint();
          try { await applyLayout(cat, next); close(); toast("Pantalla " + (i + 1) + " publicada"); await onDone(); }
          catch (err) { busy = false; paint(); toast(err.message || "No se pudo publicar"); }
        };
        // Quitar: la pantalla vuelve al automático (la oferta pasa adentro de la tienda)
        $("#ps-del").onclick = async function () {
          if (busy) return;
          if (draft && !hasOwn) { draft = null; title.value = ""; paint(); paintList(); return; }
          var next = explicit(cat); next[i] = null;
          busy = true; paint();
          try { await applyLayout(cat, next); close(); toast("Pantalla " + (i + 1) + " vacía: se llena sola con la oferta de mayor descuento"); await onDone(); }
          catch (err) { busy = false; paint(); toast(err.message || "No se pudo quitar"); }
        };
        // Mover: intercambia con la pantalla vecina
        el.querySelectorAll("[data-mv]").forEach(function (b) {
          b.onclick = async function () {
            var j = i + Number(b.dataset.mv); if (busy || j < 0 || j >= N) return;
            var next = explicit(cat), t = next[i]; next[i] = next[j]; next[j] = t;
            busy = true; paint();
            try { await applyLayout(cat, next); close(); toast("Afiche movido a la pantalla " + (j + 1)); await onDone(); }
            catch (err) { busy = false; paint(); toast(err.message || "No se pudo mover"); }
          };
        });
        setTab(tab); paint(); paintList();
      });
  }

  // Afiche de foto subida en la vitrina 2D (vf3 = vitrina v3; vf = fachada clásica). No abre visor: no es un producto.
  function flyerHTML(x, i, kind) {
    var p = kind === "vf" ? "vf" : "vf3", r = (((i * 37 + 11) % 5) - 2) * (p === "vf3" ? 0.45 : 1);
    return '<div class="' + p + "-flyer " + p + "-pf" + (x.title ? "" : " " + p + "-pfnt") + (p === "vf" ? " vf-flow" : "") + '" data-slot="' + esc(x.slot) + '" role="img" aria-label="' + esc("Afiche " + (x.slot + 1) + (x.title ? ": " + x.title : "")) + '" style="--r:' + r.toFixed(2) + "deg;--i:" + i + '">' +
      '<span class="' + p + '-paper"><span class="' + p + "-photo " + p + '-pfimg"><img src="' + esc(x.img) + '" alt="" decoding="async"></span>' +
      (x.title ? '<span class="' + p + '-info"><span class="' + p + '-title">' + esc(x.title) + "</span></span>" : "") + "</span>" +
      '<span class="' + p + "-tape " + p + '-ta" aria-hidden="true"></span><span class="' + p + "-tape " + p + '-tb" aria-hidden="true"></span></div>';
  }

  window.MSCampanas = {
    flyerHTML: flyerHTML,
    attachLocal: attachLocal, attach: attach, load: load, section: section, editor: editor,
    screens: screens, vitrinaItems: vitrinaItems, picks3d: picks3d, photoSlots: photoSlots, slotsOf: slotsOf, applyLayout: applyLayout, putSlot: putSlot, norm: norm,
    campaignFor: campaignFor, info: info, defaultFor: defaultFor, all: all, put: put, del: del, refresh: refreshWalk, offersChanged: offersChanged,
    posterHTML: posterHTML, N: N
  };
})();
