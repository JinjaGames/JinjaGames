// Puan sıralamasında uygunsuz oyuncu adlarını gizler: ad değişmez, yalnızca tabloda harf sayısı kadar "*" görünür.
// Yakalama kaba ama bilinçli olarak dar: masum kelimeleri (ör. "kaşık", "Essex") yakalamamak için kısa kökler
// yalnızca tam kelime olarak, uzun kökler kelimenin içinde de aranır. Harf oyunları (0→o, 1→i, 3→e, @→a…) çözülür.

// Kelimenin içinde geçse de yakalanan kökler (yeterince uzun ve masum kelimelerde geçmeyenler)
const INSIDE = [
  "aminako", "aminakoy", "amcik", "amcig", "orospu", "orosbu", "siktir", "siktig", "sikerim", "sikeyim", "sikiyim", "sikis", "sikik",
  "yarrak", "dalyarak", "tassak", "pezevenk", "gavat", "kahpe", "kaltak", "fahise", "yavsak", "serefsiz", "ibne", "gotveren", "gotlek",
  "kancik", "kerhane", "pickurusu",
  "fuck", "fukyou", "bullshit", "bitch", "asshole", "bastard", "nigger", "nigga", "faggot", "whore", "dickhead", "pussy", "porn", "hitler",
];
// Yalnızca tam kelime olarak yakalanan kısa kökler (içinde geçince masum kelimeleri de yakalarlardı: Amina, Işıkım, Ashita, therapist…)
const WHOLE = ["amk", "aq", "amq", "oc", "pic", "got", "sik", "sikim", "pust", "yarak", "tasak", "mal", "salak", "gerizekali",
  "shit", "cunt", "slut", "rapist", "nazi", "dick", "cock", "fag", "ass", "sex", "seks"];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", $: "s", "€": "e", "!": "i" };
function fold(s) {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" })[c])
    .replace(/[013457@$€!8]/g, (c) => LEET[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}
const squash = (s) => s.replace(/(.)\1+/g, "$1"); // "siiiktir" → "siktir"

export function isBadName(name) {
  const f = fold(name);
  const compact = f.replace(/[^a-z]/g, "");
  const words = f.split(/[^a-z]+/).filter(Boolean);
  const hay = [compact, squash(compact)];
  if (INSIDE.some((w) => { const k = w.replace(/[^a-z]/g, ""); return hay.some((h) => h.includes(k)); })) return true;
  return words.some((w) => WHOLE.includes(w) || WHOLE.includes(squash(w)));
}

/** Uygunsuzsa adı harf sayısı kadar yıldıza çevirir. */
export const maskName = (name) => (isBadName(name) ? "*".repeat(Math.max(3, [...String(name)].length)) : name);
