// =====================================================================
// tiendas.js — Las 10 tiendas del mall, 1 a 1 con el render 3D (letreros fijos del modelo de Codex)
// =====================================================================
// Única fuente de verdad de: claves, nombres visibles, orden físico (01…10), género fijo por tienda,
// links #s-NN y la migración Ropa → Ropa Mujer / Ropa Hombre. app.js arma SHOPS desde aquí.
//
// Claves (no cambian datos ni links antiguos):
//   01 Carteras · 02 Zapatos · 03 Deportes · 04 Relojes · 05 Lenceria · 06 Invierno
//   07 Ropa (= Ropa Mujer; se conserva la clave "Ropa") · 08 RopaHombre (nueva)
//   09 __ultimo (Ofertas: último minuto) · 10 Otros (Outlet)
// Categoría de producto nueva: "RopaHombre" (ropa de hombre). Los tipos de producto (polera, camisa…)
// siguen siendo de "Ropa"; la tienda/género decide si la oferta queda en "Ropa" o en "RopaHombre".
(function () {
  "use strict";

  // Nombre visible de la tienda 09 (ofertas de último minuto). Si se prefiere, cambiar a "Liquidación".
  var NOMBRE_OFERTAS = "Ofertas";

  var LAST = "__ultimo";
  // [n° de vitrina en la escena, clave en la app, nombre del letrero, fachada 2D, categorías de producto que vende]
  var LISTA = [
    ["01", "Carteras", "Michael Kors", "walnut", ["Carteras"]],   // nov-2026: la tienda de carteras pasa a llamarse Michael Kors (la clave sigue siendo "Carteras")
    ["02", "Zapatos", "Zapatos", "marble", ["Zapatos"]],
    ["03", "Deportes", "Ropa Deportiva", "graphite", ["Deportes"]],
    ["04", "Relojes", "Relojes y Joyas", "marble", ["Relojes", "Joyas"]],
    ["05", "Lenceria", "Lencería", "blush", ["Lenceria"]],
    ["06", "Invierno", "Ropa Invierno", "graphite", ["Invierno"]],
    ["07", "Ropa", "Ropa Mujer", "terrazzo", ["Ropa"]],
    ["08", "RopaHombre", "Ropa Hombre", "graphite", ["RopaHombre"]],
    ["09", LAST, NOMBRE_OFERTAS, "lastmin", null],
    ["10", "Otros", "Outlet", "terrazzo", ["Otros", "Perfumes", "Lentes", "Maquillaje", "Juguetes", "Hogar", "Electrónica"]],
  ];
  var SHOPS = {};
  LISTA.forEach(function (r) { SHOPS[r[1]] = [r[2], r[3], r[4]]; });
  var SCENE = {}, BY_SCENE = {};
  LISTA.forEach(function (r) { SCENE[r[1]] = r[0]; BY_SCENE[r[0]] = r[1]; });

  // Orden de la barra antes de las 10 tiendas: los links viejos #s-0…#s-8 eran índices de este arreglo.
  var LEGACY_ORDER = ["Carteras", "Zapatos", "Deportes", "Lenceria", "Relojes", "Otros", "Invierno", "Ropa", LAST];

  // Tiendas que ya definen el género: no se pregunta Mujer/Hombre al entrar ni al publicar.
  var FIXED_GENDER = { Carteras: "mujer", Lenceria: "mujer", Ropa: "mujer", RopaHombre: "hombre" };

  // Categoría "de tipo de producto": Ropa Hombre usa los mismos tipos (peso, caja, tallas) que Ropa.
  var typeCat = function (c) { return c === "RopaHombre" ? "Ropa" : c; };
  var sameCat = function (a, b) { return typeCat(a) === typeCat(b); };
  var isClothes = function (c) { return typeCat(c) === "Ropa"; };

  // Categoría final de una oferta según el tipo, la tienda elegida y el género.
  // "Ropa" + Hombre → RopaHombre (aunque la tienda elegida sea Ofertas u otra).
  function catFor(category, store, gender) {
    if (!isClothes(category)) return category;
    if (store === "RopaHombre") return "RopaHombre";
    if (store === "Ropa") return "Ropa";
    if (gender === "hombre") return "RopaHombre";
    if (gender === "mujer" || gender === "unisex") return "Ropa";
    return category;
  }
  // Tienda que se propone para un tipo de producto (y el género, si ya se eligió)
  function storeFor(category, gender, shopOfCategory) {
    if (isClothes(category)) return gender === "hombre" ? "RopaHombre" : "Ropa";
    return shopOfCategory(category);
  }
  // Género fijo por tienda (o por categoría de la oferta)
  var fixedGender = function (shop) { return FIXED_GENDER[shop] || ""; };

  // Normaliza una oferta (idempotente): Ropa + hombre → RopaHombre; RopaHombre siempre es de hombre.
  function normalize(o) {
    if (!o || typeof o !== "object") return o;
    if (o.category === "Ropa" && o.gender === "hombre") o.category = "RopaHombre";
    if (o.category === "RopaHombre" && o.gender !== "hombre") o.gender = "hombre";
    return o;
  }
  // Cambio de género desde el panel: en ropa también cambia de tienda (Ropa Mujer ↔ Ropa Hombre)
  function genderPatch(o, g) {
    var p = { gender: g };
    if (o && isClothes(o.category)) p.category = g === "hombre" ? "RopaHombre" : "Ropa";
    return p;
  }

  // Links de tienda: #s-08 = vitrina 08 (Ropa Hombre). Se siguen aceptando los viejos #s-0…#s-8 y #s-<clave>.
  var linkCode = function (cat) { return SCENE[cat] || ""; };
  function fromLink(code) {
    code = String(code || "");
    if (/^\d\d$/.test(code)) return BY_SCENE[code] || null;
    if (/^\d$/.test(code)) return LEGACY_ORDER[+code] || null;
    return SHOPS[code] ? code : null;
  }
  // Lado del pasillo (01–05 izquierda, 06–10 derecha), como en el render
  var side = function (cat) { var n = +SCENE[cat] || 0; return n && n <= 5 ? "left" : "right"; };

  // Migración idempotente de la base demo (localStorage ps_demo_v5)
  // opt.demo = catálogo demo (demo/catalog.js), opt.make(o, i) = oferta nueva lista para guardar
  var MIN_DEMO = 8;
  var inShop = function (o, k) { return k === LAST ? !!o.last_minute : (SHOPS[k][2] || []).indexOf(o.category) >= 0; };
  function migrateDb(db, opt) {
    if (!db || !Array.isArray(db.offers)) return false;
    opt = opt || {};
    var ch = false;
    db.offers.forEach(function (o) { var c = o.category, g = o.gender; normalize(o); if (o.category !== c || o.gender !== g) ch = true; });
    // cada tienda con al menos 8 productos vigentes: se completa con el catálogo demo (fotos con licencia libre)
    var demo = Array.isArray(opt.demo) ? opt.demo : [];
    if (demo.length && opt.make && db.offers.length) {
      var now = Date.now(), live = function (o) { return o.status === "active" && !o.reserved_for && (!o.expires_at || new Date(o.expires_at).getTime() > now); };
      var titles = {}; db.offers.forEach(function (o) { titles[o.title] = 1; });
      Object.keys(SHOPS).forEach(function (k) {
        var n = db.offers.filter(function (o) { return live(o) && inShop(o, k); }).length;
        demo.forEach(function (d, i) {
          if (n >= MIN_DEMO || titles[d.title]) return;
          var o = normalize(Object.assign({}, d));
          if (!inShop(o, k)) return;
          db.offers.push(opt.make(o, i)); titles[d.title] = 1; n++; ch = true;
        });
      });
    }
    // afiche grande de "Ropa" que apuntaba a una oferta de hombre → pasa a Ropa Hombre (si allá no hay uno)
    var camp = db.settings && db.settings.campaigns;
    if (camp && camp.Ropa && camp.Ropa.offer_id && !camp.RopaHombre) {
      var off = db.offers.find(function (o) { return String(o.id) === String(camp.Ropa.offer_id); });
      if (off && off.category === "RopaHombre") { camp.RopaHombre = camp.Ropa; delete camp.Ropa; ch = true; }
    }
    // destacados (solo la primera vez): si una de las dos tiendas de ropa quedó con más de 4 afiches,
    // los sobrantes pasan adentro de la tienda; el orden (vitrina_pos) se renumera 0…3 sin cambiarlo
    if (db.mig_tiendas10 !== 1) ["Ropa", "RopaHombre"].forEach(function (k) {
      var f = db.offers.filter(function (o) { return o.category === k && o.featured && o.status === "active"; })
        .sort(function (a, b) { return (Number.isFinite(+a.vitrina_pos) && a.vitrina_pos !== null ? +a.vitrina_pos : 99) - (Number.isFinite(+b.vitrina_pos) && b.vitrina_pos !== null ? +b.vitrina_pos : 99); });
      f.forEach(function (o, i) { if (i >= 4) { o.featured = false; o.vitrina_pos = null; ch = true; } else if (o.vitrina_pos !== i) { o.vitrina_pos = i; ch = true; } });
    });
    if (db.mig_tiendas10 !== 1) { db.mig_tiendas10 = 1; ch = true; }
    return ch;
  }

  // Supabase (o cualquier api): normaliza lo que se lee y lo que se publica, aunque la migración SQL no haya corrido
  function wrapApi(api) {
    if (!api || api.__t10) return api;
    var mapList = function (fn) { return function () { return Promise.resolve(fn.apply(api, arguments)).then(function (r) { if (Array.isArray(r)) r.forEach(normalize); return r; }); }; };
    if (api.listOffers) api.listOffers = mapList(api.listOffers);
    if (api.listAllOffers) api.listAllOffers = mapList(api.listAllOffers);
    if (api.getOffer) { var g = api.getOffer; api.getOffer = function () { return Promise.resolve(g.apply(api, arguments)).then(function (o) { return normalize(o); }); }; }
    if (api.createOffer) { var c = api.createOffer; api.createOffer = function (o) { return c.call(api, normalize(Object.assign({}, o))); }; }
    api.__t10 = true;
    return api;
  }

  window.MSTiendas = {
    LAST: LAST, NOMBRE_OFERTAS: NOMBRE_OFERTAS, LISTA: LISTA, SHOPS: SHOPS, SCENE: SCENE, BY_SCENE: BY_SCENE, LEGACY_ORDER: LEGACY_ORDER, FIXED_GENDER: FIXED_GENDER,
    typeCat: typeCat, sameCat: sameCat, isClothes: isClothes, catFor: catFor, storeFor: storeFor, fixedGender: fixedGender,
    normalize: normalize, genderPatch: genderPatch, linkCode: linkCode, fromLink: fromLink, side: side, migrateDb: migrateDb, wrapApi: wrapApi,
  };
})();
