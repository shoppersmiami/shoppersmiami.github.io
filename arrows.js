// Flechas a cada lado de los carruseles: muestran que se puede deslizar y permiten avanzar con un toque.
// Cubre: catálogo (#m2track), bolsa (#b3track), barra de tiendas (.storebar-in) y fotos del detalle (.c3-gal).
(function () {
  const CHEV = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}"/></svg>`;
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mkBtn(dir, label) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "car-arrow " + (dir < 0 ? "car-prev" : "car-next");
    b.setAttribute("aria-label", label);
    b.innerHTML = CHEV(dir);
    return b;
  }

  // carrusel con scroll horizontal
  function attachTrack(tr, kind) {
    if (tr.__arrows) return;
    const host = tr.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const L = mkBtn(-1, kind === "shops" ? "Ver tiendas anteriores" : "Anterior");
    const R = mkBtn(1, kind === "shops" ? "Ver más tiendas" : "Siguiente");
    L.classList.add("car-" + kind); R.classList.add("car-" + kind);
    host.appendChild(L); host.appendChild(R);
    const step = () => {
      const c = tr.firstElementChild;
      if (!c) return tr.clientWidth * 0.8;
      const gap = parseFloat(getComputedStyle(tr).columnGap) || 0;
      return kind === "shops" ? Math.max(c.offsetWidth + gap, tr.clientWidth * 0.7) : c.offsetWidth + gap;
    };
    const go = (d) => tr.scrollBy({ left: d * step(), behavior: reduce() ? "auto" : "smooth" });
    L.onclick = (e) => { e.stopPropagation(); go(-1); };
    R.onclick = (e) => { e.stopPropagation(); go(1); };
    const paint = () => {
      if (!tr.isConnected) { L.remove(); R.remove(); return; }
      // en tarjetas de producto: a la altura del centro de la foto (no sobre el precio ni la etiqueta de descuento)
      let top = tr.offsetTop + tr.offsetHeight / 2;
      const im = kind === "cards" && tr.querySelector("img");
      if (im && im.offsetHeight) { const r = im.getBoundingClientRect(), t = tr.getBoundingClientRect(); top = tr.offsetTop + (r.top - t.top) + r.height * 0.42; }
      L.style.top = R.style.top = top + "px";
      L.style.left = Math.max(4, tr.offsetLeft + 4) + "px";
      R.style.left = "auto";
      R.style.right = Math.max(4, host.clientWidth - (tr.offsetLeft + tr.offsetWidth) + 4) + "px";
      const over = tr.scrollWidth > tr.clientWidth + 4;
      const max = tr.scrollWidth - tr.clientWidth - 4;
      L.hidden = R.hidden = !over;
      L.classList.toggle("off", tr.scrollLeft <= 4);
      R.classList.toggle("off", tr.scrollLeft >= max);
    };
    tr.addEventListener("scroll", () => requestAnimationFrame(paint), { passive: true });
    addEventListener("resize", paint);
    tr.__arrows = { paint };
    paint(); setTimeout(paint, 300); setTimeout(paint, 1200);
  }

  // fotos del detalle: flechas sobre la foto grande que pasan a la foto anterior/siguiente
  function attachGallery(gal) {
    if (gal.__arrows) return;
    const stage = gal.parentElement && gal.parentElement.querySelector("#handle");
    const host = stage && stage.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const L = mkBtn(-1, "Foto anterior"), R = mkBtn(1, "Foto siguiente");
    L.classList.add("car-photo"); R.classList.add("car-photo");
    host.appendChild(L); host.appendChild(R);
    const btns = () => [...gal.querySelectorAll("[data-ph]")];
    const cur = () => Math.max(0, btns().findIndex((b) => b.classList.contains("on")));
    const paint = () => { const n = btns().length, i = cur(); L.classList.toggle("off", i <= 0); R.classList.toggle("off", i >= n - 1); };
    const go = (d) => { const b = btns(), i = cur() + d; if (b[i]) { b[i].click(); setTimeout(paint, 50); } };
    L.onclick = (e) => { e.stopPropagation(); go(-1); };
    R.onclick = (e) => { e.stopPropagation(); go(1); };
    gal.addEventListener("click", () => setTimeout(paint, 50));
    new MutationObserver(paint).observe(gal, { subtree: true, attributes: true, attributeFilter: ["class"] });
    gal.__arrows = { paint };
    paint();
  }

  function scan() {
    document.querySelectorAll("#m2track").forEach((t) => attachTrack(t, "cards"));
    document.querySelectorAll("#b3track").forEach((t) => attachTrack(t, "cards"));
    document.querySelectorAll(".storebar-in").forEach((t) => attachTrack(t, "shops"));
    document.querySelectorAll(".c3-gal").forEach(attachGallery);
    document.querySelectorAll("#m2track,#b3track,.storebar-in").forEach((t) => t.__arrows && t.__arrows.paint());
  }
  let q = 0;
  new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; scan(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("load", scan);
  document.readyState !== "loading" ? scan() : addEventListener("DOMContentLoaded", scan);
})();
