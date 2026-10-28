/* =========================================================
   ZongaElements · Avisos de suscripciones (notificaciones push)

   La llama una tarea de pg_cron cada hora (cabecera x-cron-secret).
   A partir de las 14:00 hora de Rumanía revisa las suscripciones de
   cada usuario (user_data, herramienta "finance") y avisa a sus
   dispositivos 7, 3 y 1 día antes del cobro. push_sent evita repetir.

   POST {}             (cron)              → envía los avisos de hoy
   POST { dry:true }   (cron)              → solo dice qué enviaría
   POST { test:true }  (usuario con sesión) → aviso de prueba a sus dispositivos

   Secretos: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, CRON_SECRET
   Despliegue: supabase functions deploy avisos-suscripciones --no-verify-jwt
   ========================================================= */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const TZ = "Europe/Bucharest", HOUR = 14, DAYS = [7, 3, 1];
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "https://zongaecom.site", Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);

/* ---------- fechas (mismo cálculo que la web) ---------- */
type Sub = { id: string; name: string; a: number; cu: string; f: "m" | "y" | "w"; d0: string };
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
function chargeAt(s: Sub, k: number) {
  if (s.f === "w") return addDays(s.d0, k * 7);
  const d0 = parse(s.d0), y = d0.getUTCFullYear(), m = d0.getUTCMonth() + k * (s.f === "y" ? 12 : 1);
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(d0.getUTCDate(), dim))));
}
function nextCharge(s: Sub, from: string) {
  if (s.d0 >= from) return s.d0;
  let k = s.f === "w" ? Math.floor(diffDays(s.d0, from) / 7) : Math.floor(diffDays(s.d0, from) / (s.f === "y" ? 366 : 31));
  while (chargeAt(s, k) < from) k++;
  return chargeAt(s, k);
}
function localNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { today: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/* ---------- textos ---------- */
const LOC: Record<string, string> = { es: "es-ES", en: "en-IE", ro: "ro-RO" };
const TX: Record<string, { t7: string; t3: string; t1: string; body: string; testT: string; testB: string }> = {
  es: { t7: "🔔 {s} te cobra en 7 días", t3: "⏳ {s} te cobra en 3 días", t1: "⚠️ Mañana te cobra {s}", body: "{a} el {d}. Si ya no la usas, aún estás a tiempo de cancelarla.",
        testT: "✅ Avisos activados", testB: "Te avisaremos 7, 3 y 1 día antes de cada cobro, a las 14:00." },
  en: { t7: "🔔 {s} charges you in 7 days", t3: "⏳ {s} charges you in 3 days", t1: "⚠️ {s} charges you tomorrow", body: "{a} on {d}. If you no longer use it, there's still time to cancel.",
        testT: "✅ Reminders on", testB: "We'll remind you 7, 3 and 1 day before each charge, at 14:00." },
  ro: { t7: "🔔 {s} îți ia bani în 7 zile", t3: "⏳ {s} îți ia bani în 3 zile", t1: "⚠️ Mâine îți ia bani {s}", body: "{a} pe {d}. Dacă nu-l mai folosești, mai ai timp să-l anulezi.",
        testT: "✅ Notificări activate", testB: "Te anunțăm cu 7, 3 și 1 zi înainte de fiecare plată, la ora 14:00." },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
function message(lang: string, s: Sub, days: number, charge: string) {
  const T = TX[lang] || TX.es, loc = LOC[lang] || LOC.es;
  const a = new Intl.NumberFormat(loc, { style: "currency", currency: s.cu === "RON" ? "RON" : "EUR" }).format(s.a);
  const d = parse(charge).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return { title: fill(days === 7 ? T.t7 : days === 3 ? T.t3 : T.t1, { s: s.name }), body: fill(T.body, { a, d }), tag: `sub-${s.id}-${charge}`, url: "/herramientas/finanzas.html#subs" };
}

/* ---------- envío ---------- */
type Device = { endpoint: string; user_id: string; p256dh: string; auth: string; lang: string };
async function push(dev: Device, payload: unknown) {
  try {
    await webpush.sendNotification({ endpoint: dev.endpoint, keys: { p256dh: dev.p256dh, auth: dev.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 20, urgency: "high" });
    await db.from("push_subs").update({ last_ok: new Date().toISOString() }).eq("endpoint", dev.endpoint);
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await db.from("push_subs").delete().eq("endpoint", dev.endpoint);   // el dispositivo ya no existe
    console.error("push", code, (e as Error).message);
    return false;
  }
}

async function run(dry: boolean, force: boolean) {
  const { today, hour } = localNow();
  if (hour < HOUR && !force) return { skipped: `antes de las ${HOUR}:00`, today, hour };
  const { data: devices, error } = await db.from("push_subs").select("endpoint,user_id,p256dh,auth,lang");
  if (error) throw error;
  const byUser = new Map<string, Device[]>();
  for (const d of devices as Device[]) byUser.set(d.user_id, [...(byUser.get(d.user_id) || []), d]);
  if (!byUser.size) return { today, hour, users: 0, due: [] };
  const { data: rows, error: e2 } = await db.from("user_data").select("user_id,data").eq("tool", "finance").in("user_id", [...byUser.keys()]);
  if (e2) throw e2;
  const due: { user: string; sub: string; charge: string; days: number; sent?: number }[] = [];
  for (const row of rows || []) {
    const subs: Sub[] = (row.data && row.data.subs) || [];
    for (const s of subs) {
      if (!s || !s.d0 || !(s.a > 0)) continue;
      const charge = nextCharge(s, today), days = diffDays(today, charge);
      if (!DAYS.includes(days)) continue;
      const { data: done } = await db.from("push_sent").select("days").eq("user_id", row.user_id).eq("sub_id", s.id).eq("charge", charge).eq("days", days).maybeSingle();
      if (done) continue;
      const item = { user: row.user_id, sub: s.name, charge, days, sent: 0 };
      if (!dry) {
        for (const dev of byUser.get(row.user_id) || []) if (await push(dev, message(dev.lang, s, days, charge))) item.sent!++;
        if (item.sent) await db.from("push_sent").insert({ user_id: row.user_id, sub_id: s.id, charge, days });
      }
      due.push(item);
    }
  }
  return { today, hour, users: byUser.size, due };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const body = await req.json().catch(() => ({}));

  // tarea programada
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") === secret) {
    try { return json(await run(!!body.dry, !!body.force)); }
    catch (e) { console.error(e); return json({ error: (e as Error).message }, 500); }
  }

  // aviso de prueba desde la web: solo a los dispositivos de quien lo pide
  if (body.test) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "auth" }, 401);
    const { data: devs } = await db.from("push_subs").select("endpoint,user_id,p256dh,auth,lang").eq("user_id", u.user.id);
    let sent = 0;
    for (const d of (devs || []) as Device[]) {
      const T = TX[d.lang] || TX.es;
      if (await push(d, { title: T.testT, body: T.testB, tag: "test", url: "/herramientas/finanzas.html#subs" })) sent++;
    }
    return json({ sent, devices: (devs || []).length });
  }
  return json({ error: "forbidden" }, 403);
});
