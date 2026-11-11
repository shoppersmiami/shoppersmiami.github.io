// Pantalla de bienvenida: la app se abre recién cuando el mall 3D está cargado.
// Precarga (en la caché del navegador) los archivos que el recorrido 3D necesita para partir,
// muestra el avance real en una barra y luego hace un fundido al pasillo.
(function () {
  if (window.__splash) return; window.__splash = 1;
  if (navigator.webdriver || /[?&]nosplash/.test(location.search)) return;   // pruebas automáticas
  const BASE = "mall/three-hd-v19/";
  const name = (window.APP_CONFIG && window.APP_CONFIG.APP_NAME) || "Shoppers Miami";
  const hasGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  const el = document.createElement("div");
  el.id = "splash"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
  el.innerHTML = `<div class="sp-card"><span class="sp-hello">Bienvenida a</span><h1 class="sp-name"></h1>
    <div class="sp-bar" aria-hidden="true"><i></i></div><p class="sp-msg">Abriendo las puertas del mall…</p>
    <button type="button" class="sp-skip" hidden>Entrar sin esperar</button></div>`;
  el.querySelector(".sp-name").textContent = name;
  const mount = () => document.body ? document.body.prepend(el) : requestAnimationFrame(mount);
  mount();
  document.documentElement.classList.add("splash-on");
  const bar = el.querySelector(".sp-bar i"), msg = el.querySelector(".sp-msg"), skip = el.querySelector(".sp-skip");
  let done = false, shown = 0;
  const paint = (p) => { shown = Math.max(shown, Math.min(1, p)); bar.style.width = (shown * 100).toFixed(1) + "%"; msg.textContent = shown < 1 ? `Cargando el mall… ${Math.round(shown * 100)}%` : "¡Listo!"; };
  const close = () => {
    if (done) return; done = true; paint(1);
    setTimeout(() => { el.classList.add("out"); document.documentElement.classList.remove("splash-on"); setTimeout(() => el.remove(), 900); }, 250);
  };
  skip.onclick = close;
  setTimeout(() => { if (!done) skip.hidden = false; }, 20000);
  setTimeout(close, 120000);   // tope de seguridad: nunca dejar a la clienta afuera
  if (!hasGL) { paint(1); setTimeout(close, 900); return; }

  async function fetchAll(list, onBytes) {
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const [u] = list[i++];
        try {
          const r = await fetch(BASE + u, { cache: "force-cache" });
          if (!r.body) { await r.arrayBuffer(); onBytes(0, u); continue; }
          const rd = r.body.getReader();
          for (;;) { const { done: d, value } = await rd.read(); if (d) break; onBytes(value.byteLength); }
        } catch (e) { /* si falla un archivo, el recorrido lo pedirá de nuevo */ }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }
  (async () => {
    let m;
    try { m = await (await fetch(BASE + "preload.json", { cache: "no-cache" })).json(); } catch (e) { paint(1); return close(); }
    const total = m.base.reduce((s, x) => s + x[1], 0) || 1; let got = 0;
    // pequeño avance inicial para que la barra se vea viva desde el primer instante
    paint(0.03);
    await fetchAll(m.base, (b) => { got += b; paint(0.03 + 0.97 * (got / total)); });
    close();
    // la versión de alta definición sigue cargando en segundo plano
    const mobile = innerWidth < 768 || matchMedia("(pointer:coarse)").matches;
    fetchAll(mobile ? m.mobile : m.desktop, () => {});
  })();
})();
