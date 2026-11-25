// Anime quizleri: sabit ve geniş soru havuzu (quiz/data/anime-*.json). Havuz haftada bir
// tools/build_anime.mjs ile AniList'in herkese açık verisinden kendiliğinden genişletilir.
export const ERAS = []; // dönem seçimi kaldırıldı (havuz tüm dönemleri içerir)

export const ANIME_QUIZZES = [
  { id: "an-char-anime", name: "Bu Karakter Hangi Animeden?", emoji: "🐉", kind: "trivia", genre: "Anime", cat: "Anime", anime: "char-anime", desc: "Karakterin görseline bak, hangi animeden olduğunu bil." },
  { id: "an-char-name", name: "Bu Anime Karakteri Kim?", emoji: "🦸", kind: "trivia", genre: "Anime", cat: "Anime", anime: "char-name", desc: "Görseldeki karakterin adını dört şıktan bul." },
  { id: "an-cover", name: "Kapaktan Animeyi Bil", emoji: "📺", kind: "trivia", genre: "Anime", cat: "Anime", anime: "cover", desc: "Anime kapak görselinden hangi anime olduğunu bil." },
  { id: "an-year", name: "Bu Anime Hangi Yıl Çıktı?", emoji: "🧙", kind: "trivia", genre: "Anime", cat: "Anime", anime: "year", desc: "Popüler animelerin çıkış yılını tahmin et." },
];

const memo = new Map();
/** Bir anime quizinin soru havuzu (trivia biçimi). */
export async function animeItems(kind) {
  if (!/^[a-z-]{2,20}$/.test(kind)) return [];
  if (!memo.has(kind)) {
    const p = fetch(new URL(`../data/anime-${kind}.json`, import.meta.url))
      .then((r) => { if (!r.ok) throw Error("Anime soruları yüklenemedi."); return r.json(); })
      .then((j) => (Array.isArray(j?.items) ? j.items.map(({ q, a, img, iw }) => ({ q, a, img, iw })) : []));
    memo.set(kind, p);
    p.catch(() => memo.delete(kind));
  }
  return memo.get(kind);
}
