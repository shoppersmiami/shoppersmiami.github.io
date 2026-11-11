# Shoppers Miami — cómo ponerla a funcionar

Web app para celular con dos vistas:

- **Clientes (Chile):** catálogo de ofertas del día por categoría, aviso de "en vivo", encargos ("busco bolso Michael Kors hasta US$50"), pedidos, casilla con su número propio y calculadora de precio puesto en Chile.
- **Shopper (tu amiga):** publicar con una foto (la app lee el precio de la etiqueta, detecta la marca y reconoce el tipo de producto), ofertas que vencen solas, encargos agrupados por marca con aviso automático al cliente, registro de paquetes de casilla, estados de pedidos y ajustes (dólar, comisión, envío, IVA, WhatsApp).

Mientras `config.js` no tenga los datos de Supabase, la app funciona en **modo demo**: los datos quedan solo en ese teléfono y arriba hay un botón para cambiar entre Cliente y Shopper.

---

## 1. Base de datos (Supabase) — 10 minutos

1. Entra a supabase.com y crea un proyecto nuevo (región **South America (São Paulo)**).
   - Si te aparece el aviso de facturas vencidas en "Tourmate staging", primero hay que pagarlas: Supabase bloquea proyectos nuevos en toda tu cuenta mientras estén pendientes.
2. En el proyecto: **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y presiona **Run**.
3. En **Project Settings → API** copia:
   - **Project URL** → en `config.js`, `SUPABASE_URL`
   - **anon / publishable key** → en `config.js`, `SUPABASE_ANON_KEY`
4. Cuentas de clientas (correo y contraseña). En Supabase → **Authentication**:
   - **Sign In / Providers → Email**: déjalo **activado** (Enable Email provider). Es lo que usa el pop-up "Crear cuenta / Ya tengo cuenta".
   - **Confirm email** (opcional): si lo **desactivas**, la clienta crea su cuenta y sigue comprando de inmediato. Si lo dejas **activo**, la app le muestra "Revisa tu correo"; ella toca el enlace, vuelve a la app y su carro sigue guardado. Recomendado dejarlo activo si te preocupa que alguien se registre con un correo ajeno.
   - **Minimum password length** (en Providers → Email o en Policies): ponlo en **8**, igual que la app.
   - **URL Configuration → Site URL**: el link de la app (paso 2). Ahí vuelven los enlaces de "confirmar correo" y "¿Olvidaste tu contraseña?". Si usas también una URL de prueba, agrégala en **Redirect URLs**.
   - **Emails → Templates** (opcional): traduce al español los correos "Confirm signup" y "Reset password".

## 2. Publicarla con un link (Netlify, gratis) — 2 minutos

1. Entra a **app.netlify.com/drop** (desde un computador).
2. Arrastra la carpeta completa de la app (la que contiene `index.html`).
3. Netlify te da un link público, por ejemplo `https://mi-shopper.netlify.app`. Ese es el link para tus clientes.
4. Vuelve a Supabase → **Authentication → URL Configuration** y pon ese link en **Site URL**.

Para cambiar el nombre de la app, edita `APP_NAME` en `config.js` y vuelve a arrastrar la carpeta.

### Lista para publicar en Netlify

- [ ] **Qué arrastrar:** la carpeta completa de la app, o el archivo `mi-shopper-miami.zip` (se arma con `tools/make_zip.sh`; trae todo en la raíz, sin archivos de prueba ni `.DS_Store`).
- [ ] **Que vaya la carpeta `mall/`:** son los renders de Blender — `hall.jpg`, `store_XX.jpg`, `thumb_XX.jpg`, las carpetas `walk_fwd/` y `walk_back/` (la caminata) y `mall.json`. Si falta, la app muestra el pasillo dibujado de respaldo. Si el script avisa que `walk_*` pesa más de 60 MB, esas carpetas quedan fuera del zip: arrastra mejor la carpeta.
- [ ] **Supabase:** `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `config.js` (paso 1). Sin ellas la app queda en modo demo.
- [ ] **`APP_URL`:** cuando Netlify te dé el link definitivo, ponlo en `config.js` (ej: `APP_URL: "https://mi-shopper.netlify.app/"`) y vuelve a arrastrar la carpeta. Es el link que va en los mensajes de WhatsApp.
- [ ] **Site URL** en Supabase con ese mismo link (punto 4 de arriba).
- [ ] **Probar en el teléfono:** abrir el link, entrar, sacar una foto en Publicar (pide permiso de cámara) e instalarla en la pantalla de inicio.

`netlify.toml` y `_headers` ya vienen listos: publican la carpeta tal cual, guardan en caché por un año los renders (`mall/`) y las tipografías, y hacen que `index.html`, `config.js`, `app.js` y `styles.css` se revisen siempre. Si vuelves a renderizar el mall con los **mismos nombres de archivo**, los teléfonos que ya lo vieron pueden seguir mostrando las imágenes viejas: conviene renderizar con nombres nuevos (por ejemplo `hall_2.jpg`, `walk_fwd_2/`) y que `mall.json` apunte a ellos (`hall`, `image`, `thumb`, `fwd_dir`, `back_dir`).

## 3. Convertir a tu amiga en shopper

1. Ella abre el link y crea su cuenta como cualquier cliente (Menú → Entrar o crear cuenta → Crear cuenta).
2. En Supabase → SQL Editor, ejecuta (con su correo):

```sql
update public.profiles set role = 'shopper'
where id = (select id from auth.users where email = 'CORREO-DE-ELLA@ejemplo.com');
```

3. Ella cierra y vuelve a abrir la app: ahora ve las pestañas Publicar, Ofertas, Encargos, Pedidos y Ajustes.
4. Lo primero: **Ajustes** → dólar, comisión, envío por libra, dirección de la casilla, instrucciones de pago y su WhatsApp.

## Cuentas de clientas: cómo funciona

- Cualquiera puede recorrer el mall y llenar su **carro** sin cuenta. El botón del carro (arriba) abre la página "Tu carro": ahí se suman o restan unidades, se quita lo que no quiera, se paga a medias con una amiga y se toca **Comprar**.
- Al tocar **Comprar** sin sesión aparece el pop-up con dos pestañas: **Crear cuenta** (nombre, correo, contraseña de al menos 8 caracteres y aceptar términos) y **Ya tengo cuenta** (correo y contraseña, con "¿Olvidaste tu contraseña?"). El teléfono ofrece guardar la contraseña.
- Al crear la cuenta o entrar, el pop-up se cierra y la compra sigue sola: aparecen los datos de envío ya con su nombre y correo; si su ficha ya tenía todo, la compra se confirma directo. El carro no se pierde.
- Al registrarse se crea su **ficha de clienta (N° MSM)** con el mismo correo de la cuenta (trigger `handle_new_user` en `schema.sql`). Si tú ya la tenías anotada con ese correo, se le asocia esa misma ficha.
- La sesión queda guardada en el teléfono: al volver a abrir la app sigue reconocida. En **Menú → Mi cuenta** ve su nombre, correo y N° MSM, y puede **Cambiar contraseña** o **Cerrar sesión**. Sin sesión, el menú muestra **Entrar o crear cuenta**.
- Tú (la shopper) entras igual: Menú → Entrar o crear cuenta → Ya tengo cuenta.
- **Modo demo** (sin Supabase): las cuentas se simulan en el teléfono (contraseña guardada como hash SHA-256 con sal). Vienen listas `cliente@demo` y `shopper@demo`, ambas con contraseña `demo1234`; la Clienta Demo ya tiene la sesión iniciada. "¿Olvidaste tu contraseña?" solo muestra un aviso.

## 4. Instalarla en el teléfono

- **iPhone (Safari):** botón Compartir → "Agregar a pantalla de inicio".
- **Android (Chrome):** menú ⋮ → "Agregar a la pantalla principal".

---

## El mall virtual (lo que ve el cliente)

1. **Inicio:** el pasillo del mall al aire libre (render de Blender a escala real, en la carpeta `mall/`). Abajo, siempre visible, la **botonera de tiendas** con las **10 tiendas del mall 3D**, en el mismo orden y con los mismos nombres que sus letreros: 01 Carteras, 02 Zapatos, 03 Ropa Deportiva, 04 Relojes y Joyas, 05 Lencería, 06 Ropa Invierno, 07 Ropa Mujer, 08 Ropa Hombre, 09 Ofertas (último minuto) y 10 Outlet.
2. **Elegir una tienda:** la app reproduce la **caminata real** por el pasillo (cuadros renderizados) y llega a la **vitrina** de esa tienda, con sus 2 mejores ofertas pegadas en el vidrio y el botón **Entrar**.
3. **Entrar:** lleva directo al **mostrador** con todo el inventario de la tienda, un producto por pantalla con **scroll lateral**, y orden por precio (mayor a menor, menor a mayor), descuento o novedad, más filtros de precio, color, talla y marca.
4. **Cambiar de tienda:** desde la botonera; se camina por el pasillo hasta la otra vitrina.
5. **Ver un producto:** se gira, se acerca y se ven sus fotos; se elige color, talla y cantidad y se **agrega a la bolsa**.
6. **La caja:** desde la bolsa, "Ir a la caja" llega donde atiende **Cheryl** con la boleta, los **datos para la transferencia**, la orden por WhatsApp/PDF y la subida del comprobante.

Qué vende cada tienda: Relojes y Joyas junta relojes y joyas; Ropa Mujer y Ropa Hombre ya definen el género (no se pregunta al entrar ni al publicar; la ropa unisex va en Ropa Mujer); Ofertas muestra las ofertas de último minuto de todas las tiendas (el nombre se cambia en `tiendas.js`, `NOMBRE_OFERTAS`, por ejemplo a "Liquidación"). Claves, orden, links `#s-01`…`#s-10` y la migración están en `tiendas.js`; el mapeo con las vitrinas 3D en `mall/v2/tiendas.json`. Outlet junta perfumes, lentes, maquillaje, juguetes, hogar, tecnología y "otros". Si no existe la carpeta `mall/`, la app usa el pasillo dibujado de respaldo.

Para tu amiga:
- Al publicar elige **colores** y escribe las **tallas**; puede marcar **⚡ Oferta de último minuto** (también desde Ofertas).
- En **Ajustes → La caja**: foto y nombre de la cajera y los datos bancarios.
- En **Ajustes → El mall virtual**: fotos reales del pasillo y de cada fachada para que se vea como el mall de verdad.

## Fotos adicionales y medidas

- **Galería:** la primera foto es la de la etiqueta. Después de publicar aparece **"Agregar más fotos"** para subir vistas laterales, de atrás u otros colores, cada una con su nombre ("Negro", "Lateral"). También se pueden agregar después desde **Ofertas → 📷 Fotos**. El cliente las ve en un carrusel.
- **Medidas con la tarjeta:** al sacar la foto, poner una tarjeta del tamaño de una tarjeta de crédito (8,56 × 5,4 cm) **pegada a la cara del producto**, y sacar la foto de frente. Luego, en **📏 Medir**: tocar los 2 extremos del lado largo de la tarjeta y arrastrar el dedo sobre el producto. La app calcula ancho y alto; la profundidad se escribe a mano si se quiere. El cliente ve "Medidas aprox.".
- El peso y la caja para el envío salen solos de la base de pesos promedio según el tipo de producto (botón **Ajustar** si hace falta).

## Cómo funciona el reconocimiento de fotos

Todo corre en el teléfono, gratis, sin pagar por foto:

- **Precio y marca:** Tesseract.js lee el texto de la etiqueta. Si hay varios precios (por ejemplo "Compare at $89.00" y "$39.99"), propone el más bajo y muestra los demás para tocar el correcto.
- **Tipo de producto:** un modelo de código abierto (CLIP) clasifica la foto en cartera, zapatos, reloj, perfume, ropa, etc.
- La **primera vez** descarga los modelos (unos 100 MB en total; mejor con WiFi). Después quedan guardados en el teléfono.
- Si algo no se reconoce, ella lo corrige a mano antes de publicar.

## Cálculo del precio puesto en Chile

Precio + impuesto de Florida + comisión (con mínimo) + envío por libra + arancel + IVA, convertido a pesos y redondeado a la centena. Todos los porcentajes se cambian en Ajustes. Desde el 25 de octubre de 2025 todas las compras internacionales pagan IVA del 19% en Chile; conviene confirmar el arancel con el courier.

## Lo que queda para una segunda versión

- **Pagos dentro de la app** (Mercado Pago / Flow): hoy el cliente paga por transferencia y ella marca el pedido como pagado.
- **Notificaciones push al teléfono:** hoy los avisos aparecen en la campanita al abrir la app.

## Créditos del mall 3D

- Texturas, plantas, sofás y cielo: [Poly Haven](https://polyhaven.com) (CC0, dominio público).
- Modelos de muestra Khronos glTF (zapatillas, reloj, lentes, maniquí, florero, planta, faroles, sofá de terciopelo, sillón, puf): repositorio KhronosGroup/glTF-Sample-Assets. Varios son CC-BY 4.0 y piden atribución: MaterialsVariantsShoe (Shopify), GlamVelvetSofa, GlassHurricaneCandleHolder y SpecularSilkPouf (Wayfair), DiffuseTransmissionPlant y SheenWoodLeatherSofa (Darmstadt Graphics Group). Corset, Lantern, GlassVaseFlowers y otros son CC0.
- Tipografías: Bodoni Moda y Jost (SIL Open Font License).
- Render: Blender 5.2 (Cycles). Escena, letras LED, palmeras y productos modelados por código en `blender/`.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | La app |
| `config.js` | Nombre de la app y datos de Supabase |
| `supabase/schema.sql` | Tablas, seguridad y fotos para Supabase |
| `cuentas.js`, `cuentas.css` | Cuentas de clientas: pop-up Crear cuenta / Ya tengo cuenta, sesión, Mi cuenta |
| `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Ícono y modo app al instalarla en el teléfono |
| `mall/` | Renders de Blender del mall virtual (`mall.json`, fotos y cuadros de la caminata) |
| `netlify.toml`, `_headers` | Configuración de Netlify (publicación, caché y seguridad) |
