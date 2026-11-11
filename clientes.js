// =====================================================================
// Shoppers Miami — Ficha de clienta y base de datos de clientes
//  · Clienta: al confirmar su primera compra en la caja se crea su ficha con un N° corto
//    y correlativo (MSM-00042). Datos de envío + facturación opcional (RUT validado).
//    Se autocompletan en las compras siguientes; "Mi cuenta" muestra su N°, sus datos y su historial.
//  · Cheryl (shopper): pestaña "Clientes" con buscador, orden, ficha con historial, totales,
//    comisión generada, notas privadas y "Descargar CSV" para Excel.
// Script clásico: se carga ANTES de app.js (módulo). app.js le pasa sus utilidades por
// window.MSApp; en modo demo, makeLocalApi le entrega su base (attachLocal) para la
// migración/semilla. En modo Supabase usa las tablas customers / customer_notes.
// =====================================================================
(function () {
  "use strict";

  var SEED_FLAG = "cli_seed_v1";
  var A = function () { return window.MSApp || {}; };
  var S = function () { return A().state || {}; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clp = function (n) { return "$" + Math.round(Number(n) || 0).toLocaleString("es-CL"); };
  var uid = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); };
  var nowIso = function () { return new Date().toISOString(); };
  var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  var fmtDate = function (iso) { if (!iso) return ""; var d = new Date(iso); return isNaN(d) ? "" : d.getDate() + " " + MES3[d.getMonth()] + " " + d.getFullYear(); };
  var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
  var csvDate = function (iso) { if (!iso) return ""; var d = new Date(iso); return isNaN(d) ? "" : pad2(d.getDate()) + "-" + pad2(d.getMonth() + 1) + "-" + d.getFullYear(); };
  var fold = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  var toast = function (m) { (A().toast || console.log)(m); };

  // ---------------------------------------------------------------------------
  // Datos de Chile: regiones y comunas frecuentes (la comuna sugiere la región)
  // ---------------------------------------------------------------------------
  var REGIONES = ["Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana", "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"];
  var COMUNAS = {
    "Metropolitana": ["Santiago", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea", "Ñuñoa", "La Reina", "Macul", "Peñalolén", "La Florida", "Puente Alto", "Maipú", "San Miguel", "Estación Central", "Independencia", "Recoleta", "Quilicura", "Huechuraba", "Colina", "Pudahuel", "San Bernardo", "Buin", "Talagante"],
    "Valparaíso": ["Viña del Mar", "Valparaíso", "Concón", "Quilpué", "Villa Alemana", "San Antonio", "Los Andes", "Quillota"],
    "Biobío": ["Concepción", "San Pedro de la Paz", "Talcahuano", "Chiguayante", "Los Ángeles", "Coronel"],
    "Antofagasta": ["Antofagasta", "Calama"], "Tarapacá": ["Iquique", "Alto Hospicio"], "Arica y Parinacota": ["Arica"], "Atacama": ["Copiapó", "Vallenar"],
    "Coquimbo": ["La Serena", "Coquimbo", "Ovalle"], "O'Higgins": ["Rancagua", "Machalí", "San Fernando"], "Maule": ["Talca", "Curicó", "Linares"], "Ñuble": ["Chillán", "Chillán Viejo"],
    "La Araucanía": ["Temuco", "Padre Las Casas", "Villarrica", "Pucón"], "Los Ríos": ["Valdivia"], "Los Lagos": ["Puerto Montt", "Puerto Varas", "Osorno", "Castro"], "Aysén": ["Coyhaique"], "Magallanes": ["Punta Arenas", "Puerto Natales"],
  };
  var REGION_OF = {}; Object.keys(COMUNAS).forEach(function (r) { COMUNAS[r].forEach(function (c) { REGION_OF[fold(c)] = r; }); });
  var PAISES = ["Chile", "Argentina", "Perú", "Bolivia", "Uruguay", "Colombia", "Estados Unidos", "Otro"];

  // ---------------------------------------------------------------------------
  // Validaciones: RUT (dígito verificador módulo 11), teléfono chileno, mail
  // ---------------------------------------------------------------------------
  function rutClean(v) { return String(v || "").toUpperCase().replace(/[^0-9K]/g, ""); }
  function rutDv(body) { var s = 0, m = 2; for (var i = body.length - 1; i >= 0; i--) { s += Number(body[i]) * m; m = m === 7 ? 2 : m + 1; } var r = 11 - (s % 11); return r === 11 ? "0" : r === 10 ? "K" : String(r); }
  function rutValid(v) { var c = rutClean(v); if (c.length < 8 || c.length > 9) return false; var body = c.slice(0, -1); return /^\d+$/.test(body) && rutDv(body) === c.slice(-1); }
  function rutFormat(v) { var c = rutClean(v); if (c.length < 2) return String(v || "").trim(); var body = c.slice(0, -1).replace(/^0+/, ""); return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + c.slice(-1); }
  function digits(v) { return String(v == null ? "" : v).replace(/[^\d]/g, ""); }
  // 9 dígitos de un número chileno (quita +56 / 56 al inicio)
  function clDigits(v) { var d = digits(v); if (d.length === 11 && d.indexOf("56") === 0) d = d.slice(2); return d; }
  function clPhoneOk(v) { return /^[2-9]\d{8}$/.test(clDigits(v)); }
  function clPhoneFmt(v) { var d = clDigits(v); return d.length === 9 ? "+56 " + d[0] + " " + d.slice(1, 5) + " " + d.slice(5) : String(v || "").trim(); }
  function phoneKey(v) { var d = digits(v); return d.length >= 9 ? d.slice(-9) : d; }   // para reconocer el mismo número con o sin +56
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); }

  // ---------------------------------------------------------------------------
  // Ficha: campos y copia (snapshot) para la orden
  // ---------------------------------------------------------------------------
  var SHIP = ["full_name", "rut", "email", "phone", "country", "region", "city", "address", "address2"];
  var BILL = ["billing_name", "billing_rut", "billing_giro", "billing_same_address", "billing_address", "billing_city", "billing_region", "billing_email", "billing_phone"];
  var FIELDS = SHIP.concat(["needs_invoice"], BILL);
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; }
  function shipComplete(c) { return !!(c && c.full_name && emailOk(c.email) && c.phone && c.city && c.address && (c.country !== "Chile" || (clPhoneOk(c.phone) && c.region && rutValid(c.rut)))); }
  function addrLine(o) { return [o.address, o.address2].filter(Boolean).join(", "); }
  function placeLine(o) { return [o.city, o.region && o.region !== o.city ? o.region : "", o.country].filter(Boolean).join(", "); }
  function shipSnap(c) { var s = pick(c, SHIP); s.code = c.code; return s; }
  function billSnap(c) {
    if (!c.needs_invoice) return null;
    var same = c.billing_same_address !== false;
    return { name: c.billing_name, rut: c.billing_rut, giro: c.billing_giro, address: same ? addrLine(c) : c.billing_address, city: same ? c.city : c.billing_city, region: same ? c.region : c.billing_region, email: c.billing_email || c.email, phone: c.billing_phone || c.phone };
  }

  // ---------------------------------------------------------------------------
  // Capa de datos: demo (localStorage ps_demo_v5, vía attachLocal) o Supabase
  // ---------------------------------------------------------------------------
  var local = null;   // { db, save }
  var store = {
    isDemo: function () { var st = S(); return !!(st.api && st.api.demo); },
    sb: function () { var st = S(); return st.api && st.api.sb; },
    ok: function (r) { if (r.error) throw new Error(r.error.message); return r.data; },
    meId: function () { return (S().me || {}).id; },

    // Ficha propia (o null)
    mine: async function () {
      if (store.isDemo()) { var c = local.db.customers.find(function (x) { return x.user_id === local.db.me; }); return c ? Object.assign({}, c) : null; }
      return store.ok(await store.sb().from("customers").select("*").eq("user_id", store.meId()).maybeSingle());
    },
    // Crea o actualiza la ficha propia. Se reutiliza si ya existe para esta cuenta, o si se reconoce
    // por teléfono o mail una ficha sin cuenta asociada (p. ej. una clienta que Cheryl anotó antes).
    saveMine: async function (fields) {
      if (!store.isDemo()) return store.ok(await store.sb().rpc("upsert_my_customer", { p: fields }));
      var db = local.db, me = db.me, c = db.customers.find(function (x) { return x.user_id === me; });
      if (!c) {
        var pk = phoneKey(fields.phone), em = String(fields.email || "").trim().toLowerCase();
        c = db.customers.find(function (x) { return !x.user_id && ((pk && phoneKey(x.phone) === pk) || (em && String(x.email || "").toLowerCase() === em)); });
        if (c) c.user_id = me;
      }
      if (!c) { c = { id: uid(), code: nextCode(db), user_id: me, created_at: nowIso() }; db.customers.push(c); }
      Object.assign(c, pick(fields, FIELDS), { updated_at: nowIso() });
      linkLocal(db);
      if (local.save() === false) throw new Error("No se pudo guardar en el teléfono");
      return Object.assign({}, c);
    },
    // Cheryl edita una ficha
    update: async function (id, patch) {
      if (!store.isDemo()) return store.ok(await store.sb().from("customers").update(Object.assign(pick(patch, FIELDS), { updated_at: nowIso() })).eq("id", id).select().single());
      var c = local.db.customers.find(function (x) { return x.id === id; }); if (!c) throw new Error("La ficha ya no existe");
      Object.assign(c, pick(patch, FIELDS), { updated_at: nowIso() }); local.save(); return Object.assign({}, c);
    },
    // Todo lo que necesita la vista de Cheryl
    loadAll: async function () {
      if (store.isDemo()) {
        var db = local.db, prof = {}; db.profiles.forEach(function (p) { prof[p.id] = p; });
        var offers = {}; (db.offers || []).forEach(function (o) { offers[o.id] = o; });
        var notes = {}; Object.keys(db.customer_notes || {}).forEach(function (k) { notes[k] = db.customer_notes[k].notes || ""; });
        return { customers: db.customers.map(function (c) { return Object.assign({}, c); }), notes: notes, offers: offers, manual: (db.manual_sales || []).slice(),
          orders: (db.orders || []).map(function (o) { return Object.assign({}, o, { client: prof[o.client_id] || null }); }) };
      }
      var sb = store.sb(), ok = store.ok;
      var r = await Promise.all([
        sb.from("customers").select("*").order("created_at", { ascending: true }).limit(5000),
        sb.from("customer_notes").select("customer_id, notes").limit(5000),
        sb.from("orders").select("*, client:profiles!client_id(full_name, phone), offer:offers(category, weight_kg, box_l, box_w, box_h, promo)").order("created_at", { ascending: false }).limit(10000),
        sb.from("manual_sales").select("*").limit(10000),
      ]);
      var notes2 = {}; (ok(r[1]) || []).forEach(function (n) { notes2[n.customer_id] = n.notes || ""; });
      var orders = ok(r[2]) || [], offers2 = {}; orders.forEach(function (o) { if (o.offer_id && o.offer) offers2[o.offer_id] = o.offer; });
      return { customers: ok(r[0]) || [], notes: notes2, offers: offers2, orders: orders, manual: r[3].error ? [] : r[3].data || [] };
    },
    saveNotes: async function (id, text) {
      if (store.isDemo()) { (local.db.customer_notes || (local.db.customer_notes = {}))[id] = { notes: text, updated_at: nowIso() }; if (local.save() === false) throw new Error("No se pudo guardar"); return; }
      store.ok(await store.sb().from("customer_notes").upsert({ customer_id: id, notes: text, updated_at: nowIso() }));
    },
  };

  // ---------------------------------------------------------------------------
  // Demo: N° correlativo, semilla de 12 clientas y migración idempotente
  // ---------------------------------------------------------------------------
  function nextCode(db) { db.customer_seq = (Number(db.customer_seq) || 0) + 1; return "MSM-" + String(db.customer_seq).padStart(5, "0"); }
  function rut(body) { return rutFormat(body + rutDv(String(body))); }
  // [nombre, teléfono, mail, comuna, región, dirección, depto, perfil demo (finanzas.js), factura, nota privada]
  var SEED = [
    ["Javiera Muñoz", "+56 9 8123 4411", "javiera.munoz@gmail.com", "Providencia", "Metropolitana", "Av. Providencia 2133", "Depto 1204", "fin-client-1", null, "Prefiere tonos neutros. Talla M en ropa, 38 en zapatos."],
    ["Catalina Rojas", "+56 9 7654 2210", "cata.rojas@outlook.com", "Viña del Mar", "Valparaíso", "5 Norte 845", "Depto 302", "fin-client-2", null, ""],
    ["Fernanda Soto", "+56 9 6345 9087", "fernanda.soto.v@gmail.com", "Concepción", "Biobío", "Barros Arana 1068", "", "fin-client-3", null, "Siempre pregunta por Coach. Avisarle de liquidaciones."],
    ["Valentina Díaz", "+56 9 9012 3344", "valentina@diazconsultores.cl", "Las Condes", "Metropolitana", "Av. Apoquindo 4499", "Oficina 81", "fin-client-4", ["Díaz Consultores Ltda.", 77654321, "Asesorías empresariales"], "Pide factura a nombre de su empresa."],
    ["Constanza Pérez", "+56 9 5567 1200", "coni.perez@gmail.com", "Antofagasta", "Antofagasta", "Av. Grecia 1520", "Depto 603", "fin-client-5", ["Boutique Mar Azul SpA", 76543210, "Venta al por menor de prendas de vestir"], "Revende en su tienda: compra por cantidad."],
    ["Isidora Fuentes", "+56 9 8876 5521", "isi.fuentes@gmail.com", "Temuco", "La Araucanía", "Av. Alemania 0645", "", "fin-client-6", null, ""],
    ["Antonia Vergara", "+56 9 7344 6610", "antonia.vergara@icloud.com", "La Serena", "Coquimbo", "Av. del Mar 3200", "Depto 1502", "fin-client-7", null, "Cumpleaños en marzo."],
    ["Macarena Silva", "+56 9 6120 7788", "maca.silva@gmail.com", "Puerto Montt", "Los Lagos", "Egaña 156", "", "fin-client-8", null, ""],
    ["Trinidad Morales", "+56 9 9345 2876", "trini.morales@gmail.com", "Ñuñoa", "Metropolitana", "Av. Irarrázaval 3450", "Depto 405", null, null, "Llegó recomendada por Javiera Muñoz."],
    ["Josefa Contreras", "+56 9 8456 1290", "josefa.contreras@hotmail.com", "Rancagua", "O'Higgins", "Av. Brasil 1035", "", null, null, ""],
    ["Florencia Araya", "+56 9 7231 5567", "flo.araya@gmail.com", "Punta Arenas", "Magallanes", "Av. Colón 912", "", null, ["Florencia Araya Ruiz", 16789345, "Diseñadora independiente"], ""],
    ["Agustina Reyes", "+56 9 6678 0034", "agustina.reyes@gmail.com", "Valdivia", "Los Ríos", "General Lagos 1490", "Casa B", null, null, ""],
  ];
  function seedLocal(db) {
    // RUT personal (agregado después): las clientas demo que no lo tienen reciben uno válido. Idempotente.
    var rutCh = false;
    if (db[SEED_FLAG]) (db.customers || []).forEach(function (c, i) { if (c.demo_seed && !c.rut) { c.rut = rut(15123456 + i * 412339); rutCh = true; } });
    if (db[SEED_FLAG]) return rutCh;
    var t0 = Date.now();
    SEED.forEach(function (s, i) {
      var pk = phoneKey(s[1]);
      if (db.customers.some(function (c) { return phoneKey(c.phone) === pk; })) return;            // ya estaba: no duplicar
      var prof = s[7] && db.profiles.find(function (p) { return p.id === s[7]; });
      var first = (db.orders || []).filter(function (o) { return prof && o.client_id === prof.id; }).map(function (o) { return o.created_at; }).sort()[0];
      var c = { id: uid(), code: nextCode(db), user_id: prof ? prof.id : null, full_name: s[0], rut: rut(15123456 + i * 412339), phone: s[1], email: s[2], country: "Chile", city: s[3], region: s[4], address: s[5], address2: s[6],
        needs_invoice: !!s[8], billing_same_address: true, created_at: first || new Date(t0 - (20 + i * 6) * 864e5).toISOString(), demo_seed: true };
      if (s[8]) Object.assign(c, { billing_name: s[8][0], billing_rut: rut(s[8][1]), billing_giro: s[8][2], billing_email: s[2], billing_phone: s[1] });
      db.customers.push(c);
      if (s[9]) db.customer_notes[c.id] = { notes: s[9], updated_at: nowIso() };
    });
    // Clientas que ya compraron antes de que existiera la ficha: se les crea una (con lo que se sepa)
    var withOrders = {}; (db.orders || []).forEach(function (o) { withOrders[o.client_id] = true; });
    db.profiles.forEach(function (p) {
      if (p.role !== "client" || !withOrders[p.id] || db.customers.some(function (c) { return c.user_id === p.id; })) return;
      db.customers.push({ id: uid(), code: nextCode(db), user_id: p.id, full_name: p.full_name || "", phone: p.phone || "", email: /@demo$/.test(p.email || "") ? "" : p.email || "", country: "Chile", created_at: nowIso() });
    });
    db[SEED_FLAG] = nowIso();
    return true;
  }
  // Enlaza (sin borrar ni cambiar montos) pedidos y ventas manuales con su ficha. Idempotente.
  function linkLocal(db) {
    var byUser = {}, byName = {}, changed = false;
    db.customers.forEach(function (c) { if (c.user_id) byUser[c.user_id] = c; if (c.full_name) byName[fold(c.full_name)] = c; });
    (db.orders || []).forEach(function (o) { var c = !o.customer_id && byUser[o.client_id]; if (c) { o.customer_id = c.id; o.customer_code = c.code; changed = true; } });
    (db.manual_sales || []).forEach(function (m) { var c = !m.customer_id && m.client_name && byName[fold(m.client_name)]; if (c) { m.customer_id = c.id; changed = true; } });
    return changed;
  }
  // Cuenta nueva (cuentas.js, modo demo): su ficha se crea al registrarse, con el mismo correo de la cuenta.
  // Si Cheryl ya la tenía anotada (ficha sin cuenta con ese correo), se le asocia esa misma ficha.
  // En Supabase lo hace el trigger handle_new_user (supabase/schema.sql).
  function accountFicha(db, prof) {
    if (!Array.isArray(db.customers)) db.customers = [];
    var em = String(prof.email || "").trim().toLowerCase();
    var c = db.customers.find(function (x) { return x.user_id === prof.id; });
    if (!c && em) { c = db.customers.find(function (x) { return !x.user_id && String(x.email || "").toLowerCase() === em; }); if (c) c.user_id = prof.id; }
    if (!c) { c = { id: uid(), code: nextCode(db), user_id: prof.id, full_name: prof.full_name || "", email: em, country: "Chile", created_at: nowIso() }; db.customers.push(c); }
    else { c.email = em || c.email; if (!c.full_name) c.full_name = prof.full_name || ""; c.updated_at = nowIso(); }
    linkLocal(db);
    return Object.assign({}, c);
  }
  function attachLocal(db, saveFn) {
    local = { db: db, save: saveFn };
    var ch = false;
    if (!Array.isArray(db.customers)) { db.customers = []; ch = true; }
    if (!db.customer_notes || typeof db.customer_notes !== "object") { db.customer_notes = {}; ch = true; }
    if (db.customer_seq == null) { db.customer_seq = db.customers.reduce(function (m, c) { return Math.max(m, Number(String(c.code || "").replace(/\D/g, "")) || 0); }, 0); ch = true; }
    try { if (seedLocal(db)) ch = true; if (linkLocal(db)) ch = true; } catch (e) { console.warn("Clientes (demo)", e); }
    if (ch) saveFn();
  }

  // ---------------------------------------------------------------------------
  // Estadísticas por clienta (mismas reglas que finanzas.js para compras compartidas)
  // ---------------------------------------------------------------------------
  var STEP_ORDER = ["pendiente_pago", "comprobante_recibido", "pagado", "comprado", "en_bodega", "enviado", "entregado"];
  function stepLabel(s) { var st = (A().ORDER_STEPS || []).find(function (x) { return x[0] === s; }); return st ? st[1] : s === "cancelado" ? "Cancelado" : s || ""; }
  // color del estado (ordenes.js): pendiente = rojo, por aprobar = ámbar, pagado / hecho = verde, cancelado = gris
  function stepTone(s) { return window.MSOrdenes ? "st-" + window.MSOrdenes.tone(s) : s === "entregado" ? "green" : s === "pendiente_pago" ? "red" : s === "cancelado" ? "" : "amber"; }
  function hostShare(o) { return /Compra compartida 50\/50/.test(o.notes || "") && !/ \(50%\)$/.test(o.description || "") ? 0.5 : 1; }
  function belongs(o, c) { return o.customer_id ? o.customer_id === c.id : !!(c.user_id && o.client_id === c.user_id); }
  function buildStats(data) {
    var F = window.MSFinanzas, out = {};
    data.customers.forEach(function (c) {
      var groups = {}, list = [];
      data.orders.forEach(function (o) {
        if (!belongs(o, c)) return;
        var k = o.order_code || o.id, g = groups[k];
        if (!g) { g = groups[k] = { kind: "app", code: o.order_code || "", date: o.created_at, rows: [], total: 0, commission: 0, receipt: null, bill: null, ship: null }; list.push(g); }
        g.rows.push(o);
        if (o.created_at < g.date) g.date = o.created_at;
        if (o.receipt_path) g.receipt = o.receipt_path;
        if (o.bill_to) g.bill = o.bill_to;
        if (o.ship_to) g.ship = o.ship_to;
        if (o.status !== "cancelado") {
          var sh = hostShare(o);
          g.total += Math.round((Number(o.total_clp) || 0) * sh);
          try { g.commission += Math.round((F && F.orderCommission ? F.orderCommission(o, data.offers[o.offer_id]) : 0) * sh); } catch (e) {}
        }
      });
      list.forEach(function (g) {
        var live = g.rows.filter(function (o) { return o.status !== "cancelado"; });
        g.cancelled = !live.length;
        g.status = g.cancelled ? "cancelado" : live.map(function (o) { return o.status; }).sort(function (a, b) { return STEP_ORDER.indexOf(a) - STEP_ORDER.indexOf(b); })[0];
        g.pending = live.some(function (o) { return o.status === "pendiente_pago" || o.status === "comprobante_recibido"; });
      });
      (data.manual || []).forEach(function (m) {
        if (m.customer_id !== c.id) return;
        list.push({ kind: "manual", code: "", date: m.sale_date ? new Date(m.sale_date + "T12:00:00").toISOString() : m.created_at, rows: [{ description: m.description }], total: Number(m.amount_clp) || 0, commission: Number(m.commission_clp) || 0, status: "manual", cancelled: false });
      });
      list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var live2 = list.filter(function (g) { return !g.cancelled; });
      var total = live2.reduce(function (t, g) { return t + g.total; }, 0);
      out[c.id] = { list: list, count: live2.length, total: total, commission: live2.reduce(function (t, g) { return t + g.commission; }, 0),
        avg: live2.length ? Math.round(total / live2.length) : 0, last: live2.length ? live2[0].date : null,
        pendingTotal: live2.filter(function (g) { return g.pending; }).reduce(function (t, g) { return t + g.total; }, 0) };
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Formulario (caja, Mi cuenta y edición por Cheryl)
  // ---------------------------------------------------------------------------
  function inp(name, label, val, attrs, hint) {
    return '<div class="cli-f" data-f="' + name + '"><label class="f" for="cf-' + name + '">' + label + '</label>' +
      '<input class="in" id="cf-' + name + '" name="' + name + '" value="' + esc(val) + '" ' + (attrs || "") + ' aria-describedby="cf-' + name + '-e">' +
      (hint ? '<span class="cli-hint">' + hint + '</span>' : "") + '<span class="cli-err" id="cf-' + name + '-e" aria-live="polite"></span></div>';
  }
  function phoneField(name, label, val, country) {
    var cl = country === "Chile";
    var shown = cl ? (clDigits(val).length === 9 ? clPhoneFmt(val).slice(4) : clDigits(val)) : String(val || "");
    return '<div class="cli-f" data-f="' + name + '"><label class="f" for="cf-' + name + '">' + label + '</label>' +
      '<div class="cli-tel"><span class="cli-pre" aria-hidden="true">' + (cl ? "+56" : "+") + '</span><input class="in" id="cf-' + name + '" name="' + name + '" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(shown) + '" placeholder="' + (cl ? "9 1234 5678" : "código de país y número") + '" aria-describedby="cf-' + name + '-e"></div>' +
      '<span class="cli-err" id="cf-' + name + '-e" aria-live="polite"></span></div>';
  }
  function regionField(name, val, country, label) {
    var cl = country === "Chile";
    return '<div class="cli-f" data-f="' + name + '"><label class="f" for="cf-' + name + '">' + (label || "Región") + '</label>' +
      (cl ? '<select class="in" id="cf-' + name + '" name="' + name + '" autocomplete="address-level1" aria-describedby="cf-' + name + '-e"><option value="">Elige tu región</option>' + REGIONES.map(function (r) { return '<option' + (r === val ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("") + "</select>"
        : '<input class="in" id="cf-' + name + '" name="' + name + '" autocomplete="address-level1" value="' + esc(val) + '" placeholder="Provincia o estado" aria-describedby="cf-' + name + '-e">') +
      '<span class="cli-err" id="cf-' + name + '-e" aria-live="polite"></span></div>';
  }
  var COMUNA_LIST = '<datalist id="cli-comunas">' + Object.keys(COMUNAS).map(function (r) { return COMUNAS[r].map(function (c) { return '<option value="' + esc(c) + '">'; }).join(""); }).join("") + "</datalist>";

  // d = datos a mostrar; opt.other = enviar a otra dirección (solo para este pedido)
  function formHTML(d, opt) {
    opt = opt || {};
    var country = d.country || "Chile", inv = !!d.needs_invoice, same = d.billing_same_address !== false;
    return '<form class="cli-form" novalidate autocomplete="on">' +
      '<fieldset class="cli-fs"><legend>' + (opt.other ? "Contacto" : "Tus datos") + '</legend>' +
        '<div class="cli-two">' + inp("full_name", "Nombre completo", d.full_name, 'autocomplete="name" autocapitalize="words" enterkeyhint="next" placeholder="Nombre y apellido"') +
        inp("rut", country === "Chile" ? "RUT" : 'RUT o documento <span class="cli-opt">(opcional)</span>', d.rut, 'inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="next" placeholder="12.345.678-5" maxlength="12"', "Lo pide la aduana para entregarte el paquete en Chile.") + "</div>" +
        '<div class="cli-two">' + inp("email", "Mail", d.email, 'type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="nombre@gmail.com"') +
        phoneField("phone", "Teléfono (WhatsApp)", d.phone, country) + "</div>" +
      "</fieldset>" +
      '<fieldset class="cli-fs"><legend>' + (opt.other ? "Otra dirección para este pedido" : "Dirección de envío en " + esc(country === "Chile" ? "Chile" : "destino")) + '</legend>' +
        '<div class="cli-two"><div class="cli-f" data-f="country"><label class="f" for="cf-country">País</label><select class="in" id="cf-country" name="country" autocomplete="country-name">' + PAISES.map(function (p) { return "<option" + (p === country ? " selected" : "") + ">" + p + "</option>"; }).join("") + "</select></div>" +
        regionField("region", d.region, country) + "</div>" +
        inp("city", "Comuna o ciudad", d.city, 'autocomplete="address-level2" autocapitalize="words" list="cli-comunas" enterkeyhint="next" placeholder="Ej: Providencia"') +
        inp("address", "Dirección (calle y número)", d.address, 'autocomplete="street-address" autocapitalize="words" enterkeyhint="next" placeholder="Ej: Av. Providencia 2133"') +
        inp("address2", 'Depto, casa u oficina <span class="cli-opt">(opcional)</span>', d.address2, 'autocapitalize="words" enterkeyhint="done" placeholder="Ej: Depto 1204"') +
        (opt.other ? '<label class="cli-check"><input type="checkbox" name="save_main"> <span>Guardar esta como mi dirección principal</span></label>' : "") +
        COMUNA_LIST +
      "</fieldset>" +
      '<label class="cli-switch"><input type="checkbox" role="switch" name="needs_invoice"' + (inv ? " checked" : "") + '><span class="cli-sw" aria-hidden="true"></span><span class="cli-sw-t"><b>Necesito factura por el servicio</b><small>Para empresas o si rindes el gasto. ' + esc(A().cherylName ? A().cherylName() : "Cheryl") + ' factura su comisión de personal shopper.</small></span></label>' +
      '<fieldset class="cli-fs cli-bill"' + (inv ? "" : " hidden") + '><legend>Datos de facturación</legend>' +
        inp("billing_name", "Razón social o nombre", d.billing_name || (inv ? "" : ""), 'autocomplete="organization" autocapitalize="words" placeholder="Ej: Comercial Las Rosas SpA"') +
        '<div class="cli-two">' + inp("billing_rut", "RUT", d.billing_rut, 'inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="12.345.678-5" maxlength="12"', "Con guion y dígito verificador (puede ser K).") +
        inp("billing_giro", "Giro", d.billing_giro, 'autocapitalize="sentences" placeholder="Ej: Venta de vestuario"') + "</div>" +
        '<label class="cli-check"><input type="checkbox" name="billing_same_address"' + (same ? " checked" : "") + '> <span>Dirección de facturación igual a la de envío</span></label>' +
        '<div class="cli-billaddr"' + (same ? " hidden" : "") + ">" +
          inp("billing_address", "Dirección de facturación", d.billing_address, 'autocapitalize="words" placeholder="Calle, número, oficina"') +
          '<div class="cli-two">' + inp("billing_city", "Comuna", d.billing_city, 'autocapitalize="words" list="cli-comunas"') + regionField("billing_region", d.billing_region, "Chile") + "</div>" +
        "</div>" +
        '<div class="cli-two">' + inp("billing_email", "Mail de facturación", d.billing_email || d.email, 'type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="facturas@empresa.cl"') +
        phoneField("billing_phone", "Teléfono de facturación", d.billing_phone || d.phone, "Chile") + "</div>" +
      "</fieldset>" +
      '<button type="submit" hidden></button></form>';
  }
  // Interacciones del formulario (país, región sugerida por comuna, factura, formato de RUT/teléfono)
  function wireForm(form, onChange) {
    var $ = function (n) { return form.querySelector('[name="' + n + '"]'); };
    var country = function () { return $("country") ? $("country").value : "Chile"; };
    var refreshCountry = function () {
      var d = readForm(form), regBox = form.querySelector('[data-f="region"]'), telBox = form.querySelector('[data-f="phone"]');
      regBox.outerHTML = regionField("region", d.region, d.country);
      telBox.outerHTML = phoneField("phone", "Teléfono (WhatsApp)", d.phone, d.country);
      bindLive();
    };
    var bindLive = function () {
      form.querySelectorAll("input,select").forEach(function (el) {
        el.oninput = el.onchange = function () { clearErr(form, el.name); onChange && onChange(); };
      });
      $("country").onchange = function () { refreshCountry(); onChange && onChange(); };
      $("city").addEventListener("change", function () { var r = REGION_OF[fold($("city").value.trim())]; if (r && country() === "Chile" && $("region") && !$("region").value) { $("region").value = r; clearErr(form, "region"); } });
      var bc = $("billing_city"); if (bc) bc.addEventListener("change", function () { var r = REGION_OF[fold(bc.value.trim())]; if (r && $("billing_region") && !$("billing_region").value) $("billing_region").value = r; });
      $("rut").addEventListener("blur", function () { var v = $("rut").value; if (country() !== "Chile") return; if (rutClean(v).length >= 2) $("rut").value = rutFormat(v); if (v.trim() && !rutValid(v)) setErr(form, "rut", rutMsg(v)); });
      $("billing_rut").addEventListener("blur", function () { var v = $("billing_rut").value; if (rutClean(v).length >= 2) $("billing_rut").value = rutFormat(v); if (v.trim() && !rutValid(v)) setErr(form, "billing_rut", rutMsg(v)); });
      ["phone", "billing_phone"].forEach(function (n) { var el = $(n); if (el) el.addEventListener("blur", function () { var cl = n === "billing_phone" || country() === "Chile"; if (cl && clPhoneOk(el.value)) el.value = clPhoneFmt(el.value).slice(4); }); });
      $("email").addEventListener("blur", function () { var v = $("email").value.trim(); if (v && !emailOk(v)) setErr(form, "email", "Revisa tu mail: parece que falta algo (ej: nombre@gmail.com)."); });
      $("needs_invoice").onchange = function () {
        var on = $("needs_invoice").checked; form.querySelector(".cli-bill").hidden = !on;
        if (on) { if (!$("billing_name").value.trim()) $("billing_name").value = $("full_name").value.trim(); if (!$("billing_email").value.trim()) $("billing_email").value = $("email").value.trim(); if (!$("billing_phone").value.trim()) $("billing_phone").value = $("phone").value.trim(); }
        onChange && onChange();
      };
      $("billing_same_address").onchange = function () { form.querySelector(".cli-billaddr").hidden = $("billing_same_address").checked; onChange && onChange(); };
    };
    bindLive();
  }
  function readForm(form) {
    var d = {}; form.querySelectorAll("input[name],select[name]").forEach(function (el) { d[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
    return d;
  }
  function rutMsg(v) { return rutClean(v).length < 8 ? "El RUT está incompleto: escribe todos los números y el dígito verificador." : "Este RUT no es válido: revisa el dígito verificador (el número o K después del guion)."; }
  function setErr(form, name, msg) { var el = form.querySelector('[name="' + name + '"]'), e = form.querySelector("#cf-" + name + "-e"); if (el) el.setAttribute("aria-invalid", "true"); if (e) e.textContent = msg; var box = form.querySelector('[data-f="' + name + '"]'); if (box) box.classList.add("bad"); }
  function clearErr(form, name) { var el = form.querySelector('[name="' + name + '"]'), e = form.querySelector("#cf-" + name + "-e"); if (el) el.removeAttribute("aria-invalid"); if (e) e.textContent = ""; var box = form.querySelector('[data-f="' + name + '"]'); if (box) box.classList.remove("bad"); }
  // Valida y devuelve { ok, data, first }
  function validate(form) {
    var d = readForm(form), errs = [];
    form.querySelectorAll(".cli-f.bad").forEach(function (b) { clearErr(form, b.dataset.f); });
    var cl = d.country === "Chile";
    if (d.full_name.length < 3) errs.push(["full_name", "Escribe tu nombre completo."]);
    else if (d.full_name.split(/\s+/).length < 2) errs.push(["full_name", "Agrega tu apellido, así el courier te encuentra sin problemas."]);
    if (cl) { if (!d.rut) errs.push(["rut", "Escribe tu RUT: la aduana lo pide para entregarte el paquete."]); else if (!rutValid(d.rut)) errs.push(["rut", rutMsg(d.rut)]); }
    if (!d.email) errs.push(["email", "Escribe tu mail: ahí te llega el resumen de tu compra."]);
    else if (!emailOk(d.email)) errs.push(["email", "Revisa tu mail: parece que falta algo (ej: nombre@gmail.com)."]);
    if (cl ? !clPhoneOk(d.phone) : digits(d.phone).length < 8) errs.push(["phone", cl ? (clDigits(d.phone).length ? "Tu número debe tener 9 dígitos, por ejemplo 9 1234 5678." : "Escribe tu celular para coordinar la entrega.") : "Escribe tu teléfono con código de país."]);
    if (!d.region) errs.push(["region", cl ? "Elige tu región." : "Escribe tu provincia o estado."]);
    if (!d.city) errs.push(["city", "¿En qué comuna o ciudad recibes?"]);
    if (!d.address) errs.push(["address", "Escribe la calle y el número."]);
    else if (!/\d|s\/n/i.test(d.address)) errs.push(["address", "Incluye el número de la calle (o escribe s/n si no tiene)."]);
    if (d.needs_invoice) {
      if (d.billing_name.length < 3) errs.push(["billing_name", "Escribe la razón social o el nombre para la factura."]);
      if (!d.billing_rut) errs.push(["billing_rut", "Escribe el RUT para la factura."]);
      else if (!rutValid(d.billing_rut)) errs.push(["billing_rut", rutMsg(d.billing_rut)]);
      if (d.billing_giro.length < 3) errs.push(["billing_giro", "Escribe el giro (la actividad) de la empresa o persona."]);
      if (!d.billing_same_address) {
        if (!d.billing_address) errs.push(["billing_address", "Escribe la dirección de facturación."]);
        if (!d.billing_city) errs.push(["billing_city", "Escribe la comuna de facturación."]);
        if (!d.billing_region) errs.push(["billing_region", "Elige la región de facturación."]);
      }
      if (!emailOk(d.billing_email)) errs.push(["billing_email", "Revisa el mail de facturación (ej: facturas@empresa.cl)."]);
      if (!clPhoneOk(d.billing_phone)) errs.push(["billing_phone", "El teléfono debe tener 9 dígitos, por ejemplo 9 1234 5678."]);
    }
    errs.forEach(function (e) { setErr(form, e[0], e[1]); });
    if (errs.length) return { ok: false, first: form.querySelector('[name="' + errs[0][0] + '"]'), n: errs.length };
    // datos normalizados
    var out = { full_name: d.full_name.replace(/\s+/g, " "), rut: cl ? rutFormat(d.rut) : (d.rut || ""), email: d.email.toLowerCase(), phone: cl ? clPhoneFmt(d.phone) : "+" + digits(d.phone), country: d.country, region: d.region, city: d.city, address: d.address, address2: d.address2 || "",
      needs_invoice: !!d.needs_invoice };
    if (d.needs_invoice) Object.assign(out, { billing_name: d.billing_name, billing_rut: rutFormat(d.billing_rut), billing_giro: d.billing_giro, billing_same_address: !!d.billing_same_address,
      billing_address: d.billing_same_address ? "" : d.billing_address, billing_city: d.billing_same_address ? "" : d.billing_city, billing_region: d.billing_same_address ? "" : d.billing_region,
      billing_email: d.billing_email.toLowerCase(), billing_phone: clPhoneFmt(d.billing_phone) });
    return { ok: true, data: out, saveMain: !!d.save_main };
  }
  function showFirstError(v) {
    if (!v.first) return;
    try { v.first.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { v.first.scrollIntoView(); }
    setTimeout(function () { try { v.first.focus({ preventScroll: true }); } catch (e) {} }, 250);
    toast(v.n > 1 ? "Revisa los " + v.n + " datos marcados para continuar" : "Revisa el dato marcado para continuar");
  }

  // Resumen de la ficha (tarjeta compacta)
  function summaryHTML(c, opt) {
    opt = opt || {};
    var b = billSnap(c);
    return '<div class="cli-sum">' +
      '<div class="cli-sum-r"><span class="cli-k">Envío a</span><span class="cli-v"><b>' + esc(c.full_name) + "</b>" + (c.rut ? " · RUT " + esc(c.rut) : "") + "<br>" + esc(addrLine(c)) + "<br>" + esc(placeLine(c)) + "</span></div>" +
      '<div class="cli-sum-r"><span class="cli-k">Contacto</span><span class="cli-v">' + esc(c.phone || "") + "<br>" + esc(c.email || "") + "</span></div>" +
      (opt.bill !== false ? '<div class="cli-sum-r"><span class="cli-k">Factura</span><span class="cli-v">' + (b ? "<b>Sí</b> · " + esc(b.name || "") + "<br>RUT " + esc(b.rut || "") + " · " + esc(b.giro || "") + "<br>" + esc([b.address, b.city, b.region].filter(Boolean).join(", ")) + "<br>" + esc([b.email, b.phone].filter(Boolean).join(" · ")) : "No (solo boleta)") + "</span></div>" : "") +
      "</div>";
  }

  // ---------------------------------------------------------------------------
  // CAJA: paso "Datos de envío" antes de confirmar
  // ---------------------------------------------------------------------------
  var cj = { user: null, mode: null, draft: null, cust: null };
  async function caja() {
    var me = S().me || {};
    var cust = null; try { cust = await store.mine(); } catch (e) { console.warn("Ficha", e); }
    if (cj.user !== me.id) cj = { user: me.id, mode: null, draft: null, cust: null };
    cj.cust = cust;
    var complete = shipComplete(cust);
    if (!cj.mode || (cj.mode === "summary" && !complete)) cj.mode = complete ? "summary" : "new";
    var base = cust || { full_name: me.full_name || "", phone: me.phone || "", email: /@demo$/.test(me.email || "") ? "" : me.email || "", country: "Chile" };
    var data = cj.draft || (cj.mode === "other" ? Object.assign({}, pick(base, ["full_name", "rut", "email", "phone", "country", "needs_invoice"].concat(BILL))) : Object.assign({}, base));
    var html = function () {
      var m = cj.mode;
      return '<section class="cli-step" id="cli-step" aria-labelledby="cli-step-h">' +
        '<div class="cli-step-h"><h3 id="cli-step-h">' + (m === "new" ? "Tus datos de envío" : "Datos de envío") + "</h3>" + (cust && cust.code ? '<span class="cli-code" title="Tu N° de clienta">N° ' + esc(cust.code) + "</span>" : "") + "</div>" +
        (m === "new" ? '<p class="cli-lead">' + (cust ? "Completa tus datos para enviar tu compra a Chile." : "Es tu primera compra: déjanos tus datos de envío. Al confirmar te asignamos tu N° de clienta y la próxima vez ya estarán listos.") + "</p>" : "") +
        (m === "summary" ? summaryHTML(cust) + '<div class="cli-acts"><button type="button" class="btn ghost sm" data-cli="edit">Editar mis datos</button><button type="button" class="btn ghost sm" data-cli="other">Enviar a otra dirección</button></div>' : "") +
        (m === "edit" || m === "other" ? '<div class="cli-acts cli-acts-top"><button type="button" class="btn ghost sm" data-cli="cancel">← Volver a mis datos guardados</button></div>' : "") +
        (m !== "summary" ? formHTML(data, { other: m === "other" }) : "") +
        (m === "summary" ? '<div class="cli-acts"><button type="button" class="btn ghost sm" data-cli="invoice">' + (cust.needs_invoice ? "Cambiar datos de factura" : "Necesito factura por el servicio") + "</button></div>" : "") +
        "</section>";
    };
    var root = null;
    var wire = function (view) {
      root = view.querySelector("#cli-step"); if (!root) return;
      root.querySelectorAll("[data-cli]").forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.cli;
          if (a === "cancel") { cj.mode = "summary"; cj.draft = null; }
          else if (a === "other") { cj.mode = "other"; cj.draft = null; data = Object.assign({}, pick(cust, ["full_name", "rut", "email", "phone", "needs_invoice"].concat(BILL)), { country: "Chile" }); }
          else { cj.mode = "edit"; cj.draft = null; data = Object.assign({}, cust, a === "invoice" ? { needs_invoice: true } : {}); }
          if (a === "cancel") data = Object.assign({}, cust);
          root.outerHTML = html(); wire(view);
          var f = view.querySelector("#cli-step");
          if (a === "invoice") { var bi = f.querySelector(".cli-bill"); if (bi) { bi.hidden = false; f.querySelector('[name="needs_invoice"]').dispatchEvent(new Event("change")); setTimeout(function () { bi.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50); } }
          else if (a !== "cancel") { var fi = f.querySelector(a === "other" ? '[name="address"]' : '[name="full_name"]'); if (fi) setTimeout(function () { fi.focus({ preventScroll: true }); f.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50); }
        };
      });
      var form = root.querySelector(".cli-form");
      if (form) {
        wireForm(form, function () { cj.draft = readForm(form); });
        form.onsubmit = function (e) { e.preventDefault(); var cf = view.querySelector("#confirm"); if (cf) cf.click(); };
      }
    };
    // Al tocar "Confirmar": valida, guarda/crea la ficha y entrega lo que va en la orden.
    // Devuelve false si falta algo (la caja no avanza y la bolsa queda intacta).
    var commit = async function () {
      var form = root && root.querySelector(".cli-form"), fields, shipFrom;
      if (form) {
        var v = validate(form);
        if (!v.ok) { showFirstError(v); return false; }
        if (cj.mode === "other" && !v.saveMain) {
          // otra dirección solo para este pedido: la ficha conserva su dirección principal
          fields = Object.assign({}, pick(cust, SHIP), pick(v.data, ["full_name", "email", "phone"]), pick(v.data, ["needs_invoice"].concat(BILL)));
          shipFrom = v.data;
        } else { fields = v.data; shipFrom = v.data; }
      } else {
        fields = pick(cust, FIELDS); shipFrom = cust;
      }
      if (!fields.needs_invoice) fields.needs_invoice = false;
      var saved = await store.saveMine(fields);
      var ship = Object.assign(pick(shipFrom, SHIP), { code: saved.code });
      // "igual a la de envío" = la dirección a la que va ESTE pedido
      var bill = billSnap(Object.assign({}, saved, fields, { address: shipFrom.address, address2: shipFrom.address2, city: shipFrom.city, region: shipFrom.region }));
      // Nombre/WhatsApp en el perfil si faltaban (Cheryl los ve en sus pedidos)
      var me2 = S().me || {}, p = {};
      if (!me2.full_name) p.full_name = saved.full_name; if (!me2.phone) p.phone = saved.phone;
      if (Object.keys(p).length && S().api && S().api.updateProfile) { try { S().me = await S().api.updateProfile(p); } catch (e) {} }
      var isNew = !cust;
      cj = { user: cj.user, mode: null, draft: null, cust: saved };
      return { isNew: isNew, customer: saved, order: { customer_id: saved.id, customer_code: saved.code, ship_to: ship, bill_to: bill }, snap: Object.assign({}, ship, { bill: bill }) };
    };
    return { html: html(), wire: wire, commit: commit };
  }

  // Texto (WhatsApp), PDF y boleta de la orden
  function orderLines(d) {
    var c = d && d.customer; if (!c) return [];
    var L = ["N° de clienta: " + c.code, c.rut ? "RUT: " + c.rut : "", "Envío: " + [addrLine(c), placeLine(c)].filter(Boolean).join(", "), c.email ? "Mail: " + c.email : ""];
    if (c.bill) { var b = c.bill; L.push("", "*REQUIERE FACTURA*", "Razón social: " + b.name, "RUT: " + b.rut, "Giro: " + b.giro, "Dirección: " + [b.address, b.city, b.region].filter(Boolean).join(", "), "Mail: " + b.email, "Teléfono: " + b.phone); }
    return L.filter(function (l, i, a) { return l !== "" || a[i - 1] !== ""; });
  }
  function pdfLines(d) {
    var c = d && d.customer; if (!c) return [];
    var L = [{ t: "N° de clienta: " + c.code, b: true }].concat(c.rut ? [{ t: "RUT: " + c.rut }] : [], [{ t: "Envío: " + [addrLine(c), placeLine(c)].filter(Boolean).join(", ") }]);
    if (c.email) L.push({ t: "Mail: " + c.email });
    if (c.bill) { var b = c.bill; L.push({ t: "REQUIERE FACTURA", b: true, gap: 6 }, { t: b.name + " - RUT " + b.rut }, { t: "Giro: " + b.giro }, { t: "Dirección: " + [b.address, b.city, b.region].filter(Boolean).join(", ") }, { t: [b.email, b.phone].filter(Boolean).join(" - ") }); }
    return L;
  }
  function voucherHTML(c) {
    if (!c) return "";
    return '<div class="cli-vcust"><span>Clienta <b>' + esc(c.code) + "</b> · " + esc(c.full_name) + "</span><span>" + esc([addrLine(c), placeLine(c)].filter(Boolean).join(", ")) + "</span>" +
      (c.bill ? '<span class="cli-vinv"><b>Requiere factura</b> · ' + esc(c.bill.name) + " · RUT " + esc(c.bill.rut) + "</span>" : "") + "</div>";
  }
  // Etiqueta en la tarjeta de la orden (pedidos de Cheryl)
  function orderTag(o) {
    if (!o || !(o.customer_code || o.ship_to)) return "";
    var s = o.ship_to || {};
    return '<div class="cli-otag"><span class="pill cli-pill">' + esc(o.customer_code || s.code || "") + "</span>" + (o.bill_to ? '<span class="pill amber">Requiere factura</span>' : "") +
      (s.address ? '<span class="small cli-oaddr">' + esc([addrLine(s), placeLine(s)].filter(Boolean).join(", ")) + "</span>" : "") +
      (o.bill_to ? '<span class="small cli-oaddr">Factura: ' + esc(o.bill_to.name) + " · RUT " + esc(o.bill_to.rut) + " · " + esc(o.bill_to.giro || "") + "</span>" : "") + "</div>";
  }

  // Ir a un pedido en "Pedidos" y destacarlo
  function goOrder(code) {
    if (!code) return A().go && A().go("pedidos");
    A().go("pedidos");
    var t0 = Date.now(), iv = setInterval(function () {
      var el = document.querySelector('[data-ocode="' + (window.CSS && CSS.escape ? CSS.escape(code) : code) + '"]');
      if (el || Date.now() - t0 > 4000) {
        clearInterval(iv);
        if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("cli-flash"); setTimeout(function () { el.classList.remove("cli-flash"); }, 2400); }
      }
    }, 120);
  }

  // ---------------------------------------------------------------------------
  // MI CUENTA (clienta): N°, datos editables e historial de compras
  // ---------------------------------------------------------------------------
  async function cuenta(view) {
    var cust = null, orders = [];
    try { cust = await store.mine(); } catch (e) { console.warn(e); }
    try { orders = await S().api.listOrders(); } catch (e) {}
    var groups = [], by = {};
    orders.forEach(function (o) { var k = o.order_code || o.id; if (!by[k]) { by[k] = { code: o.order_code || "", date: o.created_at, rows: [], total: 0 }; groups.push(by[k]); } var g = by[k]; g.rows.push(o); if (o.created_at < g.date) g.date = o.created_at; if (o.status !== "cancelado") g.total += Number(o.total_clp) || 0; });
    groups.forEach(function (g) { var live = g.rows.filter(function (o) { return o.status !== "cancelado"; }); g.status = live.length ? live.map(function (o) { return o.status; }).sort(function (a, b) { return STEP_ORDER.indexOf(a) - STEP_ORDER.indexOf(b); })[0] : "cancelado"; g.receipt = g.rows.some(function (o) { return o.receipt_path; }); });
    var box = document.createElement("div"); box.className = "cli-cuenta";
    box.innerHTML = '<div class="card cli-card cli-me">' +
        (cust ? '<div class="cli-me-h"><div><span class="cli-k">Tu N° de clienta</span><b class="cli-bigcode">' + esc(cust.code) + '</b></div><button type="button" class="btn ghost sm" id="cli-edit">Editar mis datos</button></div>' + (shipComplete(cust) ? summaryHTML(cust) : '<p class="small muted">Faltan datos de envío. Complétalos para que tu próxima compra salga directo.</p>')
          : '<div class="cli-me-h"><div><span class="cli-k">Tu N° de clienta</span><b class="cli-bigcode cli-none">Se crea con tu primera compra</b></div></div><p class="small muted" style="margin:6px 0 10px">Si quieres, deja tus datos de envío listos desde ya.</p><button type="button" class="btn ghost sm" id="cli-edit">Completar mis datos de envío</button>') +
      "</div>" +
      '<h2 class="section-title">Mis compras</h2>' +
      (groups.length ? '<div class="cli-hist">' + groups.map(function (g) {
        return '<div class="card cli-card cli-ord"><div class="cli-ord-h"><b>' + (g.code ? "Orden " + esc(g.code) : "Pedido") + '</b><span class="pill ' + stepTone(g.status) + '">' + esc(stepLabel(g.status)) + "</span></div>" +
          '<div class="small muted">' + fmtDate(g.date) + " · " + g.rows.length + (g.rows.length === 1 ? " producto" : " productos") + " · " + clp(g.total) + (g.receipt ? " · comprobante enviado" : "") + "</div>" +
          '<ul class="cli-prods">' + g.rows.map(function (o) { return "<li>" + esc(o.description) + "</li>"; }).join("") + "</ul>" +
          '<button type="button" class="btn ghost sm" data-goorder="' + esc(g.code) + '">Ver en Mis pedidos</button></div>';
      }).join("") + "</div>" : '<div class="empty">Aún no tienes compras. Cuando compres, aquí verás tu historial.</div>');
    view.insertBefore(box, view.firstChild);
    // la ficha queda arriba; el historial va después del formulario de perfil existente
    var hist = box.querySelectorAll(".section-title, .cli-hist, .cli-cuenta > .empty");
    var anchor = view.querySelector("#pf") ? view.querySelector("#pf").closest(".card") : null;
    if (anchor && anchor.nextSibling) { var frag = document.createDocumentFragment(); hist.forEach(function (n) { frag.appendChild(n); }); anchor.parentNode.insertBefore(frag, anchor.nextSibling); }
    view.querySelectorAll("[data-goorder]").forEach(function (b) { b.onclick = function () { goOrder(b.dataset.goorder); }; });
    var eb = box.querySelector("#cli-edit");
    if (eb) eb.onclick = function () { editSheet(cust || { full_name: S().me.full_name, phone: S().me.phone, country: "Chile" }, true, function () { A().render && A().render(); }); };
  }
  // Hoja con el formulario: la clienta (own=true) o Cheryl editando una ficha
  function editSheet(c, own, done) {
    A().sheet('<h2>' + (own ? "Mis datos de envío" : "Editar ficha " + esc(c.code || "")) + "</h2>" + (own && c.code ? '<p class="small muted" style="margin-top:0">N° de clienta ' + esc(c.code) + "</p>" : "") +
      '<div class="cli-sheetform">' + formHTML(c, {}) + '</div><div class="cli-sheet-acts"><button type="button" class="btn gold block" id="cli-save">Guardar datos</button><button type="button" class="btn ghost block" data-close>Volver sin guardar</button></div>',
      function (el, close) {
        el.closest(".sheet") && el.closest(".sheet").classList.add("cli-sheet");
        var form = el.querySelector(".cli-form"); wireForm(form);
        var save = async function () {
          var v = validate(form); if (!v.ok) return showFirstError(v);
          var b = el.querySelector("#cli-save"); b.disabled = true; b.textContent = "Guardando…";
          try {
            if (!v.data.needs_invoice) v.data.needs_invoice = false;
            var saved = own ? await store.saveMine(v.data) : await store.update(c.id, v.data);
            if (own) cj = { user: (S().me || {}).id, mode: null, draft: null, cust: saved };
            toast(own && !c.code ? "Listo. Tu N° de clienta es " + saved.code : "Datos guardados"); close(); done && done(saved);
          } catch (e) { b.disabled = false; b.textContent = "Guardar datos"; toast(e.message || "No se pudo guardar"); }
        };
        el.querySelector("#cli-save").onclick = save;
        form.onsubmit = function (e) { e.preventDefault(); save(); };
      });
  }

  // ---------------------------------------------------------------------------
  // CHERYL: pestaña "Clientes"
  // ---------------------------------------------------------------------------
  var ui = { q: "", sort: "last", open: null, data: null, stats: null };
  async function view(el) {
    el.innerHTML = '<div class="muted">Cargando clientas…</div>';
    try { ui.data = await store.loadAll(); ui.stats = buildStats(ui.data); }
    catch (e) { console.error(e); el.innerHTML = '<div class="card"><b>No se pudieron cargar las clientas</b><p class="muted">' + esc(e.message) + "</p></div>"; return; }
    if (ui.open && !ui.data.customers.some(function (c) { return c.id === ui.open; })) ui.open = null;
    ui.open ? ficha(el, ui.open) : list(el);
  }
  function sortedFiltered() {
    var q = fold(ui.q.trim()), qd = digits(ui.q), st = ui.stats;
    var rows = ui.data.customers.filter(function (c) {
      if (!q) return true;
      var hay = fold([c.full_name, c.code, c.email, c.city, c.region, c.phone].join(" "));
      return hay.indexOf(q) >= 0 || (qd.length >= 3 && digits(c.phone).indexOf(qd) >= 0) || (qd.length >= 2 && digits(c.code).indexOf(qd) >= 0);
    });
    rows.sort(function (a, b) {
      var A1 = st[a.id], B1 = st[b.id];
      if (ui.sort === "total") return B1.total - A1.total || String(B1.last || "").localeCompare(String(A1.last || ""));
      return String(B1.last || "").localeCompare(String(A1.last || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    return rows;
  }
  function list(el) {
    var all = ui.data.customers, st = ui.stats;
    var grand = all.reduce(function (t, c) { return t + st[c.id].total; }, 0);
    el.innerHTML = '<div class="cli-shop">' +
      '<div class="card cli-card cli-tools">' +
        '<label class="f" for="cli-q" style="margin-top:0">Buscar clienta</label>' +
        '<div class="cli-qbox"><input class="in" id="cli-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Nombre, N° MSM, teléfono, mail o ciudad" value="' + esc(ui.q) + '"></div>' +
        '<div class="cli-tools-r"><div class="cli-sort" role="group" aria-label="Ordenar"><span class="small muted">Ordenar por</span><button type="button" data-sort="last" aria-pressed="' + (ui.sort === "last") + '">Última compra</button><button type="button" data-sort="total" aria-pressed="' + (ui.sort === "total") + '">Monto total</button></div>' +
        '<button type="button" class="btn ghost sm" id="cli-csv">Descargar CSV</button></div>' +
      "</div>" +
      '<p class="cli-count" id="cli-count"></p>' +
      '<div class="card cli-card cli-table" role="list" id="cli-rows"></div></div>';
    var paint = function () {
      var rows = sortedFiltered();
      el.querySelector("#cli-count").textContent = (ui.q ? rows.length + " de " + all.length + " clientas" : all.length + " clientas") + " · total comprado " + clp(grand);
      el.querySelector("#cli-rows").innerHTML = rows.length ? '<div class="cli-th" aria-hidden="true"><span>N°</span><span>Clienta</span><span>Compras</span><span>Total</span><span>Última compra</span></div>' + rows.map(function (c) {
        var s = st[c.id];
        return '<button type="button" class="cli-row" role="listitem" data-open="' + esc(c.id) + '" aria-label="' + esc(c.full_name + ", " + c.code + ", " + s.count + " compras, " + clp(s.total)) + '">' +
          '<span class="cli-c-id">' + esc(c.code) + "</span>" +
          '<span class="cli-c-name"><b>' + esc(c.full_name || "Sin nombre") + "</b><small>" + esc(c.city || "Sin ciudad") + (c.needs_invoice ? " · factura" : "") + "</small></span>" +
          '<span class="cli-c-n"><b>' + s.count + "</b> " + (s.count === 1 ? "compra" : "compras") + "</span>" +
          '<span class="cli-c-t">' + clp(s.total) + "</span>" +
          '<span class="cli-c-d">' + (s.last ? fmtDate(s.last) : "Sin compras aún") + "</span></button>";
      }).join("") : '<div class="empty">No encontramos clientas con “' + esc(ui.q) + '”.<br><button type="button" class="btn ghost sm" id="cli-clear" style="margin-top:12px">Limpiar búsqueda</button></div>';
      el.querySelectorAll("[data-open]").forEach(function (b) { b.onclick = function () { openFicha(el, b.dataset.open); }; });
      var cl = el.querySelector("#cli-clear"); if (cl) cl.onclick = function () { ui.q = ""; el.querySelector("#cli-q").value = ""; paint(); el.querySelector("#cli-q").focus(); };
    };
    el.querySelector("#cli-q").oninput = function (e) { ui.q = e.target.value; paint(); };
    el.querySelectorAll("[data-sort]").forEach(function (b) { b.onclick = function () { ui.sort = b.dataset.sort; el.querySelectorAll("[data-sort]").forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.sort === ui.sort); }); paint(); }; });
    el.querySelector("#cli-csv").onclick = function () { downloadCSV(); };
    paint();
  }
  // Ficha abierta = una entrada del historial: "atrás" de Android vuelve a la lista
  function openFicha(el, id) {
    ui.open = id;
    try { history.pushState(Object.assign({}, history.state || {}, { ovl: 1, cli: id }), "", location.hash); } catch (e) {}
    ficha(el, id); window.scrollTo(0, 0);
  }
  function closeFicha(el) { ui.open = null; list(el); window.scrollTo(0, 0); }
  window.addEventListener("popstate", function (e) {
    if (!ui.open) return;
    var f = document.querySelector(".cli-ficha"); if (!f) { ui.open = null; return; }
    if (document.querySelector("#sheet-root") && document.querySelector("#sheet-root").firstElementChild) return;   // primero se cierra la hoja abierta
    e.stopImmediatePropagation();
    closeFicha(f.closest("#view") || f.parentNode);
  });
  function ficha(el, id) {
    var c = ui.data.customers.find(function (x) { return x.id === id; }), s = ui.stats[id], note = ui.data.notes[id] || "";
    var first = (c.full_name || "").split(" ")[0], tel = c.phone ? "+" + digits(c.phone) : "";
    var wa = A().waTo ? A().waTo(c.phone, "Hola " + first + ", soy " + (A().cherylName ? A().cherylName() : "Cheryl") + " de " + (A().APP_NAME || "Shoppers Miami") + ".") : "";
    var b = billSnap(c);
    el.innerHTML = '<div class="cli-ficha">' +
      '<button type="button" class="view-back cli-back" id="cli-back">' + (ui.from === "encargos" ? "← Volver a encargos" : "← Volver a clientes") + "</button>" +
      '<div class="card cli-card cli-head"><div class="cli-head-t"><span class="cli-code">' + esc(c.code) + '</span><h2>' + esc(c.full_name || "Sin nombre") + "</h2>" +
        '<span class="small muted">' + esc(placeLine(c)) + (c.created_at ? " · clienta desde " + fmtDate(c.created_at) : "") + "</span></div>" +
        '<div class="cli-contact">' + (wa ? '<a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(wa) + '">WhatsApp</a>' : "") +
          (tel ? '<a class="btn ghost sm" href="tel:' + esc(tel) + '">Llamar</a>' : "") + (c.email ? '<a class="btn ghost sm" href="mailto:' + esc(c.email) + '">Mail</a>' : "") + "</div></div>" +
      '<div class="cli-kpis">' +
        '<div class="cli-kpi"><span>Pedidos</span><b>' + s.count + "</b></div>" +
        '<div class="cli-kpi"><span>Total comprado</span><b>' + clp(s.total) + "</b>" + (s.pendingTotal ? "<small>" + clp(s.pendingTotal) + " pendiente de pago</small>" : "") + "</div>" +
        '<div class="cli-kpi"><span>Ticket promedio</span><b>' + clp(s.avg) + "</b></div>" +
        '<div class="cli-kpi"><span>Comisión para ' + esc(A().cherylName ? A().cherylName() : "Cheryl") + "</span><b>" + clp(s.commission) + "</b></div></div>" +
      (window.MSOrdenes ? '<div class="cli-oc" id="cli-oc"></div>' : "") +   // pagos de la clienta (ordenes.js): pendientes, por aprobar y realizadas
      '<div class="cli-enc" id="cli-enc"></div>' +   // encargos de la clienta (encargos.js): "Contactar" de nuevo
      '<div class="cli-cols"><div class="cli-col">' +
        '<div class="card cli-card"><div class="cli-sec-h"><h3>Contacto y envío</h3><button type="button" class="btn ghost sm" id="cli-edit">Editar</button></div>' +
          '<dl class="cli-dl"><dt>RUT</dt><dd>' + esc(c.rut || "—") + "</dd><dt>Teléfono</dt><dd>" + esc(c.phone || "—") + "</dd><dt>Mail</dt><dd>" + esc(c.email || "—") + "</dd><dt>Dirección</dt><dd>" + esc(addrLine(c) || "—") + "</dd><dt>Comuna</dt><dd>" + esc(c.city || "—") + "</dd><dt>Región</dt><dd>" + esc(c.region || "—") + "</dd><dt>País</dt><dd>" + esc(c.country || "Chile") + "</dd></dl></div>" +
        '<div class="card cli-card"><div class="cli-sec-h"><h3>Facturación</h3>' + (b ? '<span class="pill amber">Pide factura</span>' : "") + "</div>" +
          (b ? '<dl class="cli-dl"><dt>Razón social</dt><dd>' + esc(b.name) + "</dd><dt>RUT</dt><dd>" + esc(b.rut) + "</dd><dt>Giro</dt><dd>" + esc(b.giro) + "</dd><dt>Dirección</dt><dd>" + esc([b.address, b.city, b.region].filter(Boolean).join(", ")) + "</dd><dt>Mail</dt><dd>" + esc(b.email) + "</dd><dt>Teléfono</dt><dd>" + esc(b.phone) + "</dd></dl>" : '<p class="small muted" style="margin:0">No pide factura (solo boleta).</p>') + "</div>" +
        '<div class="card cli-card"><div class="cli-sec-h"><h3>Notas privadas</h3><span class="small muted">Solo las ves tú</span></div>' +
          '<label class="f cli-sr" for="cli-note">Notas privadas sobre ' + esc(c.full_name) + '</label><textarea class="in cli-note" id="cli-note" rows="4" placeholder="Tallas, gustos, fechas importantes, cómo prefiere pagar…">' + esc(note) + "</textarea>" +
          '<div class="cli-note-r"><span class="small muted" id="cli-note-st" aria-live="polite"></span><button type="button" class="btn sm" id="cli-note-save">Guardar nota</button></div></div>' +
      '</div><div class="cli-col">' +
        '<div class="card cli-card"><h3>Historial de compras</h3>' +
          (s.list.length ? '<div class="cli-hist">' + s.list.map(function (g, i) {
            var manual = g.kind === "manual";
            return '<article class="cli-ord"><div class="cli-ord-h"><b>' + (manual ? "Venta fuera de la app" : g.code ? "Orden " + esc(g.code) : "Pedido") + "</b>" +
              (manual ? '<span class="pill">Registrada a mano</span>' : '<span class="pill ' + stepTone(g.status) + '">' + esc(stepLabel(g.status)) + "</span>") + "</div>" +
              '<div class="small muted">' + fmtDate(g.date) + " · " + clp(g.total) + (manual ? "" : " · " + g.rows.length + (g.rows.length === 1 ? " producto" : " productos")) + "</div>" +
              '<ul class="cli-prods">' + g.rows.map(function (o) { return "<li>" + esc(o.description) + "</li>"; }).join("") + "</ul>" +
              (g.bill ? '<div class="small"><span class="pill amber">Requiere factura</span> ' + esc(g.bill.name) + " · RUT " + esc(g.bill.rut) + "</div>" : "") +
              (g.ship && g.ship.address && fold(addrLine(g.ship)) !== fold(addrLine(c)) ? '<div class="small muted">Enviado a: ' + esc([addrLine(g.ship), placeLine(g.ship)].filter(Boolean).join(", ")) + "</div>" : "") +
              (!manual && window.MSOrdenes ? window.MSOrdenes.fichaHTML(g) : "") +   // subir transferencia / aprobar / orden de compra (ordenes.js)
              (manual ? "" : '<div class="cli-ord-a">' + (g.receipt ? '<button type="button" class="btn ghost sm" data-rcpt="' + i + '">Ver comprobante</button>' : '<span class="small muted">' + (g.pending ? "Sin comprobante aún" : "") + "</span>") +
                (g.code ? '<button type="button" class="btn ghost sm" data-goorder="' + esc(g.code) + '">Ver pedido</button>' : "") + "</div>") + "</article>";
          }).join("") + "</div>" : '<p class="small muted" style="margin:0">Todavía no compra. Cuando lo haga, sus pedidos aparecen aquí.</p>') + "</div>" +
      "</div></div></div>";
    el.querySelector("#cli-back").onclick = function () {
      if (ui.from === "encargos") { ui.from = null; ui.open = null; return A().go && A().go("encargos"); }
      if (history.state && history.state.cli) history.back(); else closeFicha(el);
    };
    if (window.MSEncargos) window.MSEncargos.fichaBlock(el.querySelector("#cli-enc"), c);
    if (window.MSOrdenes) {   // mismo componente que en Pedidos: tablero de pagos de esta clienta + acciones en su historial
      var again = function () { var y = window.scrollY; return view(el).then(function () { window.scrollTo(0, y); }); };
      var appGroups = s.list.filter(function (g) { return g.kind !== "manual" && g.code; });
      window.MSOrdenes.wire(el.querySelector(".cli-hist") || el, again);
      window.MSOrdenes.dashboard(el.querySelector("#cli-oc"), appGroups, again, { compact: true });
    }
    el.querySelector("#cli-edit").onclick = function () { editSheet(c, false, function (saved) { Object.assign(c, saved); ficha(el, id); }); };
    var ta = el.querySelector("#cli-note"), stEl = el.querySelector("#cli-note-st"), last = note;
    var saveNote = async function () {
      if (ta.value === last) { stEl.textContent = "Sin cambios"; return; }
      stEl.textContent = "Guardando…";
      try { await store.saveNotes(id, ta.value); last = ta.value; ui.data.notes[id] = ta.value; stEl.textContent = "Nota guardada"; toast("Nota guardada"); }
      catch (e) { stEl.textContent = "No se pudo guardar"; toast(e.message); }
    };
    el.querySelector("#cli-note-save").onclick = saveNote;
    ta.addEventListener("blur", function () { if (ta.value !== last) saveNote(); });
    ta.addEventListener("input", function () { stEl.textContent = ta.value !== last ? "Cambios sin guardar" : ""; });
    el.querySelectorAll("[data-goorder]").forEach(function (bt) { bt.onclick = function () { ui.open = null; goOrder(bt.dataset.goorder); }; });
    el.querySelectorAll("[data-rcpt]").forEach(function (bt) { bt.onclick = function () { showReceipt(s.list[+bt.dataset.rcpt]); }; });
  }
  async function showReceipt(g) {
    var app = A(), ref = g.receipt, url = "", full = "";
    try { url = await S().api.receiptUrl(ref); full = app.openableUrl ? await app.openableUrl(url) : url; } catch (e) { return toast("No se pudo abrir el comprobante"); }
    var pdf = app.isPdfRef ? app.isPdfRef(ref) : /pdf/i.test(ref);
    app.sheet("<h2>Comprobante · " + esc(g.code) + "</h2>" +
      (pdf ? '<div class="rp-doc"><span class="rp-pdf" aria-hidden="true">PDF</span><span>Comprobante en PDF</span></div>' : '<a href="' + esc(full) + '" target="_blank" rel="noopener" class="rp-full"><img src="' + esc(url) + '" alt="Comprobante de transferencia" style="width:100%;border-radius:4px;display:block"></a>') +
      '<a class="btn ghost block" style="margin-top:12px" href="' + esc(full) + '" target="_blank" rel="noopener"' + (pdf ? ' download="comprobante.pdf"' : "") + ">" + (pdf ? "Abrir PDF" : "Ver en tamaño completo") + "</a>" +
      '<button class="btn ghost block" data-close style="margin-top:8px">Volver a la ficha</button>');
  }

  // CSV para Excel: separador ; y BOM UTF-8
  function buildCSV(data, stats) {
    var cols = ["N° clienta", "Nombre", "RUT clienta", "Teléfono", "Mail", "País", "Región", "Comuna/Ciudad", "Dirección", "Depto/Casa", "Requiere factura", "Razón social", "RUT", "Giro", "Dirección facturación", "Mail facturación", "Teléfono facturación", "N° compras", "Total comprado CLP", "Ticket promedio CLP", "Comisión generada CLP", "Última compra", "Clienta desde", "Notas privadas"];
    var cell = function (v) { var s = String(v == null ? "" : v).replace(/\r?\n/g, " "); return /[;"\n]/.test(s) || /^[=+\-@]/.test(s) && !/^\+56/.test(s) ? '"' + (/^[=+\-@]/.test(s) && !/^\+56/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"' : s; };
    var rows = data.customers.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (c) {
      var s = stats[c.id], b = billSnap(c);
      return [c.code, c.full_name, c.rut || "", c.phone, c.email, c.country, c.region, c.city, c.address, c.address2, b ? "Sí" : "No", b ? b.name : "", b ? b.rut : "", b ? b.giro : "", b ? [b.address, b.city, b.region].filter(Boolean).join(", ") : "", b ? b.email : "", b ? b.phone : "",
        s.count, Math.round(s.total), s.avg, Math.round(s.commission), csvDate(s.last), csvDate(c.created_at), data.notes[c.id] || ""].map(cell).join(";");
    });
    return "﻿" + [cols.map(cell).join(";")].concat(rows).join("\r\n") + "\r\n";
  }
  function downloadCSV() {
    try {
      var d = new Date(), name = "clientes-" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + ".csv";
      var blob = new Blob([buildCSV(ui.data, ui.stats)], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast("CSV descargado: " + ui.data.customers.length + " clientas");
    } catch (e) { toast("No se pudo descargar el CSV"); }
  }

  // Abrir la ficha de una clienta desde otra pestaña (encargos.js): "Volver" regresa allá
  function openCustomer(id, from) { ui.open = id; ui.from = from || null; if (A().go) A().go("clientes"); }

  window.MSClientes = {
    attachLocal: attachLocal, caja: caja, cuenta: cuenta, view: view, openCustomer: openCustomer,
    accountFicha: accountFicha, mine: function () { return store.mine(); },
    orderLines: orderLines, pdfLines: pdfLines, voucherHTML: voucherHTML, orderTag: orderTag,
    // para pruebas
    _rutValid: rutValid, _rutFormat: rutFormat, _clPhoneOk: clPhoneOk, _buildCSV: buildCSV, _store: store, _stats: buildStats,
  };
})();
