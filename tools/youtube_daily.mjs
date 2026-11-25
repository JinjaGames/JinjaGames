// JinjaQuiz günlük YouTube verisi (GitHub Actions, YT_API_KEY sırrı ile):
//  1) Sıralama quizleri: her sanatçının Deezer'daki en bilinen 10 şarkısının YouTube izlenme sayıları →
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
  if (units + cost > BUDGET) throw new Quota("bütçe");
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
async function rankArtists() {
  const src = await readFile(new URL("quiz/js/rank.js", ROOT), "utf8");
  const list = [...src.matchAll(/name: "([^"]+)", artistId: (\d+)/g)].map((m) => ({ id: m[2], name: m[1] }));
  // topluluğun oluşturduğu sıralama quizlerinin sanatçıları da
  const comm = await load(new URL("quiz/data/community.json", ROOT), { events: [] });
  for (const e of comm.events || []) {
    try { const c = JSON.parse(e.content); if (c.kind === "rank" && c.artistId && c.artist) list.push({ id: String(c.artistId), name: String(c.artist).slice(0, 80) }); } catch {}
  }
  const seen = new Set();
  return list.filter((a) => /^\d+$/.test(a.id) && !seen.has(a.id) && seen.add(a.id));
}
async function deezerTop(id) {
  const j = await json(`https://api.deezer.com/artist/${id}/top?limit=100`);
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
  return out.slice(0, 30);
}
async function findVideo(artist, title) {
  const j = await yt("search", { part: "snippet", type: "video", maxResults: 5, q: `${artist} ${strip(title) || title}` }, 100);
  const ft = fold(strip(title) || title), fa = fold(artist);
  for (const it of j.items || []) {
    const vt = fold(it.snippet?.title), ch = fold(it.snippet?.channelTitle);
    if (ft && vt.includes(ft) && (vt.includes(fa) || ch.includes(fa) || fa.includes(ch))) return it.id?.videoId || "";
  }
  return "";
}
async function rank() {
  const data = await load(RANK_FILE, { v: 1, artists: {} });
  data.artists ||= {};
  outer: for (const a of await rankArtists()) {
    const cur = (data.artists[a.id] ||= { name: a.name, vids: {}, songs: [] });
    cur.name = a.name;
    let titles;
    try { titles = await deezerTop(a.id); } catch { continue; }
    if (titles.length < 12) continue;
    cur.titles = titles;
    for (const t of titles.slice(0, TOP)) {
      const k = fold(t);
      const c = cur.vids[k];
      // bulunamayanlar 30 günde bir yeniden aranır
      if (c && (c.id || (Date.parse(today) - Date.parse(c.at || "2000-01-01")) < 30 * 864e5)) continue;
      try { cur.vids[k] = { id: await findVideo(a.name, t), at: today }; }
      catch (e) { if (e instanceof Quota) break outer; throw e; } // kota bitti: yalnızca izlenmeler tazelenir
    }
  }
  // izlenmeleri tazele
  const ids = [...new Set(Object.values(data.artists).flatMap((a) => Object.values(a.vids || {}).map((v) => v.id).filter(Boolean)))];
  try {
    const vs = await views(ids);
    for (const a of Object.values(data.artists)) {
      if (!a.titles) continue;
      a.songs = a.titles.map((t) => ({ t, v: vs.get(a.vids[fold(t)]?.id)?.v || 0 })).sort((x, y) => y.v - x.v);
      // 10 şarkının hepsine bakılmadan sıralama yayınlanmaz (eksik veriyle yanlış sıra olmasın)
      a.ready = a.titles.slice(0, TOP).every((t) => a.vids[fold(t)]) && a.songs.filter((s) => s.v > 0).length >= 5;
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
