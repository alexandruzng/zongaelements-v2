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
   YOUTUBE (RapidAPI) → secretos:
     RAPIDAPI_KEY      la misma clave de RapidAPI de siempre
     YT_RAPIDAPI_HOST  por defecto youtube-media-downloader.p.rapidapi.com
     YT_RAPIDAPI_PATH  por defecto /v2/video/details?videoId={id}
                       ({id} = id del vídeo, {url} = enlace completo)
   Cada API responde distinto: se recorre toda la respuesta y se
   quedan los formatos MP4, separando los que llevan sonido.
   ========================================================= */
type YtVideo = { url: string; height?: number; width?: number; size?: number; audio: boolean };
type YtInfo = {
  platform: "youtube"; id: string; author: string; caption: string; cover: string;
  stats: { views?: number; likes?: number; comments?: number }; date?: number; duration?: number;
  short: boolean; videos: YtVideo[]; audio?: { url: string; size?: number; ext: string }; source: string;
};

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

const num = (v: unknown) => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && /^\d[\d,.]*$/.test(v.trim())) return +v.replace(/[,.]/g, "");
  return undefined;
};

async function viaYoutube(raw: string, id: string, short: boolean): Promise<YtInfo | "off" | null> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) return "off";
  const host = Deno.env.get("YT_RAPIDAPI_HOST") || "youtube-media-downloader.p.rapidapi.com";
  const path = (Deno.env.get("YT_RAPIDAPI_PATH") || "/v2/video/details?videoId={id}")
    .replace("{id}", id).replace("{url}", encodeURIComponent(raw));
  const r = await fetch(`https://${host}${path}`, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": host } }).catch(() => null);
  if (!r) return null;
  if (r.status === 403) return "off";            // clave sin suscripción a esta API
  if (!r.ok) { console.error("yt", r.status, await r.text().catch(() => "")); return null; }
  const j = await r.json().catch(() => null);
  if (!j || j.status === false || j.errorId && j.errorId !== "Success") return null;

  const vids: YtVideo[] = [], audios: { url: string; size?: number; ext: string; br: number }[] = [];
  let title = "", author = "", cover = "", coverW = 0, views: number | undefined, likes: number | undefined,
    comments: number | undefined, duration: number | undefined, date: number | undefined;
  const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//.test(v);

  (function walk(o: any, path: string) {
    if (Array.isArray(o)) { o.forEach(v => walk(v, path)); return; }
    if (!o || typeof o !== "object") return;
    const link = [o.url, o.link, o.downloadUrl, o.download_url].find(isUrl);
    const mime = String(o.mimeType || o.mime_type || o.mime || o.type || "").toLowerCase();
    const ext = String(o.extension || o.ext || o.container || "").toLowerCase();
    const label = String(o.qualityLabel || o.quality_label || o.quality || o.label || o.resolution || "");
    const looksFormat = link && (mime || ext || label || o.itag || o.height || "hasAudio" in o);
    if (looksFormat && !/thumb|image|avatar|storyboard|caption|subtitle/i.test(path)) {
      const audioOnly = /^audio/.test(mime) || o.hasVideo === false || /\baudio/i.test(path) && !o.height && !/\d{3,4}p/.test(label)
        || /^(m4a|mp3|weba|opus)$/.test(ext);
      if (audioOnly) {
        if (/mp4|m4a|mp3/.test(mime + ext) || /mime=audio%2Fmp4/.test(link))
          audios.push({ url: link, size: num(o.contentLength ?? o.size ?? o.filesize), ext: /mp3/.test(mime + ext) ? "mp3" : "m4a", br: num(o.bitrate) || 0 });
      } else if (/mp4/.test(mime + ext) || /\.mp4|mime=video%2Fmp4/.test(link)) {
        const height = num(o.height) || +(label.match(/(\d{3,4})p/) || [])[1] || undefined;
        const audio = typeof o.hasAudio === "boolean" ? o.hasAudio
          : typeof o.audio === "boolean" ? o.audio
          : /mp4a/.test(mime) || !!o.audioQuality || !!o.audioChannels || /^formats$|muxed|progressive|withaudio/i.test(path.split(".").pop() || "");
        vids.push({ url: link, height, width: num(o.width), size: num(o.contentLength ?? o.size ?? o.filesize), audio });
      }
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") {
        if (!title && /^(title|name)$/i.test(k) && !/channel|author|owner/i.test(path) && v.length > 1) title = v;
        if (!author && (/^(author|channelTitle|channelName|uploader|ownerChannelName)$/i.test(k) || /^name$/i.test(k) && /channel|author|owner/i.test(path))) author = v;
        if (!date && /^(publishDate|uploadDate|publishedAt|published_at|publishedTime)$/i.test(k)) { const d = Date.parse(v); if (d) date = Math.round(d / 1000); }
      }
      if (views === undefined && /^(viewCount|views|view_count)$/i.test(k)) views = num(v);
      if (likes === undefined && /^(likeCount|likes|like_count)$/i.test(k)) likes = num(v);
      if (comments === undefined && /^(commentCount|comments|comment_count)$/i.test(k)) comments = num(v);
      if (duration === undefined && /^(lengthSeconds|duration|length_seconds|durationSeconds)$/i.test(k)) duration = num(v);
      if (/thumb/i.test(k) && v && typeof v === "object") {
        const list = Array.isArray(v) ? v : [v];
        for (const t of list) if (isUrl(t?.url) && (num(t.width) || 1) >= coverW) { cover = t.url; coverW = num(t.width) || 1; }
      }
      if (v && typeof v === "object" && !/thumb/i.test(k)) walk(v, path ? `${path}.${k}` : k);
    }
  })(j, "");

  if (!vids.length) return null;
  // con sonido primero, cada grupo de mayor a menor calidad; sin repetir la misma calidad
  const seen = new Set<string>();
  const videos = vids.sort((a, b) => Number(b.audio) - Number(a.audio) || (b.height || 0) - (a.height || 0))
    .filter(v => { const k = `${v.audio}-${v.height || v.url}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const audio = audios.sort((a, b) => b.br - a.br)[0];
  return {
    platform: "youtube", id, source: "rapidapi", short, author, caption: title,
    cover: cover || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    stats: { views, likes, comments }, date, duration, videos,
    audio: audio ? { url: audio.url, size: audio.size, ext: audio.ext } : undefined,
  };
}

/* ---------- archivo (solo CDN de Instagram/Facebook/YouTube) ---------- */
async function file(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return json({ error: "bad_url" }, 400); }
  if (u.protocol !== "https:" || !/(\.cdninstagram\.com|\.fbcdn\.net|\.googlevideo\.com)$/.test(u.hostname)) return json({ error: "host" }, 400);
  const r = await fetch(u, { headers: { "user-agent": UA } });
  if (!r.ok || !r.body) return json({ error: "upstream", status: r.status }, 502);
  const h = new Headers(CORS);
  h.set("content-type", r.headers.get("content-type") || "application/octet-stream");
  const len = r.headers.get("content-length"); if (len) h.set("content-length", len);
  return new Response(r.body, { headers: h });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await userOk(req))) return json({ error: "auth" }, 401);
  const { action, url } = await req.json().catch(() => ({}));
  if (typeof url !== "string") return json({ error: "bad_url" }, 400);
  if (action === "file") return file(url);

  const yt = ytIdOf(url);
  if (yt) {
    try {
      const info = await viaYoutube(url, yt.id, yt.short);
      if (info === "off") return json({ error: "yt_off" }, 503);
      if (info) return json(info);
    } catch (e) { console.error(e); }
    return json({ error: "not_found" }, 404);
  }

  const code = await shortcodeOf(url);
  if (!code) return json({ error: "bad_url" }, 400);
  for (const step of [() => viaGraphql(code), () => viaEmbed(code), () => viaRapid(code, url)]) {
    try { const info = await step(); if (info) return json(info); } catch (e) { console.error(e); }
  }
  return json({ error: "not_found" }, 404);
});
