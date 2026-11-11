// =====================================================================
// Shoppers Miami — Encargos: "Lo encontré" → publicar → avisar a la clienta por WhatsApp
//  · Cheryl: lista de encargos (pendientes / encontrados / historial). "Lo encontré" abre el MISMO
//    formulario de publicar (publishForm de app.js) precargado con lo que pidió la clienta; la oferta
//    queda "solo para esta clienta" (reserved_for: no sale en tiendas ni vitrina, solo por su link #o-)
//    o también en la tienda. Luego: tarjeta con el precio puesto en Chile y el botón
//    "Contactar a [nombre] por WhatsApp" (un <a href="https://wa.me/…">, nunca window.open).
//  · Clienta: deja su encargo y en "Mis encargos" lo ve como "¡Encontrado!" con el producto.
//  · Estados: pendiente → encontrado → avisado → comprado (al comprar esa oferta) · cerrado.
// Script clásico: se carga ANTES de app.js (módulo); app.js le pasa sus utilidades por window.MSApp.
// En modo demo makeLocalApi le entrega su base (attachLocal) para la migración y la semilla.
// =====================================================================
(function () {
  "use strict";

  var A = function () { return window.MSApp || {}; };
  var S = function () { return A().state || {}; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var uid = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); };
  var nowIso = function () { return new Date().toISOString(); };
  var toast = function (m) { (A().toast || console.log)(m); };
  var cheryl = function () { return A().cherylName ? A().cherylName() : "Cheryl"; };
  var digits = function (v) { return String(v == null ? "" : v).replace(/[^\d]/g, ""); };
  var phoneKey = function (v) { var d = digits(v); return d.length >= 9 ? d.slice(-9) : d; };
  // número para wa.me: un celular chileno sin código de país (9 dígitos, parte con 9) recibe el 56
  var waNum = function (v) { var d = digits(v); if (d.length === 9 && d[0] === "9") d = "56" + d; return d.length >= 8 ? d : ""; };
  var when = function (iso) {
    if (!iso) return ""; var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "") + ", " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  };

  // ---------------------------------------------------------------------------
  // Estados
  // ---------------------------------------------------------------------------
  var STATUS = {
    pendiente:  { l: "Pendiente",  c: "amber", cli: "Buscando" },
    encontrado: { l: "Encontrado", c: "green", cli: "¡Encontrado!" },
    avisado:    { l: "Avisado",    c: "coral", cli: "¡Encontrado!" },
    comprado:   { l: "Comprado",   c: "green", cli: "Comprado" },
    cerrado:    { l: "Cerrado",    c: "",      cli: "Cerrado" },
  };
  var LEGACY = { open: "pendiente", found: "encontrado", closed: "cerrado" };   // versión anterior
  var norm = function (st) { return LEGACY[st] || (STATUS[st] ? st : "pendiente"); };
  var expired = function (s) { return norm(s.status) === "pendiente" && s.expires_at && new Date(s.expires_at) < new Date(); };
  var isFound = function (s) { return (s.status === "encontrado" || s.status === "avisado") && !!s.offer; };

  // ---------------------------------------------------------------------------
  // Demo: migración idempotente (estados nuevos) + 3 encargos de ejemplo
  // ---------------------------------------------------------------------------
  var SEED_FLAG = "enc_seed_v1", local = null;
  function seedLocal(db) {
    var cat = Array.isArray(window.DEMO_CATALOG) ? window.DEMO_CATALOG : [];
    var shopId = (db.profiles.find(function (p) { return p.role === "shopper"; }) || {}).id || "shopper-1";
    var hAgo = function (h) { return new Date(Date.now() - h * 3600e3).toISOString(); };
    var hLater = function (h) { return new Date(Date.now() + h * 3600e3).toISOString(); };
    var mkSearch = function (pid, h, extra) {
      var p = db.profiles.find(function (x) { return x.id === pid; });
      var c = (db.customers || []).find(function (x) { return x.user_id === pid; });
      var phone = (c && c.phone) || (p && p.phone);
      if (!p || !phone) return null;                                  // solo clientas demo con teléfono
      if (c && !c.gender) c.gender = "mujer";
      var s = Object.assign({ id: uid(), client_id: pid, status: "pendiente", offer_id: null, notified_at: null, phone: phone, created_at: hAgo(h), expires_at: hLater(24 * 30 - h), demo_seed: true }, extra);
      db.searches.push(s); return s;
    };
    var mkOffer = function (s, pick, fb, h) {
      var base = cat.find(pick) || fb;
      var o = Object.assign({ id: uid(), shopper_id: shopId, photos: [], colors: [], sizes: [], status: "active" }, base, {
        id: uid(), featured: false, last_minute: false, vitrina_pos: null, created_at: hAgo(h), expires_at: hLater(14 * 24 - h),
        request_id: s.id, reserved_for: s.client_id, gender: "mujer" });
      if (!Array.isArray(o.photos)) o.photos = [];
      db.offers.push(o);
      s.offer_id = o.id; s.found_at = o.created_at; s.brand = o.brand || s.brand; return o;
    };
    mkSearch("fin-client-1", 30, { category: "Zapatos", brand: "Nike", size: "38", color: "Blanco", max_price_usd: 90, details: "Zapatillas Air Force 1 o parecidas, para el día a día." });
    var s2 = mkSearch("fin-client-3", 52, { category: "Carteras", brand: "Coach", color: "Café", max_price_usd: 150, details: "Cartera mediana para el trabajo, que le quepa un notebook chico." });
    if (s2) { mkOffer(s2, function (o) { return o.category === "Carteras" && o.brand === "Coach" && /bucket/i.test(o.title); }, { title: "Cartera bucket con correa", brand: "Coach", category: "Carteras", price_usd: 119.99, store: "Nordstrom Rack", photo_url: "demo/img/carteras/06.jpg", colors: ["Café"], product_type: "cartera-mediana" }, 22); s2.status = "avisado"; s2.notified_at = hAgo(18); }
    var s3 = mkSearch("fin-client-2", 40, { category: "Relojes", brand: "Michael Kors", color: "Dorado", max_price_usd: 140, details: "Reloj de regalo para su mamá, ojalá dorado." });
    if (s3) { mkOffer(s3, function (o) { return o.category === "Relojes" && o.brand === "Michael Kors"; }, { title: "Reloj dorado esfera blanca", brand: "Michael Kors", category: "Relojes", price_usd: 99.99, store: "Macy's", photo_url: "demo/img/relojes/02.jpg", colors: ["Dorado"], product_type: "reloj" }, 3); s3.status = "encontrado"; }
  }
  function attachLocal(db, save) {
    local = { db: db, save: save };
    var ch = false;
    if (!Array.isArray(db.searches)) { db.searches = []; ch = true; }
    db.searches.forEach(function (s) {
      var n = norm(s.status); if (n !== s.status) { s.status = n; ch = true; }
      if (s.offer_id === undefined) { s.offer_id = null; ch = true; }
      if (s.notified_at === undefined) { s.notified_at = null; ch = true; }
    });
    if (!db[SEED_FLAG]) { try { seedLocal(db); } catch (e) { console.warn("Encargos (demo)", e); } db[SEED_FLAG] = nowIso(); ch = true; }
    if (ch) save();
  }

  // ---------------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------------
  async function customers() {
    var st = S();
    if (st.api && st.api.demo) return local ? (local.db.customers || []) : [];
    try { var r = await st.api.sb.from("customers").select("id, code, user_id, full_name, phone, gender").limit(5000); return r.error ? [] : r.data || []; } catch (e) { return []; }
  }
  function custOf(s, list) {
    return list.find(function (c) { return c.user_id && c.user_id === s.client_id; }) ||
      (phoneKey(s.phone).length >= 8 && list.find(function (c) { return phoneKey(c.phone) === phoneKey(s.phone); })) || null;
  }
  async function load() {
    var r = await Promise.all([S().api.listSearches(), A().isShopper() ? customers() : Promise.resolve([])]);
    r[0].forEach(function (s) { s.status = norm(s.status); s.customer = custOf(s, r[1]); });
    return r[0];
  }
  var nameOf = function (s) { return (s.customer && s.customer.full_name) || (s.client && s.client.full_name) || "Clienta"; };
  var firstOf = function (s) { var n = (s.customer && s.customer.full_name) || (s.client && s.client.full_name) || ""; return n.split(" ")[0] || ""; };
  var genderOf = function (s) { var g = (s.customer && s.customer.gender) || (s.client && s.client.gender) || ""; return g === "mujer" || g === "hombre" ? g : ""; };
  var phoneOf = function (s) { return s.phone || (s.customer && s.customer.phone) || (s.client && s.client.phone) || ""; };
  var update = async function (s, patch) { await S().api.updateSearch(s.id, patch); Object.assign(s, patch); };

  // ---------------------------------------------------------------------------
  // Mensajes de WhatsApp
  // ---------------------------------------------------------------------------
  var NOUN = { Carteras: "tu cartera", Zapatos: "tus zapatos", Relojes: "tu reloj", Perfumes: "tu perfume", Ropa: "tu prenda", Lentes: "tus lentes", Joyas: "tu joya", Maquillaje: "tu maquillaje", Juguetes: "tu juguete", Deportes: "tu ropa deportiva", Lenceria: "tu lencería", Invierno: "tu ropa de invierno" };
  function what(s) { var n = NOUN[s.category]; return n ? n + (s.brand ? " " + s.brand : "") : "tu encargo" + (s.brand ? " de " + s.brand : ""); }
  function foundText(s, o) {
    var a = A(), q = a.quote(o.price_usd, o), first = firstOf(s), g = genderOf(s);
    var tail = g === "mujer" ? "Cuéntame si aún estás interesada." : g === "hombre" ? "Cuéntame si aún estás interesado." : "Cuéntame si aún te interesa.";
    return (first ? "Hola " + first : "Hola") + ", ¡encontré " + what(s) + "! " + o.title + " en " + (o.store || "una tienda de Miami") + ": " + a.clp(q.clp) + " puesto en Chile (precio en tienda " + a.usd(o.price_usd) + "). Míralo y cómpralo aquí: " + a.appLink("o-" + o.id) + ". " + tail;
  }
  function askText(s) { var f = firstOf(s); return (f ? "Hola " + f : "Hola") + ", soy " + cheryl() + " de " + (A().APP_NAME || "Shoppers Miami") + ". Estoy buscando " + what(s) + " que me encargaste. ¿Me cuentas algún detalle más?"; }
  function closeText(s) { var f = firstOf(s); return (f ? "Hola " + f : "Hola") + ", te cuento que busqué " + what(s) + " en las tiendas de Miami y esta vez no lo encontré. Si quieres, déjame otro encargo y sigo atenta. " + cheryl(); }
  function wa(s, text) { var n = waNum(phoneOf(s)); return n && A().waTo ? A().waTo(n, text) : ""; }
  function waLink(s, o) { return wa(s, foundText(s, o)); }

  var WA_ICO = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';

  // ---------------------------------------------------------------------------
  // Piezas de interfaz
  // ---------------------------------------------------------------------------
  function specs(s) {
    var a = A(), L = [];
    if (s.size) L.push("Talla " + s.size);
    if (s.color) L.push("Color " + s.color);
    L.push(s.max_price_usd ? "Hasta " + a.usd(s.max_price_usd) : "Sin presupuesto fijo");
    return '<div class="enc-specs">' + L.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>";
  }
  function offerMini(o, s) {
    var a = A(), q = a.quote(o.price_usd, o), ph = (a.photosOf(o)[0] || {}).url;
    return '<button type="button" class="enc-prod" data-view="' + esc(o.id) + '" aria-label="Ver el producto: ' + esc(o.title) + '">' +
      '<span class="enc-ph">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy">' : "") + "</span>" +
      '<span class="enc-pt"><b>' + esc(o.title) + "</b><span>" + esc([o.brand, o.store].filter(Boolean).join(" · ")) + "</span>" +
      '<span class="enc-clp">' + a.clp(q.clp) + " <em>puesto en Chile</em></span>" +
      (s !== false && A().isShopper() ? '<span class="enc-vis-tag">' + (o.reserved_for ? "Solo con el link (no está en las tiendas)" : "También en la tienda") + "</span>" : "") + "</span></button>";
  }
  function timeline(s) {
    var L = [];
    if (s.found_at) L.push("Encontrado el " + when(s.found_at));
    if (s.notified_at) L.push("Avisado el " + when(s.notified_at));
    if (s.purchased_at) L.push("Comprado el " + when(s.purchased_at) + (s.order_code ? " · orden " + s.order_code : ""));
    if (s.status === "cerrado" && s.closed_at) L.push("Cerrado el " + when(s.closed_at));
    return L.length ? '<ul class="enc-tl">' + L.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "";
  }
  function contactBtn(s, label) {
    var href = s.offer ? waLink(s, s.offer) : "";
    if (!href) return '<div class="enc-warn">Falta el WhatsApp de ' + esc(firstOf(s) || "la clienta") + ": agrégalo en su ficha para poder avisarle.</div>";
    return '<a class="btn wa block enc-big" target="_blank" rel="noopener" data-contact="' + esc(s.id) + '" href="' + esc(href) + '">' + WA_ICO + "<span>" + esc(label || "Contactar a " + (firstOf(s) || "la clienta") + " por WhatsApp") + "</span></a>";
  }
  // Tarjeta de Cheryl. opt.noWho: dentro de la ficha (ya se sabe quién es); opt.summary: sin acciones
  function card(s, opt) {
    opt = opt || {};
    var c = s.customer, st = STATUS[s.status], exp = expired(s), ph = phoneOf(s);
    var who = opt.noWho ? "" : '<div class="enc-who">' + (c ? '<button type="button" class="enc-name" data-cust="' + esc(c.id) + '" aria-label="Ver la ficha de ' + esc(nameOf(s)) + '">' + esc(nameOf(s)) + "</button>" + (c.code ? '<span class="enc-code">' + esc(c.code) + "</span>" : "")
      : '<b class="enc-name-t">' + esc(nameOf(s)) + '</b><span class="enc-code enc-nocode">Sin ficha aún</span>') + "</div>";
    var acts = "";
    if (!opt.summary) {
      if (s.status === "pendiente" && !exp) acts = '<button type="button" class="btn gold block enc-big" data-found="' + esc(s.id) + '">Lo encontré</button>' +
        '<div class="enc-acts">' + (ph ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(wa(s, askText(s))) + '">Escribirle por WhatsApp</a>' : "") +
        '<button type="button" class="btn ghost" data-encclose="' + esc(s.id) + '">No lo encontré / cerrar</button></div>';
      else if (isFound(s)) acts = contactBtn(s, s.status === "avisado" ? "Contactar de nuevo a " + (firstOf(s) || "la clienta") + " por WhatsApp" : null) +
        '<div class="enc-acts"><button type="button" class="btn ghost" data-view="' + esc(s.offer.id) + '">Ver el producto</button><button type="button" class="btn ghost" data-encclose="' + esc(s.id) + '">Cerrar encargo</button></div>';
      else if (s.status === "comprado") acts = '<div class="enc-acts"><button type="button" class="btn ghost" data-orders>Ver en Pedidos</button>' + (ph ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(wa(s, "Hola " + firstOf(s) + ", soy " + cheryl() + ". ¡Gracias por tu compra!")) + '">Escribirle por WhatsApp</a>' : "") + "</div>";
      else acts = '<div class="enc-acts"><button type="button" class="btn ghost" data-reopen="' + esc(s.id) + '">Volver a buscarlo</button></div>';
    }
    return '<article class="card enc-card enc-' + s.status + '" data-sid="' + esc(s.id) + '">' +
      '<div class="enc-top">' + who + '<span class="pill enc-pill ' + (exp ? "" : st.c) + '">' + (exp ? "Vencido" : st.l) + "</span></div>" +
      '<div class="enc-what"><b class="enc-cat">' + esc(s.category) + (s.brand ? " · " + esc(s.brand) : "") + "</b>" + specs(s) +
        (s.details ? '<p class="enc-det">' + esc(s.details) + "</p>" : "") +
        '<p class="enc-meta">Pedido el ' + esc(when(s.created_at)) + (ph ? " · WhatsApp " + esc(ph) : " · sin WhatsApp") + "</p></div>" +
      (s.offer && s.status !== "pendiente" ? offerMini(s.offer) : "") + timeline(s) + acts + "</article>";
  }

  // ---------------------------------------------------------------------------
  // CHERYL: lista → "Lo encontré" → resultado
  // ---------------------------------------------------------------------------
  var ui = { mode: "list", pendingFound: null };
  function pushSub() { try { history.pushState(Object.assign({}, history.state || {}, { ovl: 1, enc: 1 }), "", location.hash); } catch (e) {} }
  function backFromSub(el) { if (history.state && history.state.enc) history.back(); else { ui.mode = "list"; listView(el); window.scrollTo(0, 0); } }
  // "atrás" de Android en una pantalla de encargo: vuelve a la lista (primero se cierran hojas y fichas de producto)
  window.addEventListener("popstate", function (e) {
    if (ui.mode === "list") return;
    var sub = document.querySelector(".enc-sub"); if (!sub) { ui.mode = "list"; return; }
    var sr = document.querySelector("#sheet-root"); if ((sr && sr.firstElementChild) || document.querySelector(".counter")) return;
    e.stopImmediatePropagation(); ui.mode = "list"; listView(sub.closest("#view") || sub.parentNode); window.scrollTo(0, 0);
  });

  async function view(el) {
    if (!A().isShopper()) return clientView(el);
    if (ui.pendingFound) {                               // "Lo encontré" tocado desde la ficha de la clienta
      var id = ui.pendingFound; ui.pendingFound = null;
      var s = (await load()).find(function (x) { return x.id === id; });
      if (s) { pushSub(); return foundScreen(el, s); }
    }
    ui.mode = "list"; return listView(el);
  }
  async function listView(el) {
    var list = await load();
    var pend = list.filter(function (s) { return s.status === "pendiente" && !expired(s); });
    var found = list.filter(function (s) { return s.status === "encontrado" || s.status === "avisado"; });
    var hist = list.filter(function (s) { return s.status === "comprado" || s.status === "cerrado" || expired(s); });
    var sec = function (title, arr, empty) { return '<h2 class="section-title enc-h">' + title + ' <span class="enc-n">' + arr.length + "</span></h2>" + (arr.length ? '<div class="enc-list">' + arr.map(function (s) { return card(s); }).join("") + "</div>" : '<div class="empty enc-empty">' + empty + "</div>"); };
    el.innerHTML = '<div class="enc">' +
      '<p class="enc-lede">Cuando encuentres algo, toca <b>Lo encontré</b>: le sacas la foto, la app calcula el precio puesto en Chile y te deja listo el mensaje de WhatsApp para la clienta.</p>' +
      sec("Pendientes", pend, "No hay encargos pendientes.") +
      (found.length ? sec("Encontrados, esperando respuesta", found, "") : "") +
      (hist.length ? '<details class="enc-hist"><summary>Historial: comprados y cerrados (' + hist.length + ')</summary><div class="enc-list">' + hist.map(function (s) { return card(s); }).join("") + "</div></details>" : "") +
      "</div>";
    wire(el, list, function () { return listView(el); }, function (s) { pushSub(); foundScreen(el, s); });
  }
  function wire(el, list, again, onFound) {
    var byId = function (id) { return list.find(function (s) { return s.id === id; }); };
    el.querySelectorAll("[data-cust]").forEach(function (b) { b.onclick = function () { if (window.MSClientes && window.MSClientes.openCustomer) window.MSClientes.openCustomer(b.dataset.cust, "encargos"); }; });
    el.querySelectorAll("[data-found]").forEach(function (b) { b.onclick = function () { onFound(byId(b.dataset.found)); }; });
    el.querySelectorAll("[data-contact]").forEach(function (a) { a.addEventListener("click", function () { markNotified(byId(a.dataset.contact)).then(function () { setTimeout(again, 500); }); }); });
    el.querySelectorAll("[data-view]").forEach(function (b) { b.onclick = function () { openProduct(b.dataset.view, list); }; });
    el.querySelectorAll("[data-encclose]").forEach(function (b) { b.onclick = function () { closeSheet(byId(b.dataset.encclose), again); }; });
    el.querySelectorAll("[data-reopen]").forEach(function (b) { b.onclick = async function () { await update(byId(b.dataset.reopen), { status: "pendiente", closed_at: null, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }); toast("Encargo pendiente otra vez"); again(); }; });
    el.querySelectorAll("[data-orders]").forEach(function (b) { b.onclick = function () { A().go("pedidos"); }; });
  }
  async function markNotified(s) {
    if (!s) return;
    try { await update(s, { status: s.status === "comprado" ? s.status : "avisado", notified_at: nowIso() }); toast("Encargo marcado como avisado"); } catch (e) { toast(e.message); }
  }
  async function openProduct(id, list) {
    var s = (list || []).find(function (x) { return x.offer && x.offer.id === id; });
    var o = s ? s.offer : null;
    try { o = (await S().api.getOffer(id)) || o; } catch (e) {}
    o ? A().openOffer(o) : toast("Ese producto ya no está disponible");
  }
  function closeSheet(s, after) {
    if (!s) return;
    var ph = waNum(phoneOf(s)), txt = closeText(s);
    A().sheet('<div class="enc enc-sheet"><h2>No lo encontré</h2><p class="enc-p">El encargo de ' + esc(nameOf(s)) + " (" + esc(s.category + (s.brand ? " · " + s.brand : "")) + ") queda cerrado. Si quieres, avísale por WhatsApp; es opcional.</p>" +
      '<label class="f" for="enc-cmsg">Mensaje (puedes cambiarlo)</label><textarea class="in enc-ta" id="enc-cmsg" rows="5">' + esc(txt) + "</textarea>" +
      (ph ? '<a class="btn wa block enc-big" id="enc-cwa" target="_blank" rel="noopener" href="' + esc(wa(s, txt)) + '">' + WA_ICO + "<span>Cerrar y avisar por WhatsApp</span></a>" : "") +
      '<button type="button" class="btn block enc-big" id="enc-cno">Cerrar sin avisar</button>' +
      '<button type="button" class="btn ghost block" data-close>Volver</button></div>', function (el, close) {
      var ta = el.querySelector("#enc-cmsg"), cw = el.querySelector("#enc-cwa");
      var done = async function (told) {
        try { await update(s, Object.assign({ status: "cerrado", closed_at: nowIso() }, told ? { notified_at: nowIso() } : {})); } catch (e) { return toast(e.message); }
        close(); toast("Encargo cerrado"); after && after();
      };
      ta.oninput = function () { if (cw) cw.href = wa(s, ta.value); };
      if (cw) cw.addEventListener("click", function () { setTimeout(function () { done(true); }, 0); });
      el.querySelector("#enc-cno").onclick = function () { done(false); };
    });
  }

  // "Lo encontré": foto + el mismo formulario de publicar, precargado
  function foundScreen(el, s) {
    ui.mode = "found";
    var a = A(), first = firstOf(s);
    el.innerHTML = '<div class="enc enc-sub">' +
      '<button type="button" class="view-back enc-back" id="enc-back">← Volver a encargos</button>' +
      '<h2 class="enc-title">Lo encontré</h2>' +
      '<p class="enc-p">Saca la foto con la etiqueta: la app lee el precio y calcula cuánto le sale puesto en Chile a ' + esc(first || "la clienta") + ".</p>" +
      card(s, { summary: true }) +
      '<label class="capture enc-cap" for="enc-cam"><span class="cam">' + (a.ICON ? a.ICON.cam : "") + '</span><b>Sacar foto al producto</b><span class="enc-cap-s">Incluye la etiqueta con el precio.</span></label>' +
      '<input type="file" id="enc-cam" accept="image/*" capture="environment" hidden>' +
      '<div class="enc-alt"><button type="button" class="btn ghost" id="enc-nophoto">Seguir sin foto (precio a mano)</button></div>' +
      '<div id="enc-pub"></div></div>';
    window.scrollTo(0, 0);
    var box = el.querySelector("#enc-pub");
    var opts = {
      request: s,
      prefill: { name: first || nameOf(s), category: s.category, brand: s.brand || "", size: s.size || "", color: s.color || "", gender: genderOf(s) },
      onPublished: async function (offer) {
        try { await update(s, { status: "encontrado", offer_id: offer.id, found_at: nowIso() }); } catch (e) { toast(e.message); }
        s.offer = offer; resultScreen(el, s);
      },
    };
    el.querySelector("#enc-back").onclick = function () { backFromSub(el); };
    el.querySelector("#enc-cam").onchange = function (e) { var f = e.target.files[0]; if (f) a.publishForm(box, f, opts); e.target.value = ""; };
    el.querySelector("#enc-nophoto").onclick = function () { a.publishForm(box, null, opts); };
    try { a.vision && a.vision.warm(); } catch (e) {}
  }

  // Resultado: tarjeta del producto + botón grande de WhatsApp
  function resultScreen(el, s) {
    ui.mode = "result";
    var a = A(), o = s.offer, q = a.quote(o.price_usd, o), ph = (a.photosOf(o)[0] || {}).url, first = firstOf(s) || "la clienta";
    var d = o.discount_pct > 0 && o.tag_price_usd > 0 ? { tag: Number(o.tag_price_usd), pct: Number(o.discount_pct) } : null;
    var paint = function () {
      el.innerHTML = '<div class="enc enc-sub">' +
        '<button type="button" class="view-back enc-back" id="enc-back">← Volver a encargos</button>' +
        '<h2 class="enc-title" id="enc-rt">' + (s.status === "avisado" ? "Le avisaste a " : "Listo para avisarle a ") + esc(first) + "</h2>" +
        '<article class="card enc-res">' +
          '<div class="enc-res-ph">' + (ph ? '<img src="' + esc(ph) + '" alt="' + esc(o.title) + '">' : "") + "</div>" +
          '<div class="enc-res-t"><span class="enc-res-m">' + esc([o.brand, o.store].filter(Boolean).join(" · ")) + "</span>" +
            "<h3>" + esc(o.title) + "</h3>" +
            '<div class="enc-res-p"><b>' + a.clp(q.clp) + "</b><span>puesto en Chile</span></div>" +
            '<div class="enc-res-u">Precio en tienda ' + a.usd(o.price_usd) + (d ? " (etiqueta " + a.usd(d.tag) + ", −" + d.pct + "%)" : "") + "</div>" +
            '<span class="enc-vis-tag">' + (o.reserved_for ? "Solo para " + esc(first) + ": no aparece en las tiendas ni en la vitrina" : "También publicado en la tienda") + "</span></div>" +
          '<details class="enc-calc"><summary>Ver cálculo</summary>' + a.quoteHTML(q, d) + "</details>" +
        "</article>" +
        contactBtn(s, s.status === "avisado" ? "Contactar de nuevo a " + first + " por WhatsApp" : null) +
        '<p class="enc-p enc-sent" id="enc-sent">' + (s.notified_at ? "Avisado el " + esc(when(s.notified_at)) + "." : "Al tocarlo se abre WhatsApp con el mensaje listo y el encargo queda como Avisado.") + "</p>" +
        '<details class="enc-msg"><summary>Ver el mensaje que le llega</summary><p>' + esc(foundText(s, o)) + "</p></details>" +
        '<div class="enc-acts"><button type="button" class="btn ghost" id="enc-see">Ver como la clienta</button><button type="button" class="btn ghost" id="enc-done">Volver a encargos</button></div>' +
        "</div>";
      el.querySelector("#enc-back").onclick = el.querySelector("#enc-done").onclick = function () { backFromSub(el); };
      el.querySelector("#enc-see").onclick = function () { a.openOffer(o); };
      var w = el.querySelector("[data-contact]");
      if (w) w.addEventListener("click", function () { markNotified(s).then(function () { setTimeout(paint, 400); }); });
    };
    paint(); window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------------
  // Ficha de la clienta (clientes.js): sus encargos, con "Contactar" para reenviar
  // ---------------------------------------------------------------------------
  async function fichaBlock(el, c) {
    if (!el || !c) return;
    var list = [];
    try { list = await load(); } catch (e) { return; }
    var mine = list.filter(function (s) { return s.customer && s.customer.id === c.id; });
    if (!el.isConnected) return;
    if (!mine.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="card cli-card enc enc-ficha"><div class="cli-sec-h"><h3>Encargos</h3><span class="enc-n">' + mine.length + "</span></div>" +
      '<div class="enc-list">' + mine.map(function (s) { return card(s, { noWho: true }); }).join("") + "</div></div>";
    wire(el, mine, function () { return fichaBlock(el, c); }, function (s) { ui.pendingFound = s.id; A().go("encargos"); });
  }

  // ---------------------------------------------------------------------------
  // CLIENTA: dejar encargo + "Mis encargos"
  // ---------------------------------------------------------------------------
  function clientCard(s) {
    var a = A(), st = STATUS[s.status], exp = expired(s), o = s.offer;
    return '<article class="card enc-card enc-c enc-' + s.status + (isFound(s) ? " enc-found" : "") + '">' +
      '<div class="enc-top"><b class="enc-cat">' + esc(s.category) + (s.brand ? " · " + esc(s.brand) : "") + '</b><span class="pill enc-pill ' + (exp ? "" : st.c) + '">' + (exp ? "Vencido" : st.cli) + "</span></div>" +
      specs(s) + (s.details ? '<p class="enc-det">' + esc(s.details) + "</p>" : "") +
      '<p class="enc-meta">Pedido el ' + esc(when(s.created_at)) + "</p>" +
      (isFound(s) ? '<div class="enc-for">' + (a.ICON ? a.ICON.spark : "") + "<span>Encontrado especialmente para ti por <b>" + esc(cheryl()) + "</b></span></div>" + offerMini(o, false) +
        '<button type="button" class="btn gold block enc-big" data-view="' + esc(o.id) + '">Ver y comprar</button>' : "") +
      (s.status === "comprado" && o ? offerMini(o, false) + '<p class="enc-meta">Lo compraste' + (s.purchased_at ? " el " + esc(when(s.purchased_at)) : "") + ". Síguelo en Mis pedidos.</p>" : "") +
      (s.status === "pendiente" && !exp ? '<div class="enc-acts"><button type="button" class="btn ghost" data-stop="' + esc(s.id) + '">Ya no lo busco</button></div>' : "") +
      "</article>";
  }
  async function clientView(el) {
    var a = A(), me = S().me || {}, list = await load();
    el.innerHTML = '<div class="enc">' +
      '<div class="card enc-ask"><h3>¿Buscas algo puntual?</h3>' +
        '<p class="enc-p">Dile a ' + esc(cheryl()) + " qué buscas y lo busca en las tiendas de Miami. Cuando lo encuentre te escribe por WhatsApp con el link para verlo y comprarlo.</p>" +
        '<form id="sf">' +
          '<label class="f" for="sf-cat">Categoría</label><select class="in" id="sf-cat" name="category">' + (a.CATEGORIES || []).map(function (c) { return "<option>" + esc(c.id) + "</option>"; }).join("") + "</select>" +
          '<div class="two"><div><label class="f" for="sf-brand">Marca (opcional)</label><input class="in" id="sf-brand" name="brand" list="brands" placeholder="Michael Kors"></div>' +
          '<div><label class="f" for="sf-max">Precio máximo (US$)</label><input class="in" id="sf-max" name="max" inputmode="decimal" placeholder="50"></div></div>' +
          '<div class="two"><div><label class="f" for="sf-size">Talla (opcional)</label><input class="in" id="sf-size" name="size" placeholder="38 · M · única"></div>' +
          '<div><label class="f" for="sf-color">Color (opcional)</label><select class="in" id="sf-color" name="color"><option value="">Cualquiera</option>' + (a.COLORS || []).map(function (c) { return "<option>" + esc(c[0]) + "</option>"; }).join("") + "</select></div></div>" +
          '<label class="f" for="sf-det">Detalles: modelo, tamaño, para quién</label><textarea class="in" id="sf-det" name="details" placeholder="Ej: bolso negro, tamaño mediano"></textarea>' +
          '<label class="f" for="sf-phone">Tu WhatsApp (para avisarte cuando lo encuentre)</label><input class="in" id="sf-phone" name="phone" type="tel" inputmode="tel" required placeholder="+56 9 1234 5678" value="' + esc(me.phone || "") + '">' +
          '<button class="btn gold block enc-big" style="margin-top:14px">Dejar encargo a ' + esc(cheryl()) + "</button></form>" +
        '<datalist id="brands">' + (a.BRANDS || []).map(function (b) { return '<option value="' + esc(b) + '">'; }).join("") + "</datalist></div>" +
      '<h2 class="section-title">Mis encargos</h2>' +
      (list.length ? '<div class="enc-list">' + list.map(clientCard).join("") + "</div>" : '<div class="empty">Aún no tienes encargos.</div>') +
      "</div>";
    el.querySelector("#sf").onsubmit = async function (e) {
      e.preventDefault();
      var f = new FormData(e.target), phone = String(f.get("phone") || "").trim();
      if (digits(phone).length < 8) return toast("Escribe tu WhatsApp con código de país");
      var num = function (v) { var n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) ? n : null; };
      await S().api.createSearch({ category: f.get("category"), brand: String(f.get("brand") || "").trim() || null, max_price_usd: num(f.get("max")),
        size: String(f.get("size") || "").trim() || null, color: f.get("color") || null, details: String(f.get("details") || "").trim() || null, phone: phone });
      if (!me.phone) { try { S().me = await S().api.updateProfile({ phone: phone }); } catch (err) {} }
      toast("Encargo enviado. " + cheryl() + " te escribe por WhatsApp cuando lo encuentre."); clientView(el);
    };
    el.querySelectorAll("[data-view]").forEach(function (b) { b.onclick = function () { openProduct(b.dataset.view, list); }; });
    el.querySelectorAll("[data-stop]").forEach(function (b) { b.onclick = async function () { var s = list.find(function (x) { return x.id === b.dataset.stop; }); await update(s, { status: "cerrado", closed_at: nowIso() }); toast("Encargo cerrado"); clientView(el); }; });
  }

  // ---------------------------------------------------------------------------
  // Ficha del producto (openOffer de app.js): marca "Encontrado especialmente para ti"
  // ---------------------------------------------------------------------------
  async function offerBadge(slot, o) {
    if (!slot || !o || (!o.reserved_for && !o.request_id)) return;
    var a = A(), me = S().me || {};
    if (a.isShopper && a.isShopper()) { slot.innerHTML = '<div class="enc-for enc-for-shop">' + (o.reserved_for ? "Reservado para la clienta del encargo: no aparece en las tiendas ni en la vitrina" : "Encontrado para un encargo y publicado en la tienda") + "</div>"; return; }
    var mine = !!o.reserved_for && o.reserved_for === me.id;
    if (!mine && o.request_id) { try { mine = (await S().api.listSearches()).some(function (s) { return s.id === o.request_id && s.client_id === me.id; }); } catch (e) {} }
    if (mine && slot.isConnected) slot.innerHTML = '<div class="enc-for">' + (a.ICON ? a.ICON.spark : "") + "<span>Encontrado especialmente para ti por <b>" + esc(cheryl()) + "</b></span></div>";
  }

  window.MSEncargos = {
    attachLocal: attachLocal, view: view, fichaBlock: fichaBlock, offerBadge: offerBadge, waLink: waLink,
    STATUS: STATUS,
    // para pruebas
    _foundText: foundText, _norm: norm, _waNum: waNum,
  };
})();
