// JinjaAstro haftalık ve aylık burç yorumlarını gerçek gökyüzü hareketlerinden üretir.
// Çıktı: astro/data/forecast.json. GitHub Actions'ta her gece çalışır; yalnızca yeni hafta ya da yeni ay
// başladığında dosya değişir (aynı dönem için çıktı her zaman aynıdır).
// Kullanım: node tools/astro_forecast.mjs [YYYY-MM-DD]   (tarih verilmezse bugün, Türkiye saatiyle)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "../astro/js/ephem.js";
import { SIGNS, PLANETS } from "../astro/js/zodiac.js";
import * as X from "../astro/js/forecast-texts.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "astro/data/forecast.json");
const TZ = 3; // Türkiye
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const arg = process.argv[2];
const nowTR = arg ? new Date(arg + "T12:00:00Z") : new Date(Date.now() + TZ * 3600e3);
// Türkiye takvim günü (UTC alanlarında tutulur)
const day0 = new Date(Date.UTC(nowTR.getUTCFullYear(), nowTR.getUTCMonth(), nowTR.getUTCDate()));
const jdTR = (d) => E.julian(new Date(d.getTime() - TZ * 3600e3)); // TR gece yarısı → JD
const fromJd = (jd) => new Date((jd - 2440587.5) * 864e5 + TZ * 3600e3); // JD → TR saati (UTC alanlarında)
const fmt = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
// Haftanın/ayın kimliğine göre değişen ama aynı dönemde sabit kalan seçim
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const pick = (arr, key) => arr[hash(key) % arr.length];
const solarHouse = (lon, s) => ((E.signOf(lon) - s + 12) % 12) + 1;

function skyNotes(jd0, jd1) {
  const notes = [];
  for (const l of E.lunations(jd0, jd1)) {
    const d = fromJd(l.jd);
    notes.push({ jd: l.jd, date: iso(d), text: `${fmt(d)}: ${l.kind === "new" ? "Yeni Ay" : "Dolunay"} ${SIGNS[E.signOf(l.lon)].n} burcunda (${Math.floor(E.degIn(l.lon))}°)` });
  }
  for (const b of ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"])
    for (const e of E.events(b, jd0, jd1)) {
      const d = fromJd(e.jd);
      const P = PLANETS[b].n;
      if (e.kind === "ingress") notes.push({ jd: e.jd, date: iso(d), text: `${fmt(d)}: ${P} ${SIGNS[e.sign].n} burcuna geçiyor${e.retro ? " (geri harekette)" : ""}` });
      else notes.push({ jd: e.jd, date: iso(d), text: `${fmt(d)}: ${P} ${e.kind === "retro" ? "geri harekete başlıyor" : "yeniden ileri hareket ediyor"}` });
    }
  return notes.sort((a, b) => a.jd - b.jd).map(({ date, text }) => ({ date, text }));
}
const retroIn = (body, jd0, jd1) => { for (let jd = jd0; jd <= jd1; jd += 1) if (E.positions(jd)[body].retro) return true; return false; };

function weekly() {
  const dow = (day0.getUTCDay() + 6) % 7; // pazartesi 0
  const start = addDays(day0, -dow), end = addDays(start, 6);
  const id = iso(start);
  const jd0 = jdTR(start), jd1 = jdTR(addDays(end, 1)), mid = (jd0 + jd1) / 2;
  const pos = E.positions(mid);
  const lun = E.lunations(jd0, jd1);
  const mRetro = retroIn("mercury", jd0, jd1), vRetro = retroIn("venus", jd0, jd1), maRetro = retroIn("mars", jd0, jd1);
  // her günün öğlesinde Ay'ın burcu
  const moonDays = Array.from({ length: 7 }, (_, i) => { const d = addDays(start, i); return { d, s: E.signOf(E.moonLon(jdTR(d) + 0.5)) }; });
  const signs = {};
  SIGNS.forEach((sg, s) => {
    const key = id + sg.id;
    const hs = solarHouse(pos.sun.lon, s), hv = solarHouse(pos.venus.lon, s), hm = solarHouse(pos.mars.lon, s);
    let general = pick(X.SUN_WEEK[hs], key + "g");
    for (const l of lun) general += " " + X.LUNATION[l.kind](solarHouse(l.lon, s), fmt(fromJd(l.jd)));
    const own = moonDays.filter((m) => m.s === s);
    if (own.length) general += ` ${pick(X.MOON_IN_SIGN, key + "m")} (${own.map((m) => DAYS[m.d.getUTCDay()]).join(", ")})`;
    let love = pick(X.VENUS_LOVE[hv], key + "l");
    if (vRetro) love += " " + X.VENUS_RETRO;
    let work = pick(X.MARS_WORK[hm], key + "w");
    if (mRetro) work += " " + X.MERC_RETRO;
    if (maRetro) work += " " + X.MARS_RETRO;
    const trineDay = moonDays.find((m) => SIGNS[m.s].el === sg.el && m.s !== s) || moonDays.find((m) => m.s === s) || moonDays[hash(key) % 7];
    signs[sg.id] = { general, love, work, tip: pick(X.TIP[sg.el], key + "t"), lucky: DAYS[trineDay.d.getUTCDay()] };
  });
  return { id, start: iso(start), end: iso(end), title: `${fmt(start)} – ${fmt(end)}`, sky: skyNotes(jd0, jd1), signs };
}

function monthly() {
  const y = day0.getUTCFullYear(), m = day0.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)), next = new Date(Date.UTC(y, m + 1, 1));
  const id = `${y}-${String(m + 1).padStart(2, "0")}`;
  const jd0 = jdTR(start), jd1 = jdTR(next), mid = (jd0 + jd1) / 2;
  const pos = E.positions(mid);
  const lun = E.lunations(jd0, jd1);
  const mRetro = retroIn("mercury", jd0, jd1), vRetro = retroIn("venus", jd0, jd1);
  const signs = {};
  SIGNS.forEach((sg, s) => {
    const key = id + sg.id;
    const hs = solarHouse(pos.sun.lon, s), hv = solarHouse(pos.venus.lon, s), hm = solarHouse(pos.mars.lon, s), hj = solarHouse(pos.jupiter.lon, s);
    const both = X.SUN_WEEK[hs];
    let general = both[hash(key) % both.length] + " " + X.JUPITER_LUCK[hj];
    const dates = [];
    for (const l of lun) {
      general += " " + X.LUNATION[l.kind](solarHouse(l.lon, s), fmt(fromJd(l.jd)));
      dates.push(fmt(fromJd(l.jd)));
    }
    let love = X.VENUS_LOVE[hv].join(" ");
    if (vRetro) love += " " + X.VENUS_RETRO;
    let work = X.MARS_WORK[hm][hash(key + "w") % 2];
    if (mRetro) work += " " + X.MERC_RETRO;
    const ing = E.events("sun", jd0, jd1).find((e) => e.kind === "ingress" && e.sign === s);
    if (ing) dates.unshift(fmt(fromJd(ing.jd)));
    signs[sg.id] = { general, love, work, tip: pick(X.TIP[sg.el], key + "t"), dates };
  });
  return { id, title: `${MONTHS[m]} ${y}`, sky: skyNotes(jd0, jd1), signs };
}

let old = null;
try { old = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
const week = weekly(), month = monthly();
if (old?.week?.id === week.id && old?.month?.id === month.id) {
  console.log("Dönem değişmedi:", week.id, month.id);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), week, month }) + "\n");
  console.log("Yazıldı:", week.id, month.id);
}
