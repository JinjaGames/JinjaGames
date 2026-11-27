// Quiz bağlantıları: her quizin adından okunur bir adresi olur (jinjagames.com/quiz/wegh). Site statik olduğu için
// bu adres GitHub Pages'te 404.html'e düşer; oradaki küçük betik /quiz/?q=wegh adresine yönlendirir, uygulama da
// quizi açıp adres çubuğunu yeniden /quiz/wegh yapar. Aynı türde aynı adla iki quiz olmasın diye oluşturma sayfası
// yayından önce bu adresin boş olup olmadığına bakar.
const TR = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

export function slugify(s) {
  const out = String(s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => TR[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " ve ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return out || "quiz";
}

/** Quizin adres parçası: addan; sıralama / opening / tersten quizlerinde türü de eklenir (aynı sanatçının şarkı quiziyle karışmasın). */
export function quizSlug(l) {
  if (l?.daily) return "gunun-quizi";
  const base = slugify(l?.name);
  const k = l?.kind === "rank" ? "siralama" : l?.kind === "op" ? "opening" : l?.rev ? "tersten" : "";
  return k && !base.endsWith(k) ? `${base}-${k}` : base;
}

/** Herkesin açabileceği quizler (kişisel kayıtlar hariç) için adres tablosu. Aynı adres ikinci kez çıkarsa -2, -3… eklenir. */
export function slugTable(lists) {
  const bySlug = new Map();
  const byId = new Map();
  for (const l of lists) {
    if (!l || l.genre === "Senin" || /^(my|dz)/.test(String(l.id))) continue;
    let s = quizSlug(l);
    if (bySlug.has(s)) {
      let i = 2;
      while (bySlug.has(`${s}-${i}`)) i++;
      s = `${s}-${i}`;
    }
    bySlug.set(s, l);
    byId.set(String(l.id), s);
  }
  return { bySlug, byId };
}
