// =====================================================================
// Shoppers Miami — web app (cliente + shopper)
// =====================================================================
const CFG = window.APP_CONFIG || {};
const APP_NAME = CFG.APP_NAME || "Shoppers Miami";
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
document.title = APP_NAME;

const LIBS = {
  supabase: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  transformers: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2",
};

// ---------- Catálogo de categorías ----------
const CATEGORIES = [
  { id: "Carteras",   emoji: "", kg: 1, box: [40, 25, 15],   prompt: "a photo of a handbag or purse" },
  { id: "Zapatos",    emoji: "", kg: 1.2, box: [35, 25, 13],   prompt: "a photo of shoes or sneakers" },
  { id: "Relojes",    emoji: "", kg: 0.4, box: [15, 12, 10],   prompt: "a photo of a wrist watch" },
  { id: "Perfumes",   emoji: "", kg: 0.6, box: [15, 12, 10], prompt: "a photo of a perfume bottle" },
  { id: "Ropa",       emoji: "", kg: 0.5, box: [30, 25, 8],   prompt: "a photo of clothing such as a shirt, dress, jacket or pants" },
  { id: "Lentes",     emoji: "", kg: 0.2, box: [20, 10, 8], prompt: "a photo of sunglasses" },
  { id: "Joyas",      emoji: "", kg: 0.2, box: [15, 10, 8], prompt: "a photo of jewelry such as a necklace, ring or earrings" },
  { id: "Maquillaje", emoji: "", kg: 0.3, box: [15, 12, 8], prompt: "a photo of makeup or cosmetics" },
  { id: "Juguetes",   emoji: "", kg: 1, box: [35, 25, 20],   prompt: "a photo of a toy" },
  { id: "Hogar",      emoji: "", kg: 1.5, box: [40, 30, 25],   prompt: "a photo of home decor or kitchen items" },
  { id: "Electrónica",emoji: "", kg: 0.8, box: [30, 20, 15],   prompt: "a photo of electronics such as headphones or a gadget" },
  { id: "Deportes",   emoji: "", kg: 0.6, box: [35, 28, 8],    prompt: "a photo of sportswear or athletic clothing" },
  { id: "Lenceria",   emoji: "", kg: 0.25, box: [25, 20, 5],   prompt: "a photo of lingerie, underwear, a bra or pajamas" },
  { id: "Invierno",   emoji: "", kg: 1.3, box: [45, 35, 15],   prompt: "a photo of winter clothing such as a coat, puffer jacket, wool sweater, scarf or beanie" },
  { id: "Otros",      emoji: "", kg: 0.5, box: [30, 20, 15],   prompt: "a photo of a product in a store" },
];
// ---------- Base de pesos promedio por tipo de producto ----------
// kg = peso de envío aproximado con su empaque; box = caja típica en cm (largo, ancho, alto)
const PRODUCT_TYPES = [
  ["cartera-grande","Cartera grande o tote","Carteras",1.0,[40,25,15],"a large tote handbag"],
  ["cartera-mediana","Cartera mediana o bandolera","Carteras",0.7,[30,25,12],"a medium shoulder bag or crossbody purse"],
  ["cartera-pequena","Cartera pequeña o clutch","Carteras",0.4,[25,18,8],"a small clutch purse"],
  ["billetera","Billetera","Carteras",0.2,[20,12,5],"a wallet"],
  ["mochila","Mochila","Carteras",0.9,[40,30,15],"a backpack"],
  ["maleta","Maleta de viaje","Carteras",3.5,[56,36,23],"a suitcase or luggage"],
  ["zapatillas","Zapatillas","Zapatos",1.2,[35,24,13],"sneakers or athletic shoes"],
  ["botas","Botas","Zapatos",1.8,[40,30,14],"tall boots"],
  ["botines","Botines","Zapatos",1.4,[35,25,13],"ankle boots"],
  ["zapatos-vestir","Zapatos de vestir o tacos","Zapatos",1.0,[33,22,12],"dress shoes or high heels"],
  ["sandalias","Sandalias o chalas","Zapatos",0.6,[30,20,10],"sandals or flip flops"],
  ["pantuflas","Pantuflas","Zapatos",0.5,[30,20,10],"slippers"],
  ["reloj","Reloj","Relojes",0.4,[15,12,10],"a wrist watch"],
  ["smartwatch","Smartwatch","Relojes",0.4,[15,12,10],"a smartwatch"],
  ["perfume-100","Perfume 100 ml o más","Perfumes",0.6,[15,12,8],"a large perfume bottle in its box"],
  ["perfume-50","Perfume 50 ml o menos","Perfumes",0.35,[12,10,7],"a small perfume bottle"],
  ["perfume-set","Set de regalo de perfume","Perfumes",0.9,[25,20,8],"a perfume gift set"],
  ["body-splash","Body splash o crema corporal","Perfumes",0.4,[25,10,7],"a body mist or body lotion bottle"],
  ["polera","Polera o camiseta","Ropa",0.25,[30,25,4],"a t-shirt"],
  ["camisa","Camisa o blusa","Ropa",0.3,[30,25,5],"a shirt or blouse"],
  ["jeans","Jeans o pantalón","Ropa",0.7,[35,28,6],"jeans or pants"],
  ["vestido","Vestido","Ropa",0.4,[35,28,6],"a dress"],
  ["poleron","Polerón o sweater","Ropa",0.6,[35,28,8],"a hoodie or sweater"],
  ["chaqueta","Chaqueta liviana","Ropa",0.7,[40,30,8],"a light jacket"],
  ["parka","Parka o abrigo","Invierno",1.5,[45,35,15],"a winter coat or puffer jacket"],
  ["abrigo-lana","Abrigo de paño o lana","Invierno",1.6,[50,40,12],"a long wool coat"],
  ["sweater-lana","Sweater de lana o cuello alto","Invierno",0.7,[35,28,8],"a knit wool sweater or turtleneck"],
  ["gorro-bufanda","Gorro, bufanda o guantes","Invierno",0.3,[25,20,8],"a winter beanie, scarf or gloves"],
  ["botas-invierno","Botas de invierno","Invierno",1.8,[40,30,15],"winter boots"],
  ["deportiva","Ropa deportiva (calzas, shorts, top)","Deportes",0.35,[30,25,5],"athletic leggings, sports shorts or a sports bra"],
  ["buzo","Buzo o chaqueta deportiva","Deportes",0.8,[40,30,8],"a tracksuit or athletic jacket"],
  ["bolso-deporte","Bolso deportivo","Deportes",0.9,[50,30,25],"a gym duffel bag"],
  ["ropa-interior","Ropa interior","Lenceria",0.2,[25,20,5],"underwear or panties"],
  ["brasier","Brasier o bralette","Lenceria",0.2,[25,20,6],"a bra or bralette"],
  ["pijama","Pijama o bata","Lenceria",0.5,[30,25,6],"pajamas or a robe"],
  ["body-lenceria","Body o babydoll","Lenceria",0.2,[25,20,5],"a lingerie bodysuit or babydoll"],
  ["ropa-bebe","Ropa de bebé o niño","Ropa",0.3,[25,20,5],"baby or kids clothes"],
  ["traje-bano","Traje de baño","Ropa",0.2,[20,15,5],"a swimsuit"],
  ["lentes","Lentes de sol","Lentes",0.25,[20,10,8],"sunglasses"],
  ["joyas","Joyas o bisutería","Joyas",0.15,[12,10,5],"jewelry such as a necklace, ring or earrings"],
  ["cinturon","Cinturón","Joyas",0.35,[25,15,6],"a leather belt"],
  ["gorro","Gorro o jockey","Joyas",0.2,[30,20,12],"a hat or baseball cap"],
  ["bufanda","Bufanda o pañuelo","Joyas",0.25,[25,20,6],"a scarf"],
  ["maquillaje","Maquillaje (unidad)","Maquillaje",0.15,[12,10,5],"a lipstick or a single makeup product"],
  ["set-maquillaje","Set o paleta de maquillaje","Maquillaje",0.5,[25,18,6],"a makeup palette or makeup set"],
  ["skincare","Crema o skincare","Maquillaje",0.3,[15,10,8],"a skincare cream jar or serum"],
  ["secador","Secador o plancha de pelo","Maquillaje",1.3,[35,20,12],"a hair dryer or hair straightener"],
  ["juguete-pequeno","Juguete pequeño","Juguetes",0.4,[20,15,10],"a small toy"],
  ["juguete-mediano","Juguete mediano","Juguetes",1.2,[35,25,20],"a boxed toy"],
  ["peluche","Peluche","Juguetes",0.5,[35,25,20],"a stuffed animal plush toy"],
  ["bloques","Set de bloques grande","Juguetes",2.0,[48,37,10],"a large building blocks set box"],
  ["sabanas","Sábanas o ropa de cama","Hogar",1.5,[40,30,10],"bed sheets or bedding set"],
  ["toallas","Toallas","Hogar",1.0,[35,25,12],"bath towels"],
  ["cocina","Utensilios de cocina","Hogar",1.5,[35,25,15],"kitchen utensils or cookware"],
  ["decoracion","Decoración pequeña","Hogar",0.8,[25,25,15],"a small home decor item"],
  ["velas","Velas aromáticas","Hogar",0.7,[15,15,12],"a scented candle"],
  ["audifonos","Audífonos","Electrónica",0.5,[20,18,8],"headphones or earbuds"],
  ["parlante","Parlante bluetooth","Electrónica",1.0,[25,15,12],"a bluetooth speaker"],
  ["tablet","Tablet","Electrónica",1.0,[30,22,6],"a tablet"],
  ["celular","Celular","Electrónica",0.5,[18,10,6],"a smartphone box"],
  ["notebook","Notebook","Electrónica",2.5,[45,32,8],"a laptop"],
  ["consola","Consola de videojuegos","Electrónica",3.5,[45,35,12],"a video game console"],
  ["videojuego","Videojuego","Electrónica",0.15,[18,14,2],"a video game case"],
  ["suplementos","Vitaminas o suplementos","Otros",0.5,[15,10,10],"a bottle of vitamins or supplements"],
  ["otro-pequeno","Otro producto pequeño","Otros",0.3,[20,15,10],"a small product"],
  ["otro-mediano","Otro producto mediano","Otros",1.0,[30,25,15],"a medium product in a box"],
  ["otro-grande","Otro producto grande","Otros",3.0,[50,40,30],"a large product in a box"],
].map(([id, name, cat, kg, box, prompt]) => ({ id, name, cat, kg, box, prompt: "a photo of " + prompt }));
const COLORS = [["Negro","#1b1b1f"],["Blanco","#f7f5f0"],["Beige","#d9c3a5"],["Café","#7a4e2d"],["Gris","#8d8f96"],["Azul","#2f5aa8"],["Celeste","#8ec5e8"],["Verde","#3f8a5c"],["Rojo","#c3302f"],["Granate","#7a1f2b"],["Rosado","#f1a3bd"],["Morado","#7b4fa6"],["Amarillo","#f2cf4a"],["Naranjo","#ee8a3b"],["Dorado","#c9a063"],["Plateado","#c7cbd1"],["Multicolor","conic-gradient(#e55,#ec3,#5c7,#39e,#b5e,#e55)"],["Animal print cebra","repeating-linear-gradient(115deg,#f4f1ea 0 3px,#1b1b1f 3px 5px,#f4f1ea 5px 7px,#1b1b1f 7px 10px)"],["Animal print café","radial-gradient(circle at 30% 30%,#3b2414 0 2px,transparent 3px),radial-gradient(circle at 70% 60%,#3b2414 0 2.5px,transparent 3.5px),radial-gradient(circle at 40% 80%,#3b2414 0 1.8px,transparent 2.8px),radial-gradient(circle at 75% 20%,#3b2414 0 1.6px,transparent 2.6px),#c58b4e"],["Monograma","repeating-linear-gradient(45deg,#6b4a2b 0 3px,#c9a063 3px 4px),#6b4a2b"],["Bicolor","linear-gradient(135deg,#1b1b1f 50%,#f7f5f0 50%)"]];
const colorHex = (n) => (COLORS.find((c) => c[0].toLowerCase() === String(n).toLowerCase()) || [0, "#ccc"])[1];
const listOf = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => String(x).trim()).filter(Boolean);
const typeOf = (id) => PRODUCT_TYPES.find((t) => t.id === id) || null;
const typeOptions = (sel) => CATEGORIES.map((c) => `<optgroup label="${c.id}">${PRODUCT_TYPES.filter((t) => t.cat === c.id).map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.name)} · ~${fmtKg(t.kg)} kg</option>`).join("")}</optgroup>`).join("");
// "RopaHombre" (tienda 08) usa los mismos datos de envío que "Ropa": no es una categoría aparte en encargos ni en tipos
const catOf = (id) => CATEGORIES.find((c) => c.id === (id === "RopaHombre" ? "Ropa" : id)) || CATEGORIES[CATEGORIES.length - 1];

const BRANDS = ["Michael Kors","Coach","Kate Spade","Tory Burch","Marc Jacobs","Guess","Calvin Klein","Tommy Hilfiger",
  "Ralph Lauren","Polo Ralph Lauren","Lacoste","Levi's","Nike","Adidas","Puma","New Balance","Reebok","Under Armour","Skechers",
  "Vans","Converse","Steve Madden","Nine West","Anne Klein","DKNY","Vera Bradley","Fossil","Armani Exchange","Hugo Boss",
  "Columbia","The North Face","UGG","Crocs","Carter's","Victoria's Secret","Bath & Body Works","Dolce & Gabbana","Versace",
  "Carolina Herrera","Lancôme","Clinique","Estée Lauder","Ray-Ban","Oakley","Citizen","Casio","Seiko","Timex","Champion","Gap",
  "Old Navy","Banana Republic","Karl Lagerfeld","Juicy Couture","Betsey Johnson","Cole Haan","Sam Edelman","Birkenstock"];
const STORES = ["Burlington","Ross","Marshalls","TJ Maxx","Primark","Nordstrom Rack","Saks Off 5th","Macy's","Sawgrass Mills","Aventura Mall","Dolphin Mall"];

const ORDER_STEPS = [
  // pedido → transferencia → orden de compra (ordenes.js)
  ["pendiente_pago","Pendiente de transferencia"],["comprobante_recibido","Comprobante recibido, en revisión"],["pagado","Pagado - orden de compra emitida"],["comprado","Comprado"],
  ["en_bodega","En bodega Miami"],["enviado","Enviado a Chile"],["entregado","Entregado"],
];
const PKG_STEPS = [["recibido","Recibido en Miami"],["consolidar","Envío solicitado"],["pagado","Envío pagado"],["enviado","Enviado a Chile"],["entregado","Entregado"]];
const label = (steps, s) => (steps.find((x) => x[0] === s) || [s, s === "cancelado" ? "Cancelado" : s])[1];

const DEFAULT_SETTINGS = {
  usd_clp: 1032.65, fl_tax_pct: 7, fee_pct: 25, min_fee_usd: 0,
  ship_usd_per_kg: 10, vol_divisor: 6000, min_charge_kg: 1, fixed_kg: 3, customs_fixed_usd: 2.2, insurance_pct: 0,
  cl_duty_pct: 6, cl_vat_pct: 19,
  locker_address: "[Dirección en Miami]\nMiami, FL [código postal]",
  payment_instructions: "Envía el comprobante por WhatsApp para confirmar tu compra.",
  cashier_name: "Cheryl", cashier_photo: "", bank_name: "Banco Falabella", bank_account_type: "Cuenta corriente", bank_account: "1-999-121238-5", bank_rut: "13.892.047-K", bank_holder: "Jorge Portugueiz", bank_email: "castiblanco.cheryl@gmail.com",
  whatsapp: "+56 9 7687 8239", live_store: null, live_until: null, mall_name: "Aventura Mall", store_photos: {}, mall_photos: [],
};

// ---------- Utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const clp = (n) => "$" + Math.round(n || 0).toLocaleString("es-CL");
const usd = (n) => "US$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
const TZ_CL = "America/Santiago", TZ_MIA = "America/New_York";
const hora = (iso, tz) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: tz });
function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 2) return "Recién"; if (m < 60) return `Hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.round(h / 24)} d`;
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600); }
function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("No se pudo cargar " + src)); document.head.appendChild(s); }); }

const fmtKg = (k) => Number(k).toLocaleString("es-CL", { maximumFractionDigits: 2 });
const fmtPct = (p) => Number(p).toLocaleString("es-CL", { maximumFractionDigits: 1 });
const withDiscount = (tag, pct) => Math.round(tag * (1 - (pct || 0) / 100) * 100) / 100;
// Descuento sobre descuento: primero el % de la etiqueta y, sobre ese total, el % extra (ej. 30% + 20% = 44% en total)
const stackPct = (d1, d2) => Math.round((1 - (1 - (Number(d1) || 0) / 100) * (1 - (Number(d2) || 0) / 100)) * 1000) / 10;
const withDiscount2 = (tag, d1, d2) => Math.round(tag * (1 - (Number(d1) || 0) / 100) * (1 - (Number(d2) || 0) / 100) * 100) / 100;
// Stickers de descuento: uno con el % de la etiqueta y, si hay descuento sobre descuento, un segundo "−20% extra" encima
const discBadges = (o, cls, pre = "", post = "") => { const d = discOf(o); if (!d) return ""; return d.d1 > 0 && d.d2 > 0
  ? `<span class="${cls}">${pre}−${fmtPct(d.d1)}%${post}</span><span class="${cls} dx2">−${fmtPct(d.d2)}% extra</span>` : `<span class="${cls}">${pre}−${fmtPct(d.pct)}%${post}</span>`; };
const discOf = (o) => (o.discount_pct > 0 && o.tag_price_usd > 0 ? { tag: Number(o.tag_price_usd), pct: Number(o.discount_pct), d1: Number(o.discount1_pct) || 0, d2: Number(o.discount2_pct) || 0 } : null);

// Peso cobrable por el courier: el mayor entre el peso real y el volumétrico (largo×ancho×alto / divisor)
const kgOf = (o) => Number(o?.weight_kg) || (Number(o?.weight_lb) ? Number(o.weight_lb) / 2.20462 : catOf(o?.category).kg);
const boxOf = (o) => (o?.box_l && o?.box_w && o?.box_h ? [Number(o.box_l), Number(o.box_w), Number(o.box_h)] : catOf(o?.category).box);
function chargeKg(kg, box, s) {
  s = s || state.settings;
  const vol = box && box.every((x) => x > 0) ? (box[0] * box[1] * box[2]) / (Number(s.vol_divisor) || 6000) : 0;
  const fixed = Number(s.fixed_kg) || 0;            // peso volumétrico fijo por producto (Ajustes; 0 = medir cada uno)
  if (fixed > 0) return { real: Number(kg) || 0, vol, charge: fixed, byVolume: true, fixed: true };
  const charge = Math.max(Number(kg) || 0, vol, Number(s.min_charge_kg) || 0);
  return { real: Number(kg) || 0, vol, charge, byVolume: vol > (Number(kg) || 0) };
}
function shipping(declaredUsd, kg, box, s) {
  s = s || state.settings;
  const w = chargeKg(kg, box, s);
  const ship = w.charge * s.ship_usd_per_kg;
  const cif = declaredUsd + ship + declaredUsd * (Number(s.insurance_pct) || 0) / 100;
  const duty = cif * s.cl_duty_pct / 100;
  const vat = (cif + duty) * s.cl_vat_pct / 100;
  const fixed = Number(s.customs_fixed_usd) || 0;
  return { w, ship, duty, vat, fixed, customs: duty + vat + fixed };
}
// Precio puesto en Chile. item = { weight_kg, box_l, box_w, box_h, category } (lo que falte sale de la categoría)
function quote(priceUsd, item, s) {
  s = s || state.settings;
  const price = Number(priceUsd) || 0;
  const tax = price * s.fl_tax_pct / 100;
  const fee = Math.max(Number(s.min_fee_usd) || 0, price * s.fee_pct / 100);
  const sh = shipping(price + tax, kgOf(item), boxOf(item), s);
  const total = price + tax + fee + sh.ship + sh.customs;
  return { price, tax, fee, ...sh, total, clp: Math.ceil(total * s.usd_clp / 100) * 100 };
}
function quoteHTML(q, d) {
  const disc = d && d.pct > 0 && d.tag > 0;
  return `<div class="quote">
    ${disc ? `<div class="ln"><span>Precio etiqueta</span><span>${usd(d.tag)}</span></div>
    ${d.d1 > 0 && d.d2 > 0 ? `<div class="ln" style="color:#0e6b4c"><span>Descuento (${fmtPct(d.d1)}%)</span><span>−${usd(d.tag - withDiscount(d.tag, d.d1))}</span></div>
    <div class="ln" style="color:#0e6b4c"><span>Descuento extra sobre el anterior (${fmtPct(d.d2)}%)</span><span>−${usd(withDiscount(d.tag, d.d1) - q.price)}</span></div>
    <div class="ln small muted"><span>Ahorro total</span><span>${fmtPct(d.pct)}%</span></div>`
    : `<div class="ln" style="color:#0e6b4c"><span>Descuento (${fmtPct(d.pct)}%)</span><span>−${usd(d.tag - q.price)}</span></div>`}` : ""}
    <div class="ln"><span>${disc ? "Precio final en tienda" : "Precio en tienda"}</span><span>${usd(q.price)}</span></div>
    <div class="ln"><span>Impuesto Florida (${state.settings.fl_tax_pct}%)</span><span>${usd(q.tax)}</span></div>
    <div class="ln"><span>Servicio personal shopper (${fmtPct(state.settings.fee_pct)}%)</span><span>${usd(q.fee)}</span></div>
    <div class="ln"><span>Transporte a Chile <span class="small muted">(${fmtKg(q.w.charge)} kg${q.w.byVolume ? " por volumen" : ""})</span></span><span>${usd(q.ship)}</span></div>
    <div class="ln"><span>Aduana <span class="small muted">(arancel ${state.settings.cl_duty_pct}% + IVA ${state.settings.cl_vat_pct}% + gastos)</span></span><span>${usd(q.customs)}</span></div>
    <div class="ln tot"><span>Total puesto en Chile</span><span class="big">${clp(q.clp)}</span></div>
    <div class="small muted">≈ ${usd(q.total)} · ${fxNote()} · valores estimados</div>
  </div>`;
}

// Fotos: reducir tamaño antes de subir
async function resizeImage(file, max = 1200, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, "image/jpeg", quality));
  } finally { URL.revokeObjectURL(url); }
}
// Comprobante de transferencia: foto (JPG/PNG/captura) reducida a ~1600 px JPEG 0,8; o PDF tal cual (con tope de peso)
const isPdfFile = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
async function prepareReceipt(file, local) {
  if (isPdfFile(file)) {
    const max = local ? 1.5e6 : 10e6;
    if (file.size > max) throw new Error(`El PDF pesa más de ${local ? "1,5" : "10"} MB. Envía una captura de pantalla del comprobante.`);
    return file.type === "application/pdf" ? file : new Blob([file], { type: "application/pdf" });
  }
  let out;
  try { out = await resizeImage(file, 1600, 0.8); } catch { throw new Error("No pudimos leer esa imagen. Sube una captura en JPG o PNG."); }
  if (!out) throw new Error("No pudimos leer esa imagen. Sube una captura en JPG o PNG.");
  if (local && out.size > 450e3) out = await resizeImage(file, 1280, 0.72);   // el modo demo guarda en el teléfono: cuidar el espacio
  return out;
}
const isPdfRef = (u) => /^data:application\/pdf/i.test(u || "") || /\.pdf(\?|#|$)/i.test(u || "");
// data: no se puede abrir en otra pestaña (Chrome lo bloquea): se convierte en blob: para "ver en tamaño completo"
async function openableUrl(u) { if (!/^data:/i.test(u || "")) return u; try { return URL.createObjectURL(await (await fetch(u)).blob()); } catch { return u; } }
const blobToDataURL = (b) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });

// =====================================================================
// Reconocimiento de fotos (gratis, corre en el teléfono)
// =====================================================================
function withTimeout(p, ms, msg) {
  let t; return Promise.race([p, new Promise((_, ko) => (t = setTimeout(() => ko(new Error(msg || "Tardó demasiado")), ms)))]).finally(() => clearTimeout(t));
}
async function reachable(url, ms = 5000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: "no-store" }); return r.ok; } catch { return false; } finally { clearTimeout(t); }
}
const vision = {
  _ocr: null, _clip: null, _avail: null,
  // OCR: siempre local (vision/price.js + vendor/tesseract, funciona sin internet).
  // CLIP (tipo de producto): se baja de jsdelivr/Hugging Face la 1ª vez y queda guardado
  // (sw.js + caché propia de transformers.js), así que después también funciona sin señal.
  available() {
    if (!this._avail) this._avail = (async () => {
      const ocr = typeof Worker !== "undefined" && typeof WebAssembly === "object";
      let clip = await reachable("https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/config.json");
      if (!clip) try { clip = (await (await caches.open("transformers-cache")).keys()).some((k) => k.url.includes("clip-vit-base-patch32")); } catch {}
      return { ocr, clip };
    })();
    return this._avail;
  },
  // Lee la etiqueta: {price, compareAt, extraPct, prices, text}
  async readTag(src, onStatus) {
    if (!this._ocr) { this._ocr = import("./vision/price.js"); this._ocr.catch(() => (this._ocr = null)); }
    const mod = await withTimeout(this._ocr, 20000, "El lector de etiquetas no cargó");
    return await withTimeout(mod.readPriceTag(src, { onStatus }), 90000, "Leer la etiqueta tardó demasiado");
  },
  async ocr(blob, onStatus) { return (await this.readTag(blob, onStatus)).text || ""; },
  // Pide al service worker guardar el lector para usarlo sin internet
  warm() { try { navigator.serviceWorker?.ready.then((r) => r.active?.postMessage("ms-precache-vision")); } catch {} },
  async classify(blob, onStatus) {
    if (!this._clip) {
      onStatus?.("Descargando reconocedor de productos (solo la primera vez)…");
      let last = Date.now(), timer;
      const stalled = new Promise((_, ko) => { timer = setInterval(() => { if (Date.now() - last > 30000) ko(new Error("La descarga del reconocedor se detuvo")); }, 2000); });
      this._clip = (async () => {
        const T = await import(LIBS.transformers);
        return await T.pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", {
          progress_callback: (p) => { last = Date.now(); if (p.status === "progress" && p.total) onStatus?.(`Descargando reconocedor… ${Math.round((p.loaded / p.total) * 100)}%`); },
        });
      })();
      try { await Promise.race([this._clip, stalled]); } catch (e) { this._clip = null; throw e; } finally { clearInterval(timer); }
    }
    const clip = await this._clip;
    onStatus?.("Reconociendo el producto…");
    const url = URL.createObjectURL(blob);
    try {
      const out = await withTimeout(clip(url, PRODUCT_TYPES.map((t) => t.prompt)), 45000, "Reconocer tardó demasiado");
      const types = out.slice(0, 3).map((o) => PRODUCT_TYPES.find((t) => t.prompt === o.label)).filter(Boolean);
      return { types: types.map((t) => t.id), category: types[0]?.cat || "Otros" };
    } finally { URL.revokeObjectURL(url); }
  },
};
// En la vista previa de Claude: leer la foto pidiéndoselo a Claude (solo para la demo)
async function claudeVision(blob, onStatus) {
  if (!window.claude || typeof window.claude.use !== "function") return null;
  const sample = await window.claude.use("sample");
  if (!sample) return null;
  try { const lim = await sample.limits?.(); if (lim && !lim.images) return null; } catch {}
  onStatus?.("Leyendo la foto con IA…");
  const typeList = PRODUCT_TYPES.map((t) => `${t.id} (${t.name})`).join("; ");
  const v = await sample.json(`Eres el asistente de una personal shopper en Miami. Mira la foto de un producto en una tienda, con su etiqueta de precio.
Responde SOLO un objeto JSON con estas claves:
- "type": el id del tipo de producto que mejor calza, de esta lista: ${typeList}
- "alt_types": hasta 2 ids alternativos de la misma lista
- "brand": la marca si se ve (en la etiqueta o el producto), o "" si no
- "title": nombre corto del producto en español de Chile, por ejemplo "Cartera tote negra" (sin la marca)
- "prices": lista de todos los precios en dólares que aparezcan en la etiqueta, como números
- "price": el precio de venta actual (normalmente el más bajo, no el "compare at"), como número, o null
- "colors": lista de colores visibles del producto, usando solo estos nombres: ${COLORS.map((c) => c[0]).join(", ")}
- "card_found": true si junto al producto hay una tarjeta del tamaño de una tarjeta de crédito (8,56 × 5,4 cm)
- "width_cm", "height_cm": si hay tarjeta, ancho y alto del producto en cm usando la tarjeta como escala; si no, null`, { images: [blob], modelTier: "quick" });
  return v && typeof v === "object" ? v : null;
}
const CARD_LONG_CM = 8.56, CARD_SHORT_CM = 5.398; // tarjeta tamaño crédito/débito (ISO ID-1)
async function claudeMeasure(blob) {
  if (!window.claude || typeof window.claude.use !== "function") return null;
  const sample = await window.claude.use("sample"); if (!sample) return null;
  const v = await sample.json(`En la foto hay un producto y, pegada a él, una tarjeta del tamaño de una tarjeta de crédito (8,56 × 5,4 cm).
Usa la tarjeta como escala y estima las medidas del producto. Responde SOLO un objeto JSON:
{"card_found": true/false, "width_cm": número o null, "height_cm": número o null}`, { images: [blob], modelTier: "default" });
  return v && typeof v === "object" ? v : null;
}
async function urlToBlob(url) {
  const img = await new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = ko; i.src = url; });
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d").drawImage(img, 0, 0);
  return await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
}
const photosOf = (o) => [...(o.photo_url ? [{ url: o.photo_url, caption: "" }] : []), ...(Array.isArray(o.photos) ? o.photos : [])].filter((p) => p && p.url);
const roundCm = (v) => Math.round(v * 2) / 2;
const sizeText = (o) => o.size_w_cm && o.size_h_cm ? `${fmtKg(o.size_w_cm)} × ${fmtKg(o.size_h_cm)}${o.size_d_cm ? " × " + fmtKg(o.size_d_cm) : ""} cm` : "";
function extractPrices(text) {
  const found = new Set();
  const re = /\$?\s?(\d{1,4})\s?[.,]\s?(\d{2})(?!\d)/g; let m;
  while ((m = re.exec(text))) { const v = parseFloat(m[1] + "." + m[2]); if (v >= 1 && v < 5000) found.add(v); }
  const re2 = /\$\s?(\d{1,4})(?![\d.,])/g;
  while ((m = re2.exec(text))) { const v = parseFloat(m[1]); if (v >= 1 && v < 5000) found.add(v); }
  return [...found].sort((a, b) => a - b);
}
function detectBrand(text) {
  const norm = (s) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "");
  const t = norm(text);
  const hits = BRANDS.filter((b) => t.includes(norm(b))).sort((a, b) => b.length - a.length);
  return hits[0] || "";
}

// =====================================================================
// Capa de datos: Supabase (real) o localStorage (demo)
// =====================================================================
// La base demo vive en IndexedDB (cientos de MB) y no solo en localStorage (5 MB, se llenaba con las fotos).
// localStorage guarda una copia mientras quepa (y la marca "ps_demo_store"); si no cabe, queda solo en IndexedDB.
const DEMO_IDB = { name: "shoppers_demo", store: "kv", key: "ps_demo_v5" };
function idbOpen() {
  return new Promise((res, rej) => { try { const r = indexedDB.open(DEMO_IDB.name, 1); r.onupgradeneeded = () => r.result.createObjectStore(DEMO_IDB.store); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
}
async function idbGet() {
  const d = await idbOpen();
  return new Promise((res) => { const q = d.transaction(DEMO_IDB.store).objectStore(DEMO_IDB.store).get(DEMO_IDB.key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
}
async function idbPut(v) {
  const d = await idbOpen();
  return new Promise((res, rej) => { const t = d.transaction(DEMO_IDB.store, "readwrite"); t.objectStore(DEMO_IDB.store).put(v, DEMO_IDB.key); t.oncomplete = () => res(true); t.onerror = t.onabort = () => rej(t.error); });
}
async function preloadDemoDb() {
  let ls = null; try { ls = JSON.parse(localStorage.getItem(DEMO_IDB.key)); } catch {}
  let idb = null;
  if (localStorage.getItem("ps_demo_store") === "idb") { try { idb = await idbGet(); } catch (e) { console.warn(e); } }
  else { try { idbPut(null); } catch {} }   // sin marca = datos borrados a propósito: no revivir lo viejo
  if (idb && (!ls || (Number(idb._ts) || 0) > (Number(ls._ts) || 0))) return idb;
  return ls;
}
function makeLocalApi(pre) {
  const KEY = "ps_demo_v5";
  const now = () => new Date().toISOString();
  const later = (h) => new Date(Date.now() + h * 3600e3).toISOString();
  let db;
  if (pre !== undefined) db = pre; else try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) {
    const shop = { id: "shopper-1", full_name: "Tu amiga (shopper)", phone: "", role: "shopper", locker_code: "CL1001", email: "shopper@demo" };
    const cli = { id: "client-1", full_name: "Clienta Demo", phone: "+56 9 1234 5678", role: "client", locker_code: "CL1002", email: "cliente@demo" };
    const mk = (title, brand, category, price, store, h, extra = {}) => ({ id: uid(), shopper_id: shop.id, title, brand, category, price_usd: price, store, photo_url: null, photos: [], colors: [], sizes: [], last_minute: false, featured: false, status: "active", expires_at: later(48 - h), created_at: new Date(Date.now() - h * 3600e3).toISOString(), ...extra });
    // Catálogo demo con fotos reales (demo/catalog.js), si está cargado; si no, la lista fija de abajo.
    const demoCat = Array.isArray(window.DEMO_CATALOG) && window.DEMO_CATALOG.length ? window.DEMO_CATALOG : null;
    const demoOffers = demoCat && demoCat.map((o, i) => mk(o.title, o.brand, o.category, o.price_usd, o.store, Math.round(((i * 37) % demoCat.length) / demoCat.length * 300) / 10, { ...o, photos: Array.isArray(o.photos) ? o.photos : [] }));
    db = {
      me: "client-1", profiles: [shop, cli], settings: { ...DEFAULT_SETTINGS },
      offers: demoOffers || [
        mk("Cartera tote Jet Set", "Michael Kors", "Carteras", 49.99, "Burlington", 1, { colors: ["Negro", "Café", "Beige"] }),
        mk("Bandolera Willow", "Coach", "Carteras", 89.99, "Marshalls", 4, { colors: ["Negro", "Rosado"], tag_price_usd: 112.49, discount_pct: 20 }),
        mk("Billetera Signature", "Guess", "Carteras", 19.99, "Ross", 7, { colors: ["Café"] }),
        mk("Zapatillas Ultraboost", "Adidas", "Zapatos", 59.99, "Ross", 3, { colors: ["Negro", "Blanco"], sizes: ["37", "38", "39", "40", "41"] }),
        mk("Calzas Align 7/8", "Lululemon", "Deportes", 39.99, "Nordstrom Rack", 2, { colors: ["Negro", "Verde", "Morado"], sizes: ["XS", "S", "M", "L"], promo: "2x1" }),
        mk("Buzo Tech Fleece", "Nike", "Deportes", 69.99, "Marshalls", 5, { colors: ["Gris", "Negro"], sizes: ["S", "M", "L", "XL"], last_minute: true, tag_price_usd: 99.99, discount_pct: 30 }),
        mk("Reloj cronógrafo acero", "Fossil", "Relojes", 39.99, "Marshalls", 5, { colors: ["Plateado"] }),
        mk("Perfume Good Girl 80 ml", "Carolina Herrera", "Perfumes", 64.99, "TJ Maxx", 2, { last_minute: true }),
        mk("Polerón con capucha", "Tommy Hilfiger", "Ropa", 24.99, "Burlington", 6, { colors: ["Azul", "Blanco"], sizes: ["S", "M", "L"] }),
        mk("Set brasier y calzón de encaje", "Calvin Klein", "Lenceria", 29.99, "Macy's", 3, { colors: ["Negro", "Rosado", "Beige"], sizes: ["S", "M", "L"] }),
        mk("Pijama de satín", "Victoria's Secret", "Lenceria", 34.99, "Victoria's Secret", 4, { colors: ["Rosado", "Negro"], sizes: ["XS", "S", "M"], promo: "2x1" }),
        mk("Parka acolchada", "The North Face", "Invierno", 119.99, "Nordstrom Rack", 2, { colors: ["Negro", "Beige"], sizes: ["S", "M", "L"], tag_price_usd: 199.99, discount_pct: 40 }),
        mk("Sweater de lana cuello alto", "Ralph Lauren", "Invierno", 49.99, "Marshalls", 6, { colors: ["Gris", "Beige", "Negro"], sizes: ["S", "M", "L"] }),
        mk("Aros de plata", "Pandora", "Joyas", 34.99, "Macy's", 5, { colors: ["Plateado"] }),
        mk("Lentes de sol aviador", "Ray-Ban", "Lentes", 89.99, "Sunglass Hut", 3, { colors: ["Dorado"], tag_price_usd: 149.99, discount_pct: 40 }),
      ],
      searches: [], orders: [], packages: [], notifications: [], groups: [],
    };
  }
  if (!db.groups) db.groups = [];
  // Migración (idempotente) a catálogo Mujer / Hombre: género en cada oferta + productos demo nuevos para cada catálogo
  if (!db.mig_gender) {
    const demo = Array.isArray(window.DEMO_CATALOG) ? window.DEMO_CATALOG : [];
    const byTitle = new Map(demo.map((o) => [o.title, o]));
    db.offers.forEach((o) => { if (!["mujer", "hombre", "unisex"].includes(o.gender)) o.gender = ["Lenceria", "Carteras"].includes(o.category) ? "mujer" : byTitle.get(o.title)?.gender || "unisex"; });
    const had = new Set(db.offers.map((o) => o.title)), shopId = (db.profiles.find((p) => p.role === "shopper") || {}).id || "shopper-1";
    demo.forEach((o, i) => { if (had.has(o.title) || !o.gender || db.offers.length === 0) return; db.offers.push({ id: uid(), shopper_id: shopId, photo_url: null, photos: [], colors: [], sizes: [], last_minute: false, featured: false, status: "active", expires_at: later(40 - (i % 7)), created_at: new Date(Date.now() - ((i * 37) % 300) / 10 * 3600e3).toISOString(), ...o, photos: Array.isArray(o.photos) ? o.photos : [] }); });
    db.mig_gender = 1;
  }
  db.offers.forEach((o) => { if (["Lenceria", "Carteras"].includes(o.category)) o.gender = "mujer"; else if (!o.gender) o.gender = "unisex"; });
  // 10 tiendas (tiendas.js), idempotente: Ropa + hombre → Ropa Hombre; cada tienda con al menos 8 productos demo
  TIENDAS.migrateDb(db, { demo: window.DEMO_CATALOG, make: (o, i) => ({ id: uid(), shopper_id: (db.profiles.find((p) => p.role === "shopper") || {}).id || "shopper-1", photo_url: null, colors: [], sizes: [], last_minute: false, featured: false, status: "active", expires_at: later(40 - (i % 7)), created_at: new Date(Date.now() - ((i * 37) % 300) / 10 * 3600e3).toISOString(), ...o, photos: Array.isArray(o.photos) ? o.photos : [] }) });
  // datos reales de transferencia (reemplazan los de ejemplo de versiones anteriores; si Cheryl ya los cambió, se respetan)
  if (db.settings.bank_name == null || db.settings.bank_name === "" || db.settings.bank_name === "Banco (ejemplo)") Object.assign(db.settings, { cashier_name: db.settings.cashier_name || "Cheryl", bank_name: "Banco Falabella", bank_account_type: "Cuenta corriente", bank_account: "1-999-121238-5", bank_rut: "13.892.047-K", bank_holder: "Jorge Portugueiz", bank_email: "castiblanco.cheryl@gmail.com", whatsapp: db.settings.whatsapp || "+56 9 7687 8239" });
  // WhatsApp real de Cheryl (reemplaza el número de ejemplo de versiones anteriores)
  if (!db.settings.whatsapp || /305\s*555\s*0100/.test(db.settings.whatsapp)) db.settings.whatsapp = "+56 9 7687 8239";
  if (db.settings.fee_pct === 15 && db.settings.min_fee_usd === 10) { db.settings.fee_pct = 20; db.settings.min_fee_usd = 0; }
  // Comisión nueva: 25 % (una sola vez; si después Cheryl la cambia en Ajustes, se respeta)
  if (db.settings.fixed_kg == null) db.settings.fixed_kg = 3;   // nov-2026: 3 kg volumétricos por producto
  if (!db.settings.fee_v25) { if (db.settings.fee_pct === 20 || db.settings.fee_pct === 15) db.settings.fee_pct = 25; db.settings.fee_v25 = true; }
  if (db.settings.ship_usd_per_kg == null) { const { usd_clp, ...rest } = DEFAULT_SETTINGS; Object.assign(db.settings, { ...rest, ...db.settings, ship_usd_per_kg: 10, vol_divisor: 6000, min_charge_kg: 1, customs_fixed_usd: 2.2, insurance_pct: 0 }); if (db.settings.usd_clp === 950) db.settings.usd_clp = 1032.65; delete db.settings.shipping_usd_per_lb; }
  let idbBusy = false, idbAgain = false, idbOk = typeof indexedDB !== "undefined", lsStale = false;
  const flushIdb = async () => {
    if (idbBusy) { idbAgain = true; return; }
    idbBusy = true;
    try { do { idbAgain = false; await idbPut(db); } while (idbAgain); localStorage.setItem("ps_demo_store", "idb"); if (lsStale) try { localStorage.removeItem(KEY); } catch {} }
    catch (e) { console.warn(e); idbOk = false; toast("No pude guardar en el teléfono: libera espacio en el teléfono."); }
    idbBusy = false;
  };
  const save = () => {
    db._ts = Date.now();
    let inLs = false;
    try { localStorage.setItem(KEY, JSON.stringify(db)); inLs = true; lsStale = false; } catch (e) { lsStale = true; }   // no cabe: queda solo en IndexedDB (la copia vieja se borra cuando IndexedDB confirma)
    if (idbOk) { flushIdb(); return true; }
    if (!inLs) toast("Memoria del teléfono llena: borra ofertas antiguas.");
    return inLs;
  };
  save();
  window.MSFinanzas?.attachLocal(db, save, { quote, quote2x1, settings: db.settings });   // centro financiero (finanzas.js): ventas manuales + semilla demo
  window.MSClientes?.attachLocal(db, save);   // fichas de clientas (clientes.js): semilla + enlace de pedidos, idempotente
  window.MSEncargos?.attachLocal(db, save);   // encargos (encargos.js): estados nuevos + 3 encargos demo, idempotente
  window.MSCampanas?.attachLocal(db, save);   // afiche grande de cada tienda (campanas.js): settings.campaigns + 3 demo, idempotente
  const me = () => db.profiles.find((p) => p.id === db.me);
  const isShop = () => me()?.role === "shopper";
  // avisos para la shopper (pedido nuevo, comprobante, encargo nuevo)
  const notifyShop = (message) => db.profiles.filter((p) => p.role === "shopper").forEach((p) => db.notifications.push({ id: uid(), user_id: p.id, message, read: false, created_at: now() }));
  const withClient = (r) => ({ ...r, client: db.profiles.find((p) => p.id === r.client_id) || null });
  const api = {
    demo: true,
    async session() { return { user: { id: db.me, email: me().email }, profile: me() }; },
    async switchRole(role) { db.me = role === "shopper" ? "shopper-1" : "client-1"; save(); },
    async signOut() {},
    async updateProfile(p) { Object.assign(me(), p); save(); return me(); },
    async getSettings() { return db.settings; },
    async saveSettings(p) { Object.assign(db.settings, p); save(); return db.settings; },
    // ofertas reservadas para una clienta (encargo encontrado): nunca en las listas públicas, solo por su link (getOffer)
    async listOffers() { return db.offers.filter((o) => o.status === "active" && !o.reserved_for && new Date(o.expires_at) > new Date()).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async listAllOffers() { return [...db.offers].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200); },
    async uploadPhoto(blob) { const small = await resizeImage(blob, 600, 0.7); return await blobToDataURL(small); },
    async createOffer(o) {
      const offer = { id: uid(), shopper_id: db.me, status: "active", expires_at: later(48), created_at: now(), ...o };
      if (["Lenceria", "Carteras"].includes(offer.category) || !["mujer", "hombre", "unisex"].includes(offer.gender)) offer.gender = ["Lenceria", "Carteras"].includes(offer.category) ? "mujer" : "unisex";
      db.offers.push(offer);
      let n = 0;
      if (offer.reserved_for) {                      // encontrado para una clienta: solo ella recibe el aviso
        db.notifications.push({ id: uid(), user_id: offer.reserved_for, message: `¡${db.settings.cashier_name || "Cheryl"} encontró tu encargo! ${offer.title}`, offer_id: offer.id, read: false, created_at: now() });
        save(); return { offer, matches: 0 };
      }
      for (const s of db.searches) {
        const brandOk = !s.brand || (offer.brand || "").toLowerCase().includes(s.brand.toLowerCase()) || offer.title.toLowerCase().includes(s.brand.toLowerCase());
        if (s.status === "pendiente" && s.id !== offer.request_id && new Date(s.expires_at) > new Date() && TIENDAS.sameCat(s.category, offer.category) && brandOk && (s.max_price_usd == null || offer.price_usd <= s.max_price_usd)) {
          db.notifications.push({ id: uid(), user_id: s.client_id, message: `¡Encontramos algo para tu búsqueda! ${offer.title} a US$${offer.price_usd}`, offer_id: offer.id, read: false, created_at: now() }); n++;
        }
      }
      save(); return { offer, matches: n };
    },
    async updateOffer(id, p) { const o = db.offers.find((x) => x.id === id); Object.assign(o, p); if (["Lenceria", "Carteras"].includes(o.category)) o.gender = "mujer"; save(); },
    async deleteOffer(id) { db.offers = db.offers.filter((o) => o.id !== id); db.notifications = (db.notifications || []).filter((n) => n.offer_id !== id); (db.orders || []).forEach((r) => { if (r.offer_id === id) r.offer_id = null; }); save(); },
    async deleteOffers(ids) { const k = new Set(ids.map(String)); db.offers = db.offers.filter((o) => !k.has(String(o.id))); db.notifications = (db.notifications || []).filter((n) => !k.has(String(n.offer_id))); (db.orders || []).forEach((r) => { if (k.has(String(r.offer_id))) r.offer_id = null; }); save(); },
    // cada encargo trae su oferta encontrada (offer_id), si la hay
    async listSearches() { return db.searches.filter((s) => isShop() || s.client_id === db.me).map((s) => ({ ...withClient(s), offer: (s.offer_id && db.offers.find((o) => o.id === s.offer_id)) || null })).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async createSearch(s) { db.searches.push({ id: uid(), client_id: db.me, status: "pendiente", offer_id: null, notified_at: null, expires_at: later(24 * 30), created_at: now(), ...s }); if (!isShop()) notifyShop(`Nuevo encargo de ${me()?.full_name || "una clienta"}: ${[s.category, s.brand].filter(Boolean).join(" · ")}${s.max_price_usd ? " hasta US$" + s.max_price_usd : ""}`); save(); },
    async updateSearch(id, p) { Object.assign(db.searches.find((s) => s.id === id), p); save(); },
    async listOrders() { return db.orders.filter((o) => isShop() || o.client_id === db.me).map(withClient).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async createOrder(o) {
      const first = !o.order_code || !db.orders.some((x) => x.order_code === o.order_code);
      const row = { id: uid(), client_id: db.me, status: "pendiente_pago", created_at: now(), ...o };
      // ¿compra lo que Cheryl encontró para su encargo? → el encargo pasa a "comprado"
      const s = o.offer_id && db.searches.find((x) => x.offer_id === o.offer_id && x.client_id === db.me && ["encontrado", "avisado"].includes(x.status));
      if (s) { Object.assign(s, { status: "comprado", purchased_at: now(), order_code: o.order_code || null }); row.search_id = s.id; notifyShop(`${me()?.full_name || "Una clienta"} compró lo que encontraste para su encargo`); }
      db.orders.push(row);
      if (first && !isShop()) notifyShop(`Nueva orden ${o.order_code || ""} de ${me()?.full_name || "una clienta"}`.replace("  ", " ")); save();
    },
    async updateOrder(id, p) { Object.assign(db.orders.find((o) => o.id === id), p); save(); },
    async listPackages() { return db.packages.filter((p) => isShop() || p.client_id === db.me).map(withClient).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async registerPackage(p) {
      const c = db.profiles.find((x) => x.locker_code.toUpperCase() === p.locker.trim().toUpperCase());
      if (!c) throw new Error("No existe el casillero " + p.locker);
      db.packages.push({ id: uid(), client_id: c.id, description: p.description, store: p.store, tracking: p.tracking, weight_kg: p.weight_kg, box_l: p.box_l, box_w: p.box_w, box_h: p.box_h, declared_usd: p.declared_usd, photo_url: p.photo_url, status: "recibido", created_at: now() });
      db.notifications.push({ id: uid(), user_id: c.id, message: "Llegó un paquete a tu casilla: " + p.description, read: false, created_at: now() });
      save();
    },
    async updatePackage(id, p) { Object.assign(db.packages.find((x) => x.id === id), p); save(); },
    async listNotifications() { return db.notifications.filter((n) => n.user_id === db.me).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async markAllRead() { db.notifications.forEach((n) => { if (n.user_id === db.me) n.read = true; }); save(); },
    async getOffer(id) { return db.offers.find((o) => o.id === id) || null; },
    async createGroup(g) { const grp = { id: uid(), host_id: db.me, members: [], created_at: now(), ...g }; db.groups.push(grp); save(); return grp; },
    async uploadReceipt(blob) { return await blobToDataURL(await prepareReceipt(blob, true)); },   // demo: queda en este teléfono (cuidando el espacio)
    async attachReceipt(code, path) {
      const rows = db.orders.filter((o) => o.order_code === code && (isShop() || o.client_id === db.me)), old = rows.map((o) => o.receipt_path);
      rows.forEach((o) => (o.receipt_path = path));
      if (!save()) { rows.forEach((o, i) => (o.receipt_path = old[i])); throw new Error("No hay espacio en el teléfono para guardar el comprobante. Envíalo por WhatsApp."); }
      if (!isShop()) notifyShop("Llegó un comprobante de transferencia para la orden " + code); save();
    },
    async receiptUrl(path) { return path; },
    async getGroup(id) { return db.groups.find((g) => g.id === id) || null; },
    async joinGroup(id, m) { const g = db.groups.find((x) => x.id === id); if (!g) throw new Error("Esta compra compartida ya no existe"); if (!g.members.some((x) => x.user_id === db.me)) g.members.push({ user_id: db.me, ...m, joined_at: now() }); save(); return g; },
  };
  window.MSOrdenes?.extendLocal(api, db, save);   // ordenes.js: comprobante → "comprobante_recibido", aprobar pago y N° OC
  // cuentas.js: cuentas demo (correo + contraseña con hash), sesión, invitada y cerrar sesión
  return window.MSCuentas ? window.MSCuentas.extendLocal(api, db, save) : api;
}

async function makeSupabaseApi() {
  const { createClient } = await import(LIBS.supabase);
  const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const CLIENT = "*, client:profiles!client_id(full_name, phone, locker_code)";
  let profile = null;
  const api = {
    demo: false, sb,
    async session() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      profile = ok(await sb.from("profiles").select("*").eq("id", session.user.id).single());
      return { user: session.user, profile };
    },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password, full_name, phone) {
      const d = ok(await sb.auth.signUp({ email, password, options: { data: { full_name, phone }, emailRedirectTo: location.href.split("#")[0] } }));
      return !!d.session;
    },
    async signOut() { await sb.auth.signOut(); },
    async updateProfile(p) { return ok(await sb.from("profiles").update(p).eq("id", profile.id).select().single()); },
    async getSettings() { return ok(await sb.from("settings").select("*").eq("id", 1).single()); },
    async saveSettings(p) { return ok(await sb.from("settings").update({ ...p, updated_at: new Date().toISOString() }).eq("id", 1).select().single()); },
    async listOffers() { return ok(await sb.from("offers").select("*").eq("status", "active").is("reserved_for", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(300)); },
    async listAllOffers() { return ok(await sb.from("offers").select("*").order("created_at", { ascending: false }).limit(200)); },
    async uploadPhoto(blob, folder = "offers") {
      const path = `${folder}/${uid()}.jpg`;
      ok(await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" }));
      return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    },
    async createOffer(o) {
      const offer = ok(await sb.from("offers").insert(o).select().single());
      let matches = 0; try { matches = ok(await sb.rpc("count_matches", { p_offer: offer.id })); } catch {}
      return { offer, matches };
    },
    async updateOffer(id, p) { ok(await sb.from("offers").update(p).eq("id", id)); },
    async deleteOffer(id) { ok(await sb.from("offers").delete().eq("id", id)); },
    async deleteOffers(ids) { for (let i = 0; i < ids.length; i += 100) ok(await sb.from("offers").delete().in("id", ids.slice(i, i + 100))); },
    async listSearches() { return ok(await sb.from("searches").select(CLIENT + ", offer:offers!offer_id(*)").order("created_at", { ascending: false }).limit(300)); },
    async createSearch(s) { ok(await sb.from("searches").insert(s)); },
    async updateSearch(id, p) { ok(await sb.from("searches").update(p).eq("id", id)); },
    async listOrders() { return ok(await sb.from("orders").select(CLIENT).order("created_at", { ascending: false }).limit(300)); },
    async createOrder(o) { ok(await sb.from("orders").insert(o)); },
    async updateOrder(id, p) { ok(await sb.from("orders").update(p).eq("id", id)); },
    async listPackages() { return ok(await sb.from("packages").select(CLIENT).order("created_at", { ascending: false }).limit(300)); },
    async registerPackage(p) {
      ok(await sb.rpc("register_package", { p_locker: p.locker, p_description: p.description, p_store: p.store || null, p_tracking: p.tracking || null, p_weight: p.weight_kg, p_declared: p.declared_usd, p_photo: p.photo_url || null, p_l: p.box_l, p_w: p.box_w, p_h: p.box_h }));
    },
    async updatePackage(id, p) { ok(await sb.from("packages").update(p).eq("id", id)); },
    async listNotifications() { return ok(await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(50)); },
    async markAllRead() { ok(await sb.from("notifications").update({ read: true }).eq("read", false)); },
    // por id (link #o-…): get_offer también entrega una oferta reservada a quien conoce su uuid (ver schema.sql)
    async getOffer(id) {
      try { const r = await sb.rpc("get_offer", { p_id: id }); if (!r.error) return (Array.isArray(r.data) ? r.data[0] : r.data) || null; } catch {}
      return ok(await sb.from("offers").select("*").eq("id", id).maybeSingle());
    },
    async createGroup(g) { return ok(await sb.from("purchase_groups").insert(g).select().single()); },
    async uploadReceipt(blob) {
      const f = await prepareReceipt(blob, false), pdf = f.type === "application/pdf";
      const path = `${profile.id}/${uid()}.${pdf ? "pdf" : "jpg"}`;
      ok(await sb.storage.from("receipts").upload(path, f, { contentType: pdf ? "application/pdf" : "image/jpeg" }));
      return path;
    },
    async attachReceipt(code, path) { ok(await sb.rpc("attach_receipt", { p_code: code, p_path: path })); },
    async receiptUrl(path) { const { data } = await sb.storage.from("receipts").createSignedUrl(path, 3600); return data?.signedUrl || ""; },
    async getGroup(id) { return ok(await sb.from("purchase_groups").select("*").eq("id", id).maybeSingle()); },
    async joinGroup(id, m) { return ok(await sb.rpc("join_group", { p_id: id, p_name: m.name, p_phone: m.phone })); },
  };
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && state.booted) { state.me = null; setTimeout(boot, 0); } });
  window.MSOrdenes?.extendSupabase(api, sb);   // ordenes.js: aprobar pago (RPC approve_order, exige comprobante)
  // cuentas.js: sin sesión se recorre el mall como invitada; la cuenta se pide al tocar "Comprar"
  return window.MSCuentas ? window.MSCuentas.extendSupabase(api, sb) : api;
}

// =====================================================================
// Estado y navegación
// =====================================================================
const state = { api: null, me: null, settings: { ...DEFAULT_SETTINGS }, tab: null, cat: null, mallView: "mall", q: "", notif: [], offers: [] };
const isShopper = () => state.me?.role === "shopper";
const isLive = () => state.settings.live_until && new Date(state.settings.live_until) > new Date();

// [id, ícono (clave de ICON: línea grabada, sin emoji), etiqueta]
const TABS_CLIENT = [["ofertas","bag","Mall"],["encargos","search","Encargos"],["pedidos","box","Pedidos"],["cuenta","user","Cuenta"],["caja","receipt","Caja"],["grupo","duo","Compra compartida"]];
const TABS_SHOP = [["publicar","cam","Publicar"],["mis-ofertas","tag","Tiendas"],["encargos","search","Encargos"],["pedidos","box","Pedidos"],["clientes","duo","Clientes"],["finanzas","chart","Finanzas"],["ajustes","gear","Ajustes"]];
const tabs = () => (isShopper() ? TABS_SHOP : TABS_CLIENT);

// ---------- Dólar del momento (USD → CLP), desde fuentes públicas; cae al valor de Ajustes si no hay conexión ----------
const FX_KEY = "ps_fx";
function applyFx(c) { state.fx = c; state.settings.usd_clp = c.v; }
async function loadFx() {
  if (state.settings.fx_auto === false) { state.fx = null; return; }
  try { const c = JSON.parse(localStorage.getItem(FX_KEY) || "null"); if (c && Date.now() - c.t < 60 * 60e3) { applyFx(c); return; } } catch {}
  const srcs = [
    ["Banco Central de Chile (dólar observado, vía mindicador.cl)", "https://mindicador.cl/api/dolar", (j) => j.serie && j.serie[0] && j.serie[0].valor],
    ["open.er-api.com", "https://open.er-api.com/v6/latest/USD", (j) => j.rates && j.rates.CLP],
  ];
  for (const [src, url, pick] of srcs) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000);
      const j = await (await fetch(url, { signal: ctl.signal })).json(); clearTimeout(tm);
      const v = Number(pick(j));
      if (v > 300 && v < 3000) { const c = { v: Math.round(v * 100) / 100, src, t: Date.now() }; try { localStorage.setItem(FX_KEY, JSON.stringify(c)); } catch {} applyFx(c); return; }
    } catch {}
  }
}
const fxNote = () => state.fx ? `dólar hoy ${clp(state.fx.v)} (${state.fx.src.split(" (")[0]})` : `dólar a ${clp(state.settings.usd_clp)}`;

async function boot() {
  try {
    await loadRenders();
    if (!state.api) state.api = DEMO ? makeLocalApi(await preloadDemoDb().catch(() => undefined)) : await makeSupabaseApi();
    TIENDAS.wrapApi(state.api);   // tiendas.js: Ropa + hombre → Ropa Hombre también en datos de Supabase aún sin migrar
    window.MSCampanas?.attach(state.api);   // campanas.js: publicar/editar/eliminar/mover ofertas → MallWalk.refreshOffers(); en Supabase lee store_campaigns
    try { state.settings = { ...DEFAULT_SETTINGS, ...(await state.api.getSettings()) }; } catch (e) { console.warn(e); }
    await Promise.race([loadFx(), new Promise((r) => setTimeout(r, 2500))]);   // no bloquear la app si la red está lenta
    const s = await state.api.session();
    if (!s) { state.me = null; state.booted = true; return renderAuth(); }
    // Link de la shopper: …/#shopper abre directo el ingreso de Cheryl (las clientas usan el link normal)
    if (location.hash === "#shopper" && s.profile && (s.profile.guest || s.profile.role !== "shopper") && !DEMO) { state.me = null; state.booted = true; return renderAuth("shopper"); }
    state.me = s.profile;
    if (location.hash === "#shopper") history.replaceState(null, "", "#");
    const hash = location.hash.slice(1);
    // links #o-/#s-/#g-: la shopper también puede abrir #o- (para revisar el link que le manda a una clienta)
    state.deep = /^(o|s|g)-[A-Za-z0-9-]+$/.test(hash) && (!isShopper() || hash.startsWith("o-")) ? hash : null;
    state.tab = state.deep && !isShopper() ? "ofertas" : tabs().some((t) => t[0] === hash) ? hash : tabs()[0][0];
    if (state.deep && state.deep.startsWith("g-")) { state.tab = "grupo"; state.groupId = state.deep.slice(2); }
    if (state.deep && state.deep.startsWith("s-")) { const cat = TIENDAS.fromLink(state.deep.slice(2)); if (cat) { state.mallView = "vitrina"; state.cat = cat; } }
    state.booted = true;
    if (!state.deep) navCommit(true);
    await render();
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = `<div class="page"><div class="card"><h2>No se pudo iniciar</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div></div>`;
  }
}
window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (!state.me) return;
  if (history.state && history.state.nav) return;      // navegación propia (atrás/adelante): ya la restauró popstate
  if (!isShopper() && /^(o|s|g)-[A-Za-z0-9-]+$/.test(h)) {          // link de oferta, tienda o compra compartida con la app ya abierta
    state.deep = h; state.tab = "ofertas";
    if (h.startsWith("g-")) { state.tab = "grupo"; state.groupId = h.slice(2); }
    if (h.startsWith("s-")) { const cat = TIENDAS.fromLink(h.slice(2)); if (cat) { state.mallView = "vitrina"; state.cat = cat; } }
    render(); return;
  }
  if (isShopper() && /^o-[A-Za-z0-9-]+$/.test(h)) { state.deep = h; render(); return; }
  if (h !== state.tab && tabs().some((t) => t[0] === h)) { state.tab = h; render(); }
});
function go(tab) { if (tab === "ofertas" && state.tab !== "ofertas") { state.mallView = "mall"; state.cat = null; } if (tab === "mis-ofertas") state.panelCat = null; state.tab = tab; navCommit(); render(); window.scrollTo(0, 0); }

// ---------- Historial: el botón "atrás" de Android / del navegador nunca deja a la clienta atrapada ----------
// Cada pantalla (pestaña, vitrina, interior, caja) es una entrada del historial; cada hoja o mostrador abierto
// agrega otra, así "atrás" primero cierra la hoja y después vuelve a la pantalla anterior.
const navSnap = () => ({ tab: state.tab, mallView: state.tab === "ofertas" ? state.mallView || "mall" : null, cat: state.tab === "ofertas" ? state.cat || null : null, groupId: state.tab === "grupo" ? state.groupId || null : null });
const sameSnap = (a, b) => !!a && !!b && a.tab === b.tab && a.mallView === b.mallView && a.cat === b.cat && a.groupId === b.groupId;
const navHash = () => "#" + (state.tab === "grupo" && state.groupId ? "g-" + state.groupId : state.tab || "");
function navCommit(replace) {
  const s = navSnap(), cur = history.state && history.state.nav;
  try {
    if (replace || (cur && !history.state.ovl && sameSnap(cur, s))) history.replaceState({ nav: s, prev: history.state && history.state.prev || null }, "", navHash());
    else history.pushState({ nav: s, prev: cur || null }, "", navHash());
  } catch {}
}
// "← Volver" dentro de la app: si la pantalla de destino es la anterior en el historial, retrocede (no apila otra)
function navBack(apply) {
  const prev = history.state && history.state.prev;
  const keep = { tab: state.tab, mallView: state.mallView, cat: state.cat, groupId: state.groupId };
  apply(true); const target = navSnap();
  if (prev && sameSnap(prev, target)) { Object.assign(state, keep); history.back(); return; }
  navCommit(); render(); window.scrollTo(0, 0);
}
function overlayPushed() { try { history.pushState({ nav: navSnap(), prev: (history.state && history.state.prev) || null, ovl: 1 }, "", location.hash || navHash()); } catch {} }
function closeTopOverlay() {
  const sr = $("#sheet-root"); if (sr && sr.firstElementChild) { sr.innerHTML = ""; return true; }
  const c = [...document.querySelectorAll(".counter")].pop(); if (c && c._close) { c._close(true); return true; }
  return false;
}
window.addEventListener("popstate", (e) => {
  if (!state.me) return;
  if (closeTopOverlay()) return;                       // atrás con una hoja abierta: solo la cierra
  const s = e.state && e.state.nav;
  if (!s) return;                                       // entradas sin estado (links #o-…): las atiende hashchange
  if (sameSnap(s, navSnap())) { history.back(); return; }   // entrada de una hoja ya cerrada (misma pantalla): seguir retrocediendo
  state.tab = s.tab;
  if (s.tab === "ofertas") { state.mallView = s.mallView || "mall"; state.cat = s.cat; state.filters = freshFilters(); }
  if (s.tab === "grupo") state.groupId = s.groupId;
  render(); window.scrollTo(0, 0);
});

async function refreshNotif() { try { state.notif = await state.api.listNotifications(); } catch { state.notif = []; } }

// Íconos de línea finos (sin emojis): estética de marca de lujo
const _svg = (d, vb = "0 0 24 24") => `<svg class="ico" viewBox="${vb}" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  bag: _svg('<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  cart: _svg('<path d="M2.5 4h2.6l2.3 11h10.4l2.2-8H6.2"/><path d="M8 15l-.9 2.6h11.4"/><circle cx="9.3" cy="20" r="1.3"/><circle cx="16.8" cy="20" r="1.3"/>'),
  bell: _svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  menu: _svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  palm: _svg('<path d="M12 21c0-5 .5-8 1.5-11"/><path d="M13.5 10C12 6.5 8.5 5.5 5 7"/><path d="M13.5 10c1-3.5 4.5-5 8-3.5"/><path d="M13.5 10C10 9.5 7.5 11 6 14"/><path d="M13.5 10c3.5.5 5.5 2.5 6.5 5"/>'),
  bolt: _svg('<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>'),
  upload: _svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 9"/>'),
  cam: _svg('<path d="M3.5 8h4l1.6-2.3h5.8L16.5 8h4v11h-17z"/><circle cx="12" cy="13.3" r="3.6"/>'),
  tag: _svg('<path d="M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2z"/><circle cx="8" cy="8.5" r="1.4"/>'),
  search: _svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'),
  box: _svg('<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>'),
  gear: _svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  user: _svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'),
  receipt: _svg('<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>'),
  duo: _svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.6c2 .7 3.2 2.3 3.5 4.9"/>'),
  chart: _svg('<path d="M4 20.5h16"/><path d="M6.5 20.5V13h3v7.5M10.5 20.5V8.5h3v12M14.5 20.5V4h3v16.5"/>'),
  ruler: _svg('<path d="M3 15.5 15.5 3l5.5 5.5L8.5 21z"/><path d="M7 11.5l2 2M10 8.5l1.5 1.5M13 5.5l2 2M5.5 13l1.2 1.2"/>'),
  card: _svg('<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><path d="M3 9.5h18M6.5 15h4"/>'),
  trash: _svg('<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 14h9l1-14"/><path d="M10 10.5v6.5M14 10.5v6.5"/>'),
  chat: _svg('<path d="M4 18.5 5.3 15A7.5 7.5 0 1 1 9 18.6z"/>'),
  invite: _svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M10.5 18.5h3"/><path d="M12 7v6M9 10h6"/>'),
  spark: _svg('<path d="M12 3.5l1.6 5.4 5.4 1.6-5.4 1.6L12 17.5l-1.6-5.4L5 10.5l5.4-1.6z"/><path d="M18.5 16.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/>'),
  star: _svg('<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/>'),
  check: _svg('<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.2 9.4"/>'),
  live: '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#b3263b" stroke="#5a0e18" stroke-width="1"/><circle cx="10.4" cy="10.3" r="1.6" fill="#ffd0d6" opacity=".8"/></svg>',
};
const IC = (k) => ICON[k] || "";
// Cliente: el mall, con la botonera de tiendas siempre abajo
async function renderClient(unread) {
  try { state.offers = await state.api.listOffers(); } catch { state.offers = []; }
  const titles = { encargos: "Encargos", pedidos: "Mis pedidos y casilla", cuenta: "Mi cuenta" };
  const shops = shopList();
  const active = state.tab === "ofertas" ? (state.mallView === "mall" ? "mall" : state.cat) : state.tab === "caja" ? "caja" : "";
  $("#app").innerHTML = `
    ${state.api.demo ? `<div class="demo-bar">Modo demo: los datos se guardan solo en este teléfono.
      <div class="seg"><button data-role="client" class="on">Cliente</button><button data-role="shopper">Shopper</button></div></div>` : ""}
    <header class="top client"><button class="brand" id="home" aria-label="Ir al pasillo del mall">${esc(APP_NAME)}</button>
      ${contactCherylLink() ? `<a class="icon-btn wa-ic" href="${esc(contactCherylLink())}" target="_blank" rel="noopener" aria-label="Escribirle a ${esc(cherylName())} por WhatsApp"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg></a>` : ""}
      <button class="icon-btn" id="cartbtn" aria-label="Tu carro">${ICON.cart}</button>
      <button class="icon-btn" id="bell" aria-label="Notificaciones">${ICON.bell}${unread ? `<span class="badge">${unread}</span>` : ""}</button>
      <button class="icon-btn" id="menu" aria-label="Menú">${ICON.menu}</button><button class="icon-btn vit-shops" id="vitshops" aria-label="Ver tiendas" aria-expanded="false"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg></button></header>
    <main class="page ${state.tab === "ofertas" || state.tab === "caja" ? "immersive" : ""}" id="view">${titles[state.tab] ? `<button type="button" class="view-back" id="vback">← Volver</button><h2 class="view-title">${titles[state.tab]}</h2>` : ""}<div id="inner"><div class="muted">Cargando…</div></div></main>
    <nav class="storebar" aria-label="Tiendas del mall"><div class="storebar-in">
      ${shops.map((x) => `<button class="sb ${x.cat === LAST ? "lm" : ""} ${active === x.cat ? "on" : ""} ${x.n ? "" : "empty"}" data-go="${esc(x.cat)}"><span class="si">${sbImg(x.cat) ? `<img src="${esc(sbImg(x.cat))}" alt="" loading="lazy">` : `<span class="mono">${esc(shopName(x.cat).charAt(0))}</span>`}</span><span class="sbn">${esc(shopName(x.cat))}</span></button>`).join("")}
    </div></nav>`;
  // vitrina: botones de arriba pasan a los costados para despejar la foto
  document.body.classList.toggle("vit-mode", state.tab === "ofertas" && state.mallView === "vitrina");
  paintCartBadge();
  $("#home").onclick = () => goStore("mall");
  // vitrina despejada: la botonera de tiendas se oculta y se abre con el botón "Tiendas" del riel derecho
  const vs = $("#vitshops"); if (vs) vs.onclick = () => { const on = document.body.classList.toggle("vit-shops-open"); vs.setAttribute("aria-expanded", on); };
  document.body.classList.remove("vit-shops-open");
  $("#vback") && ($("#vback").onclick = () => { if (history.state && history.state.prev) history.back(); else goStore("mall"); });
  $("#cartbtn").onclick = openCart;
  $("#bell").onclick = openNotifications;
  $("#menu").onclick = () => sheet(`<h2>Menú</h2><div class="stack">
      ${window.MSCuentas?.menuHTML() || ""}
      <button class="btn ghost block" data-m="encargos">${ICON.search}Encargos: pídele algo puntual a tu shopper</button>
      <button class="btn ghost block" data-m="pedidos">${ICON.box}Mis pedidos y mi casilla en Miami</button>
      <button class="btn ghost block" data-m="cuenta">${ICON.user}Mi cuenta y calculadora</button>
      ${contactCherylLink() ? `<a class="btn wa block" target="_blank" rel="noopener" href="${esc(contactCherylLink())}">${ICON.chat}Contactar a ${esc(cherylName())} por WhatsApp</a>` : ""}
      <a class="btn ghost block" target="_blank" rel="noopener" href="${esc(waShare(`Te invito a ${APP_NAME}: ofertas reales de los malls de Miami, puestas en Chile 👉 ${appLink("ofertas")}`))}">${ICON.invite}Invitar amigas a la app</a></div>`, (el, close) => { window.MSCuentas?.wireMenu(el, close); el.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { close(); go(b.dataset.m); })); });
  $("#app").querySelectorAll("[data-role]").forEach((b) => (b.onclick = async () => { await state.api.switchRole(b.dataset.role); state.tab = null; location.hash = ""; boot(); }));
  $("#app").querySelectorAll(".storebar [data-go]").forEach((b) => (b.onclick = () => goStore(b.dataset.go)));
  const on = $(".storebar .sb.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
  const inner = $("#inner");
  try { await (VIEWS[state.tab] || VIEWS.ofertas)(inner); }
  catch (e) { console.error(e); inner.innerHTML = `<div class="card"><b>Error</b><p class="muted">${esc(e.message)}</p></div>`; }
  if (state.deep) {
    const d = state.deep; state.deep = null;
    navCommit(true);                                     // el link de la compra compartida (#g-…) se conserva al recargar
    if (d.startsWith("o-")) { try { const o = await state.api.getOffer(d.slice(2)); o ? openOffer(o) : toast("Esa oferta ya no está disponible"); } catch {} }
  }
}

async function render() {
  await refreshNotif();
  const unread = state.notif.filter((n) => !n.read).length;
  const title = { ofertas: APP_NAME, encargos: "Encargos", pedidos: "Pedidos y casilla", cuenta: "Mi cuenta", publicar: "Publicar", "mis-ofertas": "Mis tiendas", ajustes: "Ajustes", finanzas: "Centro financiero", clientes: "Clientes" }[state.tab];
  if (!isShopper()) return renderClient(unread);
  document.body.classList.remove("vit-mode");
  $("#app").innerHTML = `
    ${state.api.demo ? `<div class="demo-bar">Modo demo: los datos se guardan solo en este teléfono.
      <div class="seg"><button data-role="client" class="${!isShopper() ? "on" : ""}">Cliente</button><button data-role="shopper" class="${isShopper() ? "on" : ""}">Shopper</button></div></div>` : ""}
    <header class="top"><h1 class="${state.tab === "ofertas" ? "neon" : ""}">${esc(title)}</h1>
      <button class="icon-btn" id="bell" aria-label="Notificaciones">${ICON.bell}${unread ? `<span class="badge">${unread}</span>` : ""}</button></header>
    <main class="page" id="view"><div class="muted">Cargando…</div></main>
    <nav class="tabs"><div class="tabs-in">${tabs().map(([id, i, l]) => `<button class="tab ${state.tab === id ? "on" : ""}" data-tab="${id}"><span class="ti">${IC(i)}</span>${l}</button>`).join("")}</div></nav>`;
  $("#app").querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  $("#app").querySelectorAll("[data-role]").forEach((b) => (b.onclick = async () => { await state.api.switchRole(b.dataset.role); state.tab = null; location.hash = ""; boot(); }));
  $("#bell").onclick = openNotifications;
  const view = $("#view");
  try { await (VIEWS[state.tab] || VIEWS.ofertas)(view); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card"><b>Error</b><p class="muted">${esc(e.message)}</p></div>`; }
  if (state.deep && state.deep.startsWith("o-")) {      // la shopper abrió un link #o-…: ve la ficha tal como la clienta
    const d = state.deep; state.deep = null; navCommit(true);
    try { const o = await state.api.getOffer(d.slice(2)); o ? openOffer(o) : toast("Esa oferta ya no está disponible"); } catch {}
  }
}

// ---------- Hojas (modales) ----------
function sheet(html, onMount) {
  const root = $("#sheet-root");
  const had = !!root.firstElementChild;
  root.innerHTML = `<div class="backdrop"><div class="sheet" role="dialog" aria-modal="true"><button type="button" class="sheet-x" aria-label="Cerrar">Cerrar <span aria-hidden="true">×</span></button><div class="sheet-body"><div class="grab"></div>${html}</div></div></div>`;
  const bd = root.firstElementChild;
  const close = () => { if (root.firstElementChild === bd) root.innerHTML = ""; };
  bd.addEventListener("click", (e) => { if (e.target === bd) close(); });
  bd.querySelector(".sheet-x").onclick = close;
  bd.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
  if (!had) overlayPushed();                            // "atrás" en Android cierra la hoja
  onMount?.(bd.querySelector(".sheet-body"), close);
  return close;
}

async function openNotifications() {
  const list = state.notif;
  sheet(`<h2>Notificaciones</h2>
    ${list.length ? `<div class="stack">${list.map((n) => `<button class="card item" style="width:100%;border:0;text-align:left;cursor:pointer" data-offer="${esc(n.offer_id || "")}">
      <div class="thumb">${n.offer_id ? ICON.spark : ICON.box}</div><div class="grow"><div class="${n.read ? "" : "t"}">${esc(n.message)}</div><div class="small muted">${ago(n.created_at)}</div></div></button>`).join("")}</div>`
      : `<div class="empty">Aún no tienes notificaciones.</div>`}
    <button class="btn ghost block" style="margin-top:14px" data-close>Cerrar</button>`, (el, close) => {
    el.querySelectorAll("[data-offer]").forEach((b) => (b.onclick = async () => {
      if (!b.dataset.offer) return;
      const o = await state.api.getOffer(b.dataset.offer); close();
      if (o) openOffer(o); else toast("Esa oferta ya no está disponible");
    }));
  });
  if (list.some((n) => !n.read)) { await state.api.markAllRead(); const b = $("#bell .badge"); if (b) b.remove(); state.notif.forEach((n) => (n.read = true)); }
}

// =====================================================================
// Vistas
// =====================================================================
const photoOrEmoji = (o, cls = "") => o.photo_url ? `<img src="${esc(o.photo_url)}" alt="" loading="lazy" class="${cls}">` : catOf(o.category).emoji;

function liveBanner() {
  if (!isLive()) return "";
  return `<div class="live"><span class="dot" aria-hidden="true"></span><div class="grow"><b>Tu shopper está${state.settings.live_store ? " en " + esc(state.settings.live_store) : " en el mall"}</b>
    <div class="small" style="opacity:.8">Publicando ofertas hasta las ${hora(state.settings.live_until, isShopper() ? TZ_MIA : TZ_CL)} ${isShopper() ? "(hora Miami)" : "(hora Chile)"}</div></div></div>`;
}

// =====================================================================
// El mall virtual: cada tipo de producto es una tienda del pasillo
// =====================================================================
// Las 10 tiendas (tiendas.js): mismos nombres y orden físico 01…10 que los letreros del mall 3D.
// [nombre del letrero, fachada, categorías de producto que vende]
const TIENDAS = window.MSTiendas;
const LAST = TIENDAS.LAST; // tienda 09 "Ofertas" (último minuto); el nombre se cambia en tiendas.js (NOMBRE_OFERTAS)
const SHOPS = TIENDAS.SHOPS;
const LAST_NAME = SHOPS[LAST][0];
const shopOfCategory = (category) => Object.keys(SHOPS).find((k) => (SHOPS[k][2] || []).includes(category)) || "Otros";
const shopName = (cat) => (SHOPS[cat] || [cat])[0];
const facadeOf = (cat) => (SHOPS[cat] || [0, "marble"])[1];
const shopEmoji = (cat) => "";   // sin emojis: estética ultra real
const storePhoto = (cat) => (state.settings.store_photos || {})[cat] || "";
const mallPhotos = () => (Array.isArray(state.settings.mall_photos) ? state.settings.mall_photos : []);
const mallName = () => (isLive() && state.settings.live_store) || state.settings.mall_name || "Aventura Mall";
const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const offersIn = (cat, list = state.offers || []) => (cat === LAST ? list.filter((o) => o.last_minute) : list.filter((o) => (SHOPS[cat]?.[2] || [cat]).includes(o.category)));
// Flyers de la vitrina: primero los destacados por la shopper (más nuevos primero, máx. 4).
// Si destacó menos de 2, se completa hasta 4 con mejor descuento y luego más nuevas.
const VITRINA_MAX = 4;
// ---------- Género: catálogo de mujer / hombre (unisex aparece en ambos) ----------
// Lencería y Carteras son solo de mujer: no se pregunta ni al publicar ni al entrar.
// Ropa Mujer y Ropa Hombre ya definen el género (tiendas.js FIXED_GENDER): tampoco se pregunta.
const GENDERS = [["mujer", "Mujer"], ["hombre", "Hombre"], ["unisex", "Unisex"]];
const WOMEN_ONLY = ["Lenceria", "Carteras"];
const womenOnlyCat = (category) => WOMEN_ONLY.includes(category);
const genderOf = (o) => (womenOnlyCat(o?.category) ? "mujer" : o?.category === "RopaHombre" ? "hombre" : ["mujer", "hombre", "unisex"].includes(o?.gender) ? o.gender : "unisex");
const genderOk = (o, g) => !g || genderOf(o) === g || genderOf(o) === "unisex";
const shopNeedsGender = (cat) => !!cat && cat !== "__search" && cat !== "mall" && !WOMEN_ONLY.includes(cat) && !TIENDAS.fixedGender(cat);
const GENDER_KEY = "ps_gender";
const getGender = () => { if (isShopper()) return ""; try { const g = localStorage.getItem(GENDER_KEY); return g === "mujer" || g === "hombre" ? g : ""; } catch { return state._gender || ""; } };
const setGender = (g) => { state._gender = g; try { localStorage.setItem(GENDER_KEY, g); } catch {} };
const genderLabel = (g) => (GENDERS.find((x) => x[0] === g) || [0, ""])[1];
// Orden de los afiches de la vitrina: el que fijó la shopper (vitrina_pos); si no hay, los más nuevos primero
const vitrinaOrder = (a, b) => (Number.isFinite(+a.vitrina_pos) && a.vitrina_pos !== null ? +a.vitrina_pos : 99) - (Number.isFinite(+b.vitrina_pos) && b.vitrina_pos !== null ? +b.vitrina_pos : 99) || String(b.created_at || "").localeCompare(String(a.created_at || ""));
const vitrinaPicks = (cat, list = state.offers || [], opt = {}) => {
  const pool = offersIn(cat, list);
  const g = opt.gender !== undefined ? opt.gender : shopNeedsGender(cat) ? getGender() : "";
  const newest = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
  // con una elección guardada, ese género (y unisex) va primero; sin elección, afiches mixtos
  const pri = (arr) => (g ? [...arr.filter((o) => genderOk(o, g)), ...arr.filter((o) => !genderOk(o, g))] : arr);
  const picks = pri(pool.filter((o) => o.featured).sort(vitrinaOrder)).slice(0, VITRINA_MAX);
  if (picks.length >= 2) return picks;
  const rest = pri(pool.filter((o) => !picks.includes(o)).sort((a, b) => (Number(b.discount_pct) || 0) - (Number(a.discount_pct) || 0) || newest(a, b)));
  return [...picks, ...rest].slice(0, VITRINA_MAX);
};
// Afiches destacados por la shopper en una vitrina, en su orden (máx. 4)
const featuredIn = (cat, list = state.offers || []) => offersIn(cat, list).filter((o) => o.featured).sort(vitrinaOrder);
window.vitrinaPicks = vitrinaPicks; // app.js es módulo: expuesto para depurar/pruebas
// Tiendas (vitrinas) en las que aparece una oferta: su tienda por categoría + "Ofertas" si es de último minuto.
const vitrinasOf = (o) => [shopOfCategory(o.category), ...(o.last_minute ? [LAST] : [])];
// Placas de la barra de tiendas: una foto fija y clara por tienda (img/sb/, 320×320). Si falta, la oferta destacada.
const SB_TILES = { Carteras: "img/sb/carteras.jpg", Zapatos: "img/sb/zapatos.jpg", Deportes: "img/sb/deportes.jpg", Lenceria: "img/sb/lenceria.jpg", Relojes: "img/sb/relojes.jpg", Otros: "img/sb/outlet.jpg", Invierno: "img/sb/invierno.jpg", Ropa: "img/sb/ropa_mujer.jpg", RopaHombre: "img/sb/ropa_hombre.jpg", [LAST]: "img/sb/ofertas.jpg" };   // placa sin nombre escrito (sirve para "Ofertas" o "Liquidación")
// Selector grande de las 10 tiendas (publicar, cambiar de tienda): foto de la placa + nombre
const storeTilesHTML = (sel) => Object.keys(SHOPS).map((cat) => `<button type="button" role="radio" class="stp${cat === sel ? " on" : ""}${cat === LAST ? " lm" : ""}" data-store="${esc(cat)}" aria-checked="${cat === sel}"><img src="${esc(sbImg(cat))}" alt="" loading="lazy"><span>${esc(shopName(cat))}</span></button>`).join("");
const sbImg = (cat) => { if (SB_TILES[cat]) return SB_TILES[cat]; try { const o = vitrinaPicks(cat)[0]; const u = o && (photosOf(o)[0] || {}).url; return u || storeThumb(cat); } catch (e) { return storeThumb(cat); } };
const shopList = () => Object.keys(SHOPS).map((cat) => ({ cat, n: offersIn(cat).length }));

// ---------- Objetos del pasillo (palmeras, maceteros con flores, bancas, fuente) ----------
const SPRITES = {
  palm: `<svg viewBox="0 0 300 560" aria-hidden="true"><defs>
      <linearGradient id="tr" x1="0" x2="1"><stop offset="0" stop-color="#8d8579"/><stop offset=".45" stop-color="#cfc6b8"/><stop offset="1" stop-color="#7a7266"/></linearGradient>
      <linearGradient id="fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f9a4c"/><stop offset="1" stop-color="#2f6234"/></linearGradient>
      <linearGradient id="cs" x1="0" x2="1"><stop offset="0" stop-color="#6c8f3a"/><stop offset="1" stop-color="#9dbb59"/></linearGradient></defs>
    <path d="M142 560 C140 420 146 300 150 170 L158 170 C160 300 164 420 166 560 Z" fill="url(#tr)"/>
    ${Array.from({ length: 16 }, (_, i) => `<rect x="141" y="${200 + i * 22}" width="${26 - i * 0.2}" height="2" fill="rgba(70,60,50,.35)"/>`).join("")}
    <path d="M147 120 L161 120 L163 175 L146 175 Z" fill="url(#cs)"/>
    <g fill="none" stroke="url(#fr)" stroke-linecap="round">
      <path d="M154 122 C120 70 70 60 18 96" stroke-width="12" stroke-dasharray="2 3"/><path d="M154 122 C120 70 70 60 18 96" stroke-width="4"/>
      <path d="M154 122 C190 70 240 62 290 98" stroke-width="12" stroke-dasharray="2 3"/><path d="M154 122 C190 70 240 62 290 98" stroke-width="4"/>
      <path d="M154 120 C140 60 120 20 80 8" stroke-width="12" stroke-dasharray="2 3"/><path d="M154 120 C140 60 120 20 80 8" stroke-width="4"/>
      <path d="M154 120 C170 60 190 22 232 10" stroke-width="12" stroke-dasharray="2 3"/><path d="M154 120 C170 60 190 22 232 10" stroke-width="4"/>
      <path d="M154 124 C110 110 60 130 30 180" stroke-width="12" stroke-dasharray="2 3"/><path d="M154 124 C110 110 60 130 30 180" stroke-width="4"/>
      <path d="M154 124 C200 110 250 130 278 182" stroke-width="12" stroke-dasharray="2 3"/><path d="M154 124 C200 110 250 130 278 182" stroke-width="4"/>
      <path d="M154 118 C154 70 156 40 154 0" stroke-width="11" stroke-dasharray="2 3"/><path d="M154 118 C154 70 156 40 154 0" stroke-width="4"/>
    </g>
    <g fill="#f7f1ff"><circle cx="146" cy="150" r="4"/><circle cx="160" cy="146" r="3.5"/><circle cx="152" cy="140" r="3"/></g>
    <g fill="#d95fa8"><circle cx="150" cy="156" r="3"/><circle cx="141" cy="143" r="2.5"/></g></svg>`,
  planter: `<svg viewBox="0 0 320 120" aria-hidden="true"><defs>
      <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ede4"/><stop offset="1" stop-color="#cfc4b4"/></linearGradient>
      <radialGradient id="lf" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#7fb25e"/><stop offset="1" stop-color="#2f6234"/></radialGradient></defs>
    <rect x="6" y="52" width="308" height="66" rx="4" fill="url(#pf)"/><rect x="6" y="52" width="308" height="6" fill="#c99d5b"/>
    <g fill="url(#lf)">${[18, 48, 80, 112, 146, 178, 210, 242, 272, 300].map((x, i) => `<ellipse cx="${x}" cy="${46 - (i % 3) * 5}" rx="${22 + (i % 2) * 6}" ry="${18 + (i % 3) * 4}"/>`).join("")}</g>
    <g>${[[24, 30, "#f04f9c"], [60, 22, "#ffffff"], [92, 34, "#ff7aa8"], [128, 20, "#f04f9c"], [160, 30, "#ffd6e6"], [196, 22, "#ff5c7a"], [228, 32, "#ffffff"], [262, 24, "#f04f9c"], [292, 34, "#ff9ec4"]].map(([x, y, c]) => `<g fill="${c}"><circle cx="${x}" cy="${y}" r="5"/><circle cx="${x + 7}" cy="${y + 4}" r="4"/><circle cx="${x - 6}" cy="${y + 5}" r="4"/></g>`).join("")}</g></svg>`,
  bench: `<svg viewBox="0 0 200 70" aria-hidden="true"><defs>
      <linearGradient id="bm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8f3"/><stop offset="1" stop-color="#d9d0c3"/></linearGradient>
      <linearGradient id="bw" x1="0" x2="1"><stop offset="0" stop-color="#8a5d3b"/><stop offset=".5" stop-color="#b07a4f"/><stop offset="1" stop-color="#8a5d3b"/></linearGradient></defs>
    <ellipse cx="100" cy="66" rx="96" ry="4" fill="rgba(0,0,0,.18)"/>
    <rect x="14" y="30" width="26" height="34" fill="url(#bm)"/><rect x="160" y="30" width="26" height="34" fill="url(#bm)"/>
    <rect x="4" y="22" width="192" height="12" rx="2" fill="url(#bw)"/><rect x="4" y="22" width="192" height="3" fill="rgba(255,255,255,.35)"/></svg>`,
  fountain: `<svg viewBox="0 0 300 200" aria-hidden="true"><defs>
      <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1e9"/><stop offset="1" stop-color="#cbbfae"/></linearGradient>
      <linearGradient id="fw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fbff" stop-opacity=".95"/><stop offset="1" stop-color="#8fd3e6" stop-opacity=".6"/></linearGradient></defs>
    <ellipse cx="150" cy="190" rx="146" ry="8" fill="rgba(0,0,0,.15)"/>
    <path d="M10 150 Q150 128 290 150 L284 186 Q150 200 16 186 Z" fill="url(#fb)"/>
    <ellipse cx="150" cy="150" rx="140" ry="16" fill="#7cc6d8"/><ellipse cx="150" cy="148" rx="120" ry="10" fill="#a9e1ee"/>
    <rect x="140" y="70" width="20" height="80" fill="url(#fb)"/><ellipse cx="150" cy="72" rx="44" ry="9" fill="url(#fb)"/>
    <path d="M150 10 C140 40 120 60 112 72 M150 10 C160 40 180 60 188 72 M150 10 L150 66" stroke="url(#fw)" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M110 74 C96 100 86 120 80 146 M190 74 C204 100 214 120 220 146" stroke="url(#fw)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g fill="#f08a3c"><ellipse cx="96" cy="152" rx="7" ry="3"/><ellipse cx="200" cy="149" rx="7" ry="3"/></g></svg>`,
};
// Isla central del pasillo: [tipo, x, z, ancho]
const ISLAND = [
  ["bench", -130, -200, 120], ["bench", 130, -200, 120],
  ["planter", 0, -360, 260], ["palm", 0, -372, 230],
  ["bench", -130, -560, 120], ["bench", 130, -560, 120],
  ["fountain", 0, -760, 260],
  ["planter", 0, -980, 260], ["palm", 0, -992, 230],
  ["bench", -130, -1160, 120], ["bench", 130, -1160, 120],
  ["planter", 0, -1360, 260], ["palm", 0, -1372, 230],
];
// El pasillo en 3D: ancho, de dos pisos, tragaluz abovedado y la isla central
function concourseHTML(mall, shops, clickable) {
  const list = (shops && shops.length ? shops : shopList()).filter((x) => x.cat !== LAST).slice(0, 12);
  const left = list.filter((x) => TIENDAS.side(x.cat) === "left"), right = list.filter((x) => TIENDAS.side(x.cat) !== "left");   // 01–05 izquierda, 06–10 derecha
  const panel = (x) => `<${clickable ? "button" : "div"} class="cc-shop f-${facadeOf(x.cat)}" ${clickable ? `data-go="${esc(x.cat)}" aria-label="Caminar a ${esc(shopName(x.cat))}"` : ""}>
      <span class="cc-upper"></span><span class="cc-rail"></span>
      <span class="cc-sign">${esc(shopName(x.cat))}</span>
      <span class="cc-glass"><span class="cc-emo">${shopEmoji(x.cat)}</span></span></${clickable ? "button" : "div"}>`;
  const pad = (arr) => arr.concat(Array.from({ length: Math.max(0, 6 - arr.length) }, () => null)).map((x) => x ? panel(x) : `<div class="cc-shop cc-blank"><span class="cc-upper"></span><span class="cc-rail"></span><span class="cc-glass"></span></div>`).join("");
  const island = ISLAND.map(([k, x, z, w]) => `<div class="cc-obj cc-${k}" style="width:${w}px;transform:translate3d(calc(-50% + ${x}px),0,${z}px)">${SPRITES[k]}</div>`).join("");
  return `<div class="concourse"><div class="cc-box">
      <div class="cc-ceiling"></div><div class="cc-floor"></div>
      <div class="cc-wall cc-left">${pad(left)}</div>
      <div class="cc-wall cc-right">${pad(right)}</div>
      <div class="cc-end"><span class="cc-mall">${esc(mall)}</span></div>
      ${island}
    </div><div class="cc-sun"></div><div class="cc-vignette"></div></div>`;
}

// ---------- Renders reales del mall (Blender): mall/mall.json + imágenes y cuadros de la caminata ----------
const RENDERS = { base: "mall/", data: null, cache: {} };
async function loadRenders() {
  if (RENDERS.data !== null) return;
  try { const r = await fetch(RENDERS.base + "mall.json", { cache: "no-cache" }); RENDERS.data = r.ok ? await r.json() : false; } catch { RENDERS.data = false; }
}
const rIdx = (cat) => (RENDERS.data && RENDERS.data.stores ? RENDERS.data.stores.findIndex((x) => x.cat === cat) : -1);
const hallRender = () => (RENDERS.data && RENDERS.data.hall ? RENDERS.base + RENDERS.data.hall : "");
// fotos limpias de vitrina mall/v3/vitrina_NN.jpg (NN = n° de vitrina del 3D, tiendas.js). glass = zona de vidrio [x, y, ancho, alto] normalizada
// 01–06: renders Cycles de la escena nueva · 07–10: cuadro de llegada del mall 3D sin afiches (test/w3d_t10.py clean)
const CLEAN_STILLS = Object.fromEntries(Object.keys(SHOPS).map((k) => [k, `vitrina_${TIENDAS.SCENE[k]}.jpg`]));
const CLEAN_GLASS = [0.17, 0.05, 0.65, 0.78], CLEAN_GLASS_3D = [0.17, 0.11, 0.66, 0.8];
const storeRender = (cat) => { if (CLEAN_STILLS[cat]) return { src: "mall/v3/" + CLEAN_STILLS[cat], glass: +TIENDAS.SCENE[cat] > 6 ? CLEAN_GLASS_3D : CLEAN_GLASS, w: 1152, h: 1392, clean: true }; return storeRender0(cat); };
const storeRender0 = (cat) => { const i = rIdx(cat), st = i >= 0 && RENDERS.data.stores[i]; return st && st.image ? { ...st, src: RENDERS.base + st.image } : null; };
const storeThumb = (cat) => { const i = rIdx(cat), st = i >= 0 && RENDERS.data.stores[i]; return st && st.thumb ? RENDERS.base + st.thumb : ""; };
// Caminata real: reproduce los cuadros renderizados entre la tienda de origen y la de destino
function walkRendered(fromCat, toCat, done, label) {
  const W = RENDERS.data && RENDERS.data.walk;
  if (!W || !W.fwd_dir || reduceMotion()) return false;
  const st = (c) => RENDERS.data.stores.find((x) => x.cat === c);
  const a = fromCat ? st(fromCat) : null, b = toCat ? st(toCat) : null;
  const ya = a ? a.y : W.y_start, yb = b ? b.y : W.y_start;
  if (ya === yb) return false;
  const fwd = yb < ya;                                   // hacia el fondo del pasillo
  const dir = fwd ? W.fwd_dir : W.back_dir;
  const f0 = fwd ? (a ? a.frame_fwd : 0) : a.frame_back, f1 = fwd ? b.frame_fwd : (b ? b.frame_back : W.frames - 1);
  if (!dir || f1 <= f0) return false;
  const step = Math.max(1, Math.ceil((f1 - f0) / 40));   // como máximo ~40 cuadros por tramo
  const frames = []; for (let f = f0; f <= f1; f += step) frames.push(f); if (frames[frames.length - 1] !== f1) frames.push(f1);
  const src = (f) => RENDERS.base + dir + "/f" + String(f).padStart(4, "0") + ".jpg";
  const ov = document.createElement("div"); ov.className = "walk walk-r";
  ov.innerHTML = `<img alt="" src="${src(frames[0])}"><div class="walk-label">${esc(label || "")}</div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add("go"));
  const img = ov.querySelector("img");
  const pre = frames.map((f) => { const im = new Image(); im.src = src(f); return im; });
  let k = 0; const fps = Math.min(14, (W.fps || 10) * 1.2);
  const tick = () => {
    if (k >= frames.length) { done(); window.scrollTo(0, 0); setTimeout(() => ov.classList.add("out"), 80); setTimeout(() => ov.remove(), 500); return; }
    if (pre[k].complete) { img.src = pre[k].src; k++; }
    setTimeout(tick, 1000 / fps);
  };
  setTimeout(tick, 120);
  return true;
}
// Caminar por el pasillo: salir de una tienda y llegar a otra
function walk(labels, done, side) {
  if (reduceMotion()) { done(); window.scrollTo(0, 0); return; }
  // sin fotos del pasillo: se camina sobre el render real del pasillo (no la ilustración)
  const photos = mallPhotos().length ? mallPhotos() : hallRender() ? [hallRender()] : [];
  const ov = document.createElement("div");
  ov.className = "walk" + (side ? " turn-" + side : "");
  ov.innerHTML = (photos.length
    ? `<div class="walk-photo" style="background-image:url('${esc(photos[Math.floor(Math.random() * photos.length)])}')"></div>`
    : concourseHTML(mallName(), null, false)) + `<div class="walk-label">${esc(labels[0])}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add("go")));
  if (labels[1]) setTimeout(() => { const l = ov.querySelector(".walk-label"); l.classList.add("swap"); setTimeout(() => { l.textContent = labels[1]; l.classList.remove("swap"); }, 160); }, 520);
  setTimeout(() => { done(); window.scrollTo(0, 0); }, 900);
  setTimeout(() => ov.classList.add("out"), 1150);
  setTimeout(() => ov.remove(), 1600);
}
function goStore(cat) {
  const fromStore = state.tab === "ofertas" && state.mallView !== "mall" && state.cat;
  if (state.tab === "ofertas" && state.cat === cat && state.mallView === "vitrina") return;
  const toMall = cat === "mall";
  const labels = toMall ? [fromStore ? `Saliendo de ${shopName(state.cat)}…` : "Volviendo al pasillo…", `Bienvenida a ${mallName()}`]
    : fromStore ? [`Saliendo de ${shopName(state.cat)}…`, `Caminando a ${shopName(cat)}…`] : [`Caminando a ${shopName(cat)}…`];
  const side = TIENDAS.side(cat);
  const arrive = () => {
    state.tab = "ofertas"; state.mallView = toMall ? "mall" : "vitrina"; state.cat = toMall ? null : cat; state.filters = freshFilters();
    navCommit(); render();
  };
  const from = state.tab === "ofertas" && state.cat && state.cat !== "__search" ? state.cat : null;
  // caminata real en primera persona (walk.js, escena v2): afiches reales de cada vitrina; tocar uno abre la oferta
  const wPick = (o) => ({ o, badge2: Number(o.discount1_pct) > 0 && Number(o.discount2_pct) > 0 && discOf(o) ? "−" + fmtPct(o.discount2_pct) + "% EXTRA" : "", img: (photosOf(o)[0] || {}).url || "", brand: o.brand || "", title: o.title || "", price: clp(quote(o.price_usd, o).clp), badge: discOf(o) ? "−" + fmtPct(Number(o.discount1_pct) > 0 && Number(o.discount2_pct) > 0 ? o.discount1_pct : o.discount_pct) + "%" : is2x1(o) ? "2×1" : "" });
  if (!toMall && window.MallWalk && window.MallWalk.play({ from, to: cat, label: labels[labels.length - 1], done: arrive, picks: (c) => (window.MSCampanas ? window.MSCampanas.picks3d(c, wPick) : vitrinaPicks(c).map(wPick)), open: (p) => vf3Viewer(p.o), campaign: (c) => campaignFor(c), showPosters: true })) return;   // picks = las 4 pantallas en orden (campanas.js); campaign → null
  if (walkRendered(from, toMall ? null : cat, arrive, labels[labels.length - 1])) return;
  walk(labels, arrive, toMall ? null : side);
}
const freshFilters = () => ({ min: null, max: null, colors: [], sizes: [], brands: [], sort: "new" });
// Afiche grande de cada tienda en el mall 3D (campanas.js): {img, title} o null. Sin afiche elegido: oferta destacada con mayor descuento
const campaignFor = (cat) => (window.MSCampanas ? window.MSCampanas.campaignFor(cat) : null);
window.campaignFor = campaignFor;   // expuesto para pruebas

// ---------- Carrito ----------
const cartKey = () => "ps_cart_" + (state.me?.id || "anon");
function getCart() { try { return JSON.parse(localStorage.getItem(cartKey())) || []; } catch { return state._cart || []; } }
function setCart(c) { state._cart = c; try { localStorage.setItem(cartKey(), JSON.stringify(c)); } catch {} paintCartBadge(); }
const cartCount = () => getCart().reduce((n, x) => n + x.qty, 0);
function paintCartBadge() { const b = $("#cartbtn"); if (!b) return; const n = cartCount(); b.querySelector(".badge")?.remove(); if (n) b.insertAdjacentHTML("beforeend", `<span class="badge" aria-hidden="true">${n}</span>`); b.setAttribute("aria-label", n ? `Tu carro: ${n} ${n === 1 ? "producto" : "productos"}` : "Tu carro"); }
function addToCart(o, color, size, qty) {
  const c = getCart();
  const same = c.find((x) => x.offer_id === o.id && x.color === color && x.size === size);
  if (same) same.qty += qty; else c.push({ key: uid(), offer_id: o.id, title: o.title, brand: o.brand || "", photo: o.photo_url || "", category: o.category, color, size, qty, price_usd: o.price_usd, clp: quote(o.price_usd, o).clp });
  setCart(c);
}
const cartTotal = (c = getCart()) => c.reduce((t, x) => t + x.clp * x.qty, 0);
// ---------- Bolsa y boleta v3: desglose por producto (mismo cálculo que el precio puesto en Chile) ----------
// state.offerCache: ofertas abiertas por link (p. ej. reservadas para la clienta), que no vienen en state.offers
const b3Offer = (x) => (state.offers || []).find((o) => String(o.id) === String(x.offer_id)) || (state.offerCache || {})[x.offer_id];
async function cacheOffers(items) {
  for (const x of items || []) if (x.offer_id && !b3Offer(x)) { try { const o = await state.api.getOffer(x.offer_id); if (o) (state.offerCache = state.offerCache || {})[o.id] = o; } catch {} }
}
const b3Units = (x) => (x.promo ? 1 : x.qty);                 // unidades cobradas (el 2×1 cobra 1)
function b3Quote(x) {
  const o = b3Offer(x) || { category: x.category };
  const base = { ...o, price_usd: Number(x.price_usd) || 0 };
  return x.promo === "2x1" ? quote2x1(base) : quote(base.price_usd, base);
}
// Recalcula el precio en pesos con el dólar de hoy (si la oferta sigue publicada)
function b3Fresh(items) {
  let changed = false;
  const out = items.map((x) => { if (!b3Offer(x)) return x; const c = b3Quote(x).clp; if (c === x.clp) return x; changed = true; return { ...x, clp: c }; });
  return { items: out, changed };
}
function b3Breakdown(items) {
  const K = ["price", "tax", "fee", "ship", "duty", "vat", "fixed", "customs", "total"], t = { kg: 0, clp: 0 };
  K.forEach((k) => (t[k] = 0));
  const lines = items.map((x) => {
    const q = b3Quote(x), m = b3Units(x);
    K.forEach((k) => (t[k] += (q[k] || 0) * m)); t.kg += (q.w?.charge || 0) * m; t.clp += (Number(x.clp) || 0) * m;
    return { x, q, m, usd: q.price * m };
  });
  const s = state.settings;
  t.fx = Number(s.usd_clp) || 0; t.exact = Math.round(t.total * t.fx); t.round = t.clp - t.exact;
  t.roundLbl = t.round >= 0 && t.round < 100 * Math.max(1, lines.length) ? "Redondeo a la centena" : "Ajuste por tipo de cambio";
  return { lines, t };
}
const b3Desc = (x) => [x.brand, x.color ? "Color " + x.color : "", x.size ? "Talla " + x.size : "", "Cant. " + x.qty + (x.promo === "2x1" ? " (2×1)" : "")].filter(Boolean);
// Filas de totales (las mismas en pantalla, WhatsApp y PDF)
function b3Totals(t, share) {
  const s = state.settings;
  return [
    ["Subtotal precio en tienda", usd(t.price)],
    [`Impuesto Florida ${fmtPct(s.fl_tax_pct)}%`, usd(t.tax)],
    [`Comisión personal shopper ${fmtPct(s.fee_pct)}%`, usd(t.fee)],
    [`Envío courier a Chile (${fmtKg(t.kg)} kg)`, usd(t.ship)],
    [`Aduana: arancel ${fmtPct(s.cl_duty_pct)}% + IVA ${fmtPct(s.cl_vat_pct)}% + cargo fijo`, usd(t.customs)],
    ["Total US$", usd(t.total), "sum"],
    ["Dólar del día", clp(t.fx)],
    ["Total US$ × dólar", clp(t.exact)],
    ...(t.round ? [[t.roundLbl, (t.round < 0 ? "−" : "") + clp(Math.abs(t.round))]] : []),
    ["TOTAL A PAGAR (CLP)", clp(t.clp), "grand"],
    ...(share ? [["Tu parte (50%)", clp(share), "share"]] : []),
  ];
}
function openCart() {
  // directo a la caja (la bolsa vive dentro de la caja); si está vacía, se avisa
  if (getCart().length) { $("#sheet-root").innerHTML = ""; state.tab = "caja"; state.cajaDone = null; state.cajaSplit = null; state.cajaGroup = null; navCommit(); render(); return; }
  let idx = 0;
  const draw = (el) => {
    const fr = b3Fresh(getCart());
    if (fr.changed) setCart(fr.items);
    const c = fr.items, n = c.length;
    idx = Math.max(0, Math.min(idx, n - 1));
    el.closest(".sheet")?.classList.add("b3-sheet");
    const big = (x, i) => {
      const o = b3Offer(x), ph = (o ? photosOf(o)[0]?.url : "") || x.photo, m = b3Units(x);
      return `<article class="b3-card" aria-roledescription="producto" aria-label="${i + 1} de ${n}: ${esc(x.title)}">
        <div class="b3-photo">${ph ? `<img src="${esc(ph)}" alt="${esc(x.title)}" draggable="false" ${i > 1 ? `loading="lazy"` : ""}>` : `<span class="b3-mono" aria-hidden="true">${esc((x.brand || x.title || "M").charAt(0))}</span>`}
          ${x.promo === "2x1" ? `<span class="b3-tag">2×1</span>` : ""}</div>
        <div class="b3-info">
          <span class="b3-brand">${esc(x.brand || "Sin marca")}</span>
          <h3 class="b3-title">${esc(x.title)}</h3>
          <div class="b3-pick">${x.color ? `<span><i style="--c:${colorHex(x.color)}"></i>Color <b>${esc(x.color)}</b></span>` : ""}${x.size ? `<span>Talla <b>${esc(x.size)}</b></span>` : ""}</div>
          <div class="b3-row">
            <div class="b3-qty" role="group" aria-label="Cantidad"><button type="button" data-dec="${esc(x.key)}" aria-label="Uno menos" ${x.promo ? "disabled" : ""}>−</button><b aria-live="polite">${x.qty}</b><button type="button" data-inc="${esc(x.key)}" aria-label="Uno más" ${x.promo ? "disabled" : ""}>+</button></div>
            <button type="button" class="b3-rm" data-rm="${esc(x.key)}">Quitar</button>
          </div>
          <div class="b3-price"><div><b>${clp(x.clp * m)}</b><span>puesto en Chile${m > 1 ? ` · ${clp(x.clp)} c/u` : ""}</span></div><span class="b3-usd">${usd(x.price_usd * m)} en tienda</span></div>
        </div></article>`;
    };
    el.innerHTML = `<div class="grab"></div><h2 class="b3-h">Tu carro</h2>
      ${n ? `<div class="b3-status"><span>${cartCount()} ${cartCount() === 1 ? "artículo" : "artículos"}</span>
          ${n > 1 ? `<span class="b3-nav"><button type="button" id="b3prev" aria-label="Producto anterior">‹</button><span id="b3pos">${idx + 1} / ${n}</span><button type="button" id="b3next" aria-label="Producto siguiente">›</button></span>` : ""}</div>
        <div class="b3-track" id="b3track" tabindex="0" aria-label="Productos en tu carro, desliza para ver más">${c.map(big).join("")}</div>
        <div class="b3-foot">
          <div class="b3-total"><span>Total puesto en Chile</span><b>${clp(cartTotal(c))}</b></div>
          <button class="btn gold block" id="to-caja">Ir a la caja</button>
          <button class="btn ghost block" id="to-split">Pagar a medias con una amiga</button>
          <button class="btn ghost block" data-close>Seguir comprando</button>
        </div>`
      : `<div class="empty" style="color:var(--ink-muted)">Tu carro está vacío. Recorre las vitrinas y agrega lo que te guste.</div><button class="btn ghost block" data-close style="margin-top:12px">Volver al mall</button>`}`;
    const tr = el.querySelector("#b3track");
    const step = () => (tr ? tr.clientWidth : 1);
    const paintPos = () => { const p = el.querySelector("#b3pos"); if (!p) return; p.textContent = `${idx + 1} / ${n}`; el.querySelector("#b3prev").disabled = idx <= 0; el.querySelector("#b3next").disabled = idx >= n - 1; };
    const goTo = (i) => { idx = Math.max(0, Math.min(n - 1, i)); tr.scrollTo({ left: idx * step(), behavior: reduceMotion() ? "auto" : "smooth" }); paintPos(); };
    if (tr) {
      tr.style.scrollBehavior = "auto"; tr.scrollLeft = idx * step(); tr.style.scrollBehavior = "";
      tr.addEventListener("scroll", () => requestAnimationFrame(() => { const i = Math.round(tr.scrollLeft / step()); if (i !== idx && i >= 0 && i < n) { idx = i; paintPos(); } }), { passive: true });
      tr.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); goTo(idx + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); goTo(idx - 1); } });
      paintPos();
    }
    el.querySelector("#b3prev") && (el.querySelector("#b3prev").onclick = () => goTo(idx - 1));
    el.querySelector("#b3next") && (el.querySelector("#b3next").onclick = () => goTo(idx + 1));
    el.querySelectorAll("[data-inc],[data-dec],[data-rm]").forEach((b) => (b.onclick = () => {
      const cc = getCart(), it = cc.find((x) => x.key === (b.dataset.inc || b.dataset.dec || b.dataset.rm));
      if (!it) return;
      if (b.dataset.rm) { it.qty = 0; toast("Quitado de tu carro"); } else it.qty += b.dataset.inc ? 1 : -1;
      setCart(cc.filter((x) => x.qty > 0)); draw(el);
    }));
    el.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => $("#sheet-root").innerHTML = ""));
    const ts = el.querySelector("#to-split");
    if (ts) ts.onclick = () => { $("#sheet-root").innerHTML = ""; walk(["Caminando a la caja…"], () => { state.tab = "caja"; state.cajaDone = null; state.cajaGroup = null; state.cajaSplit = { kind: "split", items: getCart(), fromCart: true }; navCommit(); render(); }); };
    const tc = el.querySelector("#to-caja");
    if (tc) tc.onclick = () => { $("#sheet-root").innerHTML = ""; walk(["Caminando a la caja…"], () => { state.tab = "caja"; state.cajaDone = null; state.cajaSplit = null; state.cajaGroup = null; navCommit(); render(); }); };
  };
  sheet("", (el) => draw(el));
}

// ---------- Links y WhatsApp ----------
const appBase = () => (CFG.APP_URL || location.href.split("#")[0]).replace(/#.*$/, "");
const appLink = (hash) => appBase() + "#" + hash;
const waShare = (text) => "https://wa.me/?text=" + encodeURIComponent(text);            // abre WhatsApp para elegir a quién
const waTo = (phone, text) => { const n = String(phone || "").replace(/[^\d]/g, ""); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text || "")}` : ""; };
const cherylName = () => state.settings.cashier_name || "Cheryl";
const contactCherylLink = (text) => waTo(state.settings.whatsapp, text || `Hola ${cherylName()}, te escribo desde ${APP_NAME}.`);
// link de tienda: #s-01 … #s-10 = n° de vitrina del mall (tiendas.js; los viejos #s-0…#s-8 se siguen aceptando)
const shopIndex = (cat) => TIENDAS.linkCode(cat);
const is2x1 = (o) => o && o.promo === "2x1";
// precio de 2 unidades por el valor de 1 (envío y aduana por las 2)
function quote2x1(o) {
  const it = { ...o, weight_kg: kgOf(o) * 2, box_l: boxOf(o)[0], box_w: boxOf(o)[1], box_h: boxOf(o)[2] * 2 };
  return quote(o.price_usd, it);
}

// ---------- Datos de transferencia ----------
function bankRows() {
  const s = state.settings;
  return [["Banco", s.bank_name], ["Tipo de cuenta", s.bank_account_type], ["N° de cuenta", s.bank_account], ["RUT", s.bank_rut], ["Nombre", s.bank_holder], ["Correo", s.bank_email]].filter((r) => r[1]);
}
function bankHTML(total) {
  const rows = bankRows();
  if (!rows.length) return `<div class="quote" style="white-space:pre-line">${esc(state.settings.payment_instructions)}</div>`;
  return `<div class="bank">${total ? `<div class="bank-row total"><span>Monto a transferir</span><b>${clp(total)}</b><button class="copy" data-copy="${Math.round(total)}">Copiar</button></div>` : ""}
    ${rows.map(([k, v]) => `<div class="bank-row"><span>${esc(k)}</span><b>${esc(v)}</b><button class="copy" data-copy="${esc(v)}">Copiar</button></div>`).join("")}
    <button class="btn ghost block sm" id="copy-all" style="margin-top:8px">Copiar todos los datos</button></div>
    ${state.settings.payment_instructions ? `<p class="small muted" style="margin:8px 0 0">${esc(state.settings.payment_instructions)}</p>` : ""}`;
}
function wireCopy(el, total) {
  el.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copiado"); } catch { toast("No se pudo copiar"); } }));
  const all = el.querySelector("#copy-all");
  if (all) all.onclick = async () => { try { await navigator.clipboard.writeText((total ? `Monto: ${Math.round(total)}\n` : "") + bankRows().map(([k, v]) => `${k}: ${v}`).join("\n")); toast("Datos copiados"); } catch { toast("No se pudo copiar"); } };
}
const CASHIER_DEFAULT = "cheryl.jpg";
const cashierSrc = () => state.settings.cashier_photo || CASHIER_DEFAULT;
const cashierFace = () => `<img src="${esc(cashierSrc())}" alt="${esc(state.settings.cashier_name || "Cheryl")}">`;
function whatsappLink(text) { const wa = (state.settings.whatsapp || "").replace(/[^\d]/g, ""); return wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : ""; }

// ---------- Vistas del mall ----------
function mallHome(view) {
  const shops = shopList().filter((x) => x.cat !== LAST);
  const open = shops.filter((x) => x.n);
  const lm = offersIn(LAST).length;
  view.innerHTML = `
    ${hallRender() ? `<div class="hero-render"><img src="${esc(hallRender())}" alt="Pasillo de ${esc(mallName())}"></div>`
      : mallPhotos().length ? `<div class="hero-photo" style="background-image:url('${esc(mallPhotos()[0])}')"><div class="cc-vignette"></div></div>` : concourseHTML(mallName(), open.length ? open : shops, true)}
    <div class="cc-caption"><span class="small muted">Bienvenida a</span><h2>${esc(mallName())}</h2></div>
    ${liveBanner()}
    <p class="lede">Elige una tienda abajo y te llevamos caminando hasta su vitrina.</p>
    ${lm ? `<button class="lm-banner" data-go="${LAST}"><span class="bolt">${ICON.bolt}</span><span class="grow"><b>${esc(LAST_NAME)} · ofertas de último minuto</b><span>${lm} ${lm === 1 ? "hallazgo" : "hallazgos"} a precio especial, solo hoy</span></span><span class="go">Ir →</span></button>` : ""}
    <div class="search-row"><input class="in" id="q" placeholder="¿Buscas algo puntual? Marca o producto…"><button class="btn sm gold" id="qgo">Buscar</button></div>`;
  view.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => goStore(b.dataset.go)));
  const run = () => { const v = $("#q").value.trim(); if (!v) return; state.q = v; walk(["Buscando en todo el mall…"], () => { state.mallView = "tienda"; state.cat = "__search"; state.filters = freshFilters(); navCommit(); render(); }); };
  $("#qgo").onclick = run; $("#q").onkeydown = (e) => { if (e.key === "Enter") run(); };
}
// ---------- Vitrina con flyers pegados en el vidrio ----------
// Hasta 4 ofertas: mayor descuento primero, luego las más nuevas
// Con campanas.js: las 4 pantallas de "Afiches de la vitrina" en orden (ofertas y fotos subidas { __photo })
const vfPicks = (items) => (window.MSCampanas && state.cat ? window.MSCampanas.vitrinaItems(state.cat) : typeof vitrinaPicks === "function" && state.cat ? vitrinaPicks(state.cat) : [...items].sort((a, b) => (Number(b.discount_pct) || 0) - (Number(a.discount_pct) || 0) || String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 4)).slice(0, 4);
// rotación estable (−2°..2°) por oferta, para que no "baile" al re-renderizar
const vfTilt = (id, i) => { let h = 7 + i; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 401) / 100 - 2).toFixed(2); };
// Reparte n flyers (3:4) dentro del vidrio [x,y,w,h] normalizado; ar = ancho/alto de la imagen.
// Cobertura objetivo: 2 → ~50%, 3 → ~65%, 4 → ~80% del vidrio. Devuelve rects en % del contenedor.
function vfLayout(n, glass, ar = 9 / 16) {
  // los flyers pueden asomar un poco sobre el marco del vidrio (como afiches pegados de borde a borde)
  const [gx, gy0, gw, gh0] = glass, gy = gy0 - gh0 * 0.06, gh = gh0 * 1.12, H = 1 / ar, GW = gw, GH = gh * H, GY = gy * H;
  const target = n <= 1 ? 0.32 : n === 2 ? 0.5 : n === 3 ? 0.65 : 0.8;
  // vitrina ancha (≈2.3:1): los flyers en una sola fila, verticales
  const opts = n <= 1 ? [[1]] : n === 2 ? [[2]] : n === 3 ? [[3], [2, 1]] : [[4], [2, 2]];
  let best = null;
  for (const rows of opts) {
    const cols = Math.max(...rows), nr = rows.length, gap = Math.min(GW, GH) * 0.045;
    const maxW = (GW * 0.95 - gap * (cols - 1)) / cols, maxH = (GH * 0.95 - gap * (nr - 1)) / nr;
    const A = (target * GW * GH) / n;
    let w = Math.sqrt(A / (4 / 3)), h = w * (4 / 3);
    if (h > maxH) { h = maxH; w = Math.min(A / h, h / 1.12, maxW); }
    if (w > maxW) { w = maxW; h = Math.min(A / w, w * 1.45, maxH); }
    const cov = (n * w * h) / (GW * GH), score = Math.abs(cov - target);
    if (!best || score < best.score) best = { rows, w, h, gap, score };
  }
  const { rows, w, h, gap } = best, blockH = rows.length * h + (rows.length - 1) * gap, out = [];
  let y = GY + (GH - blockH) / 2;
  rows.forEach((k) => {
    let x = gx + (GW - (k * w + (k - 1) * gap)) / 2;
    for (let j = 0; j < k; j++) { out.push([x * 100, (y / H) * 100, w * 100, (h / H) * 100]); x += w + gap; }
    y += h + gap;
  });
  return out;
}
function vfFlyer(o, i, rect) {
  if (o.__photo) return window.MSCampanas.flyerHTML(o, i, "vf");   // foto subida a una pantalla (campanas.js)
  const q = quote(o.price_usd, o), d = discOf(o), ph = photosOf(o)[0];
  const pos = rect ? `left:${rect[0].toFixed(2)}%;top:${rect[1].toFixed(2)}%;width:${rect[2].toFixed(2)}%;height:${rect[3].toFixed(2)}%;` : "";
  const label = `${o.title}${o.brand ? ", " + o.brand : ""}${d ? `, −${fmtPct(o.discount_pct)}%` : ""}${is2x1(o) ? ", 2×1" : ""}, ${clp(q.clp)} puesto en Chile${d ? `, antes ${usd(o.tag_price_usd)}` : ""}`;
  return `<button class="vf-flyer${rect ? "" : " vf-flow"}" data-open="${esc(o.id)}" style="${pos}--r:${vfTilt(o.id, i)}deg;--i:${i}" aria-label="${esc(label)}">
      <span class="vf-paper">
        <span class="vf-photo">${ph ? `<img src="${esc(ph.url)}" alt="" decoding="async">` : `<span class="vf-emo">${catOf(o.category).emoji}</span>`}</span>
        <span class="vf-info">
          ${o.brand ? `<span class="vf-brand">${esc(o.brand)}</span>` : ""}
          <span class="vf-title">${esc(o.title)}</span>
          <span class="vf-price"><b>${clp(q.clp)}</b>${d ? `<s>${usd(o.tag_price_usd)}</s>` : ""}</span>
          <span class="vf-cl">puesto en Chile</span>
        </span>
      </span>
      ${d ? discBadges(o, "vf-badge") : is2x1(o) ? `<span class="vf-badge vf-2x1">2×1</span>` : ""}
      ${d && is2x1(o) ? `<span class="vf-badge vf-2x1 vf-b2">2×1</span>` : ""}
      <span class="vf-tape vf-ta" aria-hidden="true"></span><span class="vf-tape vf-tb" aria-hidden="true"></span>
      <span class="vf-sheen" aria-hidden="true"></span>
    </button>`;
}
// ---------- Vitrina v3: fachada recortada (sin cielo ni piso), flyers grandes y visor ----------
// Flyer v3: todos iguales, con la misma caja de foto cuadrada (la foto "contain" centrada)
function vf3Flyer(o, i) {
  if (o.__photo) return window.MSCampanas.flyerHTML(o, i, "vf3");  // foto subida a una pantalla (campanas.js)
  const q = quote(o.price_usd, o), d = discOf(o), ph = photosOf(o)[0];
  const label = `${o.title}${o.brand ? ", " + o.brand : ""}${d ? `, −${fmtPct(o.discount_pct)}%` : ""}${is2x1(o) ? ", 2×1" : ""}, ${clp(q.clp)} puesto en Chile${d ? `, antes ${usd(o.tag_price_usd)}` : ""}. Ver foto grande`;
  return `<button type="button" class="vf3-flyer" data-vf3="${esc(o.id)}" style="--r:${(vfTilt(o.id, i) * 0.45).toFixed(2)}deg;--i:${i}" aria-label="${esc(label)}">
      <span class="vf3-paper">
        <span class="vf3-photo">${ph ? `<img src="${esc(ph.url)}" alt="" decoding="async">` : `<span class="vf3-nophoto">${esc((o.brand || o.title || "").charAt(0))}</span>`}</span>
        <span class="vf3-info">
          <span class="vf3-name">${o.brand ? `<span class="vf3-brand">${esc(o.brand)}</span>` : ""}<span class="vf3-title">${esc(o.title)}</span></span>
          <span class="vf3-price"><b>${clp(q.clp)}</b>${d ? `<s>${usd(o.tag_price_usd)}</s>` : ""}</span>
          <span class="vf3-cl">puesto en Chile</span>
        </span>
      </span>
      ${d ? discBadges(o, "vf3-badge") : is2x1(o) ? `<span class="vf3-badge vf3-2x1">2×1</span>` : ""}
      <span class="vf3-tape vf3-ta" aria-hidden="true"></span><span class="vf3-tape vf3-tb" aria-hidden="true"></span>
    </button>`;
}
// Encuadre: la ventana visible va desde un poco sobre el letrero LED hasta un poco bajo el vidrio.
// Teléfono: llena el alto y recorta los lados (centrado en el vidrio). Pantalla ancha: llena el ancho
// mientras se vea el letrero completo; si sobra ancho, los costados muestran la misma fachada desenfocada.
function vf3Fit(screen, rr, glass, n, name) {
  const scene = screen.querySelector(".vf3-scene"), img = scene.querySelector(".vf3-img");
  if (!scene.isConnected) return false;
  const sb = $(".storebar"), door = screen.querySelector(".vf3-door");
  const top = screen.getBoundingClientRect().top + window.scrollY;
  const fixedH = Number((screen.closest("[data-vf3h]") || {}).dataset?.vf3h) || 0;   // vista previa (panel de la shopper): alto fijo
  const avail = fixedH || Math.max(window.innerHeight - top - (sb && !document.body.classList.contains("vit-mode") ? sb.offsetHeight : 0), 380);
  screen.style.height = avail + "px";
  const W = scene.clientWidth, H = scene.clientHeight;
  const A = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : Number(rr.w) > 0 && Number(rr.h) > 0 ? rr.w / rr.h : 9 / 16;
  const [gx, gy, gw, gh] = glass;
  // en pantallas verticales el letrero se muestra más bajo (franja nítida encima) para dar más alto al vidrio
  const tall = W / Math.max(1, H) < 1;
  let s, iw, left, tpx;
  if (rr.clean) {
    // foto limpia de vitrina (render Cycles): llena toda la pantalla, sin bandas ni desenfoque, centrada en el vidrio
    s = Math.max(W / A, H, Math.min(W / (gw * A), H / 0.6)); iw = A * s;   // en teléfono: solo el vidrio, sin marcos
    const V = H / s, cyU = gy + gh / 2;
    tpx = -Math.min(Math.max(0, cyU - V / 2), Math.max(0, 1 - V)) * s;
    left = Math.min(0, Math.max(W - iw, W / 2 - (gx + gw / 2) * iw));
  } else {
  const cT = Math.max(0, gy - (tall ? 0.055 : 0.105)), cB = Math.min(1, gy + gh + 0.012), cH = cB - cT, minV = gh + (tall ? 0.04 : 0.1);
  s = Math.min(Math.max(W / A, H / cH), H / minV);           // px por unidad (alto de la imagen = 1)
  iw = A * s; const V = H / s, ex = Math.max(0, cH - V);
  left = iw >= W ? Math.min(0, Math.max(W - iw, W / 2 - (gx + gw / 2) * iw)) : (W - iw) / 2;
  const topU = cT + Math.max(0, ex - 0.012);                        // recorta casi todo por arriba: el vidrio queda entero
  tpx = -topU * s;
  }
  Object.assign(img.style, { width: iw + "px", height: s + "px", left: left + "px", top: tpx + "px" });
  scene.classList.toggle("vf3-clean", !!rr.clean);
  scene.classList.toggle("vf3-narrow", iw < W - 1);
  // vidrio en pantalla (intersección con lo visible)
  const G = { x: left + gx * iw, y: tpx + gy * s, w: gw * iw, h: gh * s };
  const vx0 = Math.max(0, G.x), vx1 = Math.min(W, G.x + G.w), vy0 = Math.max(0, G.y), vy1 = Math.min(H, G.y + G.h);
  // letrero nítido encima del LED cuando el recorte lo corta (texto siempre completo y legible)
  const sign = scene.querySelector(".vf3-sign");
  if (sign) {
    const clipped = !rr.clean && (G.x < -2 || G.x + G.w > W + 2);
    sign.hidden = !clipped;
    if (clipped) {
      const sy0 = Math.max(0, tpx + (gy - 0.109) * s), sh = tpx + (gy - 0.007) * s - sy0;
      const fs = Math.min(sh * 0.34, ((vx1 - vx0) * 0.84) / Math.max(6, name.length * 0.74));
      Object.assign(sign.style, { left: "0px", width: W + "px", top: sy0 + "px", height: sh + "px", fontSize: Math.max(15, fs) + "px" });
    }
  }
  // flyers: todos del mismo tamaño, foto cuadrada idéntica
  const flyers = [...scene.querySelectorAll(".vf3-flyer")];
  if (!flyers.length) return true;
  const padX = Math.max(6, (vx1 - vx0) * 0.018), padY = Math.max(6, (vy1 - vy0) * 0.022);   // afiches grandes: 60-70% del vidrio
  // el botón "Entrar a la tienda" va sobre el piso, encima de la foto: los afiches no lo tapan
  const dR = door && getComputedStyle(door).position === "absolute" ? door.offsetHeight + 4 : 0, vyB = Math.min(vy1, H - dR);
  // rieles laterales flotantes (vitrina despejada): los afiches no quedan debajo de los botones
  const sc = scene.getBoundingClientRect(), railL = document.body.classList.contains("vit-mode") ? $(".demo-bar") : null, railR = document.body.classList.contains("vit-mode") ? $("header.top.client") : null;
  const rt = railL ? Math.max(0, railL.getBoundingClientRect().bottom - sc.top + 6) : 0, rr2 = railR ? Math.max(0, sc.right - railR.getBoundingClientRect().left + 6) : 0;
  const vxL = vx0, vxR = Math.min(vx1, W - rr2), vyT = Math.max(vy0, rt);
  const ax = vxL + padX, ay = vyT + padY, aw = vxR - vxL - 2 * padX, ah = vyB - vyT - 2 * padY;
  const rows = n <= 1 ? [1] : n === 2 ? [2] : n === 3 ? [2, 1] : [2, 2], cols = Math.max(...rows), nr = rows.length;
  const gap = Math.min(28, Math.max(10, aw * 0.05));
  const VF_SCALE = rr.clean && tall ? 0.88 : 0.95;   // afiches ≈65% del vidrio: se sigue viendo el interior detrás
  const cw = ((aw - gap * (cols - 1)) / cols) * VF_SCALE, ch = ((ah - gap * (nr - 1)) / nr) * VF_SCALE;
  // medidas del papel: caja de foto Pw×Ph idéntica en todos los flyers (R = ancho/alto de la caja)
  const dims = (Pw, R, horiz) => {
    const Ph = Pw / R, m = Math.min(Pw, Ph);
    const p = Math.round(Math.min(12, Math.max(6, m * 0.05)));
    const fp = Math.round(Math.min(30, Math.max(17, Math.min(m * 0.12, Pw / 6.2)))), fsm = Math.round(Math.min(15, Math.max(13, m * 0.07)));
    const full = horiz || Pw >= 150;
    const info = Math.round(fp * 1.15 + fsm * 1.3 + (full ? fsm * 1.35 + 4 : 0) + 8);
    return horiz ? { w: Pw + 2 * p + Math.max(160, Pw * 0.95), h: Ph + 2 * p, Pw, Ph, p, fp, fsm, full }
      : { w: Pw + 2 * p, h: Ph + 2 * p + info, Pw, Ph, p, fp, fsm, full };
  };
  const fit = (R, horiz) => {        // mayor caja que entra en la celda
    let lo = 40, hi = 900;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2, dd = dims(m, R, horiz); if (dd.w <= cw && dd.h <= ch) lo = m; else hi = m; }
    return lo;
  };
  let best = null;
  for (const [R, horiz] of [[1, false], [1.15, false], [1.3, false], [1, true]]) {
    const Pw = Math.min(fit(R, horiz), n === 1 ? 900 : 700), area = Pw * (Pw / R) * (horiz ? 0.92 : 1);
    if (!best || area > best.area) best = { Pw, R, horiz, area };
  }
  const horiz = best.horiz, d = dims(Math.floor(best.Pw), best.R, horiz), S = d.Pw;
  const blockH = nr * d.h + (nr - 1) * gap;
  let y = ay + (ah - blockH) / 2, k = 0;
  rows.forEach((cnt) => {
    let x = ax + (aw - (cnt * d.w + (cnt - 1) * gap)) / 2;
    if (cols > 1 && cnt === 1 && rows.length > 1) x = ax + (aw - d.w) / 2;
    for (let j = 0; j < cnt; j++, k++) {
      const f = flyers[k]; if (!f) continue;
      Object.assign(f.style, { left: x + "px", top: y + "px", width: d.w + "px", height: d.h + "px" });
      f.style.setProperty("--S", d.Pw + "px"); f.style.setProperty("--Sh", d.Ph + "px"); f.style.setProperty("--p", d.p + "px");
      f.style.setProperty("--fp", d.fp + "px"); f.style.setProperty("--fsm", d.fsm + "px");
      f.classList.toggle("vf3-h", horiz); f.classList.toggle("vf3-full", d.full); f.classList.toggle("vf3-slim", !horiz && d.Pw < 175);
      x += d.w + gap;
    }
    y += d.h + gap;
  });
  return true;
}
// Visor de un flyer: solo su foto grande y su precio puesto en Chile. "Atrás" / Escape / Volver lo cierran.
function vf3Viewer(o, from) {
  const root = $("#sheet-root");
  const q = quote(o.price_usd, o), d = discOf(o), ph = photosOf(o)[0];
  const pushed = !root.firstElementChild;
  root.innerHTML = `<div class="vf3-viewer" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <div class="vf3-vbar"><button type="button" class="vf3-back"><span aria-hidden="true">←</span> Volver a la vitrina</button></div>
      <div class="vf3-vbody">
        <figure class="vf3-vfig">${ph ? `<img src="${esc(ph.url)}" alt="${esc(o.title)}">` : `<span class="vf3-nophoto">${esc((o.brand || o.title || "").charAt(0))}</span>`}
          ${d ? discBadges(o, "vf3-vbadge") : is2x1(o) ? `<span class="vf3-vbadge vf3-2x1">2×1</span>` : ""}</figure>
        <div class="vf3-vinfo">
          ${o.brand ? `<span class="vf3-vbrand">${esc(o.brand)}</span>` : ""}
          <h2 class="vf3-vtitle">${esc(o.title)}</h2>
          <div class="vf3-vprice"><b>${clp(q.clp)}</b>${d ? `<s>${usd(o.tag_price_usd)}</s>` : ""}</div>
          <span class="vf3-vcl">puesto en Chile${is2x1(o) ? " · llevas 2 por el precio de 1" : ""}</span>
        </div>
      </div>
    </div>`;
  const el = root.firstElementChild, back = el.querySelector(".vf3-back");
  if (pushed) overlayPushed();
  const close = () => { if (root.firstElementChild !== el) return; if (pushed) history.back(); else root.innerHTML = ""; };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  document.addEventListener("keydown", onKey);
  // al quitarse (Volver, Escape o "atrás" del navegador vía closeTopOverlay) se limpia y el foco vuelve al flyer
  const mo = new MutationObserver(() => {
    if (el.isConnected) return;
    mo.disconnect(); document.removeEventListener("keydown", onKey);
    if (from && from.isConnected) from.focus({ preventScroll: true });
  });
  mo.observe(root, { childList: true });
  back.onclick = close;
  requestAnimationFrame(() => { el.classList.add("vf3-on"); back.focus({ preventScroll: true }); });
}
function storeWindow(view) {
  const cat = state.cat, items = offersIn(cat);
  const picks = vfPicks(items);
  const maxD = Math.max(0, ...items.map((o) => Number(o.discount_pct) || 0));
  const ph = storePhoto(cat), rr = storeRender(cat);
  const door = items.length ? `<button class="btn gold block vf-enter vf3-enter" id="enter"><span>Entrar a la tienda</span><span class="vf-arrow" aria-hidden="true">→</span></button>`
    : `<button class="btn gold block vf3-enter" id="ask">Encargarle algo de ${esc(shopName(cat))} a tu shopper</button>`;
  if (rr && !ph) {
    const glass = Array.isArray(rr.glass) && rr.glass.length === 4 ? rr.glass.map(Number) : [0.06, 0.3, 0.88, 0.4];
    const name = shopName(cat);
    view.innerHTML = `<section class="vf3-screen" aria-label="Vitrina de ${esc(name)}">
        <div class="vf3-scene">
          <span class="vf3-blur" style="background-image:url('${esc(rr.src)}')" aria-hidden="true"></span>
          <img class="vf3-img" src="${esc(rr.src)}" alt="Vitrina de ${esc(name)}">
          <span class="vf3-sign" hidden aria-hidden="true"><span>${esc(name)}</span></span>
          ${picks.length ? `<div class="vf3-flyers vf3-n${picks.length}" role="group" aria-label="Ofertas en la vitrina: toca una para verla en grande">${picks.map((o, i) => vf3Flyer(o, i)).join("")}</div>`
            : `<div class="vf3-empty"><b>Vitrina en preparación</b><span>Tu shopper todavía no publica en esta tienda hoy.</span></div>`}
        </div>
        <div class="vf3-door">
          <div class="vf3-plate"><span class="vf3-pname">${esc(name)}</span><span class="vf3-pnote">${items.length ? (maxD ? `Ofertas hasta −${fmtPct(maxD)}%` : "Ofertas de hoy") : "Pronto con ofertas"}</span></div>
          ${door}
        </div>
      </section>`;
    const screen = view.querySelector(".vf3-screen"), img = screen.querySelector(".vf3-img");
    const refit = () => vf3Fit(screen, rr, glass, picks.length, name);
    refit(); if (!img.complete) img.addEventListener("load", refit, { once: true });
    if (window.__vf3Resize) window.removeEventListener("resize", window.__vf3Resize);
    window.__vf3Resize = () => { if (!refit()) { window.removeEventListener("resize", window.__vf3Resize); window.__vf3Resize = null; } };
    window.addEventListener("resize", window.__vf3Resize);
    document.fonts && document.fonts.ready.then(() => screen.isConnected && refit());
  } else {
    view.innerHTML = `<div class="shopfront f-${facadeOf(cat)} ${ph ? "has-photo" : ""}" ${ph ? `style="--facade:url('${esc(ph)}')"` : ""}>
      <div class="sf-band"><span>${esc(shopName(cat))}</span></div>
      <div class="sf-window vf-window">
        <span class="sf-light"></span>
        ${items.length ? `<div class="vf-grid vf-n${picks.length}" role="group" aria-label="Ofertas en la vitrina">${picks.map((o, i) => vfFlyer(o, i)).join("")}</div>
          ${maxD ? `<span class="decal">Hasta −${fmtPct(maxD)}%</span>` : `<span class="decal">Nuevo hoy</span>`}`
        : `<div class="sf-empty"><b>Vitrina en preparación</b><span>Tu shopper todavía no publica en esta tienda hoy.</span></div>`}
        <span class="sf-glass"></span>
      </div>
      <div class="sf-door">${door}</div>
    </div>`;
  }
  // tocar un flyer NO entra a la tienda: abre el visor con la foto grande y el precio
  const byId = new Map(picks.map((o) => [String(o.id), o]));
  view.querySelectorAll("[data-vf3],[data-open]").forEach((b) => (b.onclick = () => { const o = byId.get(String(b.dataset.vf3 || b.dataset.open)); if (o) vf3Viewer(o, b); }));
  const enterStore = () => { state.mallView = "tienda"; navCommit(); render(); };
  // Mujer / Hombre: se pregunta una sola vez (queda guardado); Lencería y Carteras entran directo
  $("#enter") && ($("#enter").onclick = () => (shopNeedsGender(cat) && !getGender() ? askGender(cat, enterStore) : enterStore()));
  $("#ask") && ($("#ask").onclick = () => go("encargos"));
}
// Dos placas grandes: "Mujer" / "Hombre", con una foto real de esa tienda en cada una
function genderPlatesHTML(cat) {
  const pool = offersIn(cat);
  const photo = (g) => { const o = pool.find((x) => genderOf(x) === g && photosOf(x)[0]) || pool.find((x) => genderOk(x, g) && photosOf(x)[0]); return o ? photosOf(o)[0].url : ""; };
  const n = (g) => pool.filter((o) => genderOk(o, g)).length;
  return `<div class="gplates" role="group" aria-label="Elige el catálogo">${["mujer", "hombre"].map((g) => `<button type="button" class="gplate" data-gender="${g}">
      ${photo(g) ? `<img src="${esc(photo(g))}" alt="" loading="lazy">` : ""}<span class="gplate-n">${genderLabel(g)}</span></button>`).join("")}</div>`;
}
function askGender(cat, done) {
  sheet(`<h2 class="gask-h">¿Qué catálogo quieres ver?</h2>
    <p class="gask-p">${esc(shopName(cat))}: elige una vez y lo recordamos. Lo cambias cuando quieras arriba, en la tienda.</p>
    ${genderPlatesHTML(cat)}`, (el, close) => el.querySelectorAll("[data-gender]").forEach((b) => (b.onclick = () => { setGender(b.dataset.gender); close(); done(); })));
}
function applyFilters(items, f) {
  let r = items.filter((o) => {
    const p = quote(o.price_usd, o).clp;
    if (f.min != null && p < f.min) return false;
    if (f.max != null && p > f.max) return false;
    if (f.colors.length && !listOf(o.colors).some((c) => f.colors.includes(c))) return false;
    if (f.sizes.length && !listOf(o.sizes).some((z) => f.sizes.includes(z))) return false;
    if (f.brands.length && !f.brands.includes(o.brand || "")) return false;
    return true;
  });
  const P = (o) => quote(o.price_usd, o).clp;
  if (f.sort === "low") r.sort((a, b) => P(a) - P(b));
  else if (f.sort === "high") r.sort((a, b) => P(b) - P(a));
  else if (f.sort === "disc") r.sort((a, b) => (Number(b.discount_pct) || 0) - (Number(a.discount_pct) || 0));
  else r.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return r;
}
const nFilters = (f) => (f.min != null || f.max != null ? 1 : 0) + f.colors.length + f.sizes.length + f.brands.length;
function storeInside(view) {
  const search = state.cat === "__search";
  const q = (state.q || "").toLowerCase();
  const items = search ? (state.offers || []).filter((o) => `${o.title} ${o.brand} ${o.store} ${o.category} ${shopName(shopOfCategory(o.category))} ${listOf(o.colors).join(" ")}`.toLowerCase().includes(q)) : offersIn(state.cat);
  const f = state.filters || (state.filters = freshFilters());
  const shown = applyFilters(items, f);
  const name = search ? `“${state.q}”` : shopName(state.cat);
  const chip = (label, kind, val) => `<button class="fchip" data-rm="${kind}" data-v="${esc(val)}">${esc(label)} ✕</button>`;
  view.innerHTML = `<div class="interior f-${search ? "graphite" : facadeOf(state.cat)}">
      <div class="int-bar"><button class="btn ghost sm" id="back">← ${search ? "Pasillo" : "Vitrina"}</button><span class="int-sign">${esc(name)}</span>
        <button class="btn sm ${nFilters(f) ? "gold" : "ghost"}" id="filt">Filtrar${nFilters(f) ? " (" + nFilters(f) + ")" : ""}</button></div>
      <div class="int-sub"><span></span>
        <select class="in sortsel" id="sort" aria-label="Ordenar"><option value="new">Más nuevos</option><option value="low">Menor precio</option><option value="high">Mayor precio</option></select></div>
      ${nFilters(f) ? `<div class="fchips">${f.min != null || f.max != null ? chip(`${f.min != null ? clp(f.min) : "$0"} – ${f.max != null ? clp(f.max) : "más"}`, "price", "") : ""}${f.colors.map((c) => chip(c, "colors", c)).join("")}${f.sizes.map((z) => chip("Talla " + z, "sizes", z)).join("")}${f.brands.map((b) => chip(b, "brands", b)).join("")}</div>` : ""}
      ${shown.length ? `<div class="shelves">${shown.map((o) => `<button class="slot" data-open="${o.id}" aria-label="${esc(o.title)}">
          <span class="cubby">${o.photo_url ? `<img src="${esc(o.photo_url)}" alt="" loading="lazy">` : `<span class="emo">${catOf(o.category).emoji}</span>`}
            ${discBadges(o, "sticker")}${o.last_minute && state.cat !== LAST ? `<span class="lmtag" aria-label="Último minuto">${ICON.bolt}</span>` : ""}</span>
          <span class="ledge"></span>
          <span class="card-tag"><span class="t">${esc(o.title)}</span><span class="b">${esc(o.brand || "")}</span>
            ${listOf(o.colors).length ? `<span class="dots-c">${listOf(o.colors).slice(0, 6).map((c) => `<i style="--c:${colorHex(c)}" title="${esc(c)}"></i>`).join("")}</span>` : ""}
            <span class="p">${clp(quote(o.price_usd, o).clp)}</span>${discOf(o) ? `<span class="u"><s>${usd(o.tag_price_usd)}</s> ${usd(o.price_usd)} en tienda</span>` : ""}</span>
        </button>`).join("")}</div>`
      : `<div class="empty" style="color:var(--ink-muted)">${items.length ? "Nada calza con esos filtros." : "No encontré productos."}${nFilters(f) ? `<br><button class="btn ghost sm" id="clear" style="margin-top:10px">Limpiar filtros</button>` : ""}</div>`}
    </div>`;
  $("#sort").value = f.sort;
  $("#sort").onchange = () => { f.sort = $("#sort").value; storeInside(view); };
  $("#back").onclick = () => { if (search) { state.q = ""; goStore("mall"); } else navBack(() => { state.mallView = "vitrina"; }); };
  $("#filt").onclick = () => openFilters(items, () => storeInside(view));
  $("#clear") && ($("#clear").onclick = () => { state.filters = { ...freshFilters(), sort: f.sort }; storeInside(view); });
  view.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { const k = b.dataset.rm; if (k === "price") { f.min = f.max = null; } else f[k] = f[k].filter((x) => x !== b.dataset.v); storeInside(view); }));
  view.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openOffer(items.find((o) => o.id === b.dataset.open))));
}
// ---------- Mostrador v2: tallas chilenas, tipo de producto y precios en CLP ----------
// Tablas US → Chile (Chile usa talla europea). Se interpola entre puntos y se redondea a media talla.
const M2_US_W = [[4, 34], [5, 35], [5.5, 35.5], [6, 36], [6.5, 37], [7, 37.5], [7.5, 38], [8, 38.5], [8.5, 39], [9, 40], [9.5, 40.5], [10, 41], [10.5, 41.5], [11, 42], [12, 43]];
const M2_US_M = [[6, 39], [6.5, 39.5], [7, 40], [7.5, 40.5], [8, 41], [8.5, 41.5], [9, 42], [9.5, 42.5], [10, 43], [10.5, 43.5], [11, 44], [11.5, 44.5], [12, 45], [13, 46], [14, 47], [15, 48]];
const m2Men = (o) => /\b(hombres?|men|man|mens|varón|varon|caballeros?)\b/i.test(`${o?.title || ""} ${o?.brand || ""} ${o?.product_type || ""}`);
const m2Half = (n) => (Math.round(n * 2) / 2).toLocaleString("es-CL", { maximumFractionDigits: 1 });
// Devuelve la talla chilena de un zapato ("38", "37,5"). Si no parece un número, la deja tal cual.
function clShoeSize(s, o) {
  const raw = String(s ?? "").trim(), m = raw.replace(",", ".").match(/^(?:us\s*)?(\d{1,2}(?:\.\d)?)\s*(?:us)?$/i);
  if (!m) return raw;
  const n = parseFloat(m[1]);
  if (n >= 16) return m2Half(n);
  const t = m2Men(o) ? M2_US_M : M2_US_W;
  if (n <= t[0][0]) return m2Half(t[0][1] - (t[0][0] - n));
  if (n >= t[t.length - 1][0]) return m2Half(t[t.length - 1][1] + (n - t[t.length - 1][0]));
  const j = t.findIndex((p) => p[0] >= n), [a, b] = [t[j - 1], t[j]];
  return m2Half(b[0] === n ? b[1] : a[1] + ((n - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
}
const m2IsShoe = (o) => o.category === "Zapatos" || (o.category === "Deportes" && /zapat|sneaker|shoe|running|trainer|bota|sandal|chala/i.test(`${o.title} ${o.product_type || ""}`));
const m2Kind = (o) => (m2IsShoe(o) ? "shoe" : o.category === "Carteras" ? "bag" : ["Ropa", "RopaHombre", "Deportes", "Lenceria", "Invierno"].includes(o.category) ? "cloth" : "other");
// Opciones de talla de un producto: [{ v: lo que va al carro, label: lo que se muestra }]
function m2Sizes(o) {
  const kind = m2Kind(o), list = listOf(o.sizes);
  if (kind === "bag") return [];
  if (kind !== "shoe") return list.map((z) => ({ v: z, label: z }));
  const seen = new Set();
  return list.map((z) => { const cl = clShoeSize(z, o), us = cl !== z.replace(".", ",") && num(z) != null && num(z) < 16; return { v: us ? `${cl} (US ${z})` : cl, label: cl, us: us ? z : "" }; })
    .filter((x) => !seen.has(x.label) && seen.add(x.label))
    .sort((a, b) => (num(a.label.replace(",", ".")) ?? 99) - (num(b.label.replace(",", ".")) ?? 99));
}
const m2Money = (v) => { const d = String(v ?? "").replace(/[^\d]/g, ""); return d ? Number(d) : null; };
const m2Fmt = (n) => (n == null ? "" : "$" + Math.round(n).toLocaleString("es-CL"));
// Formulario de publicación: si la categoría es Zapatos, chips 35–45 que llenan el campo de tallas
if (typeof document !== "undefined" && !window.__m2shoe) {
  window.__m2shoe = true;
  const sync = () => document.querySelectorAll(".m2-shoepick").forEach((w) => {
    const form = w.closest("form"), cat = form?.elements.category?.value, inp = form?.elements.sizes;
    w.hidden = cat !== "Zapatos";
    if (inp) { const cur = listOf(inp.value); w.querySelectorAll("[data-m2z]").forEach((b) => b.classList.toggle("on", cur.includes(b.dataset.m2z))); }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".m2-shoepick [data-m2z]");
    if (b) {
      const inp = b.closest("form").elements.sizes, cur = listOf(inp.value), z = b.dataset.m2z, i = cur.indexOf(z);
      i >= 0 ? cur.splice(i, 1) : cur.push(z);
      inp.value = cur.sort((x, y) => (num(x) ?? 99) - (num(y) ?? 99)).join(", ");
    }
    setTimeout(sync, 0);
  });
  ["change", "input", "focusin"].forEach((ev) => document.addEventListener(ev, () => setTimeout(sync, 0)));
}
const m2ShoePickHTML = () => `<div class="m2-shoepick" hidden><span class="small muted">Tallas chilenas:</span>${[35, 35.5, 36, 36.5, 37, 37.5, 38, 38.5, 39, 40, 41, 42, 43, 44, 45].map((z) => `<button type="button" class="chip" data-m2z="${String(z).replace(".", ",")}">${String(z).replace(".", ",")}</button>`).join("")}</div>`;

// ---------- Catálogo v3: una tarjeta grande por producto (foto + precio puesto en Chile con su cálculo) ----------
const c3Norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Desglose del precio estimado puesto en Chile (mismos campos que quote()). n = unidades, half = solo la mitad
function c3BreakHTML(q, o, opt = {}) {
  const s = state.settings, k = opt.n || 1, h = opt.half ? 0.5 : 1, d = discOf(o), m = (v) => usd(v * k * h);
  const fx = state.fx ? state.fx.v : s.usd_clp, tot = Math.ceil((q.clp * k * h) / 100) * 100;
  return `<dl class="c3-break">
    ${d && !opt.half ? `<div class="c3-bl"><dt>Precio etiqueta</dt><dd><s>${usd(d.tag * k)}</s></dd></div>
    ${d.d1 > 0 && d.d2 > 0 ? `<div class="c3-bl"><dt>Descuento <i>${fmtPct(d.d1)}%</i></dt><dd>${usd(withDiscount(d.tag, d.d1) * k)}</dd></div>
    <div class="c3-bl"><dt>Descuento extra sobre el anterior <i>${fmtPct(d.d2)}%</i></dt><dd>${usd(q.price * k)}</dd></div>` : `<div class="c3-bl"><dt>Descuento <i>${fmtPct(d.pct)}%</i></dt><dd>−${usd((d.tag - q.price) * k)}</dd></div>`}` : ""}
    <div class="c3-bl"><dt>Precio en tienda${k > 1 ? ` <i>× ${k}</i>` : ""}</dt><dd>${m(q.price)}</dd></div>
    <div class="c3-bl"><dt>Impuesto Florida <i>${fmtPct(s.fl_tax_pct)}%</i></dt><dd>${m(q.tax)}</dd></div>
    <div class="c3-bl"><dt>Comisión shopper <i>${fmtPct(s.fee_pct)}%</i></dt><dd>${m(q.fee)}</dd></div>
    <div class="c3-bl"><dt>Envío courier <i>${fmtKg(q.w.charge)} kg${q.w.byVolume ? " vol." : ""}</i></dt><dd>${m(q.ship)}</dd></div>
    <div class="c3-bl"><dt>Aduana e IVA <i>${fmtPct(s.cl_duty_pct)}% + ${fmtPct(s.cl_vat_pct)}%</i></dt><dd>${m(q.customs)}</dd></div>
    <div class="c3-bl c3-tu"><dt>Total en dólares</dt><dd>${m(q.total)}</dd></div>
    <div class="c3-bl c3-tc"><dt>Total puesto en Chile <i>dólar ${clp(fx)}</i></dt><dd>${clp(tot)}</dd></div>
  </dl>`;
}
// Todas las marcas publicadas: primero las de esta tienda, después las de otras tiendas
function c3Brands(items, all) {
  const here = new Map(), there = new Map();
  items.forEach((o) => o.brand && here.set(o.brand, (here.get(o.brand) || 0) + 1));
  all.forEach((o) => {
    if (!o.brand || items.includes(o)) return;
    const cat = o.last_minute && state.cat === LAST ? LAST : shopOfCategory(o.category), key = o.brand + "\u0000" + cat;
    const e = there.get(key) || { brand: o.brand, cat, n: 0 }; e.n++; there.set(key, e);
  });
  return { here: [...here].map(([brand, n]) => ({ brand, n })).sort((a, b) => a.brand.localeCompare(b.brand, "es")), there: [...there.values()].sort((a, b) => a.brand.localeCompare(b.brand, "es")) };
}

// El mostrador: al entrar a la tienda, cada producto en grande, uno por pantalla
function storeCounter(view) {
  const gNeed = shopNeedsGender(state.cat), g = gNeed ? getGender() : "";
  // tienda con catálogo por género y sin elección guardada (p. ej. llegó por una marca de otra tienda): elegir primero
  if (gNeed && !g) {
    view.innerHTML = `<div class="interior m2 c3 f-${facadeOf(state.cat)}"><div class="int-bar"><button class="btn ghost sm" id="back">← Vitrina</button><span class="int-sign">${esc(shopName(state.cat))}</span><span></span></div>
      <div class="gask-in"><h2 class="gask-h">¿Qué catálogo quieres ver?</h2>${genderPlatesHTML(state.cat)}</div></div>`;
    view.querySelector("#back").onclick = () => navBack(() => { state.mallView = "vitrina"; });
    view.querySelectorAll("[data-gender]").forEach((b) => (b.onclick = () => { setGender(b.dataset.gender); storeCounter(view); }));
    return;
  }
  const items = offersIn(state.cat).filter((o) => genderOk(o, g));
  const f = state.filters || (state.filters = freshFilters());
  const P = (o) => quote(o.price_usd, o).clp;
  const all = items.map(P), lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 0;
  const SORTS = [["new", "Recientes", "Más nuevos primero"], ["low", "Menor precio", "Precio de menor a mayor"], ["high", "Mayor precio", "Precio de mayor a menor"]];
  if (f.sort === "disc") f.sort = "new";   // el descuento lo define Cheryl en cada producto: ya no es un orden
  const chip = (label, kind, val) => `<button class="fchip" data-rm="${kind}" data-v="${esc(val)}">${esc(label)} ✕</button>`;
  const extra = () => f.colors.length + f.sizes.length;
  // marcas de otras tiendas: solo las que existen en el catálogo elegido (si esa tienda también separa por género)
  const brands = c3Brands(items, (state.offers || []).filter((o) => !g || (offersIn(state.cat).includes(o) ? genderOk(o, g) : !shopNeedsGender(shopOfCategory(o.category)) || genderOk(o, g))));
  // Volante de la vitrina: ese producto debe quedar visible (si los filtros lo esconden, se limpian)
  let focusId = state.focusOffer != null ? String(state.focusOffer) : null;
  if (focusId && !items.some((o) => String(o.id) === focusId)) focusId = state.focusOffer = null;
  if (focusId && !applyFilters(items, f).some((o) => String(o.id) === focusId)) Object.assign(f, { ...freshFilters(), sort: f.sort });

  const card = (o, i, n) => {
    const q = quote(o.price_usd, o), ph = photosOf(o)[0], d = discOf(o);
    return `<article class="c3-card" data-id="${esc(o.id)}" aria-roledescription="producto" aria-label="${i + 1} de ${n}: ${esc(o.title)}">
      <button type="button" class="c3-stage" data-open="${esc(o.id)}" aria-label="Ver ${esc(o.title)}: fotos, talla y color">
        <span class="c3-spot" aria-hidden="true"></span>
        ${ph ? `<img src="${esc(ph.url)}" alt="${esc(o.title)}" ${i > 1 ? `loading="lazy"` : ""} draggable="false">` : `<span class="m2-emo" aria-hidden="true"></span>`}
        <span class="c3-more" aria-hidden="true">${photosOf(o).length > 1 ? photosOf(o).length + " fotos · " : ""}Ver detalle</span>
        ${d ? discBadges(o, "c3-badge") : ""}${is2x1(o) ? `<span class="c3-badge c3-2x1">2×1</span>` : ""}
      </button>
      <div class="c3-info">
        <div class="c3-meta"><span class="c3-brand">${esc(o.brand || "Sin marca")}</span><span class="c3-store">${esc(o.store || shopName(shopOfCategory(o.category)))}</span></div>
        <h3 class="c3-title">${esc(o.title)}</h3>
        <div class="c3-price"><div class="c3-clp"><b>${clp(q.clp)}</b><span>estimado puesto en Chile</span></div>
          <div class="c3-usd">${d ? `<s>${usd(d.tag)}</s>` : ""}<span><b>${usd(q.price)}</b> en tienda</span></div></div>
        <details class="c3-calc"><summary><span>Ver cálculo</span><span class="c3-sum">${usd(q.price)} + impuestos, comisión, envío y aduana</span></summary>${c3BreakHTML(q, o)}</details>
      </div>
    </article>`;
  };

  view.innerHTML = `<div class="interior m2 c3 f-${facadeOf(state.cat)}">
      <div class="int-bar"><button class="btn ghost sm" id="back">← Vitrina</button><span class="int-sign">${esc(shopName(state.cat))}</span>
        <button class="btn sm ${extra() ? "gold" : "ghost"}" id="filt">Más filtros${extra() ? " (" + extra() + ")" : ""}</button></div>
      <div class="m2-ctrl c3-ctrl">
        ${gNeed ? `<div class="gsel" role="radiogroup" aria-label="Catálogo">${["mujer", "hombre"].map((x) => `<button type="button" role="radio" class="gsel-b${x === g ? " on" : ""}" data-gsel="${x}" aria-checked="${x === g}">${genderLabel(x)}</button>`).join("")}</div>` : ""}
        <div class="c3-brandbox" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-owns="c3ac">
          <span class="c3-lbl">Marca</span>
          <input class="m2-in c3-bq" id="c3bq" type="search" autocomplete="off" spellcheck="false" placeholder="Busca una marca…" aria-autocomplete="list" aria-controls="c3ac" value="${esc(f.brands[0] || "")}">
          <button type="button" class="m2-x" id="c3bx" aria-label="Quitar marca" ${f.brands.length ? "" : "hidden"}>✕</button>
          <div class="c3-ac" id="c3ac" role="listbox" hidden></div>
        </div>
        <div class="m2-range" role="group" aria-label="Precio puesto en Chile">
          <span class="m2-rl">Precio</span><span class="m2-rw">entre</span>
          <input class="m2-in" id="m2min" inputmode="numeric" autocomplete="off" aria-label="Precio mínimo en pesos" placeholder="${m2Fmt(lo)}" value="${m2Fmt(f.min)}">
          <span class="m2-rw">y</span>
          <input class="m2-in" id="m2max" inputmode="numeric" autocomplete="off" aria-label="Precio máximo en pesos" placeholder="${m2Fmt(hi)}" value="${m2Fmt(f.max)}">
          <button type="button" class="m2-x" id="m2clr" aria-label="Quitar rango de precio" ${f.min != null || f.max != null ? "" : "hidden"}>✕</button>
        </div>
        <div class="m2-sort" role="radiogroup" aria-label="Ordenar">${SORTS.map(([k, l, a]) => `<button type="button" role="radio" class="m2-so" data-sort="${k}" aria-label="${a}">${l}</button>`).join("")}</div>
      </div>
      <div id="m2body"></div>
    </div>`;

  const body = view.querySelector("#m2body");
  let shown = [], idx = 0;
  const fit = () => {
    const tr = view.querySelector("#m2track");
    if (!tr || !view.isConnected) return;
    const bar = document.querySelector(".storebar"), barH = bar ? bar.getBoundingClientRect().height : 0;
    const top = tr.getBoundingClientRect().top + window.scrollY;
    tr.style.setProperty("--m2-h", Math.max(window.innerWidth < 600 ? 360 : 380, Math.floor(window.innerHeight - top - barH - 10)) + "px");
  };
  const step = () => { const tr = view.querySelector("#m2track"); return tr ? tr.clientWidth + 12 : 1; };
  const paintPos = () => {
    const pos = view.querySelector("#m2pos"); if (!pos) return;
    pos.textContent = `${idx + 1} / ${shown.length}`;
    view.querySelector("#m2prev").disabled = idx <= 0; view.querySelector("#m2next").disabled = idx >= shown.length - 1;
  };
  const goTo = (i) => { const tr = view.querySelector("#m2track"); if (!tr) return; idx = Math.max(0, Math.min(shown.length - 1, i)); tr.scrollTo({ left: idx * step(), behavior: reduceMotion() ? "auto" : "smooth" }); paintPos(); };
  const paint = () => {
    if (f.min != null && f.max != null && f.min > f.max) [f.min, f.max] = [f.max, f.min];
    shown = applyFilters(items, f); idx = 0;
    view.querySelectorAll("[data-sort]").forEach((b) => { b.classList.toggle("on", b.dataset.sort === f.sort); b.setAttribute("aria-checked", b.dataset.sort === f.sort); });
    view.querySelector("#m2clr").hidden = f.min == null && f.max == null;
    view.querySelector("#c3bx").hidden = !f.brands.length;
    const fb = view.querySelector("#filt"); fb.textContent = "Más filtros" + (extra() ? ` (${extra()})` : ""); fb.className = `btn sm ${extra() ? "gold" : "ghost"}`;
    const ranged = f.min != null || f.max != null;
    const rangeTxt = ranged ? (f.min != null && f.max != null ? `entre ${clp(f.min)} y ${clp(f.max)}` : f.min != null ? `desde ${clp(f.min)}` : `hasta ${clp(f.max)}`) : `entre ${clp(lo)} y ${clp(hi)}`;
    body.innerHTML = `
      <div class="c3-status"><span class="c3-count" aria-live="polite">${items.length ? `Precios ${rangeTxt}` : ""}${f.brands.length ? ` · <b>${esc(f.brands.join(", "))}</b>` : ""}</span>
        ${shown.length > 1 ? `<span class="m2-nav c3-nav"><button type="button" id="m2prev" aria-label="Producto anterior">‹</button><span id="m2pos">1 / ${shown.length}</span><button type="button" id="m2next" aria-label="Producto siguiente">›</button></span>` : ""}</div>
      ${extra() ? `<div class="fchips">${f.colors.map((c) => chip(c, "colors", c)).join("")}${f.sizes.map((z) => chip("Talla " + z, "sizes", z)).join("")}</div>` : ""}
      ${shown.length ? `<div class="m2-track c3-track" id="m2track" tabindex="0" aria-label="Productos, desliza para ver más">${shown.map((o, i) => card(o, i, shown.length)).join("")}</div>`
      : `<div class="m2-empty">${items.length ? `<b>Nada ${ranged ? rangeTxt : "con esos filtros"}</b><span>En esta tienda hay productos entre ${clp(lo)} y ${clp(hi)}.</span><button class="btn ghost sm" id="m2reset">Ver todos</button>` : `<b>Esta tienda todavía no tiene productos hoy</b>`}</div>`}`;
    const tr = body.querySelector("#m2track");
    if (tr) {
      fit(); tr.scrollLeft = 0;
      if (focusId) {
        const fi = shown.findIndex((o) => String(o.id) === focusId);
        focusId = state.focusOffer = null;
        if (fi > 0) { idx = fi; tr.style.scrollBehavior = "auto"; tr.scrollLeft = fi * step(); requestAnimationFrame(() => { if (tr.isConnected) { tr.scrollLeft = fi * step(); tr.style.scrollBehavior = ""; } }); }
      }
      tr.addEventListener("scroll", () => requestAnimationFrame(() => { const i = Math.round(tr.scrollLeft / step()); if (i !== idx) { idx = i; paintPos(); } }), { passive: true });
      tr.addEventListener("keydown", (e) => { if (e.target !== tr) return; if (e.key === "ArrowRight") { e.preventDefault(); goTo(idx + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); goTo(idx - 1); } });
      tr.addEventListener("click", (e) => { const t = e.target.closest("[data-open]"); if (!t) return; const o = shown.find((x) => String(x.id) === t.dataset.open); if (o) openOffer(o); });
      paintPos();
    }
    body.querySelector("#m2prev") && (body.querySelector("#m2prev").onclick = () => goTo(idx - 1));
    body.querySelector("#m2next") && (body.querySelector("#m2next").onclick = () => goTo(idx + 1));
    body.querySelector("#m2reset") && (body.querySelector("#m2reset").onclick = () => { state.filters = Object.assign(f, { ...freshFilters(), sort: f.sort }); syncInputs(); bq.value = ""; paint(); });
    body.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { f[b.dataset.rm] = f[b.dataset.rm].filter((x) => x !== b.dataset.v); paint(); }));
  };

  // Marca: autocompletado (esta tienda primero, después "en otras tiendas")
  const bq = view.querySelector("#c3bq"), ac = view.querySelector("#c3ac"), box = view.querySelector(".c3-brandbox");
  let opts = [], act = -1;
  const mark = (txt, q) => { const i = c3Norm(txt).indexOf(q); return i < 0 || !q ? esc(txt) : esc(txt.slice(0, i)) + "<b>" + esc(txt.slice(i, i + q.length)) + "</b>" + esc(txt.slice(i + q.length)); };
  const rank = (b, q) => { const n = c3Norm(b); return !q ? 1 : n.startsWith(q) ? 0 : n.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : -1; };
  const filt = (arr, q) => arr.map((x) => [rank(x.brand, q), x]).filter((r) => r[0] >= 0).sort((a, b) => a[0] - b[0] || a[1].brand.localeCompare(b[1].brand, "es")).map((r) => r[1]);
  const openAc = () => {
    const q = c3Norm(bq.value === (f.brands[0] || "\u0000") ? "" : bq.value);
    const h = filt(brands.here, q), t = filt(brands.there, q).slice(0, 12);
    opts = [...h.map((x) => ({ ...x, here: true })), ...t];
    act = q && opts.length ? 0 : -1;
    ac.innerHTML = opts.length ? `${h.length ? `<div class="c3-acg">En ${esc(shopName(state.cat))}</div>` : ""}${opts.map((x, i) => `${i === h.length && t.length ? `<div class="c3-acg">En otras tiendas</div>` : ""}<div class="c3-aco${i === act ? " on" : ""}${f.brands.includes(x.brand) && x.here ? " sel" : ""}" role="option" id="c3o${i}" data-i="${i}" aria-selected="${i === act}"><span>${mark(x.brand, q)}</span><small>${x.here ? "" : esc(shopName(x.cat))}</small></div>`).join("")}`
      : `<div class="c3-acn">No hay productos de “${esc(bq.value)}” publicados hoy</div>`;
    ac.hidden = false; box.setAttribute("aria-expanded", "true");
  };
  const closeAc = () => { ac.hidden = true; box.setAttribute("aria-expanded", "false"); act = -1; };
  const pick = (x) => {
    closeAc();
    if (x.here) { f.brands = [x.brand]; bq.value = x.brand; bq.blur(); paint(); return; }
    // marca de otra tienda: caminar hasta esa tienda con la marca ya filtrada
    walk([`Caminando a ${shopName(x.cat)}…`], () => { state.cat = x.cat; state.mallView = "tienda"; state.filters = { ...freshFilters(), brands: [x.brand] }; navCommit(); render(); window.scrollTo(0, 0); });
  };
  bq.addEventListener("focus", () => { bq.select(); openAc(); });
  bq.addEventListener("input", openAc);
  bq.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (ac.hidden) openAc(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % Math.max(1, opts.length); ac.querySelectorAll(".c3-aco").forEach((o, i) => { o.classList.toggle("on", i === act); o.setAttribute("aria-selected", i === act); if (i === act) o.scrollIntoView({ block: "nearest" }); }); }
    else if (e.key === "Enter") { e.preventDefault(); if (opts[act] || opts.length === 1) pick(opts[act] || opts[0]); else if (!bq.value.trim()) { f.brands = []; closeAc(); paint(); } }
    else if (e.key === "Escape") { closeAc(); bq.value = f.brands[0] || ""; bq.blur(); }
  });
  ac.addEventListener("pointerdown", (e) => { const o = e.target.closest("[data-i]"); if (o) { e.preventDefault(); pick(opts[+o.dataset.i]); } });
  bq.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== bq) { closeAc(); bq.value = f.brands[0] || ""; } }, 120));
  view.querySelector("#c3bx").onclick = () => { f.brands = []; bq.value = ""; closeAc(); paint(); };

  // Rango de precio en CLP: acepta "$50.000", se aplica al salir del campo o tras una pausa al escribir
  const inMin = view.querySelector("#m2min"), inMax = view.querySelector("#m2max");
  const syncInputs = () => { inMin.value = m2Fmt(f.min); inMax.value = m2Fmt(f.max); };
  let deb;
  const apply = () => { clearTimeout(deb); const a = m2Money(inMin.value), b = m2Money(inMax.value); if (a === f.min && b === f.max) return; f.min = a; f.max = b; paint(); };
  [inMin, inMax].forEach((inp) => {
    inp.addEventListener("input", () => { const n = m2Money(inp.value); inp.value = n == null ? "" : m2Fmt(n); clearTimeout(deb); deb = setTimeout(apply, 650); });
    inp.addEventListener("change", apply);
    inp.addEventListener("blur", () => { apply(); syncInputs(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
  });
  view.querySelector("#m2clr").onclick = () => { f.min = f.max = null; syncInputs(); paint(); };
  view.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => { f.sort = b.dataset.sort; paint(); }));
  view.querySelector("#back").onclick = () => navBack(() => { state.mallView = "vitrina"; });
  // cambiar de catálogo: conserva orden y precio; la marca solo si existe en el otro catálogo
  view.querySelectorAll("[data-gsel]").forEach((b) => (b.onclick = () => {
    const ng = b.dataset.gsel; if (ng === g) return;
    setGender(ng);
    const next = offersIn(state.cat).filter((o) => genderOk(o, ng));
    f.brands = f.brands.filter((x) => next.some((o) => o.brand === x));
    f.colors = []; f.sizes = [];
    storeCounter(view); window.scrollTo(0, 0);
  }));
  view.querySelector("#filt").onclick = () => openFilters(items, () => { syncInputs(); bq.value = f.brands[0] || ""; paint(); });
  if (!window.__m2fit) { window.__m2fit = true; window.addEventListener("resize", () => window.__m2fitFn && window.__m2fitFn()); }
  window.__m2fitFn = fit;
  paint();
  requestAnimationFrame(fit);
}
function openFilters(items, done) {
  const f = state.filters;
  const tmp = { ...f, colors: [...f.colors], sizes: [...f.sizes], brands: [...f.brands] };
  const colors = [...new Set(items.flatMap((o) => listOf(o.colors)))];
  const sizes = [...new Set(items.flatMap((o) => listOf(o.sizes)))];
  const brands = [...new Set(items.map((o) => o.brand).filter(Boolean))].sort();
  const prices = items.map((o) => quote(o.price_usd, o).clp);
  const hi = Math.max(0, ...prices);
  const ranges = [[null, 50000, "Hasta $50.000"], [50000, 100000, "$50.000 – $100.000"], [100000, 200000, "$100.000 – $200.000"], [200000, null, "Más de $200.000"]].filter((r) => r[0] == null || r[0] < hi);
  sheet(`<h2>Filtrar</h2>
    <label class="f">Precio puesto en Chile</label>
    <div class="chips wrap">${ranges.map((r, i) => `<button type="button" class="chip" data-rg="${i}">${r[2]}</button>`).join("")}</div>
    <div class="two"><input class="in" id="pmin" inputmode="numeric" placeholder="Mínimo $" value="${tmp.min ?? ""}"><input class="in" id="pmax" inputmode="numeric" placeholder="Máximo $" value="${tmp.max ?? ""}"></div>
    ${colors.length ? `<label class="f">Color</label><div class="swatches">${colors.map((c) => `<button type="button" class="sw ${tmp.colors.includes(c) ? "on" : ""}" data-fc="${esc(c)}" style="--c:${colorHex(c)}"><span></span>${esc(c)}</button>`).join("")}</div>` : ""}
    ${sizes.length ? `<label class="f">Talla</label><div class="chips wrap">${sizes.map((z) => `<button type="button" class="chip ${tmp.sizes.includes(z) ? "on" : ""}" data-fs="${esc(z)}">${esc(z)}</button>`).join("")}</div>` : ""}
    ${brands.length > 1 ? `<label class="f">Marca</label><div class="chips wrap">${brands.map((b) => `<button type="button" class="chip ${tmp.brands.includes(b) ? "on" : ""}" data-fb="${esc(b)}">${esc(b)}</button>`).join("")}</div>` : ""}
    <button class="btn gold block" id="fapply" style="margin-top:18px"></button>
    <button class="btn ghost block" id="fclear" style="margin-top:8px">Limpiar todo</button>`, (el, close) => {
    const count = () => { tmp.min = num(el.querySelector("#pmin").value.replace(/\./g, "")); tmp.max = num(el.querySelector("#pmax").value.replace(/\./g, "")); const n = applyFilters(items, tmp).length; el.querySelector("#fapply").textContent = (n ? "Ver resultados" : "Sin resultados con estos filtros"); };
    const tog = (arr, v, b) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); b.classList.toggle("on", i < 0); count(); };
    el.querySelectorAll("[data-rg]").forEach((b) => (b.onclick = () => { const r = ranges[+b.dataset.rg]; el.querySelector("#pmin").value = r[0] ?? ""; el.querySelector("#pmax").value = r[1] ?? ""; el.querySelectorAll("[data-rg]").forEach((x) => x.classList.toggle("on", x === b)); count(); }));
    el.querySelectorAll("[data-fc]").forEach((b) => (b.onclick = () => tog(tmp.colors, b.dataset.fc, b)));
    el.querySelectorAll("[data-fs]").forEach((b) => (b.onclick = () => tog(tmp.sizes, b.dataset.fs, b)));
    el.querySelectorAll("[data-fb]").forEach((b) => (b.onclick = () => tog(tmp.brands, b.dataset.fb, b)));
    el.querySelector("#pmin").oninput = count; el.querySelector("#pmax").oninput = count;
    el.querySelector("#fapply").onclick = () => { count(); Object.assign(f, tmp); close(); done(); };
    el.querySelector("#fclear").onclick = () => { Object.assign(f, { ...freshFilters(), sort: f.sort }); close(); done(); };
    count();
  });
}

// ---------- Orden de compra ----------
const newOrderCode = () => "MS-" + Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
// Mensaje del PEDIDO a Cheryl (WhatsApp): "Hola Cheryl, este es mi pedido N° …" con el desglose de la boleta (ordenes.js)
function orderText(d) {
  if (window.MSOrdenes) return window.MSOrdenes.pedidoText(d.snap || window.MSOrdenes.snap(d));
  const { lines, t } = b3Breakdown(d.items);
  return [`Hola ${cherylName()}, este es mi pedido N° ${d.code}:`, ...lines.map(({ x, usd: u }) => `• ${x.title} · ${b3Desc(x).join(" · ")} — ${usd(u)}`), "",
    ...b3Totals(t, d.share).map(([k, v, cls]) => (cls === "grand" ? `*${k}: ${v}*` : `${k}: ${v}`)), "", "Quedo atenta para hacer la transferencia."].join("\n");
}
// PDF de la orden (generado en el teléfono, sin librerías): boleta con el mismo desglose de la caja
function orderPDF(d) {
  const enc = (t) => String(t).normalize("NFC").replace(/−/g, "-").replace(/[^\x20-\xff]/g, "-").replace(/[\\()]/g, "\\$&");
  // ancho aproximado en Helvetica (1/1000 em) para alinear montos a la derecha
  const W = { " ": 278, ".": 278, ",": 278, "$": 556, "-": 333, "U": 722, "S": 667, "C": 722, "L": 556, "P": 667 };
  const wid = (t, size) => [...String(t)].reduce((a, ch) => a + (W[ch] || 556), 0) * size / 1000;
  const pages = []; let L = [], y = 790;
  const add = (txt, size, x, yy, bold) => L.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${yy} Td (${enc(txt)}) Tj ET`);
  const right = (txt, size, yy, bold) => add(txt, size, 545 - wid(txt, size), yy, bold);
  const need = (h) => { if (y - h < 60) { pages.push(L.join("\n")); L = []; y = 800; } };
  const wrap = (txt, max) => { const out = []; let cur = ""; for (const w of String(txt).split(" ")) { if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) out.push(cur); return out; };
  const { lines, t } = b3Breakdown(d.items);
  add(APP_NAME, 22, 50, y, true); y -= 26;
  add("Pedido N° " + d.code + " - pendiente de transferencia", 14, 50, y, true); y -= 18;
  add(new Date().toLocaleString("es-CL"), 10, 50, y); y -= 30;
  add("Cliente: " + (d.customer?.full_name || state.me.full_name || ""), 11, 50, y); y -= 15;
  if (d.customer?.phone || state.me.phone) { add("WhatsApp: " + (d.customer?.phone || state.me.phone), 11, 50, y); y -= 15; }
  if (state.me.locker_code) { add("Casillero: " + state.me.locker_code, 11, 50, y); y -= 15; }
  for (const s of window.MSClientes?.pdfLines(d) || []) { y -= s.gap || 0; for (const w of wrap(s.t, 88)) { add(w, 11, 50, y, s.b); y -= 15; } }   // ficha de la clienta (clientes.js)
  y -= 10; L.push(`0.69 0.55 0.31 RG 1 w 50 ${y} m 545 ${y} l S`); y -= 18;
  add("DETALLE", 9, 50, y, true); right("PRECIO EN TIENDA", 9, y, true); y -= 18;
  for (const { x, usd: u } of lines) {
    const tl = wrap(x.title, 60); need(14 * tl.length + 24);
    tl.forEach((s, i) => { add(s, 11, 50, y, true); if (!i) right(usd(u), 11, y, true); y -= 14; });
    add(b3Desc(x).join(" - "), 9.5, 62, y); y -= 18;
  }
  need(230);
  L.push(`0.55 0.55 0.55 RG 0.6 w [2 2] 0 d 50 ${y + 6} m 545 ${y + 6} l S [] 0 d`); y -= 12;
  for (const [k, v, cls] of b3Totals(t, d.share)) {
    if (cls === "grand") { y -= 4; L.push(`0.11 0.09 0.14 RG 1.2 w 50 ${y + 14} m 545 ${y + 14} l S`); y -= 6; add(k, 13, 50, y, true); right(v, 13, y, true); y -= 20; continue; }
    if (cls === "sum") { add(k, 11, 50, y, true); right(v, 11, y, true); y -= 16; continue; }
    add(k, cls === "share" ? 11.5 : 10.5, 50, y, cls === "share"); right(v, cls === "share" ? 11.5 : 10.5, y, cls === "share"); y -= 15;
  }
  add(`Valores puestos en Chile. Precios por producto incluyen impuesto, comision, envio y aduana.`, 8.5, 50, y); y -= 22;
  need(40 + 14 * bankRows().length);
  add("Datos para la transferencia" + (d.share ? " - monto " + clp(d.share) : " - monto " + clp(d.total)), 12, 50, y, true); y -= 16;
  for (const [k, v] of bankRows()) { add(k + ": " + v, 10.5, 50, y); y -= 14; }
  y -= 14; add("Atiende: " + cherylName() + (state.settings.whatsapp ? " - WhatsApp " + state.settings.whatsapp : ""), 10.5, 50, y);
  pages.push(L.join("\n"));
  const np = pages.length, fontObj = 3 + 2 * np;
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 2 * i} 0 R`).join(" ")}] /Count ${np} >>`];
  pages.forEach((content) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${fontObj + 1} 0 R >> >> /Contents ${objs.length + 2} 0 R >>`);
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: "application/pdf" });
}
async function shareOrDownloadPDF(d) {
  // PDF con marca (ordenes.js: Bodoni/Jost/Inter, fotos y desglose); si no carga, el PDF simple de siempre
  let blob = null; try { if (window.MSOrdenes) blob = await window.MSOrdenes.pedidoPDF(d); } catch (e) { console.warn("PDF con marca", e); }
  blob = blob || orderPDF(d); const name = `Pedido-${d.code}.pdf`;
  try {
    const file = new File([blob], name, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Pedido " + d.code }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast("Pedido descargado"); }
  catch { toast("Este navegador no permite descargar el PDF"); }
}
function receiptUploader(code, onDone) {
  return { html: `<label class="btn ghost block up-receipt">Subir comprobante (foto o PDF)<input type="file" accept="image/*,application/pdf" hidden data-receipt="${esc(code)}"></label><div class="receipt-prev" data-receipt-prev="${esc(code)}" hidden></div>`,
    wire: (root) => root.querySelectorAll(`[data-receipt="${code}"]`).forEach((inp) => (inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const lab = inp.closest("label"), prev = root.querySelector(`[data-receipt-prev="${code}"]`);
      const txt = lab && lab.firstChild; if (txt) txt.textContent = "Subiendo comprobante…"; lab?.classList.add("busy");
      try {
        const path = await state.api.uploadReceipt(f); await state.api.attachReceipt(code, path);
        if (prev) {
          const url = await state.api.receiptUrl(path);
          prev.innerHTML = `${isPdfRef(path) ? `<span class="rp-pdf" aria-hidden="true">PDF</span>` : `<img src="${esc(url)}" alt="Tu comprobante">`}<div class="grow"><b>Comprobante enviado</b><span class="small muted">${esc(f.name || "")}${isPdfRef(path) ? "" : " · reducido para enviarlo rápido"}. ${esc(cherylName())} lo verá en tu orden ${esc(code)}.</span></div>`;
          prev.hidden = false;
        }
        if (txt) txt.textContent = "Cambiar comprobante";
        toast(`Comprobante enviado a ${cherylName()}`); onDone?.();
      } catch (e) { if (txt) txt.textContent = "Subir comprobante (foto o PDF)"; toast(e.message || "No se pudo subir el comprobante"); }
      finally { lab?.classList.remove("busy"); inp.value = ""; }
    })) };
}

// ---------- La caja ----------
const lineTitle = (x) => `${x.qty > 1 && !x.promo ? x.qty + " × " : ""}${x.title}${x.promo === "2x1" ? " (2×1)" : ""}`;
function receiptHTML(items, total, share, code, cust) {
  const { lines, t } = b3Breakdown(items);
  const now = new Date();
  return `<div class="b3-voucher" aria-label="Boleta de venta">
    <div class="b3-vhead"><b>${esc(APP_NAME)}</b><span>Boleta de compra · Miami → Chile</span>
      <span>${esc(now.toLocaleDateString("es-CL"))} · ${esc(now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }))}${code ? ` · Orden ${esc(code)}` : ""}</span></div>
    ${cust ? window.MSClientes?.voucherHTML(cust) || "" : ""}
    <div class="b3-vcols"><span>Descripción</span><span>Precio en tienda</span></div>
    ${lines.map(({ x, usd: u }) => `<div class="b3-vl"><div class="b3-vd"><b>${esc(x.title)}</b><span>${b3Desc(x).map(esc).join(" · ")}${x.qty > 1 && !x.promo ? ` · ${usd(x.price_usd)} c/u` : ""}</span></div><span class="b3-va">${usd(u)}</span></div>`).join("")}
    <div class="b3-vtot">${b3Totals(t, share).map(([k, v, cls]) => `<div class="b3-vr${cls ? " b3-" + cls : ""}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
    <div class="b3-vfoot">Valores puestos en Chile · ${esc(fxNote())}<br>Gracias por comprar con ${esc(cherylName())}</div>
  </div>`;
}
const itemsTotal = (items) => items.reduce((t, x) => t + x.clp * (x.promo ? 1 : x.qty), 0);
// Saludo grabado de Cheryl: suena una vez por llegada a la caja (no en cada re-render)
const B3_GREET = "audio/cheryl_saludo.mp3";
const B3_ICO = {
  play: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 5.5v13l10.5-6.5z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="6.5" y="6.5" width="11" height="11" rx="1"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
};
function b3Greeting(desk, name) {
  const st = cajaView.b3 || (cajaView.b3 = { audio: null, view: null });
  const arrival = !(st.view && st.view.isConnected);          // vista nueva = llegada; misma vista = re-render (p. ej. tras confirmar)
  if (!st.audio) { st.audio = new Audio(B3_GREET); st.audio.preload = "auto"; }
  const a = st.audio;
  if (arrival) { a.pause(); try { a.currentTime = 0; } catch {} }
  const box = desk.querySelector(".b3-greet"), main = box.querySelector("[data-g=main]"), stop = box.querySelector("[data-g=stop]"), mute = box.querySelector("[data-g=mute]");
  const paint = () => {
    const on = !a.paused && !a.ended;
    main.innerHTML = `${on ? B3_ICO.pause : B3_ICO.play}<span>${on ? "Pausar saludo" : a.currentTime > 0 && !a.ended ? "Seguir escuchando" : `Escuchar saludo de ${esc(name)}`}</span>`;
    main.setAttribute("aria-pressed", on);
    stop.hidden = !on && !(a.currentTime > 0 && !a.ended); mute.hidden = stop.hidden;
    mute.innerHTML = a.muted ? B3_ICO.mute : B3_ICO.sound; mute.setAttribute("aria-label", a.muted ? "Activar sonido" : "Silenciar");
    box.classList.toggle("on", on);
  };
  a.onplay = a.onpause = a.onended = paint;
  a.ontimeupdate = () => { if (!desk.isConnected) a.pause(); };   // si se sale de la caja, se calla
  main.onclick = () => { if (!a.paused) a.pause(); else { if (a.ended) a.currentTime = 0; a.play().catch(() => paint()); } };
  stop.onclick = () => { a.pause(); try { a.currentTime = 0; } catch {} paint(); };
  mute.onclick = () => { a.muted = !a.muted; paint(); };
  paint();
  if (arrival && !reduceMotion()) a.play().then(paint).catch(paint);   // si el navegador lo bloquea, queda el botón
}
async function cajaView(view) {
  const first = (state.me.full_name || "").split(" ")[0];
  const name = cherylName();
  if (!state.offers || !state.offers.length) { try { state.offers = await state.api.listOffers(); } catch {} }
  const done = state.cajaDone, split = state.cajaSplit, guest = state.cajaGroup;
  if (!done && !guest) await cacheOffers(split ? split.items : getCart());   // productos reservados (encargos): mismo cálculo que en su ficha
  if (!done && !guest) {                                    // precios con el dólar de hoy (los mismos que se cobran al confirmar)
    if (split) split.items = b3Fresh(split.items).items;
    else { const fr = b3Fresh(getCart()); if (fr.changed) setCart(fr.items); }
  }
  const items = done ? done.items : guest ? guest.items : split ? split.items : getCart();
  const total = guest ? guest.total_clp : done ? done.total : itemsTotal(items);
  const share = guest || split || done?.group || done?.guestOf ? Math.ceil(total / 2 / 100) * 100 : 0;
  const toPay = share || total;
  // paso "Datos de envío" + factura (clientes.js); sin cuenta se pide primero crearla o entrar (cuentas.js, al tocar "Comprar")
  const cli = !done && items.length && window.MSClientes && !window.MSCuentas?.isGuest() ? await window.MSClientes.caja() : null;
  const kindTxt = (k, prep) => (k === "2x1" ? (prep === "a" ? "al 2×1" : "el 2×1") : (prep === "a" ? "a la compra a medias" : "la compra a medias"));
  let bubble;
  if (guest) bubble = `Hola${first ? " " + esc(first) : ""}, soy ${esc(name)}. Te uniste ${kindTxt(guest.kind, "a")} con ${esc(guest.host_name || "tu amiga")}. Tu parte es ${clp(share)}.`;
  else if (done) bubble = done.group ? `Listo${first ? ", " + esc(first) : ""}. Transfiere tu parte (${clp(share)}) e invita a tu amiga para que pague la suya.` : `Gracias${first ? ", " + esc(first) : ""}. Recibí tu pedido. Transfiere ${clp(toPay)} y sube el comprobante de la transferencia: apenas lo confirme, te envío tu orden de compra y compro tus productos.`;
  else if (items.length) bubble = split ? `Hola${first ? " " + esc(first) : ""}, soy ${esc(name)}. El total es ${clp(total)}; tú pagas ${clp(share)} y tu amiga el resto.` : `Hola${first ? " " + esc(first) : ""}, soy ${esc(name)}. Tu total es ${clp(total)}. ¿Confirmamos tu compra?`;
  else bubble = `Hola, soy ${esc(name)}. Todavía no tienes productos; vuelve cuando encuentres algo lindo.`;
  const grp = done?.group;
  const inviteText = grp ? `${first || "Tu amiga"} te invita ${kindTxt(grp.kind, "a")} en ${APP_NAME}: ${grp.items.map(lineTitle).join(", ")}. Total ${clp(grp.total_clp)}, cada una paga ${clp(Math.ceil(grp.total_clp / 2 / 100) * 100)}. Únete aquí: ${appLink("g-" + grp.id)}` : "";
  const proofText = `Hola ${name}, te envío el comprobante de la transferencia de ${guest ? `mi parte de ${kindTxt(guest.kind)} con ${guest.host_name || "mi amiga"} (código ${guest.id.slice(0, 6)})` : grp ? `mi parte de ${kindTxt(grp.kind)} (código ${grp.id.slice(0, 6)})` : done?.guestOf ? `mi parte de la compra compartida (pedido N° ${done.code})` : `mi pedido N° ${done?.code || ""}`} por ${clp(toPay)}.`;
  view.innerHTML = `<div class="caja b3-caja">
      <div class="b3-desk">
        <span class="b3-sign">La Caja</span>
        <div class="b3-plate"><small>Te atiende</small><b>${esc(name)}</b></div>
        <div class="b3-reg" aria-label="Monto a pagar"><span>${share ? "Tu parte" : "Total"}</span><b>${clp(toPay)}</b></div>
        <div class="b3-greet"><button type="button" class="b3-gbtn" data-g="main"></button><button type="button" class="b3-gico" data-g="stop" aria-label="Detener saludo" hidden>${B3_ICO.stop}</button><button type="button" class="b3-gico" data-g="mute" hidden></button></div>
      </div>
      <div class="bubble-wrap b3-bubble"><div class="bubble">${bubble}</div></div>
      <div class="caja-info">
        ${!done && !guest ? `<h2 class="cj-title">Tu carro</h2>` : ""}
        ${!done && !guest && !items.length ? `<div class="empty cj-empty">Tu carro está vacío. Recorre las vitrinas y agrega lo que te guste.</div>` : ""}
        ${!done && !guest && !split && items.length ? `<div class="cj-edit" aria-label="Productos en tu carro">${items.map((x) => `<div class="cj-it"><span class="cj-t">${esc(x.title)}${x.size ? ` · Talla ${esc(x.size)}` : ""}${x.color ? ` · ${esc(x.color)}` : ""}<b class="cj-p">${clp(x.clp * b3Units(x))}</b></span>
            <div class="b3-qty cj-q" role="group" aria-label="Cantidad"><button type="button" data-cdec="${esc(x.key)}" aria-label="Uno menos" ${x.promo ? "disabled" : ""}>−</button><b>${x.qty}</b><button type="button" data-cinc="${esc(x.key)}" aria-label="Uno más" ${x.promo ? "disabled" : ""}>+</button></div>
            <button type="button" class="cj-rm" data-crm="${esc(x.key)}">Quitar</button></div>`).join("")}
          <button type="button" class="btn ghost block" id="cj-split">Pagar a medias con una amiga</button></div>` : ""}
        ${items.length && !done ? `<h3>${guest || split ? "Compra compartida" : "Tu boleta"}</h3>${receiptHTML(items, total, share)}` : ""}
        ${cli ? cli.html : ""}
        ${!done && items.length ? `${guest ? `<button class="btn gold block" id="confirm" style="margin-top:14px">Confirmar y pagar mi 50% · ${clp(share)}</button>
          <p class="small muted">Se genera tu orden con código propio, enlazada a la compra de ${esc(guest.host_name || "tu amiga")}. Todo viaja en el mismo envío.</p>` : `<button class="btn gold block" id="confirm" style="margin-top:14px">${split ? `Confirmar y pagar mi 50% · ${clp(share)}` : `Comprar · ${clp(total)}`}</button>
          <p class="small muted">Al confirmar, ${esc(name)} revisa que todo siga disponible antes de comprar. Si algo ya no está, te devolvemos ese monto.</p>`}` : ""}
        ${done ? window.MSOrdenes?.doneHTML(done, { toPay, pedidoHref: contactCherylLink(orderText(done)), proofHref: contactCherylLink(proofText),
            boleta: `<h4 class="oc-h4">${done.group || done.guestOf ? "Compra compartida" : "Boleta del pedido"}</h4>${receiptHTML(items, total, share, done.code, done.customer)}`,
            invite: grp ? `<div class="invite-box"><b>Invita a tu amiga</b><span class="small">Le llega el link por WhatsApp, entra, ve la compra y paga su 50%. Las compras van juntas en el mismo envío.</span>
          <a class="btn wa block" target="_blank" rel="noopener" href="${esc(waShare(inviteText))}">Invitar por WhatsApp</a></div>` : "" }) || "" : ""}
        ${!done && (guest || items.length) ? `<h3 style="margin-top:18px">Datos para la transferencia</h3>${bankHTML(toPay)}` : ""}
        ${guest && contactCherylLink() ? `<a class="btn gold block" style="margin-top:14px" target="_blank" rel="noopener" href="${esc(contactCherylLink(proofText))}">Enviar comprobante de transferencia a ${esc(name)} por WhatsApp</a>
          <div class="small muted" style="text-align:center;margin-top:6px">${esc(state.settings.whatsapp)}</div>` : ""}
        <button class="btn ghost block" id="back-mall" style="margin-top:12px">${done ? "Ver mis pedidos" : "Volver al mall"}</button>
      </div></div>`;
  wireCopy(view, toPay);
  b3Greeting(view.querySelector(".b3-desk"), name);
  // el carro está dentro de la caja: cantidades, quitar y pagar a medias sin pasos extra
  view.querySelectorAll("[data-cinc],[data-cdec],[data-crm]").forEach((b) => (b.onclick = async () => {
    const cc = getCart(), it = cc.find((x) => x.key === (b.dataset.cinc || b.dataset.cdec || b.dataset.crm));
    if (!it) return;
    if (b.dataset.crm) { it.qty = 0; toast("Quitado de tu carro"); } else it.qty = Math.min(9, it.qty + (b.dataset.cinc ? 1 : -1));
    setCart(cc.filter((x) => x.qty > 0));
    // solo se redibuja la caja (sin saltar arriba); el foco vuelve al mismo botón si sigue existiendo
    const y = window.scrollY, sel = b.dataset.cinc ? `[data-cinc="${CSS.escape(b.dataset.cinc)}"]` : b.dataset.cdec ? `[data-cdec="${CSS.escape(b.dataset.cdec)}"]` : null;
    await cajaView(view); window.scrollTo(0, y);
    const again = sel && view.querySelector(sel); if (again) again.focus({ preventScroll: true });
  }));
  const cjs = view.querySelector("#cj-split");
  if (cjs) cjs.onclick = () => { state.cajaDone = null; state.cajaGroup = null; state.cajaSplit = { kind: "split", items: getCart(), fromCart: true }; navCommit(); render(); };
  cajaView.b3.view = view;
  cli?.wire(view);
  if (state.cajaResume && !done) { state.cajaResume = false; window.MSCuentas?.resume(view); }
  if (done) { receiptUploader(done.code, () => { state.cajaDone.receipt = true; window.MSOrdenes?.markReceived(view); }).wire(view); $("#pdf").onclick = () => shareOrDownloadPDF(done); }
  $("#back-mall").onclick = () => { state.cajaSplit = null; state.cajaGroup = null; done ? go("pedidos") : goStore("mall"); };
  const cf = $("#confirm");
  if (cf) cf.onclick = async () => {
    // sin cuenta: pop-up "Crear cuenta / Ya tengo cuenta"; al terminar vuelve aquí y la compra sigue sola (cuentas.js)
    if (window.MSCuentas?.needsAccount()) { window.MSCuentas.open({ reason: "compra", onDone: () => { state.cajaResume = true; } }); return; }
    const label = cf.textContent;
    cf.disabled = true; cf.textContent = "Registrando…";
    try {
      const ficha = cli ? await cli.commit() : null;   // valida y crea/reutiliza la ficha (MSM-xxxxx); false = faltan datos
      if (ficha === false) { cf.disabled = false; cf.textContent = label; return; }
      const cx = ficha ? ficha.order : {};               // customer_id + copia de envío/facturación en cada fila de la orden
      let group = null; const code = newOrderCode();
      if (guest) {                                   // la amiga invitada paga su 50%: su propia orden, enlazada al grupo
        const tag = `Compra compartida 50/50 (código ${guest.id.slice(0, 6)}) · parte de ${state.me.full_name || "invitada"}`;
        // mitades por producto que suman exactamente su parte
        const halves = items.map((x) => Math.ceil((x.clp * b3Units(x)) / 2 / 100) * 100);
        halves[halves.length - 1] -= halves.reduce((a, b) => a + b, 0) - share;
        const snapG = window.MSOrdenes?.snap({ code, items, total, share, guestOf: guest.id, customer: ficha?.snap });   // boleta congelada (ordenes.js)
        for (const [i, x] of items.entries()) {
          const n = b3Units(x);
          await state.api.createOrder({ offer_id: x.offer_id, description: `${lineTitle(x)}${x.brand ? " · " + x.brand : ""} (50%)`,
            notes: [x.color, x.size ? "Talla " + x.size : "", tag].filter(Boolean).join(" · "),
            price_usd: (x.price_usd * n) / 2, total_clp: halves[i], order_code: code, ...cx, ...(i === 0 && snapG ? { order_snapshot: snapG } : {}) });
        }
        state.cajaDone = { total, group: null, code, items, share, guestOf: guest.id, customer: ficha?.snap, snap: snapG };
        try { window.open(contactCherylLink(orderText(state.cajaDone)), "_blank", "noopener"); } catch {}
        state.cajaGroup = null; cajaView(view); return;
      }
      if (split) group = await state.api.createGroup({ kind: split.kind, items, total_clp: total, host_name: state.me.full_name || "", host_phone: state.me.phone || "" });
      const share0 = group ? Math.ceil(total / 2 / 100) * 100 : 0;
      const snap0 = window.MSOrdenes?.snap({ code, items, total, share: share0, group, customer: ficha?.snap });   // boleta congelada (ordenes.js)
      for (const [i, x] of items.entries()) {
        await state.api.createOrder({ offer_id: x.offer_id, description: `${lineTitle(x)}${x.brand ? " · " + x.brand : ""}`,
          notes: [x.color, x.size ? "Talla " + x.size : "", group ? `Compra compartida 50/50 (código ${group.id.slice(0, 6)})` : ""].filter(Boolean).join(" · ") || null,
          price_usd: x.price_usd * b3Units(x), total_clp: x.clp * b3Units(x), order_code: code, ...cx, ...(i === 0 && snap0 ? { order_snapshot: snap0 } : {}) });
      }
      state.cajaDone = { total, group, code, items, share: share0, customer: ficha?.snap, snap: snap0 };
      const msg = orderText(state.cajaDone);
      try { window.open(contactCherylLink(msg), "_blank", "noopener"); } catch {}
      if (!split || split.fromCart) setCart([]);
      state.cajaSplit = null; cajaView(view);
    } catch (e) { cf.disabled = false; cf.textContent = label; toast(e.message); }
  };
}
// Compra compartida a la que llega la amiga por el link
async function groupView(view) {
  const g = state.groupId ? await state.api.getGroup(state.groupId) : null;
  if (!g) { view.innerHTML = `<div class="empty" style="margin-top:20px">Esta compra compartida ya no existe o el link está incompleto.</div>`; return; }
  const share = Math.ceil(g.total_clp / 2 / 100) * 100;
  const me = state.me.id;
  const isHost = g.host_id === me, joined = (g.members || []).some((m) => m.user_id === me);
  view.innerHTML = `<div class="group-card">
      <span class="pill coral">${g.kind === "2x1" ? "2×1 entre amigas" : "Compra a medias"}</span>
      <h2>${esc(g.host_name || "Tu amiga")} ${isHost ? "(tú)" : "te invitó"}</h2>
      <p class="muted">Compran juntas y todo viaja en el mismo envío a Chile. Cada una paga el 50%.</p>
      <div class="gitems">${g.items.map((x) => `<div class="cart-row"><span class="thumb">${x.photo ? `<img src="${esc(x.photo)}" alt="">` : catOf(x.category).emoji}</span><div class="grow"><div class="t">${esc(lineTitle(x))}</div><div class="small muted">${[x.brand, x.color, x.size ? "Talla " + x.size : ""].filter(Boolean).map(esc).join(" · ")}</div></div></div>`).join("")}</div>
      ${receiptHTML(g.items, g.total_clp, share)}
      <div class="small muted" style="margin-top:8px">Participantes: ${esc(g.host_name || "Anfitriona")}${(g.members || []).map((m) => ", " + esc(m.name)).join("")}</div>
      ${isHost ? `<button class="btn ghost block" id="gback" style="margin-top:14px">Volver al mall</button>`
        : joined ? `<button class="btn gold block" id="gpay" style="margin-top:14px">Ir a la caja a pagar mi parte</button>`
        : `<form id="gjoin"><label class="f">Tu nombre</label><input class="in" name="name" required value="${esc(state.me.full_name || "")}">
          <label class="f">Tu WhatsApp</label><input class="in" name="phone" type="tel" inputmode="tel" required placeholder="+56 9 1234 5678" value="${esc(state.me.phone || "")}">
          <button class="btn gold block" style="margin-top:14px">Unirme y pagar mi 50% · ${clp(share)}</button></form>`}
    </div>`;
  $("#gback") && ($("#gback").onclick = () => goStore("mall"));
  const toCaja = (grp) => walk(["Caminando a la caja…"], () => { state.tab = "caja"; state.cajaGroup = grp; state.cajaDone = null; state.cajaSplit = null; navCommit(); render(); });
  $("#gpay") && ($("#gpay").onclick = () => toCaja(g));
  const f = $("#gjoin");
  if (f) f.onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(f);
    try {
      const grp = await state.api.joinGroup(g.id, { name: fd.get("name").trim(), phone: fd.get("phone").trim() });
      // guardar nombre/WhatsApp en su perfil para que Cheryl la vea (y pueda escribirle) en la orden
      const p = {}; if (!state.me.phone && fd.get("phone").trim()) p.phone = fd.get("phone").trim(); if (!state.me.full_name && fd.get("name").trim()) p.full_name = fd.get("name").trim();
      if (Object.keys(p).length) { try { state.me = await state.api.updateProfile(p); } catch {} }
      toCaja(grp || g);
    } catch (err) { toast(err.message); }
  };
}
// Compartir solo el dato (oferta o tienda)
const shareOfferText = (o) => `Mira esta oferta en ${APP_NAME}: ${o.title}${o.brand ? " de " + o.brand : ""}${discOf(o) ? ` con −${fmtPct(o.discount_pct)}%` : ""}${is2x1(o) ? " (2×1)" : ""}, ${clp(quote(o.price_usd, o).clp)} puesto en Chile 👉 ${appLink("o-" + o.id)}`;
const shareStoreText = (cat) => `Pasa por la tienda ${shopName(cat)} de ${APP_NAME}, hay ofertas de Miami puestas en Chile 👉 ${appLink("s-" + shopIndex(cat))}`;

const VIEWS = {
  // ---------------- CLIENTE: catálogo ----------------
  async ofertas(view) {
    state.offers = await state.api.listOffers();
    if (state.mallView === "tienda" && state.cat === "__search") return storeInside(view);
    if (state.mallView === "tienda" && state.cat) return storeCounter(view);
    if (state.mallView === "vitrina" && state.cat) return storeWindow(view);
    state.mallView = "mall"; return mallHome(view);
  },
  async caja(view) { await cajaView(view); },
  async grupo(view) { await groupView(view); },

  // ---------------- Encargos (encargos.js: lista de Cheryl con "Lo encontré", Mis encargos de la clienta) ----------------
  async encargos(view) {
    // invitada: ve el formulario y deja el encargo; la cuenta se pide recién al enviarlo (encargos.js)
    if (window.MSEncargos) return window.MSEncargos.view(view);
    view.innerHTML = `<div class="empty">No se pudieron cargar los encargos. Recarga la app.</div>`;
  },

  // ---------------- Pedidos + casilla ----------------
  async pedidos(view) {
    if (window.MSCuentas?.gate(view, "pedidos")) return;
    const [orders, pkgs] = await Promise.all([state.api.listOrders(), state.api.listPackages()]);
    const shop = isShopper();
    const locker = state.me.locker_code;
    view.innerHTML = `
      ${!shop ? `<div class="card"><div class="row"><div class="grow"><b>Mi casilla en Miami</b><div class="small muted">Úsala como dirección cuando compres en tiendas online que no envían a Chile.</div></div><span class="pill coral">${esc(locker || "")}</span></div>
        <div class="quote" style="margin-top:10px;white-space:pre-line;font-size:14px">${esc(state.me.full_name || "")} ${esc(locker || "")}\n${esc(state.settings.locker_address)}</div>
        <button class="btn ghost sm" id="copy-addr" style="margin-top:8px">Copiar dirección</button></div>` :
      `<div class="card"><b>Registrar paquete de casilla</b><div class="small muted">Cuando llegue un paquete a tu dirección, regístralo con el N° de casillero del cliente.</div>
        <button class="btn coral block" id="new-pkg" style="margin-top:10px">${ICON.box}Registrar paquete</button></div>`}
      ${shop && window.MSOrdenes ? `<div id="oc-dash"></div>` : ""}
      <h2 class="section-title">Pedidos</h2>
      ${orders.length ? `<div class="stack">${groupOrders(orders).map((g) => orderGroupCard(g, shop)).join("")}</div>` : `<div class="empty">${shop ? "Aún no hay pedidos." : "Aún no tienes pedidos. Recorre las tiendas y agrega lo que te guste a tu carro."}</div>`}
      <h2 class="section-title">Casilla</h2>
      ${pkgs.length ? `<div class="stack">${pkgs.map((p) => pkgCard(p, shop)).join("")}</div>` : `<div class="empty">No hay paquetes en la casilla.</div>`}`;
    $("#copy-addr") && ($("#copy-addr").onclick = async () => { try { await navigator.clipboard.writeText(`${state.me.full_name} ${locker}\n${state.settings.locker_address}`); toast("Dirección copiada"); } catch { toast("No se pudo copiar"); } });
    $("#new-pkg") && ($("#new-pkg").onclick = () => openRegisterPackage(() => VIEWS.pedidos(view)));
    // Cambiar estado (producto o paquete): se guarda, se avisa si falla y SIEMPRE se redibuja con los datos guardados
    // (antes no se redibujaba ni se capturaba el error: el chip, la barra y el estado del pedido quedaban viejos
    // o el select mostraba un valor que no se había guardado)
    const saveStatus = async (s, fn, ok) => {
      const y = window.scrollY; s.disabled = true;
      try { await fn(); toast(ok); } catch (e) { toast(e.message || "No se pudo guardar el estado"); }
      await VIEWS.pedidos(view); window.scrollTo(0, y);
    };
    view.querySelectorAll("select[data-order]").forEach((s) => (s.onchange = () => saveStatus(s, () => state.api.updateOrder(s.dataset.order, { status: s.value }), "Pedido actualizado")));
    view.querySelectorAll("select[data-pkg]").forEach((s) => (s.onchange = () => saveStatus(s, () => state.api.updatePackage(s.dataset.pkg, { status: s.value }), "Paquete actualizado")));
    view.querySelectorAll("[data-consolidar]").forEach((b) => (b.onclick = async () => { await state.api.updatePackage(b.dataset.consolidar, { status: "consolidar" }); toast("Listo, tu shopper preparará el envío"); VIEWS.pedidos(view); }));
    view.querySelectorAll("[data-pay]").forEach((b) => (b.onclick = () => showPayment()));
    groupOrders(orders).forEach((g) => g.code && receiptUploader(g.code, () => VIEWS.pedidos(view)).wire(view));
    view.querySelectorAll("[data-receipt-view]").forEach((b) => (b.onclick = async () => {
      const ref = b.dataset.receiptView, url = await state.api.receiptUrl(ref), pdf = isPdfRef(ref), full = await openableUrl(url);
      const paid = b.closest(".order-g")?.querySelector("[data-approve]:not(:disabled),[data-paid]");
      sheet(`<h2>Comprobante</h2>
        ${pdf ? `<div class="rp-doc"><span class="rp-pdf" aria-hidden="true">PDF</span><span>Comprobante en PDF</span></div>`
          : `<a href="${esc(full)}" target="_blank" rel="noopener" class="rp-full" aria-label="Ver comprobante en tamaño completo"><img src="${esc(url)}" alt="Comprobante de transferencia" style="width:100%;border-radius:4px;display:block"></a>`}
        <a class="btn ghost block" style="margin-top:12px" href="${esc(full)}" target="_blank" rel="noopener" ${pdf ? `download="comprobante.pdf"` : ""}>${pdf ? "Abrir PDF" : "Ver en tamaño completo"}</a>
        ${paid ? `<button class="btn gold block" id="rp-paid" style="margin-top:8px">${paid.dataset.approve ? "Aprobar pago y generar orden de compra" : "Confirmar pago recibido"}</button>` : ""}
        <button class="btn ghost block" data-close style="margin-top:8px">Cerrar</button>`, (el, close) => {
        const pb = el.querySelector("#rp-paid"); if (pb) pb.onclick = () => { close(); paid.click(); };
      });
    }));
    view.querySelectorAll("[data-paid]").forEach((b) => (b.onclick = async () => { for (const id of b.dataset.paid.split(",")) await state.api.updateOrder(id, { status: "pagado" }); toast("Marcado como pagado"); VIEWS.pedidos(view); }));
    // ordenes.js: tablero de pagos (Cheryl) + aprobar pago / orden de compra / PDF en cada pedido
    if (window.MSOrdenes) {
      const again = () => VIEWS.pedidos(view);
      window.MSOrdenes.wire(view, again);
      if (shop) window.MSOrdenes.dashboard(view.querySelector("#oc-dash"), groupOrders(orders), again);
    }
  },

  // ---------------- CLIENTE: cuenta ----------------
  async cuenta(view) {
    if (window.MSCuentas?.gate(view, "cuenta")) return;
    view.innerHTML = `<div class="card"><form id="pf">
        <label class="f" style="margin-top:0">Nombre</label><input class="in" name="full_name" value="${esc(state.me.full_name || "")}">
        <label class="f">Teléfono / WhatsApp</label><input class="in" name="phone" value="${esc(state.me.phone || "")}" inputmode="tel">
        <div class="small muted" style="margin-top:8px">N° de casillero: <b>${esc(state.me.locker_code || "")}</b></div>
        <button class="btn block" style="margin-top:12px">Guardar</button></form></div>
      <h2 class="section-title">Calculadora de precio en Chile</h2>
      <div class="card"><div class="two"><div><label class="f" style="margin-top:0">Precio en tienda (US$)</label><input class="in" id="cp" inputmode="decimal" value="50"></div>
        <div><label class="f" style="margin-top:0">Tipo de producto</label><select class="in" id="cc">${typeOptions("cartera-grande")}</select></div></div>
        <div id="cq" style="margin-top:12px"></div></div>
      ${!state.api.demo ? `<button class="btn ghost block" id="logout" style="margin-top:16px">Cerrar sesión</button>` : ""}`;
    const upd = () => { const t = typeOf($("#cc").value); $("#cq").innerHTML = quoteHTML(quote(num($("#cp").value) || 0, { category: t.cat, weight_kg: t.kg, box_l: t.box[0], box_w: t.box[1], box_h: t.box[2] })); };
    $("#cp").oninput = upd; $("#cc").onchange = upd; upd();
    $("#pf").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); state.me = await state.api.updateProfile({ full_name: f.get("full_name").trim(), phone: f.get("phone").trim() }); toast("Datos guardados"); };
    $("#logout") && ($("#logout").onclick = () => state.api.signOut());
    await window.MSClientes?.cuenta(view);   // N° de clienta, datos de envío/factura editables e historial (clientes.js)
    await window.MSCuentas?.cuentaCard(view);   // nombre, correo, N° MSM, cambiar contraseña y cerrar sesión (cuentas.js)
  },

  // ---------------- SHOPPER: publicar ----------------
  async publicar(view) {
    view.innerHTML = `${liveBanner()}
      <label class="capture" for="cam"><span class="cam">${ICON.cam}</span><b style="font-size:18px">Sacar foto al producto</b><span class="small" style="opacity:.75">Incluye la etiqueta con el precio. La app reconoce el producto y lee el precio.<br>${ICON.card}Pon la tarjeta pegada al producto para poder medirlo.</span></label>
      <input type="file" id="cam" accept="image/*" capture="environment" hidden>
      <label class="btn block pub-file" for="pubfile" style="margin-top:12px">${ICON.upload}Subir foto o archivo</label>
      <input type="file" id="pubfile" accept="image/*" hidden>
      <div style="text-align:center;margin-top:12px"><button class="btn ghost sm" id="nophoto">Publicar sin foto</button></div>
      <div id="pub"></div>`;
    // Cámara directa, o una foto ya guardada (galería, archivos, descargas del computador)
    const onPick = (e) => { const f = e.target.files[0]; if (f) publishForm($("#pub"), f); e.target.value = ""; };
    $("#cam").onchange = onPick; $("#pubfile").onchange = onPick;
    vision.warm();
    $("#nophoto").onclick = () => publishForm($("#pub"), null);
  },

  // ---------------- SHOPPER: mis ofertas ----------------
  // ---------------- SHOPPER: mis tiendas (panel por tienda: vitrina / adentro) ----------------
  async "mis-ofertas"(view) { return shopPanel(view); },

  // ---------------- SHOPPER: ajustes ----------------
  async ajustes(view) {
    const s = state.settings;
    const f = (k, l, extra = "") => `<div><label class="f">${l}</label><input class="in" name="${k}" value="${esc(s[k])}" inputmode="decimal" ${extra}></div>`;
    view.innerHTML = `<div class="card">
        <b>${isLive() ? ICON.live + "Estás en vivo" : "¿Estás en el mall?"}</b>
        <div class="small muted">Tus clientes ven un aviso de que estás publicando ahora.</div>
        ${isLive() ? `<div class="small" style="margin-top:6px">En ${esc(s.live_store || "")} hasta las ${hora(s.live_until, TZ_MIA)} (Miami)</div><button class="btn ghost block" id="live-off" style="margin-top:10px">Terminar</button>`
        : `<div class="two"><div><label class="f">Tienda o mall</label><input class="in" id="live-store" list="stores" placeholder="Aventura Mall"></div>
          <div><label class="f">Por cuánto tiempo</label><select class="in" id="live-h"><option value="1">1 hora</option><option value="2" selected>2 horas</option><option value="3">3 horas</option><option value="5">5 horas</option></select></div></div>
          <button class="btn coral block" id="live-on" style="margin-top:12px">Empezar en vivo</button>`}
        <datalist id="stores">${STORES.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
      <h2 class="section-title">El mall virtual</h2>
      <div class="card"><label class="f" style="margin-top:0">Nombre del mall</label>
        <div class="row"><input class="in" id="mall-name" value="${esc(s.mall_name || "Aventura Mall")}"><button class="btn sm" id="mall-save">Guardar</button></div>
        <label class="f">Fotos del pasillo (se ven al caminar de una tienda a otra)</label>
        <div class="row" style="flex-wrap:wrap;gap:8px">${(Array.isArray(s.mall_photos) ? s.mall_photos : []).map((u, i) => `<span class="thumb" style="width:64px;height:48px;border-radius:8px;position:relative"><img src="${esc(u)}" alt=""><button class="mini-x" data-unmall="${i}" aria-label="Quitar foto">×</button></span>`).join("")}
          <label class="btn ghost sm">${ICON.cam}Agregar foto del pasillo<input type="file" accept="image/*" multiple hidden id="mall-photo"></label></div>
        <label class="f">Fachada de cada tienda (opcional: foto de una vitrina real)</label>
        <div class="stack" id="facades">${Object.keys(SHOPS).map((cat) => `<div class="row"><span class="thumb" style="width:52px;height:40px;border-radius:8px">${(s.store_photos || {})[cat] ? `<img src="${esc(s.store_photos[cat])}" alt="">` : shopEmoji(cat)}</span><span class="grow">${esc(shopName(cat))}</span>
          <label class="btn ghost sm">${(s.store_photos || {})[cat] ? "Cambiar" : ICON.cam + "Foto"}<input type="file" accept="image/*" hidden data-facade="${esc(cat)}"></label>${(s.store_photos || {})[cat] ? `<button class="btn ghost sm" data-unfacade="${esc(cat)}">Quitar</button>` : ""}</div>`).join("")}</div>
      </div>
      <h2 class="section-title">La caja</h2>
      <form class="card" id="cajaf">
        <div class="row"><span class="mini-cashier big">${cashierFace()}</span><div class="grow"><label class="f" style="margin-top:0">Nombre de quien atiende la caja</label><input class="in" name="cashier_name" value="${esc(s.cashier_name || "Cheryl")}"></div></div>
        <label class="btn ghost sm" style="margin-top:10px">${ICON.cam}${s.cashier_photo ? "Cambiar foto" : "Subir foto de la cajera"}<input type="file" accept="image/*" hidden id="cashier-photo"></label>
        <div class="two">
          <div><label class="f">Banco</label><input class="in" name="bank_name" value="${esc(s.bank_name || "")}" placeholder="Banco de Chile"></div>
          <div><label class="f">Tipo de cuenta</label><input class="in" name="bank_account_type" value="${esc(s.bank_account_type || "")}" placeholder="Cuenta corriente"></div>
          <div><label class="f">N° de cuenta</label><input class="in" name="bank_account" value="${esc(s.bank_account || "")}"></div>
          <div><label class="f">RUT</label><input class="in" name="bank_rut" value="${esc(s.bank_rut || "")}" placeholder="12.345.678-9"></div>
          <div><label class="f">Nombre del titular</label><input class="in" name="bank_holder" value="${esc(s.bank_holder || "")}"></div>
          <div><label class="f">Correo</label><input class="in" name="bank_email" value="${esc(s.bank_email || "")}" inputmode="email"></div>
        </div>
        <button class="btn block" style="margin-top:14px">Guardar datos de la caja</button>
      </form>
      <h2 class="section-title">Precios y cálculo</h2>
      <form class="card" id="setf">
        <label class="lm-toggle"><input type="checkbox" name="fx_auto" ${s.fx_auto === false ? "" : "checked"}><span>Dólar automático del día</span><small>Se actualiza cada hora con el dólar observado del Banco Central de Chile. Si no hay conexión se usa el valor de abajo.${state.fx ? " Hoy: " + clp(state.fx.v) + "." : ""}</small></label>
        <div class="two">${f("usd_clp", "Dólar en pesos (respaldo)")}${f("fl_tax_pct", "Impuesto Florida %")}${f("fee_pct", "Tu comisión % (sobre el precio de compra)")}${f("min_fee_usd", "Comisión mínima US$")}${f("cl_duty_pct", "Arancel Chile %")}${f("cl_vat_pct", "IVA Chile %")}</div>
        <h3 style="font-size:15px;margin:16px 0 0">Courier</h3>
        <div class="two">${f("ship_usd_per_kg", "Transporte US$ por kg")}${f("vol_divisor", "Divisor volumétrico")}${f("fixed_kg", "Peso fijo por producto (kg vol.; 0 = medir)")}${f("min_charge_kg", "Mínimo cobrable (kg)")}${f("customs_fixed_usd", "Gastos de aduana fijos US$")}${f("insurance_pct", "Seguro % del valor")}</div>
        <p class="small muted" style="margin:6px 0 0">Peso cobrable = el mayor entre el peso real y largo×ancho×alto (cm) ÷ divisor.</p>
        <label class="f">Dirección de la casilla (sin nombre ni N° de casillero)</label><textarea class="in" name="locker_address">${esc(s.locker_address)}</textarea>
        <label class="f">Instrucciones de pago</label><textarea class="in" name="payment_instructions">${esc(s.payment_instructions)}</textarea>
        <label class="f">Tu WhatsApp (con código de país)</label><input class="in" name="whatsapp" value="${esc(s.whatsapp)}" placeholder="+1 305 555 1234" inputmode="tel">
        <button class="btn block" style="margin-top:14px">Guardar ajustes</button>
        <p class="small muted" style="margin-bottom:0">Confirma el arancel y el IVA con tu courier: desde el 25 oct 2025 todas las compras internacionales pagan IVA del 19% en Chile.</p></form>
      ${!state.api.demo ? `<button class="btn ghost block" id="logout" style="margin-top:16px">Cerrar sesión</button>` : ""}`;
    const save = async (p, msg) => { state.settings = { ...state.settings, ...(await state.api.saveSettings(p)) }; toast(msg); VIEWS.ajustes(view); };
    $("#live-on") && ($("#live-on").onclick = () => save({ live_store: $("#live-store").value.trim() || null, live_until: new Date(Date.now() + Number($("#live-h").value) * 3600e3).toISOString() }, "¡Estás en vivo!"));
    $("#cajaf").onsubmit = (e) => { e.preventDefault(); const fd = new FormData(e.target); const p = {}; for (const k of ["cashier_name","bank_name","bank_account_type","bank_account","bank_rut","bank_holder","bank_email"]) p[k] = String(fd.get(k) || "").trim(); save(p, "Datos de la caja guardados"); };
    $("#cashier-photo").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("Subiendo foto…"); const url = await state.api.uploadPhoto(await resizeImage(f, 700, 0.85), "cashier"); save({ cashier_photo: url }, "Foto de la cajera guardada"); };
    $("#mall-save").onclick = () => save({ mall_name: $("#mall-name").value.trim() || "Aventura Mall" }, "Nombre del mall guardado");
    const setFacade = async (cat, file) => {
      toast("Subiendo foto…");
      const url = await state.api.uploadPhoto(await resizeImage(file, 1000, 0.8), "facades");
      await save({ store_photos: { ...(state.settings.store_photos || {}), [cat]: url } }, "Fachada de " + shopName(cat) + " guardada");
    };
    view.querySelectorAll("[data-facade]").forEach((inp) => (inp.onchange = () => inp.files[0] && setFacade(inp.dataset.facade, inp.files[0])));
    view.querySelectorAll("[data-unfacade]").forEach((b) => (b.onclick = () => { const p = { ...(state.settings.store_photos || {}) }; delete p[b.dataset.unfacade]; save({ store_photos: p }, "Fachada quitada"); }));
    $("#mall-photo").onchange = async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      toast("Subiendo fotos del pasillo…");
      const urls = [];
      for (const f of files) urls.push(await state.api.uploadPhoto(await resizeImage(f, 1200, 0.8), "mall"));
      save({ mall_photos: [...mallPhotos(), ...urls] }, "Fotos del pasillo guardadas");
    };
    view.querySelectorAll("[data-unmall]").forEach((b) => (b.onclick = () => { const p = [...mallPhotos()]; p.splice(+b.dataset.unmall, 1); save({ mall_photos: p }, "Foto quitada"); }));
    $("#live-off") && ($("#live-off").onclick = () => save({ live_until: null }, "En vivo terminado"));
    $("#setf").onsubmit = (e) => {
      e.preventDefault(); const fd = new FormData(e.target); const p = {};
      p.fx_auto = !!fd.get("fx_auto");
      for (const k of ["usd_clp","fl_tax_pct","fee_pct","min_fee_usd","cl_duty_pct","cl_vat_pct","ship_usd_per_kg","vol_divisor","fixed_kg","min_charge_kg","customs_fixed_usd","insurance_pct"]) { const v = num(fd.get(k)); if (v == null) return toast("Revisa el campo: " + k); p[k] = v; }
      for (const k of ["locker_address","payment_instructions","whatsapp"]) p[k] = fd.get(k).trim();
      save(p, "Ajustes guardados");
    };
    $("#logout") && ($("#logout").onclick = () => state.api.signOut());
    window.MSOrdenes?.ajustes(view);   // "Pasos del despacho" de la orden de compra (ordenes.js)
  },
};
// Centro financiero de la shopper (finanzas.js / finanzas.css): ruta #finanzas
window.MSApp = { state, quote, quote2x1, sheet, toast, go, cherylName, APP_NAME };
VIEWS.finanzas = (view) => (window.MSFinanzas ? window.MSFinanzas.view(view) : (view.innerHTML = `<div class="empty">No se pudo cargar el centro financiero. Recarga la app.</div>`));
// Base de clientas de la shopper (clientes.js / clientes.css): ruta #clientes
Object.assign(window.MSApp, { render, boot, waTo, ORDER_STEPS, isPdfRef, openableUrl });
// Pedido → transferencia → orden de compra (ordenes.js / ordenes.css)
Object.assign(window.MSApp, { b3Breakdown, b3Totals, b3Desc, fxNote, bankHTML, wireCopy, receiptUploader, contactCherylLink, groupOrders });
// Encargos (encargos.js / encargos.css): reutiliza el formulario de publicar, la ficha del producto y el cálculo
Object.assign(window.MSApp, { publishForm, openOffer, appLink, quote, quoteHTML, clp, usd, ago, catOf, photosOf, shopName, shopOfCategory, ICON, CATEGORIES, BRANDS, COLORS, vision, isShopper });
// Afiche grande de la tienda (campanas.js): fotos reducidas y ofertas de cada tienda
Object.assign(window.MSApp, { resizeImage, blobToDataURL, offersIn, fmtPct });
// Afiches de la vitrina (4 pantallas, campanas.js): destacadas, género del catálogo y vitrinas de cada oferta
Object.assign(window.MSApp, { featuredIn, vitrinaPicks, vitrinasOf, genderOk, getGender, shopNeedsGender, VITRINA_MAX });
VIEWS.clientes = (view) => (window.MSClientes ? window.MSClientes.view(view) : (view.innerHTML = `<div class="empty">No se pudo cargar la lista de clientes. Recarga la app.</div>`));

// =====================================================================
// SHOPPER: "Mis tiendas" — panel por tienda: qué va en la vitrina (y en qué orden) y qué va adentro
// =====================================================================
const panelIsOn = (o) => o.status === "active" && new Date(o.expires_at) > new Date();
// Cambiar un producto de tienda: categoría y "último minuto" quedan coherentes con la tienda elegida
function panelMovePatch(o, from, to) {
  if (to === LAST) return { last_minute: true };
  const p = {};
  if (!SHOPS[to][2].includes(o.category)) p.category = to === "Otros" ? "Otros" : SHOPS[to][2][0];
  if (from === LAST) p.last_minute = false;
  if (womenOnlyCat(p.category || o.category)) p.gender = "mujer";
  // Ropa Hombre / Ropa Mujer fijan el género (tiendas.js)
  if (to === "RopaHombre") p.gender = "hombre";
  else if (to === "Ropa" && genderOf(o) === "hombre") p.gender = "mujer";
  return p;
}
async function panelRenumber(list) {           // guarda el orden de los afiches: 0, 1, 2, 3 (salta las pantallas con foto subida, campanas.js)
  const skip = window.MSCampanas?.photoSlots?.(state.panelCat) || [];
  for (let i = 0, p = 0; i < list.length; i++, p++) { while (skip.includes(p)) p++; if (Number(list[i].vitrina_pos) !== p || list[i].vitrina_pos === null || list[i].vitrina_pos === undefined) { list[i].vitrina_pos = p; await state.api.updateOffer(list[i].id, { vitrina_pos: p }); } }
}
function panelCard(o, cat, zone, i, n) {
  const on = panelIsOn(o), wo = womenOnlyCat(o.category), d = discOf(o);
  const vit = zone === "vitrina";
  return `<article class="pn-card${on ? "" : " gone"}${vit ? " pn-vit" : ""}" data-id="${esc(o.id)}" ${vit ? `draggable="true"` : ""}>
    <div class="pn-top">
      ${vit ? `<span class="pn-pos" aria-label="Afiche ${i + 1} de ${n}">${i + 1}</span>` : ""}
      <span class="pn-thumb">${photoOrEmoji(o)}</span>
      <div class="pn-txt"><b class="pn-t">${esc(o.title)}</b>
        <span class="pn-m">${esc(o.brand || "Sin marca")} · ${esc(o.store || "")}</span>
        <span class="pn-m"><b>${usd(o.price_usd)}</b>${d ? ` <s>${usd(o.tag_price_usd)}</s> −${fmtPct(o.discount_pct)}%` : ""} · ${on ? "vence " + ago(o.expires_at).replace("Hace", "en").replace("Recién", "pronto") : o.status === "gone" ? "ya no está" : "vencida"}</span></div>
      ${vit ? `<span class="pn-arrows"><button type="button" class="pn-ar" data-up="${esc(o.id)}" aria-label="Subir afiche" ${i ? "" : "disabled"}>↑</button><button type="button" class="pn-ar" data-down="${esc(o.id)}" aria-label="Bajar afiche" ${i < n - 1 ? "" : "disabled"}>↓</button></span>` : ""}
    </div>
    ${on ? `<button type="button" class="pn-move ${vit ? "out" : "in"}" data-${vit ? "toin" : "tovit"}="${esc(o.id)}">${vit ? "Pasar adentro de la tienda" : ICON.star + "Poner en vitrina"}</button>` : ""}
    ${wo || TIENDAS.isClothes(o.category) ? `<div class="pn-g pn-gfix">${o.category === "RopaHombre" ? "Catálogo de hombre · Ropa Hombre" : TIENDAS.isClothes(o.category) ? "Catálogo de mujer · Ropa Mujer" : "Catálogo de mujer"}</div>` : `<div class="pn-g" role="radiogroup" aria-label="Para quién es">${GENDERS.map(([k, l]) => `<button type="button" role="radio" class="pn-gb${genderOf(o) === k ? " on" : ""}" data-gid="${esc(o.id)}" data-g="${k}" aria-checked="${genderOf(o) === k}">${l}</button>`).join("")}</div>`}
    <div class="pn-acts">
      <button type="button" class="btn ghost sm" data-mv="${esc(o.id)}">Cambiar tienda</button>
      <button type="button" class="btn ghost sm" data-edit="${esc(o.id)}">Editar</button>
      <button type="button" class="btn ghost sm" data-gal="${esc(o.id)}">${ICON.cam}Fotos (${photosOf(o).length})</button>
      <button type="button" class="btn ghost sm" data-meas="${esc(o.id)}">${ICON.ruler}Medir</button>
      <button type="button" class="btn sm ${o.last_minute ? "gold" : "ghost"}" data-lm="${esc(o.id)}">${ICON.bolt}${o.last_minute ? "Quitar de último minuto" : "Mover a último minuto"}</button>
      ${on ? `<button type="button" class="btn ghost sm" data-gone="${esc(o.id)}">Ya no está</button><button type="button" class="btn ghost sm" data-extend="${esc(o.id)}">+24 h</button>` : `<button type="button" class="btn ghost sm" data-revive="${esc(o.id)}">Reactivar 24 h</button>`}
      <button type="button" class="btn sm dv-del" data-del="${esc(o.id)}">${ICON.trash}Eliminar</button>
    </div>
  </article>`;
}
async function shopPanel(view) {
  const y0 = window.scrollY;
  const all = (await state.api.listAllOffers()).filter((o) => !o.reserved_for);   // las reservadas para una clienta se ven en Encargos
  try { state.offers = await state.api.listOffers(); } catch {}
  const active = all.filter(panelIsOn), old = all.filter((o) => !panelIsOn(o));
  const cat = state.panelCat && SHOPS[state.panelCat] ? state.panelCat : null;
  const again = () => shopPanel(view).then(() => window.scrollTo(0, y0));
  const byId = (id) => all.find((o) => String(o.id) === String(id));
  if (!cat) {
    view.innerHTML = `<p class="pn-lede">Toca una tienda para elegir qué va en la vitrina (máx. ${VITRINA_MAX} afiches) y qué queda adentro.</p>
      <div class="pn-grid">${Object.keys(SHOPS).map((k) => { const v = Math.min(VITRINA_MAX, featuredIn(k, active).length), n = offersIn(k, active).length;
        return `<button type="button" class="pn-tile${k === LAST ? " lm" : ""}" data-pcat="${esc(k)}"><img src="${esc(sbImg(k))}" alt="" loading="lazy"><span class="pn-tn">${esc(shopName(k))}</span>
          <span class="pn-tc"><span>Vitrina <b>${v}/${VITRINA_MAX}</b></span><span>Adentro <b>${Math.max(0, n - v)}</b></span></span></button>`; }).join("")}</div>
      ${old.length ? `<div class="pn-oldhead"><h2 class="section-title">Vencidas o agotadas (${old.length})</h2>${state.pnSel ? "" : `<button type="button" class="btn ghost sm" id="pn-selmode">Seleccionar</button>`}</div>
        ${state.pnSel ? `<div class="pn-selbar" role="toolbar" aria-label="Selección">
          <label class="pn-selall"><input type="checkbox" id="pn-all" ${state.pnSel.size === old.length ? "checked" : ""}><span>Seleccionar todas (${old.length})</span></label>
          <span class="small muted" id="pn-n">${state.pnSel.size} seleccionadas</span>
          <div class="row" style="gap:8px;margin-left:auto"><button type="button" class="btn ghost sm" id="pn-selno">Cancelar</button><button type="button" class="btn dv-del sm" id="pn-seldel" ${state.pnSel.size ? "" : "disabled"}>${ICON.trash}Eliminar (${state.pnSel.size})</button></div></div>` : ""}
        <div class="pn-list${state.pnSel ? " pn-selecting" : ""}" id="pn-old">${old.slice(0, state.pnSel ? old.length : 40).map((o) => panelCard(o, shopOfCategory(o.category), "old")).join("")}</div>` : ""}`;
    if (old.length) {
      const redraw = () => { const y = window.scrollY; return shopPanel(view).then(() => window.scrollTo(0, y)); };
      const sm = $("#pn-selmode", view); if (sm) sm.onclick = () => { state.pnSel = new Set(); redraw(); };
      if (state.pnSel) {
        const sel = state.pnSel, ids = new Set(old.map((o) => String(o.id)));
        [...sel].forEach((id) => ids.has(id) || sel.delete(id));
        const paint = () => {
          view.querySelectorAll("#pn-old .pn-card").forEach((c) => { const on = sel.has(String(c.dataset.id)); c.classList.toggle("pn-picked", on); const k = c.querySelector(".pn-chk input"); if (k) k.checked = on; });
          $("#pn-n", view).textContent = `${sel.size} seleccionadas`;
          const d = $("#pn-seldel", view); d.disabled = !sel.size; d.innerHTML = `${ICON.trash}Eliminar (${sel.size})`;
          $("#pn-all", view).checked = sel.size === old.length;
        };
        view.querySelectorAll("#pn-old .pn-card").forEach((c) => {
          c.insertAdjacentHTML("afterbegin", `<label class="pn-chk"><input type="checkbox" aria-label="Seleccionar ${esc(byId(c.dataset.id)?.title || "producto")}"></label>`);
          c.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const id = String(c.dataset.id); sel.has(id) ? sel.delete(id) : sel.add(id); paint(); };
        });
        $("#pn-all", view).onchange = (e) => { sel.clear(); if (e.target.checked) old.forEach((o) => sel.add(String(o.id))); paint(); };
        $("#pn-selno", view).onclick = () => { state.pnSel = null; redraw(); };
        $("#pn-seldel", view).onclick = () => {
          const n = sel.size; if (!n) return;
          sheet(`<h2>¿Eliminar ${n} ${n > 1 ? "productos" : "producto"}?</h2><p class="muted" style="margin:0 0 14px">Se borran con sus fotos y no se pueden recuperar. Así liberas espacio en el teléfono.</p>
            <div class="row dv-confirm"><button class="btn ghost" data-close>Cancelar</button><button class="btn dv-del dv-del-yes" data-yes>${ICON.trash}Eliminar ${n}</button></div>`, (el, close) => {
            el.querySelector("[data-yes]").onclick = async (e) => {
              e.currentTarget.disabled = true; e.currentTarget.textContent = "Eliminando…";
              try { await state.api.deleteOffers([...sel]); } catch (err) { close(); return toast(err.message); }
              state.pnSel = null; close(); toast(`${n} ${n > 1 ? "productos eliminados" : "producto eliminado"}`); redraw();
            };
          });
        };
        paint();
      }
    }
    view.querySelectorAll("[data-pcat]").forEach((b) => (b.onclick = () => { state.panelCat = b.dataset.pcat; shopPanel(view).then(() => window.scrollTo(0, 0)); }));
  } else {
    const feats = featuredIn(cat, active).slice(0, VITRINA_MAX);
    const inside = offersIn(cat, active).filter((o) => !feats.includes(o)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const auto = feats.length < 2;
    view.innerHTML = `<div class="pn-head"><button type="button" class="btn ghost sm pn-back" id="pnback">← Todas las tiendas</button><h2 class="pn-name">${esc(shopName(cat))}</h2>
        <span class="pn-hc">Vitrina <b>${feats.length}/${VITRINA_MAX}</b> · Adentro <b>${inside.length}</b></span></div>
      <section class="pn-zone pn-zv" aria-label="En vitrina">
        <h3 class="pn-zh">En vitrina <span>${feats.length}/${VITRINA_MAX} · en este orden se pegan en el vidrio</span></h3>
        <div class="pn-prev" data-vf3h="${window.innerWidth < 700 ? 330 : 420}" aria-label="Vista previa de la vitrina como la ve la clienta"></div>
        ${auto ? `<p class="pn-note">Con menos de 2 afiches destacados, la vitrina se completa sola con los de mayor descuento.</p>` : ""}
        <div class="pn-list" id="pnvit">${feats.length ? feats.map((o, i) => panelCard(o, cat, "vitrina", i, feats.length)).join("") : `<div class="pn-empty">Todavía no eliges afiches. Toca “Poner en vitrina” en un producto de abajo.</div>`}</div>
      </section>
      <section class="pn-zone pn-zi" aria-label="Dentro de la tienda">
        <h3 class="pn-zh">Dentro de la tienda <span>${inside.length} ${inside.length === 1 ? "producto" : "productos"}</span></h3>
        <div class="pn-list">${inside.length ? inside.map((o) => panelCard(o, cat, "inside")).join("") : `<div class="pn-empty">No hay más productos en esta tienda.</div>`}</div>
      </section>`;
    window.MSCampanas?.section(view.querySelector(".pn-zv"), cat, again);   // "Afiches de la vitrina": 4 pantallas (campanas.js)
    view.querySelector("#pnback").onclick = () => { state.panelCat = null; shopPanel(view).then(() => window.scrollTo(0, 0)); };
    // vista previa: el mismo render de vitrina que ve la clienta (sin tocar)
    const prev = view.querySelector(".pn-prev"), keep = state.cat;
    try { state.cat = cat; storeWindow(prev); } catch (e) { console.warn(e); } finally { state.cat = keep; }
    prev.querySelectorAll("button").forEach((b) => { b.tabIndex = -1; b.onclick = null; });
    const reorder = async (ids) => { const list = ids.map(byId).filter(Boolean); list.forEach((o) => (o.vitrina_pos = null)); await panelRenumber(list); toast("Orden de la vitrina guardado"); again(); };
    const ids = feats.map((o) => String(o.id));
    view.querySelectorAll("[data-up],[data-down]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.up || b.dataset.down, i = ids.indexOf(id), j = i + (b.dataset.up ? -1 : 1);
      if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; reorder(ids);
    }));
    // arrastrar para reordenar (mouse / lápiz)
    let dragId = null;
    view.querySelectorAll("#pnvit .pn-card").forEach((c) => {
      c.addEventListener("dragstart", (e) => { dragId = c.dataset.id; c.classList.add("drag"); try { e.dataTransfer.setData("text/plain", dragId); e.dataTransfer.effectAllowed = "move"; } catch {} });
      c.addEventListener("dragend", () => c.classList.remove("drag"));
      c.addEventListener("dragover", (e) => { e.preventDefault(); c.classList.add("over"); });
      c.addEventListener("dragleave", () => c.classList.remove("over"));
      c.addEventListener("drop", (e) => { e.preventDefault(); c.classList.remove("over"); const to = c.dataset.id; if (!dragId || dragId === to) return; const a = ids.filter((x) => x !== dragId); a.splice(a.indexOf(to) + (ids.indexOf(dragId) < ids.indexOf(to) ? 1 : 0), 0, dragId); reorder(a); });
    });
    view.querySelectorAll("[data-toin]").forEach((b) => (b.onclick = async () => {
      const o = byId(b.dataset.toin); await state.api.updateOffer(o.id, { featured: false, vitrina_pos: null });
      await panelRenumber(feats.filter((x) => x !== o)); toast("Pasó adentro de la tienda"); again();
    }));
    view.querySelectorAll("[data-tovit]").forEach((b) => (b.onclick = async () => {
      const o = byId(b.dataset.tovit);
      const other = vitrinasOf(o).find((c) => c !== cat && featuredIn(c, active).filter((x) => x !== o).length >= VITRINA_MAX);
      if (other) return toast(`La vitrina de ${shopName(other)} también lo mostraría y está llena: saca uno allá primero`);
      if (feats.length < VITRINA_MAX - (window.MSCampanas?.photoSlots?.(cat).length || 0)) { await state.api.updateOffer(o.id, { featured: true, vitrina_pos: feats.length }); await panelRenumber([...feats, o]); toast("Puesto en la vitrina"); return again(); }
      // vitrina llena: ¿cuál sale?
      sheet(`<h2>La vitrina está llena</h2><p class="muted" style="margin:0 0 12px">¿Cuál afiche sacas para poner “${esc(o.title)}”? El que saques queda adentro de la tienda.</p>
        <div class="pn-swap">${feats.map((x, i) => `<button type="button" class="pn-sw" data-out="${esc(x.id)}"><span class="pn-pos">${i + 1}</span><span class="pn-thumb">${photoOrEmoji(x)}</span><span class="pn-t">${esc(x.title)}</span></button>`).join("")}</div>
        <button class="btn ghost block" data-close style="margin-top:12px">Cancelar</button>`, (el, close) => el.querySelectorAll("[data-out]").forEach((x) => (x.onclick = async () => {
          const out = byId(x.dataset.out), i = feats.indexOf(out); close();
          await state.api.updateOffer(out.id, { featured: false, vitrina_pos: null });
          await state.api.updateOffer(o.id, { featured: true, vitrina_pos: i });
          const list = feats.slice(); list[i] = o; await panelRenumber(list);
          toast(`Cambiado: “${o.title}” en la vitrina`); again();
        })));
    }));
  }
  // ---- acciones comunes (tarjetas de cualquier zona) ----
  view.querySelectorAll("[data-gid]").forEach((b) => (b.onclick = async () => { await state.api.updateOffer(b.dataset.gid, TIENDAS.genderPatch(byId(b.dataset.gid), b.dataset.g)); toast("Catálogo: " + genderLabel(b.dataset.g)); again(); }));
  view.querySelectorAll("[data-mv]").forEach((b) => (b.onclick = () => {
    const o = byId(b.dataset.mv), from = cat || shopOfCategory(o.category);
    sheet(`<h2>¿A qué tienda lo mueves?</h2><p class="muted" style="margin:0 0 10px">${esc(o.title)}</p><div class="stpick">${storeTilesHTML(from)}</div>`, (el, close) => el.querySelectorAll("[data-store]").forEach((x) => (x.onclick = async () => {
      const to = x.dataset.store; close(); if (to === from) return;
      const p = panelMovePatch(o, from, to);
      if (o.featured) { const full = featuredIn(to, active).filter((y) => y !== o).length >= VITRINA_MAX; if (full) Object.assign(p, { featured: false, vitrina_pos: null }); else p.vitrina_pos = featuredIn(to, active).length; }
      await state.api.updateOffer(o.id, p); toast("Movido a " + shopName(to)); again();
    })));
  }));
  view.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => {
    const o = byId(b.dataset.edit);
    sheet(`<h2>Editar producto</h2><form id="pned">
        <label class="f">Nombre</label><input class="in" name="title" value="${esc(o.title)}" required>
        <div class="two"><div><label class="f">Marca</label><input class="in" name="brand" value="${esc(o.brand || "")}"></div><div><label class="f">Tienda (local)</label><input class="in" name="store" value="${esc(o.store || "")}"></div></div>
        <div class="two"><div><label class="f">Precio final US$</label><input class="in" name="price" inputmode="decimal" value="${esc(o.price_usd)}" required></div><div><label class="f">Precio etiqueta US$</label><input class="in" name="tag" inputmode="decimal" value="${esc(o.tag_price_usd || "")}" placeholder="sin descuento"></div></div>
        <div class="two"><div><label class="f">Descuento %</label><input class="in" name="d1" inputmode="decimal" value="${esc(o.discount1_pct || (o.discount2_pct ? "" : o.discount_pct) || "")}" placeholder="opcional"></div><div><label class="f">Descuento extra %</label><input class="in" name="d2" inputmode="decimal" value="${esc(o.discount2_pct || "")}" placeholder="sobre el anterior"></div></div>
        <p class="small muted" style="margin:4px 0 0">Si pones precio etiqueta y descuentos, el precio final se calcula solo: etiqueta − descuento, y a ese total se le resta el extra.</p>
        <label class="f">Colores disponibles</label><p class="small muted" style="margin:-2px 0 6px">Toca para agregar o quitar</p>
        <div class="swatches" id="pned-sw">${COLORS.map(([n, h]) => { const on = listOf(o.colors).some((c) => String(c).toLowerCase() === n.toLowerCase()); return `<button type="button" class="sw${on ? " on" : ""}" data-color="${n}" style="--c:${h}" aria-pressed="${on}"><span></span>${n}</button>`; }).join("")}</div>
        <label class="f">Tallas</label><input class="in" name="sizes" value="${esc(listOf(o.sizes).join(", "))}">
        <button class="btn gold block" style="margin-top:14px">Guardar</button><button type="button" class="btn ghost block" data-close style="margin-top:8px">Cancelar</button></form>`, (el, close) => {
      el.querySelectorAll("#pned-sw .sw").forEach((b) => (b.onclick = () => { const on = !b.classList.contains("on"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }));
      el.querySelector("#pned").onsubmit = async (e) => {
        e.preventDefault(); const E = e.target.elements, tag = num(E.tag.value);
        const d1 = Math.min(95, Math.max(0, num(E.d1.value) || 0)), d2 = Math.min(95, Math.max(0, num(E.d2.value) || 0));
        const byPct = tag && (d1 || d2);
        const price = byPct ? withDiscount2(tag, d1, d2) : num(E.price.value);
        if (!price) return toast("Escribe el precio");
        const disc = byPct ? stackPct(d1, d2) : tag && tag > price ? Math.round(100 - (100 * price) / tag) : null;
        await state.api.updateOffer(o.id, { title: E.title.value.trim() || o.title, brand: E.brand.value.trim() || null, store: E.store.value.trim() || null, price_usd: price, tag_price_usd: disc ? tag : null, discount_pct: disc || null, discount1_pct: byPct ? d1 || null : null, discount2_pct: byPct ? d2 || null : null, sizes: listOf(E.sizes.value),
          colors: [...listOf(o.colors).filter((c) => !COLORS.some(([n]) => n.toLowerCase() === String(c).toLowerCase())), ...[...el.querySelectorAll("#pned-sw .sw.on")].map((b) => b.dataset.color)] });
        close(); toast("Producto actualizado"); again();
      };
    });
  }));
  view.querySelectorAll("[data-gone]").forEach((b) => (b.onclick = async () => { await state.api.updateOffer(b.dataset.gone, { status: "gone", featured: false, vitrina_pos: null }); toast("Marcada como agotada"); again(); }));
  view.querySelectorAll("[data-extend]").forEach((b) => (b.onclick = async () => { const o = byId(b.dataset.extend); await state.api.updateOffer(o.id, { expires_at: new Date(new Date(o.expires_at).getTime() + 24 * 3600e3).toISOString() }); toast("Extendida 24 horas"); again(); }));
  view.querySelectorAll("[data-revive]").forEach((b) => (b.onclick = async () => { await state.api.updateOffer(b.dataset.revive, { status: "active", expires_at: new Date(Date.now() + 24 * 3600e3).toISOString() }); toast("Reactivada"); again(); }));
  view.querySelectorAll("[data-lm]").forEach((b) => (b.onclick = async () => {
    const o = byId(b.dataset.lm);
    if (!o.last_minute && o.featured && featuredIn(LAST, active).filter((x) => x !== o).length >= VITRINA_MAX) return toast(`La vitrina de ${LAST_NAME} está llena: saca un afiche allá primero`);
    await state.api.updateOffer(o.id, { last_minute: !o.last_minute }); toast(o.last_minute ? "Quitada de último minuto" : `Movida a último minuto (${LAST_NAME})`); again();
  }));
  view.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const o = byId(b.dataset.del);
    sheet(`<h2>¿Eliminar este producto?</h2><p class="muted" style="margin:0 0 4px">Ya no aparecerá en el mall.</p><div class="small muted" style="margin-bottom:14px">${esc(o.title)}</div>
      <div class="row dv-confirm"><button class="btn ghost" data-close>Cancelar</button><button class="btn dv-del dv-del-yes" data-yes>${ICON.trash}Eliminar</button></div>`, (el, close) => {
      el.querySelector("[data-yes]").onclick = async (e) => {
        e.currentTarget.disabled = true;
        try { await state.api.deleteOffer(o.id); } catch (err) { close(); return toast(err.message); }
        close(); toast("Producto eliminado"); again();
      };
    });
  }));
  view.querySelectorAll("[data-gal]").forEach((b) => (b.onclick = () => openGallery(byId(b.dataset.gal), again)));
  view.querySelectorAll("[data-meas]").forEach((b) => (b.onclick = () => openMeasure(byId(b.dataset.meas), again)));
}

// ---------- Tarjetas ----------
const searchPhone = (s) => s.phone || s.client?.phone || "";   // tarjetas de encargo: encargos.js
function stepsBar(steps, status) { const i = steps.findIndex((x) => x[0] === status); return `<div class="steps">${steps.map((_, j) => `<span class="${j <= i ? "on" : ""}"></span>`).join("")}</div>`; }
function groupOrders(orders) {
  const m = new Map();
  for (const o of orders) { const k = o.order_code || o.id; if (!m.has(k)) m.set(k, { code: o.order_code || "", rows: [] }); m.get(k).rows.push(o); }
  return [...m.values()];
}
function orderGroupCard(g, shop) {
  if (!g.code) return orderCard(g.rows[0], shop);
  const r0 = g.rows[0], total = g.rows.reduce((t, o) => t + (Number(o.total_clp) || 0), 0);
  const receipt = g.rows.find((o) => o.receipt_path)?.receipt_path;
  const pending = g.rows.some((o) => o.status === "pendiente_pago");
  const cl = r0.client || {};
  const oc = window.MSOrdenes;   // estado, desglose, comprobante y orden de compra (ordenes.js)
  return `<div class="card order-g" data-ocode="${esc(g.code)}">
    <div class="row"><b class="grow">Pedido ${esc(g.code)}</b>${oc ? "" : receipt ? `<span class="pill green">Comprobante recibido</span>` : pending ? `<span class="pill amber">Esperando transferencia</span>` : ""}</div>
    <div class="small muted">${ago(r0.created_at)} · ${g.rows.length} ${g.rows.length === 1 ? "producto" : "productos"} · total ${clp(total)}</div>
    ${shop ? `<div class="row" style="margin-top:6px;gap:6px;flex-wrap:wrap"><span class="small grow">${esc(cl.full_name || "Cliente")} ${cl.phone ? "· " + esc(cl.phone) : ""}</span>${cl.phone ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waTo(cl.phone, `Hola ${(cl.full_name || "").split(" ")[0]}, soy ${cherylName()}. Recibí tu orden ${g.code}.`))}">WhatsApp</a>` : ""}</div>${window.MSClientes?.orderTag(g.rows.find((o) => o.customer_code || o.ship_to) || r0) || ""}` : ""}
    ${oc ? oc.cardHTML(g, shop) : ""}
    <div class="stack" style="margin-top:10px">${g.rows.map((o) => orderCard(o, shop, true)).join("")}</div>
    ${receipt ? `<button class="btn ghost block sm" data-receipt-view="${esc(receipt)}" style="margin-top:10px">Ver comprobante de transferencia</button>` : ""}
    ${!oc && shop && receipt && pending ? `<button class="btn gold block sm" data-paid="${g.rows.map((o) => o.id).join(",")}" style="margin-top:8px">Confirmar pago recibido</button>` : ""}
    ${!shop && pending ? `<div style="margin-top:10px">${receipt ? "" : receiptUploader(g.code).html.replace("Subir comprobante (foto o PDF)", "Subir comprobante de transferencia")}</div>` : ""}
  </div>`;
}
// Estados que Cheryl puede elegir a mano en un producto (ordenes.js):
//  · sin orden de compra y aún sin pagar (pendiente / comprobante): solo el actual; el pago se aprueba con
//    "Aprobar pago y generar orden de compra" (exige comprobante)
//  · con OC: de "Pagado" en adelante; "Enviado"/"Entregado" solo si ya se registró el envío
//  · pedidos antiguos ya pagados sin OC (datos previos): de "Pagado" en adelante
function rowStatusOptions(o) {
  const idx = (v) => ORDER_STEPS.findIndex((x) => x[0] === v);
  if (!window.MSOrdenes || !o.order_code) return ORDER_STEPS;
  if (!o.oc_number && idx(o.status) < 2) return ORDER_STEPS.filter(([v]) => v === o.status);
  return ORDER_STEPS.filter(([v]) => (idx(v) >= 2 && (o.shipment || !o.oc_number || !["enviado", "entregado"].includes(v))) || v === o.status);
}
function orderCard(o, shop, inner) {
  const cancelled = o.status === "cancelado";
  // colores (ordenes.js): pendiente = rojo, por aprobar = ámbar, pagado / hecho = verde, cancelado = gris
  const tone = (s) => (window.MSOrdenes ? "st-" + window.MSOrdenes.tone(s) : s === "entregado" ? "green" : s === "pendiente_pago" ? "red" : "amber");
  return `<div class="${inner ? "order-row" : "card"}"><div class="row"><div class="t grow">${esc(o.description)}</div>${cancelled ? `<span class="pill ${tone("cancelado")}">Cancelado</span>` : `<span class="pill ${tone(o.status)}">${label(ORDER_STEPS, o.status)}</span>`}</div>
    <div class="small muted">${o.total_clp ? clp(o.total_clp) + " · " : ""}${o.price_usd ? usd(o.price_usd) + " en tienda · " : ""}${ago(o.created_at)}${shop && o.client ? " · " + esc(o.client.full_name || "") + " " + esc(o.client.phone || "") : ""}</div>
    ${o.notes ? `<div class="small" style="margin-top:4px">${esc(o.notes)}</div>` : ""}
    ${cancelled ? "" : stepsBar(ORDER_STEPS, o.status)}
    ${shop ? `<select class="in" data-order="${o.id}" style="margin-top:10px" aria-label="Estado del producto">${[...rowStatusOptions(o), ["cancelado", "Cancelado"]].map(([v, l]) => `<option value="${v}" ${v === o.status ? "selected" : ""}>${l}</option>`).join("")}</select>`   /* sin orden de compra: el pago se aprueba con "Aprobar pago y generar orden de compra" (ordenes.js) */
      : o.status === "pendiente_pago" ? `<button class="btn coral sm" data-pay style="margin-top:10px">Cómo pagar</button>` : ""}
  </div>`;
}
function pkgEstimate(p) {
  const kg = Number(p.weight_kg) || (Number(p.weight_lb) ? Number(p.weight_lb) / 2.20462 : 0);
  if (!kg) return "";
  const box = p.box_l && p.box_w && p.box_h ? [Number(p.box_l), Number(p.box_w), Number(p.box_h)] : null;
  const sh = shipping(Number(p.declared_usd) || 0, kg, box);
  return `${fmtKg(sh.w.charge)} kg cobrables · envío + aduana ≈ ${clp((sh.ship + sh.customs) * state.settings.usd_clp)} · `;
}
function pkgCard(p, shop) {
  return `<div class="card item"><div class="thumb">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : ICON.box}</div><div class="grow">
    <div class="row"><div class="t grow">${esc(p.description)}</div><span class="pill ${window.MSOrdenes ? "st-" + window.MSOrdenes.tone(p.status) : p.status === "entregado" ? "green" : p.status === "recibido" ? "amber" : "coral"}">${label(PKG_STEPS, p.status)}</span></div>
    <div class="small muted">${p.store ? esc(p.store) + " · " : ""}${pkgEstimate(p)}${ago(p.created_at)}${shop && p.client ? " · " + esc(p.client.full_name || "") + " (" + esc(p.client.locker_code || "") + ")" : ""}</div>
    ${p.tracking ? `<div class="small muted">Tracking: ${esc(p.tracking)}</div>` : ""}
    ${stepsBar(PKG_STEPS, p.status)}
    ${shop ? `<select class="in" data-pkg="${p.id}" style="margin-top:10px">${PKG_STEPS.map(([v, l]) => `<option value="${v}" ${v === p.status ? "selected" : ""}>${l}</option>`).join("")}</select>`
      : p.status === "recibido" ? `<button class="btn coral sm" data-consolidar="${p.id}" style="margin-top:10px">Solicitar envío a Chile</button>` : ""}
  </div></div>`;
}

// ---------- Detalle de oferta + pedido ----------
// ---------- Ficha del producto: galería, talla chilena, color, cantidad, cálculo y compartir ----------
const c3Half = (n) => Math.ceil(n / 2 / 100) * 100;
function c3ShareTexts(o, qty) {
  const q = quote(o.price_usd, o), link = appLink("o-" + o.id), name = `${o.title}${o.brand ? " de " + o.brand : ""}`;
  const where = o.store ? ` (${o.store}, Miami)` : " (Miami)";
  const share = `Mira esta oferta en ${APP_NAME}: ${name}${where}${discOf(o) ? `, con −${fmtPct(o.discount_pct)}%` : ""}${is2x1(o) ? ", 2×1" : ""}.\nPrecio en tienda ${usd(q.price)} · puesto en Chile ${clp(q.clp)} (incluye impuesto, comisión, envío y aduana).\n${link}`;
  const invite = `¡Hola! Te invito a comprar ${name}${where} con ${APP_NAME}. Te llega a Chile por ${clp(q.clp)}, todo incluido (impuesto Florida, comisión, envío y aduana). Elige tu talla y color aquí:\n${link}`;
  const two = is2x1(o), n = two ? 1 : Math.max(2, qty || 1), qq = two ? quote2x1(o) : q;
  const tot = two ? qq.clp : q.clp * n, half = c3Half(tot), hu = (v) => usd((v * (two ? 1 : n)) / 2);
  const split = [
    two ? `¡Amiga! ${name} está 2×1${where}. ¿Compramos juntas y pagamos a medias?` : `¡Amiga! ¿Compramos juntas ${n} ${name}${where} y pagamos a medias?`,
    `Total puesto en Chile${two ? " por los 2" : ` por ${n}`}: ${clp(tot)}.`,
    `A cada una le toca ${clp(half)} (50%), que incluye:`,
    `• Precio en tienda: ${hu(qq.price)}`, `• Impuesto Florida ${fmtPct(state.settings.fl_tax_pct)}%: ${hu(qq.tax)}`,
    `• Comisión shopper: ${hu(qq.fee)}`, `• Envío courier: ${hu(qq.ship)}`, `• Aduana e IVA: ${hu(qq.customs)}`,
    `Mírala aquí: ${link}`].join("\n");
  return { share, invite, split, half, tot, n, two };
}
function openOffer(o) {
  if (!o) return;
  (state.offerCache = state.offerCache || {})[o.id] = o;
  const q = quote(o.price_usd, o);
  const shop = isShopper();
  const photos = photosOf(o);
  const sizes = m2Sizes(o), colors = listOf(o.colors), kind = m2Kind(o), d = discOf(o);
  const conv = sizes.some((z) => z.us);
  let color = colors.length === 1 ? colors[0] : "", size = sizes.length === 1 ? sizes[0].v : "", qty = 1;
  const root = document.createElement("div");
  root.className = "counter c3-detail";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Detalle: " + o.title);
  const sh = c3ShareTexts(o, qty);
  root.innerHTML = `
    <div class="c3-dbar"><button class="counter-back c3-back" type="button">← Volver</button><span class="c3-dsign">${esc(shopName(shopOfCategory(o.category)))}</span></div>
    <div class="c3-dgrid">
    <div class="c3-dmedia">
      <div class="counter-scene f-${facadeOf(o.category)}">
        <div class="handle" id="handle">
          <div class="item" id="item">${photos.length ? `<img id="itemimg" src="${esc(photos[0].url)}" alt="${esc(o.title)}" draggable="false">` : `<span class="item-emo"></span>`}<span class="sheen" id="sheen"></span></div>
        </div>
        <div class="countertop"><span class="item-shadow"></span></div>
        ${d ? discBadges(o, "c3-badge") : ""}${is2x1(o) ? `<span class="c3-badge c3-2x1">2×1</span>` : ""}
        <div class="touch-hint" id="hint">${photos.length > 1 ? "Desliza para ver otra foto · doble toque para acercar" : "Doble toque para acercar"}</div>
      </div>
      ${photos.length > 1 ? `<div class="c3-gal" role="group" aria-label="Fotos">${photos.map((p, i) => `<button type="button" class="${i ? "" : "on"}" data-ph="${i}" aria-label="${esc(p.caption || "Foto " + (i + 1))}"><img src="${esc(p.url)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
    </div>
    <div class="counter-info c3-dinfo">
      <div class="c3-meta"><span class="c3-brand">${esc(o.brand || "Sin marca")}</span><span class="c3-store">${esc(o.store || shopName(shopOfCategory(o.category)))}</span></div>
      <div class="enc-for-slot"></div>
      <h2 class="c3-dtitle">${esc(o.title)}</h2>
      <div class="small muted">Vista ${ago(o.created_at).toLowerCase()}${sizeText(o) ? ` · Medidas aprox. ${sizeText(o)}` : ""}</div>
      <div class="c3-price c3-dprice"><div class="c3-clp"><b id="c3tot">${clp(q.clp)}</b><span>estimado puesto en Chile</span></div>
        <div class="c3-usd">${d ? `<s>${usd(d.tag)}</s>` : ""}<span><b>${usd(q.price)}</b> en tienda</span></div></div>
      ${shop ? "" : `
      ${sizes.length ? `<div class="c3-opt" id="picks"><div class="c3-ol">${kind === "shoe" ? "Talla Chile" : "Talla"}<em id="c3sz">${size ? esc(sizes.find((z) => z.v === size)?.label || "") : "elige una"}</em></div>
        <div class="m2-chips" role="radiogroup" aria-label="Talla">${sizes.map((z) => `<button type="button" role="radio" aria-checked="${size === z.v}" class="m2-chip ${size === z.v ? "on" : ""}" data-z="${esc(z.v)}" data-zl="${esc(z.label)}" ${z.us ? `title="US ${esc(z.us)}"` : ""}>${esc(z.label)}</button>`).join("")}</div>
        ${conv ? `<span class="c3-note">Convertida desde talla US${m2Men(o) ? " hombre" : " mujer"}</span>` : ""}</div>` : ""}
      ${colors.length ? `<div class="c3-opt" id="pickc"><div class="c3-ol">Color<em id="c3co">${color ? esc(color) : "elige uno"}</em></div>
        <div class="m2-chips" role="radiogroup" aria-label="Color">${colors.map((c) => `<button type="button" role="radio" aria-checked="${color === c}" class="m2-sw ${color === c ? "on" : ""}" data-c="${esc(c)}" style="--c:${colorHex(c)}" aria-label="${esc(c)}" title="${esc(c)}"></button>`).join("")}</div></div>` : ""}
      <div class="c3-opt"><div class="c3-ol">Cantidad</div><div class="m2-qty c3-qty"><button type="button" id="qdec" aria-label="Uno menos">−</button><b id="qty">1</b><button type="button" id="qinc" aria-label="Uno más">+</button></div></div>
      <div class="m2-hint" id="c3hint" role="alert" hidden></div>
      <button class="btn gold block c3-add" id="addcart">Agregar al carro · ${clp(q.clp)}</button>`}
      <details class="c3-calc" open><summary><span>Cálculo del precio</span><span class="c3-sum" id="c3calcsum">${shop ? "1 unidad" : "por 1 unidad"}</span></summary><div id="c3calc">${c3BreakHTML(q, o)}</div></details>
      ${is2x1(o) ? `<div class="c3-promo"><b>2x1</b><span>Llevas 2 por el precio de 1: ${clp(quote2x1(o).clp)} puesto en Chile por las 2 (incluye envío de ambas). Con una amiga, cada una paga ${clp(c3Half(quote2x1(o).clp))}.</span></div>` : ""}
      <div class="c3-share">
        <span class="c3-shl">Compartir</span>
        <a class="btn ghost block c3-wa" id="c3wa-share" target="_blank" rel="noopener" href="${esc(waShare(sh.share))}">Compartir esta oferta</a>
        ${shop ? "" : `<a class="btn ghost block c3-wa c3-wa-half" id="c3wa-split" target="_blank" rel="noopener" href="${esc(waShare(sh.split))}">Compartir compra con una amiga (50%)<small id="c3half">${sh.two ? "2×1" : sh.n + " unidades"} · ${clp(sh.half)} cada una, todo incluido</small></a>
        <button type="button" class="c3-link" id="c3caja">${is2x1(o) ? "Pagar el 2×1 a medias en la caja" : "Pagar a medias en la caja"} →</button>`}
      </div>
      <p class="small muted c3-fine">Valores estimados con ${esc(fxNote())}. Tu shopper confirma disponibilidad antes de comprar; si ya no está, te devolvemos el pago.</p>
    </div>
    </div>`;
  document.body.appendChild(root);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("in")));
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const close = () => { root._close = null; root.classList.remove("in"); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); setTimeout(() => root.remove(), reduceMotion() ? 0 : 300); };
  root._close = close; overlayPushed();                 // "atrás" de Android / navegador cierra la ficha antes de salir del catálogo
  document.addEventListener("keydown", onKey);
  const back = root.querySelector(".counter-back"); back.onclick = close; back.focus({ preventScroll: true });
  window.MSEncargos?.offerBadge(root.querySelector(".enc-for-slot"), o);   // "Encontrado especialmente para ti por Cheryl" (encargos.js)

  // Manipular la prenda: arrastrar de lado = girarla, doble toque = acercarse, deslizar rápido = otra foto (el scroll vertical sigue libre)
  const handle = root.querySelector("#handle"), item = root.querySelector("#item"), sheen = root.querySelector("#sheen"), img = root.querySelector("#itemimg");
  let idx = 0, zoom = 1, panX = 0, panY = 0, rx = 0, ry = 0, start = null, lastTap = 0;
  const setT = (anim) => {
    item.style.transition = anim ? "transform .5s cubic-bezier(.2,.8,.2,1)" : "none";
    item.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translate(${panX}px,${panY}px) scale(${zoom})`;
    sheen.style.background = `radial-gradient(55% 45% at ${50 + ry * 2.2}% ${35 - rx * 2.2}%,rgba(255,255,255,.38),transparent 60%)`;
  };
  const show = (i, dir) => {
    if (!img || i < 0 || i >= photos.length || i === idx) { rx = ry = 0; return setT(true); }
    const half = dir * 90;
    item.style.transition = "transform .2s ease-in"; item.style.transform = `rotateY(${-half}deg) scale(.94)`;
    setTimeout(() => {
      idx = i; img.src = photos[i].url; rx = 0; ry = half; zoom = 1; panX = panY = 0; setT(false);
      requestAnimationFrame(() => requestAnimationFrame(() => { ry = 0; setT(true); }));
      root.querySelectorAll("[data-ph]").forEach((b) => b.classList.toggle("on", +b.dataset.ph === i));
    }, reduceMotion() ? 0 : 200);
  };
  root.querySelectorAll("[data-ph]").forEach((b) => (b.onclick = () => show(+b.dataset.ph, +b.dataset.ph > idx ? 1 : -1)));
  handle.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY, t: Date.now(), rx, ry, panX, panY };
    root.querySelector("#hint").classList.add("gone");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (zoom > 1) { panX = start.panX + dx / zoom; panY = start.panY + dy / zoom; }
    else { ry = Math.max(-24, Math.min(24, start.ry + dx * 0.22)); rx = Math.max(-16, Math.min(16, start.rx - dy * 0.18)); }
    setT(false);
  });
  const end = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = Date.now() - start.t;
    start = null;
    if (e.type === "pointercancel") { rx = ry = 0; return setT(true); }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 260) {
      const now = Date.now();
      if (now - lastTap < 330) { zoom = zoom > 1 ? 1 : 2.2; panX = panY = 0; rx = ry = 0; lastTap = 0; return setT(true); }
      lastTap = now;
    }
    if (zoom === 1 && photos.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && dt < 500) return show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    if (zoom === 1) { rx = ry = 0; setT(true); }
  };
  handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end); handle.addEventListener("pointerleave", (e) => start && end(e));
  setT(false);

  const add = root.querySelector("#addcart");
  if (!add) return;
  const hint = (msg) => { const h = root.querySelector("#c3hint"); h.textContent = msg; h.hidden = !msg; };
  const paintQ = () => {
    root.querySelector("#qty").textContent = qty;
    if (!add.disabled) add.textContent = `Agregar al carro · ${clp(q.clp * qty)}`;
    root.querySelector("#c3tot").textContent = clp(q.clp * qty);
    root.querySelector("#c3calc").innerHTML = c3BreakHTML(q, o, { n: qty });
    root.querySelector("#c3calcsum").textContent = qty > 1 ? `por ${qty} unidades` : "por 1 unidad";
    const s = c3ShareTexts(o, qty), sp = root.querySelector("#c3wa-split");
    sp.href = waShare(s.split); root.querySelector("#c3half").textContent = `${s.two ? "2×1" : s.n + " unidades"} · ${clp(s.half)} cada una, todo incluido`;
  };
  root.querySelectorAll("#pickc [data-c]").forEach((b) => (b.onclick = () => {
    color = b.dataset.c; hint("");
    root.querySelectorAll("#pickc [data-c]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
    root.querySelector("#c3co").textContent = color;
  }));
  root.querySelectorAll("#picks [data-z]").forEach((b) => (b.onclick = () => {
    size = b.dataset.z; hint("");
    root.querySelectorAll("#picks [data-z]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
    root.querySelector("#c3sz").textContent = b.dataset.zl;
  }));
  root.querySelector("#qdec").onclick = () => { qty = Math.max(1, qty - 1); paintQ(); };
  root.querySelector("#qinc").onclick = () => { qty = Math.min(9, qty + 1); paintQ(); };
  const need = () => {
    const ns = sizes.length > 1 && !size, nc = colors.length > 1 && !color;
    if (!ns && !nc) return false;
    hint(ns && nc ? "Elige talla y color" : ns ? "Elige tu talla" : "Elige un color");
    const opt = root.querySelector(ns ? "#picks" : "#pickc");
    opt.classList.remove("m2-need"); void opt.offsetWidth; opt.classList.add("m2-need");
    opt.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
    return true;
  };
  add.onclick = () => {
    if (need()) return;
    addToCart(o, color || colors[0] || "", size, qty);
    add.textContent = `Agregado al carro · ${qty > 1 ? qty + " unidades" : "1 unidad"}`; add.disabled = true; add.classList.add("m2-done");
    toast("Agregado al carro");
    // el carro se revisa con el botón de arriba (#cartbtn); aquí solo se sigue mirando
    root.querySelector("#c3after")?.remove();
    add.insertAdjacentHTML("afterend", `<div class="c3-after" id="c3after"><button class="btn ghost grow" id="keep">← Seguir mirando</button></div>`);
    root.querySelector("#keep").onclick = close;
    document.querySelector("#cartbtn")?.classList.add("m2-bump"); setTimeout(() => document.querySelector("#cartbtn")?.classList.remove("m2-bump"), 600);
    setTimeout(() => { if (add.isConnected) { add.disabled = false; add.classList.remove("m2-done"); add.textContent = `Agregar otro · ${clp(q.clp * qty)}`; } }, 2200);
  };
  // pagar a medias en la caja: se crea la compra compartida (#g-…) que la amiga abre por su link
  root.querySelector("#c3caja").onclick = () => {
    if (need()) return;
    const two = is2x1(o), n = two ? 2 : Math.max(2, qty);
    const line = { key: uid(), offer_id: o.id, title: o.title, brand: o.brand || "", photo: o.photo_url || "", category: o.category, color: color || colors[0] || "", size, qty: n, ...(two ? { promo: "2x1" } : {}), price_usd: o.price_usd, clp: two ? quote2x1(o).clp : q.clp };
    close();
    walk(["Caminando a la caja…"], () => { state.tab = "caja"; state.cajaDone = null; state.cajaGroup = null; state.cajaSplit = { kind: two ? "2x1" : "split", items: [line] }; navCommit(); render(); });
  };
}

// Después de publicar: agregar más fotos o medir
function matchSearch(s, o) {
  if (s.status !== "pendiente" || new Date(s.expires_at) < new Date() || !TIENDAS.sameCat(s.category, o.category)) return false;
  const b = (s.brand || "").toLowerCase();
  if (b && !(`${o.brand || ""} ${o.title}`.toLowerCase().includes(b))) return false;
  return s.max_price_usd == null || Number(o.price_usd) <= Number(s.max_price_usd);
}
async function postPublish(box, offer) {
  let matched = [];
  try { matched = (await state.api.listSearches()).filter((s) => matchSearch(s, offer) && searchPhone(s)); } catch {}
  const draw = () => {
    const n = photosOf(offer).length;
    box.innerHTML = `<div class="card" style="margin-top:14px;text-align:center">
      <div class="pp-ok">${ICON.check}</div><h3 style="font-size:19px">¡Producto publicado!</h3>
      <p class="small muted" style="margin:4px 0 12px">${esc(offer.title)}${sizeText(offer) ? " · " + sizeText(offer) : ""} · ${n} ${n === 1 ? "foto" : "fotos"}</p>
      ${matched.length ? `<div class="match-box"><b>Coincide con ${matched.length} ${matched.length > 1 ? "encargos" : "encargo"}</b>${matched.map((s) => `<div class="row" style="margin-top:8px"><span class="grow small" style="text-align:left">${esc(s.client?.full_name || "Cliente")} · ${esc(s.brand || s.category)}${s.max_price_usd ? " hasta " + usd(s.max_price_usd) : ""}</span><a class="btn sm wa" target="_blank" rel="noopener" data-match="${esc(s.id)}" href="${esc(window.MSEncargos ? window.MSEncargos.waLink(s, offer) : "")}">Avisar por WhatsApp</a></div>`).join("")}</div>` : ""}
      <div class="stack">
        <button class="btn coral block" id="pp-gal">${ICON.cam}Agregar más fotos (otros colores, lateral, atrás…)</button>
        ${n ? `<button class="btn ghost block" id="pp-meas">${ICON.ruler}${sizeText(offer) ? "Corregir medidas" : "Medir con la tarjeta"}</button>` : ""}
        <button class="btn ghost block" id="pp-new">Publicar otro producto</button>
      </div></div>`;
    // avisar a una clienta cuyo encargo calza: el encargo queda "avisado" con esta oferta
    box.querySelectorAll("[data-match]").forEach((a) => a.addEventListener("click", () => { state.api.updateSearch(a.dataset.match, { status: "avisado", offer_id: offer.id, notified_at: new Date().toISOString() }).catch(() => {}); }));
    $("#pp-gal", box).onclick = () => openGallery(offer, (o) => { offer = o; draw(); });
    $("#pp-meas", box) && ($("#pp-meas", box).onclick = () => openMeasure(offer, (o) => { offer = o; draw(); }));
    $("#pp-new", box).onclick = () => { box.innerHTML = ""; window.scrollTo({ top: 0, behavior: "smooth" }); };
  };
  draw();
}

// Galería de fotos de un producto (shopper)
function openGallery(offer, onChange) {
  let o = { ...offer, photos: Array.isArray(offer.photos) ? [...offer.photos] : [] };
  const save = async () => { await state.api.updateOffer(o.id, { photos: o.photos }); onChange?.(o); };
  sheet(`<h2>Fotos del producto</h2>
    <p class="small muted" style="margin-top:0">La primera es la foto con la etiqueta. Agrega otras vistas o colores y ponles un nombre (ej: "Café", "Lateral").</p>
    <div id="gal"></div>
    <label class="btn coral block" style="margin-top:12px" for="gal-in">${ICON.cam}Agregar fotos</label>
    <input type="file" id="gal-in" accept="image/*" multiple hidden>
    <div class="small muted" id="gal-st" style="text-align:center;margin-top:6px"></div>
    <button class="btn ghost block" data-close style="margin-top:10px">Listo</button>`, (el) => {
    const draw = () => {
      el.querySelector("#gal").innerHTML = `<div class="galgrid">${o.photo_url ? `<div class="gi"><img src="${esc(o.photo_url)}" alt=""><div class="small muted">Principal (etiqueta)</div></div>` : ""}
        ${o.photos.map((p, i) => `<div class="gi"><img src="${esc(p.url)}" alt=""><input class="in" data-cap="${i}" value="${esc(p.caption || "")}" placeholder="Color o vista"><button type="button" class="btn ghost sm" data-del="${i}">Quitar</button></div>`).join("")}</div>`;
      el.querySelectorAll("[data-cap]").forEach((inp) => (inp.onchange = async () => { o.photos[+inp.dataset.cap].caption = inp.value.trim(); await save(); toast("Guardado"); }));
      el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { o.photos.splice(+b.dataset.del, 1); await save(); draw(); }));
    };
    draw();
    const inp = el.querySelector("#gal-in"), st = el.querySelector("#gal-st");
    inp.onchange = async () => {
      const files = [...inp.files]; inp.value = "";
      for (let i = 0; i < files.length; i++) {
        st.textContent = `Subiendo ${i + 1} de ${files.length}…`;
        try { const b = await resizeImage(files[i]); const url = await state.api.uploadPhoto(b); o.photos.push({ url, caption: "" }); await save(); draw(); }
        catch (e) { toast(e.message); }
      }
      st.textContent = files.length ? "Listo. Escribe el color o la vista de cada foto." : "";
    };
  });
}

// Medir con la tarjeta (8,56 × 5,4 cm) como referencia: detección automática de la tarjeta,
// corrección de perspectiva y medición, todo en el teléfono (vision/measure.js).
function openMeasure(offer, onSaved) {
  let o = { ...offer };
  const photos = photosOf(o);
  if (!photos.length) return toast("Primero agrega una foto con la tarjeta");
  const t = PRODUCT_TYPES.find((x) => x.name === o.product_type || x.id === o.product_type);
  openMeasureSheet({ photos, typeBox: t?.box || catOf(o.category).box, initial: { w: o.size_w_cm, h: o.size_h_cm, d: o.size_d_cm }, onSave: async (m) => {
    const p = { size_w_cm: m.w, size_h_cm: m.h, size_d_cm: m.d || null };
    if (m.box.length === 3) Object.assign(p, { box_l: m.box[0], box_w: m.box[1], box_h: m.box[2] });
    try { await state.api.updateOffer(o.id, p); Object.assign(o, p); toast("Medidas guardadas"); onSaved?.(o); } catch (e) { toast(e.message); }
  } });
}
async function openMeasureSheet(opts) {
  let mod; try { mod = await import("./vision/measure.js"); } catch (e) { console.warn(e); return toast("No se pudo abrir la medición"); }
  // Extra opcional (solo dentro de Claude): medir con IA. En la app publicada no aparece.
  const aiMeasure = window.claude && typeof window.claude.use === "function" ? async (url) => withTimeout(claudeMeasure(await urlToBlob(url)), 45000, "La IA tardó demasiado") : null;
  mod.openCardMeasure({ ...opts, sheet, toast, esc, aiMeasure });
}
function showPayment(justOrdered) {
  const name = state.settings.cashier_name || "Cheryl";
  const wl = whatsappLink(`Hola ${name}, te envío el comprobante de la transferencia de mi pedido.`);
  sheet(`<div class="pay-head"><span class="mini-cashier">${cashierFace()}</span><div><h2 style="margin:0">${justOrdered ? "¡Pedido creado!" : "Cómo pagar"}</h2><div class="small muted">${esc(name)} te atiende en la caja</div></div></div>
    <p class="muted">Transfiere el total de tu pedido y envía el comprobante:</p>
    ${bankHTML(0)}
    ${wl ? `<a class="btn gold block" style="margin-top:12px" href="${esc(wl)}" target="_blank" rel="noopener">Enviar comprobante por WhatsApp</a><div class="small muted" style="text-align:center;margin-top:6px">${esc(state.settings.whatsapp)}</div>` : ""}
    <button class="btn ghost block" data-close style="margin-top:12px">Cerrar</button>`, (el) => wireCopy(el, 0));
}

// ---------- Publicar (shopper) ----------
// opts.request: encargo que se está cumpliendo ("Lo encontré" en encargos.js). Precarga marca, tipo/tienda, género,
// talla y color; agrega "¿Quién lo ve?" (solo para esa clienta / también en la tienda) y entrega la oferta a opts.onPublished.
async function publishForm(box, file, opts = {}) {
  const req = opts.request || null, pre = (req && opts.prefill) || {};
  let blob = null, previewUrl = null;
  if (file) { blob = await resizeImage(file); previewUrl = URL.createObjectURL(blob); }
  const lastStore = (() => { try { return localStorage.getItem("ps_last_store") || ""; } catch { return ""; } })();
  const store = isLive() && state.settings.live_store ? state.settings.live_store : lastStore;
  box.innerHTML = `<div class="card" style="margin-top:14px">
      ${previewUrl ? `<img class="preview" src="${previewUrl}" alt="">` : ""}
      <div id="ai-status"></div>
      <form id="of">
        <label class="f">Tipo de producto</label>
        <div class="chips" id="typechips"></div>
        <select class="in" name="ptype">${typeOptions("otro-mediano")}</select>
        <div class="pubpick">
          <div class="pubpick-h"><label class="f">Tienda donde se publica</label><span class="stnote" id="stnote" aria-live="polite">Elige una tienda</span></div>
          <div class="stpick" id="stpick" role="radiogroup" aria-label="Tienda donde se publica">${storeTilesHTML("")}</div>
          <div id="gwrap"><label class="f">¿Para quién es?</label>
            <div class="gpick" id="gpick" role="radiogroup" aria-label="Para quién es">${GENDERS.map(([k, l]) => `<button type="button" role="radio" class="gpick-b" data-pg="${k}" aria-checked="false">${l}</button>`).join("")}</div>
            <div class="gpick-help">Unisex aparece en los dos catálogos (relojes, deportes, accesorios…)</div></div>
          <div class="gpick-help" id="gauto" hidden>Lencería y Michael Kors son solo de mujer: se publica en el catálogo de mujer.</div>
        </div>
        <input type="hidden" name="category" value="Otros"><input type="hidden" name="sw"><input type="hidden" name="sh"><input type="hidden" name="sd">
        <div class="two"><div><label class="f">Marca</label><input class="in" name="brand" list="brands2" placeholder="Marca"></div>
          <div><label class="f">Tienda</label><input class="in" name="store" list="stores2" value="${esc(store)}" placeholder="Burlington"></div></div>
        <label class="f">Nombre del producto</label><input class="in" name="title" placeholder="Ej: Cartera tote negra" required>
        <div class="chips price-chips" id="pricechips" style="margin-top:12px"></div>
        <div class="two"><div><label class="f" for="pf-tag">Precio etiqueta US$</label><input class="in" id="pf-tag" name="price" inputmode="decimal" placeholder="79.99" required></div>
          <div><label class="f" for="pf-sale">Precio final US$ <span style="text-transform:none;font-weight:400;opacity:.7">(opcional)</span></label><input class="in" id="pf-sale" name="sale" inputmode="decimal" placeholder="49.99"></div></div>
        <div class="small muted" style="margin-top:4px">Si la etiqueta ya trae el precio rebajado, escribe los dos y calculo el % de descuento.</div>
        <div class="small muted" id="salepct" aria-live="polite"></div>
        ${previewUrl ? `<div class="row ms-pubrow"><span class="small muted grow" id="ms-size">${ICON.card}Con la tarjeta en la foto puedo medir el producto</span><button type="button" class="btn ghost sm" id="ms-open">${ICON.ruler}Medir</button></div>` : ""}
        <div class="row" style="margin-top:10px"><span class="small muted grow" id="shipinfo"></span><button type="button" class="btn ghost sm" id="shipadj">Ajustar</button></div>
        <div id="shipedit" hidden><label class="f">Peso y caja para el envío</label>
        <div class="row" style="gap:6px;flex-wrap:wrap"><input class="in" name="weight" inputmode="decimal" style="width:64px"><span class="small muted">kg</span>
          <input class="in" name="bl" inputmode="numeric" style="width:54px"><span class="small muted">×</span><input class="in" name="bw" inputmode="numeric" style="width:54px"><span class="small muted">×</span><input class="in" name="bh" inputmode="numeric" style="width:54px"><span class="small muted">cm</span></div>
        <div class="small muted" id="chargekg" style="margin-top:4px"></div></div>
        <label class="f">Colores disponibles</label>
        <div class="swatches" id="swatches">${COLORS.map(([n, h]) => `<button type="button" class="sw" data-color="${n}" style="--c:${h}" aria-pressed="false" title="${n}"><span></span>${n}</button>`).join("")}</div>
        <label class="f">Tallas disponibles (opcional)</label>
        <input class="in" name="sizes" placeholder="Ej: S, M, L  ·  36, 37, 38  ·  Talla única">
        <label class="lm-toggle"><input type="checkbox" name="lastmin"><span>${ICON.bolt}Oferta de último minuto</span><small>Aparece en la tienda "${esc(LAST_NAME)}"</small></label>
        <label class="lm-toggle dv-toggle"><input type="checkbox" name="featured"><span>${ICON.star}Destacar en la vitrina (flyer)</span><small>Sale como cartel grande en la vitrina de su tienda (máx. 4 por tienda)</small></label>
        <label class="lm-toggle promo-t"><input type="checkbox" name="promo2x1"><span>${ICON.duo}Promoción 2×1</span><small>Los clientes pueden invitar a una amiga y pagar a medias</small></label>
        <label class="f">Descuento</label>
        <div class="chips" id="discchips">${[0, 10, 15, 20, 25, 30, 40, 50].map((d) => `<button type="button" class="chip ${d === 0 ? "on" : ""}" data-d="${d}">${d ? "−" + d + "%" : "Sin descuento"}</button>`).join("")}</div>
        <div class="row"><input class="in" name="discount" inputmode="decimal" placeholder="Otro %" style="width:110px"></div>
        <label class="f">Descuento sobre descuento</label><p class="small muted" style="margin:-2px 0 6px">Extra que se aplica sobre el precio ya rebajado</p>
        <div class="chips" id="disc2chips">${[0, 10, 15, 20, 25, 30, 40, 50].map((d) => `<button type="button" class="chip ${d === 0 ? "on" : ""}" data-d="${d}">${d ? "−" + d + "%" : "Sin extra"}</button>`).join("")}</div>
        <div class="row"><input class="in" name="discount2" inputmode="decimal" placeholder="Otro %" style="width:110px"><span class="small muted" id="finalprice"></span></div>
        <div id="pq" style="margin-top:12px"></div>
        ${req ? `<fieldset class="enc-vis"><legend>¿Quién lo ve?</legend>
          <label class="enc-opt"><input type="radio" name="vis" value="reserved" checked><span><b>Solo para ${esc(pre.name || "esta clienta")}</b><small>No aparece en las tiendas ni en la vitrina: se ve solo con el link que le mandas.</small></span></label>
          <label class="enc-opt"><input type="radio" name="vis" value="public"><span><b>Publicar también en la tienda</b><small>Queda en el mall para todas; el link igual le llega a ${esc(pre.name || "ella")}.</small></span></label></fieldset>` : ""}
        <button class="btn coral block" style="margin-top:14px" id="pubbtn">${req ? "Guardar y preparar el mensaje" : "Publicar oferta"}</button>
      </form>
      <datalist id="brands2">${BRANDS.map((b) => `<option value="${esc(b)}">`).join("")}</datalist>
      <datalist id="stores2">${STORES.map((b) => `<option value="${esc(b)}">`).join("")}</datalist>
    </div>`;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
  const form = $("#of", box);
  const F = form.elements;
  let titleTouched = false, weightTouched = false, measuredBox = null;
  const item = () => ({ category: F.category.value, weight_kg: num(F.weight.value), box_l: num(F.bl.value), box_w: num(F.bw.value), box_h: num(F.bh.value) });
  F.title.oninput = () => (titleTouched = true);
  for (const k of ["weight", "bl", "bw", "bh"]) F[k].oninput = () => { weightTouched = true; updQ(); };
  // Tienda (propuesta por el reconocimiento; Cheryl la cambia con un toque) y género (obligatorio salvo Lencería/Carteras)
  let storeSel = "", storeTouched = false, gSel = "";
  const fixedG = () => (TIENDAS.isClothes(F.category.value) ? TIENDAS.fixedGender(storeSel) : "");   // "mujer" en Ropa Mujer, "hombre" en Ropa Hombre
  const paintPick = () => {
    box.querySelectorAll("#stpick [data-store]").forEach((b) => { const on = b.dataset.store === storeSel; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const cat = F.category.value, also = storeSel === LAST ? shopName(TIENDAS.storeFor(cat, gSel, shopOfCategory)) : "";
    $("#stnote", box).innerHTML = storeSel ? `Va a <b>${esc(shopName(storeSel))}</b>${also ? ` · también en ${esc(also)}` : F.lastmin.checked ? ` · también en ${esc(LAST_NAME)}` : ""}` : "Elige una tienda";
    $("#stnote", box).classList.toggle("need", !storeSel);
    // género fijo: Lencería y Carteras (mujer); Ropa Mujer / Ropa Hombre lo fija la tienda elegida
    const wo = womenOnlyCat(cat), fg = fixedG();
    $("#gwrap", box).hidden = wo || !!fg; $("#gauto", box).hidden = !(wo || fg);
    $("#gauto", box).textContent = wo ? "Lencería y Michael Kors son solo de mujer: se publica en el catálogo de mujer." : fg ? `${shopName(storeSel)}: se publica en el catálogo de ${fg}.` : "";
    box.querySelectorAll("#gpick [data-pg]").forEach((b) => { const on = b.dataset.pg === gSel; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  };
  const setType = (id, propose) => {
    const t = typeOf(id) || typeOf("otro-mediano");
    F.ptype.value = t.id; F.category.value = t.cat;
    box.querySelectorAll("#typechips .chip").forEach((c) => c.classList.toggle("on", c.dataset.t === t.id));
    if (!weightTouched) { F.weight.value = t.kg; [F.bl.value, F.bw.value, F.bh.value] = measuredBox || t.box; }
    if (propose && !storeTouched) storeSel = F.lastmin.checked ? LAST : TIENDAS.storeFor(t.cat, gSel, shopOfCategory);
    suggestTitle(); updQ(); paintPick();
  };
  const pickStore = (cat) => {
    const was = storeSel; storeSel = cat; storeTouched = true;
    if (cat === LAST) F.lastmin.checked = true;
    else {
      if (was === LAST) F.lastmin.checked = false;
      const cats = SHOPS[cat][2].map(TIENDAS.typeCat);   // Ropa Hombre vende tipos de "Ropa"
      if (!cats.includes(F.category.value)) setType((cat === "Otros" ? typeOf("otro-mediano") : PRODUCT_TYPES.find((t) => t.cat === cats[0])).id);   // el tipo (peso y caja) calza con la tienda
    }
    paintPick();
  };
  box.querySelectorAll("#stpick [data-store]").forEach((b) => (b.onclick = () => pickStore(b.dataset.store)));
  box.querySelectorAll("#gpick [data-pg]").forEach((b) => (b.onclick = () => { gSel = b.dataset.pg; if (!storeTouched && storeSel && storeSel !== LAST && TIENDAS.isClothes(F.category.value)) storeSel = TIENDAS.storeFor(F.category.value, gSel, shopOfCategory); paintPick(); }));
  F.lastmin.addEventListener("change", () => { if (!F.lastmin.checked && storeSel === LAST) storeSel = TIENDAS.storeFor(F.category.value, gSel, shopOfCategory); else if (F.lastmin.checked && !storeSel) { storeSel = LAST; } paintPick(); });
  const suggestTypes = (ids) => {
    const list = ids.map(typeOf).filter(Boolean);
    $("#typechips", box).innerHTML = list.map((t) => `<button type="button" class="chip" data-t="${t.id}">${catOf(t.cat).emoji} ${esc(t.name)}</button>`).join("");
    box.querySelectorAll("#typechips .chip").forEach((c) => (c.onclick = () => setType(c.dataset.t, true)));
    if (list[0]) setType(list[0].id, true);
  };
  F.ptype.onchange = () => setType(F.ptype.value, true);
  const picked = new Set();
  const setColors = (list) => { list.map((x) => (COLORS.find((c) => c[0].toLowerCase() === String(x).toLowerCase()) || [])[0]).filter(Boolean).forEach((n) => picked.add(n)); paintSw(); };
  const paintSw = () => box.querySelectorAll("#swatches .sw").forEach((b) => { const on = picked.has(b.dataset.color); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  box.querySelectorAll("#swatches .sw").forEach((b) => (b.onclick = () => { picked.has(b.dataset.color) ? picked.delete(b.dataset.color) : picked.add(b.dataset.color); paintSw(); }));
  $("#shipadj", box).onclick = () => { const e = $("#shipedit", box); e.hidden = !e.hidden; };
  const suggestTitle = () => { if (!titleTouched) { const t = typeOf(F.ptype.value); F.title.value = [t && !t.id.startsWith("otro") ? t.name.split(" o ")[0] : "", F.brand.value].filter(Boolean).join(" "); } };
  const disc1 = () => Math.min(95, Math.max(0, num(F.discount.value) || 0));
  const disc2 = () => Math.min(95, Math.max(0, num(F.discount2.value) || 0));
  const disc = () => stackPct(disc1(), disc2());   // descuento total equivalente
  // Precio final de venta (viene rebajado sin %): calculamos el % = 1 − final / etiqueta y usamos el final exacto
  const saleV = () => { const tag = num(F.price.value), v = num(F.sale.value); return tag > 0 && v > 0 && v < tag ? v : null; };
  const finalPrice = (tag) => { const v = saleV(); return v != null ? (disc2() ? withDiscount(v, disc2()) : v) : withDiscount2(tag, disc1(), disc2()); };
  const updQ = () => {
    const tag = num(F.price.value), d1 = disc1(), d2 = disc2(), d = disc();
    const fin = tag ? finalPrice(tag) : null;
    $("#finalprice", box).innerHTML = tag && d ? (d1 && d2 ? `${usd(tag)} −${fmtPct(d1)}% = ${usd(saleV() ?? withDiscount(tag, d1))} −${fmtPct(d2)}% = <b>${usd(fin)}</b> (total −${fmtPct(d)}%)` : `Precio final: <b>${usd(fin)}</b>`) : "";
    const it = item(), w = chargeKg(kgOf(it), boxOf(it));
    $("#chargekg", box).textContent = w.fixed ? `Cobrable: ${fmtKg(w.charge)} kg volumétricos (peso fijo por producto, se cambia en Ajustes)` : `Cobrable: ${fmtKg(w.charge)} kg${w.byVolume ? " (por volumen, la caja pesa menos de lo que ocupa)" : ""}`;
    $("#shipinfo", box).textContent = w.fixed ? `Envío: se cobran ${fmtKg(w.charge)} kg volumétricos por producto` : `≈ ${fmtKg(kgOf(it))} kg · caja ${boxOf(it).join("×")} cm · se cobran ${fmtKg(w.charge)} kg`;
    $("#pq", box).innerHTML = tag ? quoteHTML(quote(fin, it), d ? { tag, pct: d, d1, d2 } : null) : "";
  };
  const clearSale = () => { if (F.sale.value) { F.sale.value = ""; $("#salepct", box).textContent = ""; } };
  box.querySelectorAll("#discchips .chip").forEach((c) => (c.onclick = () => {
    clearSale(); F.discount.value = c.dataset.d === "0" ? "" : c.dataset.d;
    box.querySelectorAll("#discchips .chip").forEach((x) => x.classList.toggle("on", x === c)); updQ();
  }));
  F.discount.oninput = () => { clearSale(); const d = disc1(); box.querySelectorAll("#discchips .chip").forEach((x) => x.classList.toggle("on", Number(x.dataset.d) === d)); updQ(); };
  box.querySelectorAll("#disc2chips .chip").forEach((c) => (c.onclick = () => {
    F.discount2.value = c.dataset.d === "0" ? "" : c.dataset.d;
    box.querySelectorAll("#disc2chips .chip").forEach((x) => x.classList.toggle("on", x === c)); updQ();
  }));
  F.discount2.oninput = () => { const d = disc2(); box.querySelectorAll("#disc2chips .chip").forEach((x) => x.classList.toggle("on", Number(x.dataset.d) === d)); updQ(); };
  const fromSale = () => {
    const tag = num(F.price.value), v = num(F.sale.value), out = $("#salepct", box);
    if (!F.sale.value.trim()) { out.textContent = ""; return updQ(); }
    if (!(tag > 0)) { out.textContent = "Pon primero el precio de la etiqueta"; return updQ(); }
    if (!(v > 0) || v >= tag) { out.textContent = "El precio final tiene que ser menor que el de la etiqueta"; return updQ(); }
    const pct = Math.round((1 - v / tag) * 100);   // entero, como en los stickers
    F.discount.value = String(pct);
    box.querySelectorAll("#discchips .chip").forEach((x) => x.classList.toggle("on", Number(x.dataset.d) === pct));
    out.innerHTML = `${usd(tag)} → ${usd(v)}: descuento de <b>${fmtPct(pct)}%</b>`;
    updQ();
  };
  F.brand.oninput = suggestTitle; F.price.oninput = () => (F.sale.value ? fromSale() : updQ()); F.sale.oninput = fromSale;
  setType("otro-mediano");
  if (req) {                                      // precargado con lo que pidió la clienta
    const t = PRODUCT_TYPES.find((x) => x.cat === pre.category && !x.id.startsWith("otro")) || PRODUCT_TYPES.find((x) => x.cat === pre.category);
    if (pre.brand) F.brand.value = pre.brand;
    if (pre.gender) gSel = pre.gender;               // antes del tipo: ropa de hombre propone Ropa Hombre
    if (t) setType(t.id, true);
    if (pre.size) F.sizes.value = pre.size;
    if (pre.color) setColors(listOf(pre.color));
    suggestTitle(); paintPick();
    const vis = () => { const pub = F.vis.value === "public"; [F.lastmin, F.featured].forEach((x) => { x.closest("label").style.display = pub ? "" : "none"; if (!pub) x.checked = false; }); };
    form.querySelectorAll("[name=vis]").forEach((r) => (r.onchange = vis)); vis();
  }
  // Medir con la tarjeta antes de publicar (vision/measure.js, local)
  const msOpen = $("#ms-open", box);
  if (msOpen) msOpen.onclick = () => openMeasureSheet({ photos: [{ url: previewUrl, caption: "" }], typeBox: typeOf(F.ptype.value)?.box, initial: { w: num(F.sw.value), h: num(F.sh.value), d: num(F.sd.value) }, onSave: (m) => {
    F.sw.value = m.w; F.sh.value = m.h; F.sd.value = m.d || "";
    if (m.box.length === 3) { measuredBox = m.box; if (!weightTouched) [F.bl.value, F.bw.value, F.bh.value] = m.box; }
    $("#ms-size", box).textContent = `Medidas: ${fmtKg(m.w)} × ${fmtKg(m.h)}${m.d ? " × " + fmtKg(m.d) : ""} cm${m.dEstimated ? " (fondo estimado)" : ""}`;
    msOpen.classList.remove("ms-pulse"); msOpen.innerHTML = ICON.ruler + "Corregir"; updQ();
  } });

  // La lectura de la foto corre en segundo plano: el envío queda conectado desde ya (si Cheryl toca "Publicar"
  // antes de que termine, no se envía el formulario "a la antigua" recargando la página y perdiendo todo).
  if (blob) (async () => {
    const st = $("#ai-status", box);
    let skipped = false;
    const show = (msg, ok) => { if (skipped) return; st.innerHTML = `<div class="ai ${ok ? "ok" : ""}">${ok ? ICON.check : `<span class="spin"></span>`} <span class="grow">${esc(msg)}</span>${ok ? "" : `<button type="button" class="btn ghost sm" id="ai-skip">Saltar</button>`}</div>`;
      const sk = $("#ai-skip", st); if (sk) sk.onclick = () => { skipped = true; st.innerHTML = `<div class="ai">Completa los datos a mano.</div>`; }; };
    const results = [];
    show("Revisando conexión…");
    const avail = await vision.available();
    if (!avail.ocr && !avail.clip) {
      let v = null;
      try { v = await withTimeout(claudeVision(blob, (m) => show(m)), 45000, "La IA tardó demasiado"); } catch (e) { console.warn(e); }
      if (skipped) return;
      if (v) {
        const ids = [v.type, ...(Array.isArray(v.alt_types) ? v.alt_types : [])].map(String).filter((x) => typeOf(x));
        if (ids.length) suggestTypes([...new Set(ids)]);
        const tp = typeOf(ids[0]);
        if (Array.isArray(v.colors)) setColors(v.colors);
        if (v.card_found && Number(v.width_cm) > 0 && Number(v.height_cm) > 0) { F.sw.value = roundCm(Number(v.width_cm)); F.sh.value = roundCm(Number(v.height_cm)); }
        if (v.brand && !F.brand.value) F.brand.value = String(v.brand);
        if (v.title && !titleTouched) { F.title.value = String(v.title); titleTouched = true; }
        const prices = [...new Set((Array.isArray(v.prices) ? v.prices : []).map(Number).filter((x) => x > 0))].sort((a, b) => a - b);
        const price = Number(v.price) > 0 ? Number(v.price) : prices[0];
        if (price && !F.price.value) F.price.value = price.toFixed(2);
        if (prices.length > 1) {
          $("#pricechips", box).innerHTML = prices.slice(0, 6).map((p) => `<button type="button" class="chip ${p === price ? "on" : ""}" data-p="${p}">${usd(p)}</button>`).join("");
          box.querySelectorAll("#pricechips .chip").forEach((c) => (c.onclick = () => { F.price.value = Number(c.dataset.p).toFixed(2); box.querySelectorAll("#pricechips .chip").forEach((x) => x.classList.toggle("on", x === c)); updQ(); }));
        }
        updQ();
        show("Detecté: " + [tp ? `${catOf(tp.cat).emoji} ${tp.name} (~${fmtKg(tp.kg)} kg)` : "", v.brand ? "marca " + v.brand : "", price ? "precio " + usd(price) : "no leí el precio, escríbelo", F.sw.value ? `medidas aprox. ${F.sw.value} × ${F.sh.value} cm` : ""].filter(Boolean).join(" · "), true);
      } else {
        st.innerHTML = `<div class="ai">Desde aquí no puedo leer la foto automáticamente (vista previa o sin internet). Completa los datos a mano; en la app publicada se llenan solos.</div>`;
      }
    } else {
      // Leer etiqueta (local: vision/price.js). Se usa la foto original, más nítida que la reducida.
      if (avail.ocr && !skipped) try {
        const tag = await vision.readTag(file || blob, (m) => show(m));
        if (!skipped) {
          const prices = tag.prices || [], price = tag.price ?? prices[0];
          const brand = detectBrand(tag.text || "");
          if (brand && !F.brand.value) { F.brand.value = brand; suggestTitle(); }
          if (price) {
            if (tag.compareAt && tag.compareAt > price && !F.price.value && !F.sale.value) { F.price.value = tag.compareAt.toFixed(2); F.sale.value = price.toFixed(2); fromSale(); }   // etiqueta con precio antes/ahora: el % lo calculamos
            else if (!F.price.value) F.price.value = price.toFixed(2);
            $("#pricechips", box).innerHTML = prices.length > 1 ? prices.slice(0, 6).map((p) => `<button type="button" class="chip ${p === price ? "on" : ""}" data-p="${p}">${usd(p)}${p === tag.compareAt ? ' <span class="ms-cmp">antes</span>' : ""}</button>`).join("") : "";
            box.querySelectorAll("#pricechips .chip").forEach((c) => (c.onclick = () => { F.price.value = Number(c.dataset.p).toFixed(2); box.querySelectorAll("#pricechips .chip").forEach((x) => x.classList.toggle("on", x === c)); updQ(); }));
            if (tag.extraPct && !F.discount.value && !F.sale.value) { F.discount.value = tag.extraPct; F.discount.oninput(); }
            else if (tag.extraPct && !F.discount2.value && Number(F.discount.value) !== Number(tag.extraPct)) { F.discount2.value = tag.extraPct; F.discount2.oninput(); }
            results.push(`precio ${usd(price)}${tag.compareAt ? ` (antes ${usd(tag.compareAt)})` : ""}${tag.extraPct ? ` −${tag.extraPct}% extra` : ""}${prices.length > 1 ? " · toca otro si no es" : ""}`);
          } else results.push("no leí el precio, escríbelo");
          if (brand) results.push("marca " + brand);
          updQ();
        }
      } catch (e) { console.warn(e); results.push("no pude leer la etiqueta"); }
      else results.push("escribe el precio");
      // ¿Hay una tarjeta en la foto? (local: vision/measure.js)
      if (!skipped && previewUrl) try {
        const ms = await import("./vision/measure.js");
        const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = previewUrl; });
        if ((await ms.detectCardAsync(im)).candidates.length && msOpen) { results.push("tarjeta detectada: toca Medir"); msOpen.classList.add("ms-pulse"); }
      } catch (e) { console.warn(e); }
      // Reconocer producto
      if (avail.clip && !skipped) try {
        const r = await vision.classify(blob, (m) => show(m));
        if (!skipped) { suggestTypes(r.types); const tp = typeOf(r.types[0]); if (tp) results.unshift(`${catOf(tp.cat).emoji} ${tp.name} (~${fmtKg(tp.kg)} kg)`); }
      } catch (e) { console.warn(e); results.push("elige el tipo de producto"); }
      else results.push("elige el tipo de producto");
      if (!skipped) show("Detecté: " + results.join(" · "), true);
    }
  })().catch((e) => console.warn(e));

  form.onsubmit = async (e) => {
    e.preventDefault();
    const tag = num(F.price.value);
    if (!tag) return toast("Escribe el precio");
    if (!storeSel) { $("#stpick", box).scrollIntoView({ behavior: "smooth", block: "center" }); $("#stnote", box).classList.add("need", "shake"); return toast("Elige en qué tienda va el producto"); }
    const wo = womenOnlyCat(F.category.value), fg = fixedG(), reserved = !!req && F.vis.value === "reserved";
    if (reserved && !gSel) gSel = pre.gender || "unisex";          // reservada: no sale en ningún catálogo
    if (!wo && !fg && !gSel) { $("#gpick", box).scrollIntoView({ behavior: "smooth", block: "center" }); return toast("Elige si es de Mujer, Hombre o Unisex"); }
    const d1 = disc1(), d2 = disc2(), d = disc(), price = finalPrice(tag);
    const gender = wo ? "mujer" : fg || gSel, category = TIENDAS.catFor(F.category.value, storeSel, gender);   // "Ropa" + Hombre → Ropa Hombre
    let vpos = null;
    if (F.featured.checked) {
      let cur = state.offers || []; try { cur = await state.api.listOffers(); } catch {}
      const full = vitrinasOf({ category, last_minute: F.lastmin.checked }).some((cat) => offersIn(cat, cur.filter((x) => x.featured)).length >= VITRINA_MAX);
      if (full) return toast("Máximo 4 flyers por vitrina: quita uno primero");
      vpos = Math.max(-1, ...featuredIn(storeSel, cur).map((x) => Number(x.vitrina_pos)).filter(Number.isFinite), featuredIn(storeSel, cur).length - 1) + 1;   // último afiche de la vitrina
    }
    const btn = $("#pubbtn", box); btn.disabled = true; btn.textContent = "Publicando…";
    try {
      const photo_url = blob ? await state.api.uploadPhoto(blob) : null;
      const storeV = F.store.value.trim();
      try { localStorage.setItem("ps_last_store", storeV); } catch {}
      const { offer, matches } = await state.api.createOffer({ title: F.title.value.trim(), brand: F.brand.value.trim() || null, category, price_usd: price, product_type: typeOf(F.ptype.value)?.name || null, tag_price_usd: d ? tag : null, discount_pct: d || null, discount1_pct: d1 || null, discount2_pct: d2 || null, weight_kg: kgOf(item()), box_l: boxOf(item())[0], box_w: boxOf(item())[1], box_h: boxOf(item())[2], store: storeV || null, photo_url, photos: [], size_w_cm: num(F.sw.value), size_h_cm: num(F.sh.value), size_d_cm: num(F.sd.value), colors: [...picked], sizes: listOf(F.sizes.value), last_minute: F.lastmin.checked, featured: F.featured.checked, vitrina_pos: vpos, gender, promo: F.promo2x1.checked ? "2x1" : null,
        ...(req ? { request_id: req.id, reserved_for: reserved ? req.client_id : null, ...(reserved ? { expires_at: new Date(Date.now() + 14 * 864e5).toISOString() } : {}) } : {}) });
      if (opts.onPublished) { if (previewUrl) URL.revokeObjectURL(previewUrl); return opts.onPublished(offer); }
      toast(matches ? `¡Publicada! Coincide con ${matches} ${matches > 1 ? "encargos" : "encargo"}: ya les avisamos.` : "¡Publicada!");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      postPublish(box, offer);
    } catch (err) { btn.disabled = false; btn.textContent = req ? "Guardar y preparar el mensaje" : "Publicar oferta"; toast(err.message); }
  };
}
const singular = (cat) => ({ Carteras: "Cartera", Zapatos: "Zapatos", Relojes: "Reloj", Perfumes: "Perfume", Ropa: "", RopaHombre: "", Lentes: "Lentes", Joyas: "", Maquillaje: "", Juguetes: "Juguete", Hogar: "", "Electrónica": "", Otros: "" }[cat] || "");

function openRegisterPackage(done) {
  let blob = null;
  sheet(`<h2>Registrar paquete</h2>
    <form id="pkf">
      <label class="f">N° de casillero del cliente</label><input class="in" name="locker" placeholder="CL1002" required autocapitalize="characters">
      <label class="f">¿Qué es?</label><input class="in" name="description" placeholder="Ej: Zapatillas Nike (caja Amazon)" required>
      <div class="two"><div><label class="f">Tienda</label><input class="in" name="store" placeholder="Amazon"></div><div><label class="f">Tracking</label><input class="in" name="tracking"></div></div>
      <div class="two"><div><label class="f">Peso (kg)</label><input class="in" name="weight" inputmode="decimal" required></div><div><label class="f">Valor declarado US$</label><input class="in" name="declared" inputmode="decimal" required></div></div>
      <label class="f">Medidas de la caja (cm)</label><div class="row" style="gap:6px"><input class="in" name="bl" inputmode="numeric" placeholder="Largo"><input class="in" name="bw" inputmode="numeric" placeholder="Ancho"><input class="in" name="bh" inputmode="numeric" placeholder="Alto"></div>
      <label class="f">Foto del paquete (opcional)</label><input class="in" type="file" name="photo" accept="image/*" capture="environment">
      <button class="btn coral block" style="margin-top:14px">Registrar y avisar al cliente</button>
      <button type="button" class="btn ghost block" data-close style="margin-top:8px">Cancelar</button>
    </form>`, (el, close) => {
    const f = el.querySelector("#pkf");
    const E = f.elements;
    E.photo.onchange = async () => { const file = E.photo.files[0]; blob = file ? await resizeImage(file) : null; };
    f.onsubmit = async (e) => {
      e.preventDefault(); const btn = f.querySelector(".btn.coral"); btn.disabled = true;
      try {
        const photo_url = blob ? await state.api.uploadPhoto(blob, "packages") : null;
        await state.api.registerPackage({ locker: E.locker.value, description: E.description.value.trim(), store: E.store.value.trim(), tracking: E.tracking.value.trim(), weight_kg: num(E.weight.value), box_l: num(E.bl.value), box_w: num(E.bw.value), box_h: num(E.bh.value), declared_usd: num(E.declared.value), photo_url });
        close(); toast("Paquete registrado. Le avisamos al cliente."); done?.();
      } catch (err) { btn.disabled = false; toast(err.message); }
    };
  });
}

// ---------- Login / registro ----------
function renderAuth(mode = "login", msg = "") {
  const shopLogin = mode === "shopper"; if (shopLogin) mode = "login";
  $("#app").innerHTML = `<div class="auth">
    <img class="logo" src="icon.svg" alt="">
    <h1>${esc(APP_NAME)}</h1>
    <p class="muted">${shopLogin ? "Ingreso de la shopper" : "Ofertas reales de las tiendas de Miami, puestas en Chile."}</p>
    ${shopLogin ? "" : `<div class="seg" style="margin:10px 0 6px"><button data-m="login" class="${mode === "login" ? "on" : ""}">Ingresar</button><button data-m="signup" class="${mode === "signup" ? "on" : ""}">Crear cuenta</button></div>`}
    ${msg ? `<div class="ai ok">${esc(msg)}</div>` : ""}
    <form id="af">
      ${mode === "signup" ? `<label class="f">Nombre y apellido</label><input class="in" name="name" required autocomplete="name">
      <label class="f">WhatsApp</label><input class="in" name="phone" inputmode="tel" placeholder="+56 9 …" autocomplete="tel">` : ""}
      <label class="f">Correo</label><input class="in" name="email" type="email" required autocomplete="email">
      <label class="f">Contraseña</label><input class="in" name="password" type="password" minlength="6" required autocomplete="${mode === "login" ? "current-password" : "new-password"}">
      <button class="btn coral block" style="margin-top:16px">${mode === "login" ? "Ingresar" : "Crear cuenta"}</button>
    </form></div>`;
  $("#app").querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => renderAuth(b.dataset.m)));
  $("#af").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target); const btn = e.target.querySelector("button"); btn.disabled = true;
    try {
      if (mode === "login") await state.api.signIn(f.get("email").trim(), f.get("password"));
      else {
        const hasSession = await state.api.signUp(f.get("email").trim(), f.get("password"), f.get("name").trim(), f.get("phone").trim());
        if (!hasSession) return renderAuth("login", "Cuenta creada. Revisa tu correo para confirmarla y luego ingresa.");
      }
      await boot();
    } catch (err) {
      btn.disabled = false;
      const m = /invalid login/i.test(err.message) ? "Correo o contraseña incorrectos" : /not confirmed/i.test(err.message) ? "Confirma tu correo primero" : err.message;
      toast(m);
    }
  };
}

boot();
