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
import * as Y from "../astro/js/forecast-texts2.js";
import { HOUSE_AREA } from "../astro/js/readings.js";
const SCHEMA = 2;

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
const GOOD = [0, 5, 3, 4, 2, 5, 3, 4, 2, 4, 4, 4, 2]; // evin genel desteği (1-5)
const score = (h, key, minus = 0) => Math.max(1, Math.min(5, GOOD[h] + (hash(key) % 3) - 1 - minus));
const both = (arr) => arr.join(" ");
const take = (arr, n, key) => { const a = [...arr], out = []; let k = hash(key); while (out.length < n && a.length) { out.push(a.splice(k % a.length, 1)[0]); k = Math.floor(k / 7) + 13; } return out; };
const VERB = { sun: "ışığını {T} çeviriyor", mercury: "zihnini {T} yöneltiyor", venus: "{T} tatlılık katıyor", mars: "{T} enerji ve hareket getiriyor", jupiter: "{T} bolluk getiriyor", saturn: "{T} ciddiyet ve sorumluluk getiriyor" };
// Bir burcun uzun bölümleri. long=true (aylık): her evin iki hâli birlikte yazılır.
function sections({ s, key, hs, hv, hm, hme, hj, hsat, hl, retro, long, lunText, moonText }) {
  const one = (arr, k) => (long ? both(arr) : pick(arr, key + k));
  const sg = SIGNS[s];
  const out = [];
  out.push({ id: "genel", title: "Genel hava", paras: [one(X.SUN_WEEK[hs], "g"), ...lunText, ...(moonText ? [moonText] : [])], pos: take(Y.POS[hs], 3, key + "p"), neg: take(Y.NEG[hs], 2, key + "n") });
  out.push({ id: "ask", title: "Aşk ve ilişkiler", paras: [pick(X.VENUS_LOVE[hv], key + "l"), "Bekarsan: " + one(Y.SINGLE[hv], "si"), "İlişkin varsa: " + one(Y.COUPLE[hv], "co"), ...(retro.venus ? [X.VENUS_RETRO] : [])], pos: take(Y.POS[hv], 2, key + "lp"), neg: take(Y.NEG[hv], 2, key + "ln") });
  out.push({ id: "kariyer", title: "Kariyer ve iş", paras: [one(X.MARS_WORK[hm], "w"), one(Y.MERC_WORK[hme], "mw"), ...(retro.mercury ? [X.MERC_RETRO] : []), ...(retro.mars ? [X.MARS_RETRO] : [])], pos: take(Y.POS[hm], 2, key + "wp"), neg: take(Y.NEG[hm], 2, key + "wn") });
  out.push({ id: "para", title: "Para ve kazanç", paras: [one(Y.MONEY[hs], "mo"), X.JUPITER_LUCK[hj]], pos: take(Y.POS[hj], 2, key + "jp"), neg: take(Y.NEG[hs], 1, key + "mn") });
  out.push({ id: "saglik", title: "Sağlık ve enerji", paras: [one(Y.HEALTH[hm], "he"), pick(X.TIP[sg.el], key + "ht")], pos: [], neg: [] });
  out.push({ id: "cevre", title: "Aile ve arkadaşlar", paras: [one(Y.SOCIAL[hme], "so")], pos: [], neg: [] });
  out.push({ id: "ic", title: "Ruh hâli ve iç dünya", paras: [one(Y.INNER[hl], "in")], pos: [], neg: [] });
  if (long) out.push({ id: "tema", title: "Dönemin büyük teması", paras: [Y.SATURN_H[hsat]], pos: [], neg: [] });
  return out;
}
function scores({ hv, hm, hj, hs, retro, key }) {
  return { ask: score(hv, key + "1", retro.venus ? 1 : 0), para: Math.round((score(hj, key + "2") + score(hs, key + "3")) / 2), kariyer: score(hm, key + "4", retro.mercury ? 1 : 0), saglik: score(hm, key + "5", retro.mars ? 1 : 0) };
}

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
    const hme = solarHouse(pos.mercury.lon, s), hj = solarHouse(pos.jupiter.lon, s), hsat = solarHouse(pos.saturn.lon, s);
    const hl = lun.length ? solarHouse(lun[0].lon, s) : solarHouse(pos.moon.lon, s);
    const retro = { mercury: mRetro, venus: vRetro, mars: maRetro };
    const lunText = lun.map((l) => X.LUNATION[l.kind](solarHouse(l.lon, s), fmt(fromJd(l.jd))));
    const moonText = own.length ? `${pick(X.MOON_IN_SIGN, key + "m")} (${own.map((m) => DAYS[m.d.getUTCDay()]).join(", ")})` : "";
    const days = moonDays.map((m, i) => {
      const h = solarHouse(E.moonLon(jdTR(m.d) + 0.5), s);
      const l = lun.find((x) => iso(fromJd(x.jd)) === iso(m.d));
      return { day: `${DAYS[m.d.getUTCDay()]} ${fmt(m.d)}`, moon: SIGNS[m.s].n, text: pick(Y.DAY[h], key + i) + (l ? ` ${l.kind === "new" ? "Yeni Ay" : "Dolunay"} bugün.` : ""), tone: Y.DAY_TONE[h] };
    });
    signs[sg.id] = { general, love, work, tip: pick(X.TIP[sg.el], key + "t"), lucky: DAYS[trineDay.d.getUTCDay()],
      motto: Y.MOTTO[hs], color: pick(Y.COLOR[sg.el], key + "c"), scores: scores({ hv, hm, hj, hs, retro, key }),
      sections: sections({ s, key, hs, hv, hm, hme, hj, hsat, hl, retro, long: false, lunText, moonText }), days };
  });
  return { id, start: iso(start), end: iso(end), title: `${fmt(start)} – ${fmt(end)}`, sky: skyNotes(jd0, jd1), signs };
}

// Ayı haftalara böl; her haftada o burç için önemli gökyüzü olaylarını yorumla
function weeksOf(s, key, start, next) {
  const out = [];
  for (let d = start, i = 0; d < next; d = addDays(d, 7), i++) {
    const e = new Date(Math.min(addDays(d, 7).getTime(), next.getTime()));
    const j0 = jdTR(d), j1 = jdTR(e);
    const lines = [];
    for (const l of E.lunations(j0, j1)) lines.push(X.LUNATION[l.kind](solarHouse(l.lon, s), fmt(fromJd(l.jd))));
    for (const b of ["sun", "mercury", "venus", "mars", "jupiter", "saturn"])
      for (const ev of E.events(b, j0, j1)) {
        const h = ev.kind === "ingress" ? ((ev.sign - s + 12) % 12) + 1 : solarHouse(E.positions(ev.jd)[b].lon, s);
        if (ev.kind === "ingress") lines.push(`${fmt(fromJd(ev.jd))}: ${PLANETS[b].n} ${SIGNS[ev.sign].n} burcuna geçiyor ve ${VERB[b].replace("{T}", X.TOPIC[h])}.`);
        else lines.push(`${fmt(fromJd(ev.jd))}: ${PLANETS[b].n} ${ev.kind === "retro" ? "geri harekete başlıyor; " + HOUSE_AREA[h] + " konusunda eski meseleler yeniden açılabilir, aceleyle karar verme" : "yeniden ileri gidiyor; " + HOUSE_AREA[h] + " konusunda takılan işler çözülmeye başlıyor"}.`);
      }
    const hm = solarHouse(E.positions((j0 + j1) / 2).moon.lon, s);
    if (!lines.length) lines.push(`Gökyüzü sakin; büyük bir geçiş yok. ${pick(Y.INNER[hm], key + "wk" + i)}`);
    out.push({ range: `${fmt(d)} – ${fmt(addDays(e, -1))}`, lines });
  }
  return out;
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
    const hme = solarHouse(pos.mercury.lon, s), hsat = solarHouse(pos.saturn.lon, s);
    const hl = lun.length ? solarHouse(lun[0].lon, s) : hs;
    const retro = { mercury: mRetro, venus: vRetro, mars: false };
    const lunText = lun.map((l) => X.LUNATION[l.kind](solarHouse(l.lon, s), fmt(fromJd(l.jd))));
    signs[sg.id] = { general, love, work, tip: pick(X.TIP[sg.el], key + "t"), dates,
      motto: Y.MOTTO[hs], color: pick(Y.COLOR[sg.el], key + "c"), scores: scores({ hv, hm, hj, hs, retro, key }),
      sections: sections({ s, key, hs, hv, hm, hme, hj, hsat, hl, retro, long: true, lunText, moonText: "" }), weeks: weeksOf(s, key, start, next) };
  });
  return { id, title: `${MONTHS[m]} ${y}`, sky: skyNotes(jd0, jd1), signs };
}

let old = null;
try { old = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
const week = weekly(), month = monthly();
if (old?.v === SCHEMA && old?.week?.id === week.id && old?.month?.id === month.id) {
  console.log("Dönem değişmedi:", week.id, month.id);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ v: SCHEMA, generated: new Date().toISOString(), week, month }) + "\n");
  console.log("Yazıldı:", week.id, month.id);
}
