// Favoriler: kalbe basılan quizler bu tarayıcıda saklanır ve kaç kişinin kalplediği herkese görünür. Sunucusuz:
// her oyuncunun tek bir imzalı Nostr kaydı vardır (NIP-78, kind 30078, d = "jqfavs"); içinde favori quizlerinin
// listesi durur. Bir quizin kalp sayısı = listesinde o quiz olan farklı kişi sayısı. Röleler eski kayıtları
// silebileceği için tools/archive_community.mjs listeleri quiz/data/favs.json içine biriktirir; site ikisini birleştirir.
import { sign, myPubkey, blocked, onOutbox, outboxSoon, relayRead } from "./community.js?v=15";

const KIND = 30078;
const TAG = "jinjaquiz-favs";
const D = "jqfavs";
export const FAV_MAX = 300;
const LOCAL = "jqFavs";
const DIRTY = "jqFavsDirty";
const CACHE = "jqFavsCache";
const REFRESH = 10 * 60 * 1000;
const local = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
/** Kalplenebilir quiz kimliği (kişisel listeler hariç); değilse "". */
export const favKey = (id) => {
  const k = String(id ?? "").toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(k) && !/^(my|dz)/.test(k) ? k : "";
};
const cleanList = (a) => [...new Set((Array.isArray(a) ? a : []).map(favKey).filter(Boolean))].slice(0, FAV_MAX);

let mine = cleanList(local.get(LOCAL, []));
const counts = new Map(); // quiz -> kalp sayısı (bu tarayıcı hariç)
let loaded = false;
const listeners = new Set();
const tell = () => listeners.forEach((fn) => { try { fn(); } catch {} });
export const onFavs = (fn) => listeners.add(fn);
export const favsLoaded = () => loaded;
/** Bu tarayıcının favorileri (en yeni önde) */
export const favList = () => [...mine];
export const isFav = (id) => mine.includes(favKey(id));
/** Quizin kalp sayısı (kendi kalbin dahil) */
export const favCount = (id) => { const k = favKey(id); return k ? (counts.get(k) || 0) + (mine.includes(k) ? 1 : 0) : 0; };

/** Kalbe basıldı: favoriye ekler ya da çıkarır. Dönüş: yeni durum (true = favoride). */
export function toggleFav(id) {
  const k = favKey(id);
  if (!k) return false;
  const on = !mine.includes(k);
  mine = on ? [k, ...mine].slice(0, FAV_MAX) : mine.filter((x) => x !== k);
  local.set(LOCAL, mine);
  local.set(DIRTY, 1);
  tell();
  outboxSoon(); // art arda basışlar tek kayıtla, oynanma sayılarıyla birlikte gider
  return on;
}
// başka sekmede kalbe basıldı
addEventListener("storage", (e) => {
  if (e.key !== LOCAL) return;
  mine = cleanList(local.get(LOCAL, []));
  tell();
});
onOutbox(() => {
  if (!local.get(DIRTY, 0)) return [];
  local.set(DIRTY, 0);
  return [{ e: sign(KIND, [["d", D], ["t", TAG], ["client", "jinjagames.com/quiz"]], JSON.stringify({ v: 1, f: mine })), done: (ok) => { if (!ok) local.set(DIRTY, 1); } }];
});
const flush = () => { if (local.get(DIRTY, 0)) outboxSoon(3000); };

function parse(e) {
  const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
  if (d !== D || !e.tags.some((t) => t[0] === "t" && t[1] === TAG)) return null;
  let c;
  try { c = JSON.parse(e.content); } catch { return null; }
  if (!c || c.v !== 1 || !Array.isArray(c.f)) return null;
  return { pk: e.pubkey.slice(0, 12), at: e.created_at, f: cleanList(c.f) };
}
function readCache() {
  const c = local.get(CACHE, null);
  if (!c || !Number.isFinite(c.at) || Date.now() - c.at > REFRESH || Date.now() < c.at || !Array.isArray(c.t)) return false;
  counts.clear();
  for (const e of c.t) if (Array.isArray(e) && favKey(e[0]) && Number.isInteger(e[1]) && e[1] > 0) counts.set(e[0], e[1]);
  return true;
}
let loadP = null, loadAt = 0;
/** Kalp sayılarını toplar (arşiv + röleler). En çok 10 dakikada bir yeniden sorar. */
export function loadFavs({ fresh = false } = {}) {
  if (!loadP && readCache()) {
    loaded = true;
    loadAt = Date.now();
    loadP = Promise.resolve();
    flush();
    queueMicrotask(tell);
    return loadP;
  }
  if (loadP && (!fresh || Date.now() - loadAt < REFRESH)) return loadP;
  loadAt = Date.now();
  loadP = (async () => {
    flush();
    const me = myPubkey().slice(0, 12);
    const last = new Map(); // kişi -> { at, f }
    const put = (pk, at, f) => { const p = last.get(pk); if (!p || at > p.at) last.set(pk, { at, f }); };
    const bl = await blocked();
    const bad = (pk) => [...bl.pubkeys].some((x) => x.startsWith(pk));
    try {
      const r = await fetch(new URL("../data/favs.json", import.meta.url), { cache: "no-cache" });
      const j = r.ok ? await r.json() : null;
      for (const [pk, v] of Object.entries(j?.by || {})) if (/^[0-9a-f]{12}$/.test(pk) && v && Number.isInteger(v.at) && !bad(pk)) put(pk, v.at, cleanList(v.f));
    } catch {}
    for (const e of await relayRead({ kinds: [KIND], "#t": [TAG], limit: 5000 })) {
      const p = parse(e);
      if (p && !bad(p.pk)) put(p.pk, p.at, p.f);
    }
    counts.clear();
    for (const [pk, v] of last) if (pk !== me) for (const k of v.f) counts.set(k, (counts.get(k) || 0) + 1);
    local.set(CACHE, { at: Date.now(), t: [...counts] });
    loaded = true;
    tell();
  })().catch(() => { loaded = true; });
  return loadP;
}
