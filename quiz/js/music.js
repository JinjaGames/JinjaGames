// Müzik kataloğu: Deezer'ın herkese açık API'si (anahtar gerektirmez).
// Her şarkının 30 saniyelik önizlemesi vardır; oyun bunun içinden kısa bir kesit çalar.
// Deezer tarayıcıya yalnızca JSONP (yabancı betik) sunar. O betik jinjagames.com'un yetkileriyle
// çalışmasın diye istekler korumalı bir iframe'de (catalog.html, ayrı ve boş köken) yapılır; buraya
// yalnızca düz JSON gelir ve aşağıda alan alan süzülür.

let seq = 0;
const memo = new Map();
const waiting = new Map();
let frame = null;
let ready = null;

function bridge() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    frame = document.createElement("iframe");
    frame.src = new URL("../catalog.html", import.meta.url).href; // /quiz/create/ altından da
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    addEventListener("message", (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      const m = e.data;
      if (!m || m.dz !== 1) return;
      if (m.ready) return resolve();
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      m.ok ? w.resolve(m.data) : w.reject(Error(m.error === "api" ? "Müzik kataloğu hata verdi." : m.error === "timeout" ? "Müzik kataloğu yanıt vermedi. Bağlantını kontrol et." : "Müzik kataloğuna ulaşılamadı."));
    });
    document.body.append(frame);
  });
  return ready;
}

export async function jsonp(path, params = {}) {
  await bridge();
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(Error("Müzik kataloğu yanıt vermedi. Bağlantını kontrol et."));
    }, 10000);
    waiting.set(id, {
      resolve: (d) => (clearTimeout(timer), resolve(d)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    });
    frame.contentWindow.postMessage({ dz: 1, id, path, params }, "*");
  });
}

// Deezer'dan ya da başka bir oyuncudan gelen adresler yalnızca Deezer'ın CDN'ine izin verilir.
const CDN = /^https:\/\/[a-z0-9-]+\.dzcdn\.net\/[^\s"'<>()\\]+$/i;
export const cdn = (u) => (typeof u === "string" && CDN.test(u) ? u : "");
// Deezer'ın "görsel yok" yer tutucusu (boş karma) gerçek görsel sayılmaz.
export const realPic = (u) => (cdn(u) && !/\/images\/(artist|cover)\/\/|d41d8cd98f00b204e9800998ecf8427e|ebcf22e5c3a0eb3178b8a6f6bc1a5a6c/.test(u) ? u : "");
const str = (v, n = 200) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, n) : "");
const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);

export const fold = (v) =>
  String(v ?? "")
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");

const alternate =
  /\b(remix|rmx|live|canli|konser|karaoke|acoustic|akustik|speed ?up|sped ?up|slowed|reverb|instrumental|enstrumantal|cover|remaster(ed)?|demo|reprise|extended|version|versiyon|mix|edit|nightcore|8d)\b/i;

export const PRESETS = [
  // picture: sayfa ilk açılışta beklemeden çizilsin diye gömülü; arka planda günde bir tazelenir
  { id: "motive", name: "Motive", genre: "Rap", artists: [72196], picture: "https://cdn-images.dzcdn.net/images/cover/778197435a57b9e655a8bfc562ffdbdc/500x500-000000-80-0-0.jpg" },
  { id: "uzi", name: "UZI", genre: "Rap", artists: [98336572], picture: "https://cdn-images.dzcdn.net/images/artist/65905c1901748c17c176bfd1889cc3ae/500x500-000000-80-0-0.jpg" },
  { id: "manifest", name: "manifest", genre: "Pop", artists: [301153511], picture: "https://cdn-images.dzcdn.net/images/artist/1500d2a483a67f021e3f96a0734adc5d/500x500-000000-80-0-0.jpg" },
  { id: "sezen", name: "Sezen Aksu", genre: "Pop", artists: [9289], picture: "https://cdn-images.dzcdn.net/images/artist/9c62f746db8e41bb49eb13a3c254f597/500x500-000000-80-0-0.jpg" },
  { id: "duman", name: "Duman", genre: "Rock", artists: [14826], picture: "https://cdn-images.dzcdn.net/images/artist/420bd789cacec4d562f981f6eae6c76e/500x500-000000-80-0-0.jpg" },
];

// Karma listeler: bir türden birçok sanatçının en bilinen şarkıları (sanatçı başına en çok `per` şarkı).
// Normal ya da tersten çalınarak oynanır.
export const MIXES = [
  { id: "mx-trpop", name: "Türkçe Pop", genre: "Pop", mix: true, emoji: "🎤", artists: [3254, 9289, 211393, 4317, 10819570, 1385987, 124797, 1381155, 91598, 4313, 1171997, 1511107], picture: "https://cdn-images.dzcdn.net/images/artist/71f42a0742089955587933a5e97c41e7/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-trrap", name: "Türkçe Rap", genre: "Rap", mix: true, emoji: "🎧", artists: [8354140, 14546, 12934, 14414849, 98336572, 72196, 1666381, 575796, 72272502, 389038, 1550629, 11818971], picture: "https://cdn-images.dzcdn.net/images/artist/86897403b02175990e9d84322a94654a/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-trrock", name: "Türkçe Rock", genre: "Rock", mix: true, emoji: "🎸", artists: [14826, 16758, 12018, 15049, 299117, 97094, 13877, 124344, 12875, 6696895, 343660, 6433], picture: "https://cdn-images.dzcdn.net/images/artist/420bd789cacec4d562f981f6eae6c76e/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-enpop", name: "İngilizce Pop", genre: "Pop", mix: true, emoji: "✨", artists: [12246, 384236, 8706544, 4050205, 1562681, 9635624, 5313805, 288166, 429675, 75491, 564, 1176900], picture: "https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-enrap", name: "İngilizce Rap", genre: "Rap", mix: true, emoji: "🔥", artists: [13, 246791, 525046, 4495513, 230, 66, 7543848, 339209, 74309, 3, 165930, 6853403], picture: "https://cdn-images.dzcdn.net/images/artist/0f30bbd33a680030054af004d698d6ac/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-kpop", name: "K-Pop", genre: "Pop", mix: true, emoji: "💜", artists: [6982223, 10803980, 161553, 13923487, 178008437, 88684, 240582, 113547672, 168158797, 3649631, 65209, 9172904], picture: "https://cdn-images.dzcdn.net/images/artist/b5c64fa8216ca158e52b4d88bd9388ff/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-arabesk", name: "Arabesk & Fantezi", genre: "Pop", mix: true, emoji: "🥀", artists: [99563, 97092, 113766, 254617, 97973, 1382158, 16665, 97047, 98036, 101748], picture: "https://cdn-images.dzcdn.net/images/artist/e2f90f2f5ff19404cb530422c42b53ab/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-tr2000", name: "2000'ler Türkçe Pop", genre: "Pop", mix: true, emoji: "📼", artists: [4318, 1385347, 97007, 13855, 101076, 13128, 1412102, 4507310, 6015, 16505, 347253, 16628], picture: "https://cdn-images.dzcdn.net/images/artist/7174fef98d267c96a5d38ff7615727a3/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-rock", name: "Rock Klasikleri", genre: "Rock", mix: true, emoji: "🤘", artists: [412, 415, 115, 663, 119, 92, 1, 848, 860, 637, 182, 892], picture: "https://cdn-images.dzcdn.net/images/artist/71eeb9e2eeb375df35a3c0654a5a01ab/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-latin", name: "Latin & Reggaeton", genre: "Pop", mix: true, emoji: "💃", artists: [10583405, 160, 4860761, 3839, 554792, 5297021, 4937383, 1424602, 2792, 6707], picture: "https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-edm", name: "Elektronik & Dans", genre: "Pop", mix: true, emoji: "🎛️", artists: [542, 12178, 293585, 3968561, 7890702, 4768753, 27, 4999707, 407188, 434], picture: "https://cdn-images.dzcdn.net/images/artist/2d527fa03e106ed82a28f161694278d3/1000x1000-000000-80-0-0.jpg" },
  { id: "mx-anadolu", name: "Anadolu Rock & Efsaneler", genre: "Rock", mix: true, emoji: "🪕", artists: [13758, 6435, 328791, 459471, 111965, 325135, 69872, 96340, 1561028, 114917], picture: "https://cdn-images.dzcdn.net/images/artist/4198b876473e604e493f0c0573349ca8/1000x1000-000000-80-0-0.jpg" },
].map((m) => ({ ...m, per: 20 }));

// Karma listelerin kapağı: ilk dört sanatçının fotoğrafından kolaj (tek sanatçının yüzü bütün listeyi temsil etmesin).
// Adresler Deezer'dan alındı (api.deezer.com/artist/<id>, picture_medium).
const MIX_PICS = {"mx-trpop": ["https://cdn-images.dzcdn.net/images/artist/71f42a0742089955587933a5e97c41e7/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/9c62f746db8e41bb49eb13a3c254f597/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/01a9c3f2fe42c62083ad4268cef30d07/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/1bc15b8af870be4aa616e4f8c4ebd771/250x250-000000-80-0-0.jpg"], "mx-trrap": ["https://cdn-images.dzcdn.net/images/artist/86897403b02175990e9d84322a94654a/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/2af230afdd9e93989d7d7288e93fb536/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/861348e7f8b6d93d3e2fff5ea6df2dcd/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/cd7de0ac70198ea395e8c43fac6200cd/250x250-000000-80-0-0.jpg"], "mx-trrock": ["https://cdn-images.dzcdn.net/images/artist/420bd789cacec4d562f981f6eae6c76e/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/2d34c47105a1f42e865e4f14403e1fae/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/658ca2fe2c26477e897ff4e3a0c6f9ed/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/aee2502f3565318f12a5b90e9fb3d67c/250x250-000000-80-0-0.jpg"], "mx-enpop": ["https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/d6bb84390641d8ae9118228d9544e53d/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/877872aaf75694f11d53c318700ab2b5/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/250x250-000000-80-0-0.jpg"], "mx-enrap": ["https://cdn-images.dzcdn.net/images/artist/0f30bbd33a680030054af004d698d6ac/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/eb0ed5b21d1ea5af021fc074ded0e91f/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/be0a7c550567f4af0ed202d7235b74d6/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/8d8316146026d7e6ce377e314536df62/250x250-000000-80-0-0.jpg"], "mx-kpop": ["https://cdn-images.dzcdn.net/images/artist/b5c64fa8216ca158e52b4d88bd9388ff/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/89675729453893a91be35bde691050ff/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/1f4acadade675899b7f775ae4ac67faa/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/5cba9e96cd7a44955d47ff3d7eb16ef3/250x250-000000-80-0-0.jpg"], "mx-arabesk": ["https://cdn-images.dzcdn.net/images/artist/e2f90f2f5ff19404cb530422c42b53ab/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/faaed76038c394a059c7e7180fcccd68/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/4b3d6a686c64a9013ed959e492aa3e47/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/5ea3c17ac72958eea1e6170eef84cc97/250x250-000000-80-0-0.jpg"], "mx-tr2000": ["https://cdn-images.dzcdn.net/images/artist/7174fef98d267c96a5d38ff7615727a3/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/ebab8e6c7363af438d3f06036884dd66/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/90707fb22ced496763a8b63dceb3950b/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/27bd9f43e71221d9ec1ad16cd0e0aa18/250x250-000000-80-0-0.jpg"], "mx-rock": ["https://cdn-images.dzcdn.net/images/artist/71eeb9e2eeb375df35a3c0654a5a01ab/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/3ec5542ff520ee74e2befdaba32ef2ef/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/7dbc950be70f997ba0cd2b39de7f2aa7/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/c62989722e38d7a2ab18afde3c19bc5c/250x250-000000-80-0-0.jpg"], "mx-latin": ["https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/69c569506a8ff6ab0edfecbd1adf94b0/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/325eaa46bc25052d0e3d549d60cc8225/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/a4f77d40d68cf544e74883b2bd904fce/250x250-000000-80-0-0.jpg"], "mx-edm": ["https://cdn-images.dzcdn.net/images/artist/2d527fa03e106ed82a28f161694278d3/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/a53031d02dc2f8a8eb15d117c015d5eb/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/82e214b0cb39316f4a12a082fded54f6/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/4cab1c0cbe0edc1b3d2234873abc485e/250x250-000000-80-0-0.jpg"], "mx-anadolu": ["https://cdn-images.dzcdn.net/images/artist/4198b876473e604e493f0c0573349ca8/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/1bf64731d68e40c798a0caf1a4e72e5d/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/30ee19f057304ad91680f916c93e6ae0/250x250-000000-80-0-0.jpg", "https://cdn-images.dzcdn.net/images/artist/0d5e9a15a62b27f1dfff605c63c09163/250x250-000000-80-0-0.jpg"]};
for (const m of MIXES) m.pics = (MIX_PICS[m.id] || []).filter((u) => realPic(u));

// Hazır listelerin sanatçı görselleri sitede kopya olarak tutulmaz; Deezer'ın kendi görseli
// açılışta bir kez istenir (aranan sanatçılarda olduğu gibi).
// Hazır listelerin görselleri: önce cihazdaki son bilinen adres (yoksa gömülü olan) hemen kullanılır,
// günde bir kez arka planda Deezer'dan tazelenir. Değişiklik olduysa true döner (ekran ancak o zaman yeniden çizilir).
const PIC_KEY = "jqPresetPics";
try {
  const c = JSON.parse(localStorage.getItem(PIC_KEY) || "null");
  if (c?.pics) for (const p of PRESETS) if (realPic(c.pics[p.id])) p.picture = c.pics[p.id];
} catch {}
export async function loadPresetPictures() {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(PIC_KEY) || "null"); } catch {}
  if (cache && Date.now() - cache.t < 864e5) return false;
  let changed = false;
  await Promise.all(
    PRESETS.map((p) =>
      jsonp(`artist/${p.artists[0]}`)
        .then(async (a) => {
          let pic = realPic(a?.picture_big) || realPic(a?.picture_medium);
          // Sanatçı fotoğrafı yoksa kendi son albümünün kapağı
          if (!pic) {
            const al = await jsonp(`artist/${p.artists[0]}/albums`, { limit: 1 });
            pic = realPic(al?.data?.[0]?.cover_big) || realPic(al?.data?.[0]?.cover_medium);
          }
          if (pic && pic !== p.picture) { p.picture = pic; changed = true; }
        })
        .catch(() => {}),
    ),
  );
  try { localStorage.setItem(PIC_KEY, JSON.stringify({ t: Date.now(), pics: Object.fromEntries(PRESETS.map((p) => [p.id, p.picture || ""])) })); } catch {}
  return changed;
}

// Bir listenin şarkılarını getirir: sanatçıların en popüler 100 şarkısı, tekrarsız ve
// remix / canlı / hızlandırılmış sürümler ayıklanmış olarak.
export async function loadTracks(list) {
  if (Array.isArray(list.tracks) && list.tracks.length) return cleanTracks(list.tracks);
  const key = list.artists.join(",");
  if (memo.has(key)) return memo.get(key);
  const p = (async () => {
    const pages = await Promise.all(
      list.artists.map((id) => jsonp(`artist/${id}/top`, { limit: 100 })),
    );
    const seen = new Set();
    const out = [];
    for (const page of pages) {
      let taken = 0;
      for (const t of page.data || []) {
        if (list.per && taken >= list.per) break;
        if (!list.artists.includes(int(t.artist?.id))) continue; // konuk olunan başka sanatçı şarkıları
        const title = (t.title_short || t.title || "").trim();
        const k = fold(title);
        if (
          !k ||
          !t.preview ||
          t.readable === false ||
          seen.has(k) ||
          alternate.test(t.title) ||
          alternate.test(t.title_version || "")
        )
          continue;
        seen.add(k);
        taken++;
        out.push({
          id: int(t.id),
          title: str(title),
          artist: str(t.artist?.name),
          cover: cdn(t.album?.cover_medium),
        });
      }
    }
    if (!out.length) throw Error("Bu liste için çalınabilir şarkı bulunamadı.");
    return out;
  })();
  memo.set(key, p);
  p.catch(() => memo.delete(key));
  return p;
}

export const cleanTracks = (arr) => {
  const seen = new Set();
  return arr
    .map((t) => ({ id: int(t?.id), title: str(t?.title, 120), artist: str(t?.artist, 80), cover: cdn(t?.cover) }))
    .filter((t) => t.id && t.title && !seen.has(t.id) && seen.add(t.id))
    .slice(0, 200);
};

// Şarkı araması (quiz oluştururken): yalnızca önizlemesi olan, çalınabilir kayıtlar.
// Sanatçının albümleri ve bir albümün şarkıları (quiz oluşturma sayfası için).
// Deezer'da fotoğrafı olmayan sanatçılar için son albümünün kapağı (resimsiz kalmasın)
const coverMemo = new Map();
export function artistCover(id) {
  id = int(id);
  if (!coverMemo.has(id)) {
    const p = jsonp(`artist/${id}/albums`, { limit: 100 })
      .then((r) => {
        const al = (r.data || []).filter((a) => realPic(a.cover_big) || realPic(a.cover_medium));
        al.sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")));
        return realPic(al[0]?.cover_big) || realPic(al[0]?.cover_medium) || "";
      })
      .catch(() => "");
    coverMemo.set(id, p);
  }
  return coverMemo.get(id);
}
export async function artistInfo(id) {
  const a = await jsonp(`artist/${int(id)}`);
  const picture = realPic(a.picture_big) || realPic(a.picture_medium) || (await artistCover(id));
  return { id: int(a.id), name: str(a.name, 80), picture, fans: int(a.nb_fan), albums: int(a.nb_album) };
}
// Yalnızca sanatçının kendi şarkıları: başkasının şarkısında konuk olduğu kayıtlar (ör. "Nahir feat. Uzi") alınmaz.
export const ownTracks = (arr, id) => arr.filter((t) => t.artistId === int(id));
export async function artistTop(id) {
  const r = await jsonp(`artist/${int(id)}/top`, { limit: 100 });
  return ownTracks(mapTracks(r.data || []), id);
}
export async function artistAlbums(id) {
  const r = await jsonp(`artist/${int(id)}/albums`, { limit: 100 });
  return (r.data || [])
    .map((a) => ({ id: int(a.id), title: str(a.title, 120), cover: cdn(a.cover_medium), year: str(a.release_date, 4), type: str(a.record_type, 12) }))
    .filter((a) => a.id && a.title);
}
export async function albumTracks(album) {
  const r = await jsonp(`album/${int(album.id)}/tracks`, { limit: 200 });
  return mapTracks(r.data || [], album.cover);
}
export const isAlternate = (t) => alternate.test(t.title || "") || alternate.test(t.version || "");
function mapTracks(arr, cover = "") {
  return arr
    .filter((t) => cdn(t.preview) && t.readable !== false)
    .map((t) => ({ id: int(t.id), title: str((t.title_short || t.title || "").trim()), version: str(t.title_version, 60), artist: str(t.artist?.name, 80), artistId: int(t.artist?.id), cover: cdn(t.album?.cover_medium) || cover, preview: cdn(t.preview) }))
    .filter((t) => t.id && t.title);
}

export async function searchTracks(q) {
  const r = await jsonp("search/track", { q, limit: 40 });
  return mapTracks(r.data || []);
}

// Sanatçı araması: en çok hayranı olan en başta (aynı adlı küçük hesaplar arkaya düşer).
export async function searchArtists(q) {
  const r = await jsonp("search/artist", { q, limit: 25 });
  const list = (r.data || [])
    .map((a) => ({ id: int(a.id), name: str(a.name, 80), picture: realPic(a.picture_medium), fans: int(a.nb_fan) }))
    .filter((a) => a.id && a.name)
    .map((a, i) => ({ ...a, _m: nameMatch(a.name, q), _i: i }))
    // önce adı aranana en çok uyan (tam aynı > başı aynı > kelimesi aynı > içinde geçen), sonra hayran sayısı
    .sort((a, b) => b._m - a._m || b.fans - a.fans || a._i - b._i)
    .slice(0, 12)
    .map(({ _m, _i, ...a }) => a);
  // fotoğrafı olmayanlara son albüm kapağı (en çok 6 istek)
  let n = 0;
  return Promise.all(list.map(async (a) => (a.picture || n++ >= 6 ? a : { ...a, picture: await artistCover(a.id) })));
}
function nameMatch(name, q) {
  const n = fold(name).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const s = fold(q).replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  if (!s) return 0;
  if (n === s) return 4;
  if (n.startsWith(s + " ") || n.startsWith(s)) return 3;
  if (n.split(" ").includes(s)) return 2;
  return n.includes(s) ? 1 : 0;
}

// Önizleme bağlantıları ~15 dakikada sona erer; bu yüzden her soru için tazesi alınır.
export async function preview(trackId) {
  const t = await jsonp("track/" + trackId);
  if (!cdn(t.preview)) throw Error("Önizleme yok.");
  return {
    url: cdn(t.preview),
    cover: cdn(t.album?.cover_big) || cdn(t.album?.cover_medium),
    album: str(t.album?.title),
  };
}

import { cleanItems, cleanCat, cleanEmoji } from "./trivia.js?v=6";

// Kullanıcının bulduğu sanatçılar ve kendi (yalnızca bende) quizleri tarayıcıda saklanır.
const KEY = "jqCustomLists";
export function customLists() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(all)) return [];
    return all
      .filter((l) => l && typeof l === "object")
      .map((l) => l.kind === "trivia" ? {
        id: str(l.id, 40).replace(/[^A-Za-z0-9_-]/g, ""),
        kind: "trivia",
        name: str(l.name, 80),
        desc: str(l.desc, 160),
        cat: cleanCat(l.cat),
        emoji: cleanEmoji(l.emoji),
        items: cleanItems(l.items),
        genre: "Senin",
      } : l.kind === "rank" || l.kind === "op" ? {
        // sıralama ve anime opening: sorular oyuna eklenirken motor tarafından ayrıca temizlenir
        id: str(l.id, 40).replace(/[^A-Za-z0-9_-]/g, ""),
        kind: l.kind,
        name: str(l.name, 80),
        desc: str(l.desc, 160),
        cat: l.kind === "op" ? "Anime" : "",
        emoji: l.kind === "op" ? cleanEmoji(l.emoji) : "",
        picture: cdn(l.picture),
        artist: str(l.artist, 80),
        artistId: int(l.artistId),
        items: Array.isArray(l.items) ? l.items.slice(0, 100) : [],
        genre: "Senin",
      } : ({
        id: str(l.id, 40).replace(/[^A-Za-z0-9_-]/g, ""),
        name: str(l.name, 80),
        desc: str(l.desc, 160),
        picture: cdn(l.picture),
        artists: (Array.isArray(l.artists) ? l.artists : []).map(int).filter(Boolean).slice(0, 6),
        tracks: Array.isArray(l.tracks) ? cleanTracks(l.tracks) : undefined,
        ...(l.rev ? { rev: true } : {}),
        genre: "Senin",
      }))
      .filter((l) => l.id && (l.items?.length || l.artists?.length || l.tracks?.length));
  } catch {
    return [];
  }
}
export function saveCustom(list) {
  const all = customLists().filter((x) => x.id !== list.id);
  all.unshift(list);
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 40)));
  } catch {}
}
export function removeCustom(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify(customLists().filter((x) => x.id !== id)));
  } catch {}
}
