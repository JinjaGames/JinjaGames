// Oyuncu istatistikleri (profil sayfası). Herkeste bu tarayıcıda tutulur; Google ile giriş yapılmışsa hesaba eşitlenir.
// Cihazlar arası doğru toplama için her cihaz yalnızca KENDİ sayacını artırır: { dev: { <cihaz>: { sayaçlar } } }.
// Toplam = bütün cihazların toplamı. Birleştirirken her cihaz için büyük olan alınır (sayaçlar yalnızca artar);
// böylece bilgisayarda 50, hesapta (başka cihazdan) 20 varsa giriş yapınca 70 olur; hiçbir şey kaybolmaz, iki kez sayılmaz.
const KEY = "jqStats";
const DEV = "jqStatDev";
export const STAT_FIELDS = ["played", "lobby", "wins", "answered", "correct", "points", "numGames"];
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const json = (s, d) => { try { return s == null ? d : JSON.parse(s) ?? d; } catch { return d; } };
const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

function device() {
  let d = get(DEV);
  if (!/^[a-z0-9]{8,24}$/.test(d || "")) {
    d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    set(DEV, d);
  }
  return d;
}
const clean = (all) => {
  const out = { v: 1, dev: {} };
  // cihazlar sıralı tutulur: aynı veri her zaman aynı metne dönüşür (eşitlemede gereksiz "değişti" sanılmasın)
  for (const [id, c] of Object.entries(all?.dev || {}).sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (!/^[a-z0-9]{8,24}$/.test(id) || !c || typeof c !== "object") continue;
    out.dev[id] = Object.fromEntries(STAT_FIELDS.map((f) => [f, n(c[f])]));
  }
  return out;
};
const read = () => clean(json(get(KEY), null));

/** Sayaçları artırır (yalnızca bu cihazın satırı). */
export function bump(add) {
  const all = read();
  const me = (all.dev[device()] ||= Object.fromEntries(STAT_FIELDS.map((f) => [f, 0])));
  for (const [f, v] of Object.entries(add || {})) if (STAT_FIELDS.includes(f)) me[f] = n(me[f]) + n(v);
  set(KEY, JSON.stringify(clean(all)));
}
/** Bütün cihazların toplamı */
export function totals() {
  const t = Object.fromEntries(STAT_FIELDS.map((f) => [f, 0]));
  for (const c of Object.values(read().dev)) for (const f of STAT_FIELDS) t[f] += n(c[f]);
  return t;
}
/** İki istatistik kaydını birleştirir (JSON metinleri): her cihaz için alan alan büyük olan. */
export function mergeStats(a, b) {
  const A = clean(json(a, null)), B = clean(json(b, null));
  for (const [id, c] of Object.entries(B.dev)) {
    const m = (A.dev[id] ||= {});
    for (const f of STAT_FIELDS) m[f] = Math.max(n(m[f]), n(c[f]));
  }
  return JSON.stringify(clean(A));
}
/** İlk açılışta: istatistikler eklenmeden önce bu tarayıcıda bitirilen quizler (oynanma sayıları) "oynanan"a yazılır. */
export function seedStats() {
  if (get(KEY)) return;
  const plays = json(get("jqPlays"), {});
  const played = Object.values(plays || {}).reduce((s, v) => s + n(v), 0);
  set(KEY, JSON.stringify({ v: 1, dev: { [device()]: { ...Object.fromEntries(STAT_FIELDS.map((f) => [f, 0])), played } } }));
}
