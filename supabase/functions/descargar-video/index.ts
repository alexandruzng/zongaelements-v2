/* =========================================================
   ZongaElements · Descargador de vídeos (Instagram y YouTube)
   TikTok va directo desde el navegador (tikwm). Instagram y YouTube
   no dejan, así que esta función hace de intermediaria:

   POST { action:"info", url }  → datos del post y enlaces de sus vídeos/fotos
   POST { action:"file", url }  → devuelve el archivo (solo si el navegador
                                  no puede bajarlo directamente del CDN)

   Orden para sacar la info (de gratis a «gastar petición»):
     1. API interna de Instagram (GraphQL público)
     2. Página de inserción (embed) del post
     3. RapidAPI (respaldo) → secretos RAPIDAPI_KEY, RAPIDAPI_HOST y
        RAPIDAPI_PATH (ej: "/post?url={url}"; {url} = enlace, {code} = shortcode)

   YouTube: ver la sección YOUTUBE más abajo.

   Despliegue: supabase functions deploy descargar-video --no-verify-jwt
   (la sesión se comprueba aquí dentro, así sirve con las claves nuevas).
   ========================================================= */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-type",
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

type Variant = { url: string; width?: number; height?: number };
// variants = el mismo vídeo en varias calidades (de mayor a menor)
type Media = { type: "video" | "image"; url: string; width?: number; height?: number; cover?: string; variants?: Variant[] };
type Info = {
  platform: "instagram"; id: string; author: string; caption: string; cover: string;
  stats: { views?: number; likes?: number; comments?: number }; date?: number; duration?: number;
  media: Media[]; source: string;
};

/* ---------- sesión: solo usuarios con cuenta ---------- */
async function userOk(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
  });
  return r.ok;
}

/* ---------- enlace → shortcode ---------- */
async function shortcodeOf(raw: string) {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (!/(^|\.)instagram\.com$|(^|\.)instagr\.am$/.test(u.hostname)) return null;
  const pick = (p: string) => (p.match(/\/(?:p|reels?|tv)\/([A-Za-z0-9_-]{5,})/) || [])[1] || null;
  let code = pick(u.pathname);
  if (!code && u.pathname.startsWith("/share/")) {
    // enlaces «compartir» (instagram.com/share/reel/…) redirigen al post real
    const r = await fetch(u, { redirect: "follow", headers: { "user-agent": UA } }).catch(() => null);
    if (r) { code = pick(new URL(r.url).pathname); await r.body?.cancel(); }
  }
  return code;
}

/* ---------- 1. GraphQL público ---------- */
const DOC_IDS = ["8845758582119845", "10015901848480474"];
async function viaGraphql(code: string): Promise<Info | null> {
  for (const doc of DOC_IDS) {
    const r = await fetch("https://www.instagram.com/api/graphql", {
      method: "POST",
      headers: {
        "user-agent": UA, "content-type": "application/x-www-form-urlencoded",
        "x-ig-app-id": "936619743392459", "x-fb-lsd": "AVqbxe3J_YA", "x-asbd-id": "129477", "sec-fetch-site": "same-origin",
      },
      body: new URLSearchParams({ lsd: "AVqbxe3J_YA", doc_id: doc, variables: JSON.stringify({ shortcode: code }) }),
    }).catch(() => null);
    if (!r || !r.ok) continue;
    const j = await r.json().catch(() => null);
    const node = j?.data?.xdt_shortcode_media || j?.data?.shortcode_media;
    if (node) return fromNode(node, code, "instagram");
  }
  return null;
}
function fromNode(n: any, code: string, source: string): Info | null {
  const one = (x: any): Media | null => x?.is_video && x.video_url
    ? { type: "video", url: x.video_url, width: x.dimensions?.width, height: x.dimensions?.height, cover: x.display_url }
    : x?.display_url ? { type: "image", url: x.display_url, width: x.dimensions?.width, height: x.dimensions?.height } : null;
  const kids = n.edge_sidecar_to_children?.edges?.map((e: any) => one(e.node)).filter(Boolean) as Media[] | undefined;
  const media = kids?.length ? kids : [one(n)].filter(Boolean) as Media[];
  if (!media.length) return null;
  return {
    platform: "instagram", id: code, source,
    author: n.owner?.username || "",
    caption: n.edge_media_to_caption?.edges?.[0]?.node?.text || "",
    cover: n.display_url || media[0].cover || media[0].url,
    stats: {
      views: n.video_play_count ?? n.video_view_count ?? undefined,
      likes: n.edge_media_preview_like?.count ?? n.edge_liked_by?.count ?? undefined,
      comments: n.edge_media_to_parent_comment?.count ?? n.edge_media_to_comment?.count ?? undefined,
    },
    date: n.taken_at_timestamp, duration: n.video_duration ? Math.round(n.video_duration) : undefined,
    media,
  };
}

/* ---------- 2. Página embed ---------- */
async function viaEmbed(code: string): Promise<Info | null> {
  const r = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, { headers: { "user-agent": UA } }).catch(() => null);
  if (!r || !r.ok) return null;
  const html = await r.text();
  // el JSON del post va escapado dentro de un <script>; se «des-escapa» hasta poder leerlo
  let txt = html;
  for (let i = 0; i < 3 && !/"video_url":"/.test(txt); i++) txt = txt.replace(/\\(["\\/])/g, "$1");
  const unesc = (s: string) => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
  const vids = [...new Set([...txt.matchAll(/"video_url":"([^"]+)"/g)].map(m => unesc(m[1])))];
  const img = (html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/) || [])[1]?.replace(/&amp;/g, "&");
  if (!vids.length && !img) return null;
  const author = (txt.match(/"owner":\{[^}]*"username":"([^"]+)"/) || html.match(/class="UsernameText">([^<]+)</) || [])[1] || "";
  const caption = unesc((txt.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/) || [])[1] || "");
  return {
    platform: "instagram", id: code, source: "embed", author, caption, cover: img || "", stats: {},
    media: vids.length ? vids.map(url => ({ type: "video" as const, url, cover: img })) : [{ type: "image", url: img! }],
  };
}

/* ---------- 3. RapidAPI (respaldo) ----------
   Cada API de RapidAPI responde con una forma distinta, así que se busca
   en toda la respuesta cualquier vídeo/foto. Sirve para casi todas. */
async function viaRapid(code: string, url: string): Promise<Info | null> {
  const key = Deno.env.get("RAPIDAPI_KEY"), host = Deno.env.get("RAPIDAPI_HOST");
  if (!key || !host) return null;
  const path = (Deno.env.get("RAPIDAPI_PATH") || "/post?url={url}")
    .replace("{url}", encodeURIComponent(`https://www.instagram.com/p/${code}/`)).replace("{code}", code).replace("{raw}", encodeURIComponent(url));
  const r = await fetch(`https://${host}${path}`, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": host } }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j) return null;
  if (j.status === false) return null;
  // Instagram Looter devuelve el post tal cual (como shortcode_media, sin envoltorio)
  const node = findKey(j, "shortcode_media") || findKey(j, "xdt_shortcode_media") || (j.__typename || j.display_url ? j : null);
  if (node) { const i = fromNode(node, code, "rapidapi"); if (i) return i; }
  return deepInfo(j, code);
}
function findKey(o: any, k: string): any {
  if (!o || typeof o !== "object") return null;
  if (k in o) return o[k];
  for (const v of Object.values(o)) { const f = findKey(v, k); if (f) return f; }
  return null;
}
function deepInfo(j: any, code: string): Info | null {
  const vids: Media[] = [], imgs: Media[] = [], seen = new Set<string>();
  let author = "", caption = "", likes: number | undefined, views: number | undefined, comments: number | undefined;
  const add = (list: Media[], m: Media) => { const k = m.url.split("?")[0]; if (!seen.has(k)) { seen.add(k); list.push(m); } };
  const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//.test(v);
  (function walk(o: any, key = "") {
    if (Array.isArray(o)) {
      if (/video_versions/i.test(key)) {
        const vs = o.filter(v => isUrl(v?.url)).map(v => ({ url: v.url, width: v.width, height: v.height }))
          .sort((a, b) => (b.height || 0) - (a.height || 0));
        if (vs.length) add(vids, { type: "video", ...vs[0], variants: vs });
      }
      else if (/candidates/i.test(key)) { const b = o.find(v => isUrl(v?.url)); if (b) add(imgs, { type: "image", url: b.url, width: b.width, height: b.height }); }
      else o.forEach(v => walk(v, key));
      return;
    }
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (isUrl(v)) {
        if (/video|download|play/i.test(k) || (/^(url|link|src)$/i.test(k) && /\.mp4/i.test(v))) add(vids, { type: "video", url: v });
        else if (/display_url|thumbnail|image|cover|thumb/i.test(k)) add(imgs, { type: "image", url: v });
      } else if (typeof v === "string") {
        if (!author && /^(username|owner_username|author)$/i.test(k)) author = v;
        if (!caption && /^(caption|caption_text|text|title|description)$/i.test(k) && v.length > 1) caption = v;
      } else if (typeof v === "number") {
        if (likes === undefined && /like_count|likes/i.test(k)) likes = v;
        if (views === undefined && /play_count|view_count|views/i.test(k)) views = v;
        if (comments === undefined && /comment_count|comments/i.test(k)) comments = v;
      } else walk(v, k);
    }
  })(j);
  if (!vids.length && !imgs.length) return null;
  return {
    platform: "instagram", id: code, source: "rapidapi", author, caption,
    cover: imgs[0]?.url || "", stats: { likes, views, comments },
    media: vids.length ? vids.map(v => ({ ...v, cover: imgs[0]?.url })) : imgs,
  };
}

/* =========================================================
   YOUTUBE → API «YouTube Video FAST Downloader 24/7» (RapidAPI)
   Usa la misma RAPIDAPI_KEY. Plan gratis: 100 peticiones/mes,
   vídeos de hasta 50 MB y 1080p.
   La API genera el MP4 (imagen + sonido) en su propio servidor:
   tarda de 20 s a 5 min y luego se puede bajar durante 10 min.

   POST { action:"info",    url }                → título, portada y calidades (1 petición)
   POST { action:"ytprep",  id, quality, kind }  → pide el archivo (1 petición) → { file, alt, sig }
   POST { action:"ytready", file, sig }          → ¿ya está listo? (gratis)
   POST { action:"ytfile",  file, sig }          → el archivo, pasando por aquí (gratis)
   «sig» firma cada enlace que da la API, así esta función solo
   comprueba y reenvía archivos que ha pedido ella misma.
   ========================================================= */
const YT_HOST = Deno.env.get("YT_RAPIDAPI_HOST") || "youtube-video-fast-downloader-24-7.p.rapidapi.com";

function ytIdOf(raw: string) {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  const h = u.hostname.toLowerCase();
  let id: string | null = null, short = false;
  if (/(^|\.)youtu\.be$/.test(h)) id = u.pathname.split("/")[1] || null;
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
    id = u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
    if (!id && m) { id = m[2]; short = m[1] === "shorts"; }
  } else return null;
  return id && /^[\w-]{11}$/.test(id) ? { id, short } : null;
}

async function ytApi(path: string) {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) return { off: true } as const;
  const r = await fetch(`https://${YT_HOST}${path}`, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": YT_HOST } }).catch(() => null);
  if (!r) return { err: "net" } as const;
  if (r.status === 403) return { off: true } as const;   // clave sin suscripción a esta API
  if (r.status === 429) return { err: "busy" } as const; // se acabaron las peticiones del mes
  const txt = await r.text();
  if (!r.ok) { console.error("yt", r.status, txt.slice(0, 300)); return { err: `${r.status}` } as const; }
  try { return { data: JSON.parse(txt) } as const; } catch { return { err: "json" } as const; }
}

async function sign(s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("RAPIDAPI_KEY") || "x"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)));
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
const signedOk = async (file: unknown, sig: unknown) =>
  typeof file === "string" && /^https:\/\//.test(file) && typeof sig === "string" && sig === await sign(file);

async function ytInfo(id: string, short: boolean) {
  // título y canal: oEmbed público de YouTube (no gasta peticiones)
  const meta = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
    .then(r => r.ok ? r.json() : null).catch(() => null);
  const q = await ytApi(`/get_available_quality/${id}`);
  if ("off" in q) return json({ error: "yt_off" }, 503);
  if ("err" in q) return json({ error: q.err === "busy" ? "busy" : "not_found", detail: q.err }, q.err === "busy" ? 429 : 404);
  const list: any[] = Array.isArray(q.data) ? q.data : [];
  // vídeo: H.264 (avc1) en MP4, el que se ve en cualquier móvil; uno por calidad, el de más bitrate
  const best = new Map<number, any>();
  for (const f of list) {
    if (f?.type !== "video" || !/avc1/i.test(f.mime || "")) continue;
    const h = +(String(f.quality).match(/(\d{3,4})p/) || [])[1];
    if (!h || h > 1080) continue;
    if (!best.has(h) || +f.bitrate > +best.get(h).bitrate) best.set(h, f);
  }
  const audio = list.filter(f => f?.type === "audio" && /mp4/.test(f.mime || "")).sort((a, b) => +b.bitrate - +a.bitrate)[0];
  const aSize = +audio?.size || 0;
  const videos = [...best.entries()].sort((a, b) => b[0] - a[0])
    .map(([h, f]) => ({ quality: String(f.id), height: h, size: (+f.size || 0) + aSize || undefined }));
  if (!videos.length) return json({ error: "not_found", detail: "no_mp4" }, 404);
  return json({
    platform: "youtube", id, short, source: "rapidapi",
    author: meta?.author_name || "", caption: meta?.title || "",
    cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    stats: {}, videos,
    audio: audio ? { quality: String(audio.id), size: aSize || undefined, ext: "m4a" } : undefined,
  });
}

async function ytPrep(id: unknown, quality: unknown, kind: unknown) {
  if (typeof id !== "string" || !/^[\w-]{11}$/.test(id) || typeof quality !== "string" || !/^\d{1,4}$/.test(quality))
    return json({ error: "bad_url" }, 400);
  const ep = kind === "audio" ? "download_audio" : kind === "short" ? "download_short" : "download_video";
  const r = await ytApi(`/${ep}/${id}?quality=${quality}`);
  if ("off" in r) return json({ error: "yt_off" }, 503);
  if ("err" in r || !r.data?.file) return json({ error: r.err === "busy" ? "busy" : "not_found", detail: r.err || "no_file" }, 502);
  const file = String(r.data.file), alt = r.data.reserved_file ? String(r.data.reserved_file) : "";
  return json({ file, alt, sig: await sign(file), altSig: alt ? await sign(alt) : "", size: +r.data.size || undefined });
}

async function ytReady(file: string) {
  const r = await fetch(file, { headers: { "user-agent": UA, range: "bytes=0-0" } }).catch(() => null);
  await r?.body?.cancel();
  return json({ ready: !!r && (r.ok || r.status === 206) });
}

/* ---------- archivo (solo CDN de Instagram/Facebook/YouTube) ---------- */
async function stream(u: URL | string) {
  const r = await fetch(u, { headers: { "user-agent": UA } });
  if (!r.ok || !r.body) return json({ error: "upstream", status: r.status }, 502);
  const h = new Headers(CORS);
  h.set("content-type", r.headers.get("content-type") || "application/octet-stream");
  const len = r.headers.get("content-length"); if (len) h.set("content-length", len);
  return new Response(r.body, { headers: h });
}
async function file(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return json({ error: "bad_url" }, 400); }
  if (u.protocol !== "https:" || !/(\.cdninstagram\.com|\.fbcdn\.net)$/.test(u.hostname)) return json({ error: "host" }, 400);
  return stream(u);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await userOk(req))) return json({ error: "auth" }, 401);
  const body = await req.json().catch(() => ({}));
  const { action, url } = body;
  if (action === "ytprep") return ytPrep(body.id, body.quality, body.kind);
  if (action === "ytready" || action === "ytfile") {
    if (!(await signedOk(body.file, body.sig))) return json({ error: "sig" }, 403);
    return action === "ytready" ? ytReady(body.file) : stream(body.file);
  }
  if (typeof url !== "string") return json({ error: "bad_url" }, 400);
  if (action === "file") return file(url);

  const yt = ytIdOf(url);
  if (yt) return ytInfo(yt.id, yt.short);

  const code = await shortcodeOf(url);
  if (!code) return json({ error: "bad_url" }, 400);
  for (const step of [() => viaGraphql(code), () => viaEmbed(code), () => viaRapid(code, url)]) {
    try { const info = await step(); if (info) return json(info); } catch (e) { console.error(e); }
  }
  return json({ error: "not_found" }, 404);
});
