// Sayı Quizi verisi: "hangisi daha büyük?" karşılaştırmaları.
// Değerler yaklaşıktır (nüfuslar 2024 civarı). Birbirine çok yakın iki değer asla eşleştirilmez
// (gap kuralı), böylece yaklaşık değerler yüzünden tartışmalı bir soru çıkmaz.
// Biçim: [ad, değer, görsel] — görsel iki harfli ülke koduysa bayrak, değilse emoji.

const POP = [
  ["Hindistan", 1450e6, "in"], ["Çin", 1410e6, "cn"], ["ABD", 340e6, "us"], ["Endonezya", 283e6, "id"], ["Pakistan", 251e6, "pk"],
  ["Nijerya", 233e6, "ng"], ["Brezilya", 212e6, "br"], ["Bangladeş", 174e6, "bd"], ["Rusya", 144e6, "ru"], ["Etiyopya", 132e6, "et"],
  ["Meksika", 131e6, "mx"], ["Japonya", 124e6, "jp"], ["Mısır", 116e6, "eg"], ["Filipinler", 116e6, "ph"], ["Vietnam", 101e6, "vn"],
  ["İran", 91e6, "ir"], ["Türkiye", 86e6, "tr"], ["Almanya", 84e6, "de"], ["Tayland", 72e6, "th"], ["Birleşik Krallık", 69e6, "gb"],
  ["Fransa", 66e6, "fr"], ["Güney Afrika", 64e6, "za"], ["İtalya", 59e6, "it"], ["Kenya", 56e6, "ke"], ["Kolombiya", 53e6, "co"],
  ["Güney Kore", 52e6, "kr"], ["İspanya", 48e6, "es"], ["Arjantin", 46e6, "ar"], ["Irak", 46e6, "iq"], ["Kanada", 39e6, "ca"],
  ["Ukrayna", 38e6, "ua"], ["Polonya", 38e6, "pl"], ["Fas", 38e6, "ma"], ["Özbekistan", 36e6, "uz"], ["Suudi Arabistan", 34e6, "sa"],
  ["Peru", 34e6, "pe"], ["Avustralya", 27e6, "au"], ["Şili", 20e6, "cl"], ["Kazakistan", 20e6, "kz"], ["Hollanda", 18e6, "nl"],
  ["Yunanistan", 10e6, "gr"], ["Azerbaycan", 10.3e6, "az"], ["İsveç", 10.6e6, "se"], ["Macaristan", 9.6e6, "hu"], ["İsviçre", 8.9e6, "ch"],
  ["Bulgaristan", 6.7e6, "bg"], ["Danimarka", 6e6, "dk"], ["Finlandiya", 5.6e6, "fi"], ["Norveç", 5.6e6, "no"], ["İrlanda", 5.2e6, "ie"],
  ["Yeni Zelanda", 5.2e6, "nz"], ["Gürcistan", 3.8e6, "ge"], ["Katar", 3e6, "qa"], ["Lüksemburg", 670e3, "lu"], ["Malta", 540e3, "mt"],
  ["İzlanda", 390e3, "is"],
];
const AREA = [
  ["Rusya", 17.1e6, "ru"], ["Kanada", 9.98e6, "ca"], ["ABD", 9.83e6, "us"], ["Çin", 9.6e6, "cn"], ["Brezilya", 8.52e6, "br"],
  ["Avustralya", 7.69e6, "au"], ["Hindistan", 3.29e6, "in"], ["Arjantin", 2.78e6, "ar"], ["Kazakistan", 2.72e6, "kz"], ["Cezayir", 2.38e6, "dz"],
  ["Suudi Arabistan", 2.15e6, "sa"], ["Meksika", 1.96e6, "mx"], ["Endonezya", 1.9e6, "id"], ["Libya", 1.76e6, "ly"], ["İran", 1.65e6, "ir"],
  ["Moğolistan", 1.56e6, "mn"], ["Peru", 1.29e6, "pe"], ["Mısır", 1.0e6, "eg"], ["Türkiye", 783.6e3, "tr"], ["Ukrayna", 603.5e3, "ua"],
  ["İspanya", 506e3, "es"], ["İsveç", 450e3, "se"], ["Norveç", 385e3, "no"], ["Japonya", 378e3, "jp"], ["Almanya", 357e3, "de"],
  ["Finlandiya", 338e3, "fi"], ["Polonya", 312.7e3, "pl"], ["İtalya", 301e3, "it"], ["Birleşik Krallık", 242.5e3, "gb"], ["Romanya", 238e3, "ro"],
  ["Yunanistan", 132e3, "gr"], ["Bulgaristan", 111e3, "bg"], ["Portekiz", 92e3, "pt"], ["Azerbaycan", 86.6e3, "az"], ["Avusturya", 83.9e3, "at"],
  ["İrlanda", 70.3e3, "ie"], ["Gürcistan", 69.7e3, "ge"], ["Hollanda", 41.5e3, "nl"], ["İsviçre", 41.3e3, "ch"], ["Belçika", 30.7e3, "be"],
  ["Kıbrıs", 9.2e3, "cy"], ["Lüksemburg", 2.6e3, "lu"], ["Malta", 316, "mt"], ["Monako", 2, "mc"], ["Vatikan", 0.49, "va"],
];
const MOUNT = [
  ["Everest", 8849, "np"], ["K2", 8611, "pk"], ["Kangchenjunga", 8586, "np"], ["Makalu", 8485, "np"], ["Aconcagua", 6961, "ar"],
  ["Denali", 6190, "us"], ["Kilimanjaro", 5895, "tz"], ["Elbruz", 5642, "ru"], ["Ağrı Dağı", 5137, "tr"], ["Mont Blanc", 4806, "fr"],
  ["Matterhorn", 4478, "ch"], ["Mauna Kea", 4207, "us"], ["Süphan Dağı", 4058, "tr"], ["Kaçkar Dağı", 3937, "tr"], ["Erciyes Dağı", 3917, "tr"],
  ["Fuji", 3776, "jp"], ["Demirkazık", 3756, "tr"], ["Teide", 3715, "es"], ["Etna", 3357, "it"], ["Palandöken", 3271, "tr"],
  ["Zugspitze", 2962, "de"], ["Olimpos (Yunanistan)", 2918, "gr"], ["Uludağ", 2543, "tr"], ["Kosciuszko", 2228, "au"], ["Nemrut Dağı", 2134, "tr"],
  ["Kazdağı", 1774, "tr"], ["Ben Nevis", 1345, "gb-sct"], ["Vezüv", 1281, "it"],
];
const BUILD = [
  ["Burj Khalifa", 828, "ae"], ["Merdeka 118", 679, "my"], ["Tokyo Skytree", 634, "jp"], ["Şanghay Kulesi", 632, "cn"], ["Abraj Al-Bait", 601, "sa"],
  ["Lotte World Tower", 555, "kr"], ["CN Tower", 553, "ca"], ["One World Trade Center", 541, "us"], ["Taipei 101", 508, "tw"], ["Petronas Kuleleri", 452, "my"],
  ["Empire State Binası", 443, "us"], ["Çamlıca Kulesi", 369, "tr"], ["Eyfel Kulesi", 330, "fr"], ["Space Needle", 184, "us"], ["Gize Piramidi", 139, "eg"],
  ["Atakule", 125, "tr"], ["Big Ben", 96, "gb"], ["Özgürlük Heykeli", 93, "us"], ["Galata Kulesi", 63, "tr"], ["Pisa Kulesi", 56, "it"],
  ["Kolezyum", 48, "it"], ["Kız Kulesi", 23, "tr"],
];
const RIVER = [
  ["Nil", 6650, "eg"], ["Amazon", 6400, "br"], ["Yangtze", 6300, "cn"], ["Yenisey", 5539, "ru"], ["Sarı Irmak", 5464, "cn"],
  ["Kongo", 4700, "cd"], ["Amur", 4444, "ru"], ["Mekong", 4350, "vn"], ["Nijer", 4180, "ng"], ["Volga", 3530, "ru"],
  ["İndus", 3180, "pk"], ["Tuna", 2850, "at"], ["Fırat", 2800, "tr"], ["Ganj", 2525, "in"], ["Colorado", 2330, "us"],
  ["Dinyeper", 2201, "ua"], ["Dicle", 1850, "tr"], ["Kızılırmak", 1355, "tr"], ["Ren", 1230, "de"], ["Elbe", 1094, "de"],
  ["Loire", 1006, "fr"], ["Sakarya", 824, "tr"], ["Sen", 777, "fr"], ["Büyük Menderes", 584, "tr"], ["Yeşilırmak", 519, "tr"],
  ["Thames", 346, "gb"],
];
const WEIGHT = [
  ["Mavi balina", 150000, "🐋"], ["Orka", 4500, "🐬"], ["Afrika fili", 6000, "🐘"], ["Beyaz gergedan", 2300, "🦏"], ["Su aygırı", 1500, "🦛"],
  ["Büyük beyaz köpekbalığı", 1100, "🦈"], ["Zürafa", 800, "🦒"], ["Kutup ayısı", 450, "🐻‍❄️"], ["Kaplan", 220, "🐅"], ["Aslan", 190, "🦁"],
  ["Goril", 160, "🦍"], ["Devekuşu", 120, "🪶"], ["Dev panda", 100, "🐼"], ["İnsan (ortalama)", 70, "🧍"], ["Komodo ejderi", 70, "🦎"],
  ["Kurt", 40, "🐺"], ["İmparator penguen", 30, "🐧"], ["Koala", 9, "🐨"], ["Ev kedisi", 4.5, "🐈"], ["Tavşan", 2, "🐇"],
  ["Sincap", 0.5, "🐿️"], ["Hamster", 0.12, "🐹"], ["Sinek kuşu", 0.004, "🐦"],
];
const SPEED = [
  ["Gökdoğan (dalışta)", 320, "🦅"], ["Çita", 110, "🐆"], ["Çatal boynuzlu antilop", 88, "🦌"], ["Aslan", 80, "🦁"], ["Yarış atı", 70, "🐎"],
  ["Devekuşu", 70, "🪶"], ["Zürafa", 60, "🦒"], ["Boz ayı", 56, "🐻"], ["Ev kedisi", 48, "🐈"], ["Usain Bolt", 44, "🏃"],
  ["Fil", 40, "🐘"], ["Tavuk", 14, "🐔"], ["Kaplumbağa (karada)", 0.3, "🐢"], ["Salyangoz", 0.05, "🐌"],
];
const YEAR = [
  ["Malazgirt Savaşı", 1071, "⚔️"], ["Magna Carta", 1215, "📜"], ["İstanbul'un fethi", 1453, "🏰"], ["Kolomb'un Amerika'ya ulaşması", 1492, "⛵"],
  ["ABD'nin bağımsızlık ilanı", 1776, "🗽"], ["Fransız İhtilali", 1789, "⚜️"], ["Telefonun icadı", 1876, "☎️"], ["İlk motorlu uçuş", 1903, "✈️"],
  ["Titanik'in batışı", 1912, "🚢"], ["Çanakkale Savaşları", 1915, "🎖️"], ["Cumhuriyet'in ilanı", 1923, "🌙"], ["II. Dünya Savaşı'nın başlaması", 1939, "💥"],
  ["Ay'a ilk iniş", 1969, "🌕"], ["Pac-Man'in çıkışı", 1980, "🟡"], ["Tetris'in çıkışı", 1984, "🧱"], ["Berlin Duvarı'nın yıkılışı", 1989, "🧱"],
  ["İlk PlayStation", 1994, "🎮"], ["Google'ın kuruluşu", 1998, "🔍"], ["Wikipedia'nın açılışı", 2001, "📚"], ["Facebook'un kuruluşu", 2004, "👍"],
  ["İlk iPhone", 2007, "📱"], ["Bitcoin", 2009, "🪙"], ["Minecraft'ın tam sürümü", 2011, "⛏️"], ["ChatGPT'nin çıkışı", 2022, "💬"],
];

const mk = (arr) => arr.map(([n, v, g]) => ({ n, v, ...(/^[a-z]{2}(-[a-z]{2,3})?$/.test(g) ? { f: g } : { e: g }) }));

// fmt: değeri gösterme biçimi; gap: iki değerin en az ne kadar farklı olacağı (oran ya da yıl farkı)
export const NUMCATS = [
  { id: "nufus", name: "Ülke Nüfusu", emoji: "👥", ask: "Hangisinin nüfusu daha fazla?", fmt: "pop", gap: 1.15, hue: 205, items: mk(POP) },
  { id: "yuzolcum", name: "Ülke Yüzölçümü", emoji: "🗺️", ask: "Hangisinin yüzölçümü daha büyük?", fmt: "km2", gap: 1.15, hue: 150, items: mk(AREA) },
  { id: "dag", name: "Dağların Yüksekliği", emoji: "🏔️", ask: "Hangisi daha yüksek?", fmt: "m", gap: 1.06, hue: 190, items: mk(MOUNT) },
  { id: "yapi", name: "Yapıların Yüksekliği", emoji: "🏙️", ask: "Hangisi daha yüksek?", fmt: "m", gap: 1.08, hue: 260, items: mk(BUILD) },
  { id: "nehir", name: "Nehirlerin Uzunluğu", emoji: "🌊", ask: "Hangisi daha uzun?", fmt: "km", gap: 1.1, hue: 215, items: mk(RIVER) },
  { id: "agirlik", name: "Hayvanların Ağırlığı", emoji: "⚖️", ask: "Hangisi daha ağır?", fmt: "kg", gap: 1.3, hue: 30, items: mk(WEIGHT) },
  { id: "hiz", name: "Hayvanların Hızı", emoji: "💨", ask: "Hangisi daha hızlı?", fmt: "kmh", gap: 1.2, hue: 0, items: mk(SPEED) },
  { id: "yil", name: "Hangisi Daha Yeni?", emoji: "⏳", ask: "Hangisi daha sonra oldu?", fmt: "year", gap: 5, abs: true, hue: 45, items: mk(YEAR) },
];

const tr = (n, d = 0) => n.toLocaleString("tr-TR", { maximumFractionDigits: d });
export function fmtNum(v, fmt) {
  switch (fmt) {
    case "pop": return v >= 1e9 ? `${tr(v / 1e9, 2)} milyar` : v >= 1e6 ? `${tr(v / 1e6, v < 10e6 ? 1 : 0)} milyon` : `${tr(v / 1e3)} bin`;
    case "km2": return v >= 1e6 ? `${tr(v / 1e6, 2)} milyon km²` : v >= 1e3 ? `${tr(v / 1e3, v < 1e4 ? 1 : 0)} bin km²` : `${tr(v, 2)} km²`;
    case "m": return `${tr(v)} m`;
    case "km": return `${tr(v)} km`;
    case "kg": return v >= 1000 ? `${tr(v / 1000, 1)} ton` : v >= 1 ? `${tr(v, 1)} kg` : `${tr(v * 1000)} g`;
    case "kmh": return `${tr(v, v < 1 ? 2 : 0)} km/sa`;
    case "year": return String(v);
    default: return tr(v);
  }
}
// İki öğe yeterince farklı mı?
export const farEnough = (cat, a, b) =>
  cat.abs ? Math.abs(a.v - b.v) >= cat.gap : Math.max(a.v, b.v) / Math.max(1e-9, Math.min(a.v, b.v)) >= cat.gap;

/**
 * Bir Sayı Quizi oyununun bütün eşleşmeleri (tekrar yok): her turda kazanan kalır, yanına daha önce çıkmamış
 * bir rakip gelir. Rakip, sıralamada yakın öğelerden seçilir; seri uzadıkça değerler birbirine yaklaşır.
 * Kazananın yakınında hem büyük hem küçük kullanılmamış rakip yoksa (cevap hep aynı taraf olurdu) yeni bir çiftle
 * sürer. Kullanılmamış öğeler bitince zincir biter: o zincirin uzunluğu oyunun en uzun serisidir.
 * Dönüş: [[a, b], ...] (a ve b karışık sırada).
 */
export function numChain(cat, rnd = Math.random) {
  const sorted = cat.items.slice().sort((x, y) => x.v - y.v);
  const rank = new Map(sorted.map((x, i) => [x, i]));
  const n = sorted.length;
  const used = new Set();
  const out = [];
  const any = (l) => l[Math.floor(rnd() * l.length)];
  const flip = (a, b) => (rnd() < 0.5 ? [a, b] : [b, a]);
  const close = (a, b, s) => {
    if (cat.abs) return Math.abs(a.v - b.v) <= Math.max(cat.gap * 2, 120 * Math.pow(0.9, s));
    const r = Math.max(a.v, b.v) / Math.max(1e-9, Math.min(a.v, b.v));
    return r <= Math.max(cat.gap * 1.4, 6 * Math.pow(0.88, s));
  };
  // a'nın kullanılmamış rakipleri; önce zorluk penceresindekiler, yoksa (seri uzunken) her uygun olan
  const near = (a, dir, s) => {
    const win = Math.max(2, Math.round(n * 0.3 * Math.pow(0.88, s)));
    const ok = sorted.filter((b) => { const d = rank.get(b) - rank.get(a); return b !== a && !used.has(b) && (dir > 0 ? d > 0 : d < 0) && farEnough(cat, a, b); });
    const best = ok.filter((b) => Math.abs(rank.get(b) - rank.get(a)) <= win && close(a, b, s));
    return best.length ? best : ok.sort((x, y) => Math.abs(rank.get(x) - rank.get(a)) - Math.abs(rank.get(y) - rank.get(a))).slice(0, 3);
  };
  let keep = null;
  for (let guard = 0; guard < 500; guard++) {
    const s = out.length;
    if (keep) {
      const up = near(keep, 1, s), down = near(keep, -1, s);
      if (up.length && down.length) {
        const b = any(rnd() < 0.5 ? up : down);
        used.add(b);
        out.push(flip(keep, b));
        keep = keep.v >= b.v ? keep : b;
        continue;
      }
    }
    // yeni çift: kullanılmamış öğelerden, ikisinin de yakınında rakip olanlar
    const free = sorted.filter((x) => !used.has(x));
    const starts = free.filter((a) => near(a, 1, s).length || near(a, -1, s).length);
    if (!starts.length) break;
    const a = any(starts);
    const b = any([...near(a, 1, s), ...near(a, -1, s)]);
    used.add(a);
    used.add(b);
    out.push(flip(a, b));
    keep = a.v >= b.v ? a : b;
  }
  return out;
}
