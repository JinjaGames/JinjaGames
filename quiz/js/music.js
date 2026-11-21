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
    frame.src = new URL("../catalog.html", import.meta.url).href; // /quiz/olustur/ altından da
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
  { id: "motive", name: "Motive", genre: "Rap", artists: [72196] },
  { id: "uzi", name: "UZI", genre: "Rap", artists: [98336572] },
  { id: "manifest", name: "manifest", genre: "Pop", artists: [301153511] },
  { id: "sezen", name: "Sezen Aksu", genre: "Pop", artists: [9289] },
  { id: "duman", name: "Duman", genre: "Rock", artists: [14826] },
];

// Hazır listelerin sanatçı görselleri sitede kopya olarak tutulmaz; Deezer'ın kendi görseli
// açılışta bir kez istenir (aranan sanatçılarda olduğu gibi).
export async function loadPresetPictures() {
  await Promise.all(
    PRESETS.filter((p) => !p.picture).map((p) =>
      jsonp(`artist/${p.artists[0]}`)
        .then(async (a) => {
          p.picture = realPic(a?.picture_big) || realPic(a?.picture_medium);
          // Sanatçı fotoğrafı yoksa kendi son albümünün kapağı
          if (!p.picture) {
            // (ortak şarkıların kapağı başka sanatçıyı gösterebilir; sanatçının kendi albümünü kullan)
            const al = await jsonp(`artist/${p.artists[0]}/albums`, { limit: 1 });
            p.picture = realPic(al?.data?.[0]?.cover_big) || realPic(al?.data?.[0]?.cover_medium);
          }
        })
        .catch(() => {}),
    ),
  );
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
    for (const page of pages)
      for (const t of page.data || []) {
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
        out.push({
          id: int(t.id),
          title: str(title),
          artist: str(t.artist?.name),
          cover: cdn(t.album?.cover_medium),
        });
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
export async function artistInfo(id) {
  const a = await jsonp(`artist/${int(id)}`);
  return { id: int(a.id), name: str(a.name, 80), picture: cdn(a.picture_big) || cdn(a.picture_medium), fans: int(a.nb_fan), albums: int(a.nb_album) };
}
export async function artistTop(id) {
  const r = await jsonp(`artist/${int(id)}/top`, { limit: 100 });
  return mapTracks(r.data || []);
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

export async function searchArtists(q) {
  const r = await jsonp("search/artist", { q, limit: 8 });
  return (r.data || []).map((a) => ({
    id: int(a.id),
    name: str(a.name, 80),
    picture: cdn(a.picture_medium),
    fans: int(a.nb_fan),
  }));
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

// Kullanıcının bulduğu sanatçılar tarayıcıda saklanır.
const KEY = "jqCustomLists";
export function customLists() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(all)) return [];
    return all
      .filter((l) => l && typeof l === "object")
      .map((l) => ({
        id: str(l.id, 40).replace(/[^A-Za-z0-9_-]/g, ""),
        name: str(l.name, 80),
        desc: str(l.desc, 160),
        picture: cdn(l.picture),
        artists: (Array.isArray(l.artists) ? l.artists : []).map(int).filter(Boolean).slice(0, 6),
        tracks: Array.isArray(l.tracks) ? cleanTracks(l.tracks) : undefined,
        genre: "Senin",
      }))
      .filter((l) => l.id && (l.artists.length || l.tracks?.length));
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
