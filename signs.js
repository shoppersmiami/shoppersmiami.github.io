// =====================================================================
// signs.js — Letreros de tienda dibujados sobre la fachada 3D (no se rehace el modelo):
// tapa el letrero horneado de la vitrina y pone el nombre nuevo con las mismas letras bronce.
// Hoy: tienda 01 (clave "Carteras") → "MICHAEL KORS".
// =====================================================================
(function () {
  "use strict";
  var SIGNS = {
    S01: { title: "MICHAEL KORS", sub: "BOLSOS  ·  ACCESORIOS" },
  };
  // Medidas en metros sobre la fachada (ajustadas al render): centro vertical, ancho, alto, separación del vidrio
  var GEO = { y: 4.56, w: 3.5, h: 0.86, off: 0.6, dz: 2.5 };
  var q = location.search.match(/signs-geo=([-\d.,]+)/); if (q) { var v = q[1].split(",").map(Number); GEO.y = v[0]; GEO.w = v[1]; GEO.h = v[2]; GEO.off = v[3]; GEO.dz = v[4] || 0; }
  var TEST = /signs-test/.test(location.search);

  function draw(sign) {
    var c = document.createElement("canvas"); c.width = 2048; c.height = Math.round(2048 * GEO.h / GEO.w);
    var g = c.getContext("2d"), W = c.width, H = c.height;
    g.fillStyle = TEST ? "rgba(255,0,0,.55)" : "#160f07"; g.fillRect(0, 0, W, H);
    var fam = '"Bodoni Moda", "Didot", "Times New Roman", serif';
    var bronze = g.createLinearGradient(0, H * 0.18, 0, H * 0.72);
    bronze.addColorStop(0, "#e7cfa3"); bronze.addColorStop(0.45, "#c4a273"); bronze.addColorStop(1, "#8f6f45");
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    var size = H * 0.46; g.font = "500 " + size + "px " + fam;
    try { g.letterSpacing = Math.round(size * 0.08) + "px"; } catch (_) {}
    while (g.measureText(sign.title).width > W * 0.9) { size *= 0.95; g.font = "500 " + size + "px " + fam; }
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 6; g.shadowOffsetY = 3;
    g.fillStyle = bronze; g.fillText(sign.title, W / 2, H * 0.6);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    var s2 = H * 0.105; g.font = "500 " + s2 + "px Jost, Helvetica, Arial, sans-serif";
    try { g.letterSpacing = Math.round(s2 * 0.45) + "px"; } catch (_) {}
    g.fillStyle = "#b99a6c"; g.fillText(sign.sub, W / 2, H * 0.84);
    return c;
  }

  window.MSSigns = {
    GEO: GEO, SIGNS: SIGNS,
    apply: function (e, T) {
      if (!e || !e.scene) { console.warn("MSSigns: sin escena"); return; }
      if (TEST) console.warn("MSSigns.apply", Object.keys(SIGNS).join(","));
      if (e.__msSigns) { e.__msSigns.forEach(function (m) { e.scene.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); }); }
      e.__msSigns = [];
      Object.keys(SIGNS).forEach(function (id) {
        var st = T.store(id); if (!st) return;
        var tex = new T.CanvasTexture(draw(SIGNS[id])); tex.colorSpace = T.SRGB; tex.anisotropy = 8;
        var m = new T.Mesh(new T.PlaneGeometry(GEO.w, GEO.h), new T.MeshBasicMaterial({ map: tex, side: T.FrontSide, toneMapped: false, transparent: TEST }));
        m.position.set(st.side * (6.045 - GEO.off), GEO.y, -st.y + GEO.dz);
        m.rotation.y = st.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        m.name = "letrero-" + id;
        e.scene.add(m); e.__msSigns.push(m);
        if (document.fonts && document.fonts.load) document.fonts.load('500 40px "Bodoni Moda"').then(function () { tex.image = draw(SIGNS[id]); tex.needsUpdate = true; });
      });
    },
  };
})();
