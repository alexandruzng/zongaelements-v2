/* =========================================================
   ZongaElements · Novedades
   Para anunciar una actualización: añade un objeto AL PRINCIPIO de UPDATES
   con un "id" nuevo. Al publicarlo, todo el mundo verá el pop-up una vez
   y la novedad aparecerá en la sección «Novedades» de la portada.
   tipo: "nuevo" | "mejora" | "arreglo"
   ========================================================= */
(() => {
  const UPDATES = [
    {
      id: "2026-10-18-novedades", date: "2026-10-18", type: "nuevo",
      title: { es: "Sección de novedades", en: "What's new section", ro: "Secțiunea de noutăți" },
      items: {
        es: ["Nueva sección «Novedades» en la portada con todo lo que vamos mejorando.", "Cuando haya una actualización te avisaremos con un aviso como este."],
        en: ["New “What's new” section on the home page with everything we improve.", "When there's an update we'll let you know with a notice like this one."],
        ro: ["Secțiune nouă „Noutăți” pe pagina principală, cu tot ce îmbunătățim.", "Când apare o actualizare te anunțăm cu un mesaj ca acesta."]
      }
    },
    {
      id: "2026-10-18-movil", date: "2026-10-18", type: "mejora",
      title: { es: "Portada rediseñada para móvil", en: "Home page redesigned for mobile", ro: "Pagina principală reproiectată pentru mobil" },
      items: {
        es: ["La portada se ve y se lee mucho mejor en el móvil.", "Mini panel de métricas al entrar y tarjetas de herramientas con su ilustración."],
        en: ["The home page looks and reads much better on mobile.", "Mini metrics panel on arrival and tool cards with their illustration."],
        ro: ["Pagina principală arată și se citește mult mai bine pe mobil.", "Mini panou de metrici la intrare și carduri de instrumente cu ilustrația lor."]
      }
    },
    {
      id: "2026-10-18-cuentas", date: "2026-10-18", type: "nuevo",
      title: { es: "Tu cuenta y tus datos en la nube", en: "Your account and your data in the cloud", ro: "Contul tău și datele tale în cloud" },
      items: {
        es: ["Entra con tu email o con Google.", "Tus tareas y hábitos se guardan en tu cuenta y los tienes en cualquier dispositivo.", "Nueva dirección de la web: zongaecom.site."],
        en: ["Sign in with your email or with Google.", "Your tasks and habits are saved to your account and available on any device.", "New web address: zongaecom.site."],
        ro: ["Intră cu emailul sau cu Google.", "Sarcinile și obiceiurile se salvează în contul tău și le ai pe orice dispozitiv.", "Adresă nouă a site-ului: zongaecom.site."]
      }
    },
    {
      id: "2026-10-18-tipografia", date: "2026-10-18", type: "mejora",
      title: { es: "Titulares más fáciles de leer", en: "Easier-to-read headlines", ro: "Titluri mai ușor de citit" },
      items: {
        es: ["Nueva tipografía en todos los titulares de la web y las herramientas."],
        en: ["New typeface for every headline on the site and in the tools."],
        ro: ["Font nou pentru toate titlurile site-ului și ale instrumentelor."]
      }
    },
    {
      id: "2026-10-18-habitos", date: "2026-10-18", type: "nuevo",
      title: { es: "Nueva herramienta: Rueda de hábitos", en: "New tool: Habit wheel", ro: "Instrument nou: Roata obiceiurilor" },
      items: {
        es: ["Hasta 9 hábitos en una rueda mensual: marca cada día como cumplido, no hecho o «no toca».", "Racha, resumen del mes y notas. Está en Productividad personal."],
        en: ["Up to 9 habits on a monthly wheel: mark each day as done, missed or “day off”.", "Streak, monthly summary and notes. Find it in Personal productivity."],
        ro: ["Până la 9 obiceiuri pe o roată lunară: marchează fiecare zi ca îndeplinită, nefăcută sau „liberă”.", "Serie, rezumatul lunii și notițe. O găsești la Productivitate personală."]
      }
    },
    {
      id: "2026-10-18-planificador", date: "2026-10-18", type: "nuevo",
      title: { es: "Nueva herramienta: Planificador del día", en: "New tool: Daily planner", ro: "Instrument nou: Planificatorul zilei" },
      items: {
        es: ["Calcula tus horas reales de trabajo y ordena tus tareas por importancia.", "Temporizadores opcionales y estadísticas de tus días completados."],
        en: ["Work out your real work hours and sort your tasks by importance.", "Optional timers and stats for your completed days."],
        ro: ["Calculează-ți orele reale de muncă și ordonează sarcinile după importanță.", "Cronometre opționale și statistici pentru zilele complete."]
      }
    }
  ];

  /* ---------- textos ---------- */
  const TX = {
    es: { kick: "Novedades", h1: "Lo último", h2: "en ZongaElements.", p: "Todo lo que vamos añadiendo y mejorando en la web, de lo más nuevo a lo más antiguo.",
      latest: "Última", more: "Ver todas las novedades", less: "Ver menos", popKick: "¡Hemos actualizado ZongaElements!", see: "Ver novedades", ok: "Entendido",
      nuevo: "Nuevo", mejora: "Mejora", arreglo: "Arreglo" },
    en: { kick: "What's new", h1: "The latest", h2: "on ZongaElements.", p: "Everything we keep adding and improving on the site, newest first.",
      latest: "Latest", more: "See all updates", less: "See less", popKick: "We've updated ZongaElements!", see: "See what's new", ok: "Got it",
      nuevo: "New", mejora: "Improved", arreglo: "Fixed" },
    ro: { kick: "Noutăți", h1: "Cele mai noi", h2: "în ZongaElements.", p: "Tot ce adăugăm și îmbunătățim pe site, de la cel mai nou la cel mai vechi.",
      latest: "Ultima", more: "Vezi toate noutățile", less: "Vezi mai puțin", popKick: "Am actualizat ZongaElements!", see: "Vezi noutățile", ok: "Am înțeles",
      nuevo: "Nou", mejora: "Îmbunătățire", arreglo: "Reparat" }
  };
  const lang = () => { try { const l = localStorage.getItem("ze-lang"); return TX[l] ? l : "es"; } catch (e) { return "es"; } };
  const t = k => TX[lang()][k];
  const pick = o => o[lang()] || o.es;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fdate = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(lang(), { day: "numeric", month: "long", year: "numeric" }); };
  const SEEN = "ze-news-seen";
  const store = { get(){ try { return localStorage.getItem(SEEN); } catch (e) { return null; } }, set(v){ try { localStorage.setItem(SEEN, v); } catch (e) {} } };

  /* ---------- estilos (usan los colores de cada página) ---------- */
  function css(){
    if (document.getElementById("zn-css")) return;
    const st = document.createElement("style"); st.id = "zn-css";
    st.textContent = `
.zn-tag{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:100px;font-size:11.5px;font-weight:800;white-space:nowrap}
.zn-tag i{width:6px;height:6px;border-radius:50%;background:currentColor}
.zn-tag.nuevo{background:rgba(18,183,106,.14);color:#0E9F57} .zn-tag.mejora{background:rgba(43,99,255,.13);color:#2B63FF} .zn-tag.arreglo{background:rgba(255,145,0,.15);color:#D97706}
.zn-list{display:flex;flex-direction:column;gap:14px}
.zn-item{position:relative;display:grid;grid-template-columns:150px 1fr;gap:24px;padding:26px 28px;border-radius:24px;background:var(--card);border:1px solid var(--line);transition:transform .4s cubic-bezier(.2,.9,.2,1),border-color .3s,box-shadow .4s}
.zn-item:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
.zn-item.first{border-color:color-mix(in srgb,#12B76A 55%,transparent);box-shadow:0 0 0 4px rgba(18,183,106,.08)}
.zn-meta{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.zn-date{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.zn-latest{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--fg);padding:4px 8px;border-radius:100px}
.zn-item h3{font-family:var(--display);font-weight:800;font-size:clamp(20px,2.2vw,26px);letter-spacing:-.03em;line-height:1.15}
.zn-item ul{list-style:none;margin-top:12px;display:flex;flex-direction:column;gap:8px}
.zn-item li{position:relative;padding-left:20px;color:var(--muted);font-size:15px;line-height:1.5}
.zn-item li::before{content:"";position:absolute;left:2px;top:.62em;width:8px;height:8px;border-radius:3px;background:var(--line-2,rgba(0,0,0,.2))}
.zn-item.hide{display:none}
.zn-more{margin:22px auto 0;display:flex;align-items:center;gap:10px;height:52px;padding:0 24px;border-radius:100px;border:1px solid var(--line-2,rgba(0,0,0,.18));font-weight:700;font-size:15px;background:none;color:var(--fg);cursor:pointer;transition:background .3s,color .3s}
.zn-more:hover{background:var(--fg);color:var(--bg)}
.zn-scrim{position:fixed;inset:0;z-index:650;background:rgba(5,5,8,.5);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;transition:opacity .4s}
.zn-scrim.on{opacity:1}
.zn-pop{position:fixed;left:50%;top:50%;z-index:660;width:min(460px,calc(100% - 28px));max-height:calc(100vh - 40px);overflow-y:auto;transform:translate(-50%,-44%) scale(.94);opacity:0;
  background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:28px;box-shadow:0 40px 80px -30px rgba(0,0,0,.5);transition:opacity .35s,transform .55s cubic-bezier(.3,1.5,.5,1)}
.zn-pop.on{opacity:1;transform:translate(-50%,-50%)}
.zn-head{position:relative;padding:26px 24px 22px;color:#fff;background:radial-gradient(120% 140% at 100% 0%,#3EE694 0%,#0E9F57 45%,#04361F 100%);overflow:hidden}
.zn-head::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px);background-size:30px 30px;mask-image:linear-gradient(180deg,#000,transparent)}
.zn-spark{position:relative;z-index:1;width:52px;height:52px;border-radius:16px;background:#fff;color:#0E9F57;display:grid;place-items:center;margin-bottom:16px;animation:znPop .8s .2s cubic-bezier(.3,1.8,.5,1) both}
.zn-spark svg{width:26px;height:26px}
.zn-head .zn-k{position:relative;z-index:1;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.zn-head h3{position:relative;z-index:1;font-family:var(--display);font-weight:800;font-size:28px;letter-spacing:-.04em;line-height:1.08;margin-top:6px}
.zn-body{padding:20px 24px 24px}
.zn-body .zn-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.zn-body ul{list-style:none;display:flex;flex-direction:column;gap:9px;margin-top:10px}
.zn-body li{position:relative;padding-left:22px;font-size:15px;line-height:1.5;color:var(--fg)}
.zn-body li::before{content:"";position:absolute;left:0;top:.35em;width:14px;height:14px;border-radius:50%;background:rgba(18,183,106,.16) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230E9F57' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5 9-10'/%3E%3C/svg%3E") center/9px no-repeat}
.zn-extra{margin-top:14px;font-size:13px;color:var(--muted)}
.zn-btns{display:flex;gap:10px;margin-top:22px}
.zn-btns button{flex:1;height:50px;border-radius:100px;font-weight:800;font-size:14.5px;cursor:pointer;transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.zn-btns button:hover{transform:translateY(-2px)}
.zn-btns .ghost{border:1px solid var(--line-2,rgba(0,0,0,.18));background:none;color:var(--fg)}
.zn-btns .main{border:0;background:var(--fg);color:var(--bg)}
@keyframes znPop{from{transform:scale(.3) rotate(-20deg);opacity:0}}
@media (max-width:700px){
  .zn-item{grid-template-columns:1fr;gap:12px;padding:20px}
  .zn-meta{flex-direction:row;flex-wrap:wrap;align-items:center}
  .zn-head h3{font-size:24px}
}`;
    document.head.appendChild(st);
  }

  const tag = type => `<span class="zn-tag ${type}"><i></i>${esc(t(type))}</span>`;

  /* ---------- sección de la portada ---------- */
  let expanded = false;
  function renderSection(){
    const el = document.getElementById("znList"); if (!el) return;
    css();
    const SHOW = 4;
    el.innerHTML = `<div class="zn-list">${UPDATES.map((u, i) => `
      <article class="zn-item${i === 0 ? " first" : ""}${i >= SHOW && !expanded ? " hide" : ""}">
        <div class="zn-meta"><span class="zn-date">${esc(fdate(u.date))}</span>${tag(u.type)}${i === 0 ? `<span class="zn-latest">${esc(t("latest"))}</span>` : ""}</div>
        <div><h3>${esc(pick(u.title))}</h3><ul>${pick(u.items).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </article>`).join("")}</div>
      ${UPDATES.length > SHOW ? `<button class="zn-more" type="button" id="znMore">${esc(expanded ? t("less") : `${t("more")} (${UPDATES.length})`)}</button>` : ""}`;
    const more = document.getElementById("znMore");
    if (more) more.onclick = () => { expanded = !expanded; renderSection(); };
    document.querySelectorAll("[data-zn]").forEach(n => { n.textContent = t(n.dataset.zn); });
  }

  /* ---------- pop-up de actualización ---------- */
  function popup({ newsUrl } = {}){
    const u = UPDATES[0];
    if (!u || store.get() === u.id) return;
    css();
    const others = UPDATES.findIndex(x => x.id === store.get());
    const extra = others > 1 ? others - 1 : 0;   // otras novedades que tampoco había visto
    const scrim = document.createElement("div"); scrim.className = "zn-scrim";
    const pop = document.createElement("div"); pop.className = "zn-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-modal", "true");
    pop.innerHTML = `
      <div class="zn-head"><div class="zn-spark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17v4M17 19h4"/></svg></div>
        <span class="zn-k">${esc(t("popKick"))}</span><h3>${esc(pick(u.title))}</h3></div>
      <div class="zn-body">
        <div class="zn-row">${tag(u.type)}<span class="zn-date">${esc(fdate(u.date))}</span></div>
        <ul>${pick(u.items).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        ${extra ? `<p class="zn-extra">+ ${extra} ${lang() === "en" ? "more updates" : lang() === "ro" ? "alte actualizări" : "novedades más"}</p>` : ""}
        <div class="zn-btns"><button class="ghost" type="button" data-a="ok">${esc(t("ok"))}</button><button class="main" type="button" data-a="see">${esc(t("see"))}</button></div>
      </div>`;
    document.body.append(scrim, pop);
    requestAnimationFrame(() => { scrim.classList.add("on"); pop.classList.add("on"); });
    const close = go => {
      store.set(u.id);
      scrim.classList.remove("on"); pop.classList.remove("on");
      setTimeout(() => { scrim.remove(); pop.remove(); }, 450);
      document.removeEventListener("keydown", onKey);
      if (go){
        const target = document.getElementById("novedades");
        if (target) target.scrollIntoView({ behavior: "smooth" });
        else location.href = newsUrl || "../#novedades";
      }
    };
    const onKey = e => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", onKey);
    scrim.onclick = () => close(false);
    pop.querySelector('[data-a="ok"]').onclick = () => close(false);
    pop.querySelector('[data-a="see"]').onclick = () => close(true);
  }

  window.ZN = { updates: UPDATES, renderSection, popup };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderSection); else renderSection();
})();
