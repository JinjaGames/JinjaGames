// Anime quizleri: AniList'in herkese açık verisinden (popülerlik, sezon, karakterler) her açılışta yeni sorular üretir.
// Sorular trivia biçimindedir: karakter görseli + dört şık.
const API = "https://graphql.anilist.co";

// Dönemler: oyuncu kurulumda seçer
export const ERAS = [
  ["pop", "Tüm zamanlar"],
  ["trend", "Şu an popüler"],
  ["new", "Son 3 yıl"],
  ["old", "2005 öncesi"],
];

export const ANIME_QUIZZES = [
  { id: "an-char-anime", name: "Bu Karakter Hangi Animeden?", emoji: "🐉", kind: "trivia", genre: "Anime", cat: "Anime", anime: "char-anime", desc: "Karakterin görseline bak, hangi animeden olduğunu bil." },
  { id: "an-char-name", name: "Bu Anime Karakteri Kim?", emoji: "🦸", kind: "trivia", genre: "Anime", cat: "Anime", anime: "char-name", desc: "Görseldeki karakterin adını dört şıktan bul." },
  { id: "an-cover", name: "Kapaktan Animeyi Bil", emoji: "📺", kind: "trivia", genre: "Anime", cat: "Anime", anime: "cover", desc: "Anime kapak görselinden hangi anime olduğunu bil." },
  { id: "an-year", name: "Bu Anime Hangi Yıl Çıktı?", emoji: "🧙", kind: "trivia", genre: "Anime", cat: "Anime", anime: "year", desc: "Popüler animelerin çıkış yılını tahmin et." },
];

const QUERY = `query($page:Int,$sort:[MediaSort],$from:FuzzyDateInt,$to:FuzzyDateInt){
  Page(page:$page,perPage:50){
    media(type:ANIME,isAdult:false,sort:$sort,startDate_greater:$from,startDate_lesser:$to,format_in:[TV,MOVIE,ONA]){
      id seasonYear title{romaji english} coverImage{large}
      characters(sort:[ROLE,FAVOURITES_DESC],perPage:6){nodes{id name{full} image{large}}}
    }
  }
}`;

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const title = (m) => (m.title.english || m.title.romaji || "").trim().slice(0, 80);
const okImg = (u) => typeof u === "string" && /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\//.test(u) && !/default\.(jpg|png)$/.test(u);
const memo = new Map();

async function media(era) {
  if (memo.has(era)) return memo.get(era);
  const y = new Date().getFullYear();
  const vars = { pop: { sort: ["POPULARITY_DESC"] }, trend: { sort: ["TRENDING_DESC", "POPULARITY_DESC"] }, new: { sort: ["POPULARITY_DESC"], from: (y - 3) * 10000 }, old: { sort: ["POPULARITY_DESC"], to: 20050000 } }[era] || { sort: ["POPULARITY_DESC"] };
  const p = (async () => {
    const pages = await Promise.all([1, 2].map((page) =>
      fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: QUERY, variables: { ...vars, page } }) })
        .then((r) => { if (!r.ok) throw Error("AniList yanıt vermedi"); return r.json(); })));
    const list = pages.flatMap((j) => j?.data?.Page?.media || []).filter((m) => title(m));
    const seen = new Set();
    return list.filter((m) => !seen.has(title(m).toLowerCase()) && seen.add(title(m).toLowerCase()));
  })();
  memo.set(era, p);
  p.catch(() => memo.delete(era));
  return p;
}

const pick = (arr, n, not) => shuffle(arr.filter((x) => !not.includes(x))).slice(0, n);

/** Bir anime quizi için soru listesi üretir (trivia biçimi). */
export async function animeItems(kind, era = "pop") {
  const ms = await media(era);
  const titles = ms.map(title);
  const items = [];
  if (kind === "char-anime" || kind === "char-name") {
    const chars = [];
    for (const m of ms) for (const c of (m.characters?.nodes || []).slice(0, kind === "char-name" ? 4 : 2)) if (okImg(c.image?.large) && c.name?.full) chars.push({ c, m });
    const allNames = chars.map((x) => x.c.name.full.trim());
    for (const { c, m } of shuffle(chars)) {
      const name = c.name.full.trim();
      if (kind === "char-anime") {
        items.push({ q: "Bu karakter hangi animeden?", a: [title(m), ...pick(titles, 3, [title(m)])], img: c.image.large, iw: "q" });
      } else {
        // aynı animeden karakterler varsa onları şık yap (daha zor), yetmezse başka animelerden
        const same = (m.characters?.nodes || []).map((x) => x.name?.full?.trim()).filter((x) => x && x !== name);
        const wrong = [...shuffle(same).slice(0, 2), ...pick(allNames, 3, [name, ...same])].slice(0, 3);
        items.push({ q: `${title(m)}: Bu karakter kim?`, a: [name, ...wrong], img: c.image.large, iw: "q" });
      }
    }
  } else if (kind === "cover") {
    for (const m of shuffle(ms)) if (okImg(m.coverImage?.large)) items.push({ q: "Bu kapak hangi animenin?", a: [title(m), ...pick(titles, 3, [title(m)])], img: m.coverImage.large, iw: "q" });
  } else if (kind === "year") {
    for (const m of shuffle(ms)) {
      const yr = m.seasonYear;
      if (!yr) continue;
      const opts = shuffle([-6, -4, -3, -2, -1, 1, 2, 3, 4, 6]).map((d) => yr + d).filter((v) => v <= new Date().getFullYear() + 1).slice(0, 3);
      if (opts.length < 3) continue;
      items.push({ q: `${title(m)} hangi yıl çıktı?`, a: [String(yr), ...opts.map(String)], img: okImg(m.coverImage?.large) ? m.coverImage.large : undefined, iw: "a" });
    }
  }
  // şıklar birbirinden farklı olmalı
  return items.filter((it) => new Set(it.a.map((x) => x.toLowerCase())).size === it.a.length && it.a.length === 4).slice(0, 100);
}
