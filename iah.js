// =====================================================================
// iah.js — IAH (entiende) + Genius (busca) para el mall de Shoppers Miami
// =====================================================================
// Todo corre en el teléfono de la clienta: sin claves, sin servidor y sin costo por consulta.
//   IAH    : lee la frase y arma un plan (qué producto, color, tamaño, presupuesto, para quién, ocasión).
//   Genius : recorre lo publicado, filtra, ordena y, si no hay nada exacto, afloja de a un criterio.
// El "saber" de ambos es el vocabulario de este archivo (tipos, colores, ocasiones, glosario).
(function () {
  "use strict";

  // ---------- utilidades de texto ----------
  var norm = function (s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[¿?¡!.,;:()"“”'’*_/\\|+]/g, " ").replace(/\s+/g, " ").trim();
  };
  // distancia de edición (cuenta como 1 el intercambio de dos letras vecinas)
  var lev = function (a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var best = d[i][0];
      for (j = 1; j <= b.length; j++) {
        var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v; if (v < best) best = v;
      }
      if (best > max) return max + 1;
    }
    return d[a.length][b.length];
  };
  // cómo suena: "zapatiyas" = "zapatillas", "biyetera" = "billetera", "vlanca" = "blanca"
  var fon = function (w) { return w.replace(/ll/g, "y").replace(/v/g, "b").replace(/z/g, "s").replace(/c(?=[ei])/g, "s").replace(/qu/g, "k").replace(/c/g, "k").replace(/h/g, "").replace(/(.)\1+/g, "$1"); };
  var dist = function (a, b, max) { var d = lev(a, b, max); if (d === 0) return 0; var fa = fon(a), fb = fon(b); if (fa === fb) return 0.5; var m2 = Math.min(max, tol(fa)); var e = m2 ? lev(fa, fb, m2) : 9; return Math.min(d, e <= m2 ? e : 9); };
  var tol = function (w) { return w.length >= 9 ? 2 : w.length >= 5 ? 1 : 0; };
  var singular = function (w) {
    if (w.length > 5 && /[^aeiou]es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w)) return w.slice(0, -1);
    return w;
  };

  // ---------- SABER 1: tipos de producto ----------
  // [id, singular, plural, género gramatical, sinónimos, cómo reconocerlo en un producto, tienda donde iría]
  var T = [
    ["cartera", "cartera", "carteras", "f", "cartera carteras bolso bolsos bolsa bolsas bolsito handbag handbags purse bag bags cartero carterita", /\bcartera|\bbolso|\btote\b|crossbody|satchel|bandolera|clutch/, "Carteras"],
    ["tote", "cartera tote", "carteras tote", "f", "tote totes shopper|bolso grande|cartera shopper|tote bag", /\btote\b|shopper/, "Carteras"],
    ["crossbody", "cartera crossbody", "carteras crossbody", "f", "crossbody crossbodys bandolera bandoleras cruzada cruzadas cruzado terciada|cross body|manos libres|para cruzar|camera bag|bolso cruzado|cartera cruzada|de cruzar", /crossbody|bandolera/, "Carteras"],
    ["satchel", "cartera satchel", "carteras satchel", "f", "satchel satchels|maletin|cartera estructurada|con asa corta", /satchel/, "Carteras"],
    ["hombro", "cartera de hombro", "carteras de hombro", "f", "de hombro|al hombro|shoulder|shoulder bag|hobo|bajo el brazo", /hombro|shoulder|hobo/, "Carteras"],
    ["clutch", "clutch", "clutch y sobres", "m", "clutch clutches|cartera sobre|sobre de fiesta|cartera de fiesta|cartera de noche|bolso de fiesta", /clutch|\bsobre\b|wristlet/, "Carteras"],
    ["mochila", "mochila", "mochilas", "f", "mochila mochilas backpack backpacks morral morrales mochilita", /mochila|backpack/, "Carteras"],
    ["billetera", "billetera", "billeteras", "f", "billetera billeteras wallet wallets monedera billetero billetara biyetera|porta billetes", /billetera|wallet/, "Carteras"],
    ["monedero", "monedero", "monederos", "m", "monedero monederos|porta monedas|portamonedas|coin purse", /^monedero/, "Carteras"],
    ["tarjetero", "tarjetero", "tarjeteros", "m", "tarjetero tarjeteros|porta tarjetas|portatarjetas|porta documentos|portadocumentos|card holder|cardholder|card case", /^tarjetero/, "Carteras"],
    ["wristlet", "billetera de mano", "billeteras de mano", "f", "wristlet wristlets|de muneca|billetera de mano|con correa de mano|pulsera de mano", /wristlet|de mano/, "Carteras"],
    ["maleta", "maleta", "maletas", "f", "maleta maletas valija valijas equipaje|carry on|carry-on|trolley", /maleta|valija|carry/, "Carteras"],
    ["calzado", "zapato", "zapatos", "m", "zapato zapatos calzado calzados shoes shoe zapatitos", /zapat|sandalia|ballerina|mocasin|\bbota|botin|\btaco/, "Zapatos"],
    ["zapatilla", "zapatilla", "zapatillas", "f", "zapatilla zapatillas tenis sneaker sneakers championes tillas deportivas bambas|zapatos deportivos|zapatos de deporte", /zapatilla|sneaker|\btenis\b/, "Zapatos"],
    ["sandalia", "sandalia", "sandalias", "f", "sandalia sandalias chala chalas chancla chanclas chancleta chancletas ojota ojotas sandals", /sandalia|\bchala/, "Zapatos"],
    ["hawaiana", "hawaiana", "hawaianas", "f", "hawaiana hawaianas|flip flop|flip flops|flipflops|sandalia de playa|chalas de playa", /hawaiana|flip/, "Zapatos"],
    ["slide", "sandalia slide", "sandalias slide", "f", "slide slides|de piscina|chalas de piscina|sandalia de piscina", /\bslide/, "Zapatos"],
    ["taco", "zapato de taco", "zapatos de taco", "m", "taco tacos tacon tacones heels stiletto stilettos|taco alto|zapato de vestir|zapatos de vestir|sandalia de taco|sandalias de taco|zapato alto|zapatos altos", /\btaco|tacon|heel|stiletto/, "Zapatos"],
    ["plataforma", "zapato con plataforma", "zapatos con plataforma", "m", "plataforma plataformas platform|con plataforma", /plataforma/, "Zapatos"],
    ["ballerina", "ballerina", "ballerinas", "f", "ballerina ballerinas bailarina bailarinas balerina balerinas flats chatitas|zapato plano|zapatos planos|zapato bajo|zapatos bajos", /ballerina|bailarina|\bflat/, "Zapatos"],
    ["mocasin", "mocasín", "mocasines", "m", "mocasin mocasines loafer loafers", /mocasin|loafer/, "Zapatos"],
    ["bota", "bota", "botas y botines", "f", "bota botas botin botines boots bototos", /\bbota|botin|\bboot/, "Zapatos"],
    ["reloj", "reloj", "relojes", "m", "reloj relojes watch watches smartwatch", /reloj|watch/, "Relojes"],
    ["joya", "joya", "joyas", "f", "joya joyas joyeria aros aretes pendientes collar collares pulsera pulseras anillo anillos bisuteria", /\bjoya|\baros\b|collar|pulsera|anillo/, "Relojes"],
    ["lentes", "lentes", "lentes", "m", "lentes anteojos gafas sunglasses|lentes de sol", /lentes|anteojos|gafas/, "Otros"],
    ["perfume", "perfume", "perfumes", "m", "perfume perfumes colonia colonias fragancia fragancias|body splash|body mist", /perfume|colonia|splash/, "Otros"],
    ["maquillaje", "maquillaje", "maquillaje", "m", "maquillaje labial labiales rimel base sombras paleta makeup", /maquillaje|labial|paleta/, "Otros"],
    ["polera", "polera", "poleras", "f", "polera poleras camiseta camisetas remera remeras playera playeras|t-shirt|tshirt|t shirt", /polera|camiseta|t-shirt/, "Ropa"],
    ["camisa", "camisa o blusa", "camisas y blusas", "f", "camisa camisas blusa blusas", /camisa|blusa/, "Ropa"],
    ["jeans", "pantalón", "jeans y pantalones", "m", "jeans jean pantalon pantalones pitillos", /jeans|pantalon/, "Ropa"],
    ["vestido", "vestido", "vestidos", "m", "vestido vestidos dress", /vestido/, "Ropa"],
    ["falda", "falda", "faldas", "f", "falda faldas pollera polleras skirt", /falda/, "Ropa"],
    ["poleron", "polerón", "polerones", "m", "poleron polerones sudadera sudaderas hoodie hoodies canguro", /poleron|hoodie|sudadera/, "Ropa"],
    ["sweater", "sweater", "sweaters", "m", "sweater sweaters sueter sueteres chaleco chalecos jersey", /sweater|chaleco/, "Ropa"],
    ["chaqueta", "chaqueta", "chaquetas", "f", "chaqueta chaquetas casaca casacas campera camperas jacket", /chaqueta|casaca/, "Ropa"],
    ["parka", "parka o abrigo", "parkas y abrigos", "f", "parka parkas abrigo abrigos|cortaviento", /parka|abrigo/, "Invierno"],
    ["deportiva", "ropa deportiva", "ropa deportiva", "f", "calzas calza leggings mallas short shorts buzo buzos|ropa deportiva|top deportivo|ropa de gimnasio|ropa para entrenar", /calza|legging|short|buzo|deportiv/, "Deportes"],
    ["lenceria", "lencería", "lencería", "f", "lenceria pijama pijamas sosten sostenes brasier bralette calzon calzones|ropa interior|bata", /pijama|brasier|ropa interior|\bbody\b|lencer/, "Lenceria"],
    ["bano", "traje de baño", "trajes de baño", "m", "bikini bikinis|traje de bano|trajes de bano|trikini", /bano|bikini/, "Ropa"],
    ["accesorio", "accesorio", "accesorios", "m", "cinturon cinturones gorro gorros jockey gorra gorras bufanda bufandas panuelo panuelos", /cinturon|gorro|jockey|bufanda|panuelo/, "Relojes"],
    ["ropa", "ropa", "ropa", "f", "ropa prendas prenda vestuario", null, "Ropa"],
  ];
  var TYPE = {};
  T.forEach(function (r) { TYPE[r[0]] = { id: r[0], uno: r[1], label: r[2], gen: r[3], rx: r[5], shop: r[6] }; });
  // un tipo general contiene a los específicos (si piden "zapatos" sirven zapatillas, sandalias…)
  var FAMILY = {
    cartera: ["tote", "crossbody", "satchel", "hombro"],
    calzado: ["zapatilla", "sandalia", "hawaiana", "slide", "taco", "plataforma", "ballerina", "mocasin", "bota"],
    sandalia: ["hawaiana", "slide"],
    ropa: ["polera", "camisa", "jeans", "vestido", "falda", "poleron", "sweater", "chaqueta", "parka", "deportiva", "bano"],
  };

  // ---------- SABER 2: colores (nombre de la app ← cómo lo dice la gente) ----------
  var C = {
    "Negro": "negro negra negros negras black",
    "Blanco": "blanco blanca blancos blancas white marfil ivory|off white",
    "Beige": "beige beis crema nude camel arena taupe vainilla natural caqui khaki|color piel",
    "Café": "cafe cafes marron marrones brown chocolate cognac conac tabaco castano moka luggage",
    "Gris": "gris grises grey gray plomo grafito",
    "Azul": "azul azules blue marino navy denim|azul marino",
    "Celeste": "celeste celestes turquesa|azul claro|light blue",
    "Verde": "verde verdes green oliva olivo militar esmeralda menta",
    "Rojo": "rojo roja rojos rojas red carmesi escarlata",
    "Granate": "granate burdeo burdeos bordo vino guinda guindo conchevino merlot burgundy marsala|vino tinto|concho de vino",
    "Rosado": "rosado rosada rosados rosadas rosa rosas pink fucsia blush salmon coral|palo rosa|rosa palo",
    "Morado": "morado morada morados moradas violeta lila purpura purple lavanda",
    "Amarillo": "amarillo amarilla amarillos amarillas yellow mostaza",
    "Naranjo": "naranjo naranja naranjas orange terracota",
    "Dorado": "dorado dorada dorados doradas oro gold golden",
    "Plateado": "plateado plateada plateados plateadas plata silver metalico metalica",
    "Multicolor": "multicolor colorido colorida floreado floreada|de colores|varios colores",
    "Monograma": "monograma monogramas monogram signature logotipo logo logos letras|con logo|con el logo|con logos|con letras|con las letras|con las mk|con mk|estampado mk|estampada mk|de letras|con iniciales",
    "Animal print café": "leopardo cheetah guepardo|animal print|animal print cafe|print animal|piel de leopardo",
    "Animal print cebra": "cebra zebra|animal print cebra|piel de cebra",
    "Bicolor": "bicolor bitono|dos colores|dos tonos|de dos colores",
  };
  // si no hay en el color pedido, estos son los parecidos que vale la pena mostrar
  var NEAR = {
    "Granate": ["Rojo"], "Rojo": ["Granate"], "Beige": ["Café", "Blanco"], "Café": ["Beige"], "Blanco": ["Beige"],
    "Celeste": ["Azul"], "Azul": ["Celeste"], "Morado": ["Rosado"], "Rosado": ["Rojo"], "Naranjo": ["Café", "Rojo"],
    "Amarillo": ["Dorado", "Beige"], "Dorado": ["Beige", "Plateado"], "Plateado": ["Gris", "Dorado"], "Gris": ["Plateado", "Negro"],
    "Multicolor": ["Bicolor", "Monograma"], "Bicolor": ["Monograma"], "Animal print cebra": ["Animal print café"], "Animal print café": ["Animal print cebra"],
  };
  var COLOR_SAY = { "Animal print café": "animal print", "Animal print cebra": "animal print cebra", "Monograma": "monograma (con el logo)" };

  // ---------- SABER 3: tamaños, ocasiones, personas, marcas, detalles ----------
  var SIZES = {
    grande: "grande grandes amplia amplio espaciosa espacioso big large maxi|que quepa todo|bien grande|tamano grande|donde quepa",
    mediana: "mediana mediano medianas medium|tamano medio|ni muy grande ni muy chica|ni grande ni chica",
    pequena: "pequena pequeno pequenas pequenos chica chico chicas chiquita chiquito mini small compacta compacto pequenita",
  };
  var SIZE_RX = { grande: /grande/, mediana: /mediana|mediano/, pequena: /pequen|\bmini\b/ };
  var SIZE_SAY = { grande: "grande", mediana: "mediana", pequena: "pequeña" };
  var OCC = {
    regalo: ["para regalo", "regalo regalos regalar regalarle obsequio cumpleanos cumple santo navidad aniversario|amigo secreto|dia de la madre|dia de la mama|dia del padre|san valentin", ["billetera", "tarjetero", "monedero", "wristlet", "crossbody"]],
    trabajo: ["para el trabajo", "trabajo trabajar oficina pega notebook laptop computador reuniones", ["tote", "satchel", "mochila", "hombro"]],
    viaje: ["para viajar", "viaje viajar viajes aeropuerto avion vacaciones", ["mochila", "tote", "crossbody", "maleta"]],
    fiesta: ["para una fiesta", "fiesta fiestas noche matrimonio boda gala cena evento graduacion carrete carretear", ["clutch", "wristlet", "crossbody", "taco", "sandalia"]],
    diario: ["para el día a día", "diario casual|dia a dia|todos los dias|uso diario|para todo", ["crossbody", "tote", "hombro", "zapatilla"]],
    playa: ["para la playa", "playa verano piscina", ["sandalia", "hawaiana", "slide", "tote"]],
    estudio: ["para estudiar", "universidad colegio clases estudiar estudio liceo", ["mochila", "tote"]],
    comodo: ["para andar cómoda", "comodo comoda comodos comodas caminar|mucho caminar|estar de pie", ["zapatilla", "ballerina", "mocasin", "slide"]],
    elegante: ["para algo elegante", "elegante elegantes formal formales sofisticada sofisticado clasica clasico fina fino", ["satchel", "taco", "ballerina", "hombro", "mocasin"]],
  };
  var WHO = {
    mujer: "mujer mujeres dama damas senora ella mama mami madre suegra esposa polola novia hija hermana amiga abuela abuelita tia femenino femenina nina jefa companera sobrina nuera cunada",
    hombre: "hombre hombres varon caballero caballeros papa padre marido esposo pololo novio hijo hermano amigo abuelo masculino suegro tio nino jefe sobrino yerno cunado",
  };
  var BRAND_ALIAS = {
    "Michael Kors": "mk kors|michael kors|maikol kors|michel kors|michael cors|maicol kors|michaelkors",
    "Coach": "coach", "Kate Spade": "kate|kate spade", "Tory Burch": "tory|tory burch", "Marc Jacobs": "marc jacobs", "Guess": "guess",
    "Calvin Klein": "ck|calvin klein|calvin", "Tommy Hilfiger": "tommy|tommy hilfiger", "Nike": "nike", "Adidas": "adidas", "Puma": "puma",
    "Skechers": "skechers", "Ralph Lauren": "polo|ralph lauren", "Levi's": "levis", "Victoria's Secret": "victoria secret|victorias secret",
    "Gucci": "gucci", "Louis Vuitton": "lv|louis vuitton", "Prada": "prada", "Zara": "zara", "Steve Madden": "steve madden", "Ray-Ban": "rayban|ray ban",
    "The North Face": "north face|the north face", "Columbia": "columbia", "Lacoste": "lacoste", "Fossil": "fossil", "Swarovski": "swarovski", "Pandora": "pandora",
    "Under Armour": "under armour", "New Balance": "new balance", "Converse": "converse", "Vans": "vans", "Crocs": "crocs", "Carolina Herrera": "carolina herrera|ch",
  };
  // palabras de detalle: cómo lo dice la gente → palabra que aparece en los títulos
  var DETAIL = {
    cierre: "cierre zipper cremallera|con cierre", cadena: "cadena cadenas chain|con cadena", solapa: "solapa tapa|con solapa",
    bolsillos: "bolsillo bolsillos compartimentos compartimientos", gamuza: "gamuza suede ante|de gamuza", broche: "broche boton|con broche",
    monedero: "monedera|con monedero", id: "visor|para el carnet|para la cedula|porta carnet", tobillo: "tobillo|con tira",
    retro: "retro vintage", clasica: "clasica clasico basica basico",
    "2 en 1": "2 en 1|dos en uno|con cartera adentro|con bolso adentro",
  };

  // ---------- SABER 4: glosario (lo que Genius sabe explicar) ----------
  var GLOS = [
    ["tote", "tote totes shopper", "Un tote es una cartera grande y abierta, con dos asas para llevarla al hombro. Es la que más aguanta: notebook, agenda, botella. Ideal para el trabajo o para viajar."],
    ["crossbody", "crossbody bandolera cruzada|camera bag|camera", "Una crossbody o bandolera se lleva cruzada sobre el cuerpo con una correa larga, así quedan las manos libres. La versión \"camera\" es la más chica y rectangular."],
    ["satchel", "satchel", "Un satchel es una cartera estructurada, con base firme, asas cortas para llevarla en la mano y casi siempre una correa extra para cruzarla. Se ve más formal que un tote."],
    ["hombro", "hobo shoulder|de hombro", "Una cartera de hombro tiene una sola asa o correa corta y va pegada al cuerpo, bajo el brazo. Es cómoda para el día a día."],
    ["clutch", "clutch|cartera sobre", "Un clutch es una cartera chica sin asas, que se lleva en la mano. Es la clásica de fiesta: cabe el teléfono, las llaves y un labial."],
    ["wristlet", "wristlet", "Un wristlet es una billetera grande o cartera muy chica con una correa corta para la muñeca. Sirve sola para salir con lo justo: tarjetas, billetes y teléfono."],
    ["mochila", "mochila backpack", "Las mochilas de marca de mujer son más chicas y elegantes que una deportiva: sirven como cartera para el día a día con las manos libres."],
    ["billetera", "bifold", "Una billetera bifold se dobla en dos. Es la mediana clásica: tarjetas, billetes y a veces monedero."],
    ["billetera", "trifold", "Una billetera trifold se dobla en tres. Queda más corta y gruesa, con más ranuras para tarjetas."],
    ["billetera", "continental", "Una billetera continental es la grande y alargada, generalmente con cierre alrededor. Caben los billetes estirados, muchas tarjetas y hasta el teléfono."],
    ["tarjetero", "tarjetero|card holder|cardholder", "Un tarjetero es lo más chico: solo para tarjetas y un par de billetes doblados. Es un buen regalo porque es de marca y cuesta menos."],
    ["monedero", "monedero", "Un monedero es un estuche chico con cierre para monedas, llaves y un par de tarjetas."],
    [null, "monograma monogram signature|con logo", "\"Monograma\" es el diseño con el logo de la marca repetido en toda la tela, por ejemplo las letras MK. Es el estampado más reconocible de Michael Kors."],
    [null, "saffiano", "Saffiano es un cuero con una textura de rayitas cruzadas muy fina. Es firme, se raya poco y se limpia fácil."],
    [null, "pebbled graneado|cuero graneado", "El cuero graneado (pebbled) tiene una textura de granitos suaves. Es más blando que el saffiano y disimula bien el uso."],
    [null, "gamuza suede", "La gamuza es cuero con el lado afelpado hacia afuera. Es suave y elegante, pero hay que cuidarla del agua."],
    [null, "jet set|jetset", "Jet Set es la línea más conocida de Michael Kors: diseños simples, con el logo MK, en carteras, billeteras y mochilas."],
    ["slide", "slide slides", "Una slide es una sandalia sin talón, con una sola banda ancha arriba. Te la pones y te la sacas sin usar las manos."],
    ["hawaiana", "hawaiana hawaianas|flip flop", "La hawaiana es la sandalia de playa con la tira entre los dedos."],
    ["ballerina", "ballerina bailarina flats", "Una ballerina es un zapato plano y cerrado, liviano, que sirve tanto para el trabajo como para el día a día."],
    ["mocasin", "mocasin loafer", "Un mocasín es un zapato plano sin cordones, un poco más firme y formal que una ballerina."],
    ["plataforma", "plataforma", "La plataforma es una suela gruesa pareja: da altura sin la incomodidad de un taco."],
    [null, "outlet", "En un outlet las marcas venden temporadas anteriores o líneas hechas para outlet con mucho descuento respecto del precio de etiqueta. Cheryl compra ahí en persona."],
    [null, "precio de etiqueta|etiqueta|precio original", "El precio de etiqueta es el que trae impreso el producto. El precio final es lo que realmente se paga en la tienda con el descuento. El porcentaje que ves en cada producto sale de comparar esos dos."],
    [null, "puesto en chile|precio final|estimado", "El precio \"puesto en Chile\" es un estimado de todo: el precio en la tienda, el impuesto de Florida, la comisión de la shopper, el envío y la aduana."],
    [null, "encargo encargos", "Un encargo es pedirle a Cheryl algo que no está publicado. Ella lo busca en las tiendas y te avisa si lo encuentra."],
    [null, "ultimo minuto", "\"Último minuto\" son ofertas que duran poco: Cheryl está en la tienda y el precio vale solo por ese rato."],
  ];

  // ---------- diccionario de frases (todo el vocabulario → concepto) ----------
  var DICT = {}, WORDS = [], MAXW = 1;
  var add = function (list, kind, id) {
    String(list).split("|").forEach(function (chunk, i, all) {
      // el primer trozo son palabras sueltas separadas por espacio; los demás trozos (tras "|") son frases completas
      (i === 0 ? chunk.split(" ") : [chunk]).forEach(function (p) {
        p = norm(p); if (!p) return;
        if (!DICT[p]) DICT[p] = [];
        DICT[p].push({ kind: kind, id: id });
        var n = p.split(" ").length; if (n > MAXW) MAXW = n;
        if (n === 1 && p.length >= 5) WORDS.push(p);
      });
    });
  };
  T.forEach(function (r) { add(r[4], "type", r[0]); });
  Object.keys(C).forEach(function (k) { add(C[k], "color", k); });
  Object.keys(SIZES).forEach(function (k) { add(SIZES[k], "size", k); });
  Object.keys(OCC).forEach(function (k) { add(OCC[k][1], "occ", k); });
  Object.keys(WHO).forEach(function (k) { add(WHO[k], "who", k); });
  Object.keys(BRAND_ALIAS).forEach(function (k) { add((k === "Michael Kors" ? "" : "|") + BRAND_ALIAS[k], "brand", k); });
  Object.keys(DETAIL).forEach(function (k) { add(DETAIL[k], "detail", k); });

  var STOP = {};
  ("a al algo alguna algunas alguno algunos ando aqui asi aun ayuda ayudame ayudas bien bonita bonito buen buena buenas bueno buenos busco buscando buscar buscame busca cada casi como con cosa cosas cual cuales cualquier cualquiera da dame de deben del desde di dime donde dos e el ella en encontrar encuentrame encuentro era es esa esas ese eso esos esta estaba estan estas este esto estos estoy favor fuera gracias gustaria gusta gustan ha habra hay hola holi igual ir la las le les linda lindo lindas lindos lo los me mi mis mostrar mostrame muestrame muestra mucho muy necesito ni no nos o opcion opciones otra otro otras otros para pero podria podrias por porfa porfavor puede puedes puedo que quería queria quiero quisiera recomiendame recomienda recomiendas recomendar se sea sean ser si sin sino sobre solo son su sus tal tambien te tener tengo tiene tienen tienes toda todas todo todos tu tus un una unas uno unos usar uso va vas ve ver vi y ya yo hasta entre menos mas maximo minimo tipo tipos estilo modelo modelos color colores algun cuanto cuanta cuantos cuantas vale valen cuesta cuestan precio precios sale salen plata dinero presupuesto gastar pagar disponible disponibles stock venden vendes vende existe existen ojala onda ponte super harto harta re medio media poco poca algo nada tan the of for and in with x salir sale quepa quepan caber cabe cabeza llevar lleva lleve ir voy vamos andar ando usar ocupar ocupo sirva sirve sirvan combine combinar quede queda quedan vea ver verse luzca tenga tengan traiga gusten gustaria encanta encantan fascina prefiero preferiria ojala porfis hacer hago regalarle darle dar comprar comprarle compro llevarle cosita cositas detalle algun ideas idea iah genius cheryl miami shoppers tienda tiendas mall marca marcas dia dias cosas buena onda")
    .split(" ").forEach(function (w) { STOP[norm(w)] = 1; });

  // ---------- IAH: entender la frase ----------
  function parseNum(s) {
    return Number(String(s).replace(/\$/g, "").trim().replace("d", "."));
  }
  var NUM = "(\\$?\\s?\\d+(?:d\\d+)?)", UNIT = "(k|mil|lucas|luca|lukas|luka|palos|palo|dolares|dolar|usd|us|pesos|clp|chilenos)?";
  function money(n, unit, cur0) {
    var v = parseNum(n), cur = cur0 || null, ambig = false;
    if (/^(k|mil|lucas|luca|lukas|luka)$/.test(unit || "")) { v *= 1000; cur = "CLP"; }
    else if (/^palos?$/.test(unit || "")) { v *= 1e6; cur = "CLP"; }
    else if (/^(pesos|clp|chilenos)$/.test(unit || "")) cur = "CLP";
    else if (/^(dolares|dolar|usd|us)$/.test(unit || "")) cur = "USD";
    if (!cur) { if (v >= 1000) cur = "CLP"; else { cur = "CLP"; v *= 1000; ambig = true; } }
    return { v: v, cur: cur, ambig: ambig };
  }

  function entender(raw, prev) {
    var text = " " + norm(String(raw).replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2").replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2").replace(/(\d)[.,](\d{1,2})(?!\d)/g, "$1d$2").replace(/(\d)\s*%/g, "$1 porciento ").replace(/us\$/gi, " usd ").replace(/\$/g, " $")) + " ";
    var p = { raw: raw, types: [], colors: [], notColors: [], size: null, occ: null, who: null, gift: false, brand: null, details: [], free: [],
      max: null, min: null, cur: null, ambig: false, minPct: null, onSale: false, sort: null, lastMinute: false, shoeSize: null, more: false, clear: [], unknown: [] };
    var cut = function (rx, fn) { text = text.replace(rx, function () { var r = fn.apply(null, arguments); return r === false ? arguments[0] : " "; }); };

    // talla de calzado
    cut(/\b(?:talla|numero|nro|calzo|size|num)\s*(?:de\s*)?(?:calzado\s*)?(\d{1,2}(?:d5)?)\b/, function (m, n) { p.shoeSize = n.replace("d", "."); });
    // descuento mínimo
    cut(/(?:mas de|sobre|minimo|al menos|desde|con)?\s*(\d{1,2})\s*porciento(?:\s*(?:de\s*)?(?:descuento|dcto|off|rebaja))?/, function (m, n) { p.minPct = Number(n); p.onSale = true; });
    cut(/\b2\s*x\s*1\b/, function () { p.details.push("2x1"); });
    // "2 en 1" es un detalle del producto, no un precio
    cut(/\b(?:2 en 1|dos en uno)\b/, function () { p.details.push("2 en 1"); });
    // presupuesto
    var usdWord = /\b(dolares|dolar|usd)\b/.test(text) ? "USD" : null;
    cut(new RegExp("\\bentre\\s+(?:los\\s+|las\\s+)?(?:usd\\s*)?" + NUM + "\\s*" + UNIT + "\\s*(?:y|a|-)\\s*(?:los\\s+|las\\s+)?(?:usd\\s*)?" + NUM + "\\s*" + UNIT + "\\b"), function (m, a, ua, b, ub) {
      var hi = money(b, ub, usdWord), lo = money(a, ua || (hi.ambig ? "" : ub), usdWord || hi.cur);
      if (hi.cur === "CLP" && !ua && lo.v < 1000 && !hi.ambig) lo.v *= 1; if (hi.cur === "CLP" && lo.v < 1000) lo.v *= 1000;
      p.min = lo.v; p.max = hi.v; p.cur = hi.cur; p.ambig = hi.ambig;
    });
    cut(new RegExp("\\b(?:hasta|maximo|max|menos de|menor a|bajo|no mas de|que no pase de|que no pasen de|que no supere|por menos de|por debajo de|debajo de|inferior a|tope de|tope|presupuesto de|tengo|cuento con|dispongo de|por unos|por unas|de unos|de unas|alrededor de|como)\\s+(?:los\\s+|las\\s+|unos\\s+|unas\\s+|como\\s+)?(?:usd\\s*)?" + NUM + "\\s*" + UNIT + "\\b"), function (m, n, u) {
      var x = money(n, u, usdWord); p.max = x.v; p.cur = x.cur; p.ambig = x.ambig;
    });
    cut(new RegExp("\\b(?:mas de|sobre los|sobre las|sobre|desde|minimo|arriba de|por encima de|superior a|mayor a)\\s+(?:los\\s+|las\\s+)?(?:usd\\s*)?" + NUM + "\\s*" + UNIT + "\\b"), function (m, n, u) {
      var x = money(n, u, usdWord); p.min = x.v; p.cur = p.cur || x.cur; p.ambig = p.ambig || x.ambig;
    });
    cut(new RegExp("(?:\\busd\\s*)" + NUM + "\\b"), function (m, n) { if (p.max != null) return false; var x = money(n, "usd"); p.max = x.v; p.cur = "USD"; });
    cut(new RegExp("(?:^|\\s)" + NUM + "\\s*(k|mil|lucas|luca|lukas|luka|palos|palo|dolares|dolar|usd|pesos|clp)\\b"), function (m, n, u) { if (p.max != null) return false; var x = money(n, u, usdWord); p.max = x.v; p.cur = x.cur; });
    cut(/(?:^|\s)\$\s?(\d+(?:d\d+)?)/, function (m, n) { if (p.max != null) return false; var x = money(n, "", usdWord); p.max = x.v; p.cur = x.cur; p.ambig = x.ambig; });

    // negaciones de color: "que no sea negra", "sin logo", "menos el rojo"
    var negNext = false;
    // orden / intención de precio
    cut(/\b(?:lo |la |las |los |el )?mas (?:barat[oa]s?|economic[oa]s?|convenientes?|accesibles?)\b|\bbarat[oa]s?\b|\beconomic[oa]s?\b|\bconvenientes?\b|\baccesibles?\b|\bbuen precio\b|\bmenor precio\b|\bque no sea(?:n)? (?:muy |tan )?car[oa]s?\b|\bno (?:muy|tan|demasiado) car[oa]s?\b|\bno tan car[oa]s?\b|\bmenos car[oa]s?\b/, function () { p.sort = "asc"; });
    cut(/\b(?:lo |la |las |los |el )?mas (?:car[oa]s?|exclusiv[oa]s?|lujos[oa]s?|fin[oa]s?)\b|\bde lujo\b|\bpremium\b|\blo mejor\b|\bla mejor\b/, function () { p.sort = "desc"; });
    cut(/\b(?:con |el |la |lo |los |las )?(?:mas|mayor|mejor(?:es)?) (?:descuentos?|ofertas?|rebajas?|dcto)\b|\bmas rebajad[oa]s?\b|\bmejor(?:es)? ofertas?\b|\bmas descuento\b/, function () { p.sort = "disc"; p.onSale = true; });
    cut(/\b(?:en |con |de )?(?:ofertas?|descuentos?|rebajas?|rebajad[oa]s?|liquidacion|promocion|promociones|sale|dcto)\b/, function () { p.onSale = true; if (!p.sort) p.sort = "disc"; });
    cut(/\bultimo minuto\b|\bultima hora\b/, function () { p.lastMinute = true; });
    cut(/\b(?:lo |la |las |los )?(?:mas )?(?:nuev[oa]s?|recien llegad[oa]s?|novedades|novedad|lo ultimo|recientes?)\b/, function () { p.sort = p.sort || "new"; });
    // pedir más / limpiar criterios
    cut(/\b(?:muestrame|mostrame|ver|quiero ver|dame|hay)?\s*(?:mas opciones|otras opciones|que mas hay|que mas tienes|que mas tienen|ver mas|mas modelos|otros modelos|siguientes?)\b/, function () { p.more = true; });
    cut(/\b(?:cualquier color|da igual el color|no importa el color|todos los colores|en cualquier color|sin importar el color|otro color no importa)\b/, function () { p.clear.push("color"); });
    cut(/\b(?:cualquier precio|da igual el precio|no importa el precio|sin limite|sin tope|el precio da igual|sin presupuesto)\b/, function () { p.clear.push("price"); });
    cut(/\b(?:cualquier tamano|da igual el tamano|no importa el tamano|de cualquier tamano)\b/, function () { p.clear.push("size"); });
    cut(/\b(?:eran|son|en|era|hablo de|me refiero a) dolares\b|\ben usd\b/, function () { p.toUSD = true; });
    cut(/\b(?:eran|son|en|era|hablo de|me refiero a) (?:pesos chilenos|pesos|lucas)\b/, function () { p.toCLP = true; });
    // "para mí", "para una chica": no son tamaño
    cut(/\bpara (?:una |mi |la )chica\b/, function () { p.who = "mujer"; });
    cut(/\b(?:para|a) mi\b(?! (?:mama|mami|madre|papa|padre|suegr|espos|marid|polol|novi|hij|herman|amig|abuel|tia|tio|jef|sobrin|nuera|yerno|cunad|companer))/, function () {});

    // recorrido de palabras: frase más larga primero
    var toks = text.trim().split(" ").filter(Boolean), i = 0;
    var take = function (hit, words) {
      hit.forEach(function (h) {
        if (h.kind === "type") { if (p.types.indexOf(h.id) < 0) p.types.push(h.id); }
        else if (h.kind === "color") { var arr = negNext ? p.notColors : p.colors; if (arr.indexOf(h.id) < 0) arr.push(h.id); }
        else if (h.kind === "size") p.size = h.id;
        else if (h.kind === "occ") { if (h.id === "regalo") p.gift = true; if (!p.occ || h.id !== "regalo") p.occ = p.occ && p.occ !== "regalo" ? p.occ : h.id; }
        else if (h.kind === "who") p.who = h.id;
        else if (h.kind === "brand") p.brand = h.id;
        else if (h.kind === "detail") { if (p.details.indexOf(h.id) < 0) p.details.push(h.id); }
      });
    };
    while (i < toks.length) {
      var done = false;
      // negación abre para el color que viene
      if (/^(no|sin|menos|excepto|salvo|tampoco|nada)$/.test(toks[i])) { negNext = true; var look = toks.slice(i + 1, i + 5).join(" "); if (!/\b/.test(look)) negNext = false; }
      for (var n = Math.min(MAXW, toks.length - i); n >= 1 && !done; n--) {
        var ph = toks.slice(i, i + n).join(" "), hit = DICT[ph];
        if (!hit && n === 1) { var sg = singular(ph); if (sg !== ph) hit = DICT[sg]; }
        if (hit) {
          // "sobre" suelto casi siempre es preposición; "rosa" tras "palo" ya se tomó como frase
          if (n === 1 && STOP[ph] && !(hit[0].kind === "color")) hit = null;
        }
        if (hit) { take(hit, n); if (hit[0].kind === "color") negNext = false; i += n; done = true; }
      }
      if (done) continue;
      var w = toks[i]; i++;
      if (STOP[w] || /^\d+(d\d+)?$/.test(w) || w.length < 2) { if (!/^(no|sin|menos|excepto|salvo|sea|sean|que|el|la|los|las|en|de|color|con|nada|tampoco)$/.test(w)) negNext = false; continue; }
      // error de tipeo: buscar la palabra conocida más cercana
      var t = tol(w), bestW = null, bestD = 9;
      if (t) for (var k = 0; k < WORDS.length; k++) { var d = dist(w, WORDS[k], t); if (d < bestD || (d === bestD && bestW && Math.abs(WORDS[k].length - w.length) < Math.abs(bestW.length - w.length))) { bestD = d; bestW = WORDS[k]; } }
      if (bestW && bestD <= t) { take(DICT[bestW], 1); if (DICT[bestW][0].kind === "color") negNext = false; continue; }
      negNext = false;
      p.free.push(w);
    }
    // un tipo general sobra si ya viene uno específico de su familia ("cartera tote" → tote)
    Object.keys(FAMILY).forEach(function (g) {
      if (p.types.indexOf(g) >= 0 && p.types.some(function (x) { return FAMILY[g].indexOf(x) >= 0; })) p.types = p.types.filter(function (x) { return x !== g; });
    });
    // "billetera de mano" ya es un tipo: no dejar además "billetera"
    if (p.types.indexOf("wristlet") >= 0 && /billetera de mano/.test(norm(raw))) p.types = p.types.filter(function (x) { return x !== "billetera"; });
    p.has = !!(p.types.length || p.colors.length || p.notColors.length || p.size || p.occ || p.brand || p.details.length || p.max != null || p.min != null || p.minPct != null || p.onSale || p.sort || p.lastMinute || p.shoeSize || p.who);
    return p;
  }

  // seguir la conversación: "y en rojo", "más baratas", "muéstrame más"
  function combinar(p, prev, raw) {
    if (!prev) return p;
    var t = norm(raw); if ((/^(lo|todo|toda|todos|todas|que es lo|algo|otra cosa|ahora busco|ahora quiero)\b/.test(t) || p.occ || p.gift) && !p.more) return p;
    var cont = /^(y|pero|tambien|ahora|mejor|ok|ya|entonces|igual)\b/.test(t);
    var soloAjuste = !p.types.length && !p.occ && !p.free.length && !p.brand;
    if (!(soloAjuste || cont || p.more || p.toUSD || p.toCLP || p.clear.length)) return p;
    if (!p.has && !p.more && !p.toUSD && !p.toCLP && !p.clear.length) return p;
    var m = JSON.parse(JSON.stringify(prev)); m.raw = raw; m.more = p.more; m.unknown = []; m.offset = p.more ? (prev.offset || 0) + (prev.shown || 0) : 0;
    if (p.types.length) { m.types = p.types; m.occ = p.occ; m.details = p.details; m.free = p.free; }
    else { if (p.occ) m.occ = p.occ; if (p.details.length) m.details = p.details; if (p.free.length) m.free = p.free; }
    if (p.colors.length) m.colors = p.colors;
    if (p.notColors.length) m.notColors = p.notColors;
    if (p.size) m.size = p.size;
    if (p.who) m.who = p.who;
    if (p.gift) m.gift = true;
    if (p.brand) m.brand = p.brand;
    if (p.max != null) { m.max = p.max; m.cur = p.cur; m.ambig = p.ambig; }
    if (p.min != null) { m.min = p.min; m.cur = p.cur || m.cur; }
    if (p.minPct != null) m.minPct = p.minPct;
    if (p.onSale) m.onSale = true;
    if (p.sort) m.sort = p.sort;
    if (p.lastMinute) m.lastMinute = true;
    if (p.shoeSize) m.shoeSize = p.shoeSize;
    if (p.toUSD && m.max != null && m.cur === "CLP") { m.max = m.max >= 1000 ? m.max / 1000 : m.max; if (m.min != null) m.min = m.min >= 1000 ? m.min / 1000 : m.min; m.cur = "USD"; m.ambig = false; }
    if (p.toCLP && m.max != null && m.cur === "USD") { m.max = m.max * 1000; if (m.min != null) m.min *= 1000; m.cur = "CLP"; m.ambig = false; }
    p.clear.forEach(function (c) { if (c === "color") { m.colors = []; m.notColors = []; } if (c === "price") { m.max = m.min = null; } if (c === "size") m.size = null; });
    m.has = true; m.followUp = true;
    return m;
  }

  // ---------- Genius: buscar en lo publicado ----------
  var Genius = {};
  var listOf = function (v) { return (Array.isArray(v) ? v : String(v || "").split(",")).map(function (x) { return String(x).trim(); }).filter(Boolean); };
  function ficha(o) {
    if (o.__iah) return o.__iah;
    var title = norm(o.title), hay = norm([o.title, o.product_type, o.brand].join(" "));
    var cols = {}; listOf(o.colors).forEach(function (c) { cols[norm(c)] = c; });
    (Array.isArray(o.photos) ? o.photos : []).forEach(function (ph) { if (ph && ph.caption) cols[norm(ph.caption)] = ph.caption; });
    var types = {}; T.forEach(function (r) { if (r[5] && r[5].test(hay)) types[r[0]] = 1; });
    if (types.billetera || types.monedero || types.tarjetero) { delete types.cartera; if (!/wristlet/.test(hay)) delete types.clutch; }
    if (!/zapat|sandalia|ballerina|mocasin|\bbota|botin/.test(hay)) { delete types.plataforma; delete types.taco; }
    if (types.calzado) { delete types.cartera; delete types.wristlet; }
    if (types.zapatilla) delete types.taco;
    if (types.mochila) delete types.cartera;
    var size = null; Object.keys(SIZE_RX).forEach(function (k) { if (!size && SIZE_RX[k].test(title)) size = k; });
    var disc = Number(o.discount_pct) > 0 && Number(o.tag_price_usd) > 0 ? Number(o.discount_pct) : 0;
    var gender = /^(mujer|hombre|unisex)$/.test(o.gender || "") ? o.gender : (o.category === "RopaHombre" ? "hombre" : /^(Carteras|Lenceria)$/.test(o.category) ? "mujer" : "unisex");
    var f = { title: title, hay: hay, words: hay.split(" "), cols: cols, types: types, size: size, disc: disc, gender: gender, sizes: listOf(o.sizes).map(norm) };
    try { Object.defineProperty(o, "__iah", { value: f, enumerable: false, configurable: true }); } catch (e) {}
    return f;
  }
  var hasType = function (f, id) { return !!f.types[id] || (FAMILY[id] || []).some(function (x) { return f.types[x]; }); };
  var hasColor = function (f, c) { return !!f.cols[norm(c)]; };

  Genius.buscar = function (plan, offers, ctx) {
    ctx = ctx || {};
    var clpOf = ctx.clpOf || function (o) { return Number(o.price_usd) * 950; };
    var all = (offers || []).filter(function (o) { return o && o.status !== "sold" && o.status !== "expired"; });
    var res = { total: 0, items: [], relaxed: [], noType: null, noBrand: null, vocab: null };
    // palabras sueltas: se buscan en los títulos (con tolerancia a errores de tipeo)
    var vocab = {}; all.forEach(function (o) { ficha(o).words.forEach(function (w) { if (w.length > 2) vocab[w] = 1; }); });
    var vkeys = Object.keys(vocab), terms = [], unknown = [];
    (plan.free || []).forEach(function (w) {
      var hit = vocab[w] ? w : vocab[singular(w)] ? singular(w) : null, t = tol(w);
      if (!hit && w.length >= 4) hit = vkeys.filter(function (v) { return v.length >= 4 && (v.indexOf(w) === 0 || w.indexOf(v) === 0); })[0] || null;
      if (!hit && t) { var bd = 9; vkeys.forEach(function (v) { if (v.length < 4) return; var d = dist(w, v, t); if (d < bd) { bd = d; hit = d <= t ? v : hit; } }); }
      if (hit) terms.push(hit); else unknown.push(w);
    });
    (plan.details || []).forEach(function (d) { if (d !== "2x1") terms.push(norm(d)); });
    res.unknown = unknown;

    var types = (plan.types || []).slice();
    var occTypes = plan.occ && OCC[plan.occ] ? OCC[plan.occ][2] : null;
    var byType = function (list, ids) { return list.filter(function (o) { var f = ficha(o); return ids.some(function (id) { return hasType(f, id); }); }); };
    var pool = all;
    if (plan.brand) {
      var nb = norm(plan.brand), bl = pool.filter(function (o) { return norm(o.brand) === nb || norm(o.title).indexOf(nb) >= 0; });
      if (!bl.length) { res.noBrand = plan.brand; } else pool = bl;
    }
    if (types.length) {
      var tl = byType(pool, types);
      if (!tl.length) { res.noType = types; return res; }
      pool = tl;
      if (types.length > 1) { var allT = pool.filter(function (o) { var f = ficha(o); return types.every(function (id) { return hasType(f, id); }); }); if (allT.length) res.both = allT; }
      if (occTypes) { var both = byType(pool, occTypes); if (both.length) { res.noOcc = pool; pool = both; } }
    } else if (occTypes) {
      var ol = byType(pool, occTypes); if (ol.length) pool = ol;
    }
    if (plan.who) { var gl = pool.filter(function (o) { var g = ficha(o).gender; return g === plan.who || g === "unisex"; }); if (gl.length) pool = gl; else res.relaxed.push("who"); }
    if (plan.lastMinute) { var lm = pool.filter(function (o) { return o.last_minute; }); if (lm.length) pool = lm; else res.relaxed.push("lastMinute"); }
    if ((plan.notColors || []).length) {
      // sin un color: sirven los que vienen en algún otro color
      var nl = pool.filter(function (o) { var f = ficha(o), ks = Object.keys(f.cols); return !ks.length || ks.some(function (k) { return plan.notColors.map(norm).indexOf(k) < 0; }); });
      if (nl.length) pool = nl;
    }
    var priceOf = function (o) { return plan.cur === "USD" ? Number(o.price_usd) : clpOf(o); };
    var F = {
      terms: function (l) { return terms.length ? l.filter(function (o) { var f = ficha(o); return terms.every(function (t) { return f.hay.indexOf(t) >= 0; }); }) : l; },
      color: function (l) { return (plan.colors || []).length ? l.filter(function (o) { var f = ficha(o); return plan.colors.some(function (c) { return hasColor(f, c); }); }) : l; },
      size: function (l) { return plan.size ? l.filter(function (o) { return ficha(o).size === plan.size; }) : l; },
      price: function (l) { return l.filter(function (o) { var v = priceOf(o); return (plan.max == null || v <= plan.max) && (plan.min == null || v >= plan.min); }); },
      disc: function (l) { return plan.onSale || plan.minPct != null ? l.filter(function (o) { return ficha(o).disc >= (plan.minPct || 1); }) : l; },
      shoe: function (l) { return plan.shoeSize ? l.filter(function (o) { var s = ficha(o).sizes; return !s.length || s.indexOf(norm(plan.shoeSize)) >= 0; }) : l; },
    };
    var active = ["terms", "color", "size", "price", "disc", "shoe"].filter(function (k) {
      return k === "terms" ? terms.length : k === "color" ? (plan.colors || []).length : k === "size" ? plan.size : k === "price" ? plan.max != null || plan.min != null : k === "disc" ? plan.onSale || plan.minPct != null : !!plan.shoeSize;
    });
    var run = function (keys) { return keys.reduce(function (l, k) { return F[k](l); }, pool); };
    var out = [];
    if (res.both) { var union = pool; pool = res.both; out = run(active); if (!out.length) pool = union; }
    if (!out.length) out = run(active);
    // la ocasión es una preferencia: si deja sin resultados, se suelta antes que el color o el precio
    if (!out.length && res.noOcc) { pool = res.noOcc; out = run(active); if (out.length) res.occDropped = true; }
    // si no hay nada exacto, aflojar de a uno: primero lo menos importante
    var order = ["shoe", "disc", "size", "terms", "color", "price"];
    for (var i = 0; !out.length && i < order.length; i++) {
      if (active.indexOf(order[i]) < 0) continue;
      active = active.filter(function (k) { return k !== order[i]; }); res.relaxed.push(order[i]);
      // color: antes de soltarlo, probar los colores parecidos
      if (order[i] === "color") {
        var near = []; plan.colors.forEach(function (c) { (NEAR[c] || []).forEach(function (x) { if (near.indexOf(x) < 0) near.push(x); }); });
        var nl2 = run(active).filter(function (o) { var f = ficha(o); return near.some(function (c) { return hasColor(f, c); }); });
        if (nl2.length) { out = nl2; res.nearColors = near.filter(function (c) { return nl2.some(function (o) { return hasColor(ficha(o), c); }); }); break; }
      }
      out = run(active);
    }
    if (!out.length) { out = pool; }
    // orden
    var score = function (o) {
      var f = ficha(o), s = 0;
      (plan.colors || []).forEach(function (c, i) { if (hasColor(f, c)) s += 6 - i; });
      terms.forEach(function (t) { if (f.title.indexOf(t) >= 0) s += 4; });
      if (plan.size && f.size === plan.size) s += 3;
      if (occTypes) { var ix = -1; occTypes.forEach(function (id, i) { if (ix < 0 && hasType(f, id)) ix = i; }); if (ix >= 0) s += (occTypes.length - ix) * 0.6; }
      if (types.length) types.forEach(function (id) { if (f.types[id]) s += 2; });
      if (o.featured) s += 0.5;
      return s;
    };
    var num = function (o) { return Number(o.price_usd) || 0; }, cmp;
    if (plan.sort === "asc") cmp = function (a, b) { return num(a) - num(b) || score(b) - score(a); };
    else if (plan.sort === "desc") cmp = function (a, b) { return num(b) - num(a); };
    else if (plan.sort === "disc") cmp = function (a, b) { return ficha(b).disc - ficha(a).disc || num(a) - num(b); };
    else if (plan.sort === "new") cmp = function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); };
    else cmp = function (a, b) { return score(b) - score(a) || ficha(b).disc - ficha(a).disc || num(a) - num(b); };
    if (plan.gift && !plan.sort && plan.max == null) { var c0 = cmp; cmp = function (a, b) { return score(b) - score(a) || num(a) - num(b) || c0(a, b); }; }
    out = out.slice().sort(cmp);
    res.total = out.length; res.items = out; res.terms = terms;
    return res;
  };
  // qué hay publicado, por tipo (para sugerencias honestas)
  Genius.inventario = function (offers) {
    var n = {}; (offers || []).forEach(function (o) { Object.keys(ficha(o).types).forEach(function (k) { n[k] = (n[k] || 0) + 1; }); });
    return n;
  };
  Genius.explicar = function (raw) {
    var t = " " + norm(raw) + " ", hits = [];
    GLOS.forEach(function (g) {
      var ok = String(g[1]).split("|").some(function (chunk, i) { return (i === 0 ? chunk.split(" ") : [chunk]).some(function (k) { k = norm(k); return k && new RegExp("\\b" + k.replace(/[-]/g, "\\$&") + "(s|es)?\\b").test(t); }); });
      if (ok) hits.push(g);
    });
    return hits;
  };

  // ---------- IAH: decidir qué responder ----------
  var say = {
    hola: "Hola, soy IAH. Dime qué buscas con tus palabras: qué producto, en qué color, para quién es o cuánto quieres gastar.",
    quien: "Soy IAH, una inteligencia artificial que te ayuda a encontrar cosas en este mall. Busco solo entre lo que Cheryl tiene publicado, así que todo lo que te muestro existe. Las compras y las dudas puntuales las ve Cheryl en persona.",
    ayuda: "Puedo buscar por producto, color, tamaño, marca, presupuesto, descuento u ocasión. Por ejemplo: \"cartera negra grande para el trabajo\", \"billetera para regalo hasta 100 lucas\" o \"zapatillas blancas\". También te explico qué es un tote, un crossbody o una billetera continental.",
    gracias: "De nada. Si quieres seguir mirando, dime qué más buscas.",
    chao: "Que te vaya muy bien. Aquí quedo cuando quieras seguir buscando.",
    envio: "Cheryl compra en Miami y el pedido viaja a Chile por courier. El precio grande de cada producto ya es un estimado puesto en Chile, con envío y aduana incluidos. El plazo y la forma de entrega te los confirma ella al hacer el pedido.",
    pago: "Para comprar, entra al producto, elige color y agrégalo al carro. Recién ahí la app te pide crear tu cuenta, y el pago se coordina por transferencia con los datos que aparecen en tu pedido.",
    incluye: "El precio grande es un estimado puesto en Chile: precio en la tienda, impuesto de Florida, comisión de la shopper, envío y aduana. El precio chico en dólares es lo que cuesta en la tienda en Miami.",
    original: "Cheryl compra en persona en las tiendas y outlets oficiales de las marcas en Miami, y en cada producto ves en qué tienda lo encontró. Si quieres una foto de la etiqueta o de la boleta, pídesela directo a ella.",
    devolucion: "Los cambios y devoluciones los ve Cheryl caso a caso, porque la compra se hace en Estados Unidos. Escríbele antes de comprar si tienes dudas con el modelo o la talla.",
    contacto: "Para hablar con Cheryl usa el botón de contacto de la app. Yo solo busco productos, ella responde todo lo demás.",
    encargo: "Si no está publicado, puedes dejarle un encargo a Cheryl: le describes lo que buscas y ella lo busca en las tiendas.",
    talla: "En calzado de mujer, la talla de Estados Unidos equivale más o menos así: 5 es 35, 6 es 36, 7 es 37, 8 es 38, 9 es 39 y 10 es 40. Las medias tallas quedan entre medio. Cambia un poco según el modelo, así que confirma con Cheryl antes de comprar.",
    nada: "No te entendí bien. Dime qué producto buscas y, si quieres, el color o cuánto quieres gastar.",
  };
  var FAQ = [
    ["talla", /\b(que talla|conversion|equivale|equivalencia|tabla de tallas|como son las tallas|talla (chilena|americana|usa|us)|horma|tallas? de (ee\.?uu|estados unidos))\b/],
    ["incluye", /\b(incluye|incluido|impuestos?|comision|precio final|puesto en chile|por que (tan )?car|cargos?|que significa el precio|dos precios)\b/],
    ["envio", /\b(envios?|despachos?|demoran?|tarda[n]?|cuando llega|cuanto se demora|llega[n]? a|entregas?|shipping|regiones|retiro|courier|aduana)\b/],
    ["pago", /\b(como (compro|pago|se paga|se compra|comprar|pagar|hago el pedido|pido)|formas? de pago|medios? de pago|transferencia|cuotas|tarjeta de credito|debito|webpay|puedo pagar|se puede pagar)\b/],
    ["original", /\b(original(es)?|autentic[oa]s?|fals[oa]s?|replicas?|truch[oa]s?|imitacion(es)?|garantia|verdader[oa]s?)\b/],
    ["devolucion", /\b(devolucion(es)?|devolver|reembolso|cambiarl[oa]|cambio de|me queda mal|no me queda)\b/],
    ["quien", /\b(quien eres|como te llamas|que eres|eres (un |una )?(robot|bot|persona|humano|humana|ia|inteligencia|real|cheryl)|tu nombre|con quien hablo)\b/],
    ["contacto", /\b(hablar con|whatsapp|wsp|contactar|contacto|telefono|una persona|un humano|asesora|llamar)\b/],
    ["encargo", /\b(encargos?|encargar|me (lo |la )?(consigues|puedes conseguir|pueden conseguir|traes|pueden traer)|pedir algo|no esta publicad|puedes traer|traer de)\b/],
    ["ayuda", /\b(que puedes hacer|que sabes|como funcionas?|para que sirves|ayuda|como te uso|que te puedo (pedir|preguntar)|como busco)\b/],
  ];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var miles = function (n) { return "$" + Math.round(n).toLocaleString("es-CL"); };
  var lista = function (a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " o " + a[a.length - 1]; };

  function describir(plan, n, terms) {
    var det = (plan.details || []).map(norm), tq = (terms || []).filter(function (x) { return det.indexOf(x) < 0; }), td = (terms || []).filter(function (x) { return det.indexOf(x) >= 0; });
    var q = (tq.length ? ' "' + tq.join(" ") + '"' : "") + (td.length ? " con " + td.join(" y ") : "");
    var t = plan.types || [], gen = t.length ? TYPE[t[0]].gen : "m";
    if (!t.length && plan.gift) return (n === 1 ? "idea de regalo" : "ideas de regalo") + (plan.brand ? " " + plan.brand : "") + ((plan.colors || []).length ? " en " + lista(plan.colors.map(function (c) { return (COLOR_SAY[c] || c).toLowerCase(); })) : "") + (plan.who ? (plan.who === "hombre" ? " para hombre" : " para mujer") : "");
    var what = t.length ? lista(t.map(function (id) { return n === 1 ? TYPE[id].uno : TYPE[id].label; })) : n === 1 ? "producto" : "productos";
    var s = what + q;
    if (plan.brand) s += " " + plan.brand;
    if (plan.size) s += " " + ({ grande: n === 1 ? "grande" : "grandes", mediana: gen === "f" ? (n === 1 ? "mediana" : "medianas") : (n === 1 ? "mediano" : "medianos"), pequena: gen === "f" ? (n === 1 ? "pequeña" : "pequeñas") : (n === 1 ? "pequeño" : "pequeños") })[plan.size];
    if ((plan.colors || []).length) s += " en " + lista(plan.colors.map(function (c) { return (COLOR_SAY[c] || c).toLowerCase(); }));
    if ((plan.notColors || []).length) s += " que no " + (n === 1 ? "sea" : "sean") + " " + lista(plan.notColors.map(function (c) { return (COLOR_SAY[c] || c).toLowerCase(); }));
    if (plan.occ) s += " " + OCC[plan.occ][0];
    else if (plan.gift) s += " para regalo";
    if (plan.who && !t.length) s += plan.who === "hombre" ? " para hombre" : " para mujer";
    return s;
  }
  function presupuesto(plan) {
    if (plan.max == null && plan.min == null) return "";
    var f = function (v) { return plan.cur === "USD" ? "US$" + (Math.round(v * 100) / 100) : miles(v); };
    var tail = plan.cur === "USD" ? " en la tienda" : " puesto en Chile";
    if (plan.max != null && plan.min != null) return " entre " + f(plan.min) + " y " + f(plan.max) + tail;
    return (plan.max != null ? " hasta " + f(plan.max) : " desde " + f(plan.min)) + tail;
  }

  // respuesta completa: { text, items, chips, plan }
  function responder(raw, state, offers, ctx) {
    state = state || {}; ctx = ctx || {};
    var t = " " + norm(raw) + " ", out = { text: "", items: [], chips: [], plan: null, total: 0 };
    var inv = Genius.inventario(offers);
    var sugerencias = function () {
      var c = [];
      if (inv.cartera || inv.tote || inv.crossbody) c.push("Carteras negras");
      if (inv.billetera) c.push("Billeteras para regalo");
      if (inv.zapatilla) c.push("Zapatillas blancas");
      if (inv.mochila) c.push("Mochilas");
      c.push("Lo con más descuento");
      return c.slice(0, 4);
    };
    if (!t.trim()) { out.text = say.hola; out.chips = sugerencias(); return out; }
    var p0 = entender(raw), plan = combinar(p0, state.plan, raw);
    var buscaAlgo = p0.types.length || p0.colors.length || p0.brand || p0.occ || p0.size || p0.max != null;

    // 1) glosario: "qué es un tote", "diferencia entre bifold y trifold"
    if (/\b(que es|que son|que significa|que quiere decir|diferencia|como es un|como es una|a que se refiere|para que sirve un|para que sirve una)\b/.test(t)) {
      var g = Genius.explicar(raw);
      if (g.length) {
        out.text = g.slice(0, 2).map(function (x) { return x[2]; }).join("\n\n");
        var ids = g.map(function (x) { return x[0]; }).filter(Boolean);
        if (ids.length) {
          var r0 = Genius.buscar({ types: [ids[0]], free: g[0][0] === "billetera" ? [String(g[0][1]).split(" ")[0]] : [] }, offers, ctx);
          if (r0.total && !r0.noType) { out.items = r0.items.slice(0, 4); out.total = r0.total; out.text += "\n\nDe esos hay " + r0.total + " publicado" + (r0.total === 1 ? "" : "s") + ":"; out.plan = { types: [ids[0]], colors: [], notColors: [], details: [], free: [], shown: out.items.length, offset: 0 }; }
        }
        out.chips = sugerencias().slice(0, 3);
        return out;
      }
    }
    // 2) preguntas de servicio
    for (var i = 0; i < FAQ.length; i++) {
      if (FAQ[i][1].test(t) && !(FAQ[i][0] === "encargo" && buscaAlgo && !/encarg/.test(t))) {
        var k = FAQ[i][0];
        if ((k === "ayuda" || k === "quien") && buscaAlgo) break;
        out.text = say[k];
        out.chips = k === "contacto" ? ["@contacto:Escribirle a Cheryl"] : k === "encargo" ? ["@encargo:Dejar un encargo"] : k === "devolucion" || k === "original" || k === "envio" ? ["@contacto:Escribirle a Cheryl"] : sugerencias().slice(0, 3);
        return out;
      }
    }
    // 3) qué hay / cuántos
    if (!p0.sort && /\b(que (tiendas|hay|venden|tienen|tienes|marcas|productos)|catalogo|que puedo (ver|comprar|encontrar)|muestrame todo|ver todo)\b/.test(t) && !buscaAlgo) {
      var parts = [];
      [["cartera", "carteras", "cartera"], ["billetera", "billeteras", "billetera"], ["mochila", "mochilas", "mochila"], ["tarjetero", "tarjeteros y monederos", "tarjetero"], ["zapatilla", "pares de zapatillas", "par de zapatillas"], ["sandalia", "pares de sandalias", "par de sandalias"], ["ballerina", "pares de ballerinas", "par de ballerinas"]].forEach(function (x) {
        var n = (offers || []).filter(function (o) { return hasType(ficha(o), x[0]) || (x[0] === "tarjetero" && ficha(o).types.monedero); }).length; if (n) parts.push(n + " " + (n === 1 ? x[2] : x[1]));
      });
      out.text = parts.length ? "Hoy hay publicado: " + parts.join(", ") + ". Las demás tiendas del mall abren pronto. Dime qué quieres ver." : "Todavía no hay productos publicados. Puedes dejarle un encargo a Cheryl.";
      out.chips = sugerencias();
      return out;
    }
    // 4) saludo, gracias, despedida (solo si no viene un pedido)
    if (!plan.has && !plan.more) {
      if (/\b(gracias|muchas gracias|te pasaste|genial|perfecto|buenisimo|super|vale|dale)\b/.test(t) && t.trim().split(" ").length <= 4) { out.text = say.gracias; return out; }
      if (/\b(chao|adios|nos vemos|hasta luego|bye|hasta pronto)\b/.test(t)) { out.text = say.chao; return out; }
      if (/\b(hola|holi|holaa+|buenas|buenos dias|buen dia|hello|hi|hey|alo|que tal|como estas)\b/.test(t) && !p0.free.filter(function (w) { return !/^(hola|holi|holaa+|buenas|hello|hey|alo|dias|tardes|noches|estas|iah)$/.test(w); }).length) { out.text = say.hola; out.chips = sugerencias(); return out; }
    }
    // 5) búsqueda
    var r = Genius.buscar(plan, offers, ctx);
    // monto sin moneda: si en pesos no alcanza para nada y en dólares sí, eran dólares
    if (plan.ambig && plan.max != null && r.relaxed.indexOf("price") >= 0) {
      var alt = Object.assign({}, plan, { max: plan.max / 1000, min: plan.min != null ? plan.min / 1000 : null, cur: "USD", ambig: false }), r2 = Genius.buscar(alt, offers, ctx);
      if (r2.total && r2.relaxed.indexOf("price") < 0) { plan = alt; r = r2; plan.guessUSD = true; }
    }
    var entendio = plan.has || r.terms && r.terms.length || plan.more;
    if (!entendio) {
      if (r.unknown.length && (offers || []).length) { out.text = "No encontré nada publicado que se llame \"" + r.unknown.join(" ") + "\". Dime qué tipo de producto es, o deja un encargo y Cheryl lo busca."; out.chips = ["@encargo:Dejar un encargo"].concat(sugerencias().slice(0, 2)); return out; }
      out.text = say.nada; out.chips = sugerencias(); return out;
    }
    out.plan = plan;
    if (r.noBrand && !(plan.types || []).length && !(plan.colors || []).length && !plan.occ && !plan.size && !(r.terms || []).length) {
      out.text = "Todavía no hay productos " + r.noBrand + " publicados. Si quieres, deja un encargo y Cheryl los busca en las tiendas."; out.chips = ["@encargo:Dejar un encargo"].concat(sugerencias().slice(0, 2)); out.plan = null; return out;
    }
    if (r.noBrand) plan = out.plan = Object.assign({}, plan, { brand: null });
    if (r.relaxed.indexOf("who") >= 0) {
      out.text = "Todavía no hay productos para " + plan.who + " publicados: lo que hay hoy es de mujer. Si quieres, deja un encargo y Cheryl lo busca en las tiendas."; out.chips = ["@encargo:Dejar un encargo"].concat(sugerencias().slice(0, 2)); out.plan = null; return out;
    }
    if (r.noType) {
      var names = lista(r.noType.map(function (id) { return TYPE[id].label; }));
      out.text = "Todavía no hay " + names + " publicad" + (TYPE[r.noType[0]].gen === "f" ? "as" : "os") + ". Si quieres, deja un encargo y Cheryl " + (TYPE[r.noType[0]].gen === "f" ? "las" : "los") + " busca en las tiendas.";
      out.chips = ["@encargo:Dejar un encargo"].concat(sugerencias().slice(0, 2)); out.plan = null;
      return out;
    }
    var page = 6, off = plan.more ? (plan.offset || 0) : 0;
    if (off >= r.total) off = 0;
    if (r.relaxed.indexOf("price") >= 0 && !plan.sort) r.items.sort(function (a, b) { return (Number(a.price_usd) || 0) - (Number(b.price_usd) || 0); });
    out.items = r.items.slice(off, off + page); out.total = r.total;
    plan.offset = off; plan.shown = out.items.length;
    if (r.occDropped) plan = out.plan = Object.assign({}, plan, { occ: null });
    var n = r.total, desc = describir(plan, n, r.terms || []), fem = (plan.types || []).length ? TYPE[plan.types[0]].gen === "f" : !!plan.gift;
    var notes = [], head;
    if (r.noBrand) notes.push("Todavía no hay productos " + r.noBrand + " publicados; te muestro lo que hay de otras marcas.");
    var rel = r.relaxed;
    if (plan.more && off > 0) head = "Aquí van " + (out.items.length === 1 ? "otra opción" : "otras " + out.items.length) + " de " + describir(plan, 2) + ".";
    else if (!rel.length) {
      head = (n === 1 ? "Encontré 1 " : "Encontré " + n + " ") + desc + presupuesto(plan) + ".";
      if (n <= out.items.length && n > 1 && plan.sort === "asc") head += " Van de menor a mayor precio.";
      if (n <= out.items.length && n > 1 && plan.sort === "disc") head += " Van de mayor a menor descuento.";
      if (plan.onSale && plan.minPct != null) head = head.replace(/\.$/, " con " + plan.minPct + "% de descuento o más.");
      if (n > out.items.length) head += " Te muestro " + (plan.sort === "asc" ? "l" + (fem ? "a" : "o") + "s más baratos".replace("baratos", fem ? "baratas" : "baratos") : plan.sort === "disc" ? "l" + (fem ? "a" : "o") + "s de mayor descuento" : plan.sort === "desc" ? "l" + (fem ? "a" : "o") + "s más exclusiv" + (fem ? "a" : "o") + "s" : "l" + (fem ? "a" : "o") + "s " + out.items.length + " que mejor calzan") + ".";
    } else {
      var why = [];
      if (rel.indexOf("color") >= 0) why.push(r.nearColors ? "en " + lista(plan.colors.map(function (c) { return (COLOR_SAY[c] || c).toLowerCase(); })) + " (lo más parecido es " + lista(r.nearColors.map(function (c) { return (COLOR_SAY[c] || c).toLowerCase(); })) + ")" : "en " + lista(plan.colors.map(function (c) { return (COLOR_SAY[c] || c).toLowerCase(); })));
      if (rel.indexOf("price") >= 0) why.push("en ese presupuesto");
      if (rel.indexOf("size") >= 0) why.push("en tamaño " + SIZE_SAY[plan.size]);
      if (rel.indexOf("terms") >= 0) why.push("con \"" + r.terms.join(" ") + "\"");
      if (rel.indexOf("disc") >= 0) why.push(plan.minPct != null ? "con " + plan.minPct + "% de descuento" : "con descuento marcado");
      if (rel.indexOf("shoe") >= 0) why.push("con la talla " + plan.shoeSize + " confirmada");
      if (rel.indexOf("who") >= 0) why.push(plan.who === "hombre" ? "para hombre" : "para mujer");
      if (rel.indexOf("lastMinute") >= 0) why.push("de último minuto");
      var base = (plan.types || []).length ? lista(plan.types.map(function (id) { return TYPE[id].label; })) : "productos";
      head = "No hay " + base + " " + why.join(" ni ") + ". Esto es lo más cercano que está publicado:";
      if (rel.indexOf("price") >= 0) { var mn = Math.min.apply(null, r.items.map(function (o) { return plan.cur === "USD" ? Number(o.price_usd) : (ctx.clpOf ? ctx.clpOf(o) : 0); })); if (isFinite(mn) && mn > 0) head += " Parten en " + (plan.cur === "USD" ? "US$" + mn : miles(mn)) + "."; }
    }
    if (plan.guessUSD) notes.push("Tomé el monto como dólares en la tienda.");
    if (plan.ambig && plan.max != null && rel.indexOf("price") < 0) notes.push("Tomé el monto como " + miles(plan.max) + " pesos puesto en Chile.");
    if (plan.shoeSize && rel.indexOf("shoe") < 0 && out.items.some(function (o) { return !ficha(o).sizes.length; })) notes.push("La talla " + plan.shoeSize + " hay que confirmarla con Cheryl: depende de lo que quede en la tienda.");
    if (r.unknown.length && !plan.followUp && !(plan.types || []).length && !plan.occ) notes.push("No reconocí \"" + r.unknown.join(" ") + "\", así que no lo usé para buscar.");
    out.text = [head].concat(notes).join(" ");
    // sugerencias para afinar, según lo que de verdad hay en el resultado
    var chips = [];
    if (plan.ambig && plan.max != null) chips.push("Eran dólares");
    if (plan.guessUSD) { chips.push("Eran pesos"); plan.guessUSD = false; }
    if (n > off + out.items.length) chips.push("Ver más");
    if (!(plan.colors || []).length && n > 3) {
      var cc = {}; r.items.forEach(function (o) { Object.keys(ficha(o).cols).forEach(function (k) { var nm = ficha(o).cols[k]; cc[nm] = (cc[nm] || 0) + 1; }); });
      Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a]; }).filter(function (c) { return c !== "Monograma"; }).slice(0, 2).forEach(function (c) { chips.push("En " + c.toLowerCase()); });
    }
    if (plan.sort !== "asc" && n > 2) chips.push("Más baratas".replace("baratas", fem || !(plan.types || []).length ? "baratas" : "baratos"));
    if (plan.sort !== "disc" && n > 2 && r.items.some(function (o) { return ficha(o).disc; })) chips.push("Con más descuento");
    if (rel.length || n < 3) chips.push("@encargo:Dejar un encargo");
    out.chips = chips.slice(0, 4);
    return out;
  }

  // ---------- pantalla: botón y conversación ----------
  var ui = { open: false, state: {}, log: [], box: null, fab: null };
  var A = function () { return window.MSApp || {}; };
  var offersNow = function () { return (A().state && A().state.offers) || []; };
  var ctxNow = function () { var a = A(); return { clpOf: function (o) { try { return a.quote(o.price_usd, o).clp; } catch (e) { return Number(o.price_usd) * 950; } } }; };
  function card(o) {
    var a = A(), ph = (a.photosOf ? a.photosOf(o)[0] : null) || { url: o.photo_url }, f = ficha(o), price = "";
    try { price = a.clp(a.quote(o.price_usd, o).clp); } catch (e) { price = "US$" + o.price_usd; }
    return '<button type="button" class="iah-card" data-id="' + esc(o.id) + '">' +
      '<span class="iah-ph">' + (ph && ph.url ? '<img src="' + esc(ph.url) + '" alt="" loading="lazy">' : "") + (f.disc ? '<b class="iah-pct">−' + Math.round(f.disc) + "%</b>" : "") + "</span>" +
      '<span class="iah-ct">' + esc(o.title) + '</span><span class="iah-cp">' + esc(price) + '</span><span class="iah-cs">US$' + esc(o.price_usd) + " en tienda</span></button>";
  }
  function paint() {
    if (!ui.box) return;
    var body = ui.box.querySelector(".iah-log");
    body.innerHTML = ui.log.map(function (m) {
      if (m.me) return '<div class="iah-m iah-me">' + esc(m.text) + "</div>";
      return '<div class="iah-m iah-it"><div class="iah-tx">' + esc(m.text).replace(/\n\n/g, "<br><br>") + "</div>" +
        (m.items && m.items.length ? '<div class="iah-cards">' + m.items.map(card).join("") + "</div>" : "") +
        (m.chips && m.chips.length ? '<div class="iah-chips">' + m.chips.map(function (c) { var act = /^@(\w+):(.*)$/.exec(c); return act ? '<button type="button" class="iah-chip iah-act" data-act="' + act[1] + '">' + esc(act[2]) + "</button>" : '<button type="button" class="iah-chip" data-say="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" : "") + "</div>";
    }).join("");
    // solo el último mensaje conserva sus sugerencias activas
    var all = body.querySelectorAll(".iah-chips"); for (var i = 0; i < all.length - 1; i++) all[i].remove();
    body.scrollTop = body.scrollHeight;
  }
  function ask(text) {
    text = String(text || "").trim(); if (!text) return;
    ui.log.push({ me: true, text: text });
    var r = responder(text, ui.state, offersNow(), ctxNow());
    if (r.plan) ui.state.plan = r.plan;
    ui.log.push({ text: r.text, items: r.items, chips: r.chips });
    paint();
  }
  function close() { if (!ui.box) return; ui.box.classList.remove("on"); ui.open = false; document.body.classList.remove("iah-open"); }
  function open() {
    if (!ui.box) {
      var b = document.createElement("div"); b.className = "iah"; b.setAttribute("role", "dialog"); b.setAttribute("aria-modal", "true"); b.setAttribute("aria-label", "IAH, tu guía de compras");
      b.innerHTML = '<div class="iah-back"></div><section class="iah-panel"><header class="iah-head"><span class="iah-logo" aria-hidden="true">IAH</span><div class="iah-hd"><strong>IAH</strong><span>Busca en lo que Cheryl tiene publicado</span></div><button type="button" class="iah-x" aria-label="Cerrar">×</button></header>' +
        '<div class="iah-log" aria-live="polite"></div><form class="iah-form" autocomplete="off"><input class="iah-in" type="text" inputmode="text" enterkeyhint="search" maxlength="200" placeholder="Ej: cartera negra para el trabajo" aria-label="Qué buscas"><button class="iah-go" type="submit">Buscar</button></form></section>';
      document.body.appendChild(b); ui.box = b;
      b.querySelector(".iah-back").onclick = close; b.querySelector(".iah-x").onclick = close;
      b.querySelector(".iah-form").onsubmit = function (e) { e.preventDefault(); var inp = b.querySelector(".iah-in"); ask(inp.value); inp.value = ""; };
      b.addEventListener("click", function (e) {
        var c = e.target.closest ? e.target.closest("[data-say],[data-act],[data-id]") : null; if (!c) return;
        if (c.dataset.say) return ask(c.dataset.say);
        if (c.dataset.act === "encargo") { close(); try { A().go("encargos"); } catch (x) {} return; }
        if (c.dataset.act === "contacto") { try { window.open(A().contactCherylLink(), "_blank", "noopener"); } catch (x) {} return; }
        if (c.dataset.id) { var o = offersNow().filter(function (x) { return String(x.id) === c.dataset.id; })[0]; if (o) { close(); try { A().openOffer(o); } catch (x) {} } }
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ui.open) close(); });
      var first = responder("", ui.state, offersNow(), ctxNow());
      ui.log.push({ text: first.text, chips: first.chips });
    }
    ui.box.classList.add("on"); ui.open = true; document.body.classList.add("iah-open"); paint();
    setTimeout(function () { try { if (window.matchMedia("(min-width:700px)").matches) ui.box.querySelector(".iah-in").focus(); } catch (e) {} }, 60);
  }
  function mount() {
    if (typeof document === "undefined") return;
    var want = !!document.querySelector(".storebar") && !(A().isShopper && A().isShopper()) && !document.querySelector("body > .c3-detail, #sheet-root .backdrop, .lbx");
    if (want && !ui.fab) {
      var f = document.createElement("button"); f.type = "button"; f.className = "iah-fab"; f.setAttribute("aria-label", "Buscar con IAH");
      f.innerHTML = '<span class="iah-fab-i" aria-hidden="true"></span><span>Buscar con IAH</span>';
      f.onclick = open; document.body.appendChild(f); ui.fab = f;
    }
    if (ui.fab) ui.fab.hidden = !want;
  }
  if (typeof document !== "undefined") {
    var start = function () { mount(); var app = document.getElementById("app"); if (app && window.MutationObserver) { var mo = new MutationObserver(function () { clearTimeout(mount.t); mount.t = setTimeout(mount, 120); }); mo.observe(app, { childList: true }); mo.observe(document.body, { childList: true }); var sr = document.getElementById("sheet-root"); if (sr) mo.observe(sr, { childList: true }); } setInterval(mount, 2500); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }

  var api = { entender: entender, combinar: combinar, responder: responder, Genius: Genius, open: open, close: close, norm: norm, TYPE: TYPE };
  if (typeof window !== "undefined") window.MSIAH = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
