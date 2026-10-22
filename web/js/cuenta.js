/* =========================================================
   ZongaElements · Cuenta y datos en la nube (Supabase)
   Lo usan todas las herramientas:
     await ZE.requireUser()  → pide iniciar sesión si hace falta
     await ZE.load("planner") / ZE.save("planner", estado)
     ZE.mountAccount(contenedor) → botón de cuenta en la cabecera
   Si config.js está vacío, todo funciona en modo local (solo navegador).
   ========================================================= */
(() => {
  // aplica el tema guardado ya, para que la pantalla de acceso salga con el tema correcto
  try { const th = localStorage.getItem("ze-theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  const cfg = window.ZE_CONFIG || {};
  const online = !!(cfg.url && cfg.anonKey && window.supabase);
  const sb = online ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
  }) : null;

  /* ---------- textos ---------- */
  const TX = {
    es: { title: "Entra en ZongaElements", sub: "Inicia sesión o crea tu cuenta para usar las herramientas. Todo se guarda en tu cuenta y lo tienes en cualquier dispositivo.",
      login: "Iniciar sesión", signup: "Crear cuenta", email: "Email", pass: "Contraseña", passHint: "Mínimo 6 caracteres",
      goLogin: "Entrar", goSignup: "Crear mi cuenta", or: "o", google: "Continuar con Google", forgot: "¿Olvidaste tu contraseña?",
      needEmail: "Escribe tu email y vuelve a pulsar.", resetSent: "Te hemos enviado un email para cambiar la contraseña.",
      confirm: "Te hemos enviado un email para confirmar la cuenta. Ábrelo y vuelve aquí.",
      badLogin: "Email o contraseña incorrectos.", exists: "Ya existe una cuenta con este email. Inicia sesión.", short: "La contraseña debe tener al menos 6 caracteres.",
      notConfirmed: "Confirma tu email antes de entrar (revisa tu bandeja de entrada).", rate: "Demasiados intentos. Espera un momento y vuelve a probar.",
      newPassT: "Nueva contraseña", newPassP: "Escribe tu nueva contraseña.", save: "Guardar", passOk: "Contraseña actualizada.",
      synced: "Guardado en la nube", saving: "Guardando…", offline: "Sin conexión · se guardará al volver", logout: "Cerrar sesión", account: "Tu cuenta", cfT: "Tienes cambios en dos dispositivos", cfP: "Has cambiado cosas aquí y también desde otro dispositivo. ¿Qué versión quieres conservar?", cfRemote: "La del otro dispositivo (la nube)", cfLocal: "La de este dispositivo", cfNote: "La versión que no elijas queda guardada en «Copias de seguridad» durante unas horas.", bkT: "Copias de seguridad", bkP: "Guardamos automáticamente versiones anteriores de tus datos. Si algo se ha borrado o estropeado, puedes volver a una de ellas.", bkEmpty: "Aún no hay copias. Se crean solas a medida que usas las herramientas.", bkRestore: "Restaurar", bkConfirm: "¿Restaurar esta copia? Tus datos actuales se guardarán como otra copia, por si te arrepientes.", close: "Cerrar", toolPlanner: "Planificador del día", toolHabits: "Rueda de hábitos", refreshed: "Actualizado con los cambios de tu otro dispositivo", restored: "Copia restaurada", net: "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo." },
    en: { title: "Sign in to ZongaElements", sub: "Sign in or create your account to use the tools. Everything is saved to your account and available on any device.",
      login: "Sign in", signup: "Create account", email: "Email", pass: "Password", passHint: "At least 6 characters",
      goLogin: "Sign in", goSignup: "Create my account", or: "or", google: "Continue with Google", forgot: "Forgot your password?",
      needEmail: "Type your email and tap again.", resetSent: "We've sent you an email to change your password.",
      confirm: "We've sent you an email to confirm your account. Open it and come back here.",
      badLogin: "Wrong email or password.", exists: "An account with this email already exists. Sign in.", short: "The password must be at least 6 characters.",
      notConfirmed: "Confirm your email before signing in (check your inbox).", rate: "Too many attempts. Wait a moment and try again.",
      newPassT: "New password", newPassP: "Type your new password.", save: "Save", passOk: "Password updated.",
      synced: "Saved to the cloud", saving: "Saving…", offline: "Offline · will save when back", logout: "Sign out", account: "Your account", cfT: "You have changes on two devices", cfP: "You changed things here and on another device too. Which version do you want to keep?", cfRemote: "The other device's (the cloud)", cfLocal: "This device's", cfNote: "The version you don't pick stays in “Backups” for a few hours.", bkT: "Backups", bkP: "We automatically keep previous versions of your data. If something got deleted or broken, you can go back to one of them.", bkEmpty: "No backups yet. They are created automatically as you use the tools.", bkRestore: "Restore", bkConfirm: "Restore this backup? Your current data will be kept as another backup, in case you change your mind.", close: "Close", toolPlanner: "Daily planner", toolHabits: "Habit wheel", refreshed: "Updated with the changes from your other device", restored: "Backup restored", net: "Couldn't connect. Check your connection and try again." },
    ro: { title: "Intră în ZongaElements", sub: "Autentifică-te sau creează-ți contul ca să folosești instrumentele. Totul se salvează în contul tău și îl ai pe orice dispozitiv.",
      login: "Autentificare", signup: "Creează cont", email: "Email", pass: "Parolă", passHint: "Minimum 6 caractere",
      goLogin: "Intră", goSignup: "Creează-mi contul", or: "sau", google: "Continuă cu Google", forgot: "Ți-ai uitat parola?",
      needEmail: "Scrie emailul și apasă din nou.", resetSent: "Ți-am trimis un email pentru schimbarea parolei.",
      confirm: "Ți-am trimis un email de confirmare. Deschide-l și revino aici.",
      badLogin: "Email sau parolă greșite.", exists: "Există deja un cont cu acest email. Autentifică-te.", short: "Parola trebuie să aibă cel puțin 6 caractere.",
      notConfirmed: "Confirmă emailul înainte să intri (verifică inboxul).", rate: "Prea multe încercări. Așteaptă puțin și încearcă din nou.",
      newPassT: "Parolă nouă", newPassP: "Scrie parola nouă.", save: "Salvează", passOk: "Parola a fost actualizată.",
      synced: "Salvat în cloud", saving: "Se salvează…", offline: "Fără conexiune · se salvează la revenire", logout: "Deconectare", account: "Contul tău", cfT: "Ai modificări pe două dispozitive", cfP: "Ai schimbat lucruri aici și pe alt dispozitiv. Ce versiune vrei să păstrezi?", cfRemote: "Cea de pe celălalt dispozitiv (cloud)", cfLocal: "Cea de pe acest dispozitiv", cfNote: "Versiunea pe care n-o alegi rămâne în „Copii de siguranță” câteva ore.", bkT: "Copii de siguranță", bkP: "Păstrăm automat versiuni anterioare ale datelor tale. Dacă ceva s-a șters sau s-a stricat, poți reveni la una dintre ele.", bkEmpty: "Încă nu există copii. Se creează singure pe măsură ce folosești instrumentele.", bkRestore: "Restaurează", bkConfirm: "Restaurezi această copie? Datele actuale vor fi păstrate ca altă copie, în caz că te răzgândești.", close: "Închide", toolPlanner: "Planificatorul zilei", toolHabits: "Roata obiceiurilor", refreshed: "Actualizat cu modificările de pe celălalt dispozitiv", restored: "Copie restaurată", net: "Nu s-a putut conecta. Verifică conexiunea și încearcă din nou." }
  };
  const lang = () => { try { return localStorage.getItem("ze-lang") || "es"; } catch (e) { return "es"; } };
  const t = k => (TX[lang()] || TX.es)[k] ?? TX.es[k];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const here = () => location.href.split("#")[0].split("?")[0];

  function niceError(err){
    const m = (err && err.message || "").toLowerCase();
    if (m.includes("invalid login")) return t("badLogin");
    if (m.includes("already registered") || m.includes("already exists")) return t("exists");
    if (m.includes("at least 6") || m.includes("password should")) return t("short");
    if (m.includes("not confirmed")) return t("notConfirmed");
    if (m.includes("rate") || m.includes("too many")) return t("rate");
    if (m.includes("fetch") || m.includes("network")) return t("net");
    return err && err.message || "Error";
  }

  /* ---------- estilos (usan los colores de cada página) ---------- */
  function injectCss(){
    if (document.getElementById("ze-css")) return;
    const st = document.createElement("style"); st.id = "ze-css";
    st.textContent = `
.ze-gate{position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;background:var(--bg);overflow-y:auto;animation:zeIn .5s ease}
.ze-gate::before{content:"";position:fixed;width:700px;height:700px;border-radius:50%;background:var(--accent);filter:blur(160px);opacity:.18;top:-380px;right:-220px;pointer-events:none}
.ze-card{position:relative;width:min(440px,100%);background:var(--card);border:1px solid var(--line);border-radius:28px;padding:28px 24px;box-shadow:var(--shadow);animation:zeUp .7s cubic-bezier(.2,.9,.2,1)}
.ze-mark{width:44px;height:44px;border-radius:13px;background:var(--fg);position:relative;overflow:hidden;margin-bottom:20px}
.ze-mark i{position:absolute;width:60%;height:60%;border-radius:50%;filter:blur(2px)}
.ze-mark i:first-child{background:#2B63FF;top:-8%;left:-8%} .ze-mark i:last-child{background:#FF2D3F;bottom:-8%;right:-8%}
.ze-card h2{font-family:var(--display);font-weight:800;font-size:clamp(26px,7vw,32px);letter-spacing:-.04em;line-height:1.05}
.ze-card>p{color:var(--muted);font-size:15px;line-height:1.5;margin-top:10px}
.ze-tabs{display:flex;padding:4px;border-radius:100px;background:var(--bg);border:1px solid var(--line);margin:22px 0 18px}
.ze-tabs button{flex:1;height:42px;border-radius:100px;font-weight:700;font-size:14px;transition:all .3s}
.ze-tabs button.on{background:var(--fg);color:var(--bg)}
.ze-f{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.ze-f label{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ze-f input{height:54px;border-radius:16px;border:1px solid var(--line-2);background:var(--bg);padding:0 16px;font-size:16px;font-weight:600;outline:none;transition:border-color .3s,box-shadow .3s}
.ze-f input:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.ze-f small{color:var(--muted);font-size:12px}
.ze-btn{width:100%;height:54px;border-radius:100px;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform .3s cubic-bezier(.3,1.6,.5,1),opacity .3s}
.ze-btn:hover{transform:translateY(-2px)} .ze-btn:active{transform:scale(.97)} .ze-btn:disabled{opacity:.5;pointer-events:none}
.ze-btn.main{background:var(--fg);color:var(--bg)}
.ze-btn.google{background:var(--card);border:1px solid var(--line-2)}
.ze-btn.google svg{width:20px;height:20px}
.ze-or{display:flex;align-items:center;gap:12px;color:var(--muted);font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin:16px 0}
.ze-or::before,.ze-or::after{content:"";flex:1;height:1px;background:var(--line-2)}
.ze-link{display:block;margin:14px auto 0;font-size:13px;font-weight:700;color:var(--muted);text-decoration:underline;text-underline-offset:3px}
.ze-msg{font-size:13.5px;font-weight:700;line-height:1.45;border-radius:14px;padding:12px 14px;margin-bottom:14px}
.ze-msg.err{background:color-mix(in srgb,#FF2D3F 12%,transparent);color:#E5484D}
.ze-msg.ok{background:var(--accent-soft);color:var(--accent)}
.ze-spin{width:18px;height:18px;border-radius:50%;border:2.5px solid currentColor;border-right-color:transparent;animation:zeSpin .7s linear infinite}
.ze-acc{position:relative}
.ze-av{width:40px;height:40px;border-radius:50%;border:1px solid var(--line-2);background:var(--accent);color:#fff;font-weight:800;font-size:15px;display:grid;place-items:center;position:relative;padding:0;transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.ze-av:hover{transform:scale(1.06)}
.ze-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.ze-av::after{content:"";position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;background:var(--zs,#12B76A);box-shadow:0 0 0 2.5px var(--bg)}
.ze-menu{position:absolute;right:0;top:calc(100% + 10px);width:260px;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--line-2);box-shadow:var(--shadow);z-index:120;
  opacity:0;transform:translateY(-6px) scale(.97);transform-origin:top right;pointer-events:none;transition:opacity .2s,transform .25s}
.ze-acc.open .ze-menu{opacity:1;transform:none;pointer-events:auto}
.ze-menu .mono{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ze-menu b{display:block;font-size:14px;margin-top:4px;word-break:break-all}
.ze-st{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--muted);margin:12px 0;padding:10px 12px;border-radius:12px;background:var(--bg)}
.ze-st i{width:8px;height:8px;border-radius:50%;background:var(--zs,#12B76A)}
.ze-menu button{width:100%;height:44px;border-radius:12px;border:1px solid var(--line-2);font-weight:700;font-size:14px}
.ze-menu button:hover{background:var(--fg);color:var(--bg)}
.ze-dlg{background:rgba(5,5,8,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:700}
.ze-dlg::before{display:none}
.ze-dlg .ze-card{max-height:calc(100vh - 40px);overflow-y:auto}
.ze-bk button{background:var(--card);color:var(--fg);cursor:pointer} .ze-bk button:hover{background:var(--fg);color:var(--bg)}
.ze-flash{position:fixed;left:50%;bottom:calc(100px + env(safe-area-inset-bottom));z-index:720;transform:translate(-50%,20px);opacity:0;padding:12px 18px;border-radius:100px;background:var(--fg);color:var(--bg);font-weight:700;font-size:14px;transition:all .45s cubic-bezier(.3,1.5,.5,1);max-width:calc(100% - 32px);text-align:center}
.ze-flash.on{opacity:1;transform:translate(-50%,0)}
@keyframes zeIn{from{opacity:0}} @keyframes zeUp{from{opacity:0;transform:translateY(30px)}} @keyframes zeSpin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(st);
  }

  const GOOGLE = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  /* ---------- pantalla de acceso ---------- */
  function gate(){
    injectCss();
    return new Promise(resolve => {
      let mode = "login";
      const el = document.createElement("div");
      el.className = "ze-gate";
      document.body.appendChild(el); document.body.style.overflow = "hidden";
      const draw = (msg) => {
        el.innerHTML = `<form class="ze-card" novalidate>
          <div class="ze-mark"><i></i><i></i></div>
          <h2>${t("title")}</h2><p>${t("sub")}</p>
          <div class="ze-tabs"><button type="button" data-m="login" class="${mode === "login" ? "on" : ""}">${t("login")}</button><button type="button" data-m="signup" class="${mode === "signup" ? "on" : ""}">${t("signup")}</button></div>
          ${msg ? `<div class="ze-msg ${msg.ok ? "ok" : "err"}">${esc(msg.text)}</div>` : ""}
          <div class="ze-f"><label for="zeEmail">${t("email")}</label><input id="zeEmail" type="email" autocomplete="email" required></div>
          <div class="ze-f"><label for="zePass">${t("pass")}</label><input id="zePass" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="6" required>${mode === "signup" ? `<small>${t("passHint")}</small>` : ""}</div>
          <button class="ze-btn main" type="submit">${mode === "login" ? t("goLogin") : t("goSignup")}</button>
          <div class="ze-or">${t("or")}</div>
          <button class="ze-btn google" type="button" data-g>${GOOGLE}${t("google")}</button>
          ${mode === "login" ? `<button class="ze-link" type="button" data-forgot>${t("forgot")}</button>` : ""}
        </form>`;
      };
      let email = "";
      draw();
      const busy = (b, on) => { b.disabled = on; if (on){ b.dataset.txt = b.innerHTML; b.innerHTML = '<span class="ze-spin"></span>'; } else if (b.dataset.txt) b.innerHTML = b.dataset.txt; };
      const keep = () => { email = el.querySelector("#zeEmail").value.trim(); };
      const refill = () => { el.querySelector("#zeEmail").value = email; };
      el.addEventListener("input", keep);
      el.addEventListener("click", async e => {
        const tab = e.target.closest("[data-m]");
        if (tab){ keep(); mode = tab.dataset.m; draw(); refill(); return; }
        if (e.target.closest("[data-g]")){
          const b = e.target.closest("[data-g]"); busy(b, true);
          const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here() } });
          if (error){ busy(b, false); draw({ text: niceError(error) }); refill(); }
          return;
        }
        if (e.target.closest("[data-forgot]")){
          keep();
          if (!email){ draw({ text: t("needEmail") }); refill(); return; }
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: here() });
          draw(error ? { text: niceError(error) } : { ok: true, text: t("resetSent") }); refill();
        }
      });
      el.addEventListener("submit", async e => {
        e.preventDefault(); keep();
        const pass = el.querySelector("#zePass").value, b = el.querySelector(".ze-btn.main");
        busy(b, true);
        const res = mode === "login"
          ? await sb.auth.signInWithPassword({ email, password: pass })
          : await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: here() } });
        if (res.error){ draw({ text: niceError(res.error) }); refill(); return; }
        if (!res.data.session){ mode = "login"; draw({ ok: true, text: t("confirm") }); refill(); return; }
        user = res.data.session.user;
        el.style.transition = "opacity .4s"; el.style.opacity = "0";
        setTimeout(() => { el.remove(); document.body.style.overflow = ""; }, 400);
        resolve(user);
      });
    });
  }

  /* cambiar contraseña al volver del email de recuperación */
  function recovery(){
    injectCss();
    const el = document.createElement("div"); el.className = "ze-gate";
    el.innerHTML = `<form class="ze-card"><div class="ze-mark"><i></i><i></i></div><h2>${t("newPassT")}</h2><p>${t("newPassP")}</p>
      <div class="ze-f" style="margin-top:18px"><label for="zeNew">${t("pass")}</label><input id="zeNew" type="password" minlength="6" autocomplete="new-password" required><small>${t("passHint")}</small></div>
      <div class="ze-msg" hidden></div><button class="ze-btn main" type="submit">${t("save")}</button></form>`;
    document.body.appendChild(el);
    el.addEventListener("submit", async e => {
      e.preventDefault();
      const { error } = await sb.auth.updateUser({ password: el.querySelector("#zeNew").value });
      const m = el.querySelector(".ze-msg"); m.hidden = false;
      m.className = "ze-msg " + (error ? "err" : "ok"); m.textContent = error ? niceError(error) : t("passOk");
      if (!error) setTimeout(() => el.remove(), 1200);
    });
  }

  /* ---------- sesión ---------- */
  let user = null;
  async function requireUser(){
    if (!online) return null;
    const { data: { session } } = await sb.auth.getSession();
    if (session){ user = session.user; return user; }
    return gate();
  }
  if (online){
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === "PASSWORD_RECOVERY") recovery();
      if (ev === "SIGNED_OUT" && user) location.reload();
      if (session) user = session.user;
    });
  }

  /* ---------- datos ----------
     Cada herramienta guarda todo su estado en una fila de user_data.
     - Copia local en el navegador marcada como «pendiente» hasta que la nube confirma:
       si se cierra la pestaña sin conexión, se sube la próxima vez.
     - Cada guardado comprueba que nadie haya guardado antes desde otro dispositivo
       (updated_at lo pone el servidor). Si ha pasado, se pregunta qué versión conservar.
     - Al volver a la pestaña se comprueba si hay cambios de otro dispositivo.
  */
  const TOOLS = { planner: "ze-planner-v1", habits: "ze-habits-v1" };
  let status = "synced";
  const listeners = new Set();
  const setStatus = s => { status = s; listeners.forEach(f => f(s)); };
  const syncs = {};

  function sync(tool){
    if (syncs[tool]) return syncs[tool];
    const base = TOOLS[tool];
    const key = () => user ? `${base}:${user.id}` : base;
    const readRaw = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    // formato local: { __ze:1, state, dirty, rev }. Lo antiguo (estado suelto) se trata como ya sincronizado.
    const wrap = x => !x ? null : x.__ze ? x : { __ze: 1, state: x, dirty: false, rev: null };
    const writeLocal = obj => { try { localStorage.setItem(key(), JSON.stringify(obj)); } catch (e) {} };
    let rev = null, pending = null, timer = 0, busy = false, retry = 0, blocked = false;

    async function fetchRemote(){
      const { data, error } = await sb.from("user_data").select("data,updated_at").eq("tool", tool).maybeSingle();
      if (error) throw error;
      return data;
    }

    async function load(){
      let local = wrap(readRaw(key()));
      if (!online || !user) return local && local.state;
      if (!local){
        // datos de antes de tener cuenta en este navegador: se suben a la cuenta
        const legacy = wrap(readRaw(base));
        if (legacy){ local = { ...legacy, dirty: true }; writeLocal(local); try { localStorage.removeItem(base); } catch (e) {} }
      }
      let remote;
      try { remote = await fetchRemote(); }
      catch (e){ setStatus("offline"); if (local && local.dirty){ pending = local.state; schedule(8000); } return local && local.state; }

      if (!remote){
        if (local){ pending = local.state; schedule(0); }
        return local && local.state;
      }
      rev = remote.updated_at;
      if (local && local.dirty){
        if (local.rev === remote.updated_at){
          // cambios hechos sin conexión sobre la misma versión: se suben
          pending = local.state; schedule(0); return local.state;
        }
        // cambios sin subir aquí y, además, cambios en otro dispositivo
        const pick = await chooseVersion();
        if (pick === "local"){ await backup(remote.data); pending = local.state; schedule(0); return local.state; }
        await backup(local.state);
      }
      writeLocal({ __ze: 1, state: remote.data, dirty: false, rev });
      return remote.data;
    }

    function save(state, now){
      if (blocked) return;
      writeLocal({ __ze: 1, state, dirty: true, rev });
      if (!online || !user) return;
      pending = state; setStatus("saving");
      schedule(now ? 0 : 900);
    }
    function schedule(ms){ clearTimeout(timer); timer = setTimeout(flush, ms); }

    async function flush(){
      if (busy || !pending || blocked){ if (busy && pending) schedule(400); return; }
      busy = true;
      const state = pending; pending = null;
      try {
        let res;
        if (rev){
          res = await sb.from("user_data").update({ data: state }).eq("user_id", user.id).eq("tool", tool).eq("updated_at", rev).select("updated_at");
        } else {
          res = await sb.from("user_data").insert({ user_id: user.id, tool, data: state }).select("updated_at");
          if (res.error && res.error.code === "23505") res = { data: [] };   // ya existía: conflicto
        }
        if (res.error) throw res.error;
        if (!res.data.length){ busy = false; return conflict(state); }
        rev = res.data[0].updated_at; retry = 0;
        if (!pending) writeLocal({ __ze: 1, state, dirty: false, rev });
        if (!anyPending()) setStatus("synced");
      } catch (e){
        pending = pending || state; setStatus("offline");
        retry = Math.min(retry + 1, 6); schedule(2000 * 2 ** retry);
      }
      busy = false;
    }

    // otro dispositivo guardó entre medias
    async function conflict(mine){
      const pick = await chooseVersion();
      let remote = null;
      try { remote = await fetchRemote(); } catch (e) {}
      if (pick === "local"){
        if (remote) await backup(remote.data);
        rev = remote ? remote.updated_at : null;
        pending = mine; return flush();
      }
      await backup(mine);
      blocked = true;
      if (remote) writeLocal({ __ze: 1, state: remote.data, dirty: false, rev: remote.updated_at });
      location.reload();
    }

    // al volver a la pestaña: ¿hay cambios de otro dispositivo?
    async function refresh(){
      if (!user || busy || pending || blocked) return;
      try {
        const { data, error } = await sb.from("user_data").select("updated_at").eq("tool", tool).maybeSingle();
        if (error || !data || !rev || data.updated_at === rev) return;
        const remote = await fetchRemote();
        blocked = true;
        writeLocal({ __ze: 1, state: remote.data, dirty: false, rev: remote.updated_at });
        try { sessionStorage.setItem("ze-refreshed", "1"); } catch (e) {}
        location.reload();
      } catch (e) {}
    }

    // guarda una versión en «Copias de seguridad» antes de descartarla
    const backup = data => sb.rpc("add_backup", { p_tool: tool, p_data: data }).then(() => {}, () => {});
    function cancel(){ clearTimeout(timer); pending = null; blocked = true; }
    const hasPending = () => !!pending || busy;
    return (syncs[tool] = { load, save, flush, refresh, cancel, hasPending });
  }
  const anyPending = () => Object.values(syncs).some(x => x.hasPending());
  const flushAll = () => Promise.all(Object.values(syncs).map(x => x.flush()));
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
    else Object.values(syncs).forEach(x => x.refresh());
  });
  addEventListener("pagehide", flushAll);
  addEventListener("online", flushAll);

  /* compatibilidad: ZE.load / ZE.save directos */
  const load = tool => sync(tool).load();
  const save = (tool, data, now) => sync(tool).save(data, now);

  /* ---------- diálogos propios (conflicto y copias) ---------- */
  function dialog(html){
    injectCss();
    const el = document.createElement("div"); el.className = "ze-gate ze-dlg";
    el.innerHTML = `<div class="ze-card">${html}</div>`;
    document.body.appendChild(el);
    return el;
  }
  function chooseVersion(){
    return new Promise(res => {
      const el = dialog(`<div class="ze-mark"><i></i><i></i></div><h2>${t("cfT")}</h2><p>${t("cfP")}</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:22px">
          <button class="ze-btn main" type="button" data-v="remote">${t("cfRemote")}</button>
          <button class="ze-btn google" type="button" data-v="local">${t("cfLocal")}</button></div>
        <p style="font-size:13px;margin-top:14px;color:var(--muted)">${t("cfNote")}</p>`);
      el.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b){ el.remove(); res(b.dataset.v); } });
    });
  }

  const TOOL_NAME = { planner: "toolPlanner", habits: "toolHabits" };
  async function openBackups(){
    const el = dialog(`<div class="ze-mark"><i></i><i></i></div><h2>${t("bkT")}</h2><p>${t("bkP")}</p><div class="ze-bk" style="margin-top:18px"><span class="ze-spin"></span></div>
      <button class="ze-btn google" type="button" data-close style="margin-top:18px">${t("close")}</button>`);
    el.addEventListener("click", async e => {
      if (e.target === el || e.target.closest("[data-close]")) return el.remove();
      const b = e.target.closest("[data-id]"); if (!b) return;
      if (!confirm(t("bkConfirm"))) return;
      b.disabled = true; b.innerHTML = '<span class="ze-spin"></span>';
      const ok = await restore(b.dataset.tool, +b.dataset.id);
      if (!ok){ b.disabled = false; b.textContent = t("bkRestore"); alert(t("net")); }
    });
    const { data, error } = await sb.from("user_data_history").select("id,tool,saved_at").order("saved_at", { ascending: false }).limit(60);
    const box = el.querySelector(".ze-bk");
    if (error){ box.innerHTML = `<div class="ze-msg err">${esc(niceError(error))}</div>`; return; }
    if (!data.length){ box.innerHTML = `<div class="ze-msg ok">${t("bkEmpty")}</div>`; return; }
    const fmt = iso => new Date(iso).toLocaleString(lang(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    box.innerHTML = Object.keys(TOOLS).map(tool => {
      const rows = data.filter(r => r.tool === tool); if (!rows.length) return "";
      return `<div class="ze-f"><label>${t(TOOL_NAME[tool])}</label>${rows.map(r => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">
          <span style="font-size:14px;font-weight:600;text-transform:capitalize">${esc(fmt(r.saved_at))}</span>
          <button type="button" data-id="${r.id}" data-tool="${tool}" style="height:36px;padding:0 14px;border-radius:100px;border:1px solid var(--line-2);font-weight:700;font-size:13px">${t("bkRestore")}</button>
        </div>`).join("")}</div>`;
    }).join("");
  }
  async function restore(tool, id){
    try {
      const { data: snap, error } = await sb.from("user_data_history").select("data").eq("id", id).single();
      if (error) throw error;
      if (syncs[tool]) syncs[tool].cancel();
      await sb.rpc("add_backup", { p_tool: tool });   // lo actual queda como copia, por si te arrepientes
      const { data: cur } = await sb.from("user_data").select("updated_at").eq("tool", tool).maybeSingle();
      const res = cur
        ? await sb.from("user_data").update({ data: snap.data }).eq("user_id", user.id).eq("tool", tool).select("updated_at")
        : await sb.from("user_data").insert({ user_id: user.id, tool, data: snap.data }).select("updated_at");
      if (res.error) throw res.error;
      try { localStorage.setItem(`${TOOLS[tool]}:${user.id}`, JSON.stringify({ __ze: 1, state: snap.data, dirty: false, rev: res.data[0].updated_at })); } catch (e) {}
      try { sessionStorage.setItem("ze-restored", "1"); } catch (e) {}
      location.reload();
      return true;
    } catch (e){ return false; }
  }

  async function signOut(){ await flushAll(); await sb.auth.signOut(); }

  /* ---------- botón de cuenta en la cabecera ---------- */
  function mountAccount(container){
    if (!online || !user || !container) return;
    injectCss();
    const meta = user.user_metadata || {};
    const initial = (meta.full_name || user.email || "?").trim()[0].toUpperCase();
    const wrap = document.createElement("div"); wrap.className = "ze-acc";
    wrap.innerHTML = `<button class="ze-av" aria-label="${t("account")}">${meta.avatar_url ? `<img src="${esc(meta.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial)}</button>
      <div class="ze-menu"><span class="mono">${t("account")}</span><b>${esc(user.email || "")}</b><div class="ze-st"><i></i><span></span></div><button type="button" data-bk style="margin-bottom:8px">${t("bkT")}</button><button type="button" data-out>${t("logout")}</button></div>`;
    container.appendChild(wrap);
    const paint = s => {
      const col = s === "offline" ? "#E5484D" : s === "saving" ? "#FFC24B" : "#12B76A";
      wrap.style.setProperty("--zs", col); wrap.querySelector(".ze-st span").textContent = t(s);
    };
    paint(status); listeners.add(paint);
    wrap.querySelector(".ze-av").addEventListener("click", e => { e.stopPropagation(); wrap.classList.toggle("open"); paint(status); });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) wrap.classList.remove("open"); });
    wrap.querySelector("[data-out]").addEventListener("click", signOut);
    wrap.querySelector("[data-bk]").addEventListener("click", () => { wrap.classList.remove("open"); openBackups(); });
    // avisos tras recargar por sincronización o restauración
    const note = k => { try { const v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; } catch (e) { return null; } };
    if (note("ze-refreshed")) flash(t("refreshed"));
    if (note("ze-restored")) flash(t("restored"));
  }
  function flash(msg){
    injectCss();
    const el = document.createElement("div"); el.className = "ze-flash"; el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 500); }, 3500);
  }

  /* ---------- funciones del servidor (Edge Functions) ----------
     Devuelve la Response tal cual, para poder leer JSON o archivos. */
  async function callFn(name, body){
    if (!online) throw new Error("offline");
    const { data: { session } } = await sb.auth.getSession();
    return fetch(`${cfg.url}/functions/v1/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: cfg.anonKey, authorization: `Bearer ${session ? session.access_token : cfg.anonKey}` },
      body: JSON.stringify(body)
    });
  }

  window.ZE = { online, requireUser, sync, load, save, flushAll, signOut, mountAccount, openBackups, callFn, get user(){ return user; } };
})();
