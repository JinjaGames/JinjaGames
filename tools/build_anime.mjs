// JinjaQuiz anime quizleri için soru havuzu: AniList'in herkese açık verisinden quiz/data/anime.json üretir.
// Haftada bir çalışır (GitHub Actions). Eski sorular korunur, yeni (o hafta popüler) animelerden gelenler eklenir;
// böylece havuz zamanla büyür. Her quiz için en fazla MAX soru tutulur.
import { readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../quiz/data/", import.meta.url);
const file = (k) => new URL(`anime-${k}.json`, DIR);
const API = "https://graphql.anilist.co";
const MAX = 1500; // quiz başına; dolunca en eski sorular çıkar, yeniler girer
const QUERY = `query($page:Int,$sort:[MediaSort],$from:FuzzyDateInt,$to:FuzzyDateInt,$fmt:[MediaFormat]){
  Page(page:$page,perPage:50){
    media(type:ANIME,isAdult:false,sort:$sort,startDate_greater:$from,startDate_lesser:$to,format_in:$fmt){
      id seasonYear popularity format title{romaji english} coverImage{large} bannerImage
      studios(isMain:true){nodes{name isAnimationStudio}}
      characters(sort:[ROLE,FAVOURITES_DESC],perPage:8){nodes{id name{full} image{large}}}
    }
  }
}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const title = (m) => (m.title.english || m.title.romaji || "").trim().slice(0, 80);
const okImg = (u) => typeof u === "string" && /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/[\w\/.-]{1,200}$/.test(u) && !/default\.(jpg|png)$/.test(u);

async function page(vars) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: QUERY, variables: { fmt: ["TV", "MOVIE", "ONA"], ...vars } }) });
    if (r.status === 429) { await sleep(65000); continue; }
    if (!r.ok) throw Error(`AniList ${r.status}`);
    return (await r.json())?.data?.Page?.media || [];
  }
  throw Error("AniList sınırı aşıldı");
}

async function collect() {
  const y = new Date().getFullYear();
  const jobs = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => ({ page: p, sort: ["POPULARITY_DESC"] })),
    ...[1, 2].map((p) => ({ page: p, sort: ["TRENDING_DESC", "POPULARITY_DESC"] })),
    ...[1, 2, 3].map((p) => ({ page: p, sort: ["POPULARITY_DESC"], from: (y - 3) * 10000 })),
    ...[1, 2, 3].map((p) => ({ page: p, sort: ["POPULARITY_DESC"], to: 20050000 })),
    ...[1, 2, 3, 4].map((p) => ({ page: p, sort: ["POPULARITY_DESC"], fmt: ["MOVIE"] })),
  ];
  const all = new Map();
  for (const v of jobs) {
    for (const m of await page(v)) if (title(m) && !all.has(m.id)) all.set(m.id, m);
    await sleep(2200); // AniList dakikada ~30 isteğe izin veriyor
  }
  // aynı adı taşıyan sezonlardan yalnızca en popüleri
  const byTitle = new Map();
  for (const m of all.values()) { const k = title(m).toLowerCase(); if (!byTitle.has(k) || byTitle.get(k).popularity < m.popularity) byTitle.set(k, m); }
  // aynı serinin sezonları ("X Season 2", "X: Part 2") ayrı anime gibi şık olmasın: kök adı aynı olanlardan en popüleri
  const byRoot = new Map();
  for (const m of byTitle.values()) { const k = root(title(m)); if (!byRoot.has(k) || byRoot.get(k).popularity < m.popularity) byRoot.set(k, m); }
  return [...byRoot.values()].sort((a, b) => b.popularity - a.popularity);
}

const pick = (arr, n, not) => shuffle(arr.filter((x) => !not.includes(x))).slice(0, n);
// serinin kök adı: sezon / bölüm / film ekleri atılır (şıklarda aynı serinin iki adı yan yana çıkmasın)
const root = (t) => t.toLowerCase().replace(/[:\-–].*$/, "").replace(/\b(season|part|the movie|movie|2nd|3rd|\d+th|ii+|final)\b.*$/g, "").replace(/[^a-z0-9]+/g, " ").trim() || t.toLowerCase();
const fold = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
// yanlış şıklar: doğru cevapla ve birbiriyle aynı kök adı taşımaz
const wrongTitles = (titles, t, n) => { const r = root(t), out = []; for (const x of shuffle(titles)) { if (out.length >= n) break; if (x !== t && root(x) !== r && !out.some((y) => root(y) === root(x))) out.push(x); } return out; };
const studioOf = (m) => (m.studios?.nodes || []).find((s) => s.isAnimationStudio)?.name?.trim().slice(0, 60) || "";
function build(ms) {
  const titles = ms.map(title);
  const out = { "char-anime": [], "char-name": [], cover: [], year: [], studio: [], banner: [], movie: [], romaji: [], side: [] };
  const studios = [...new Set(ms.map(studioOf).filter(Boolean))];
  const movies = ms.filter((m) => m.format === "MOVIE").map(title);
  const allNames = ms.flatMap((m) => (m.characters?.nodes || []).map((c) => c.name?.full?.trim()).filter(Boolean));
  for (const m of ms) {
    const t = title(m);
    const chars = (m.characters?.nodes || []).filter((c) => okImg(c.image?.large) && c.name?.full);
    for (const c of chars.slice(0, 2)) out["char-anime"].push({ k: `ca${c.id}`, q: "Bu karakter hangi animeden?", a: [t, ...wrongTitles(titles, t, 3)], img: c.image.large, iw: "q" });
    // yan karakterler (ilk üçten sonrakiler): daha zor
    for (const c of chars.slice(3, 6)) out.side.push({ k: `sd${c.id}`, q: "Bu yan karakter hangi animeden?", a: [t, ...wrongTitles(titles, t, 3)], img: c.image.large, iw: "q" });
    const st = studioOf(m);
    if (st && okImg(m.coverImage?.large) && studios.length > 8) out.studio.push({ k: `st${m.id}`, q: `${t} animesini hangi stüdyo yaptı?`, a: [st, ...pick(studios, 3, [st])], img: m.coverImage.large, iw: "q" });
    if (okImg(m.bannerImage)) out.banner.push({ k: `bn${m.id}`, q: "Bu sahne hangi animeden?", a: [t, ...wrongTitles(titles, t, 3)], img: m.bannerImage, iw: "q" });
    if (m.format === "MOVIE" && okImg(m.coverImage?.large) && movies.length > 8) out.movie.push({ k: `mv${m.id}`, q: "Bu afiş hangi anime filminin?", a: [t, ...wrongTitles(movies, t, 3)], img: m.coverImage.large, iw: "q" });
    // Japonca (romaji) adından animeyi bil: yalnızca İngilizce adı gerçekten farklı olanlar
    const rj = (m.title.romaji || "").trim();
    if (m.title.english && rj && rj.length <= 70 && fold(rj) !== fold(t) && !fold(rj).includes(fold(t)) && !fold(t).includes(fold(rj)))
      out.romaji.push({ k: `rj${m.id}`, q: `Japonca adı “${rj}” olan anime hangisi?`, a: [t, ...wrongTitles(titles, t, 3)], ...(okImg(m.coverImage?.large) ? { img: m.coverImage.large } : {}), iw: "a" });
    for (const c of chars.slice(0, 3)) {
      const name = c.name.full.trim();
      const same = (m.characters?.nodes || []).map((x) => x.name?.full?.trim()).filter((x) => x && x !== name);
      const wrong = [...new Set([...shuffle(same).slice(0, 2), ...pick(allNames, 3, [name, ...same])])].slice(0, 3);
      out["char-name"].push({ k: `cn${c.id}`, q: `${t}: Bu karakter kim?`, a: [name, ...wrong], img: c.image.large, iw: "q" });
    }
    if (okImg(m.coverImage?.large)) out.cover.push({ k: `co${m.id}`, q: "Bu kapak hangi animenin?", a: [t, ...wrongTitles(titles, t, 3)], img: m.coverImage.large, iw: "q" });
    const yr = m.seasonYear;
    if (yr) {
      const opts = shuffle([-6, -4, -3, -2, -1, 1, 2, 3, 4, 6]).map((d) => yr + d).filter((v) => v <= new Date().getFullYear() + 1).slice(0, 3);
      if (opts.length === 3) out.year.push({ k: `yr${m.id}`, q: `${t} hangi yıl çıktı?`, a: [String(yr), ...opts.map(String)], ...(okImg(m.coverImage?.large) ? { img: m.coverImage.large } : {}), iw: "a" });
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].filter((it) => it.a.length === 4 && new Set(it.a.map((x) => x.toLowerCase())).size === 4);
  return out;
}

const fresh = build(await collect());
const pools = {};
let added = 0;
for (const k of Object.keys(fresh)) {
  const seen = new Set();
  let old = [];
  try { old = JSON.parse(await readFile(file(k), "utf8")).items || []; } catch {}
  const keep = old.filter((it) => it?.k && !seen.has(it.k) && seen.add(it.k));
  const extra = fresh[k].filter((it) => !seen.has(it.k) && seen.add(it.k));
  added += extra.length;
  // yeni sorular önde: havuz dolduğunda en eskiler düşer
  pools[k] = [...extra, ...keep].slice(0, MAX);
  await writeFile(file(k), JSON.stringify({ v: 1, updated: new Date().toISOString().slice(0, 10), items: pools[k] }));
}
// kart üstünde soru sayısı göstermek için küçük bir özet (site bütün havuzları indirmeden sayıları bilsin)
await writeFile(new URL("anime-index.json", DIR), JSON.stringify({ v: 1, updated: new Date().toISOString().slice(0, 10), counts: Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])) }));
console.log(Object.entries(pools).map(([k, v]) => `${k}: ${v.length}`).join(", "), `· yeni: ${added}`);
