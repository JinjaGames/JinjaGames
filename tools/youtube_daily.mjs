// JinjaQuiz günlük YouTube verisi (GitHub Actions, YT_API_KEY sırrı ile):
//  1) Sıralama quizleri: her sanatçının YouTube'da en çok izlenen müzik videoları (haftada bir arama, her gün izlenme) →
//     quiz/data/rank-yt.json. Sıralama bu izlenmelere göre yapılır, çözümde "57M" gibi gösterilir.
//  2) Anime opening quizi: popüler animelerin openingleri (şarkı adları MyAnimeList/Jikan'dan, video YouTube'dan)
//     → quiz/data/anime-ops.json. Havuz her gün biraz büyür.
// YouTube günlük kotası 10.000 birim: arama 100, izlenme sorgusu 1 birim. Video eşleşmeleri saklandığı için
// ilk günlerden sonra her gün yalnızca izlenmeler tazelenir (birkaç birim) ve kalan kota yeni şarkılara/openinglere gider.
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.YT_API_KEY;
if (!KEY) { console.log("YT_API_KEY tanımlı değil; atlandı."); process.exit(0); }
const ROOT = new URL("../", import.meta.url);
const RANK_FILE = new URL("quiz/data/rank-yt.json", ROOT);
const OPS_FILE = new URL("quiz/data/anime-ops.json", ROOT);
const BUDGET = Number(process.env.YT_BUDGET || 9000);
const RESERVE = 300; // izlenme tazeleme için her zaman ayrılan kota (arama bunu yiyemez)
const SEARCH = process.env.YT_SEARCH !== "0"; // 0: yalnızca izlenmeleri tazele
const TOP = 10; // sanatçı başına izlenmesi bakılan şarkı
const OP_MAX = 400;
const OP_PER_DAY = 25;
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fold = (v) => String(v ?? "").toLocaleLowerCase("tr").replaceAll("ı", "i").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "");
const alternate = /\b(remix|rmx|live|canli|konser|karaoke|acoustic|akustik|speed ?up|sped ?up|slowed|reverb|instrumental|enstrumantal|cover|remaster(ed)?|demo|reprise|extended|version|versiyon|mix|edit|nightcore|8d)\b/i;
const strip = (t) => String(t || "").replace(/\s*[([].*?[)\]]/g, "").trim();

class Quota extends Error {}
let units = 0;
async function yt(path, params, cost) {
  if (units + cost > (path === "search" ? BUDGET - RESERVE : BUDGET)) throw new Quota("bütçe");
  if (path === "search" && !SEARCH) throw new Quota("arama kapalı");
  units += cost;
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set("key", KEY);
  const r = await fetch(u);
  if (r.status === 403) {
    const j = await r.json().catch(() => ({}));
    if (/quota/i.test(JSON.stringify(j))) throw new Quota("kota");
    throw Error(`YouTube 403: ${j?.error?.message || ""}`);
  }
  if (!r.ok) throw Error(`YouTube ${r.status}`);
  return r.json();
}
async function json(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
      if (!r.ok) throw Error(`${r.status}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1000); }
  }
}
const load = async (f, d) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return d; } };
/** İzlenmeleri 50'şerli toplu sorgu ile getirir (1 birim / 50 video). */
async function views(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const j = await yt("videos", { part: "statistics,status", id: ids.slice(i, i + 50).join(","), maxResults: 50 }, 1);
    for (const v of j.items || []) out.set(v.id, { v: Number(v.statistics?.viewCount) || 0, embed: v.status?.embeddable !== false });
  }
  return out;
}

// ---------- 1) sıralama ----------
// Sıra, sanatçının YouTube'da GERÇEKTEN en çok izlenen müzik videolarına göre kurulur: haftada bir
// "sanatçı adı" ile müzik kategorisinde izlenmeye göre arama yapılır (100 birim), bulunan videolar
// şarkı adlarına çevrilir; izlenmeler her gün tazelenir (50 video 1 birim). Deezer'ın popüler listesi
// yalnızca şarkı adlarını düzgün yazmak ve şaşırtmaca şıklar için kullanılır. Böylece Deezer'da üst
// sıralarda olmayan bir YouTube hiti (ör. Wegh - Kennedy'yi Ben Vurdum) de listeye girer.
const SEARCH_EVERY = 7; // gün
async function rankArtists() {
  const src = await readFile(new URL("quiz/js/rank.js", ROOT), "utf8");
  const list = [...src.matchAll(/name: "([^"]+)", artistId: (\d+)/g)].map((m) => ({ id: m[2], name: m[1] }));
  const seen = new Set();
  return list.filter((a) => /^\d+$/.test(a.id) && !seen.has(a.id) && seen.add(a.id));
}
async function deezerTop(id) {
  // Deezer saniyede birkaç istekten fazlasını reddeder ({error:{code:4}}): yavaş git, gerekirse tekrar dene
  let j;
  for (let i = 0; i < 4; i++) {
    await sleep(400 + i * 1500);
    j = await json(`https://api.deezer.com/artist/${id}/top?limit=100`);
    if (!j?.error) break;
  }
  const seen = new Set();
  const out = [];
  for (const t of j?.data || []) {
    if (String(t.artist?.id) !== String(id)) continue;
    const title = (t.title_short || t.title || "").trim();
    const k = fold(title);
    if (!k || seen.has(k) || alternate.test(t.title || "") || alternate.test(t.title_version || "")) continue;
    seen.add(k);
    out.push(title);
  }
  return out.slice(0, 40);
}
const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
const unent = (s) => String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m));
const NOISE = /\b(official|resmi|music|video|klip|clip|audio|lyrics?|lyric video|sozleri|şarkı sözleri|visualizer|hd|4k|m\/v|mv|prod\.?.*)$/i;
const SKIP = /\b(reaction|tepki|röportaj|interview|canlı yayın|trailer|fragman|teaser|kamera arkası|behind the scenes|making|full album|tüm şarkıları|mix|playlist|dance (practice|performance)|performance video|choreography|koreografi)\b/i;
// "(feat. X)", "(with X)", "(prod. X)" gibi ekleri at; Deezer adlarındaki aynı ekler de böylece eşleşir
const stripFeat = (t) => String(t || "").replace(/\s*[([](?:feat\.?|ft\.?|featuring|with|prod\.?)\s[^)\]]*[)\]]/gi, "").replace(/\s+(?:feat\.?|ft\.?)\s.+$/i, "").trim();
const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
function cleanSong(s) {
  let t = String(s);
  // 'Şarkı' tırnak içindeyse şarkı adı odur (ör. BTS (방탄소년단) 'Dynamite' Official MV)
  const q = t.match(/(?:^|\s)[‘'"“]([^‘'"“”’]{2,80})[’'"”](?=\s|$)/);
  if (q) t = q[1];
  // Latin olmayan ad + parantez içinde Latin ad: Latin olanı al (ör. 뚜두뚜두 (DDU-DU DDU-DU))
  const lat = t.match(/\(([^()]*\p{Script=Latin}[^()]*)\)/u);
  if (lat && nonLatin.test(t.replace(lat[0], ""))) t = lat[1];
  t = t.replace(/\s*[([{【].*?[)\]}】]/g, " ").replace(/\s+(ft\.?|feat\.?|featuring)\s.+$/i, "").replace(/["“”«»]/g, "").replace(/[‘’]/g, "'").replace(/^[#']+|'+$/g, "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) t = t.replace(NOISE, "").replace(/[\s\-–—|:,]+$/, "").trim();
  // TAMAMI BÜYÜK HARF başlıkları düzgün yaz
  if (t.length > 3 && t === t.toLocaleUpperCase("tr") && /\p{L}/u.test(t))
    t = t.toLocaleLowerCase("tr").replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("tr"));
  return t;
}
const firstArtist = (s) => fold(String(s).replace(/\s*\([^)]*\)/g, "").split(/\s*(?:&|,|\bx\b|\bft\.?|\bfeat\.?|\bve\b|\bwith\b)\s*/i)[0]);
/** YouTube videosunun başlığından, video gerçekten bu sanatçının şarkısıysa şarkı adını çıkarır. */
function songOf(artist, title, channel) {
  const raw = unent(title);
  if (alternate.test(raw) || SKIP.test(raw)) return "";
  const fa = fold(artist);
  const parts = raw.split(/\s+[-–—|]\s+/);
  if (parts.length >= 2) {
    if (firstArtist(parts[0]) === fa) return cleanSong(parts.slice(1).join(" - "));
    return "";
  }
  // ayraç yok: başlık sanatçı adıyla başlayıp şarkıyı tırnak içinde veriyorsa
  if (fold(raw).startsWith(fa) && /(?:^|\s)[‘'"“][^‘'"“”’]{2,80}[’'"”](?=\s|$)/.test(raw)) return cleanSong(raw);
  // ya da sanatçının kendi kanalındaysa başlık şarkı adıdır
  const ch = fold(channel);
  if (ch && (ch === fa || ch.startsWith(fa))) return cleanSong(raw.replace(new RegExp(artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), ""));
  return "";
}
async function topVideos(artist) {
  const j = await yt("search", { part: "snippet", type: "video", videoCategoryId: 10, order: "viewCount", maxResults: 50, q: artist }, 100);
  // ham başlık saklanır: kurallar değişirse yeniden aramadan tekrar işlenir
  return (j.items || []).filter((it) => it.id?.videoId).map((it) => ({ id: it.id.videoId, raw: unent(it.snippet?.title), ch: it.snippet?.channelTitle || "" }));
}
// Deezer'daki yazımı tercih et (aynı şarkıysa)
function canonical(song, titles) {
  const k = fold(stripFeat(song));
  return titles.find((t) => fold(stripFeat(t)) === k) || titles.find((t) => { const f = fold(stripFeat(t)); return f.length >= 5 && (k.startsWith(f) || f.startsWith(k)); }) || song;
}
async function rank() {
  const data = await load(RANK_FILE, { v: 2, artists: {} });
  data.v = 2;
  data.artists ||= {};
  const keep = new Set();
  outer: for (const a of await rankArtists()) {
    keep.add(a.id);
    const cur = (data.artists[a.id] ||= { name: a.name, vids: {}, songs: [] });
    cur.name = a.name;
    try { const t = await deezerTop(a.id); if (t.length) cur.titles = t; } catch {}
    const old = cur.ytAt ? (Date.parse(today) - Date.parse(cur.ytAt)) / 864e5 : Infinity;
    // eski biçimde (ham başlıksız) saklananlar bir kez yeniden aranır
    if (old >= SEARCH_EVERY || (cur.yt || []).some((x) => !x.raw)) {
      try { cur.yt = await topVideos(a.name); cur.ytAt = today; }
      catch (e) { if (e instanceof Quota) break outer; console.log(`${a.name}: ${e.message}`); }
    }
  }
  // listeden çıkarılan sanatçılar (ör. eski topluluk sıralamaları) arşivden silinir
  for (const id of Object.keys(data.artists)) if (!keep.has(id)) delete data.artists[id];
  // izlenmeleri tazele: YouTube'da bulunan videolar + daha önce şarkı adıyla bulunanlar
  const ids = [...new Set(Object.values(data.artists).flatMap((a) => [...(a.yt || []).map((x) => x.id), ...Object.values(a.vids || {}).map((v) => v.id)]).filter(Boolean))];
  try {
    const vs = await views(ids);
    for (const a of Object.values(data.artists)) {
      const titles = a.titles || [];
      const best = new Map(); // şarkı (eksiz, katlanmış ad) -> { t, v }
      const used = new Set(); // aynı video iki şarkı adıyla sayılmasın
      const put = (t, id) => {
        t = stripFeat(t);
        const k = fold(t);
        if (!k || fold(t).length < 2) return;
        if (id && used.has(id)) return;
        if (id) used.add(id);
        const v = (id && vs.get(id)?.v) || 0;
        const p = best.get(k);
        if (!p || v > p.v) best.set(k, { t: p && p.v >= v ? p.t : t, v: Math.max(v, p?.v || 0) });
      };
      for (const x of a.yt || []) { const song = x.raw ? songOf(a.name, x.raw, x.ch) : x.t; if (song) put(canonical(song, titles), x.id); }
      for (const t of titles) put(t, a.vids?.[fold(t)]?.id);
      a.songs = [...best.values()].sort((x, y) => y.v - x.v).slice(0, 60);
      a.ready = !!a.ytAt && a.songs.filter((s) => s.v > 0).length >= 5 && a.songs.length >= 13;
    }
  } catch (e) { if (!(e instanceof Quota)) throw e; }
  return data;
}

// ---------- 2) anime opening ----------
const ANI = `query($page:Int){Page(page:$page,perPage:50){media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC],format_in:[TV,ONA]){idMal title{romaji english}}}}`;
async function ops() {
  const data = await load(OPS_FILE, { v: 1, items: [], tried: {} });
  data.items ||= []; data.tried ||= {};
  if (data.items.length >= OP_MAX) return data;
  let list = [];
  for (const page of [1, 2, 3, 4, 5, 6]) {
    const r = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: ANI, variables: { page } }) });
    if (!r.ok) break;
    list.push(...((await r.json())?.data?.Page?.media || []));
    await sleep(800);
  }
  let added = 0;
  for (const m of list) {
    if (added >= OP_PER_DAY || data.items.length >= OP_MAX) break;
    if (!m.idMal || data.tried[m.idMal]) continue;
    const anime = (m.title.english || m.title.romaji || "").trim().slice(0, 80);
    let th;
    try { th = await json(`https://api.jikan.moe/v4/anime/${m.idMal}/themes`); } catch { console.log("Jikan'a ulaşılamadı; openingler bugün atlandı."); break; }
    await sleep(500);
    data.tried[m.idMal] = today;
    // ilk iki opening: 1: "Guren no Yumiya" by Linked Horizon (eps 1-13)
    for (const raw of (th?.data?.openings || []).slice(0, 2)) {
      const mm = String(raw).match(/"(.+?)"/);
      const song = mm ? strip(mm[1]).replace(/\s+/g, " ").slice(0, 80) : "";
      if (!song || !anime) continue;
      try {
        const j = await yt("search", { part: "snippet", type: "video", videoEmbeddable: "true", maxResults: 5, q: `${anime} opening ${song}` }, 100);
        const fs = fold(song);
        const hit = (j.items || []).find((it) => fs && fold(it.snippet?.title).includes(fs));
        if (hit?.id?.videoId) { data.items.push({ yt: hit.id.videoId, s: 0, anime, song, mal: m.idMal }); added++; }
      } catch (e) { if (e instanceof Quota) return data; throw e; }
    }
  }
  // gömülemeyen ya da kaldırılan videoları ayıkla
  try {
    const vs = await views(data.items.map((x) => x.yt));
    data.items = data.items.filter((x) => vs.get(x.yt)?.embed);
  } catch (e) { if (!(e instanceof Quota)) throw e; }
  return data;
}

const r = await rank();
r.updated = today;
await writeFile(RANK_FILE, JSON.stringify(r));
const ready = Object.values(r.artists).filter((a) => a.ready).length;
let o;
try { o = await ops(); o.updated = today; await writeFile(OPS_FILE, JSON.stringify(o)); } catch (e) { console.log("Opening toplama hatası:", e.message); }
console.log(`Sıralama: ${ready}/${Object.keys(r.artists).length} sanatçı hazır · Opening: ${o?.items?.length ?? "?"} · kullanılan kota: ${units}`);
