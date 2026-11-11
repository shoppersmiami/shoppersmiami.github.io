// Shoppers Miami — Pedido → transferencia → orden de compra (ordenes.js / ordenes.css)
//
// Flujo: la clienta hace el PEDIDO (estado "pendiente_pago" = Pendiente de transferencia) y se abre
// WhatsApp a Cheryl con el desglose completo, igual a la boleta. La clienta transfiere y sube el
// comprobante (estado "comprobante_recibido"); si lo manda por WhatsApp, Cheryl lo sube en el mismo
// pedido. Solo con comprobante en la app Cheryl puede "Aprobar pago y generar orden de compra":
// el pedido pasa a "pagado" (Pagado - orden de compra emitida) con N° OC-xxxxx correlativo, y se le
// envía a la clienta la ORDEN DE COMPRA (WhatsApp + PDF) con los pasos del despacho (Ajustes).
//
// Datos en cada fila de orders (supabase/schema.sql): order_snapshot (boleta congelada, en la
// primera fila del pedido), receipt_by / receipt_at (quién y cuándo subió el comprobante),
// oc_number, paid_at, paid_clp. En Supabase la aprobación la hace la RPC approve_order (solo la
// shopper y solo si el pedido tiene comprobante).
(function () {
  "use strict";
  var A = function () { return window.MSApp || {}; };
  var S = function () { return A().state || {}; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clp = function (n) { return "$" + Math.round(n || 0).toLocaleString("es-CL"); };
  var usd = function (n) { return "US$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var dmy = function (iso) { var d = iso ? new Date(iso) : new Date(); return isNaN(d) ? "" : d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }); };
  var hm = function (iso) { var d = iso ? new Date(iso) : new Date(); return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }); };
  var cheryl = function () { return (A().cherylName && A().cherylName()) || "Cheryl"; };
  var appName = function () { return A().APP_NAME || "Shoppers Miami"; };
  var MAX_URL = 3800;   // largo máximo del link wa.me (algunos teléfonos cortan los links muy largos)

  // ---------------------------------------------------------------------------
  // Estados
  // ---------------------------------------------------------------------------
  var STATUS = {
    pendiente_pago: "Pendiente de transferencia",
    comprobante_recibido: "Comprobante recibido, en revisión",
    pagado: "Pagado - orden de compra emitida",
    comprado: "Comprado", en_bodega: "En bodega Miami", enviado: "Enviado a Chile", entregado: "Entregado", cancelado: "Cancelado",
  };
  var ORDER = ["pendiente_pago", "comprobante_recibido", "pagado", "comprado", "en_bodega", "enviado", "entregado"];
  var TRACK = [["Pedido", 0], ["Transferencia", 1], ["Orden de compra", 2], ["Comprado", 3], ["Enviado", 5], ["Entregado", 6]];
  function groupStatus(rows) {
    var live = rows.filter(function (o) { return o.status !== "cancelado"; });
    if (!live.length) return "cancelado";
    return live.map(function (o) { return o.status; }).sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); })[0];
  }
  // Código de color único para pedidos, casilla, clientes y tableros: pendiente = rojo, por aprobar = ámbar,
  // pagado / hecho = verde, cancelado = gris. Clases .pill.st-red / st-amber / st-green / st-grey (ordenes.css)
  var TONE = { pendiente_pago: "red", comprobante_recibido: "amber", pagado: "green", comprado: "green", en_bodega: "green", enviado: "green", entregado: "green", cancelado: "grey",
    // casilla (PKG_STEPS): recibido = en tu casilla, sin cobro aún; consolidar = envío solicitado, pendiente de pago
    recibido: "grey", consolidar: "red" };
  var statusTone = function (s) { return TONE[s] || "grey"; };
  function statusPill(s) { return '<span class="pill oc-pill st-' + statusTone(s) + '" data-oc-status="' + esc(s) + '">' + esc(STATUS[s] || s) + "</span>"; }
  function tracker(s) {
    var i = ORDER.indexOf(s);
    return '<ol class="oc-track" aria-label="Avance del pedido">' + TRACK.map(function (t) { return '<li class="' + (i >= t[1] ? "on" : "") + (i === t[1] || (t[1] === 3 && i === 4) ? " now" : "") + '"><span></span>' + esc(t[0]) + "</li>"; }).join("") + "</ol>";
  }

  // ---------------------------------------------------------------------------
  // Guía de envío + pasos del despacho (Ajustes de Cheryl → settings.dispatch, un solo jsonb)
  // Los datos del courier por defecto son DE EJEMPLO (inventados): Cheryl los reemplaza en Ajustes.
  // ---------------------------------------------------------------------------
  var DEFAULT_STEPS = [
    "{cheryl} compra tus productos en Miami y te avisa por WhatsApp cuando los tenga.",
    "Los envía por courier ({courier}) a Chile. Tiempo estimado: {eta} desde el envío.",
    "Te llega el número de seguimiento para que sigas tu envío en {seguimiento}.",
    "{entrega}",
    "Cualquier duda, escríbele a {cheryl} al WhatsApp {whatsapp}.",
  ];
  var DEFAULT_DISPATCH = {
    courier: "Miami Express Cargo", courier_wa: "+56 9 5555 0000", courier_phone: "+56 2 2345 6789", courier_email: "contacto@miamiexpresscargo.cl",
    track_url: "miamiexpresscargo.cl/seguimiento", eta: "7 a 12 días hábiles", mode: "ambas",
    pickup: "Sucursal Santiago Centro, Av. Providencia 1550, local 12, Providencia",
    pickup_hours: "Lunes a viernes de 10:00 a 19:00 y sábado de 10:00 a 14:00",
    doc: "Presenta tu carnet de identidad al retirar (si retira otra persona: su carnet y una autorización simple firmada por ti).",
    customs: "Los aranceles e IVA de aduana ya están incluidos en el total que pagaste: no tienes que pagar nada más al recibir.",
    steps: DEFAULT_STEPS.slice(),
  };
  var GUIDE_KEYS = ["courier", "courier_wa", "courier_phone", "courier_email", "track_url", "eta", "pickup", "pickup_hours", "doc", "customs"];
  var MODES = { domicilio: "Entrega a domicilio", retiro: "Retiro en sucursal del courier", ambas: "La clienta elige (retiro o domicilio)" };
  function dispatch() {
    var d = (S().settings || {}).dispatch || {}, out = {};
    GUIDE_KEYS.forEach(function (k) { out[k] = String(d[k] == null ? "" : d[k]).trim() || DEFAULT_DISPATCH[k]; });
    out.mode = MODES[d.mode] ? d.mode : DEFAULT_DISPATCH.mode;
    out.steps = Array.isArray(d.steps) && d.steps.length === 5 ? d.steps.map(function (x, i) { return String(x || "").trim() || DEFAULT_STEPS[i]; }) : DEFAULT_STEPS.slice();
    return out;
  }
  function entregaText(d) {
    var pick = d.pickup ? " en " + d.pickup + (d.pickup_hours ? " (" + d.pickup_hours + ")" : "") : "";
    if (d.mode === "retiro") return "Retiro en Chile" + pick + ": te avisamos cuando esté listo para retirar.";
    if (d.mode === "ambas") return "Retiro en Chile" + pick + " o entrega a domicilio en la dirección de tu pedido, como prefieras: te escribimos para coordinar.";
    return "Entrega a domicilio en la dirección de tu pedido. Te avisamos el día de llegada.";
  }
  var courierContact = function (d) { return [d.courier_wa ? "WhatsApp " + d.courier_wa : "", d.courier_phone ? "teléfono " + d.courier_phone : "", d.courier_email || ""].filter(Boolean).join(" · "); };
  function trackLink(d, n) {
    var u = String(d.track_url || "").trim(); if (!u) return "";
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    if (!n) return u;
    return /\{n\}/.test(u) ? u.replace("{n}", encodeURIComponent(n)) : u + (u.indexOf("?") >= 0 ? "&" : "?") + "guia=" + encodeURIComponent(n);
  }
  function stepsList() {
    var d = dispatch(), s = S().settings || {};
    var rep = { cheryl: cheryl(), eta: d.eta, entrega: entregaText(d), whatsapp: s.whatsapp || "", retiro: d.pickup, courier: d.courier, seguimiento: d.track_url };
    return d.steps.map(function (t) { return t.replace(/\{(\w+)\}/g, function (m, k) { return rep[k] != null ? rep[k] : m; }).replace(/\s+/g, " ").trim(); });
  }
  // Guía de cómo se envía el paquete a Chile (va en la orden de compra y en el comprobante de despacho)
  function guideRows() {
    var d = dispatch();
    return [["Compañía courier", d.courier], ["Contacto del courier", courierContact(d)], ["Plazo estimado", d.eta + " desde que sale de Miami"],
      ["Seguimiento", "Con tu número de seguimiento en " + d.track_url + " (te lo enviamos apenas salga tu paquete)"],
      ["Retiro o entrega", entregaText(d)], ["Documento", d.doc], ["Aduana", d.customs]].filter(function (r) { return r[1]; });
  }
  // fecha estimada de llegada: fecha de envío + días hábiles del plazo ("7 a 12 días hábiles")
  function addBiz(iso, n) { var d = new Date(iso); if (isNaN(d)) d = new Date(); var k = 0; while (k < n) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w && w !== 6) k++; } return d.toISOString(); }
  function etaShort(fromIso) { var r = etaRange(fromIso); return r.from === r.to ? dmy(r.from) : dmy(r.from).slice(0, 5) + " al " + dmy(r.to); }
  function etaRange(fromIso) {
    var nums = (String(dispatch().eta).match(/\d+/g) || ["7", "12"]).map(Number), lo = nums[0], hi = nums[1] || nums[0];
    return { from: addBiz(fromIso, lo), to: addBiz(fromIso, hi), text: lo === hi ? dmy(addBiz(fromIso, lo)) : "entre el " + dmy(addBiz(fromIso, lo)) + " y el " + dmy(addBiz(fromIso, hi)) };
  }

  // ---------------------------------------------------------------------------
  // Boleta congelada (snapshot): lo mismo que se ve en la caja, guardado con el pedido
  // ---------------------------------------------------------------------------
  function snap(d) {
    var M = A(), bd = M.b3Breakdown(d.items || []);
    var me = S().me || {}, c = d.customer || null;
    return {
      v: 1, code: d.code, date: new Date().toISOString(),
      items: bd.lines.map(function (l) {
        var x = l.x;
        var o = (S().offers || []).find(function (z) { return String(z.id) === String(x.offer_id); }) || {};
        var ph = x.photo || o.photo_url || "";
        return { offer_id: x.offer_id || null, title: x.title || "", brand: x.brand || "", color: x.color || "", size: x.size || "", qty: x.qty || 1, promo: x.promo || null, unit_usd: Number(x.price_usd) || 0, usd: l.usd, clp: (Number(x.clp) || 0) * l.m,
          discount_pct: Number(o.discount_pct) || 0, discount1_pct: Number(o.discount1_pct) || 0, discount2_pct: Number(o.discount2_pct) || 0, photo: /^data:/.test(ph) ? "" : ph };
      }),
      totals: M.b3Totals(bd.t, d.share).map(function (r) { return [r[0], r[1], r[2] || ""]; }),
      total: d.total, share: d.share || 0, kg: bd.t.kg, fx: bd.t.fx, fx_note: M.fxNote ? M.fxNote() : "",
      shared: d.group ? "Compra compartida 50/50 (código " + d.group.id.slice(0, 6) + ")" : d.guestOf ? "Compra compartida 50/50 (código " + String(d.guestOf).slice(0, 6) + ")" : "",
      customer: c,
      client: { name: (c && c.full_name) || me.full_name || "", phone: (c && c.phone) || me.phone || "", email: (c && c.email) || "", gender: (c && c.gender) || "" },
    };
  }
  // Pedidos sin snapshot (anteriores a esta versión): se arma con las filas
  function snapFromRows(rows) {
    var r0 = rows[0] || {}, ship = (rows.find(function (o) { return o.ship_to; }) || {}).ship_to || null, bill = (rows.find(function (o) { return o.bill_to; }) || {}).bill_to || null;
    var live = rows.filter(function (o) { return o.status !== "cancelado"; }), total = live.reduce(function (t, o) { return t + (Number(o.total_clp) || 0); }, 0);
    var cl = r0.client || {};
    return {
      v: 0, code: r0.order_code || "", date: r0.created_at,
      items: live.map(function (o) { return { title: o.description || "", brand: "", color: "", size: "", qty: 1, desc: o.notes || "", usd: Number(o.price_usd) || 0, clp: Number(o.total_clp) || 0 }; }),
      totals: [["Subtotal precio en tienda", usd(live.reduce(function (t, o) { return t + (Number(o.price_usd) || 0); }, 0)), ""], ["TOTAL A PAGAR (CLP)", clp(total), "grand"]],
      total: total, share: 0, customer: ship ? Object.assign({}, ship, { bill: bill }) : null,
      client: { name: (ship && ship.full_name) || cl.full_name || "", phone: (ship && ship.phone) || cl.phone || "", email: (ship && ship.email) || "" },
    };
  }
  function info(g) {
    var rows = g.rows || [], live = rows.filter(function (o) { return o.status !== "cancelado"; });
    var withSnap = rows.find(function (o) { return o.order_snapshot; });
    var sn = withSnap ? withSnap.order_snapshot : snapFromRows(rows);
    if (typeof sn === "string") { try { sn = JSON.parse(sn); } catch (e) { sn = snapFromRows(rows); } }
    var pick = function (k) { var r = rows.find(function (o) { return o[k]; }); return r ? r[k] : null; };
    var sum = live.reduce(function (t, o) { return t + (Number(o.total_clp) || 0); }, 0);
    var cl = (rows[0] || {}).client || {};
    var phone = (sn.client && sn.client.phone) || (sn.customer && sn.customer.phone) || cl.phone || "";
    return {
      code: g.code, rows: rows, snap: sn, status: groupStatus(rows), receipt: pick("receipt_path"), receipt_by: pick("receipt_by"), receipt_at: pick("receipt_at"),
      oc: pick("oc_number"), paid_at: pick("paid_at"), paid_clp: Number(pick("paid_clp")) || 0,
      oc_doc_token: pick("oc_doc_token"), oc_pdf_url: pick("oc_pdf_url"), dispatch_doc_token: pick("dispatch_doc_token"), dispatch_pdf_url: pick("dispatch_pdf_url"),
      shipment: (function () { var v = pick("shipment"); if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } } return v || null; })(), delivered_at: pick("delivered_at"),
      amount: sn.share || sn.total || sum, name: (sn.client && sn.client.name) || (sn.customer && sn.customer.full_name) || cl.full_name || "", phone: phone,
    };
  }

  // ---------------------------------------------------------------------------
  // Mensaje de WhatsApp del PEDIDO (clienta → Cheryl)
  // ---------------------------------------------------------------------------
  var short = function (t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1).trim() + "…" : t; };
  var SHORT_LBL = [
    [/^Subtotal precio en tienda/, "Subtotal en tienda"],
    [/^Impuesto Florida (.*)$/, "Impuesto Florida $1"],
    [/^Comisión personal shopper (.*)$/, "Comisión shopper $1"],
    [/^Envío courier a Chile \((.*)\)$/, "Envío courier $1"],
    [/^Aduana.*$/, "Aduana (arancel+IVA)"],
    [/^Total US\$ × dólar/, "Total CLP"],
    [/^Redondeo a la centena/, "Redondeo centena"],
    [/^Ajuste por tipo de cambio/, "Ajuste tipo cambio"],
  ];
  var shortLbl = function (k) { for (var i = 0; i < SHORT_LBL.length; i++) if (SHORT_LBL[i][0].test(k)) return k.replace(SHORT_LBL[i][0], SHORT_LBL[i][1]); return k; };
  // Desglose en bloque monoespaciado de WhatsApp (```): montos alineados a la derecha
  function breakdownBlock(sn, padded) {
    var rows = (sn.totals || []).filter(function (r) { return r[2] !== "grand" && r[2] !== "share"; }).map(function (r) { return [shortLbl(r[0]), String(r[1]).replace(/−/g, "-")]; });
    if (!padded) return rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n");
    var lw = Math.max.apply(null, rows.map(function (r) { return r[0].length; }).concat([0])), vw = Math.max.apply(null, rows.map(function (r) { return r[1].length; }).concat([0]));
    var W = Math.min(32, Math.max(lw + 1 + vw, 24));
    return "```\n" + rows.map(function (r) { var gap = Math.max(1, W - r[0].length - r[1].length); return r[0] + " ".repeat(gap) + r[1]; }).join("\n") + "\n```";
  }
  var grand = function (sn) { var g = (sn.totals || []).find(function (r) { return r[2] === "grand"; }); return g ? g[1] : clp(sn.total); };
  function itemLine(x, i, lvl) {
    var qty = (x.qty || 1) + "×" + (x.promo === "2x1" ? " (2×1)" : "");
    if (lvl >= 2) return (i + 1) + ". " + qty + " " + short([x.brand, x.title].filter(Boolean).join(" "), 30) + " · " + usd(x.usd);
    var t = lvl >= 1 ? short(x.title, 30) : x.title;
    var det = [x.size ? (lvl >= 1 ? "T. " : "Talla ") + x.size : "", x.color || "", x.desc || ""].filter(Boolean);
    return (i + 1) + ". " + qty + " " + (x.brand ? "*" + x.brand + "* " : "") + t + (det.length ? " · " + det.join(" · ") : "") + " · " + usd(x.usd);
  }
  var addr = function (c) { return [[c.address, c.address2].filter(Boolean).join(", "), c.city, c.region, c.country && c.country !== "Chile" ? c.country : ""].filter(Boolean).join(", "); };
  function clientBlock(sn, lvl) {
    var c = sn.customer || {}, cl = sn.client || {};
    var L = ["*MIS DATOS*", "Nombre: " + (c.full_name || cl.name || "")];
    if (c.code) L.push("ID MSM: " + c.code);
    if (c.rut) L.push("RUT: " + c.rut);
    if (c.phone || cl.phone) L.push("Teléfono: " + (c.phone || cl.phone));
    if ((c.email || cl.email) && lvl < 3) L.push("Correo: " + (c.email || cl.email));
    if (c.address) L.push("Envío a Chile: " + addr(c));
    if (c.bill) {
      var b = c.bill;
      if (lvl >= 3) L.push("*REQUIERE FACTURA*: " + b.name + " · RUT " + b.rut + " · Giro: " + short(b.giro, 24));
      else L.push("", "*REQUIERE FACTURA*", "Razón social: " + b.name, "RUT: " + b.rut, "Giro: " + b.giro, "Dirección: " + [b.address, b.city, b.region].filter(Boolean).join(", "), [b.email ? "Mail: " + b.email : "", b.phone ? "Tel.: " + b.phone : ""].filter(Boolean).join(" · "));
    } else L.push("Factura: no");
    return L.filter(function (l) { return l !== null; });
  }
  function pedidoTextAt(sn, lvl) {
    var items = sn.items || [], max = lvl >= 4 ? 4 : items.length;
    var g = (sn.client && sn.client.gender) || (sn.customer && sn.customer.gender);
    var L = ["Hola " + cheryl() + ", este es mi pedido N° " + sn.code + ":", "", "*PRODUCTOS (precio en tienda)*"]
      .concat(items.slice(0, max).map(function (x, i) { return itemLine(x, i, lvl); }));
    if (items.length > max) L.push("… y " + (items.length - max) + " productos más (detalle completo en mi pedido en la app)");
    L.push("", "*DESGLOSE*", breakdownBlock(sn, lvl < 5), "*TOTAL A PAGAR (CLP): " + grand(sn) + "*");
    if (sn.share) L.push("*MI PARTE (50%): " + clp(sn.share) + "*");
    if (sn.shared) L.push(sn.shared);
    L.push(sn.fx_note ? "Valores puestos en Chile · " + sn.fx_note : "Valores puestos en Chile");
    L.push("");
    L = L.concat(clientBlock(sn, lvl));
    L.push("", (g === "hombre" ? "Quedo atento" : "Quedo atenta") + " para hacer la transferencia" + (sn.share ? " de mi parte" : "") + ". ¡Gracias!");
    return L.join("\n");
  }
  function fit(fn, phone) {
    var t = "";
    for (var lvl = 0; lvl <= 5; lvl++) { t = fn(lvl); if (A().waTo(phone || "56900000000", t).length <= MAX_URL) return t; }
    return t;
  }
  function pedidoText(sn) { return fit(function (l) { return pedidoTextAt(sn, l); }, (S().settings || {}).whatsapp); }

  // ---------------------------------------------------------------------------
  // Mensaje de WhatsApp de la ORDEN DE COMPRA (Cheryl → clienta)
  // ---------------------------------------------------------------------------
  var verified = function (I) { return I.receipt_at ? "Pago verificado con comprobante del " + dmy(I.receipt_at) : "Pago verificado con comprobante"; };

  // ---------------------------------------------------------------------------
  // PDF con marca Shoppers Miami (pedido, orden de compra y comprobante de despacho)
  // Generador propio, sin librerías: fuentes TrueType incrustadas (subconjuntos Latin-1 de
  // Bodoni Moda, Jost e Inter en fonts/pdf-*.ttf, OFL), fotos en JPEG y QR (vendor/qr/qrcode.js).
  // ---------------------------------------------------------------------------
  var FONT_FILES = { bodoni: "pdf-bodoni", jost: "pdf-jost", inter: "pdf-inter", interB: "pdf-inter-sb" };
  var assets = null;
  function loadAssets() {
    if (assets) return assets;
    assets = (async function () {
      var meta = await (await fetch("fonts/pdf-fonts.json")).json(), fonts = {};
      await Promise.all(Object.keys(FONT_FILES).map(async function (k) {
        var r = await fetch("fonts/" + FONT_FILES[k] + ".ttf"); if (!r.ok) throw new Error("fuente " + k);
        fonts[k] = { bytes: new Uint8Array(await r.arrayBuffer()), meta: meta[FONT_FILES[k]] };
      }));
      if (!window.MSQR) await new Promise(function (res) { var s = document.createElement("script"); s.src = "vendor/qr/qrcode.js"; s.onload = s.onerror = res; document.head.appendChild(s); });
      return fonts;
    })();
    assets.catch(function () { assets = null; });
    return assets;
  }
  // cp1252: caracteres especiales que sí existen en WinAnsi
  var CP = { 0x20ac: 128, 0x201a: 130, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x2030: 137, 0x2039: 139, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x2122: 153, 0x203a: 155 };
  function codes(t) {
    var out = [], s = String(t == null ? "" : t).normalize("NFC").replace(/−/g, "-").replace(/[  ]/g, " ");
    for (var i = 0; i < s.length; i++) { var u = s.charCodeAt(i); out.push(u >= 32 && u < 128 ? u : u >= 160 && u <= 255 ? u : CP[u] || 63); }
    return out;
  }
  var hex = function (h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255].map(function (v) { return v.toFixed(3); }).join(" "); };
  var C = { night: "#2a1450", purple: "#7b3fe4", cyan: "#22e3f0", cyanD: "#00808f", ink: "#1a1030", ink2: "#4a3d66", ink3: "#5e5280", lila: "#f6f2ff", lila2: "#ebe3fd", hair: "#ddd5f0", white: "#ffffff", red: "#e30613", yellow: "#ffe600", lilaT: "#cbbdf0", link: "#5b25c9" };
  var PW = 595, PH = 842, ML = 40, MR = 555, BOTTOM = 78;

  function Doc(fonts, opts) {
    var d = { pages: [], ops: null, y: 0, used: {}, images: [], opts: opts };
    d.w = function (t, f, size, tc) { var m = fonts[f].meta.widths, cs = codes(t); return cs.reduce(function (a, c) { return a + (m[c - 32] || 500); }, 0) * size / 1000 + (tc || 0) * cs.length; };
    d.text = function (t, x, y, f, size, color, o) {
      o = o || {}; if (t == null || t === "") return;
      d.used[f] = 1;
      var w = d.w(t, f, size, o.tc), xx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
      var s = codes(t).map(function (c) { return c === 40 || c === 41 || c === 92 ? "\\" + String.fromCharCode(c) : c > 126 || c < 32 ? "\\" + c.toString(8).padStart(3, "0") : String.fromCharCode(c); }).join("");
      d.ops.push("BT " + hex(color || C.ink) + " rg /" + f + " " + size + " Tf " + (o.tc ? o.tc + " Tc " : "") + "1 0 0 1 " + xx.toFixed(2) + " " + y.toFixed(2) + " Tm (" + s + ") Tj" + (o.tc ? " 0 Tc" : "") + " ET");
      return w;
    };
    d.wrap = function (t, f, size, max) {
      var out = [];
      String(t == null ? "" : t).split("\n").forEach(function (para) {
        var cur = "";
        para.split(" ").forEach(function (word) { var tryS = cur ? cur + " " + word : word; if (d.w(tryS, f, size) > max && cur) { out.push(cur); cur = word; } else cur = tryS; });
        out.push(cur);
      });
      return out;
    };
    d.para = function (t, x, y, f, size, color, max, lh) { var L = d.wrap(t, f, size, max); L.forEach(function (l, i) { d.text(l, x, y - i * lh, f, size, color); }); return L.length * lh; };
    d.rect = function (x, y, w, h, fill, stroke, lw) { d.ops.push((fill ? hex(fill) + " rg " : "") + (stroke ? hex(stroke) + " RG " + (lw || 1) + " w " : "") + x.toFixed(2) + " " + y.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re " + (fill && stroke ? "B" : fill ? "f" : "S")); };
    d.rrect = function (x, y, w, h, r, fill, stroke, lw) {
      var k = 0.5523 * r, p = [x + r, y, "m", x + w - r, y, "l", x + w - r + k, y, x + w, y + r - k, x + w, y + r, "c", x + w, y + h - r, "l", x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h, "c", x + r, y + h, "l", x + r - k, y + h, x, y + h - r + k, x, y + h - r, "c", x, y + r, "l", x, y + r - k, x + r - k, y, x + r, y, "c"];
      d.ops.push((fill ? hex(fill) + " rg " : "") + (stroke ? hex(stroke) + " RG " + (lw || 1) + " w " : "") + p.map(function (v) { return typeof v === "number" ? v.toFixed(2) : v; }).join(" ") + " h " + (fill && stroke ? "B" : fill ? "f" : "S"));
    };
    d.circle = function (cx, cy, r, fill) { d.rrect(cx - r, cy - r, 2 * r, 2 * r, r, fill); };
    d.line = function (x1, y1, x2, y2, color, lw) { d.ops.push(hex(color) + " RG " + (lw || 1) + " w " + x1 + " " + y1.toFixed(2) + " m " + x2 + " " + y2.toFixed(2) + " l S"); };
    d.gradLine = function (x, y, w, h) { var n = 48; for (var i = 0; i < n; i++) { var t = i / (n - 1), c = [0x7b + (0x22 - 0x7b) * t, 0x3f + (0xe3 - 0x3f) * t, 0xe4 + (0xf0 - 0xe4) * t].map(function (v) { return (v / 255).toFixed(3); }).join(" "); d.ops.push(c + " rg " + (x + w * i / n).toFixed(2) + " " + y + " " + (w / n + 0.4).toFixed(2) + " " + h + " re f"); } };
    d.image = function (img, x, y, w, h) { if (d.images.indexOf(img) < 0) d.images.push(img); d.ops.push("q " + w.toFixed(2) + " 0 0 " + h.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /Im" + d.images.indexOf(img) + " Do Q"); };
    d.qr = function (m, x, y, size) { var n = m.length, q = size / (n + 2); d.rect(x, y, size, size, C.white); var s = [hex(C.ink) + " rg"]; m.forEach(function (row, r) { row.forEach(function (on, c) { if (on) s.push((x + (c + 1) * q).toFixed(2) + " " + (y + size - (r + 2) * q).toFixed(2) + " " + (q + 0.05).toFixed(2) + " " + (q + 0.05).toFixed(2) + " re"); }); }); s.push("f"); d.ops.push(s.join("\n")); };
    d.pill = function (t, xr, y, fill, ink) { var w = d.w(t, "interB", 9) + 18; d.rrect(xr - w, y, w, 17, 8.5, fill); d.text(t, xr - w / 2, y + 5.2, "interB", 9, ink, { align: "center" }); return w; };
    d.newPage = function () {
      d.ops = []; d.pages.push(d.ops);
      var first = d.pages.length === 1, o = d.opts;
      if (first) {
        d.rect(0, PH - 118, PW, 118, C.night); d.gradLine(0, PH - 121, PW, 3);
        d.text(appName(), ML, PH - 58, "bodoni", 31, C.white);
        d.text("Personal shopper en Miami", ML + 1, PH - 80, "inter", 11, C.cyan, { tc: 0.6 });
        d.text("Compras en Miami, entrega en Chile", ML + 1, PH - 98, "inter", 9, C.lilaT);
        d.text(o.title, MR, PH - 44, "jost", 12, C.cyan, { align: "right", tc: 1.6 });
        d.text(o.number, MR, PH - 68, "jost", 21, C.white, { align: "right" });
        d.text(o.date, MR, PH - 85, "inter", 9.5, C.lilaT, { align: "right" });
        if (o.status) d.pill(o.status, MR, PH - 109, C.cyan, "#120626");
        d.y = PH - 150;
      } else {
        d.rect(0, PH - 46, PW, 46, C.night); d.gradLine(0, PH - 48, PW, 2);
        d.text(appName(), ML, PH - 30, "bodoni", 17, C.white);
        d.text(o.title + "  " + o.number, MR, PH - 28, "jost", 10.5, C.cyan, { align: "right", tc: 1 });
        d.y = PH - 78;
      }
    };
    d.need = function (h) { if (d.y - h < BOTTOM) d.newPage(); };
    d.section = function (t) { d.need(52); d.y -= 14; d.text(String(t).toUpperCase(), ML, d.y, "jost", 11.5, C.purple, { tc: 1.4 }); d.gradLine(ML, d.y - 6, 64, 1.6); d.y -= 22; };
    // tabla clave/valor con filas alternadas (x, ancho); devuelve el alto
    d.kv = function (rows, x, w, y0, lw) {
      var y = y0, lab = lw || Math.min(108, w * 0.4);
      rows.forEach(function (r, i) {
        var L = d.wrap(r[1], r[2] ? "interB" : "inter", 9.5, w - lab - 14), h = Math.max(1, L.length) * 12.5 + 7;
        if (i % 2 === 0) d.rect(x, y - h + 3, w, h, C.lila);
        d.text(r[0], x + 7, y - 9, "interB", 8.8, C.ink3);
        L.forEach(function (l, j) { d.text(l, x + lab, y - 9 - j * 12.5, r[2] ? "interB" : "inter", 9.5, r[3] || C.ink); });
        y -= h;
      });
      return y0 - y;
    };
    d.kvFlow = function (rows, lw) {   // a lo ancho, con saltos de página
      rows.forEach(function (r, i) {
        var L = d.wrap(r[1], r[2] ? "interB" : "inter", 9.5, MR - ML - (lw || 130) - 14), h = L.length * 12.5 + 7;
        d.need(h); if (i % 2 === 0) d.rect(ML, d.y - h + 3, MR - ML, h, C.lila);
        d.text(r[0], ML + 7, d.y - 9, "interB", 8.8, C.ink3);
        L.forEach(function (l, j) { d.text(l, ML + (lw || 130), d.y - 9 - j * 12.5, r[2] ? "interB" : "inter", 9.5, r[3] || C.ink); });
        d.y -= h;
      });
      d.y -= 6;
    };
    d.steps = function (list) {
      list.forEach(function (t, i) {
        var L = d.wrap(t, "inter", 10, MR - ML - 34), h = Math.max(24, L.length * 13.5 + 10);
        d.need(h);
        d.circle(ML + 10, d.y - 7, 10, C.cyan); d.text(String(i + 1), ML + 10, d.y - 11, "jost", 11, "#120626", { align: "center" });
        L.forEach(function (l, j) { d.text(l, ML + 30, d.y - 10.5 - j * 13.5, "inter", 10, C.ink); });
        d.y -= h;
      });
    };
    d.footer = function () {
      var s = S().settings || {}, n = d.pages.length;
      var cond = "Valores en pesos chilenos (CLP) puestos en Chile. " + appName() + " compra por encargo en tiendas de Miami: si un producto ya no está disponible se devuelve su valor. Plazos del courier son estimados y no incluyen demoras de aduana. Documento emitido por " + appName() + ", no es boleta ni factura del SII.";
      d.pages.forEach(function (ops, i) {
        d.ops = ops;
        d.line(ML, 66, MR, 66, C.hair, 0.8);
        d.wrap(cond, "inter", 7, MR - ML).slice(0, 3).forEach(function (l, j) { d.text(l, ML, 55 - j * 8.6, "inter", 7, C.ink3); });
        d.rect(0, 0, PW, 26, C.night);
        d.text(cheryl() + " · WhatsApp " + (s.whatsapp || "") + (s.bank_email ? " · " + s.bank_email : ""), ML, 9.5, "interB", 8.5, C.white);
        d.text("Página " + (i + 1) + " de " + n, MR, 9.5, "inter", 8.5, C.cyan, { align: "right" });
      });
    };
    d.build = function () {
      d.footer();
      var enc = new TextEncoder(), parts = [], len = 0, offs = [];
      var push = function (x) { var b = typeof x === "string" ? latin1(x) : x; parts.push(b); len += b.length; };
      var latin1 = function (s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
      var objs = [];   // [header string, binary?]
      var add = function (body, bin) { objs.push([body, bin]); return objs.length; };
      var catalog = add(null), pagesId = add(null), fontIds = {};
      Object.keys(d.used).forEach(function (k, i) {
        var f = fonts[k], m = f.meta, nm = "SMPDF" + String.fromCharCode(65 + i) + "+" + m.name;
        var file = add("<< /Length " + f.bytes.length + " /Length1 " + f.bytes.length + " >>", f.bytes);
        var desc = add("<< /Type /FontDescriptor /FontName /" + nm + " /Flags 32 /FontBBox [" + m.bbox.join(" ") + "] /ItalicAngle 0 /Ascent " + m.ascent + " /Descent " + m.descent + " /CapHeight " + m.cap + " /StemV 80 /FontFile2 " + file + " 0 R >>");
        fontIds[k] = add("<< /Type /Font /Subtype /TrueType /BaseFont /" + nm + " /FirstChar 32 /LastChar 255 /Widths [" + m.widths.join(" ") + "] /FontDescriptor " + desc + " 0 R /Encoding /WinAnsiEncoding >>");
      });
      var imgIds = d.images.map(function (im) { return add("<< /Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + im.bytes.length + " >>", im.bytes); });
      var res = "<< /Font << " + Object.keys(fontIds).map(function (k) { return "/" + k + " " + fontIds[k] + " 0 R"; }).join(" ") + " >>" + (imgIds.length ? " /XObject << " + imgIds.map(function (id, i) { return "/Im" + i + " " + id + " 0 R"; }).join(" ") + " >>" : "") + " >>";
      var pageIds = d.pages.map(function (ops) {
        var content = latin1(ops.join("\n"));
        var cid = add("<< /Length " + content.length + " >>", content);
        return add("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources " + res + " /Contents " + cid + " 0 R >>");
      });
      objs[catalog - 1][0] = "<< /Type /Catalog /Pages " + pagesId + " 0 R >>";
      objs[pagesId - 1][0] = "<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>";
      push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
      objs.forEach(function (o, i) { offs.push(len); push((i + 1) + " 0 obj\n" + o[0] + "\n"); if (o[1]) { push("stream\n"); push(o[1]); push("\nendstream\n"); } push("endobj\n"); });
      var xref = len;
      push("xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map(function (o) { return String(o).padStart(10, "0") + " 00000 n \n"; }).join("") + "trailer\n<< /Size " + (objs.length + 1) + " /Root " + catalog + " 0 R /Info << /Producer (" + appName() + ") /Title (" + d.opts.title + " " + d.opts.number + ") >> >>\nstartxref\n" + xref + "\n%%EOF");
      void enc;
      return new Blob(parts, { type: "application/pdf" });
    };
    return d;
  }
  // foto del producto → JPEG chico (si no se puede, sin foto)
  function loadThumb(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image(), done = false, t = setTimeout(function () { if (!done) { done = true; res(null); } }, 2500);
      if (!/^data:/.test(src)) img.crossOrigin = "anonymous";
      img.onload = function () {
        if (done) return; done = true; clearTimeout(t);
        try {
          var s = 96, cv = document.createElement("canvas"); cv.width = s; cv.height = s;
          var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, s, s);
          var r = Math.max(s / img.naturalWidth, s / img.naturalHeight), w = img.naturalWidth * r, h = img.naturalHeight * r;
          g.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
          var b64 = cv.toDataURL("image/jpeg", 0.72).split(",")[1], bin = atob(b64), u = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          res({ bytes: u, w: s, h: s });
        } catch (e) { res(null); }
      };
      img.onerror = function () { if (!done) { done = true; clearTimeout(t); res(null); } };
      img.src = src;
    });
  }
  function bankRowsS() { var s = S().settings || {}; return [["Banco", s.bank_name], ["Tipo de cuenta", s.bank_account_type], ["N° de cuenta", s.bank_account], ["RUT", s.bank_rut], ["Titular", s.bank_holder], ["Correo", s.bank_email]].filter(function (r) { return r[1]; }); }
  function clientRows(sn) {
    var c = sn.customer || {}, cl = sn.client || {}, b = c.bill;
    return [["Nombre", c.full_name || cl.name || "", true], ["ID MSM", c.code || "-"], ["RUT", c.rut || (b && b.rut ? b.rut : "No informado")], ["Teléfono", c.phone || cl.phone || "-"], ["Correo", c.email || cl.email || "-"],
      ["Factura", b ? "REQUIERE FACTURA · " + b.name + " · RUT " + b.rut + " · Giro: " + (b.giro || "") : "No (boleta)", !!b, b ? C.purple : null]];
  }
  function shipRows(sn, extra) {
    var c = sn.customer || {};
    return [["Dirección", [c.address, c.address2].filter(Boolean).join(", ") || "-", true], ["Comuna / ciudad", c.city || "-"], ["Región", c.region || "-"], ["País", c.country || "Chile"]].concat(extra || []);
  }
  // etiqueta de descuento: "-30% + -20% extra" si hubo descuento sobre descuento, si no "-30%"
  var offerOf = function (x) { return (S().offers || []).find(function (z) { return String(z.id) === String(x.offer_id); }) || (x.offer_id && offCache[x.offer_id]) || {}; };
  var offCache = {};
  async function fetchOffers(items) {   // en Pedidos de Cheryl las ofertas no siempre están cargadas
    for (var i = 0; i < (items || []).length; i++) { var x = items[i]; if (x.offer_id && !offerOf(x).id) { try { var o = await S().api.getOffer(x.offer_id); if (o) offCache[x.offer_id] = o; } catch (e) {} } }
  }
  function discountOf(x) {
    var o = offerOf(x);
    var d1 = Number(x.discount1_pct || o.discount1_pct) || 0, d2 = Number(x.discount2_pct || o.discount2_pct) || 0, d = Number(x.discount_pct || o.discount_pct) || 0;
    if (d1 && d2) return "-" + Math.round(d1) + "% + -" + Math.round(d2) + "% extra";
    return d || d1 ? "-" + Math.round(d || d1) + "%" : "";
  }
  function productsTable(d, sn, thumbs, opts) {
    opts = opts || {};
    var cols = { prod: ML + 8, size: 300, color: 345, qty: 420, price: MR - 8 };
    var head = function () {
      d.need(60); d.rect(ML, d.y - 20, MR - ML, 22, C.night);
      [["PRODUCTO", cols.prod], ["TALLA", cols.size], ["COLOR", cols.color], ["CANT.", cols.qty]].forEach(function (h) { d.text(h[0], h[1], d.y - 13, "interB", 8, C.white, { tc: 0.8 }); });
      if (!opts.noPrice) d.text("PRECIO EN TIENDA", cols.price, d.y - 13, "interB", 8, C.white, { align: "right", tc: 0.8 });
      d.y -= 22;
    };
    head();
    (sn.items || []).forEach(function (x, i) {
      var th = thumbs[i], tx = cols.prod + (th ? 40 : 0), L = d.wrap(x.title, "interB", 9.8, cols.size - tx - 10).slice(0, 3);
      var sub = [x.brand, x.desc || ""].filter(Boolean).join(" · "), disc = discountOf(x);
      var h = Math.max(th ? 44 : 0, L.length * 12.5 + (sub || disc ? 13 : 0) + 12);
      if (d.y - h < BOTTOM) { d.newPage(); head(); }
      if (i % 2 === 0) d.rect(ML, d.y - h, MR - ML, h, C.lila);
      if (th) { d.rrect(cols.prod - 1, d.y - 39, 36, 36, 4, C.white, C.hair, 0.6); d.image(th, cols.prod + 1, d.y - 37, 32, 32); }
      L.forEach(function (l, j) { d.text(l, tx, d.y - 14 - j * 12.5, "interB", 9.8, C.ink); });
      var yy = d.y - 14 - L.length * 12.5, xx = tx;
      if (sub) xx += d.text(sub, tx, yy, "inter", 8.5, C.ink3) + 6;
      if (disc) { var lab = disc, w = d.w(lab, "interB", 8) + 10; d.rrect(xx, yy - 3, w, 12, 2, C.red); d.text(lab, xx + 5, yy, "interB", 8, C.yellow); }
      d.text(x.size || "-", cols.size, d.y - 14, "inter", 9.5, C.ink);
      d.wrap(x.color || "-", "inter", 9.5, cols.qty - cols.color - 8).slice(0, 2).forEach(function (l, j) { d.text(l, cols.color, d.y - 14 - j * 12, "inter", 9.5, C.ink); });
      d.text(String(x.qty || 1) + (x.promo === "2x1" ? " (2x1)" : ""), cols.qty, d.y - 14, "inter", 9.5, C.ink);
      if (!opts.noPrice) d.text(usd(x.usd), cols.price, d.y - 14, "interB", 9.8, C.ink, { align: "right" });
      d.y -= h;
    });
    d.line(ML, d.y, MR, d.y, C.hair, 0.8); d.y -= 14;
  }
  // caja de totales (derecha) + tarjeta a la izquierda (pago / transferencia)
  function totalsBox(d, sn, grandLabel, grandValue, leftTitle, leftRows) {
    var rows = (sn.totals || []).filter(function (r) { return r[2] !== "grand"; });
    var bx = 312, bw = MR - bx, h = rows.length * 14 + 70;
    var lh = leftRows ? 30 + leftRows.length * 18.5 : 0;
    d.need(Math.max(h, lh) + 4);
    var top = d.y;
    d.rrect(bx, top - h, bw, h, 8, C.lila, C.purple, 1);
    var y = top - 16;
    rows.forEach(function (r) {
      var b = r[2] === "sum" || r[2] === "share";
      var room = bw - 26 - d.w(String(r[1]), "inter", 9), fs = Math.max(6.8, Math.min(8.6, 8.6 * room / Math.max(1, d.w(r[0], b ? "interB" : "inter", 8.6))));
      d.text(r[0], bx + 10, y, b ? "interB" : "inter", fs, b ? C.ink : C.ink2);
      d.text(String(r[1]), MR - 10, y, b ? "interB" : "inter", 9, C.ink, { align: "right" });
      y -= 14;
    });
    d.rrect(bx + 4, top - h + 4, bw - 8, 52, 6, C.night);
    d.text(grandLabel, bx + 14, top - h + 40, "interB", 9, C.cyan, { tc: 0.6 });
    d.text(grandValue, MR - 14, top - h + 13, "jost", 22, C.white, { align: "right" });
    if (leftRows) {
      var lw = bx - ML - 14;
      d.rrect(ML, top - lh, lw, lh, 8, C.white, C.cyan, 1.2);
      d.text(leftTitle, ML + 12, top - 18, "jost", 10.5, C.purple, { tc: 1 });
      leftRows.forEach(function (r, i) { var yy = top - 38 - i * 18.5; d.text(r[0], ML + 12, yy, "interB", 8.5, C.ink3); d.text(d.wrap(r[1], "inter", 9.2, lw - 112)[0], ML + 104, yy, r[2] ? "interB" : "inter", 9.2, C.ink); });
    }
    d.y = top - Math.max(h, lh) - 18;
  }
  function courierCard(d, sh) {
    var g = dispatch(), rows = [["Courier", g.courier, true], ["WhatsApp", g.courier_wa], ["Teléfono", g.courier_phone], ["Correo", g.courier_email], ["Seguimiento", sh && sh.tracking ? trackLink(g, sh.tracking).replace(/^https?:\/\//, "") : g.track_url], ["Sucursal de retiro", g.pickup], ["Horario", g.pickup_hours]].filter(function (r) { return r[1]; });
    var lines = rows.map(function (r) { return d.wrap(r[1], r[2] ? "interB" : "inter", 9.5, MR - ML - 150); }), h = 34 + lines.reduce(function (a, L) { return a + L.length * 13 + 3; }, 0);
    d.need(h + 8);
    d.rrect(ML, d.y - h, MR - ML, h, 10, "#effcfd", C.cyanD, 1.2);
    d.rect(ML, d.y - h + 10, 5, h - 20, C.cyan);
    d.text("CONTACTO DEL COURIER", ML + 18, d.y - 18, "jost", 10.5, C.cyanD, { tc: 1.2 });
    var y = d.y - 36;
    rows.forEach(function (r, i) { d.text(r[0], ML + 18, y, "interB", 8.8, C.ink3); lines[i].forEach(function (l, j) { d.text(l, ML + 132, y - j * 13, r[2] ? "interB" : "inter", 9.5, C.ink); }); y -= lines[i].length * 13 + 3; });
    d.y -= h + 14;
  }
  async function buildPDF(kind, I) {
    var fonts = await loadAssets(), sn = I.snap, g = dispatch(), sh = I.shipment || {};
    var titles = { pedido: "PEDIDO", oc: "ORDEN DE COMPRA", despacho: "COMPROBANTE DE DESPACHO" };
    var st = { pedido: I.receipt ? "Comprobante recibido" : "Pendiente de transferencia", oc: "Pagado - OC emitida", despacho: I.status === "entregado" ? "Entregado" : "Enviado a Chile" };
    var when = kind === "pedido" ? sn.date : kind === "oc" ? I.paid_at : sh.at || sh.date;
    var d = Doc(fonts, { title: titles[kind], number: kind === "pedido" ? "N° " + I.code : kind === "oc" ? "N° " + I.oc : "Pedido " + I.code, date: "Emitido el " + dmy(when) + " " + hm(when), status: st[kind] });
    await fetchOffers(sn.items);
    var thumbs = await Promise.all((sn.items || []).slice(0, 14).map(function (x) { return loadThumb(x.photo || offerOf(x).photo_url); }));
    d.newPage();
    // franja de datos principales
    var strip = kind === "pedido" ? [["N° de pedido", I.code], ["Fecha", dmy(sn.date)], ["Total a pagar", grand(sn)], ["Estado", st.pedido]]
      : kind === "oc" ? [["Orden de compra", I.oc], ["Pedido", I.code], ["Fecha de pago", dmy(I.paid_at)], ["Total pagado", clp(I.paid_clp || I.amount)]]
      : [["Pedido", I.code], ["Orden de compra", I.oc || "-"], ["Fecha de envío", dmy(sh.date)], ["Llegada estimada", sh.date ? etaShort(sh.date) : "-"]];
    var cw = (MR - ML) / 4;
    d.rrect(ML, d.y - 44, MR - ML, 46, 8, C.lila);
    strip.forEach(function (r, i) { d.text(r[0].toUpperCase(), ML + 12 + i * cw, d.y - 15, "interB", 7.6, C.purple, { tc: 0.8 }); var fs = Math.max(8.5, Math.min(11.5, 11.5 * (cw - 18) / Math.max(1, d.w(r[1], "jost", 11.5)))); d.text(r[1], ML + 12 + i * cw, d.y - 33, "jost", fs, C.ink); });
    d.y -= kind === "pedido" ? 74 : 62;
    if (kind === "oc") { d.text(verified(I) + (I.receipt_by ? " (subido por " + uploaderBy(I.receipt_by) + ")" : "") + " · aprobado el " + dmy(I.paid_at) + ".", ML, d.y, "interB", 9.5, C.cyanD); d.y -= 30; }
    if (kind === "despacho") {
      var link = trackLink(g, sh.tracking), qr = window.MSQR && link ? (function () { try { return window.MSQR(link); } catch (e) { return null; } })() : null, bh = 108;
      d.rrect(ML, d.y - bh, MR - ML, bh, 10, C.night);
      d.gradLine(ML + 14, d.y - bh + 12, 220, 2);
      d.text("N° DE SEGUIMIENTO · " + String(sh.courier || g.courier).toUpperCase(), ML + 16, d.y - 22, "interB", 8.5, C.cyan, { tc: 1 });
      var tn = String(sh.tracking || ""), size = Math.min(34, (MR - ML - 150) / Math.max(1, d.w(tn, "jost", 1)));
      d.text(tn, ML + 16, d.y - 62, "jost", size, C.white);
      if (link) d.text("Síguelo en " + link.replace(/^https?:\/\//, ""), ML + 16, d.y - 86, "inter", 9.5, C.lilaT);
      if (qr) { d.qr(qr, MR - 98, d.y - bh + 10, 88); }
      d.y -= bh + 20;
    }
    // clienta + envío en dos columnas
    var half = (MR - ML - 12) / 2;
    d.need(150);
    d.text("CLIENTA", ML, d.y, "jost", 11.5, C.purple, { tc: 1.4 }); d.gradLine(ML, d.y - 6, 64, 1.6);
    d.text(kind === "despacho" ? "SE ENTREGA EN" : "DIRECCIÓN DE ENVÍO EN CHILE", ML + half + 12, d.y, "jost", 11.5, C.purple, { tc: 1.4 }); d.gradLine(ML + half + 12, d.y - 6, 64, 1.6);
    d.y -= 18;
    var extra = kind === "despacho" ? [["Peso real", sh.kg ? fmtKg(sh.kg) + " kg" : "-"], ["Nota", sh.note || "-"]] : [["Entrega", MODES[g.mode]]];
    var h1 = d.kv(clientRows(sn), ML, half, d.y, 70), h2 = d.kv(shipRows(sn, extra), ML + half + 12, half, d.y, 92);
    d.y -= Math.max(h1, h2) + 18;
    d.section(kind === "despacho" ? "Productos enviados" : "Detalle de la compra");
    productsTable(d, sn, thumbs, { noPrice: kind === "despacho" });
    if (kind === "pedido") totalsBox(d, sn, "TOTAL A PAGAR (CLP)", grand(sn), "DATOS PARA LA TRANSFERENCIA", [["Monto", clp(sn.share || sn.total), true]].concat(bankRowsS()));
    if (kind === "oc") totalsBox(d, sn, "TOTAL PAGADO (CLP)", clp(I.paid_clp || I.amount), "PAGO", [["Fecha de pago", dmy(I.paid_at), true], ["Medio", "Transferencia bancaria"], ["Comprobante", I.receipt_at ? "del " + dmy(I.receipt_at) : "en la app"], ["Subido por", uploaderBy(I.receipt_by) || "-"], ["Pedido", I.code]]);
    if (kind === "pedido") {
      d.section("Qué sigue");
      d.steps(["Transfiere " + clp(sn.share || sn.total) + " a la cuenta indicada y sube el comprobante en la app (Mis pedidos) o envíaselo a " + cheryl() + " por WhatsApp.",
        cheryl() + " revisa tu transferencia, te envía tu orden de compra y compra tus productos en Miami.",
        "Viajan por courier a Chile (" + g.eta + ") y te llega el número de seguimiento.", entregaText(g)]);
    }
    if (kind === "oc") {
      d.section("Pasos a seguir"); d.steps(stepsList());
      d.section("Guía de envío a Chile"); courierCard(d, null);
      d.kvFlow(guideRows().filter(function (r) { return ["Compañía courier", "Contacto del courier"].indexOf(r[0]) < 0; }), 120);
    }
    if (kind === "despacho") {
      d.section("Cómo recibir tu paquete en Chile");
      d.steps(["Sigue tu envío con el N° " + sh.tracking + " en " + (trackLink(g, sh.tracking) || g.track_url).replace(/^https?:\/\//, "") + ". Llegada estimada " + etaRange(sh.date).text + ".", entregaText(g), g.doc, g.customs, "Si tienes dudas del envío, escríbele al courier (" + courierContact(g) + ") o a " + cheryl() + "."]);
      d.section("Datos del courier"); courierCard(d, sh);
    }
    return d.build();
  }
  var fmtKg = function (n) { return Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 }); };
  var PDF_NAME = { pedido: "Pedido", oc: "Orden-de-compra", despacho: "Comprobante-de-despacho" };
  async function sharePDF(I, kind) {
    kind = kind || "oc";
    var toast = A().toast || function () {}, blob;
    try { blob = await buildPDF(kind, I); } catch (e) { console.error(e); toast("No se pudo generar el PDF"); return; }
    var name = PDF_NAME[kind] + "-" + (kind === "oc" ? I.oc : I.code) + ".pdf";
    try {
      var file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name.replace(/-/g, " ").replace(".pdf", "") }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast("PDF descargado"); }
    catch (e2) { toast("Este navegador no permite descargar el PDF"); }
  }
  // PDF del pedido (caja y "Descargar pedido en PDF"): mismo diseño
  function pedidoInfo(d) { return { code: d.code, snap: d.snap || snap(d), receipt: !!d.receipt, status: d.receipt ? "comprobante_recibido" : "pendiente_pago", amount: d.share || d.total }; }
  async function pedidoPDF(d) { return buildPDF("pedido", pedidoInfo(d)); }
  if (typeof requestIdleCallback === "function") requestIdleCallback(function () { loadAssets(); }, { timeout: 4000 }); else setTimeout(loadAssets, 1500);

  // ---------------------------------------------------------------------------
  // Boleta en pantalla desde el snapshot (mismas clases que la de la caja)
  // ---------------------------------------------------------------------------
  function snapHTML(sn, title) {
    return '<div class="b3-voucher oc-voucher" aria-label="' + esc(title || "Boleta del pedido") + '">' +
      '<div class="b3-vhead"><b>' + esc(appName()) + "</b><span>" + esc(title || "Boleta de compra · Miami → Chile") + "</span><span>" + esc(dmy(sn.date)) + (sn.code ? " · Pedido " + esc(sn.code) : "") + "</span></div>" +
      '<div class="b3-vcols"><span>Descripción</span><span>Precio en tienda</span></div>' +
      (sn.items || []).map(function (x) {
        var det = x.desc ? [x.desc] : [x.brand, x.color ? "Color " + x.color : "", x.size ? "Talla " + x.size : "", "Cant. " + x.qty + (x.promo === "2x1" ? " (2×1)" : "")].filter(Boolean);
        return '<div class="b3-vl"><div class="b3-vd"><b>' + esc(x.title) + "</b><span>" + det.map(esc).join(" · ") + '</span></div><span class="b3-va">' + usd(x.usd) + "</span></div>";
      }).join("") +
      '<div class="b3-vtot">' + (sn.totals || []).map(function (r) { return '<div class="b3-vr' + (r[2] ? " b3-" + r[2] : "") + '"><span>' + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>"; }).join("") + "</div>" +
      (sn.fx_note ? '<div class="b3-vfoot">Valores puestos en Chile · ' + esc(sn.fx_note) + "</div>" : "") + "</div>";
  }
  function stepsHTML() { return '<ol class="oc-steps">' + stepsList().map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>"; }

  // ---------------------------------------------------------------------------
  // Caja: pantalla final tras hacer el pedido
  // ---------------------------------------------------------------------------
  function doneHTML(done, o) {
    var name = cheryl(), M = A(), sn = done.snap || snap(done);
    return '<section class="oc-done" aria-label="Pedido enviado">' +
      '<div class="order-box oc-sent"><span class="oc-kicker">Pedido enviado a ' + esc(name) + '</span><b class="ocode">' + esc(done.code) + "</b>" +
        '<div class="oc-st-line">Estado: <span id="oc-done-status">' + statusPill(done.receipt ? "comprobante_recibido" : "pendiente_pago") + "</span></div>" +
        (done.customer ? '<span class="small cli-done">Tu N° de clienta: <b class="cli-code" id="cli-done-code">' + esc(done.customer.code) + "</b></span>" : "") +
        (o.pedidoHref ? '<a class="btn wa block" id="oc-resend" target="_blank" rel="noopener" href="' + esc(o.pedidoHref) + '">Enviar mi pedido a ' + esc(name) + " por WhatsApp</a>" +
          '<p class="small muted wa-fallback">Te abrimos WhatsApp con tu pedido completo. Si no se abrió solo, toca el botón de arriba.</p>' : "") +
        '<button class="btn ghost block" id="pdf">Descargar pedido en PDF</button></div>' +
      (o.invite || "") +
      '<h3 class="oc-h">1. Transfiere ' + clp(o.toPay) + "</h3>" + M.bankHTML(o.toPay) +
      '<h3 class="oc-h">2. Subir comprobante de transferencia</h3><p class="small muted oc-p">Foto, captura o PDF. Le llega a ' + esc(name) + " junto a tu pedido.</p>" + M.receiptUploader(done.code).html +
      (o.proofHref ? '<a class="btn ghost block oc-wa-alt" target="_blank" rel="noopener" href="' + esc(o.proofHref) + '">o envíaselo a ' + esc(name) + " por WhatsApp</a>" : "") +
      '<h3 class="oc-h">Lo que sigue</h3><ol class="oc-next">' +
        "<li><b>Transfiere</b><span>" + clp(o.toPay) + " a la cuenta de arriba y sube el comprobante.</span></li>" +
        "<li><b>" + esc(name) + " confirma y compra</b><span>Revisa tu transferencia, te envía tu orden de compra y compra tus productos en Miami.</span></li>" +
        "<li><b>Despacho a Chile</b><span>Viajan por courier (" + esc(dispatch().eta) + ") y te llega el número de seguimiento.</span></li>" +
        "<li><b>Retiro o entrega</b><span>" + esc(entregaText(dispatch())) + "</span></li></ol>" +
      '<h3 class="oc-h">Detalle de tu pedido</h3>' + (o.boleta || snapHTML(sn)) +
      "</section>";
  }
  function markReceived(view) { var el = view.querySelector("#oc-done-status"); if (el) el.innerHTML = statusPill("comprobante_recibido"); }

  // ---------------------------------------------------------------------------
  // Componente de pago y envío (el MISMO en Pedidos, en el tablero y en la ficha de la clienta):
  // comprobante en la app → "Subir transferencia" → confirmar monto → orden de compra →
  // "Registrar envío" → comprobante de despacho → "Marcar entregado"
  // ---------------------------------------------------------------------------
  var cache = {};
  var uploaderBy = function (by) { return by === "cheryl" ? cheryl() : by === "clienta" ? "la clienta" : ""; };
  var isApprovable = function (I) { return !I.oc && ["pendiente_pago", "comprobante_recibido", "pagado"].indexOf(I.status) >= 0; };
  var canShip = function (I) { return !!I.oc && !I.shipment && ["pagado", "comprado", "en_bodega"].indexOf(I.status) >= 0; };
  var inTransit = function (I) { return !!I.shipment && I.status === "enviado"; };
  function receiptLine(I, withBtn) {
    if (!I.receipt) return "";
    return '<div class="oc-rcpt-line"><span class="oc-thumb" data-oc-thumb="' + esc(I.code) + '" aria-hidden="true"></span><span class="grow"><b>Comprobante en la app</b><span>' + (I.receipt_by ? "Subido por " + esc(uploaderBy(I.receipt_by)) : "Subido") + (I.receipt_at ? " el " + esc(dmy(I.receipt_at)) + " a las " + esc(hm(I.receipt_at)) : "") + "</span></span>" +
      (withBtn ? '<button type="button" class="btn ghost sm" data-oc-rcpt="' + esc(I.code) + '">Ver</button>' : "") + "</div>";
  }
  var uploaderHTML = function (code) { return '<div class="oc-up" data-oc-up="' + esc(code) + '">' + A().receiptUploader(code).html.replace("Subir comprobante (foto o PDF)", "Subir transferencia (foto, captura o PDF)") + "</div>"; };
  function shipBlock(I, shop) {
    var sh = I.shipment, g = dispatch(), link = trackLink(g, sh.tracking);
    return '<div class="oc-ship"><span class="oc-kicker">' + (I.status === "entregado" ? "Entregado" : "En camino a Chile") + "</span>" +
      '<div class="oc-track-n"><span>' + esc(sh.courier || g.courier) + " · N° de seguimiento</span><b>" + esc(sh.tracking) + "</b></div>" +
      '<dl class="oc-ship-dl"><dt>Enviado</dt><dd>' + esc(dmy(sh.date)) + "</dd><dt>Llegada estimada</dt><dd>" + esc(etaRange(sh.date).text) + "</dd>" +
        (I.delivered_at ? "<dt>Entregado</dt><dd>" + esc(dmy(I.delivered_at)) + "</dd>" : "") + (shop && sh.kg ? "<dt>Peso real</dt><dd>" + esc(fmtKg(sh.kg)) + " kg</dd>" : "") + (sh.note ? "<dt>Nota</dt><dd>" + esc(sh.note) + "</dd>" : "") + "</dl>" +
      (link ? '<a class="btn ghost block" target="_blank" rel="noopener" href="' + esc(link) + '">Seguir el envío en ' + esc((sh.courier || g.courier)) + "</a>" : "") +
      (shop ? sendBtn(I, "despacho") : "") +
      '<button class="btn ghost block" data-oc-shippdf="' + esc(I.code) + '">' + (shop ? "Descargar PDF del comprobante de despacho" : "Descargar comprobante de despacho (PDF)") + "</button>" +
      (shop && sh.label ? '<button class="btn ghost block" data-oc-label="' + esc(I.code) + '">Ver foto de la guía</button>' : "") +
      (shop && inTransit(I) ? '<button class="btn gold block" data-oc-deliver="' + esc(I.code) + '">Marcar entregado</button>' : "") + "</div>";
  }
  function actionsHTML(I, shop) {
    var h = "";
    if (shop && isApprovable(I)) {
      h += receiptLine(I, true);
      if (!I.receipt) h += '<p class="oc-hint">Si la transferencia te llegó por WhatsApp o directo, súbela aquí: queda respaldada en la app.</p>' + uploaderHTML(I.code);
      h += '<button class="btn gold block oc-approve" data-approve="' + esc(I.code) + '"' + (I.receipt ? "" : " disabled") + ">" + (I.receipt ? "Aprobar pago y generar orden de compra" : "Sube el comprobante para aprobar") + "</button>";
    }
    if (I.oc) {
      h += '<div class="oc-doc"><span class="oc-kicker">Orden de compra</span><b class="oc-docnum">' + esc(I.oc) + "</b>" +
        '<span class="oc-verif">' + esc(verified(I)) + (I.paid_at ? " · aprobado el " + esc(dmy(I.paid_at)) : "") + "</span>" +
        (shop && I.receipt_by ? '<span class="oc-verif">Comprobante subido por ' + esc(uploaderBy(I.receipt_by)) + "</span>" : "") +
        (shop ? allStatusHTML(I) : "") +
        (shop ? sendBtn(I, "oc") : "") +
        '<button class="btn ghost block" data-oc-pdf="' + esc(I.code) + '">' + (shop ? "Descargar PDF de la orden de compra" : "Descargar orden de compra (PDF)") + "</button>" +
        (I.receipt ? '<button class="btn ghost block" data-oc-rcpt="' + esc(I.code) + '">Ver comprobante de transferencia</button>' : "") +
        (shop && canShip(I) ? '<button class="btn gold block" data-oc-ship="' + esc(I.code) + '">Registrar envío</button>' : "") +
        (!shop ? (I.shipment ? '<details class="oc-desglose"><summary>Pasos a seguir</summary>' + stepsHTML() + "</details>" : '<h4 class="oc-h4">Pasos a seguir</h4>' + stepsHTML()) : "") + "</div>";
      if (I.shipment) h += shipBlock(I, shop);
    }
    return h;
  }
  // Tarjeta del pedido (Pedidos de Cheryl y "Mis pedidos" de la clienta)
  function cardHTML(g, shop) {
    if (!g.code) return "";
    var I = info(g); cache[g.code] = I;
    var h = '<div class="oc-block" data-oc-code="' + esc(g.code) + '">' +
      '<div class="oc-head">' + statusPill(I.status) + (I.oc ? '<span class="oc-num">' + esc(I.oc) + "</span>" : "") + "</div>" +
      (I.status !== "cancelado" ? tracker(I.status) : "") +
      '<div class="oc-amount"><span>' + (I.oc ? "Total pagado" : "Monto a transferir") + "</span><b>" + clp(I.oc ? I.paid_clp || I.amount : I.amount) + "</b></div>" +
      '<details class="oc-desglose"><summary>Ver desglose del pedido</summary>' + snapHTML(I.snap) + "</details>" + actionsHTML(I, shop);
    if (!shop && !I.oc && I.status === "pendiente_pago" && !I.receipt && A().contactCherylLink && A().contactCherylLink())
      h += '<a class="btn ghost block oc-wa-alt" target="_blank" rel="noopener" href="' + esc(A().contactCherylLink(proofText(I.code, I.amount))) + '">o envíale el comprobante a ' + esc(cheryl()) + " por WhatsApp</a>";
    else if (!shop && !I.oc && I.status === "comprobante_recibido")
      h += '<p class="oc-hint">' + esc(cheryl()) + " está revisando tu transferencia. Cuando la apruebe te llega tu orden de compra.</p>";
    return h + "</div>";
  }
  // Ficha de la clienta: el mismo componente dentro de cada pedido del historial
  function fichaHTML(g) {
    if (!g.code) return "";
    var I = info(g); cache[g.code] = I;
    if (!isApprovable(I) && !I.oc) return "";
    return '<div class="oc-block oc-mini" data-oc-code="' + esc(g.code) + '"><div class="oc-head">' + statusPill(I.status) + (I.oc ? '<span class="oc-num">' + esc(I.oc) + "</span>" : "") + "</div>" +
      (I.oc ? "" : '<div class="oc-amount"><span>Monto a transferir</span><b>' + clp(I.amount) + "</b></div>") + actionsHTML(I, true) + "</div>";
  }
  var proofText = function (code, amount) { return "Hola " + cheryl() + ", te envío el comprobante de la transferencia de mi pedido N° " + code + " por " + clp(amount) + "."; };

  // ---------------------------------------------------------------------------
  // "Enviar orden de compra" / "Enviar comprobante de despacho": WhatsApp al número registrado de la
  // clienta con un LINK DE DESCARGA del PDF (no el archivo).
  //  · Supabase: el PDF se sube a Storage (bucket público "photos", docs/{pedido}-{token}.pdf, token de 24
  //    caracteres no adivinable) y se guarda la URL en la orden (oc_pdf_url / dispatch_pdf_url). Si hay
  //    APP_URL se agrega además el link a la app (#oc-{pedido}-{token}).
  //  · Demo (localStorage, sin servidor): no hay dónde hospedar el archivo; el link es a la app
  //    (#oc-{pedido}-{token} / #od-…) y esa vista genera el PDF en el navegador. Solo funciona en el
  //    mismo teléfono y navegador donde están los datos de la demo.
  // ---------------------------------------------------------------------------
  var DOC = { oc: { hash: "oc", tok: "oc_doc_token", url: "oc_pdf_url", name: "orden de compra" }, despacho: { hash: "od", tok: "dispatch_doc_token", url: "dispatch_pdf_url", name: "comprobante de despacho" } };
  function docToken() { var a = new Uint8Array(24), c = "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return Array.from(a, function (v) { return c[v % c.length]; }).join(""); }
  var appBase = function () { return ((window.APP_CONFIG || {}).APP_URL || location.href.split("#")[0]).replace(/#.*$/, ""); };
  var docAppLink = function (I, kind) { var t = I[DOC[kind].tok]; return t ? appBase() + "#" + DOC[kind].hash + "-" + I.code + "-" + t : ""; };
  async function docLink(I, kind) {
    var api = S().api, D = DOC[kind];
    if (!I[D.tok]) { I[D.tok] = docToken(); }
    if (api.demo || !api.uploadDoc) { await api.setDocUrl(I.code, kind, "", I[D.tok]); return { url: docAppLink(I, kind), app: "" }; }
    if (!I[D.url]) {
      var blob = await buildPDF(kind, I);
      I[D.url] = await api.uploadDoc(blob, "docs/" + I.code + "-" + I[D.tok] + ".pdf");
      await api.setDocUrl(I.code, kind, I[D.url], I[D.tok]);
    }
    return { url: I[D.url], app: (window.APP_CONFIG || {}).APP_URL ? docAppLink(I, kind) : "" };
  }
  function docText(I, kind, L) {
    var first = String(I.name || "").split(" ")[0], g = dispatch();
    if (kind === "oc") return "Hola" + (first ? " " + first : "") + ", tu orden de compra " + I.oc + " (pedido " + I.code + ") está aprobada. Total pagado: *" + clp(I.paid_clp || I.amount) + "*.\n\n" +
      "Descárgala aquí: " + L.url + (L.app ? "\nVerla en la app: " + L.app : "") + "\n\nAhí está el detalle de tu compra, los pasos a seguir y la guía de envío a Chile. ¡Gracias!\n" + cheryl() + " · " + appName();
    var sh = I.shipment || {}, track = trackLink(g, sh.tracking);
    return "Hola" + (first ? " " + first : "") + ", tu pedido " + I.code + (I.oc ? " (" + I.oc + ")" : "") + " va en camino a Chile.\n" +
      "Courier: " + (sh.courier || g.courier) + " · N° de seguimiento: *" + sh.tracking + "*" + (track ? "\nSigue tu envío: " + track : "") + "\nLlegada estimada " + etaRange(sh.date).text + ".\n\n" +
      "Comprobante de despacho: " + L.url + (L.app ? "\nVerlo en la app: " + L.app : "") + "\n\n" + entregaText(g) + "\n" + cheryl() + " · " + appName();
  }
  function sendBtn(I, kind, id) {
    var lab = kind === "oc" ? "Enviar orden de compra" : "Enviar comprobante de despacho";
    return I.phone ? '<button class="btn wa block oc-send"' + (id ? ' id="' + id + '"' : "") + ' data-oc-send="' + esc(I.code) + '" data-kind="' + kind + '">' + lab + '</button><p class="oc-hint oc-send-to">Por WhatsApp al ' + esc(I.phone) + ", con el link para descargar el PDF.</p>"
      : '<p class="oc-hint">La clienta no tiene teléfono registrado: descarga el PDF y compártelo.</p>';
  }
  async function sendDoc(I, kind, btn) {
    var M = A(); if (!I.phone) { M.toast("La clienta no tiene teléfono registrado"); return; }
    var w = null; try { w = window.open("", "_blank"); } catch (e) {}   // se abre ya (gesto de la usuaria) para que no lo bloquee el navegador
    var lab = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "Preparando link…"; }
    try {
      var L = await docLink(I, kind), href = M.waTo(I.phone, docText(I, kind, L));
      if (w && !w.closed) { try { w.opener = null; } catch (e) {} w.location.href = href; } else window.open(href, "_blank", "noopener");
      M.toast((kind === "oc" ? "Orden de compra" : "Comprobante de despacho") + " enviado a " + (String(I.name || "la clienta").split(" ")[0]));
    } catch (e) { try { if (w) w.close(); } catch (x) {} M.toast("No se pudo preparar el link: " + (e.message || e)); }
    finally { if (btn) { btn.disabled = false; btn.textContent = lab; } }
  }
  // Estado de TODO el pedido (todas sus filas) una vez emitida la OC
  function allStatusHTML(I) {
    var opts = ["pagado", "comprado", "en_bodega"].concat(I.shipment ? ["enviado", "entregado"] : []);
    if (opts.indexOf(I.status) < 0) opts.push(I.status);
    return '<label class="f" for="oc-allst-' + esc(I.code) + '">Estado de todo el pedido</label><select class="in oc-allst" id="oc-allst-' + esc(I.code) + '" data-oc-allst="' + esc(I.code) + '">' +
      opts.map(function (v) { return '<option value="' + v + '"' + (v === I.status ? " selected" : "") + ">" + esc(STATUS[v] || v) + "</option>"; }).join("") + "</select>" +
      (I.shipment ? "" : '<p class="oc-hint" style="margin-top:4px">"Enviado" se marca con "Registrar envío".</p>');
  }
  // Vista del link #oc-{pedido}-{token} / #od-…: muestra el documento y lo descarga (PDF generado en el navegador)
  function parseDoc(h) { var m = /^#?(oc|od)-(MS-[A-Z0-9]{6})-([A-Za-z0-9]{16,})$/.exec(h || ""); return m ? { kind: m[1] === "oc" ? "oc" : "despacho", code: m[2], token: m[3] } : null; }
  async function openDoc(dd) {
    var M = A(), st = S(), rows = [];
    try { rows = ((await st.api.listOrders()) || []).filter(function (o) { return o.order_code === dd.code; }); } catch (e) {}
    var I = rows.length ? info({ code: dd.code, rows: rows }) : null, D = DOC[dd.kind];
    if (!I || I[D.tok] !== dd.token || (dd.kind === "oc" && !I.oc) || (dd.kind === "despacho" && !I.shipment)) {
      M.sheet('<h2 class="oc-q">Documento no disponible</h2><p class="oc-p">' + (st.api && st.api.demo ? "En la demo este link solo funciona en el mismo teléfono y navegador donde se hizo el pedido." : "Entra con tu cuenta para ver tus pedidos, o pídele a " + esc(cheryl()) + " que te reenvíe el link.") + '</p><button class="btn ghost block" data-close>Cerrar</button>');
      return;
    }
    cache[I.code] = I;
    var sh = I.shipment || {};
    M.sheet('<div class="oc-docview"><span class="oc-kicker">' + (dd.kind === "oc" ? "Orden de compra" : "Comprobante de despacho") + "</span>" +
      '<h2 class="oc-q">' + esc(dd.kind === "oc" ? I.oc : sh.tracking) + "</h2>" + statusPill(I.status) +
      '<dl class="oc-ship-dl" style="margin-top:12px"><dt>Pedido</dt><dd>' + esc(I.code) + "</dd><dt>Clienta</dt><dd>" + esc(I.name) + "</dd>" +
      (dd.kind === "oc" ? "<dt>Total pagado</dt><dd>" + clp(I.paid_clp || I.amount) + "</dd><dt>Pagado el</dt><dd>" + esc(dmy(I.paid_at)) + "</dd>" : "<dt>Courier</dt><dd>" + esc(sh.courier) + "</dd><dt>Enviado</dt><dd>" + esc(dmy(sh.date)) + "</dd><dt>Llegada estimada</dt><dd>" + esc(etaRange(sh.date).text) + "</dd>") + "</dl>" +
      '<button class="btn gold block" id="oc-doc-dl" style="margin-top:14px">Descargar PDF</button>' +
      (I[D.url] ? '<a class="btn ghost block" style="margin-top:8px" target="_blank" rel="noopener" href="' + esc(I[D.url]) + '">Abrir PDF guardado</a>' : "") +
      (st.api.demo ? '<p class="oc-hint">Demo: el PDF se genera en este navegador con los datos guardados aquí.</p>' : "") +
      '<button class="btn ghost block" data-close style="margin-top:8px">Cerrar</button></div>', function (el) {
      el.querySelector("#oc-doc-dl").onclick = function () { sharePDF(I, dd.kind); };
    });
  }
  (function watchDocLinks() {
    var first = parseDoc(location.hash);   // se lee antes de que app.js reescriba el hash al arrancar
    var go = function (dd) { var t0 = Date.now(), iv = setInterval(function () { var st = S(); if ((st.booted && st.api && st.me) || Date.now() - t0 > 20000) { clearInterval(iv); if (st.api && st.me) openDoc(dd); } }, 250); };
    if (first) go(first);
    window.addEventListener("hashchange", function () { var dd = parseDoc(location.hash); if (dd) go(dd); });
  })();

  // ---------------------------------------------------------------------------
  // Tablero de pagos y envíos (Pedidos de Cheryl y ficha de la clienta)
  // ---------------------------------------------------------------------------
  var dash = { tab: "pend", q: "", month: "" };
  var DAY = 86400000;
  var monthKey = function (iso) { return String(iso || "").slice(0, 7); };
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var monthName = function (k) { var p = k.split("-"); return MONTHS[+p[1] - 1] + " " + p[0]; };
  var fold = function (t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  var NEXT = { pagado: "Comprado", comprado: "En bodega Miami", en_bodega: "Enviado a Chile", enviado: "Entregado" };
  var daysSince = function (iso) { return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso)) / DAY)) : 0; };
  function classify(groups) {
    var out = { pend: [], review: [], toship: [], ship: [], paid: [] };
    groups.forEach(function (g) {
      if (!g.code) return;
      var I = info(g); cache[g.code] = I;
      if (I.status === "cancelado") return;
      if (I.oc) { out.paid.push(I); if (canShip(I)) out.toship.push(I); if (inTransit(I)) out.ship.push(I); }
      else if (isApprovable(I)) (I.receipt ? out.review : out.pend).push(I);
    });
    var created = function (I) { return (I.rows[0] || {}).created_at || ""; };
    out.pend.sort(function (a, b) { return created(a).localeCompare(created(b)); });          // más antiguo primero
    out.review.sort(function (a, b) { return String(a.receipt_at || "").localeCompare(String(b.receipt_at || "")); });
    out.toship.sort(function (a, b) { return String(a.paid_at || "").localeCompare(String(b.paid_at || "")); });
    out.ship.sort(function (a, b) { return String(a.shipment.date || "").localeCompare(String(b.shipment.date || "")); });
    out.paid.sort(function (a, b) { return String(b.paid_at || "").localeCompare(String(a.paid_at || "")); });
    return out;
  }
  function bankText() { return bankRowsS().map(function (r) { return r[0] + ": " + r[1]; }).join("\n"); }
  function reminderText(I) {
    var first = String(I.name || "").split(" ")[0], created = (I.rows[0] || {}).created_at;
    return "Hola" + (first ? " " + first : "") + ", soy " + cheryl() + " de " + appName() + ". Te escribo por tu pedido N° " + I.code + (created ? " del " + dmy(created) : "") + ": sigue pendiente la transferencia de *" + clp(I.amount) + "*.\n\n" +
      "*Datos para transferir*\n" + bankText() + "\n\nCuando transfieras, sube el comprobante en la app (Mis pedidos) o mándamelo por aquí. Apenas lo confirme, compro tus productos. ¡Gracias!";
  }
  var sumOf = function (list) { return list.reduce(function (t, I) { return t + (I.oc ? I.paid_clp || I.amount : I.amount); }, 0); };
  function dashItem(I, kind, compact) {
    var created = (I.rows[0] || {}).created_at, days = daysSince(created), sh = I.shipment || {};
    var head = '<div class="oc-di-h"><b class="oc-di-name">' + esc(I.name || "Clienta") + '</b><span class="oc-di-amt">' + clp(I.oc ? I.paid_clp || I.amount : I.amount) + "</span></div>";
    var meta = "", acts = "";
    if (kind === "pend") {
      meta = "Pedido " + esc(I.code) + " · " + esc(dmy(created)) + ' · <b class="oc-days' + (days >= 3 ? " late" : "") + '">' + (days === 0 ? "hoy" : days === 1 ? "1 día esperando" : days + " días esperando") + "</b>";
      var wa = I.phone ? A().waTo(I.phone, reminderText(I)) : "";
      acts = (wa ? '<a class="btn wa sm" target="_blank" rel="noopener" data-oc-remind="' + esc(I.code) + '" href="' + esc(wa) + '">Recordar por WhatsApp</a>' : "") + uploaderHTML(I.code);
    } else if (kind === "review") {
      meta = "Pedido " + esc(I.code) + " · comprobante " + (I.receipt_at ? "del " + esc(dmy(I.receipt_at)) : "") + (I.receipt_by ? " · subido por " + esc(uploaderBy(I.receipt_by)) : "");
      acts = '<button class="btn gold sm oc-approve" data-approve="' + esc(I.code) + '">Aprobar</button><button class="btn ghost sm" data-oc-rcpt="' + esc(I.code) + '">Ver comprobante</button>';
    } else if (kind === "toship") {
      meta = esc(I.oc) + " · pedido " + esc(I.code) + " · pagado el " + esc(dmy(I.paid_at)) + ' · <b class="oc-days' + (daysSince(I.paid_at) >= 5 ? " late" : "") + '">' + daysSince(I.paid_at) + (daysSince(I.paid_at) === 1 ? " día" : " días") + " desde el pago</b>";
      acts = '<span class="oc-next-st">' + statusPill(I.status) + "</span>" + '<button class="btn gold sm" data-oc-ship="' + esc(I.code) + '">Registrar envío</button><button class="btn ghost sm" data-oc-pdf="' + esc(I.code) + '">OC en PDF</button>';
    } else if (kind === "ship") {
      var link = trackLink(dispatch(), sh.tracking), eta = etaRange(sh.date);
      meta = "Pedido " + esc(I.code) + " · " + esc(sh.courier || "") + ' · N° <b class="oc-trk">' + esc(sh.tracking) + "</b><br>Enviado el " + esc(dmy(sh.date)) + ' · <b class="oc-days' + (Date.now() > new Date(eta.to) ? " late" : "") + '">' + daysSince(sh.date) + (daysSince(sh.date) === 1 ? " día" : " días") + " en tránsito</b> · llega " + esc(eta.text);
      acts = '<button class="btn gold sm" data-oc-deliver="' + esc(I.code) + '">Marcar entregado</button>' + (link ? '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(link) + '">Seguimiento</a>' : "") + '<button class="btn ghost sm" data-oc-shippdf="' + esc(I.code) + '">Despacho PDF</button>';
    } else {
      meta = esc(I.oc) + " · pedido " + esc(I.code) + " · pagado el " + esc(dmy(I.paid_at)) + (I.shipment ? " · " + esc(sh.courier || "") + " " + esc(sh.tracking) : "");
      acts = '<span class="oc-next-st">' + statusPill(I.status) + (NEXT[I.status] ? '<span class="small">Siguiente: ' + esc(NEXT[I.status]) + "</span>" : "") + "</span>" +
        (I.receipt ? '<button class="btn ghost sm" data-oc-rcpt="' + esc(I.code) + '">Ver comprobante</button>' : "") + '<button class="btn ghost sm" data-oc-pdf="' + esc(I.code) + '">OC en PDF</button>';
    }
    return '<article class="oc-di oc-di-' + kind + '" data-oc-item="' + esc(I.code) + '">' + (kind === "review" ? '<span class="oc-thumb big" data-oc-thumb="' + esc(I.code) + '" aria-hidden="true"></span>' : "") +
      '<div class="oc-di-b">' + head + '<div class="oc-di-m">' + meta + "</div>" + '<div class="oc-di-a">' + acts + (compact ? "" : '<button class="btn ghost sm" data-oc-goto="' + esc(I.code) + '">Ver pedido</button>') + "</div></div></article>";
  }
  var TABS = [["pend", "Pendientes de transferencia"], ["review", "Por aprobar"], ["toship", "Pagados por enviar"], ["ship", "Enviados"], ["paid", "Transferencias realizadas"]];
  // root: contenedor; groups: [{code, rows}]; opts.compact = ficha de la clienta
  function dashboard(root, groups, reload, opts) {
    if (!root) return;
    opts = opts || {};
    var C = classify(groups), ym = monthKey(new Date().toISOString());
    var paidMonth = C.paid.filter(function (I) { return monthKey(I.paid_at) === ym; });
    var first = C.pend.length ? "pend" : C.review.length ? "review" : C.toship.length ? "toship" : C.ship.length ? "ship" : "paid";
    var st = opts.compact ? (root._ocdash = root._ocdash || { tab: first, q: "", month: "" }) : dash;
    var monthsOf = function (list, key) { var m = []; list.forEach(function (I) { var k = monthKey(key(I)); if (k && m.indexOf(k) < 0) m.push(k); }); return m.sort().reverse(); };
    var mKey = function (I) { return st.tab === "ship" ? (I.shipment || {}).date : I.paid_at; };
    var card = function (k, label, list, n) { return '<button type="button" class="oc-kpi oc-kpi-' + k + '" data-oc-tab="' + k + '" aria-pressed="' + (st.tab === k) + '"><span>' + label + "</span><b>" + (n == null ? list.length : n) + "</b><small>" + clp(sumOf(list)) + "</small></button>"; };
    var summary = [C.pend.length ? C.pend.length + (C.pend.length === 1 ? " pedido esperando transferencia" : " pedidos esperando transferencia") : "", C.review.length ? C.review.length + " por aprobar" : "", C.toship.length ? C.toship.length + " por enviar" : "", C.ship.length ? C.ship.length + " en camino" : ""].filter(Boolean).join(" · ") || "Sin pagos ni envíos pendientes";
    root.innerHTML = '<section class="oc-dash' + (opts.compact ? " compact" : "") + '" aria-label="Seguimiento de pagos y envíos">' +
      (opts.compact ? '<p class="oc-dash-sum" id="oc-dash-sum">' + esc(summary) + "</p>" : '<div class="oc-dash-h"><h2 class="section-title">Pagos y envíos</h2><span class="small" id="oc-dash-sum">' + esc(summary) + "</span></div>") +
      '<div class="oc-kpis">' + card("pend", "Pendientes de transferencia", C.pend) + card("review", "Comprobante recibido, por aprobar", C.review) +
        card("paid", opts.compact ? "Pagados / OC emitida" : "Pagados / OC emitida este mes", opts.compact ? C.paid : paidMonth) + card("toship", "Pagados por enviar", C.toship) + card("ship", "En camino", C.ship) + "</div>" +
      '<div class="oc-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" data-oc-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + " <span>" + C[t[0]].length + "</span></button>"; }).join("") + "</div>" +
      '<div class="oc-dash-tools"' + (st.tab === "paid" || st.tab === "ship" ? "" : " hidden") + '><input class="in" type="search" id="oc-q" placeholder="Buscar por clienta, N° de pedido, OC o seguimiento" value="' + esc(st.q) + '" aria-label="Buscar">' +
        '<select class="in" id="oc-month" aria-label="Filtrar por mes"></select></div>' +
      '<div class="oc-dlist" id="oc-dlist"></div></section>';
    var list = root.querySelector("#oc-dlist"), sel = root.querySelector("#oc-month");
    var fillMonths = function () {
      var ms = monthsOf(C[st.tab] || [], mKey); if (st.month && ms.indexOf(st.month) < 0) st.month = "";
      sel.innerHTML = '<option value="">Todos los meses</option>' + ms.map(function (k) { return '<option value="' + k + '"' + (k === st.month ? " selected" : "") + ">" + esc(monthName(k)) + "</option>"; }).join("");
    };
    var showTab = function () {   // la pestaña activa siempre a la vista en el carrusel de pestañas (teléfono)
      var bar = root.querySelector(".oc-tabs"), on = bar && bar.querySelector('[aria-selected="true"]');
      if (on) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    };
    var paint = function () {
      showTab();
      var arr = C[st.tab];
      if (st.tab === "paid" || st.tab === "ship") {
        var q = fold(st.q.trim());
        arr = arr.filter(function (I) { return (!st.month || monthKey(mKey(I)) === st.month) && (!q || fold([I.name, I.code, I.oc, (I.snap.customer || {}).code, (I.shipment || {}).tracking].join(" ")).indexOf(q) >= 0); });
      }
      var empty = { pend: "No hay pedidos esperando transferencia.", review: "No hay comprobantes por aprobar.", toship: "No hay pedidos pagados esperando envío.", ship: st.q || st.month ? "No hay envíos con ese filtro." : "No hay envíos en camino.", paid: st.q || st.month ? "No hay transferencias con ese filtro." : "Todavía no hay transferencias aprobadas." }[st.tab];
      list.innerHTML = arr.length ? arr.map(function (I) { return dashItem(I, st.tab, opts.compact); }).join("") : '<div class="oc-empty">' + esc(empty) + "</div>";
      wire(list, reload);
      list.querySelectorAll("[data-oc-goto]").forEach(function (b) {
        b.onclick = function () {
          var el = document.querySelector('.order-g[data-ocode="' + (window.CSS && CSS.escape ? CSS.escape(b.dataset.ocGoto) : b.dataset.ocGoto) + '"]');
          if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("oc-flash"); setTimeout(function () { el.classList.remove("oc-flash"); }, 1600); }
        };
      });
    };
    root.querySelectorAll("[data-oc-tab]").forEach(function (b) {
      b.onclick = function () {
        st.tab = b.dataset.ocTab;
        root.querySelectorAll("[data-oc-tab]").forEach(function (x) { x.setAttribute(x.getAttribute("role") === "tab" ? "aria-selected" : "aria-pressed", String(x.dataset.ocTab === st.tab)); });
        root.querySelector(".oc-dash-tools").hidden = !(st.tab === "paid" || st.tab === "ship"); fillMonths(); paint();
      };
    });
    root.querySelector("#oc-q").oninput = function (e) { st.q = e.target.value; paint(); };
    sel.onchange = function (e) { st.month = e.target.value; paint(); };
    fillMonths(); paint();
  }

  // ---------------------------------------------------------------------------
  // Hojas: aprobar, OC emitida, registrar envío, marcar entregado, comprobante
  // ---------------------------------------------------------------------------
  function confirmApprove(I, reload) {
    var M = A();
    M.sheet('<h2 class="oc-q">¿El comprobante es por ' + clp(I.amount) + "?</h2>" +
      '<p class="oc-p">Pedido <b>' + esc(I.code) + "</b> de " + esc(I.name || "la clienta") + ". Revisa que el monto del comprobante sea " + clp(I.amount) + " antes de aprobar.</p>" +
      receiptLine(I, false) +
      '<button class="btn ghost block" id="oc-see-rcpt">Ver comprobante</button>' +
      '<button class="btn gold block" id="oc-yes" style="margin-top:10px">Sí, es por ' + clp(I.amount) + ": aprobar y generar orden de compra</button>" +
      '<button class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>', function (el, close) {
      wire(el, reload);
      el.querySelector("#oc-see-rcpt").onclick = async function () { try { var url = await S().api.receiptUrl(I.receipt), full = M.openableUrl ? await M.openableUrl(url) : url; window.open(full, "_blank", "noopener"); } catch (e) { M.toast("No se pudo abrir el comprobante"); } };
      var yes = el.querySelector("#oc-yes");
      yes.onclick = async function () {
        yes.disabled = true; yes.textContent = "Generando orden de compra…";
        try {
          var r = await S().api.approveOrder(I.code, I.amount);
          close(); M.toast("Orden de compra " + r.oc_number + " emitida");
          await reload();
          var J = cache[I.code]; if (J && J.oc) issuedSheet(J);
        } catch (e) { yes.disabled = false; yes.textContent = "Sí, es por " + clp(I.amount) + ": aprobar y generar orden de compra"; M.toast(e.message || "No se pudo aprobar"); }
      };
    });
  }
  function issuedSheet(I) {
    var M = A();
    M.sheet('<span class="oc-kicker">Orden de compra emitida</span><h2 class="oc-q">' + esc(I.oc) + "</h2>" +
      '<p class="oc-p">Pedido ' + esc(I.code) + " · " + esc(I.name) + " · pagado " + clp(I.paid_clp || I.amount) + "<br>" + esc(verified(I)) + ".</p>" +
      '<p class="oc-p">Le llega a la clienta por WhatsApp, a su número registrado, con el link para descargar la orden de compra (detalle, pasos y guía de envío).</p>' +
      sendBtn(I, "oc", "oc-sheet-send") +
      '<button class="btn ghost block" id="oc-sheet-pdf" style="margin-top:8px">Descargar PDF</button>' +
      '<button class="btn ghost block" data-close style="margin-top:8px">Listo</button>', function (el) {
      wire(el, null);
      el.querySelector("#oc-sheet-pdf").onclick = function () { sharePDF(I, "oc"); };
    });
  }
  var today = function () { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function shipSheet(I, reload) {
    var M = A(), g = dispatch(), label = null;
    M.sheet('<span class="oc-kicker">Registrar envío</span><h2 class="oc-q">Pedido ' + esc(I.code) + (I.oc ? " · " + esc(I.oc) : "") + "</h2>" +
      '<p class="oc-p">' + esc(I.name) + " · " + esc(addr((I.snap.customer || {})) || "") + "</p>" +
      '<form id="oc-shipf" class="oc-shipf" novalidate>' +
      '<label class="f" for="oc-s-courier">Compañía</label><input class="in" id="oc-s-courier" name="courier" value="' + esc(g.courier) + '" required>' +
      '<label class="f" for="oc-s-trk">Número de seguimiento / guía</label><input class="in" id="oc-s-trk" name="tracking" autocomplete="off" autocapitalize="characters" required placeholder="MEC-123456789">' +
      '<div class="two"><div><label class="f" for="oc-s-date">Fecha de envío</label><input class="in" type="date" id="oc-s-date" name="date" value="' + today() + '" required></div>' +
      '<div><label class="f" for="oc-s-kg">Peso real en kg (opcional)</label><input class="in" id="oc-s-kg" name="kg" inputmode="decimal" placeholder="2,4"></div></div>' +
      '<label class="f">Foto de la guía o etiqueta (opcional)</label><label class="btn ghost block up-receipt" id="oc-s-lab">Subir foto de la guía (foto o PDF)<input type="file" accept="image/*,application/pdf" hidden id="oc-s-file"></label><div class="small muted" id="oc-s-fst" aria-live="polite"></div>' +
      '<label class="f" for="oc-s-note">Nota (opcional)</label><textarea class="in" id="oc-s-note" name="note" rows="2" placeholder="Ej.: va en una caja junto al pedido de su hermana"></textarea>' +
      '<p class="small oc-err" id="oc-s-err" role="alert"></p>' +
      '<button class="btn gold block" id="oc-s-save">Guardar envío y generar comprobante de despacho</button></form>' +
      '<button class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>', function (el, close) {
      var f = el.querySelector("#oc-shipf"), err = el.querySelector("#oc-s-err"), fst = el.querySelector("#oc-s-fst"), lab = el.querySelector("#oc-s-lab");
      el.querySelector("#oc-s-file").onchange = async function (e) {
        var file = e.target.files[0]; if (!file) return;
        lab.firstChild.textContent = "Subiendo foto de la guía…"; lab.classList.add("busy");
        try { label = await S().api.uploadReceipt(file); fst.textContent = "Foto de la guía lista: " + (file.name || ""); lab.firstChild.textContent = "Cambiar foto de la guía"; }
        catch (x) { fst.textContent = x.message || "No se pudo subir la foto"; lab.firstChild.textContent = "Subir foto de la guía (foto o PDF)"; }
        finally { lab.classList.remove("busy"); }
      };
      f.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(f), courier = String(fd.get("courier") || "").trim(), tracking = String(fd.get("tracking") || "").trim().toUpperCase(), date = String(fd.get("date") || ""), kgS = String(fd.get("kg") || "").replace(",", ".").trim();
        if (!courier) { err.textContent = "Escribe la compañía de courier."; return; }
        if (tracking.length < 4) { err.textContent = "Escribe el número de seguimiento (al menos 4 caracteres)."; el.querySelector("#oc-s-trk").focus(); return; }
        if (!date) { err.textContent = "Elige la fecha de envío."; return; }
        var kg = kgS ? Number(kgS) : null; if (kgS && !(kg > 0 && kg < 500)) { err.textContent = "El peso debe ser un número en kg, por ejemplo 2,4."; return; }
        var btn = el.querySelector("#oc-s-save"); btn.disabled = true; btn.textContent = "Guardando…";
        try {
          await S().api.registerShipment(I.code, { courier: courier, tracking: tracking, date: date + "T12:00:00", kg: kg, label: label, note: String(fd.get("note") || "").trim() || null });
          close(); M.toast("Envío registrado: " + tracking);
          await reload();
          var J = cache[I.code]; if (J && J.shipment) shippedSheet(J);
        } catch (x) { btn.disabled = false; btn.textContent = "Guardar envío y generar comprobante de despacho"; err.textContent = x.message || "No se pudo guardar"; }
      };
    });
  }
  function shippedSheet(I) {
    var M = A();
    M.sheet('<span class="oc-kicker">Comprobante de despacho listo</span><h2 class="oc-q">' + esc(I.shipment.tracking) + "</h2>" +
      '<p class="oc-p">Pedido ' + esc(I.code) + " · " + esc(I.name) + " · " + esc(I.shipment.courier) + "<br>Enviado el " + esc(dmy(I.shipment.date)) + " · llegada estimada " + esc(etaRange(I.shipment.date).text) + ".</p>" +
      sendBtn(I, "despacho", "oc-ship-send") +
      '<button class="btn ghost block" id="oc-ship-pdf" style="margin-top:8px">Descargar PDF</button>' +
      '<button class="btn ghost block" data-close style="margin-top:8px">Listo</button>', function (el) {
      wire(el, null);
      el.querySelector("#oc-ship-pdf").onclick = function () { sharePDF(I, "despacho"); };
    });
  }
  function deliverSheet(I, reload) {
    var M = A();
    M.sheet('<h2 class="oc-q">¿' + esc(I.name || "La clienta") + " recibió su pedido?</h2>" +
      '<p class="oc-p">Pedido ' + esc(I.code) + " · " + esc((I.shipment || {}).courier || "") + " " + esc((I.shipment || {}).tracking || "") + ". Queda como <b>Entregado</b> con la fecha de hoy.</p>" +
      '<button class="btn gold block" id="oc-dl-yes">Sí, marcar entregado</button><button class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>', function (el, close) {
      var b = el.querySelector("#oc-dl-yes");
      b.onclick = async function () {
        b.disabled = true; b.textContent = "Guardando…";
        try { await S().api.markDelivered(I.code); close(); M.toast("Pedido " + I.code + " entregado"); await reload(); }
        catch (x) { b.disabled = false; b.textContent = "Sí, marcar entregado"; M.toast(x.message || "No se pudo guardar"); }
      };
    });
  }
  async function showFile(ref, title) {
    var M = A(), url = "", full = "";
    try { url = await S().api.receiptUrl(ref); full = M.openableUrl ? await M.openableUrl(url) : url; } catch (e) { return M.toast("No se pudo abrir el archivo"); }
    var pdf = M.isPdfRef ? M.isPdfRef(ref) : /pdf/i.test(ref);
    return { url: url, full: full, pdf: pdf, html: (pdf ? '<div class="rp-doc"><span class="rp-pdf" aria-hidden="true">PDF</span><span>' + esc(title) + ' en PDF</span></div>' : '<a href="' + esc(full) + '" target="_blank" rel="noopener" class="rp-full"><img src="' + esc(url) + '" alt="' + esc(title) + '" style="width:100%;border-radius:4px;display:block"></a>') +
      '<a class="btn ghost block" style="margin-top:12px" href="' + esc(full) + '" target="_blank" rel="noopener"' + (pdf ? ' download="' + esc(title.toLowerCase().replace(/\s+/g, "-")) + '.pdf"' : "") + ">" + (pdf ? "Abrir PDF" : "Ver en tamaño completo") + "</a>" };
  }
  async function showReceipt(I) {
    var f = await showFile(I.receipt, "Comprobante de transferencia"); if (!f) return;
    A().sheet("<h2>Comprobante · " + esc(I.code) + "</h2>" + receiptLine(I, false) + f.html + '<button class="btn ghost block" data-close style="margin-top:8px">Cerrar</button>');
  }
  async function showLabel(I) {
    var f = await showFile(I.shipment.label, "Guía del courier"); if (!f) return;
    A().sheet("<h2>Guía · " + esc(I.shipment.tracking) + "</h2>" + f.html + '<button class="btn ghost block" data-close style="margin-top:8px">Cerrar</button>');
  }
  // Conecta el componente dentro de root (Pedidos, tablero o ficha). reload = volver a dibujar con datos nuevos
  function wire(root, reload) {
    var M = A(), on = function (sel, key, fn) { root.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { var I = cache[b.dataset[key]]; if (I) fn(I, b); }; }); };
    on("[data-approve]", "approve", function (I) { if (!I.receipt) { M.toast("Sube el comprobante para aprobar"); return; } confirmApprove(I, reload); });
    on("[data-oc-pdf]", "ocPdf", function (I) { sharePDF(I, "oc"); });
    on("[data-oc-shippdf]", "ocShippdf", function (I) { sharePDF(I, "despacho"); });
    on("[data-oc-rcpt]", "ocRcpt", function (I) { if (I.receipt) showReceipt(I); });
    on("[data-oc-label]", "ocLabel", function (I) { if (I.shipment && I.shipment.label) showLabel(I); });
    on("[data-oc-ship]", "ocShip", function (I) { shipSheet(I, reload); });
    on("[data-oc-deliver]", "ocDeliver", function (I) { deliverSheet(I, reload); });
    on("[data-oc-send]", "ocSend", function (I, b) { sendDoc(I, b.dataset.kind || "oc", b); });
    root.querySelectorAll("select[data-oc-allst]").forEach(function (sel) {
      sel.onchange = async function () {
        var I = cache[sel.dataset.ocAllst]; if (!I) return;
        var to = sel.value, ids = I.rows.filter(function (o) { return o.status !== "cancelado"; }).map(function (o) { return o.id; });
        sel.disabled = true;
        try { for (var i = 0; i < ids.length; i++) await S().api.updateOrder(ids[i], { status: to }); M.toast("Pedido " + I.code + ": " + (STATUS[to] || to)); }
        catch (e) { M.toast(e.message || "No se pudo cambiar el estado"); }
        if (reload) await reload();
      };
    });
    root.querySelectorAll("[data-oc-up]").forEach(function (box) { M.receiptUploader(box.dataset.ocUp, function () { reload && reload(); }).wire(box); });
    root.querySelectorAll("[data-oc-thumb]").forEach(async function (t) {
      var I = cache[t.dataset.ocThumb]; if (!I || !I.receipt || t.firstChild) return;
      if (M.isPdfRef && M.isPdfRef(I.receipt)) { t.innerHTML = '<span class="rp-pdf">PDF</span>'; return; }
      try { var u = await S().api.receiptUrl(I.receipt); if (u) t.innerHTML = '<img src="' + esc(u) + '" alt="">'; } catch (e) {}
    });
  }

  // ---------------------------------------------------------------------------
  // Ajustes de Cheryl: "Guía de envío" (datos de ejemplo) + "Pasos del despacho"
  // ---------------------------------------------------------------------------
  function ajustes(view) {
    var d = dispatch(), M = A(), raw = (S().settings || {}).dispatch || {};
    var isSample = GUIDE_KEYS.every(function (k) { return !raw[k] || raw[k] === DEFAULT_DISPATCH[k]; });
    var inp = function (k, l, ph) { return '<label class="f" for="oc-g-' + k + '">' + l + '</label><input class="in" id="oc-g-' + k + '" name="' + k + '" value="' + esc(d[k]) + '" placeholder="' + esc(ph || "") + '">'; };
    var ta = function (k, l) { return '<label class="f" for="oc-g-' + k + '">' + l + '</label><textarea class="in" rows="2" id="oc-g-' + k + '" name="' + k + '">' + esc(d[k]) + "</textarea>"; };
    var box = document.createElement("div");
    box.className = "oc-settings";
    box.innerHTML = '<h2 class="section-title">Guía de envío</h2>' +
      '<form class="card oc-set" id="ocg">' +
      (isSample ? '<p class="oc-sample" role="note"><b>Datos de ejemplo.</b> El courier, la sucursal y los teléfonos de abajo son inventados para mostrar cómo se ve. Reemplázalos por los de tu courier real antes de enviar órdenes de compra.</p>' : "") +
      '<p class="small muted" style="margin-top:0">Va en la orden de compra, en el comprobante de despacho y en los mensajes de WhatsApp a la clienta.</p>' +
      inp("courier", "Compañía courier", "Miami Express Cargo") + '<div class="two">' + inp("courier_wa", "WhatsApp del courier") + inp("courier_phone", "Teléfono del courier") + "</div>" +
      inp("courier_email", "Correo del courier") + inp("track_url", "Página de seguimiento (puedes usar {n} para el número)", "miamiexpresscargo.cl/seguimiento") +
      inp("eta", "Plazo estimado", "7 a 12 días hábiles") +
      '<label class="f" for="oc-g-mode">Entrega en Chile</label><select class="in" id="oc-g-mode" name="mode">' + Object.keys(MODES).map(function (k) { return '<option value="' + k + '"' + (k === d.mode ? " selected" : "") + ">" + esc(MODES[k]) + "</option>"; }).join("") + "</select>" +
      inp("pickup", "Sucursal de retiro (nombre y dirección)") + inp("pickup_hours", "Horario de retiro") +
      ta("doc", "Qué documento presentar") + ta("customs", "Qué pasa con la aduana") +
      '<button class="btn block" style="margin-top:14px">Guardar guía de envío</button></form>' +
      '<h2 class="section-title">Pasos del despacho</h2>' +
      '<form class="card oc-set" id="ocf"><p class="small muted" style="margin-top:0">Van en la orden de compra (PDF y WhatsApp) y en "Mis pedidos" de la clienta. Puedes usar {cheryl}, {eta}, {courier}, {seguimiento}, {entrega}, {whatsapp} y {retiro}.</p>' +
      d.steps.map(function (s, i) { return '<label class="f" for="oc-step' + i + '">Paso ' + (i + 1) + '</label><textarea class="in" rows="2" id="oc-step' + i + '" name="step' + i + '">' + esc(s) + "</textarea>"; }).join("") +
      '<div class="oc-prev"><b>Así lo ve la clienta</b>' + stepsHTML() + "</div>" +
      '<button class="btn block" style="margin-top:14px">Guardar pasos del despacho</button>' +
      '<button type="button" class="btn ghost block" id="oc-reset" style="margin-top:8px">Volver a los textos sugeridos</button></form>';
    var anchor = view.querySelector("#logout");
    if (anchor) view.insertBefore(box, anchor); else view.appendChild(box);
    var saveD = async function (patch, msg) {
      var st = S(), next = Object.assign({}, raw, patch);
      var r = await st.api.saveSettings({ dispatch: next }); st.settings = Object.assign({}, st.settings, r || {}, { dispatch: next });
      M.toast(msg); box.remove(); ajustes(view);
    };
    box.querySelector("#ocg").onsubmit = function (e) {
      e.preventDefault(); var fd = new FormData(e.target), p = { mode: fd.get("mode") };
      GUIDE_KEYS.forEach(function (k) { p[k] = String(fd.get(k) || "").trim(); });
      saveD(p, "Guía de envío guardada");
    };
    box.querySelector("#ocf").onsubmit = function (e) {
      e.preventDefault(); var fd = new FormData(e.target);
      saveD({ steps: [0, 1, 2, 3, 4].map(function (i) { return String(fd.get("step" + i) || "").trim(); }) }, "Pasos del despacho guardados");
    };
    box.querySelector("#oc-reset").onclick = function () { saveD({ steps: DEFAULT_STEPS.slice() }, "Textos sugeridos restablecidos"); };
  }

  // ---------------------------------------------------------------------------
  // API: modo demo (localStorage) y Supabase
  // ---------------------------------------------------------------------------
  function extendLocal(api, db, save) {
    var now = function () { return new Date().toISOString(); };
    var name = function () { return (db.settings || {}).cashier_name || "Cheryl"; };
    var isShop = function () { var p = db.profiles.find(function (x) { return x.id === db.me; }); return p && p.role === "shopper"; };
    var notify = function (uid, message) { if (uid) db.notifications.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())), user_id: uid, message: message, read: false, created_at: now() }); };
    var live = function (code) { return db.orders.filter(function (o) { return o.order_code === code && o.status !== "cancelado"; }); };
    var attach = api.attachReceipt;
    api.attachReceipt = async function (code, path) {
      await attach.call(api, code, path);
      var by = isShop() ? "cheryl" : "clienta", at = now();
      db.orders.forEach(function (o) {
        if (o.order_code !== code || !(isShop() || o.client_id === db.me)) return;
        o.receipt_by = by; o.receipt_at = at;
        if (o.status === "pendiente_pago") o.status = "comprobante_recibido";
      });
      save();
    };
    api.approveOrder = async function (code, amount) {
      if (!isShop()) throw new Error("Solo " + name() + " puede aprobar pagos");
      var rows = live(code);
      if (!rows.length) throw new Error("No existe el pedido " + code);
      var had = rows.find(function (o) { return o.oc_number; });
      if (had) return { oc_number: had.oc_number, paid_at: had.paid_at };
      if (!rows.some(function (o) { return o.receipt_path; })) throw new Error("Sube el comprobante de transferencia para aprobar");
      db.oc_seq = (Number(db.oc_seq) || 0) + 1;
      var oc = "OC-" + String(db.oc_seq).padStart(5, "0"), at = now();
      var tok = docToken();
      rows.forEach(function (o) { o.oc_number = oc; o.paid_at = at; o.paid_clp = amount; o.oc_doc_token = tok; if (["pendiente_pago", "comprobante_recibido", "pagado"].indexOf(o.status) >= 0) o.status = "pagado"; });
      notify(rows[0].client_id, name() + " aprobó tu pago. Tu orden de compra " + oc + " está en Mis pedidos");
      save();
      return { oc_number: oc, paid_at: at };
    };
    api.registerShipment = async function (code, data) {
      if (!isShop()) throw new Error("Solo " + name() + " puede registrar envíos");
      var rows = live(code);
      if (!rows.length || !rows[0].oc_number) throw new Error("El pedido necesita su orden de compra antes de enviarse");
      var sh = Object.assign({}, data, { at: now(), by: "cheryl" }), tok = docToken();
      rows.forEach(function (o) { o.shipment = sh; o.status = "enviado"; o.dispatch_doc_token = o.dispatch_doc_token || tok; });
      notify(rows[0].client_id, "Tu pedido " + code + " va en camino a Chile. Seguimiento: " + data.courier + " " + data.tracking);
      save(); return sh;
    };
    // demo: no hay servidor donde hospedar el PDF; el link es a la app (#oc-… / #od-…) y genera el PDF en el navegador
    api.setDocUrl = async function (code, kind, url, token) {
      var k = kind === "oc" ? "oc_doc_token" : "dispatch_doc_token";
      live(code).forEach(function (o) { if (!o[k]) o[k] = token; }); save();
    };
    api.markDelivered = async function (code) {
      if (!isShop()) throw new Error("Solo " + name() + " puede marcar entregas");
      var rows = live(code); if (!rows.length || !rows[0].shipment) throw new Error("Primero registra el envío");
      var at = now(); rows.forEach(function (o) { o.status = "entregado"; o.delivered_at = at; });
      notify(rows[0].client_id, "Tu pedido " + code + " figura como entregado. ¡Gracias por comprar con " + name() + "!");
      save(); return at;
    };
    return api;
  }
  function extendSupabase(api, sb) {
    var rpc = async function (fn, args, msg) {
      var r = await sb.rpc(fn, args);
      if (r.error) throw new Error(msg && msg.test(r.error.message) ? msg.text : r.error.message);
      return Array.isArray(r.data) ? r.data[0] : r.data;
    };
    api.approveOrder = async function (code, amount) { return (await rpc("approve_order", { p_code: code, p_amount: Math.round(amount) }, { test: function (m) { return /comprobante/i.test(m); }, text: "Sube el comprobante de transferencia para aprobar" })) || {}; };
    api.registerShipment = async function (code, data) { return rpc("register_shipment", { p_code: code, p_data: data }); };
    api.markDelivered = async function (code) { return rpc("mark_delivered", { p_code: code }); };
    // PDF de la OC / del despacho en Storage (bucket público "photos", carpeta docs/, ruta con token no adivinable)
    api.uploadDoc = async function (blob, path) {
      var r = await sb.storage.from("photos").upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (r.error) throw new Error(r.error.message);
      return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    };
    api.setDocUrl = async function (code, kind, url, token) { return rpc("set_doc_url", { p_code: code, p_kind: kind, p_url: url, p_token: token }); };
    return api;
  }

  window.MSOrdenes = {
    STATUS: STATUS, tone: statusTone, snap: snap, sendDoc: sendDoc, docText: docText, openDoc: openDoc, info: info, groupStatus: groupStatus, statusPill: statusPill,
    pedidoText: pedidoText, reminderText: reminderText,
    buildPDF: buildPDF, pedidoPDF: pedidoPDF, sharePDF: sharePDF, loadAssets: loadAssets,
    doneHTML: doneHTML, markReceived: markReceived, cardHTML: cardHTML, fichaHTML: fichaHTML, actionsHTML: actionsHTML,
    dashboard: dashboard, classify: classify, wire: wire, ajustes: ajustes, stepsList: stepsList, guideRows: guideRows, dispatch: dispatch, proofText: proofText,
    extendLocal: extendLocal, extendSupabase: extendSupabase, MAX_URL: MAX_URL, _cache: cache,
  };
})();
