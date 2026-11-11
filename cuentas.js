// Shoppers Miami — cuentas de clienta (correo + contraseña).
//
//  · Se puede recorrer el mall y llenar el carro sin cuenta ("invitada").
//  · Al tocar "Comprar" en el carro (#confirm de la caja), si no hay sesión aparece el pop-up
//    con "Crear cuenta" / "Ya tengo cuenta". Al terminar, el pop-up se cierra y la compra sigue sola:
//    datos de envío (clientes.js) ya prellenados con nombre y correo, y luego confirmar.
//  · La sesión queda guardada: al volver a abrir la app la clienta sigue reconocida.
//  · "Mi cuenta" muestra su nombre, correo y N° MSM, con "Cambiar contraseña" y "Cerrar sesión".
//
// Modo demo (sin Supabase): las cuentas viven en localStorage (base ps_demo_v5): db.accounts guarda
// el correo y el hash SHA-256 con sal de la contraseña (nunca la contraseña); db.me es la sesión.
// La "Clienta Demo" ya viene registrada (cliente@demo / demo1234) y con sesión iniciada, igual que
// la shopper (shopper@demo / demo1234).
// Supabase: auth.signUp / signInWithPassword / resetPasswordForEmail / updateUser / signOut.
// La ficha de clienta (customers, N° MSM) la crea el trigger handle_new_user al registrarse.
(function () {
  "use strict";
  var A = function () { return window.MSApp || {}; };
  var S = function () { return A().state || {}; };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var toast = function (m) { (A().toast || console.log)(m); };
  var MIN_PW = 8;
  var LAST_EMAIL = "ms_last_email";
  var GUEST = { id: "guest", role: "client", full_name: "", phone: "", email: "", locker_code: "", guest: true };
  var guestProfile = function () { return Object.assign({}, GUEST); };
  var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); };
  var normEmail = function (v) { return String(v || "").trim().toLowerCase(); };
  var firstName = function (n) { return String(n || "").trim().split(/\s+/)[0] || ""; };

  // ---------------------------------------------------------------------------
  // SHA-256 (crypto.subtle; si el navegador no lo ofrece —p. ej. http en la red local— versión en JS)
  // ---------------------------------------------------------------------------
  function sha256js(str) {
    var bytes = Array.from(new TextEncoder().encode(str)), K = [], H = [], i, j;
    var isPrime = function (n) { for (var f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
    for (var c = 2, n = 0; n < 64; c++) if (isPrime(c)) { if (n < 8) H[n] = (Math.pow(c, 1 / 2) * 4294967296) | 0; K[n++] = (Math.pow(c, 1 / 3) * 4294967296) | 0; }
    var l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
    var rotr = function (x, r) { return (x >>> r) | (x << (32 - r)); };
    for (i = 0; i < bytes.length; i += 64) {
      var w = [], a = H.slice(0);
      for (j = 0; j < 64; j++) {
        if (j < 16) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
        else { var x = w[j - 15], y = w[j - 2]; w[j] = (w[j - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[j - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10))) | 0; }
        var t1 = (a[7] + (rotr(a[4], 6) ^ rotr(a[4], 11) ^ rotr(a[4], 25)) + ((a[4] & a[5]) ^ (~a[4] & a[6])) + K[j] + w[j]) | 0;
        var t2 = ((rotr(a[0], 2) ^ rotr(a[0], 13) ^ rotr(a[0], 22)) + ((a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]))) | 0;
        a = [(t1 + t2) | 0].concat(a.slice(0, 7)); a[4] = (a[4] + t1) | 0;
      }
      for (j = 0; j < 8; j++) H[j] = (H[j] + a[j]) | 0;
    }
    return H.map(function (h) { return ("00000000" + (h >>> 0).toString(16)).slice(-8); }).join("");
  }
  async function sha256hex(str) {
    try {
      if (window.crypto && crypto.subtle) {
        var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      }
    } catch (e) {}
    return sha256js(str);
  }
  var hashPw = function (salt, pw) { return sha256hex(salt + ":" + pw); };
  var newSalt = function () { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); };

  // Carro de invitada → carro de la cuenta (cartKey de app.js: "ps_cart_" + id)
  function mergeGuestCart(id) {
    if (!id || id === GUEST.id) return;
    try {
      var g = JSON.parse(localStorage.getItem("ps_cart_guest") || "[]");
      if (!Array.isArray(g) || !g.length) return;
      var mine = JSON.parse(localStorage.getItem("ps_cart_" + id) || "[]"); if (!Array.isArray(mine)) mine = [];
      g.forEach(function (x) {
        var same = mine.find(function (y) { return y.offer_id === x.offer_id && y.color === x.color && y.size === x.size && !y.promo && !x.promo; });
        if (same) same.qty += x.qty; else mine.push(x);
      });
      localStorage.setItem("ps_cart_" + id, JSON.stringify(mine));
      localStorage.removeItem("ps_cart_guest");
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Modo demo: cuentas simuladas en localStorage
  // ---------------------------------------------------------------------------
  var DEMO_ACCOUNTS = [
    { user_id: "client-1", email: "cliente@demo", salt: "ms-demo-c1", hash: "3c63599ee81007c2d0a7cc7744de18694722d781108778c82b1f7ea024d47dde" },
    { user_id: "shopper-1", email: "shopper@demo", salt: "ms-demo-s1", hash: "347a09c74660bf05b4d27115ac4d2b92e9bc3c6ecffb1a5c39384e5a8b27b392" },
  ];
  function extendLocal(api, db, save) {
    var ch = false;
    if (!Array.isArray(db.accounts)) {   // primera vez: Clienta Demo y la shopper ya registradas; la sesión sigue siendo db.me
      db.accounts = DEMO_ACCOUNTS.filter(function (a) { return db.profiles.some(function (p) { return p.id === a.user_id; }); }).map(function (a) { return Object.assign({ created_at: new Date().toISOString() }, a); });
      ch = true;
    }
    if (db.last_client === undefined) { db.last_client = "client-1"; ch = true; }
    if (ch) save();
    var prof = function (id) { return db.profiles.find(function (p) { return p.id === id; }); };
    var acc = function (id) { return db.accounts.find(function (a) { return a.user_id === id; }); };
    var login = function (id) { db.me = id; if ((prof(id) || {}).role === "client") db.last_client = id; save(); mergeGuestCart(id); };
    Object.assign(api, {
      async session() {
        var p = prof(db.me);
        if (!p) return { user: null, profile: guestProfile() };
        mergeGuestCart(p.id);
        return { user: { id: p.id, email: (acc(p.id) || {}).email || p.email }, profile: p };
      },
      // botones Cliente / Shopper del modo demo: "Cliente" vuelve a la última clienta con sesión (o invitada)
      async switchRole(role) {
        if (role === "shopper") { if ((prof(db.me) || {}).role === "client") db.last_client = db.me; db.me = "shopper-1"; }
        else if ((prof(db.me) || {}).role !== "client") db.me = db.last_client && prof(db.last_client) ? db.last_client : GUEST.id;
        save();
      },
      async signIn(email, password) {
        var a = db.accounts.find(function (x) { return x.email === normEmail(email); });
        if (!a || (await hashPw(a.salt, password)) !== a.hash || !prof(a.user_id)) throw new Error("Invalid login credentials");
        login(a.user_id);
      },
      async signUp(email, password, full_name) {
        email = normEmail(email);
        if (db.accounts.some(function (x) { return x.email === email; })) throw new Error("User already registered");
        var seq = db.profiles.reduce(function (m, p) { return Math.max(m, Number(String(p.locker_code || "").replace(/\D/g, "")) || 0); }, 1000) + 1;
        var id = "client-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
        var p = { id: id, full_name: String(full_name || "").trim(), phone: "", role: "client", locker_code: "CL" + seq, email: email };
        var salt = newSalt();
        db.profiles.push(p);
        db.accounts.push({ user_id: id, email: email, salt: salt, hash: await hashPw(salt, password), created_at: new Date().toISOString() });
        try { window.MSClientes && window.MSClientes.accountFicha && window.MSClientes.accountFicha(db, p); } catch (e) { console.warn("Ficha", e); }
        login(id);
        return true;
      },
      async signOut() { db.me = GUEST.id; db.last_client = null; save(); },
      async resetPassword() { return { demo: true }; },
      async updatePassword(newPw, currentPw) {
        var a = acc(db.me); if (!a) throw new Error("Debes iniciar sesión");
        if ((await hashPw(a.salt, currentPw)) !== a.hash) throw new Error("La contraseña actual no es correcta");
        a.salt = newSalt(); a.hash = await hashPw(a.salt, newPw); a.updated_at = new Date().toISOString(); save();
      },
      async accountEmail() { var a = acc(db.me); return a ? a.email : ""; },
    });
    return api;
  }

  // ---------------------------------------------------------------------------
  // Supabase Auth
  // ---------------------------------------------------------------------------
  function extendSupabase(api, sb) {
    var ok = function (r) { if (r.error) throw new Error(r.error.message); return r.data; };
    var back = function () { return location.href.split("#")[0]; };
    var base = api.session;
    Object.assign(api, {
      async session() {
        var s = null;
        try { s = await base(); } catch (e) { console.warn("Sesión", e); }
        if (!s || !s.profile) return { user: null, profile: guestProfile() };   // sin sesión: recorre el mall como invitada
        mergeGuestCart(s.profile.id);
        return s;
      },
      async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email: normEmail(email), password: password })); },
      // true = quedó con sesión; false = Supabase pide confirmar el correo primero
      async signUp(email, password, full_name) {
        var d = ok(await sb.auth.signUp({ email: normEmail(email), password: password, options: { data: { full_name: String(full_name || "").trim() }, emailRedirectTo: back() } }));
        if (d.user && Array.isArray(d.user.identities) && !d.user.identities.length) throw new Error("User already registered");
        return !!d.session;
      },
      async resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(normEmail(email), { redirectTo: back() })); return { demo: false }; },
      async updatePassword(newPw, currentPw) {
        var u = ok(await sb.auth.getUser()).user;
        if (currentPw != null) { var r = await sb.auth.signInWithPassword({ email: u.email, password: currentPw }); if (r.error) throw new Error("La contraseña actual no es correcta"); }
        ok(await sb.auth.updateUser({ password: newPw }));
      },
      async accountEmail() { try { return ok(await sb.auth.getUser()).user.email || ""; } catch (e) { return ""; } },
    });
    // link del correo "Restablecer contraseña": Supabase abre la app con una sesión de recuperación
    sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") setTimeout(function () { passwordSheet(true); }, 400); });
    return api;
  }

  // Mensajes de error claros en español
  function niceError(e) {
    var m = String((e && e.message) || e || "");
    if (/invalid login|invalid credentials/i.test(m)) return "El correo o la contraseña no son correctos. Revísalos e intenta de nuevo.";
    if (/not confirmed/i.test(m)) return "Todavía no confirmas tu correo. Abre el mensaje que te enviamos y toca el enlace.";
    if (/already registered|already exists|already been registered/i.test(m)) return "Ya existe una cuenta con ese correo. Toca \"Ya tengo cuenta\" para entrar.";
    if (/password should be|weak password|at least/i.test(m)) return "La contraseña debe tener al menos " + MIN_PW + " caracteres.";
    if (/rate limit|too many|security purposes/i.test(m)) return "Hiciste muchos intentos seguidos. Espera un minuto y vuelve a intentar.";
    if (/failed to fetch|network/i.test(m)) return "No hay conexión. Revisa tu internet e intenta de nuevo.";
    return m || "No se pudo completar. Intenta de nuevo.";
  }

  // ---------------------------------------------------------------------------
  // Pop-up: Crear cuenta / Ya tengo cuenta
  // ---------------------------------------------------------------------------
  var EYE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.4 6.4C3.9 8.1 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var field = function (id, label, attrs, hint) {
    return '<div class="acc-f"><label class="acc-l" for="' + id + '">' + label + "</label>" +
      '<input class="in acc-in" id="' + id + '" ' + attrs + ' aria-describedby="' + id + '-e' + (hint ? " " + id + "-h" : "") + '">' +
      (hint ? '<p class="acc-hint" id="' + id + '-h">' + hint + "</p>" : "") + '<p class="acc-err" id="' + id + '-e" hidden></p></div>';
  };
  var pwField = function (id, label, auto, hint) {
    return '<div class="acc-f"><label class="acc-l" for="' + id + '">' + label + '</label><div class="acc-pw">' +
      '<input class="in acc-in" id="' + id + '" name="password" type="password" autocomplete="' + auto + '" autocapitalize="off" spellcheck="false" aria-describedby="' + id + '-e' + (hint ? " " + id + "-h" : "") + '">' +
      '<button type="button" class="acc-eye" data-eye="' + id + '" aria-label="Mostrar contraseña" aria-pressed="false">' + EYE + "</button></div>" +
      (hint ? '<p class="acc-hint" id="' + id + '-h">' + hint + "</p>" : "") + '<p class="acc-err" id="' + id + '-e" hidden></p></div>';
  };
  function setErr(root, id, msg) {
    var e = root.querySelector("#" + id + "-e"), i = root.querySelector("#" + id);
    if (e) { e.textContent = msg || ""; e.hidden = !msg; }
    if (i) i.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function wireEyes(root) {
    root.querySelectorAll("[data-eye]").forEach(function (b) {
      b.onclick = function () {
        var i = root.querySelector("#" + b.dataset.eye), show = i.type === "password";
        i.type = show ? "text" : "password"; b.innerHTML = show ? EYE_OFF : EYE;
        b.setAttribute("aria-pressed", show); b.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
      };
    });
  }

  // opts: { tab: "new"|"in", reason: "compra"|"menu"|..., onDone(profile) }
  function open(opts) {
    opts = opts || {};
    var last = ""; try { last = localStorage.getItem(LAST_EMAIL) || ""; } catch (e) {}
    var tab = opts.tab || (last ? "in" : "new");
    var lead = opts.reason === "compra" ? "Para comprar necesitas una cuenta. Así te reconocemos cuando vuelvas y puedes seguir tus pedidos. Tu carro queda guardado."
      : "Con tu cuenta te reconocemos cada vez que vuelves, y ves tus pedidos y tu N° de clienta.";
    var html = '<div class="acc" id="acc">' +
      '<h2 class="acc-h">' + (opts.reason === "compra" ? "Antes de comprar" : "Tu cuenta") + "</h2>" +
      '<p class="acc-lead">' + lead + "</p>" +
      '<div class="acc-tabs" role="tablist" aria-label="Crear cuenta o entrar">' +
        '<button type="button" role="tab" class="acc-tab" id="acc-t-new" aria-controls="acc-new" data-tab="new">Crear cuenta</button>' +
        '<button type="button" role="tab" class="acc-tab" id="acc-t-in" aria-controls="acc-login" data-tab="in">Ya tengo cuenta</button></div>' +
      '<form class="acc-form" id="acc-new" role="tabpanel" aria-labelledby="acc-t-new" novalidate>' +
        field("acc-name", "Nombre y apellido", 'name="name" type="text" autocomplete="name" autocapitalize="words" enterkeyhint="next"') +
        field("acc-email", "Correo", 'name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="nombre@gmail.com"') +
        pwField("acc-pw", "Contraseña", "new-password", "Mínimo " + MIN_PW + " caracteres.") +
        '<div class="acc-f"><label class="acc-terms"><input type="checkbox" id="acc-terms" name="terms" aria-describedby="acc-terms-e"><span>Acepto los términos de uso y que Shoppers Miami guarde mis datos para gestionar mis compras.</span></label><p class="acc-err" id="acc-terms-e" hidden></p></div>' +
        '<p class="acc-err acc-gen" id="acc-new-g" role="alert" hidden></p>' +
        '<button type="submit" class="btn gold block acc-go">' + (opts.reason === "compra" ? "Crear cuenta y seguir" : "Crear cuenta") + "</button>" +
      "</form>" +
      '<form class="acc-form" id="acc-login" role="tabpanel" aria-labelledby="acc-t-in" novalidate>' +
        field("acc-lemail", "Correo", 'name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" value="' + esc(last) + '"') +
        pwField("acc-lpw", "Contraseña", "current-password") +
        '<button type="button" class="acc-forgot" id="acc-forgot">¿Olvidaste tu contraseña?</button>' +
        '<p class="acc-err acc-gen" id="acc-login-g" role="alert" hidden></p>' +
        '<button type="submit" class="btn gold block acc-go">' + (opts.reason === "compra" ? "Entrar y seguir" : "Entrar") + "</button>" +
      "</form></div>";
    var tt = document.getElementById("toast"); if (tt) tt.classList.remove("show");   // que un aviso anterior no tape el formulario
    A().sheet(html, function (el, close) {
      el.closest(".sheet") && el.closest(".sheet").classList.add("acc-sheet");
      var root = el.querySelector("#acc"), fNew = root.querySelector("#acc-new"), fIn = root.querySelector("#acc-login");
      var show = function (t, focus) {
        tab = t;
        root.querySelectorAll(".acc-tab").forEach(function (b) { var on = b.dataset.tab === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
        fNew.hidden = t !== "new"; fIn.hidden = t !== "in";
        if (focus) { var f = t === "new" ? fNew.querySelector("#acc-name") : fIn.querySelector(last ? "#acc-lpw" : "#acc-lemail"); try { f.focus({ preventScroll: true }); } catch (e) {} }
      };
      root.querySelectorAll(".acc-tab").forEach(function (b) {
        b.onclick = function () { show(b.dataset.tab, true); };
        b.onkeydown = function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); var t = tab === "new" ? "in" : "new"; show(t); root.querySelector("#acc-t-" + t).focus(); } };
      });
      wireEyes(root);
      root.querySelectorAll("input").forEach(function (i) { i.addEventListener("input", function () { setErr(root, i.id, ""); var g = i.form && i.form.querySelector(".acc-gen"); if (g) g.hidden = true; }); });
      root.querySelector("#acc-terms").onchange = function () { setErr(root, "acc-terms", ""); };
      show(tab);
      var busy = function (form, on, txt) { var b = form.querySelector(".acc-go"); if (!b._t) b._t = b.textContent; b.disabled = on; b.textContent = on ? txt : b._t; };
      var general = function (form, msg) { var g = form.querySelector(".acc-gen"); g.textContent = msg; g.hidden = !msg; };
      var finish = async function (email, welcome) {
        try { localStorage.setItem(LAST_EMAIL, normEmail(email)); } catch (e) {}
        close();
        var s = await S().api.session();
        toast(welcome.replace("{n}", firstName(s && s.profile && s.profile.full_name)).replace(/, \./, "."));
        if (opts.onDone) opts.onDone(s && s.profile);
        if (A().boot) await A().boot();
      };
      fNew.onsubmit = async function (e) {
        e.preventDefault();
        var name = fNew.querySelector("#acc-name").value.trim(), email = fNew.querySelector("#acc-email").value.trim(), pw = fNew.querySelector("#acc-pw").value;
        var bad = [];
        if (name.split(/\s+/).filter(Boolean).length < 1 || name.length < 2) bad.push(["acc-name", "Escribe tu nombre."]);
        if (!email) bad.push(["acc-email", "Escribe tu correo."]); else if (!emailOk(email)) bad.push(["acc-email", "Revisa tu correo: parece que falta algo (ej: nombre@gmail.com)."]);
        if (!pw) bad.push(["acc-pw", "Crea una contraseña."]); else if (pw.length < MIN_PW) bad.push(["acc-pw", "La contraseña es muy corta: debe tener al menos " + MIN_PW + " caracteres (tiene " + pw.length + ")."]);
        if (!fNew.querySelector("#acc-terms").checked) bad.push(["acc-terms", "Para crear tu cuenta, acepta los términos."]);
        ["acc-name", "acc-email", "acc-pw", "acc-terms"].forEach(function (id) { setErr(root, id, ""); });
        bad.forEach(function (b) { setErr(root, b[0], b[1]); });
        if (bad.length) { var f0 = root.querySelector("#" + bad[0][0]); try { f0.focus(); } catch (er) {} return; }
        busy(fNew, true, "Creando tu cuenta…"); general(fNew, "");
        try {
          var has = await S().api.signUp(email, pw, name, "");
          if (!has) {   // Supabase con confirmación de correo activada
            busy(fNew, false);
            try { localStorage.setItem(LAST_EMAIL, normEmail(email)); } catch (er) {}
            root.innerHTML = '<h2 class="acc-h">Revisa tu correo</h2><p class="acc-lead">Te enviamos un mensaje a <b>' + esc(email) + "</b>. Ábrelo y toca el enlace para activar tu cuenta. Después vuelve a la app: tu carro queda guardado.</p>" +
              '<button type="button" class="btn gold block" data-close>Entendido</button>';
            root.querySelector("[data-close]").onclick = close;
            return;
          }
          await finish(email, "Listo, {n}. Tu cuenta quedó creada.");
        } catch (er) { busy(fNew, false); general(fNew, niceError(er)); }
      };
      fIn.onsubmit = async function (e) {
        e.preventDefault();
        var email = fIn.querySelector("#acc-lemail").value.trim(), pw = fIn.querySelector("#acc-lpw").value, bad = [];
        if (!email) bad.push(["acc-lemail", "Escribe tu correo."]); else if (!/@/.test(email)) bad.push(["acc-lemail", "Revisa tu correo: parece que falta algo (ej: nombre@gmail.com)."]);
        if (!pw) bad.push(["acc-lpw", "Escribe tu contraseña."]);
        ["acc-lemail", "acc-lpw"].forEach(function (id) { setErr(root, id, ""); });
        bad.forEach(function (b) { setErr(root, b[0], b[1]); });
        if (bad.length) { try { root.querySelector("#" + bad[0][0]).focus(); } catch (er) {} return; }
        busy(fIn, true, "Entrando…"); general(fIn, "");
        try { await S().api.signIn(email, pw); await finish(email, "Hola de nuevo, {n}."); }
        catch (er) { busy(fIn, false); general(fIn, niceError(er)); var p = fIn.querySelector("#acc-lpw"); p.select && p.select(); }
      };
      root.querySelector("#acc-forgot").onclick = async function () {
        var email = fIn.querySelector("#acc-lemail").value.trim();
        setErr(root, "acc-lemail", "");
        if (!emailOk(email) && !/@demo$/.test(email)) { setErr(root, "acc-lemail", "Escribe tu correo arriba y vuelve a tocar \"¿Olvidaste tu contraseña?\"."); fIn.querySelector("#acc-lemail").focus(); return; }
        var b = this; b.disabled = true;
        try {
          var r = await S().api.resetPassword(email);
          general(fIn, "");
          var note = r && r.demo
            ? "Esto es el modo demo: en la versión real te llega un correo a " + email + " con un enlace para crear una contraseña nueva."
            : "Listo. Si " + email + " tiene cuenta, te llega un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.";
          var n = fIn.querySelector(".acc-note") || document.createElement("p");
          n.className = "acc-note"; n.setAttribute("role", "status"); n.textContent = note;
          b.insertAdjacentElement("afterend", n);
        } catch (er) { general(fIn, niceError(er)); }
        b.disabled = false;
      };
      if (opts.reason !== "compra") setTimeout(function () { show(tab, true); }, 60);
    });
  }

  // ---------------------------------------------------------------------------
  // Cambiar contraseña (Mi cuenta) o crear una nueva tras el correo de recuperación (Supabase)
  // ---------------------------------------------------------------------------
  function passwordSheet(recovery) {
    var html = '<div class="acc" id="acc-pwc"><h2 class="acc-h">' + (recovery ? "Crea tu contraseña nueva" : "Cambiar contraseña") + "</h2>" +
      '<form class="acc-form" id="acc-pwf" novalidate>' +
      '<input type="email" name="email" autocomplete="username" hidden value="">' +
      (recovery ? "" : pwField("acc-cur", "Contraseña actual", "current-password")) +
      pwField("acc-npw", "Contraseña nueva", "new-password", "Mínimo " + MIN_PW + " caracteres.") +
      '<p class="acc-err acc-gen" id="acc-pwc-g" role="alert" hidden></p>' +
      '<button type="submit" class="btn gold block acc-go">Guardar contraseña nueva</button>' +
      '<button type="button" class="btn ghost block" data-close>Cancelar</button></form></div>';
    A().sheet(html, async function (el, close) {
      el.closest(".sheet") && el.closest(".sheet").classList.add("acc-sheet");
      var root = el.querySelector("#acc-pwc"), f = root.querySelector("#acc-pwf");
      try { f.querySelector('[name="email"]').value = await S().api.accountEmail(); } catch (e) {}
      wireEyes(root);
      root.querySelectorAll("input").forEach(function (i) { i.addEventListener("input", function () { setErr(root, i.id, ""); }); });
      f.onsubmit = async function (e) {
        e.preventDefault();
        var cur = recovery ? null : f.querySelector("#acc-cur").value, npw = f.querySelector("#acc-npw").value, g = root.querySelector("#acc-pwc-g");
        g.hidden = true;
        if (!recovery && !cur) { setErr(root, "acc-cur", "Escribe tu contraseña actual."); return; }
        if (npw.length < MIN_PW) { setErr(root, "acc-npw", "La contraseña nueva debe tener al menos " + MIN_PW + " caracteres."); return; }
        if (!recovery && npw === cur) { setErr(root, "acc-npw", "La contraseña nueva debe ser distinta de la actual."); return; }
        var b = f.querySelector(".acc-go"); b.disabled = true; b.textContent = "Guardando…";
        try { await S().api.updatePassword(npw, cur); close(); toast("Tu contraseña quedó cambiada."); if (recovery && A().boot) A().boot(); }
        catch (er) { b.disabled = false; b.textContent = "Guardar contraseña nueva"; var m = niceError(er); if (/actual/.test(m)) setErr(root, "acc-cur", m); else { g.textContent = m; g.hidden = false; } }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Ganchos que usa app.js
  // ---------------------------------------------------------------------------
  var isGuest = function () { var me = S().me; return !!(me && me.guest); };
  // ¿Hay que pedir cuenta antes de comprar? (solo clientas sin sesión)
  var needsAccount = function () { return isGuest(); };

  async function logout() {
    var api = S().api; if (!api) return;
    try { await api.signOut(); } catch (e) { console.warn(e); }
    S().cajaDone = null; S().cajaSplit = null;
    toast("Cerraste tu sesión.");
    if (api.demo && A().boot) { S().tab = "ofertas"; S().mallView = "mall"; S().cat = null; try { history.replaceState(null, "", "#ofertas"); } catch (e) {} await A().boot(); }
    // Supabase: onAuthStateChange("SIGNED_OUT") en app.js vuelve a iniciar la app como invitada
  }

  // Al volver del pop-up a la caja: si faltan datos de envío, se lleva a la clienta al formulario
  // (ya con su nombre y correo); si su ficha está completa, la compra se confirma sola.
  function resume(view) {
    var step = view.querySelector("#cli-step"), cf = view.querySelector("#confirm");
    var form = step && step.querySelector(".cli-form");
    if (form) {
      if (!step.querySelector(".acc-resume")) step.insertAdjacentHTML("afterbegin", '<p class="acc-resume" role="status">Tu cuenta está lista. Completa tus datos de envío y toca "Comprar".</p>');
      var first = [].slice.call(form.querySelectorAll("input:not([type=checkbox]):not([hidden]),select")).find(function (i) { return !i.value && i.offsetParent !== null; });
      setTimeout(function () { step.scrollIntoView({ block: "start", behavior: "smooth" }); if (first) try { first.focus({ preventScroll: true }); } catch (e) {} }, 80);
    } else if (cf) setTimeout(function () { if (cf.isConnected && !cf.disabled) cf.click(); }, 150);
  }

  // Tarjeta para invitadas en Mi cuenta / Pedidos / Encargos
  var GATE = {
    cuenta: ["Entra a tu cuenta", "Crea tu cuenta o entra con tu correo para ver tus datos, tu N° de clienta y tus compras."],
    pedidos: ["Tus pedidos están en tu cuenta", "Entra con tu correo para ver tus pedidos y tu casilla en Miami."],
    encargos: ["Encargos con tu cuenta", "Para pedirle algo puntual a tu shopper, crea tu cuenta o entra con tu correo."],
  };
  function gate(view, what) {
    if (!isGuest()) return false;
    var g = GATE[what] || GATE.cuenta;
    view.innerHTML = '<div class="card acc-gate"><h3 class="acc-h">' + g[0] + '</h3><p class="acc-lead">' + g[1] + "</p>" +
      '<button type="button" class="btn gold block" data-acc="new">Crear cuenta</button><button type="button" class="btn ghost block" data-acc="in">Ya tengo cuenta</button></div>';
    view.querySelectorAll("[data-acc]").forEach(function (b) { b.onclick = function () { open({ tab: b.dataset.acc, reason: what }); }; });
    return true;
  }

  // Mi cuenta: nombre, correo, N° MSM, cambiar contraseña y cerrar sesión
  async function cuentaCard(view) {
    if (isGuest()) return;
    var me = S().me || {}, email = "", cust = null;
    try { email = await S().api.accountEmail(); } catch (e) {}
    try { cust = window.MSClientes && window.MSClientes.mine ? await window.MSClientes.mine() : null; } catch (e) {}
    var old = view.querySelector("#logout"); if (old) old.remove();
    var box = document.createElement("div");
    box.className = "card acc-me";
    box.innerHTML = '<div class="acc-me-h"><span class="acc-k">Sesión iniciada</span><b class="acc-me-n">' + esc(me.full_name || (cust && cust.full_name) || "Mi cuenta") + "</b>" +
      (email ? '<span class="acc-me-e">' + esc(email) + "</span>" : "") + "</div>" +
      '<div class="acc-me-id"><span class="acc-k">N° de clienta</span><b class="acc-msm" id="acc-msm">' + (cust && cust.code ? esc(cust.code) : "Se asigna con tu primera compra") + "</b></div>" +
      '<div class="acc-me-acts"><button type="button" class="btn ghost block" id="acc-chpw">Cambiar contraseña</button><button type="button" class="btn ghost block" id="acc-out">Cerrar sesión</button></div>';
    view.insertBefore(box, view.firstChild);
    box.querySelector("#acc-chpw").onclick = function () { passwordSheet(false); };
    box.querySelector("#acc-out").onclick = logout;
  }

  // Menú: "Entrar o crear cuenta" para invitadas
  var menuHTML = function () { return isGuest() ? '<button class="btn gold block" data-acc-menu>Entrar o crear cuenta</button>' : ""; };
  var wireMenu = function (el, close) { var b = el.querySelector("[data-acc-menu]"); if (b) b.onclick = function () { close(); setTimeout(function () { open({ reason: "menu" }); }, 30); }; };

  window.MSCuentas = {
    extendLocal: extendLocal, extendSupabase: extendSupabase, open: open, passwordSheet: passwordSheet, logout: logout,
    isGuest: isGuest, needsAccount: needsAccount, resume: resume, gate: gate, cuentaCard: cuentaCard, menuHTML: menuHTML, wireMenu: wireMenu,
    MIN_PW: MIN_PW, _sha256js: sha256js, _sha256: sha256hex,
  };
})();
