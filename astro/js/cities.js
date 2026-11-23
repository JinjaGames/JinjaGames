// Doğum yeri listesi: [ad, enlem, boylam, saat dilimi kuralı]
// Kurallar: "TR" Türkiye, "EU0/EU1/EU2" Avrupa (UTC+0/+1/+2, yaz saatli), "US-5/-6/-7/-8" ABD ve Kanada,
// "AU10" Avustralya doğu, "FIX:x" sabit UTC+x. Tarihî saat uygulamaları her zaman bu kurallara uymaz;
// bu yüzden formda UTC farkı elle de değiştirilebilir.
export const TR_CITIES = [
  ["Adana", 37.0, 35.32], ["Adıyaman", 37.76, 38.28], ["Afyonkarahisar", 38.76, 30.54], ["Ağrı", 39.72, 43.05], ["Aksaray", 38.37, 34.03],
  ["Amasya", 40.65, 35.83], ["Ankara", 39.93, 32.86], ["Antalya", 36.9, 30.71], ["Ardahan", 41.11, 42.7], ["Artvin", 41.18, 41.82],
  ["Aydın", 37.85, 27.85], ["Balıkesir", 39.65, 27.89], ["Bartın", 41.64, 32.34], ["Batman", 37.89, 41.13], ["Bayburt", 40.26, 40.23],
  ["Bilecik", 40.14, 29.98], ["Bingöl", 38.88, 40.5], ["Bitlis", 38.4, 42.11], ["Bolu", 40.74, 31.61], ["Burdur", 37.72, 30.29],
  ["Bursa", 40.19, 29.06], ["Çanakkale", 40.15, 26.41], ["Çankırı", 40.6, 33.62], ["Çorum", 40.55, 34.95], ["Denizli", 37.78, 29.09],
  ["Diyarbakır", 37.91, 40.24], ["Düzce", 40.84, 31.16], ["Edirne", 41.68, 26.56], ["Elazığ", 38.68, 39.22], ["Erzincan", 39.75, 39.49],
  ["Erzurum", 39.9, 41.27], ["Eskişehir", 39.78, 30.52], ["Gaziantep", 37.07, 37.38], ["Giresun", 40.91, 38.39], ["Gümüşhane", 40.46, 39.48],
  ["Hakkari", 37.58, 43.74], ["Hatay", 36.2, 36.16], ["Iğdır", 39.92, 44.04], ["Isparta", 37.76, 30.55], ["İstanbul", 41.01, 28.98],
  ["İzmir", 38.42, 27.14], ["Kahramanmaraş", 37.58, 36.94], ["Karabük", 41.2, 32.62], ["Karaman", 37.18, 33.22], ["Kars", 40.6, 43.1],
  ["Kastamonu", 41.38, 33.78], ["Kayseri", 38.72, 35.49], ["Kilis", 36.72, 37.12], ["Kırıkkale", 39.85, 33.51], ["Kırklareli", 41.74, 27.23],
  ["Kırşehir", 39.15, 34.16], ["Kocaeli", 40.77, 29.92], ["Konya", 37.87, 32.48], ["Kütahya", 39.42, 29.98], ["Malatya", 38.35, 38.31],
  ["Manisa", 38.61, 27.43], ["Mardin", 37.31, 40.74], ["Mersin", 36.81, 34.64], ["Muğla", 37.22, 28.36], ["Muş", 38.75, 41.51],
  ["Nevşehir", 38.62, 34.71], ["Niğde", 37.97, 34.68], ["Ordu", 40.98, 37.88], ["Osmaniye", 37.07, 36.25], ["Rize", 41.03, 40.52],
  ["Sakarya", 40.78, 30.4], ["Samsun", 41.29, 36.33], ["Siirt", 37.93, 41.94], ["Sinop", 42.03, 35.15], ["Sivas", 39.75, 37.02],
  ["Şanlıurfa", 37.16, 38.8], ["Şırnak", 37.52, 42.46], ["Tekirdağ", 40.98, 27.51], ["Tokat", 40.31, 36.55], ["Trabzon", 41.0, 39.72],
  ["Tunceli", 39.11, 39.55], ["Uşak", 38.68, 29.41], ["Van", 38.49, 43.38], ["Yalova", 40.65, 29.27], ["Yozgat", 39.82, 34.81],
  ["Zonguldak", 41.45, 31.79],
].map(([n, la, lo]) => ({ n, la, lo, tz: "TR" }));

export const WORLD_CITIES = [
  ["Lefkoşa (KKTC)", 35.17, 33.36, "EU2"], ["Bakü", 40.41, 49.87, "FIX:4"], ["Tiflis", 41.72, 44.79, "FIX:4"],
  ["Londra", 51.51, -0.13, "EU0"], ["Dublin", 53.35, -6.26, "EU0"], ["Lizbon", 38.72, -9.14, "EU0"],
  ["Paris", 48.86, 2.35, "EU1"], ["Berlin", 52.52, 13.4, "EU1"], ["Münih", 48.14, 11.58, "EU1"], ["Köln", 50.94, 6.96, "EU1"],
  ["Frankfurt", 50.11, 8.68, "EU1"], ["Hamburg", 53.55, 9.99, "EU1"], ["Amsterdam", 52.37, 4.9, "EU1"], ["Brüksel", 50.85, 4.35, "EU1"],
  ["Viyana", 48.21, 16.37, "EU1"], ["Zürih", 47.38, 8.54, "EU1"], ["Roma", 41.9, 12.5, "EU1"], ["Milano", 45.46, 9.19, "EU1"],
  ["Madrid", 40.42, -3.7, "EU1"], ["Barselona", 41.39, 2.17, "EU1"], ["Stockholm", 59.33, 18.07, "EU1"], ["Oslo", 59.91, 10.75, "EU1"],
  ["Kopenhag", 55.68, 12.57, "EU1"], ["Varşova", 52.23, 21.01, "EU1"], ["Prag", 50.08, 14.44, "EU1"], ["Budapeşte", 47.5, 19.04, "EU1"],
  ["Belgrad", 44.79, 20.45, "EU1"], ["Saraybosna", 43.86, 18.41, "EU1"], ["Üsküp", 42.0, 21.43, "EU1"], ["Tiran", 41.33, 19.82, "EU1"],
  ["Atina", 37.98, 23.73, "EU2"], ["Selanik", 40.64, 22.94, "EU2"], ["Sofya", 42.7, 23.32, "EU2"], ["Bükreş", 44.43, 26.1, "EU2"],
  ["Helsinki", 60.17, 24.94, "EU2"], ["Kiev", 50.45, 30.52, "EU2"], ["Moskova", 55.76, 37.62, "FIX:3"],
  ["Tahran", 35.69, 51.39, "FIX:3.5"], ["Dubai", 25.2, 55.27, "FIX:4"], ["Riyad", 24.71, 46.68, "FIX:3"], ["Kahire", 30.04, 31.24, "FIX:2"],
  ["Taşkent", 41.3, 69.24, "FIX:5"], ["Aşkabat", 37.96, 58.33, "FIX:5"], ["Bişkek", 42.87, 74.59, "FIX:6"], ["Almatı", 43.24, 76.89, "FIX:5"],
  ["Delhi", 28.61, 77.21, "FIX:5.5"], ["Pekin", 39.9, 116.41, "FIX:8"], ["Seul", 37.57, 126.98, "FIX:9"], ["Tokyo", 35.68, 139.69, "FIX:9"],
  ["Sidney", -33.87, 151.21, "AU10"], ["New York", 40.71, -74.01, "US-5"], ["Toronto", 43.65, -79.38, "US-5"], ["Chicago", 41.88, -87.63, "US-6"],
  ["Denver", 39.74, -104.99, "US-7"], ["Los Angeles", 34.05, -118.24, "US-8"], ["Meksiko", 19.43, -99.13, "FIX:-6"],
  ["São Paulo", -23.55, -46.63, "FIX:-3"], ["Buenos Aires", -34.6, -58.38, "FIX:-3"],
].map(([n, la, lo, tz]) => ({ n, la, lo, tz }));

export const CITIES = [...TR_CITIES, ...WORLD_CITIES];

// Ayın son pazarı / n. pazarı (UTC tarih nesnesi olarak gün)
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
const nthSunday = (y, m, n) => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + (n - 1) * 7; };
const between = (y, mo, d, a, b) => { const v = mo * 100 + d; return v >= a[0] * 100 + a[1] && v < b[0] * 100 + b[1]; };

/** Yerel tarih (yıl, ay 1-12, gün) için UTC farkı (saat). Bir tahmindir; tarihî istisnalar olabilir. */
export function utcOffset(tz, y, mo, d) {
  const m0 = mo - 1;
  const euDst = () => y >= 1981 && between(y, m0, d, [2, lastSunday(y, 2)], [9, lastSunday(y, 9)]);
  if (tz === "TR") {
    if (y > 2016 || (y === 2016 && (mo > 9 || (mo === 9 && d >= 7)))) return 3;
    if (y >= 1986) return euDst() ? 3 : 2;
    if (y >= 1978 && y <= 1983) return 3; // o yıllarda ülke çoğunlukla UTC+3'te kaldı
    return between(y, m0, d, [3, 1], [9, 1]) ? 3 : 2; // eski yıllar: kaba yaz saati tahmini
  }
  if (tz.startsWith("EU")) return Number(tz.slice(2)) + (euDst() ? 1 : 0);
  if (tz.startsWith("US")) {
    const base = Number(tz.slice(2));
    const dst = y >= 2007 ? between(y, m0, d, [2, nthSunday(y, 2, 2)], [10, nthSunday(y, 10, 1)]) : y >= 1987 ? between(y, m0, d, [3, nthSunday(y, 3, 1)], [9, lastSunday(y, 9)]) : between(y, m0, d, [3, lastSunday(y, 3)], [9, lastSunday(y, 9)]);
    return base + (dst ? 1 : 0);
  }
  if (tz === "AU10") return 10 + (m0 >= 9 || m0 < 3 || (m0 === 3 && d < nthSunday(y, 3, 1)) ? 1 : 0);
  if (tz.startsWith("FIX:")) return Number(tz.slice(4));
  return 0;
}
