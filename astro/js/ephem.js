// JinjaAstro gök hesapları. Dış kütüphane yok; tarayıcıda ve Node'da aynı dosya çalışır.
// Güneş ve Ay: Jean Meeus, "Astronomical Algorithms" (25. ve 47. bölümler, kısaltılmış seriler).
// Gezegenler: E. M. Standish (JPL) "Keplerian Elements for Approximate Positions of the Major Planets",
// 1800–2050 için geçerli tablo. Burç ve ev hesabı için yeterli doğruluk (Ay ~0,05°, gezegenler dakikalar düzeyinde).

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const norm = (x) => ((x % 360) + 360) % 360;
const sin = (d) => Math.sin(d * D2R), cos = (d) => Math.cos(d * D2R), tan = (d) => Math.tan(d * D2R);
const atan2 = (y, x) => Math.atan2(y, x) * R2D, asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) * R2D;

/** JS Date (UTC an) → Jülyen günü */
export const julian = (date) => date.getTime() / 86400000 + 2440587.5;
const cent = (jd) => (jd - 2451545.0) / 36525;
export const obliquity = (T) => 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T;

export function sunLon(jd) {
  const T = cent(jd);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const om = 125.04 - 1934.136 * T;
  return norm(L0 + C - 0.00569 - 0.00478 * sin(om));
}

// Meeus tablo 47.A'nın büyük terimleri: [D, M, M', F, katsayı (1e-6 derece)]
const MOON = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537], [4, -1, 0, 0, 520], [1, 0, -2, 0, -487],
];
export function moonLon(jd) {
  const T = cent(jd);
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T;
  let s = 0;
  for (const [d, m, mp, f, c] of MOON) {
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    s += c * e * sin(d * D + m * M + mp * Mp + f * F);
  }
  s += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  const om = 125.04452 - 1934.136261 * T;
  return norm(Lp + s / 1e6 - 0.00478 * sin(om));
}

// [a, e, I, L, ϖ, Ω] ve yüzyıllık değişimleri (J2000 ekliptiği)
const KEP = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto: [[39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};
function helio(name, T) {
  const [b, r] = KEP[name];
  const [a, e, I, L, w, O] = b.map((v, i) => v + r[i] * T);
  const om = w - O;
  let M = norm(L - w);
  if (M > 180) M -= 360;
  let E = M + R2D * e * sin(M);
  for (let i = 0; i < 8; i++) E -= (E - R2D * e * sin(E) - M) / (1 - e * cos(E));
  const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
  const x = (cos(om) * cos(O) - sin(om) * sin(O) * cos(I)) * xp + (-sin(om) * cos(O) - cos(om) * sin(O) * cos(I)) * yp;
  const y = (cos(om) * sin(O) + sin(om) * cos(O) * cos(I)) * xp + (-sin(om) * sin(O) + cos(om) * cos(O) * cos(I)) * yp;
  const z = sin(om) * sin(I) * xp + cos(om) * sin(I) * yp;
  return [x, y, z];
}
/** Gezegenin yer merkezli tropikal boylamı (o günün ekinoksuna göre) */
export function planetLon(name, jd) {
  const T = cent(jd);
  const p = helio(name, T), e = helio("earth", T);
  const lon = atan2(p[1] - e[1], p[0] - e[0]);
  return norm(lon + 1.396971 * T); // J2000 → tarih ekinoksu (presesyon)
}

export const BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
export function lonOf(body, jd) {
  if (body === "sun") return sunLon(jd);
  if (body === "moon") return moonLon(jd);
  return planetLon(body, jd);
}
/** Tüm gök cisimleri: boylam ve geri hareket bilgisi */
export function positions(jd) {
  const out = {};
  for (const b of BODIES) {
    const l = lonOf(b, jd);
    let d = lonOf(b, jd + 1) - l;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    out[b] = { lon: l, speed: d, retro: b !== "sun" && b !== "moon" && d < 0 };
  }
  return out;
}

/** Yerel yıldız zamanı (derece) */
export function lst(jd, lonDeg) {
  const T = cent(jd);
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000 + lonDeg);
}
const raToLon = (ra, eps) => norm(atan2(sin(ra), cos(ra) * cos(eps)));

/** Yükselen, Tepe Noktası (MC) ve Placidus ev başlangıçları. Kutup bölgelerinde eşit evlere düşer. */
export function houses(jd, lat, lonDeg) {
  const T = cent(jd), eps = obliquity(T), ramc = lst(jd, lonDeg);
  const mc = raToLon(ramc, eps);
  const asc = norm(atan2(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps))));
  const cusps = new Array(13);
  cusps[1] = asc;
  cusps[10] = mc;
  let system = "placidus";
  if (Math.abs(lat) < 66) {
    const cusp = (frac, above) => {
      let lon = norm(mc + (above ? 30 : 120) * (frac > 0.5 && above ? 2 : 1));
      for (let i = 0; i < 40; i++) {
        const dec = asin(sin(eps) * sin(lon));
        const x = tan(lat) * tan(dec);
        if (Math.abs(x) >= 1) return null;
        const ad = asin(x);
        const ra = above ? ramc + (90 + ad) * frac : ramc + 180 - (90 - ad) * frac;
        const nl = raToLon(ra, eps);
        if (Math.abs(((nl - lon + 540) % 360) - 180) < 1e-7) return nl;
        lon = nl;
      }
      return lon;
    };
    const c11 = cusp(1 / 3, true), c12 = cusp(2 / 3, true), c2 = cusp(2 / 3, false), c3 = cusp(1 / 3, false);
    if ([c11, c12, c2, c3].some((v) => v == null)) system = "equal";
    else Object.assign(cusps, { 11: c11, 12: c12, 2: c2, 3: c3 });
  } else system = "equal";
  if (system === "equal") for (let h = 2; h <= 12; h++) if (h !== 10) cusps[h] = norm(asc + (h - 1) * 30);
  if (system === "placidus") {
    cusps[4] = norm(mc + 180);
    cusps[7] = norm(asc + 180);
    cusps[5] = norm(cusps[11] + 180);
    cusps[6] = norm(cusps[12] + 180);
    cusps[8] = norm(cusps[2] + 180);
    cusps[9] = norm(cusps[3] + 180);
  }
  return { asc, mc, cusps, system };
}
/** Bir boylamın hangi evde olduğu */
export function houseOf(lon, cusps) {
  for (let h = 1; h <= 12; h++) {
    const a = cusps[h], b = cusps[h === 12 ? 1 : h + 1];
    const span = norm(b - a), d = norm(lon - a);
    if (d < span) return h;
  }
  return 1;
}

export const ASPECTS = [
  { id: "conj", name: "Kavuşum", angle: 0, orb: 8, glyph: "☌" },
  { id: "sext", name: "Altmışlık", angle: 60, orb: 5, glyph: "⚹" },
  { id: "square", name: "Kare", angle: 90, orb: 7, glyph: "□" },
  { id: "trine", name: "Üçgen", angle: 120, orb: 7, glyph: "△" },
  { id: "opp", name: "Karşıt", angle: 180, orb: 8, glyph: "☍" },
];
/** İki boylam listesi arasındaki açılar */
export function aspects(posA, posB = null) {
  const out = [];
  const names = Object.keys(posA);
  const other = posB ? Object.keys(posB) : names;
  for (let i = 0; i < names.length; i++)
    for (let j = posB ? 0 : i + 1; j < other.length; j++) {
      const a = names[i], b = other[j];
      if (!posB && a === b) continue;
      let d = Math.abs(posA[a].lon - (posB || posA)[b].lon) % 360;
      if (d > 180) d = 360 - d;
      const lum = a === "sun" || a === "moon" || b === "sun" || b === "moon" ? 2 : 0;
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.angle);
        if (orb <= asp.orb + lum) out.push({ a, b, type: asp.id, orb });
      }
    }
  return out.sort((x, y) => x.orb - y.orb);
}

export const signOf = (lon) => Math.floor(norm(lon) / 30);
export const degIn = (lon) => norm(lon) % 30;

/** Ay evresi: 0 yeni ay, 0.5 dolunay */
export function moonPhase(jd) {
  return norm(moonLon(jd) - sunLon(jd)) / 360;
}
/** Bir aralıktaki yeni ay / dolunay anları (yarım saatlik hassasiyet) */
export function lunations(jd0, jd1) {
  const out = [];
  const el = (jd) => norm(moonLon(jd) - sunLon(jd));
  let prev = el(jd0);
  for (let jd = jd0 + 0.25; jd <= jd1; jd += 0.25) {
    const cur = el(jd);
    for (const [target, kind] of [[0, "new"], [180, "full"]]) {
      const a = norm(prev - target + 180) - 180, b = norm(cur - target + 180) - 180;
      if (a < 0 && b >= 0 && Math.abs(a - b) < 90) {
        let lo = jd - 0.25, hi = jd;
        for (let k = 0; k < 20; k++) {
          const mid = (lo + hi) / 2;
          if (norm(el(mid) - target + 180) - 180 < 0) lo = mid;
          else hi = mid;
        }
        const t = (lo + hi) / 2;
        out.push({ kind, jd: t, lon: moonLon(t) });
      }
    }
    prev = cur;
  }
  return out;
}
/** Bir gezegenin aralıktaki burç değişimleri ve geri/ileri dönüşleri (günlük tarama) */
export function events(body, jd0, jd1) {
  const out = [];
  const step = body === "moon" ? 0.125 : 1;
  let pl = lonOf(body, jd0), ps = null;
  for (let jd = jd0 + step; jd <= jd1 + 1e-9; jd += step) {
    const l = lonOf(body, jd);
    let sp = l - pl;
    if (sp > 180) sp -= 360;
    if (sp < -180) sp += 360;
    if (signOf(l) !== signOf(pl)) {
      // burç sınırını ikiye bölerek saatine kadar bul
      let lo = jd - step, hi = jd;
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (signOf(lonOf(body, m)) === signOf(pl)) lo = m; else hi = m; }
      out.push({ kind: "ingress", body, jd: hi, sign: signOf(l), retro: sp < 0 });
    }
    if (ps !== null && body !== "sun" && body !== "moon" && Math.sign(sp) !== Math.sign(ps)) {
      // durma anı: hız işaretinin değiştiği an
      const spd = (m) => { let d = lonOf(body, m + 0.05) - lonOf(body, m); if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
      let lo = jd - 2 * step, hi = jd;
      const s0 = Math.sign(spd(lo));
      for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (Math.sign(spd(m)) === s0) lo = m; else hi = m; }
      out.push({ kind: sp < 0 ? "retro" : "direct", body, jd: hi, lon: lonOf(body, hi) });
    }
    pl = l;
    ps = sp;
  }
  return out;
}

/** Bir doğum anının tam haritası */
export function chart(dateUTC, lat, lon) {
  const jd = julian(dateUTC);
  const pos = positions(jd);
  const h = houses(jd, lat, lon);
  for (const b of Object.keys(pos)) pos[b].house = houseOf(pos[b].lon, h.cusps);
  return { jd, pos, houses: h, aspects: aspects(pos) };
}
