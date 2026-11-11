// Ajustes de layout del lado clienta:
// - el selector demo Cliente/Shopper pasa a un costado de la barra de tiendas (se quitará al lanzar)
// - en el catálogo, "Más filtros" va dentro del área del producto
(function () {
  function run() {
    const body = document.body;
    // selector demo al costado de la barra de tiendas (en la vitrina sigue flotando arriba a la izquierda)
    const sb = document.querySelector(".storebar"), bar = document.querySelector(".demo-bar");
    if (sb && bar && !body.classList.contains("vit-mode")) {
      const seg = bar.querySelector(".seg");
      if (seg && !sb.contains(seg)) { sb.insertBefore(seg, sb.firstChild); sb.classList.add("sb-has-demo"); }
      bar.classList.add("demo-moved");
    }
    // "Más filtros" va dentro del detalle del producto (donde se ven colores y tallas):
    // en la barra del detalle, al tocarlo vuelve al catálogo y abre los filtros
    document.querySelectorAll(".c3-dbar").forEach((db) => {
      if (db.querySelector(".c3-dfilt") || !document.querySelector(".c3 #filt")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn sm ghost c3-dfilt"; b.textContent = "Más filtros";
      b.onclick = () => {
        const back = db.querySelector(".c3-back"); if (back) back.click();
        setTimeout(() => { const f = document.querySelector(".c3 #filt"); if (f) f.click(); }, 450);
      };
      db.appendChild(b);
    });
  }
  let q = 0;
  new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; run(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  document.readyState !== "loading" ? run() : addEventListener("DOMContentLoaded", run);
})();
