// =====================================================================
// install.js — Botón grande "Descargar app Shoppers".
//  · Android / Chrome / Edge: usa el aviso de instalación del navegador (beforeinstallprompt).
//  · iPhone / iPad: Safari no tiene ese aviso, así que el botón abre los 3 pasos
//    (Compartir → Agregar a pantalla de inicio → Agregar).
//  · No aparece si ya se abrió como app instalada, ni por 3 días si la clienta lo cierra.
// =====================================================================
(function () {
  "use strict";
  var KEY = "ps_install_dismiss";
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var deferred = null;

  function dismissed() { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 3 * 864e5; } catch (e) { return false; } }
  function hide(remember) {
    var b = document.getElementById("ins-bar"); if (b) b.remove();
    if (remember) try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }
  var ICON_DL = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
  var ICON_SHARE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var ICON_PLUS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function show() {
    if (standalone || dismissed() || document.getElementById("ins-bar")) return;
    var bar = document.createElement("div");
    bar.id = "ins-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Descargar la app");
    bar.innerHTML = '<button type="button" class="ins-go">' + ICON_DL + '<span>Descargar app Shoppers</span></button>' +
      '<button type="button" class="ins-x" aria-label="Cerrar">×</button>';
    document.body.appendChild(bar);
    bar.querySelector(".ins-x").onclick = function () { hide(true); };
    bar.querySelector(".ins-go").onclick = async function () {
      if (deferred) {
        deferred.prompt();
        try { var r = await deferred.userChoice; if (r && r.outcome === "accepted") hide(false); } catch (e) {}
        deferred = null; return;
      }
      iosSteps();
    };
  }

  function iosSteps() {
    var safari = isIOS && !/CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV|WhatsApp/i.test(ua);
    var inApp = /Instagram|FBAN|FBAV|WhatsApp|GSA/i.test(ua);
    var steps = isIOS
      ? (inApp ? '<p class="ins-note">Primero abre este link en <b>Safari</b>: toca los tres puntos o el ícono de compartir y elige "Abrir en Safari".</p>' : (safari ? "" : '<p class="ins-note">Si no ves la opción, abre este link en <b>Safari</b>.</p>')) +
        '<ol class="ins-steps"><li>' + ICON_SHARE + '<span>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba, abajo o arriba de la pantalla).</span></li>' +
        '<li>' + ICON_PLUS + '<span>Baja y toca <b>Agregar a pantalla de inicio</b>.</span></li>' +
        '<li>' + ICON_DL + '<span>Toca <b>Agregar</b>. El ícono de Shoppers Miami queda en tu pantalla como una app.</span></li></ol>'
      : '<ol class="ins-steps"><li>' + ICON_SHARE + '<span>Abre el menú del navegador (los tres puntos).</span></li>' +
        '<li>' + ICON_PLUS + '<span>Toca <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.</span></li></ol>';
    var html = '<h2>Descargar app Shoppers</h2>' + steps +
      '<button type="button" class="btn gold block" data-close style="margin-top:14px">Entendido</button>';
    if (window.MSApp && window.MSApp.sheet) return window.MSApp.sheet(html, function () {});
    var d = document.createElement("div"); d.className = "ins-modal"; d.innerHTML = '<div class="ins-card">' + html + "</div>";
    d.onclick = function (e) { if (e.target === d || e.target.hasAttribute("data-close")) d.remove(); };
    document.body.appendChild(d);
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; show(); });
  window.addEventListener("appinstalled", function () { hide(false); });
  // iPhone: no hay aviso del navegador → mostramos el botón igual (abre los pasos)
  if (isIOS && !standalone) window.addEventListener("load", function () { setTimeout(show, 2500); });
  window.MSInstall = { show: show, steps: iosSteps };
})();
