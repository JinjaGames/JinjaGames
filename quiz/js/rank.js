// Sıralama quizi: bir sanatçının en çok dinlenen 5 şarkısını 20 şık arasından doğru sırayla diz.
// Sıralama, Deezer'ın sanatçı "en popüler" listesinden (dinlenme sayısına göre) her açılışta güncel alınır.
import { artistTop, isAlternate, fold } from "./music.js?v=4";

export const RANK_CATS = ["Türkçe Rap", "Türkçe Pop", "Türkçe Rock", "Yabancı"];
export const RANK_QUIZZES = [
  { id: "rk-7720944", name: "Wegh", artistId: 7720944, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/581f037adccfedcae5a9dab2a0861368/500x500-000000-80-0-0.jpg" },
  { id: "rk-3254", name: "Tarkan", artistId: 3254, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/71f42a0742089955587933a5e97c41e7/500x500-000000-80-0-0.jpg" },
  { id: "rk-9289", name: "Sezen Aksu", artistId: 9289, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/9c62f746db8e41bb49eb13a3c254f597/500x500-000000-80-0-0.jpg" },
  { id: "rk-8354140", name: "Ezhel", artistId: 8354140, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/86897403b02175990e9d84322a94654a/500x500-000000-80-0-0.jpg" },
  { id: "rk-98336572", name: "UZI", artistId: 98336572, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/65905c1901748c17c176bfd1889cc3ae/500x500-000000-80-0-0.jpg" },
  { id: "rk-12934", name: "Sagopa Kajmer", artistId: 12934, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/861348e7f8b6d93d3e2fff5ea6df2dcd/500x500-000000-80-0-0.jpg" },
  { id: "rk-14546", name: "Ceza", artistId: 14546, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/2af230afdd9e93989d7d7288e93fb536/500x500-000000-80-0-0.jpg" },
  { id: "rk-14414849", name: "Ben Fero", artistId: 14414849, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/cd7de0ac70198ea395e8c43fac6200cd/500x500-000000-80-0-0.jpg" },
  { id: "rk-142875392", name: "Semicenk", artistId: 142875392, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/f213929354a3ce3aaf7e8657507f0e34/500x500-000000-80-0-0.jpg" },
  { id: "rk-72272502", name: "Lvbel C5", artistId: 72272502, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/55eba79b292dbef8e65d5b7b6873b9e8/500x500-000000-80-0-0.jpg" },
  { id: "rk-389038", name: "Murda", artistId: 389038, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/dbd7de9aa7a90a039f18dee17edd84dd/500x500-000000-80-0-0.jpg" },
  { id: "rk-1550629", name: "Cakal", artistId: 1550629, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/cover/e8fd5004eded6099a4d32661639d8f83/500x500-000000-80-0-0.jpg" },
  { id: "rk-11818971", name: "Norm Ender", artistId: 11818971, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/bb95df885ebe58d8988f239d406f345b/500x500-000000-80-0-0.jpg" },
  { id: "rk-575796", name: "Patron", artistId: 575796, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/5e05a8661c673cb97e6e3ca2bf780d48/500x500-000000-80-0-0.jpg" },
  { id: "rk-1666381", name: "Şanışer", artistId: 1666381, rcat: "Türkçe Rap", picture: "https://cdn-images.dzcdn.net/images/artist/781e4e057814a78819df7f233b8bb160/500x500-000000-80-0-0.jpg" },
  { id: "rk-14826", name: "Duman", artistId: 14826, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/420bd789cacec4d562f981f6eae6c76e/500x500-000000-80-0-0.jpg" },
  { id: "rk-16758", name: "maNga", artistId: 16758, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/2d34c47105a1f42e865e4f14403e1fae/500x500-000000-80-0-0.jpg" },
  { id: "rk-12018", name: "Teoman", artistId: 12018, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/658ca2fe2c26477e897ff4e3a0c6f9ed/500x500-000000-80-0-0.jpg" },
  { id: "rk-15049", name: "Mor ve Ötesi", artistId: 15049, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/aee2502f3565318f12a5b90e9fb3d67c/500x500-000000-80-0-0.jpg" },
  { id: "rk-13877", name: "Gripin", artistId: 13877, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/4b35c0d255ee1b30a9a958a6317cd686/500x500-000000-80-0-0.jpg" },
  { id: "rk-6696895", name: "Adamlar", artistId: 6696895, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/80cc98a7616cdede86fb44304a106bde/500x500-000000-80-0-0.jpg" },
  { id: "rk-343660", name: "Model", artistId: 343660, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/b4db20b37d6453ae158cac31f0935fda/500x500-000000-80-0-0.jpg" },
  { id: "rk-12875", name: "Pinhani", artistId: 12875, rcat: "Türkçe Rock", picture: "https://cdn-images.dzcdn.net/images/artist/136e39be64687750265becbcb6084897/500x500-000000-80-0-0.jpg" },
  { id: "rk-13855", name: "Sertab Erener", artistId: 13855, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/27bd9f43e71221d9ec1ad16cd0e0aa18/500x500-000000-80-0-0.jpg" },
  { id: "rk-1511107", name: "Mabel Matiz", artistId: 1511107, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/200a518f2a5b6e5c3f215111275bac10/500x500-000000-80-0-0.jpg" },
  { id: "rk-211393", name: "Hadise", artistId: 211393, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/01a9c3f2fe42c62083ad4268cef30d07/500x500-000000-80-0-0.jpg" },
  { id: "rk-4313", name: "Hande Yener", artistId: 4313, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/541a70309fddeb75ba6c84d47ddff14d/500x500-000000-80-0-0.jpg" },
  { id: "rk-1381155", name: "Murat Boz", artistId: 1381155, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/0e7e78c2174d6fc9ec72626f87142383/500x500-000000-80-0-0.jpg" },
  { id: "rk-1385987", name: "Simge", artistId: 1385987, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/908d0545255bdaa93da39e59631fa9aa/500x500-000000-80-0-0.jpg" },
  { id: "rk-10819570", name: "Aleyna Tilki", artistId: 10819570, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/aa451cd32910ea3553ebaa714b7e8e9c/500x500-000000-80-0-0.jpg" },
  { id: "rk-13128", name: "Emre Aydın", artistId: 13128, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/7c72fa309c064183ce4b60c0574bb30d/500x500-000000-80-0-0.jpg" },
  { id: "rk-99563", name: "Müslüm Gürses", artistId: 99563, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/e2f90f2f5ff19404cb530422c42b53ab/500x500-000000-80-0-0.jpg" },
  { id: "rk-254617", name: "İbrahim Tatlıses", artistId: 254617, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/5ea3c17ac72958eea1e6170eef84cc97/500x500-000000-80-0-0.jpg" },
  { id: "rk-98036", name: "Ebru Gündes", artistId: 98036, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/f8b25e2db6bb1da6a82a41574e6c632e/500x500-000000-80-0-0.jpg" },
  { id: "rk-1385347", name: "Demet Akalın", artistId: 1385347, rcat: "Türkçe Pop", picture: "https://cdn-images.dzcdn.net/images/artist/ebab8e6c7363af438d3f06036884dd66/500x500-000000-80-0-0.jpg" },
  { id: "rk-12246", name: "Taylor Swift", artistId: 12246, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/500x500-000000-80-0-0.jpg" },
  { id: "rk-384236", name: "Ed Sheeran", artistId: 384236, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/d6bb84390641d8ae9118228d9544e53d/500x500-000000-80-0-0.jpg" },
  { id: "rk-8706544", name: "Dua Lipa", artistId: 8706544, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/877872aaf75694f11d53c318700ab2b5/500x500-000000-80-0-0.jpg" },
  { id: "rk-4050205", name: "The Weeknd", artistId: 4050205, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg" },
  { id: "rk-1562681", name: "Ariana Grande", artistId: 1562681, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/721d8fab84b315502de422b8d0901509/500x500-000000-80-0-0.jpg" },
  { id: "rk-9635624", name: "Billie Eilish", artistId: 9635624, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/8eab1a9a644889aabaca1e193e05f984/500x500-000000-80-0-0.jpg" },
  { id: "rk-13", name: "Eminem", artistId: 13, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/0f30bbd33a680030054af004d698d6ac/500x500-000000-80-0-0.jpg" },
  { id: "rk-246791", name: "Drake", artistId: 246791, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/eb0ed5b21d1ea5af021fc074ded0e91f/500x500-000000-80-0-0.jpg" },
  { id: "rk-525046", name: "Kendrick Lamar", artistId: 525046, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/be0a7c550567f4af0ed202d7235b74d6/500x500-000000-80-0-0.jpg" },
  { id: "rk-4495513", name: "Travis Scott", artistId: 4495513, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/8d8316146026d7e6ce377e314536df62/500x500-000000-80-0-0.jpg" },
  { id: "rk-7543848", name: "Post Malone", artistId: 7543848, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/a5a8cca44e7eab2db7d44e039bed2574/500x500-000000-80-0-0.jpg" },
  { id: "rk-6982223", name: "BTS", artistId: 6982223, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/b5c64fa8216ca158e52b4d88bd9388ff/500x500-000000-80-0-0.jpg" },
  { id: "rk-10803980", name: "BLACKPINK", artistId: 10803980, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/89675729453893a91be35bde691050ff/500x500-000000-80-0-0.jpg" },
  { id: "rk-429675", name: "Bruno Mars", artistId: 429675, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/90f0b5b11df4f87ee878f38569b5995b/500x500-000000-80-0-0.jpg" },
  { id: "rk-564", name: "Rihanna", artistId: 564, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/b78cdc205fae2641b89208e78b30e1b3/500x500-000000-80-0-0.jpg" },
  { id: "rk-288166", name: "Justin Bieber", artistId: 288166, rcat: "Yabancı", picture: "https://cdn-images.dzcdn.net/images/artist/fe097f693cebf1f882e3da79e99e3bf9/500x500-000000-80-0-0.jpg" },].map((r) => ({ ...r, kind: "rank", rank: true, genre: "Sıralama", artists: [r.artistId], desc: `${r.name} için en çok dinlenen 5 şarkıyı 20 şık arasından bul ve doğru sıraya diz.` }));

const memo = new Map();
const DAY = 864e5;
const cacheKey = (id) => `jqRank:${id}`;
function cached(id) {
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
    if (c && Date.now() - c.t < DAY && Array.isArray(c.own) && c.own.length >= 12) return c;
  } catch {}
  return null;
}
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Günlük YouTube verisi (tools/youtube_daily.mjs): hazır olan sanatçılarda sıra YouTube izlenmelerine göredir.
let ytData = null;
const ytLoad = () => (ytData ??= fetch(new URL("../data/rank-yt.json", import.meta.url), { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null));
async function fromYouTube(artistId, name, picture) {
  const a = (await ytLoad())?.artists?.[String(artistId)];
  if (!a?.ready || !Array.isArray(a.songs)) return null;
  const songs = a.songs.filter((x) => x && typeof x.t === "string");
  const top = songs.filter((x) => x.v > 0).slice(0, 5);
  if (top.length < 5) return null;
  const rest = songs.filter((x) => !top.includes(x)).map((x) => x.t);
  const decoys = shuffle(rest).slice(0, 15);
  if (decoys.length < 8) return null;
  return [{ q: "YouTube'da en çok izlenen 5 şarkısını sırala", artist: name, cover: picture, top: top.map((x) => x.t), n: top.map((x) => Math.round(x.v)), pool: [...top.map((x) => x.t), ...decoys] }];
}

/** Bir sanatçı için sıralama sorusu: ilk 5 (doğru sıra) + 15 şaşırtmaca (sanatçının diğer bilinen şarkıları). */
export async function rankItems(artistId, name, picture = "") {
  const key = String(artistId);
  if (!memo.has(key)) {
    const p = (async () => {
      const y = await fromYouTube(artistId, name, picture);
      if (y) return y;
      // YouTube verisi henüz yoksa: sıralama günde bir kez Deezer'dan alınır; gün içinde aynı sıra cihazdan okunur.
      let c = cached(key);
      if (!c) {
        const seen = new Set();
        const list = (await artistTop(artistId)).filter((t) => {
          if (isAlternate(t)) return false;
          const k = fold(t.title);
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (list.length < 12) throw Error("Bu sanatçının sıralama quizi için yeterli şarkısı yok.");
        c = { t: Date.now(), own: list.slice(0, 60).map((t) => ({ title: t.title, cover: t.cover || "" })) };
        try { localStorage.setItem(cacheKey(key), JSON.stringify(c)); } catch {}
      }
      const own = c.own;
      const top = own.slice(0, 5).map((t) => t.title);
      // şaşırtmacalar önce popüler olanlardan (6-25. sıralar), yetmezse sonrakilerden
      const rest = own.slice(5);
      const decoys = [...shuffle(rest.slice(0, 20)).slice(0, 12), ...shuffle(rest.slice(20)).slice(0, 3)];
      while (decoys.length < 15 && rest.length > decoys.length) { const x = rest.find((t) => !decoys.includes(t)); if (!x) break; decoys.push(x); }
      return [{ q: "En çok dinlenen 5 şarkısını sırala", artist: name, cover: picture || own[0]?.cover || "", top, pool: [...top, ...decoys.map((t) => t.title)] }];
    })();
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return memo.get(key);
}
