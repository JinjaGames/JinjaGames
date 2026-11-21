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
    frame.src = "catalog.html";
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
  { id: "sagopa", name: "Sagopa Kajmer", genre: "Rap", artists: [12934] },
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
        .then((a) => (p.picture = cdn(a?.picture_medium)))
        .catch(() => {}),
    ),
  );
}
export const FEATURED = {
  id: "rap-arena",
  name: "Türkçe Rap Kapışması",
  genre: "Rap",
  art: "hero",
  artists: [72196, 98336572, 12934],
  blurb: "Motive, UZI ve Sagopa aynı arenada.",
};

// Bir listenin şarkılarını getirir: sanatçıların en popüler 100 şarkısı, tekrarsız ve
// remix / canlı / hızlandırılmış sürümler ayıklanmış olarak.
export async function loadTracks(list) {
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
        picture: cdn(l.picture),
        artists: (Array.isArray(l.artists) ? l.artists : []).map(int).filter(Boolean).slice(0, 6),
        genre: "Senin",
      }))
      .filter((l) => l.id && l.artists.length);
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
