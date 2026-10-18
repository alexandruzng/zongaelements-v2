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
    es: { title: "Entra para guardar tu progreso", sub: "Tus tareas y hábitos se guardan en tu cuenta y los tienes en cualquier dispositivo.",
      login: "Iniciar sesión", signup: "Crear cuenta", email: "Email", pass: "Contraseña", passHint: "Mínimo 6 caracteres",
      goLogin: "Entrar", goSignup: "Crear mi cuenta", or: "o", google: "Continuar con Google", forgot: "¿Olvidaste tu contraseña?",
      needEmail: "Escribe tu email y vuelve a pulsar.", resetSent: "Te hemos enviado un email para cambiar la contraseña.",
      confirm: "Te hemos enviado un email para confirmar la cuenta. Ábrelo y vuelve aquí.",
      badLogin: "Email o contraseña incorrectos.", exists: "Ya existe una cuenta con este email. Inicia sesión.", short: "La contraseña debe tener al menos 6 caracteres.",
      notConfirmed: "Confirma tu email antes de entrar (revisa tu bandeja de entrada).", rate: "Demasiados intentos. Espera un momento y vuelve a probar.",
      newPassT: "Nueva contraseña", newPassP: "Escribe tu nueva contraseña.", save: "Guardar", passOk: "Contraseña actualizada.",
      synced: "Guardado en la nube", saving: "Guardando…", offline: "Sin conexión · se guardará al volver", logout: "Cerrar sesión", account: "Tu cuenta", net: "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo." },
    en: { title: "Sign in to save your progress", sub: "Your tasks and habits are saved to your account and available on any device.",
      login: "Sign in", signup: "Create account", email: "Email", pass: "Password", passHint: "At least 6 characters",
      goLogin: "Sign in", goSignup: "Create my account", or: "or", google: "Continue with Google", forgot: "Forgot your password?",
      needEmail: "Type your email and tap again.", resetSent: "We've sent you an email to change your password.",
      confirm: "We've sent you an email to confirm your account. Open it and come back here.",
      badLogin: "Wrong email or password.", exists: "An account with this email already exists. Sign in.", short: "The password must be at least 6 characters.",
      notConfirmed: "Confirm your email before signing in (check your inbox).", rate: "Too many attempts. Wait a moment and try again.",
      newPassT: "New password", newPassP: "Type your new password.", save: "Save", passOk: "Password updated.",
      synced: "Saved to the cloud", saving: "Saving…", offline: "Offline · will save when back", logout: "Sign out", account: "Your account", net: "Couldn't connect. Check your connection and try again." },
    ro: { title: "Intră ca să-ți salvezi progresul", sub: "Sarcinile și obiceiurile se salvează în contul tău și le ai pe orice dispozitiv.",
      login: "Autentificare", signup: "Creează cont", email: "Email", pass: "Parolă", passHint: "Minimum 6 caractere",
      goLogin: "Intră", goSignup: "Creează-mi contul", or: "sau", google: "Continuă cu Google", forgot: "Ți-ai uitat parola?",
      needEmail: "Scrie emailul și apasă din nou.", resetSent: "Ți-am trimis un email pentru schimbarea parolei.",
      confirm: "Ți-am trimis un email de confirmare. Deschide-l și revino aici.",
      badLogin: "Email sau parolă greșite.", exists: "Există deja un cont cu acest email. Autentifică-te.", short: "Parola trebuie să aibă cel puțin 6 caractere.",
      notConfirmed: "Confirmă emailul înainte să intri (verifică inboxul).", rate: "Prea multe încercări. Așteaptă puțin și încearcă din nou.",
      newPassT: "Parolă nouă", newPassP: "Scrie parola nouă.", save: "Salvează", passOk: "Parola a fost actualizată.",
      synced: "Salvat în cloud", saving: "Se salvează…", offline: "Fără conexiune · se salvează la revenire", logout: "Deconectare", account: "Contul tău", net: "Nu s-a putut conecta. Verifică conexiunea și încearcă din nou." }
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
.ze-av{width:40px;height:40px;border-radius:50%;border:1px solid var(--line-2);background:var(--accent);color:#fff;font-weight:800;font-size:15px;display:grid;place-items:center;overflow:hidden;position:relative}
.ze-av img{width:100%;height:100%;object-fit:cover}
.ze-av::after{content:"";position:absolute;right:1px;bottom:1px;width:10px;height:10px;border-radius:50%;background:var(--zs,#12B76A);box-shadow:0 0 0 2px var(--card)}
.ze-menu{position:absolute;right:0;top:calc(100% + 10px);width:260px;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--line-2);box-shadow:var(--shadow);z-index:120;
  opacity:0;transform:translateY(-6px) scale(.97);transform-origin:top right;pointer-events:none;transition:opacity .2s,transform .25s}
.ze-acc.open .ze-menu{opacity:1;transform:none;pointer-events:auto}
.ze-menu .mono{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ze-menu b{display:block;font-size:14px;margin-top:4px;word-break:break-all}
.ze-st{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--muted);margin:12px 0;padding:10px 12px;border-radius:12px;background:var(--bg)}
.ze-st i{width:8px;height:8px;border-radius:50%;background:var(--zs,#12B76A)}
.ze-menu button{width:100%;height:44px;border-radius:12px;border:1px solid var(--line-2);font-weight:700;font-size:14px}
.ze-menu button:hover{background:var(--fg);color:var(--bg)}
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

  /* ---------- datos ---------- */
  let status = "synced";
  const listeners = new Set();
  const setStatus = s => { status = s; listeners.forEach(f => f(s)); };
  async function load(tool){
    if (!user) return null;
    const { data, error } = await sb.from("user_data").select("data").eq("tool", tool).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }
  const pending = {}, timers = {};
  function save(tool, data, now){
    if (!user) return;
    pending[tool] = data; setStatus("saving");
    clearTimeout(timers[tool]); timers[tool] = setTimeout(() => flush(tool), now ? 0 : 900);
  }
  async function flush(tool){
    const data = pending[tool]; if (!data) return;
    delete pending[tool];
    const { error } = await sb.from("user_data").upsert({ user_id: user.id, tool, data, updated_at: new Date().toISOString() });
    if (error){ pending[tool] = pending[tool] || data; setStatus("offline"); setTimeout(() => flush(tool), 8000); return; }
    if (!Object.keys(pending).length) setStatus("synced");
  }
  const flushAll = () => Promise.all(Object.keys(pending).map(flush));
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAll(); });
  addEventListener("pagehide", flushAll);
  addEventListener("online", flushAll);

  async function signOut(){ await flushAll(); await sb.auth.signOut(); }

  /* ---------- botón de cuenta en la cabecera ---------- */
  function mountAccount(container){
    if (!online || !user || !container) return;
    injectCss();
    const meta = user.user_metadata || {};
    const initial = (meta.full_name || user.email || "?").trim()[0].toUpperCase();
    const wrap = document.createElement("div"); wrap.className = "ze-acc";
    wrap.innerHTML = `<button class="ze-av" aria-label="${t("account")}">${meta.avatar_url ? `<img src="${esc(meta.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial)}</button>
      <div class="ze-menu"><span class="mono">${t("account")}</span><b>${esc(user.email || "")}</b><div class="ze-st"><i></i><span></span></div><button type="button" data-out>${t("logout")}</button></div>`;
    container.insertBefore(wrap, container.firstChild);
    const paint = s => {
      const col = s === "offline" ? "#E5484D" : s === "saving" ? "#FFC24B" : "#12B76A";
      wrap.style.setProperty("--zs", col); wrap.querySelector(".ze-st span").textContent = t(s);
    };
    paint(status); listeners.add(paint);
    wrap.querySelector(".ze-av").addEventListener("click", e => { e.stopPropagation(); wrap.classList.toggle("open"); paint(status); });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) wrap.classList.remove("open"); });
    wrap.querySelector("[data-out]").addEventListener("click", signOut);
  }

  window.ZE = { online, requireUser, load, save, flushAll, signOut, mountAccount, get user(){ return user; } };
})();
