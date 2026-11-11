// =====================================================================
// Shoppers Miami — Centro financiero de la shopper
// Ventas de la app (pedidos pagados en adelante) + ventas manuales hechas fuera de la app,
// con totales y gráfico por semana / mes / año, CSV para Excel y PDF.
// Script clásico: se carga ANTES de app.js (módulo). app.js le pasa sus utilidades por
// window.MSApp y lo llama desde VIEWS.finanzas; en modo demo, makeLocalApi le entrega
// su base (attachLocal) para la semilla de ejemplo y las ventas manuales.
// =====================================================================
(function () {
  "use strict";

  // Estados de pedido que cuentan como venta: desde que la shopper confirma el pago en adelante.
  // (pendiente_pago y cancelado no cuentan)
  var SALE_STATUSES = ["pagado", "comprado", "en_bodega", "enviado", "entregado"];
  var SEED_FLAG = "fin_seed_v1";
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  var DIAS3 = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  var KIND_LBL = { week: "Semana", month: "Mes", year: "Año" };
  var PREV_LBL = { week: "la semana anterior", month: "el mes anterior", year: "el año anterior" };

  var local = null;           // { db, save } en modo demo
  var ui = { kind: "week", anchor: null, sales: null, chartW: 0 };

  var A = function () { return window.MSApp || {}; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clp = function (n) { return (n < 0 ? "−$" : "$") + Math.round(Math.abs(n || 0)).toLocaleString("es-CL"); };
  var pct = function (p) { return Number(p).toLocaleString("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: Math.abs(p) < 10 ? 1 : 0 }); };
  var digits = function (v) { var d = String(v == null ? "" : v).replace(/[^\d]/g, ""); return d ? Number(d) : null; };
  var uid = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var isoDay = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var parseDay = function (s) { var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var startOfWeek = function (d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
  var fmtDate = function (d) { return d.getDate() + " " + MES3[d.getMonth()] + " " + d.getFullYear(); };
  var shortDate = function (d) { return d.getDate() + " " + MES3[d.getMonth()]; };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var feePct = function () { var s = (A().state || {}).settings || {}; return Number(s.fee_pct) || 0; };

  // ---------------------------------------------------------------------------
  // Comisión de un pedido de la app: la parte "Servicio personal shopper" de quote().
  // quote() separa precio, impuesto, comisión, envío y aduana en US$; el pedido guarda lo
  // realmente cobrado en pesos (total_clp, con el dólar de ese día). La comisión en pesos es
  // la proporción comisión / total de quote() aplicada a ese total cobrado:
  //   comisión_clp = total_clp × quote.fee / quote.total
  // Así no depende del dólar de hoy y cuadra con la boleta que vio la clienta.
  // ---------------------------------------------------------------------------
  function orderCommission(o, offer) {
    var app = A(), total = Number(o.total_clp) || 0, price = Number(o.price_usd) || 0;
    if (!total || !price || !app.quote) return 0;
    var half = / \(50%\)$/.test(o.description || "");            // parte de una amiga en compra compartida
    var base = Object.assign({ category: null }, offer || {}, { price_usd: half ? price * 2 : price });
    var q = offer && offer.promo === "2x1" && app.quote2x1 ? app.quote2x1(base) : app.quote(base.price_usd, base);
    return q.total > 0 ? Math.round(total * q.fee / q.total) : 0;
  }
  // La anfitriona de una compra compartida 50/50 registra la compra completa, pero paga la mitad
  // (la otra mitad la registra la amiga como su propia orden "(50%)"). Para no contar dos veces,
  // de la orden de la anfitriona se cuenta solo su 50%.
  function hostShare(o) {
    return /Compra compartida 50\/50/.test(o.notes || "") && !/ \(50%\)$/.test(o.description || "") ? 0.5 : 1;
  }

  // Agrupa los pedidos pagados por N° de orden: una orden = una venta.
  function salesFromOrders(orders, offerOf) {
    var by = {}, out = [];
    orders.forEach(function (o) {
      if (SALE_STATUSES.indexOf(o.status) < 0) return;
      var k = o.order_code || o.id;
      var share = hostShare(o);
      var s = by[k] || (by[k] = { id: "o:" + k, source: "app", code: o.order_code || "", date: null, client: (o.client && o.client.full_name) || "Clienta", items: [], total: 0, commission: 0 });
      var d = new Date(o.created_at);
      if (!s.date || d < s.date) s.date = d;
      s.items.push(String(o.description || "").replace(/ \(50%\)$/, ""));
      s.total += Math.round((Number(o.total_clp) || 0) * share);
      s.commission += Math.round(orderCommission(o, offerOf(o.offer_id)) * share);
    });
    Object.keys(by).forEach(function (k) { var s = by[k]; s.day = new Date(s.date.getFullYear(), s.date.getMonth(), s.date.getDate()); out.push(s); });
    return out;
  }
  function salesFromManual(rows) {
    return rows.map(function (m) {
      var d = parseDay(m.sale_date);
      return { id: "m:" + m.id, mid: m.id, source: "manual", code: "", date: d, day: d, client: m.client_name || "", items: [m.description || ""], total: Number(m.amount_clp) || 0, commission: Number(m.commission_clp) || 0, raw: m };
    });
  }

  // ---------------------------------------------------------------------------
  // Datos: demo (localStorage ps_demo_v5) o Supabase
  // ---------------------------------------------------------------------------
  var store = {
    isDemo: function () { var st = A().state; return !!(st && st.api && st.api.demo); },
    sb: function () { var st = A().state; return st && st.api && st.api.sb; },
    loadSales: async function () {
      var orders, offers, manual;
      if (store.isDemo()) {
        if (!local) throw new Error("Datos de demo no disponibles");
        var db = local.db, prof = {};
        db.profiles.forEach(function (p) { prof[p.id] = p; });
        orders = (db.orders || []).map(function (o) { return Object.assign({}, o, { client: prof[o.client_id] || null }); });
        offers = {}; (db.offers || []).forEach(function (o) { offers[o.id] = o; });
        manual = (db.manual_sales || []).slice();
        return salesFromOrders(orders, function (id) { return offers[id]; }).concat(salesFromManual(manual));
      }
      var sb = store.sb(), ok = function (r) { if (r.error) throw new Error(r.error.message); return r.data; };
      var res = await Promise.all([
        sb.from("orders").select("id, order_code, description, notes, price_usd, total_clp, status, created_at, offer_id, client:profiles!client_id(full_name), offer:offers(category, weight_kg, box_l, box_w, box_h, promo)")
          .in("status", SALE_STATUSES).order("created_at", { ascending: false }).limit(10000),
        sb.from("manual_sales").select("*").order("sale_date", { ascending: false }).limit(10000),
      ]);
      orders = ok(res[0]); manual = ok(res[1]);
      var offerById = {}; orders.forEach(function (o) { if (o.offer_id && o.offer) offerById[o.offer_id] = o.offer; });
      return salesFromOrders(orders, function (id) { return offerById[id]; }).concat(salesFromManual(manual));
    },
    saveManual: async function (id, row) {
      if (store.isDemo()) {
        var list = local.db.manual_sales || (local.db.manual_sales = []);
        var me = local.db.me;
        if (id) { var r = list.find(function (x) { return x.id === id; }); if (!r) throw new Error("La venta ya no existe"); Object.assign(r, row, { updated_at: new Date().toISOString() }); }
        else list.push(Object.assign({ id: uid(), shopper_id: me, created_at: new Date().toISOString() }, row));
        if (local.save() === false) throw new Error("No se pudo guardar en el teléfono");
        return;
      }
      var sb = store.sb(), q = id ? sb.from("manual_sales").update(Object.assign({}, row, { updated_at: new Date().toISOString() })).eq("id", id) : sb.from("manual_sales").insert(row);
      var r2 = await q; if (r2.error) throw new Error(r2.error.message);
    },
    deleteManual: async function (id) {
      if (store.isDemo()) { local.db.manual_sales = (local.db.manual_sales || []).filter(function (x) { return x.id !== id; }); local.save(); return; }
      var r = await store.sb().from("manual_sales").delete().eq("id", id); if (r.error) throw new Error(r.error.message);
    },
  };

  // ---------------------------------------------------------------------------
  // Períodos y agrupación para el gráfico
  // ---------------------------------------------------------------------------
  function periodOf(kind, anchor) {
    var a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()), start, end, title;
    if (kind === "week") {
      start = startOfWeek(a); end = addDays(start, 7);
      var last = addDays(end, -1);
      title = start.getMonth() === last.getMonth() ? start.getDate() + " al " + last.getDate() + " de " + MESES[last.getMonth()] + " " + last.getFullYear()
        : shortDate(start) + " al " + shortDate(last) + " " + last.getFullYear();
    } else if (kind === "month") {
      start = new Date(a.getFullYear(), a.getMonth(), 1); end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
      title = cap(MESES[start.getMonth()]) + " " + start.getFullYear();
    } else {
      start = new Date(a.getFullYear(), 0, 1); end = new Date(a.getFullYear() + 1, 0, 1);
      title = String(start.getFullYear());
    }
    return { kind: kind, start: start, end: end, title: title };
  }
  function shiftAnchor(kind, anchor, n) {
    if (kind === "week") return addDays(anchor, 7 * n);
    if (kind === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
    return new Date(anchor.getFullYear() + n, 0, 1);
  }
  function bucketsOf(p) {
    var b = [], d;
    if (p.kind === "week") {
      for (var i = 0; i < 7; i++) { d = addDays(p.start, i); b.push({ start: d, end: addDays(d, 1), lbl: DIAS3[i], sub: String(d.getDate()), long: cap(DIAS3[i]) + " " + fmtDate(d) }); }
    } else if (p.kind === "month") {
      d = p.start;
      while (d < p.end) {
        var e = addDays(startOfWeek(d), 7); if (e > p.end) e = p.end;
        var l = addDays(e, -1);
        b.push({ start: d, end: e, lbl: d.getDate() === l.getDate() ? String(d.getDate()) : d.getDate() + "–" + l.getDate(), sub: "", long: "Semana del " + d.getDate() + " al " + l.getDate() + " de " + MESES[l.getMonth()] });
        d = e;
      }
    } else {
      for (var m = 0; m < 12; m++) { d = new Date(p.start.getFullYear(), m, 1); b.push({ start: d, end: new Date(p.start.getFullYear(), m + 1, 1), lbl: MES3[m], ini: MES3[m].charAt(0).toUpperCase(), sub: "", long: cap(MESES[m]) + " " + d.getFullYear() }); }
    }
    b.forEach(function (x) { x.total = 0; x.commission = 0; x.n = 0; });
    return b;
  }
  function inPeriod(sales, p) { return sales.filter(function (s) { return s.day >= p.start && s.day < p.end; }); }
  function sums(list) {
    var t = { total: 0, commission: 0, n: list.length };
    list.forEach(function (s) { t.total += s.total; t.commission += s.commission; });
    t.avg = t.n ? Math.round(t.total / t.n) : 0;
    return t;
  }

  // ---------------------------------------------------------------------------
  // Gráfico: columnas agrupadas (ventas y comisión), SVG propio, un solo eje en pesos.
  // Paleta validada (dataviz validate_palette, superficie #fffbf6): ventas #5446a0, comisión #a37528.
  // ---------------------------------------------------------------------------
  function niceMax(v) {
    if (v <= 0) return 100000;
    var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    var n = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return n * e;
  }
  function compact(n) {
    if (n === 0) return "$0";
    if (n >= 1e6) return "$" + (n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("es-CL") + " mil";
    return clp(n);
  }
  function rrectTop(x, y, w, h, r) {   // barra con extremo de dato redondeado (4px) y base recta
    if (h <= 0) return "";
    r = Math.min(r, w / 2, h);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  function chartSVG(buckets, W) {
    var H = 248, padL = 70, padR = 8, padT = 24, padB = ui.kind === "week" ? 50 : 32;
    var iw = W - padL - padR, ih = H - padT - padB;
    var max = 0; buckets.forEach(function (b) { max = Math.max(max, b.total, b.commission); });
    var top = niceMax(max), ticks = 4, slot = iw / buckets.length;
    var bw = Math.max(4, Math.min(24, (slot - 10) / 2)), gap = 2;
    var y = function (v) { return padT + ih - (v / top) * ih; };
    var out = ['<svg class="fin-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Ventas y comisión por ' + (ui.kind === "week" ? "día" : ui.kind === "month" ? "semana" : "mes") + '">'];
    for (var i = 0; i <= ticks; i++) {
      var v = (top / ticks) * i, yy = Math.round(y(v)) + 0.5;
      out.push('<line class="fin-grid' + (i === 0 ? " base" : "") + '" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>');
      out.push('<text class="fin-tick" x="' + (padL - 8) + '" y="' + (yy + 5) + '" text-anchor="end">' + esc(compact(v)) + "</text>");
    }
    var useIni = slot < 34, peak = -1, peakV = 0;
    buckets.forEach(function (b, i) { if (b.total > peakV) { peakV = b.total; peak = i; } });
    buckets.forEach(function (b, i) {
      var cx = padL + slot * i + slot / 2, x1 = cx - bw - gap / 2, x2 = cx + gap / 2;
      out.push('<g class="fin-col" data-i="' + i + '" tabindex="0" role="listitem" aria-label="' + esc(b.long + ": ventas " + clp(b.total) + ", comisión " + clp(b.commission)) + '">');
      out.push('<rect class="fin-hit" x="' + (padL + slot * i) + '" y="' + padT + '" width="' + slot + '" height="' + (ih + padB) + '"/>');
      out.push('<path class="fin-bar s" d="' + rrectTop(x1, y(b.total), bw, padT + ih - y(b.total), 4) + '"/>');
      out.push('<path class="fin-bar c" d="' + rrectTop(x2, y(b.commission), bw, padT + ih - y(b.commission), 4) + '"/>');
      out.push('<text class="fin-xl" x="' + cx + '" y="' + (padT + ih + 21) + '" text-anchor="middle">' + esc(useIni && b.ini ? b.ini : b.lbl) + "</text>");
      if (b.sub) out.push('<text class="fin-xl sub" x="' + cx + '" y="' + (padT + ih + 40) + '" text-anchor="middle">' + esc(b.sub) + "</text>");
      if (i === peak && peakV > 0) {
        var lx = Math.min(Math.max(x1 + bw / 2, padL + 24), W - padR - 24);
        out.push('<text class="fin-peak" x="' + lx + '" y="' + (y(b.total) - 7) + '" text-anchor="middle">' + esc(compact(b.total)) + "</text>");
      }
      out.push("</g>");
    });
    out.push("</svg>");
    return out.join("");
  }

  // ---------------------------------------------------------------------------
  // Vista
  // ---------------------------------------------------------------------------
  function deltaHTML(cur, prev) {
    if (!prev) return cur ? '<span class="fin-delta flat">Sin ventas en ' + PREV_LBL[ui.kind] + "</span>" : '<span class="fin-delta flat">Igual que ' + PREV_LBL[ui.kind] + "</span>";
    var d = (cur - prev) / prev * 100;
    if (Math.abs(d) < 0.05) return '<span class="fin-delta flat">Igual que ' + PREV_LBL[ui.kind] + "</span>";
    return '<span class="fin-delta ' + (d > 0 ? "up" : "down") + '"><span class="fin-arrow" aria-hidden="true">' + (d > 0 ? "↑" : "↓") + "</span>" + (d > 0 ? "+" : "−") + pct(Math.abs(d)) + " % vs " + PREV_LBL[ui.kind] + "</span>";
  }
  function saleRow(s) {
    var items = s.items.filter(Boolean);
    var itemsTxt = items.length > 3 ? items.slice(0, 3).join(" · ") + " y " + (items.length - 3) + " más" : items.join(" · ");
    return '<li class="fin-sale" data-sale="' + esc(s.id) + '">' +
      '<div class="fin-sale-top"><span class="fin-sale-date">' + esc(fmtDate(s.day)) + '</span><span class="pill ' + (s.source === "app" ? "" : "coral") + '">' + (s.source === "app" ? "App" + (s.code ? " · " + esc(s.code) : "") : "Manual") + "</span></div>" +
      '<div class="fin-sale-main"><div class="fin-sale-who"><b>' + esc(s.client || "Sin nombre") + '</b><span class="fin-sale-items">' + esc(itemsTxt || "—") + "</span></div>" +
      '<div class="fin-sale-amt"><b>' + clp(s.total) + '</b><span>Comisión ' + clp(s.commission) + "</span></div></div>" +
      (s.source === "manual" ? '<div class="fin-sale-act"><button type="button" class="btn ghost sm" data-edit="' + esc(s.mid) + '">Editar</button><button type="button" class="btn ghost sm fin-del" data-del="' + esc(s.mid) + '">Eliminar</button></div>' : "") +
      "</li>";
  }

  async function view(el) {
    var app = A();
    if (!app.state || !app.state.me || app.state.me.role !== "shopper") { el.innerHTML = '<div class="empty">El centro financiero es solo para la shopper.</div>'; return; }
    if (!ui.anchor) {
      try { var saved = JSON.parse(sessionStorage.getItem("ms_fin_ui") || "null"); if (saved && KIND_LBL[saved.kind]) { ui.kind = saved.kind; ui.anchor = new Date(saved.anchor); } } catch (e) {}
      if (!ui.anchor || isNaN(ui.anchor)) ui.anchor = new Date();
    }
    el.innerHTML = '<div class="fin"><button type="button" class="view-back" id="fin-back">← Volver</button><h2 class="view-title">Centro financiero</h2><div class="fin-body"><div class="muted">Cargando ventas…</div></div></div>';
    el.querySelector("#fin-back").onclick = function () { if (history.state && history.state.prev) history.back(); else app.go("pedidos"); };
    try { ui.sales = await store.loadSales(); }
    catch (e) { el.querySelector(".fin-body").innerHTML = '<div class="card"><b>No se pudieron cargar las ventas</b><p class="muted">' + esc(e.message) + "</p></div>"; return; }
    paint(el);
  }

  function paint(el) {
    var root = el.querySelector(".fin-body"); if (!root) return;
    try { sessionStorage.setItem("ms_fin_ui", JSON.stringify({ kind: ui.kind, anchor: ui.anchor.toISOString() })); } catch (e) {}
    var p = periodOf(ui.kind, ui.anchor), pp = periodOf(ui.kind, shiftAnchor(ui.kind, ui.anchor, -1));
    var list = inPeriod(ui.sales, p).sort(function (a, b) { return b.date - a.date; });
    var t = sums(list), tp = sums(inPeriod(ui.sales, pp));
    var buckets = bucketsOf(p);
    list.forEach(function (s) { for (var i = 0; i < buckets.length; i++) if (s.day >= buckets[i].start && s.day < buckets[i].end) { buckets[i].total += s.total; buckets[i].commission += s.commission; buckets[i].n++; break; } });
    var isCurrent = new Date() >= p.start && new Date() < p.end;
    var rate = t.total ? t.commission / t.total * 100 : 0;
    var unit = ui.kind === "week" ? "día" : ui.kind === "month" ? "semana" : "mes";

    root.innerHTML =
      '<div class="fin-bar-top">' +
        '<div class="fin-seg" role="tablist" aria-label="Período">' + ["week", "month", "year"].map(function (k) { return '<button type="button" role="tab" aria-selected="' + (k === ui.kind) + '" class="' + (k === ui.kind ? "on" : "") + '" data-kind="' + k + '">' + KIND_LBL[k] + "</button>"; }).join("") + "</div>" +
        '<div class="fin-nav"><button type="button" class="fin-arw" id="fin-prev" aria-label="Período anterior">‹</button><div class="fin-ptitle" aria-live="polite">' + esc(p.title) + '</div><button type="button" class="fin-arw" id="fin-next" aria-label="Período siguiente"' + (isCurrent ? " disabled" : "") + ">›</button></div>" +
        (isCurrent ? "" : '<button type="button" class="fin-today" id="fin-today">Volver a hoy</button>') +
      "</div>" +
      '<section class="card fin-kpis" aria-label="Totales del período">' +
        '<div class="fin-hero"><span class="fin-k">Ventas totales</span><span class="fin-hv">' + clp(t.total) + "</span>" + deltaHTML(t.total, tp.total) + "</div>" +
        '<div class="fin-tiles">' +
          '<div class="fin-tile"><span class="fin-k">Comisiones ganadas</span><span class="fin-v">' + clp(t.commission) + "</span>" + deltaHTML(t.commission, tp.commission) + "</div>" +
          '<div class="fin-tile"><span class="fin-k">N° de ventas</span><span class="fin-v">' + t.n.toLocaleString("es-CL") + "</span>" + deltaHTML(t.n, tp.n) + "</div>" +
          '<div class="fin-tile"><span class="fin-k">Ticket promedio</span><span class="fin-v">' + clp(t.avg) + "</span>" + deltaHTML(t.avg, tp.avg) + "</div>" +
          // La comisión es un % del precio de compra (Ajustes), no del total cobrado: el total también trae impuesto, envío y aduana
          '<div class="fin-tile"><span class="fin-k">Tu comisión</span><span class="fin-v">' + pct(feePct()) + ' %</span><span class="fin-delta flat">sobre el precio de compra' + (t.total ? " · " + pct(rate) + " % del total cobrado (incluye envío y aduana)" : "") + "</span></div>" +
        "</div>" +
      "</section>" +
      '<section class="card fin-chart-card"><div class="fin-chart-h"><h3>Ventas y comisión por ' + unit + '</h3><div class="fin-legend"><span><i class="sw s"></i>Ventas</span><span><i class="sw c"></i>Comisión</span></div></div>' +
        '<div class="fin-chart" role="list"></div><div class="fin-tip" hidden></div>' +
        '<details class="fin-table"><summary>Ver como tabla</summary><table><thead><tr><th>' + cap(unit) + '</th><th>Ventas</th><th>Comisión</th><th>N°</th></tr></thead><tbody>' +
          buckets.map(function (b) { return "<tr><td>" + esc(b.long) + "</td><td>" + clp(b.total) + "</td><td>" + clp(b.commission) + "</td><td>" + b.n + "</td></tr>"; }).join("") +
        '</tbody><tfoot><tr><td>Total</td><td>' + clp(t.total) + "</td><td>" + clp(t.commission) + "</td><td>" + t.n + "</td></tr></tfoot></table></details>" +
      "</section>" +
      '<div class="fin-actions"><button type="button" class="btn gold" id="fin-add">Agregar venta</button><button type="button" class="btn ghost" id="fin-csv">Descargar CSV</button><button type="button" class="btn ghost" id="fin-pdf">PDF</button></div>' +
      '<h3 class="section-title fin-lh">Ventas del período <span>' + t.n + "</span></h3>" +
      (list.length ? '<ul class="fin-list">' + list.map(saleRow).join("") + "</ul>" : '<div class="empty"><b>Sin ventas en este período</b><br>Las ventas pagadas en la app aparecen solas. Las hechas por fuera, agrégalas con “Agregar venta”.</div>') +
      '<p class="fin-note">Ventas de la app: órdenes desde que se marcan como pagadas (pagado, comprado, en bodega, enviado o entregado), con la fecha en que se hizo la orden. Comisión: el cargo “Servicio personal shopper” de cada orden (' + pct(feePct()) + " % del precio en tienda), en pesos según lo cobrado.</p>";

    var chartBox = root.querySelector(".fin-chart");
    var draw = function () {
      var w = Math.max(280, Math.round(chartBox.clientWidth || 320));
      ui.chartW = w;
      chartBox.innerHTML = chartSVG(buckets, w);
      wireTip(root, chartBox, buckets);
    };
    draw();
    if (view._ro) view._ro.disconnect();
    if (window.ResizeObserver) { view._ro = new ResizeObserver(function () { if (!document.body.contains(chartBox)) { view._ro.disconnect(); return; } if (Math.abs((chartBox.clientWidth || 0) - ui.chartW) > 2) draw(); }); view._ro.observe(chartBox); }

    root.querySelectorAll("[data-kind]").forEach(function (b) { b.onclick = function () { if (ui.kind === b.dataset.kind) return; ui.kind = b.dataset.kind; paint(el); }; });
    root.querySelector("#fin-prev").onclick = function () { ui.anchor = shiftAnchor(ui.kind, ui.anchor, -1); paint(el); };
    root.querySelector("#fin-next").onclick = function () { ui.anchor = shiftAnchor(ui.kind, ui.anchor, 1); paint(el); };
    var td = root.querySelector("#fin-today"); if (td) td.onclick = function () { ui.anchor = new Date(); paint(el); };
    root.querySelector("#fin-add").onclick = function () { openForm(null, el); };
    root.querySelector("#fin-csv").onclick = function () { downloadCSV(p, list, t); };
    root.querySelector("#fin-pdf").onclick = function () { downloadPDF(p, list, t, tp, buckets); };
    root.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { var s = ui.sales.find(function (x) { return x.mid === b.dataset.edit; }); if (s) openForm(s.raw, el); }; });
    root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { var s = ui.sales.find(function (x) { return x.mid === b.dataset.del; }); if (s) confirmDelete(s, el); }; });
  }

  function wireTip(root, box, buckets) {
    var tip = root.querySelector(".fin-tip");
    var show = function (g) {
      var b = buckets[+g.dataset.i];
      box.querySelectorAll(".fin-col.hot").forEach(function (x) { x.classList.remove("hot"); }); g.classList.add("hot");
      tip.innerHTML = "";
      var h = document.createElement("div"); h.className = "fin-tip-h"; h.textContent = b.long; tip.appendChild(h);
      [["s", "Ventas", b.total], ["c", "Comisión", b.commission]].forEach(function (r) {
        var row = document.createElement("div"); row.className = "fin-tip-r";
        row.innerHTML = '<i class="ln ' + r[0] + '"></i><b></b><span></span>';
        row.querySelector("b").textContent = clp(r[2]); row.querySelector("span").textContent = r[1]; tip.appendChild(row);
      });
      var n = document.createElement("div"); n.className = "fin-tip-n"; n.textContent = b.n === 1 ? "1 venta" : b.n + " ventas"; tip.appendChild(n);
      tip.hidden = false;
      var br = box.getBoundingClientRect(), gr = g.getBoundingClientRect(), tw = tip.offsetWidth;
      var left = gr.left - br.left + gr.width / 2 - tw / 2;
      tip.style.left = Math.max(0, Math.min(left, br.width - tw)) + "px";
      tip.style.top = (box.offsetTop + 4) + "px";
    };
    var hide = function () { tip.hidden = true; box.querySelectorAll(".fin-col.hot").forEach(function (x) { x.classList.remove("hot"); }); };
    box.querySelectorAll(".fin-col").forEach(function (g) {
      g.addEventListener("pointerenter", function () { show(g); });
      g.addEventListener("click", function () { show(g); });
      g.addEventListener("focus", function () { show(g); });
      g.addEventListener("blur", hide);
    });
    box.addEventListener("pointerleave", hide);
  }

  // ---------------------------------------------------------------------------
  // Agregar / editar / eliminar venta manual
  // ---------------------------------------------------------------------------
  function openForm(row, el) {
    var app = A(), editing = !!row, fee = feePct();
    var fmtIn = function (n) { return n == null || n === "" ? "" : Math.round(n).toLocaleString("es-CL"); };
    app.sheet('<h2>' + (editing ? "Editar venta" : "Agregar venta") + '</h2>' +
      '<p class="small muted fin-form-lead">Venta hecha fuera de la app (por WhatsApp, en persona, etc.).</p>' +
      '<form id="fin-form" class="fin-form" novalidate>' +
        '<div class="two"><div><label class="f" for="fin-date">Fecha</label><input class="in" type="date" id="fin-date" name="date" required value="' + esc(row ? String(row.sale_date).slice(0, 10) : isoDay(new Date())) + '"></div>' +
        '<div><label class="f" for="fin-client">Clienta</label><input class="in" id="fin-client" name="client" autocomplete="off" placeholder="Nombre" value="' + esc(row ? row.client_name : "") + '"></div></div>' +
        '<label class="f" for="fin-desc">Descripción</label><input class="in" id="fin-desc" name="desc" required placeholder="Ej: Cartera Coach y perfume" value="' + esc(row ? row.description : "") + '">' +
        '<div class="two"><div><label class="f" for="fin-amt">Monto cobrado (CLP)</label><input class="in" id="fin-amt" name="amount" inputmode="numeric" required placeholder="$0" value="' + esc(row ? fmtIn(row.amount_clp) : "") + '"></div>' +
        '<div><label class="f" for="fin-com">Tu comisión (CLP)</label><input class="in" id="fin-com" name="commission" inputmode="numeric" placeholder="$0" value="' + esc(row ? fmtIn(row.commission_clp) : "") + '"></div></div>' +
        '<div class="small muted fin-sug" id="fin-sug"></div>' +
        '<div class="fin-err" id="fin-err" role="alert"></div>' +
        '<button class="btn gold block" style="margin-top:16px">' + (editing ? "Guardar cambios" : "Agregar venta") + "</button>" +
        '<button type="button" class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>' +
      "</form>", function (box, close) {
      var f = box.querySelector("#fin-form"), E = f.elements, touched = editing;
      var sug = box.querySelector("#fin-sug"), err = box.querySelector("#fin-err");
      var money = function (inp) { var n = digits(inp.value); inp.value = n == null ? "" : "$" + n.toLocaleString("es-CL"); };
      if (E.amount.value) money(E.amount); if (E.commission.value) money(E.commission);
      var suggest = function () {
        var a = digits(E.amount.value) || 0, s = Math.round(a * fee / 100);
        sug.textContent = a ? "Sugerida: " + clp(s) + " (" + pct(fee) + " % de Ajustes). Puedes cambiarla." : "La comisión se sugiere con tu " + pct(fee) + " % de Ajustes.";
        if (!touched) E.commission.value = a ? "$" + s.toLocaleString("es-CL") : "";
      };
      E.amount.addEventListener("input", function () { money(E.amount); suggest(); });
      E.commission.addEventListener("input", function () { touched = E.commission.value.trim() !== ""; money(E.commission); });
      suggest();
      f.onsubmit = async function (e) {
        e.preventDefault(); err.textContent = "";
        var amount = digits(E.amount.value), com = digits(E.commission.value);
        if (!E.date.value) { err.textContent = "Indica la fecha de la venta."; E.date.focus(); return; }
        if (!E.desc.value.trim()) { err.textContent = "Escribe qué vendiste."; E.desc.focus(); return; }
        if (!amount) { err.textContent = "Indica el monto cobrado."; E.amount.focus(); return; }
        if (com == null) com = Math.round(amount * fee / 100);
        if (com > amount) { err.textContent = "La comisión no puede ser mayor que el monto."; E.commission.focus(); return; }
        var btn = f.querySelector(".btn.gold"); btn.disabled = true;
        try {
          await store.saveManual(editing ? row.id : null, { sale_date: E.date.value, client_name: E.client.value.trim(), description: E.desc.value.trim(), amount_clp: amount, commission_clp: com });
          close();
          app.toast(editing ? "Venta actualizada" : "Venta agregada");
          ui.anchor = parseDay(E.date.value);       // muestra el período de la venta
          ui.sales = await store.loadSales(); paint(el);
        } catch (x) { btn.disabled = false; err.textContent = x.message; }
      };
    });
  }
  function confirmDelete(s, el) {
    var app = A();
    app.sheet('<h2>Eliminar venta</h2><p class="fin-confirm">¿Eliminar la venta del <b>' + esc(fmtDate(s.day)) + "</b>" + (s.client ? " a <b>" + esc(s.client) + "</b>" : "") + " por <b>" + clp(s.total) + "</b>? Esta acción no se puede deshacer.</p>" +
      '<button type="button" class="btn block fin-del-ok" id="fin-del-ok">Sí, eliminar</button><button type="button" class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>', function (box, close) {
      box.querySelector("#fin-del-ok").onclick = async function () {
        this.disabled = true;
        try { await store.deleteManual(s.mid); close(); app.toast("Venta eliminada"); ui.sales = await store.loadSales(); paint(el); }
        catch (x) { this.disabled = false; app.toast(x.message); }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Exportar: CSV (Excel en español: separador ";" y BOM UTF-8) y PDF (mismo generador
  // sin librerías que la orden de compra de la caja: Helvetica, WinAnsi)
  // ---------------------------------------------------------------------------
  function fileTag(p) { return p.kind === "week" ? "semana-" + isoDay(p.start) : p.kind === "month" ? "mes-" + p.start.getFullYear() + "-" + pad(p.start.getMonth() + 1) : "anio-" + p.start.getFullYear(); }
  function save(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function csvCell(v) { var s = String(v == null ? "" : v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function buildCSV(p, list, t) {
    var rows = [["Centro financiero", KIND_LBL[p.kind] + ": " + p.title], [],
      ["Fecha", "Origen", "N° orden", "Clienta", "Productos", "Total cobrado (CLP)", "Comisión (CLP)"]];
    list.slice().sort(function (a, b) { return a.date - b.date; }).forEach(function (s) {
      rows.push([pad(s.day.getDate()) + "-" + pad(s.day.getMonth() + 1) + "-" + s.day.getFullYear(), s.source === "app" ? "App" : "Manual", s.code, s.client, s.items.filter(Boolean).join(" | "), Math.round(s.total), Math.round(s.commission)]);
    });
    rows.push([], ["Total", "", "", "", t.n + (t.n === 1 ? " venta" : " ventas"), Math.round(t.total), Math.round(t.commission)]);
    rows.push(["Ticket promedio", "", "", "", "", t.avg, ""]);
    return "﻿" + rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n") + "\r\n";
  }
  function downloadCSV(p, list, t) {
    save(new Blob([buildCSV(p, list, t)], { type: "text/csv;charset=utf-8" }), "finanzas-" + fileTag(p) + ".csv");
    A().toast("CSV descargado");
  }
  function buildPDF(p, list, t, tp, buckets) {
    var app = A(), name = (app.cherylName && app.cherylName()) || "Cheryl";
    var enc = function (s) { return String(s).normalize("NFC").replace(/[−–—]/g, "-").replace(/[^\x20-\xff]/g, "-").replace(/[\\()]/g, "\\$&"); };
    var W = { " ": 278, ".": 278, ",": 278, "$": 556, "-": 333, "%": 889, "|": 260 };
    var wid = function (s, size) { return Array.from(String(s)).reduce(function (a, ch) { return a + (W[ch] || 556); }, 0) * size / 1000; };
    var pages = [], L = [], y = 790;
    var add = function (txt, size, x, yy, bold) { L.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + x.toFixed(1) + " " + yy + " Td (" + enc(txt) + ") Tj ET"); };
    var right = function (txt, size, xr, yy, bold) { add(txt, size, xr - wid(txt, size), yy, bold); };
    var clip = function (s, max) { s = String(s); return s.length > max ? s.slice(0, max - 1) + "." : s; };
    var head = function () { add("FECHA", 8.5, 50, y, true); add("CLIENTA / PRODUCTOS", 8.5, 112, y, true); right("TOTAL", 8.5, 470, y, true); right("COMISION", 8.5, 545, y, true); y -= 8; L.push("0.69 0.55 0.31 RG 0.6 w 50 " + y + " m 545 " + y + " l S"); y -= 14; };
    var need = function (h) { if (y - h < 60) { pages.push(L.join("\n")); L = []; y = 800; head(); } };
    add((app.APP_NAME || "Shoppers Miami") + " - Centro financiero", 18, 50, y, true); y -= 22;
    add(KIND_LBL[p.kind] + ": " + p.title, 13, 50, y, true); y -= 16;
    add("Shopper: " + name + " - generado el " + new Date().toLocaleString("es-CL"), 9.5, 50, y); y -= 26;
    var kp = [["Ventas totales", clp(t.total)], ["Comisiones ganadas", clp(t.commission)], ["N de ventas", String(t.n)], ["Ticket promedio", clp(t.avg)]];
    kp.forEach(function (k, i) { var x = 50 + i * 124; add(k[0], 8.5, x, y); add(k[1], 13, x, y - 16, true); });
    y -= 34;
    var dv = function (c, pv) { return pv ? ((c - pv) / pv * 100 >= 0 ? "+" : "-") + pct(Math.abs((c - pv) / pv * 100)) + " %" : "s/d"; };
    add("Vs " + PREV_LBL[p.kind] + ": ventas " + dv(t.total, tp.total) + ", comisiones " + dv(t.commission, tp.commission) + ", n de ventas " + dv(t.n, tp.n) + ".", 9.5, 50, y); y -= 24;
    L.push("0.69 0.55 0.31 RG 1 w 50 " + y + " m 545 " + y + " l S"); y -= 18;
    add("Por " + (p.kind === "week" ? "dia" : p.kind === "month" ? "semana" : "mes"), 11, 50, y, true); right("VENTAS", 8.5, 470, y, true); right("COMISION", 8.5, 545, y, true); y -= 15;
    buckets.forEach(function (b) { add(b.long, 9.5, 50, y); right(clp(b.total), 9.5, 470, y); right(clp(b.commission), 9.5, 545, y); y -= 13; });
    y -= 12; L.push("0.69 0.55 0.31 RG 1 w 50 " + y + " m 545 " + y + " l S"); y -= 18;
    add("Ventas del periodo (" + t.n + ")", 11, 50, y, true); y -= 18; head();
    list.slice().sort(function (a, b) { return a.date - b.date; }).forEach(function (s) {
      need(30);
      add(pad(s.day.getDate()) + "-" + pad(s.day.getMonth() + 1) + "-" + s.day.getFullYear(), 9.5, 50, y);
      add(clip((s.client || "Sin nombre") + (s.source === "manual" ? "  (manual)" : s.code ? "  (" + s.code + ")" : ""), 50), 9.5, 112, y, true);
      right(clp(s.total), 9.5, 470, y, true); right(clp(s.commission), 9.5, 545, y);
      y -= 12; add(clip(s.items.filter(Boolean).join(" - "), 70), 8.5, 112, y); y -= 15;
    });
    need(30); y -= 4; L.push("0.11 0.09 0.14 RG 1 w 50 " + (y + 10) + " m 545 " + (y + 10) + " l S"); y -= 6;
    add("TOTAL", 11, 112, y, true); right(clp(t.total), 11, 470, y, true); right(clp(t.commission), 11, 545, y, true);
    pages.push(L.join("\n"));
    var np = pages.length, fontObj = 3 + 2 * np;
    var objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [" + pages.map(function (_, i) { return (3 + 2 * i) + " 0 R"; }).join(" ") + "] /Count " + np + " >>"];
    pages.forEach(function (content) {
      objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 " + fontObj + " 0 R /F2 " + (fontObj + 1) + " 0 R >> >> /Contents " + (objs.length + 2) + " 0 R >>");
      objs.push("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
    });
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    var out = "%PDF-1.4\n", offs = [];
    objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
    var xref = out.length;
    out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map(function (o) { return String(o).padStart(10, "0") + " 00000 n \n"; }).join("") + "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    var bytes = new Uint8Array(out.length); for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: "application/pdf" });
  }
  function downloadPDF(p, list, t, tp, buckets) {
    try { save(buildPDF(p, list, t, tp, buckets), "finanzas-" + fileTag(p) + ".pdf"); A().toast("PDF descargado"); }
    catch (e) { console.error(e); A().toast("No se pudo generar el PDF"); }
  }

  // ---------------------------------------------------------------------------
  // Demo: semilla idempotente de ~4 meses de ventas (pedidos pagados + ventas manuales).
  // Solo agrega (nunca borra ni cambia lo que ya existe) y se marca con db.fin_seed_v1.
  // ---------------------------------------------------------------------------
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  var CLIENTS = [["Javiera Muñoz", "+56 9 8123 4411"], ["Catalina Rojas", "+56 9 7654 2210"], ["Fernanda Soto", "+56 9 6345 9087"], ["Valentina Díaz", "+56 9 9012 3344"],
    ["Constanza Pérez", "+56 9 5567 1200"], ["Isidora Fuentes", "+56 9 8876 5521"], ["Antonia Vergara", "+56 9 7344 6610"], ["Macarena Silva", "+56 9 6120 7788"]];
  var MANUAL = [["Perfume Chanel Coco Mademoiselle 100 ml", 189000], ["Zapatillas New Balance 530 (encargo por WhatsApp)", 129000], ["Set de maquillaje Too Faced", 74000], ["Cartera Michael Kors Jet Set", 168000],
    ["Lentes Ray-Ban Wayfarer", 139000], ["Ropa de niña Carter's (lote)", 96000], ["Reloj Fossil Gen 6", 215000], ["Polerones Hollister x2", 88000], ["Crema La Mer 30 ml", 245000], ["Jeans Levi's 501 x2", 112000]];
  function seedDemo(db, H) {
    if (db[SEED_FLAG]) return false;
    if (!Array.isArray(db.manual_sales)) db.manual_sales = [];
    var offers = (db.offers || []).filter(function (o) { return Number(o.price_usd) > 0; });
    if (!offers.length || !H || !H.quote) { db[SEED_FLAG] = new Date().toISOString(); return true; }
    var R = rng(20260803), shopper = (db.profiles.find(function (p) { return p.role === "shopper"; }) || {}).id || "shopper-1";
    CLIENTS.forEach(function (c, i) {
      var id = "fin-client-" + (i + 1);
      if (!db.profiles.some(function (p) { return p.id === id; })) db.profiles.push({ id: id, full_name: c[0], phone: c[1], role: "client", locker_code: "CL" + (1101 + i), email: "clienta" + (i + 1) + "@demo" });
    });
    var today = new Date(), start = new Date(today.getFullYear(), today.getMonth() - 3, 1), s = H.settings || {};
    var codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (var d = new Date(start); d <= today; d = addDays(d, 1)) {
      var dow = (d.getDay() + 6) % 7, base = dow >= 4 ? 0.85 : 0.45;           // más ventas jueves a domingo
      var nOrders = R() < base ? (R() < 0.25 ? 2 : 1) : 0;
      var age = (today - d) / 864e5;
      for (var k = 0; k < nOrders; k++) {
        var cli = "fin-client-" + (1 + Math.floor(R() * CLIENTS.length)), code = "MS-";
        for (var c = 0; c < 6; c++) code += codeChars[Math.floor(R() * 32)];
        var fx = 940 + Math.round(R() * 80) + (age < 30 ? 0 : 0);                 // dólar del día (940–1.020)
        var at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10 + Math.floor(R() * 11), Math.floor(R() * 60));
        if (at > today) at = new Date(today.getTime() - 3600e3);
        var st = age > 21 ? "entregado" : age > 12 ? "enviado" : age > 6 ? "en_bodega" : age > 2 ? "comprado" : "pagado";
        var items = 1 + (R() < 0.35 ? 1 : 0) + (R() < 0.1 ? 1 : 0);
        for (var j = 0; j < items; j++) {
          var o = offers[Math.floor(R() * offers.length)];
          var q = o.promo === "2x1" && H.quote2x1 ? H.quote2x1(Object.assign({}, o)) : H.quote(o.price_usd, o, Object.assign({}, s, { usd_clp: fx }));
          var total = o.promo === "2x1" ? Math.ceil(q.total * fx / 100) * 100 : q.clp;
          db.orders.push({ id: uid(), client_id: cli, offer_id: o.id, description: o.title + (o.promo === "2x1" ? " (2×1)" : "") + (o.brand ? " · " + o.brand : ""), notes: null,
            price_usd: Number(o.price_usd), total_clp: total, order_code: code, status: st, created_at: at.toISOString(), demo_seed: true });
        }
      }
      if (R() < 0.09) {                                                            // venta manual de vez en cuando
        var m = MANUAL[Math.floor(R() * MANUAL.length)], amt = Math.round(m[1] * (0.9 + R() * 0.2) / 1000) * 1000;
        db.manual_sales.push({ id: uid(), shopper_id: shopper, sale_date: isoDay(d), client_name: CLIENTS[Math.floor(R() * CLIENTS.length)][0], description: m[0],
          amount_clp: amt, commission_clp: Math.round(amt * (Number(s.fee_pct) || 25) / 100 / 1000) * 1000, created_at: d.toISOString(), demo_seed: true });
      }
    }
    db[SEED_FLAG] = new Date().toISOString();
    return true;
  }

  // Lo llama makeLocalApi (app.js) con su base en memoria y su función save()
  function attachLocal(db, saveFn, helpers) {
    local = { db: db, save: saveFn };
    if (!Array.isArray(db.manual_sales)) { db.manual_sales = []; saveFn(); }
    try { if (seedDemo(db, helpers)) saveFn(); } catch (e) { console.warn("Semilla de finanzas", e); }
  }

  window.MSFinanzas = { view: view, attachLocal: attachLocal, SALE_STATUSES: SALE_STATUSES, orderCommission: orderCommission, _buildCSV: buildCSV, _periodOf: periodOf };
})();
