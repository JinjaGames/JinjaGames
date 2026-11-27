// Uygunsuz adları gizler: ad değişmez, yalnızca görünürken harf sayısı kadar "*" olur.
// Yakalama bilinçli olarak dar; masum adları (GOT7, "Sık Sık", "Öç", "Türk Musikisi", "Adamcık", "Amina Koç",
// "Por Nada", "Moby Dick", "Pussycat Dolls", "Porno Graffitti"…) yakalamamak için:
//  - her kelime ayrı bakılır (kelimeler birleştirilip aranmaz; yalnızca "s i k t i r" gibi harf harf yazılanlar birleşir),
//  - ı ile i ayrı harf sayılır ("sık" ≠ "sik", "sıkış" ≠ "sikiş"),
//  - İngilizcede de anlamı olan kısa kökler Türkçe harfle yazılmadıkça sayılmaz ("got" değil "göt"),
//  - rakamlar yalnızca harfle karışıkken harf yerine geçer (s1ktir → siktir; "0°C" ya da "2024" olduğu gibi kalır).

// Kelimenin herhangi bir yerinde geçince yakalanır (uzun ve masum kelimelerde geçmeyen kökler)
const INSIDE = ["aminako", "aminakoy", "orospu", "orosbu", "siktir", "siktig", "sikerim", "sikeyim", "sikiyim", "yarrak", "dalyarak",
  "tassak", "pezevenk", "kaltak", "fahise", "yavsak", "serefsiz", "gotveren", "gotlek", "kerhane", "pickurusu",
  "fuck", "bullshit", "asshole", "dickhead", "nigger", "faggot"];
// Kelime bu kökle başlarsa yakalanır (içte geçince masum kelimeleri de yakalardı: adamcık, musikisi…)
const PREFIX = ["amcik", "amcık", "amcig", "amcıg", "kancık", "kancik", "ibne", "gavat", "kahpe", "sikis", "sikik",
  "bitch", "whore", "nigga", "pussy", "porn"];
// Yalnızca tam kelime olarak yakalanır
const WHOLE = ["amk", "aq", "amq", "oc", "pic", "got", "sik", "sikim", "pust", "yarak", "tasak", "mal", "salak", "gerizekali", "gerizekalı",
  "shit", "cunt", "slut", "rapist", "dick", "cock", "fag", "ass"];
// Yalnızca kişi adlarında (oyuncu, yazar, sohbet) sayılır; quiz adı/açıklamasında tarih ya da dizi adı olabilir
const NAME_ONLY = { whole: ["nazi", "sex", "seks", "hitler"], prefix: [] }; // ("hitleri" = şarkı hitleri)
// İngilizcede ya da Türkçede masum anlamı da olan kökler: yalnızca yazılışı uygunsuz olanı işaret ediyorsa sayılır
const AMBIG = {
  got: (raw) => /[ö0]/.test(raw), // göt / g0t sayılır; got (GOT7, "I Got You") sayılmaz
  oc: (raw) => !/ö/.test(raw), // öç (intikam) sayılmaz
};
// Bilinen masum adlar (eşleşmeden önce çıkarılır)
const ALLOW = ["moby dick", "philip k dick", "dick van dyke", "dick tracy", "cock robin", "pussycat", "porno graffitti", "pornograffitti",
  "kahpe bizans", "sex pistols", "sex and the city", "sex education", "sex bomb"];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", $: "s", "€": "e", "!": "i" };
const TR = { ç: "c", ğ: "g", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
const squash = (s) => s.replace(/(.)\1+/g, "$1"); // "siiiktir" → "siktir"

function words(text) {
  // büyük I → i (İngilizce klavyeyle BÜYÜK yazılanlar kaçmasın); yazılmış ı ise ı kalır
  let s = String(text || "").replace(/İ/g, "i").toLowerCase();
  for (const a of ALLOW) s = s.split(a).join(" ");
  const out = [];
  let run = "";
  for (let raw of s.split(/[^\p{L}\p{N}@$€!]+/u)) {
    raw = raw.replace(/^!+|!+$/g, "");
    if (!raw) continue;
    let f = raw.replace(/[çğöşüâîû]/g, (c) => TR[c]);
    if (/\p{L}/u.test(f)) f = f.replace(/[013457@$€!8]/g, (c) => LEET[c]);
    f = f.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-zı]/g, "");
    if (!f) continue;
    out.push({ raw, w: f, s: squash(f) });
    // harf harf yazılanlar ("s i k t i r", "s.i.k.t.i.r") tek kelime sayılır
    if (f.length === 1) run += f;
    else { if (run.length > 2) out.push({ raw: run, w: run, s: squash(run), joined: true }); run = ""; }
  }
  if (run.length > 2) out.push({ raw: run, w: run, s: squash(run), joined: true });
  return out;
}

function check(text, strict) {
  const prefix = strict ? [...PREFIX, ...NAME_ONLY.prefix] : PREFIX;
  const whole = strict ? [...WHOLE, ...NAME_ONLY.whole] : WHOLE;
  return words(text).some(({ raw, w, s, joined }) =>
    [w, s].some((x) => INSIDE.some((k) => x.includes(k)) || prefix.some((k) => x.startsWith(k))) ||
    (!joined && [w, s].some((x) => whole.includes(x) && (!AMBIG[x] || AMBIG[x](raw)))));
}

/** Kişi adları (oyuncu, yazar) ve sohbet için: daha sıkı. */
export const isBadName = (name) => check(name, true);
/** Quiz adı ve açıklaması için: tarih/dizi adlarına (Hitler, Sex Education…) takılmaz. */
export const isBadText = (text) => check(text, false);

const stars = (s) => "*".repeat(Math.max(3, [...String(s)].length));
/** Uygunsuzsa adı harf sayısı kadar yıldıza çevirir. */
export const maskName = (name) => (isBadName(name) ? stars(name) : name);
export const maskText = (text) => (isBadText(text) ? stars(text) : text);
