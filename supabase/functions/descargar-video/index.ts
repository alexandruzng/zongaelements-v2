/* =========================================================
   ZongaElements · Descargador de vídeos (parte de Instagram)
   TikTok va directo desde el navegador (tikwm). Instagram no deja,
   así que esta función hace de intermediaria:

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
  const node = findKey(j, "shortcode_media") || findKey(j, "xdt_shortcode_media");
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

/* ---------- archivo (solo CDN de Instagram/Facebook) ---------- */
async function file(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return json({ error: "bad_url" }, 400); }
  if (u.protocol !== "https:" || !/(\.cdninstagram\.com|\.fbcdn\.net)$/.test(u.hostname)) return json({ error: "host" }, 400);
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

  const code = await shortcodeOf(url);
  if (!code) return json({ error: "bad_url" }, 400);
  for (const step of [() => viaGraphql(code), () => viaEmbed(code), () => viaRapid(code, url)]) {
    try { const info = await step(); if (info) return json(info); } catch (e) { console.error(e); }
  }
  return json({ error: "not_found" }, 404);
});
