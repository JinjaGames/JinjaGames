// JinjaAstro arayüzü: doğum haritası formu, sonuçlar, kayıtlı haritalar, haftalık/aylık yorumlar, uyum, bugünün gökyüzü.
import * as E from "./ephem.js";
import { SIGNS, PLANETS, HOUSES, SUN, MOON, ASC, MERCURY, VENUS, MARS, ASPECT_TXT, MATCH } from "./zodiac.js";
import { CITIES, utcOffset } from "./cities.js";
import { createSky } from "./sky.js";
import { drawWheel, renderCard, download } from "./wheel.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2800);
}
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const signName = (lon) => SIGNS[E.signOf(lon)].n;
const degTxt = (lon) => { const d = E.degIn(lon); return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, "0")}′`; };
const ORDER = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

// ---------- 3B gökyüzü ----------
let sky = null;
function initSky() {
  sky = createSky($("#sky"), { onPick: showTip });
  if (!sky) {
    $(".hero").classList.add("noGL");
    return;
  }
  sky.setPositions(E.positions(E.julian(new Date())));
}
function showTip(p) {
  const t = $("#skyTip");
  if (!p) return (t.hidden = true);
  const P = PLANETS[p.body];
  t.innerHTML = `<b style="color:${P.c}">${P.g} ${P.n}</b><span>${SIGNS[p.sign].g} ${SIGNS[p.sign].n} ${Math.floor(p.deg)}°${p.retro ? " · geri harekette" : ""}${p.house ? ` · ${p.house}. ev` : ""}</span><small>${P.about}</small>`;
  const r = $(".hero").getBoundingClientRect();
  t.style.left = Math.min(r.width - 230, Math.max(10, p.x - r.left + 12)) + "px";
  t.style.top = Math.max(70, p.y - r.top - 20) + "px";
  t.hidden = false;
}
$$("[data-sky]").forEach((b) => b.addEventListener("click", () => {
  if (!sky) return;
  const k = b.dataset.sky;
  if (k === "in") sky.zoom(0.85);
  if (k === "out") sky.zoom(1.18);
  if (k === "top") sky.top();
  if (k === "reset") sky.reset();
}));

// ---------- form ----------
const dl = $("#cityList");
dl.innerHTML = CITIES.map((c) => `<option value="${esc(c.n)}">`).join("") + `<option value="Diğer (koordinat gir)">`;
const findCity = (n) => CITIES.find((c) => c.n.toLocaleLowerCase("tr") === String(n).trim().toLocaleLowerCase("tr"));
let offTouched = false;
function autoOffset() {
  const c = findCity($("#fCity").value), d = $("#fDate").value;
  $("#manual").hidden = !(/^diğer/i.test($("#fCity").value) || (!c && $("#fCity").value.trim().length > 2));
  if (!c || !d || offTouched) return;
  const [y, m, day] = d.split("-").map(Number);
  $("#fOff").value = utcOffset(c.tz, y, m, day);
  $("#offNote").textContent = "(otomatik)";
}
$("#fCity").addEventListener("input", autoOffset);
$("#fDate").addEventListener("input", autoOffset);
$("#fOff").addEventListener("input", () => { offTouched = true; $("#offNote").textContent = "(elle)"; });
$("#fNoTime").addEventListener("change", (e) => ($("#fTime").disabled = e.target.checked));

let current = null; // { info, chart }
function readForm() {
  const date = $("#fDate").value;
  if (!date) throw Error("Doğum tarihini gir.");
  const c = findCity($("#fCity").value);
  const lat = c ? c.la : Number($("#fLat").value), lon = c ? c.lo : Number($("#fLon").value);
  if (!c && (!Number.isFinite(lat) || !Number.isFinite(lon) || $("#fLat").value === "")) throw Error("Listeden bir şehir seç ya da enlem ve boylamı gir.");
  const noTime = $("#fNoTime").checked;
  return { name: $("#fName").value.trim(), date, time: noTime ? "12:00" : $("#fTime").value || "12:00", noTime, city: c ? c.n : `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon, off: Number($("#fOff").value) || 0 };
}
function compute(info) {
  const [y, m, d] = info.date.split("-").map(Number), [hh, mm] = info.time.split(":").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm) - info.off * 3600e3);
  const chart = E.chart(utc, info.lat, info.lon);
  return chart;
}
$("#birthForm").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    const info = readForm();
    show(info);
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    toast(err.message);
  }
});

function show(info) {
  const chart = compute(info);
  current = { info, chart };
  const [y, m, d] = info.date.split("-").map(Number);
  info.line = `${d} ${MONTHS[m - 1]} ${y}${info.noTime ? "" : ` · ${info.time}`} · ${info.city}`;
  $("#result").hidden = false;
  const s = E.signOf(chart.pos.sun.lon), mo = E.signOf(chart.pos.moon.lon), as = E.signOf(chart.houses.asc);
  const card = (label, sign, deg, txt, cls) => `<article class="tri ${cls}" style="--c:${SIGNS[sign].c}"><span class="triG">${SIGNS[sign].g}</span><small>${label}</small><b>${SIGNS[sign].n}</b><em>${deg}</em><p>${txt}</p></article>`;
  $("#trio").innerHTML =
    card("Güneş burcun", s, degTxt(chart.pos.sun.lon), SUN[s], "sun") +
    card("Ay burcun", mo, degTxt(chart.pos.moon.lon), MOON[mo], "moon") +
    (info.noTime ? `<article class="tri asc off"><span class="triG">?</span><small>Yükselen burcun</small><b>Saat gerekli</b><p>Doğum saatini girersen yükselenin ve evlerin hesaplanır. Yükselen yaklaşık iki saatte bir değişir.</p></article>` : card("Yükselen burcun", as, degTxt(chart.houses.asc), ASC[as], "asc"));
  // tablo
  $("#plTable").innerHTML = `<thead><tr><th>Gezegen</th><th>Burç</th><th>Derece</th>${info.noTime ? "" : "<th>Ev</th>"}</tr></thead><tbody>${ORDER.map((b) => {
    const p = chart.pos[b], sg = SIGNS[E.signOf(p.lon)];
    return `<tr><td><span class="pg" style="color:${PLANETS[b].c}">${PLANETS[b].g}</span>${PLANETS[b].n}${p.retro ? ' <span class="rx" title="Geri harekette">R</span>' : ""}</td><td><span style="color:${sg.c}">${sg.g}</span> ${sg.n}</td><td>${degTxt(p.lon)}</td>${info.noTime ? "" : `<td>${p.house}</td>`}</tr>`;
  }).join("")}</tbody>`;
  $("#houseBox").hidden = info.noTime;
  if (!info.noTime)
    $("#houseList").innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
      const lon = chart.houses.cusps[h], sg = SIGNS[E.signOf(lon)];
      const inH = ORDER.filter((b) => chart.pos[b].house === h).map((b) => `<span style="color:${PLANETS[b].c}" title="${PLANETS[b].n}">${PLANETS[b].g}</span>`).join("");
      return `<li><b>${h}</b><span class="hs" style="color:${sg.c}">${sg.g} ${sg.n} ${Math.floor(E.degIn(lon))}°</span><small>${HOUSES[h]}</small><i>${inH}</i></li>`;
    }).join("");
  // yorumlar
  const ms = E.signOf(chart.pos.mercury.lon), vs = E.signOf(chart.pos.venus.lon), mrs = E.signOf(chart.pos.mars.lon);
  const asp = chart.aspects.filter((a) => ORDER.indexOf(a.a) < 7 && ORDER.indexOf(a.b) < 7).slice(0, 6);
  $("#reads").innerHTML = `
    <article class="glass read"><h3><span style="color:${PLANETS.mercury.c}">${PLANETS.mercury.g}</span> Nasıl düşünürsün</h3><p><b>Merkür ${SIGNS[ms].n} burcunda.</b> ${MERCURY[ms]}</p></article>
    <article class="glass read"><h3><span style="color:${PLANETS.venus.c}">${PLANETS.venus.g}</span> Nasıl seversin</h3><p><b>Venüs ${SIGNS[vs].n} burcunda.</b> ${VENUS[vs]}</p></article>
    <article class="glass read"><h3><span style="color:${PLANETS.mars.c}">${PLANETS.mars.g}</span> Nasıl harekete geçersin</h3><p><b>Mars ${SIGNS[mrs].n} burcunda.</b> ${MARS[mrs]}</p></article>
    <article class="glass read wide"><h3>Haritandaki öne çıkan açılar</h3><ul class="asp">${asp.map((a) => `<li><span class="at ${a.type}">${E.ASPECTS.find((x) => x.id === a.type).glyph}</span><p><b>${PLANETS[a.a].n} ve ${PLANETS[a.b].n}</b> ${ASPECT_TXT[a.type]} <small>${E.ASPECTS.find((x) => x.id === a.type).name} · ${a.orb.toFixed(1)}° sapma</small></p></li>`).join("")}</ul></article>`;
  drawResultWheel();
  sky?.setPositions(chart.pos, info.noTime ? { aspects: chart.aspects } : chart);
  $("#skyMode").textContent = `${info.name ? info.name + " · " : ""}doğum haritası`;
  // uyum ve yorumlarda kendi burcunu öne al
  setSign(s, true);
  $("#m1").value = String(s);
  updateMatch();
}
function drawResultWheel() {
  const c = $("#wheel"), x = c.getContext("2d");
  x.clearRect(0, 0, c.width, c.height);
  drawWheel(x, current.chart, c.width / 2, c.height / 2, c.width * 0.44, { hideHouses: current.info.noTime });
}
document.fonts?.ready.then(() => current && drawResultWheel());

$$("[data-save]").forEach((btn) => btn.addEventListener("click", async () => {
  if (!current) return;
  btn.disabled = true;
  try {
    const kind = btn.dataset.save;
    const quote = SUN[E.signOf(current.chart.pos.sun.lon)].split(". ")[0] + ".";
    const blob = await renderCard(current.chart, { ...current.info, quote }, kind);
    const slug = (current.info.name || "harita").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/gi, "-");
    download(blob, `${slug}-dogum-haritasi${kind === "story" ? "-hikaye" : ""}.png`);
    toast("Görsel indirildi.");
  } finally {
    btn.disabled = false;
  }
}));
$("#to3d").addEventListener("click", () => { sky?.reset(); $(".hero").scrollIntoView({ behavior: "smooth" }); });

// ---------- kayıtlı haritalar ----------
const saved = () => store.get("jaCharts", []);
function refreshSaved() {
  const list = saved();
  $("#savedN").textContent = list.length;
  $("#savedList").innerHTML = list.length
    ? list.map((c, i) => `<li><button type="button" data-load="${i}"><b>${esc(c.name || "Adsız")}</b><small>${esc(c.date)} · ${esc(c.noTime ? "saat yok" : c.time)} · ${esc(c.city)}</small></button><button type="button" class="del" data-del="${i}" aria-label="Sil">✕</button></li>`).join("")
    : `<li class="muted">Henüz kayıtlı haritan yok. Haritanı çıkardıktan sonra "Haritamı sakla"ya bas.</li>`;
  const opts = SIGNS.map((s, i) => `<option value="${i}">${s.g} ${s.n}</option>`).join("") + list.map((c, i) => `<option value="c${i}">★ ${esc(c.name || "Kayıtlı harita")}</option>`).join("");
  for (const id of ["#m1", "#m2"]) { const v = $(id).value; $(id).innerHTML = opts; if (v) $(id).value = v; }
}
$("#keepBtn").addEventListener("click", () => {
  if (!current) return;
  const list = saved().filter((c) => !(c.date === current.info.date && c.time === current.info.time && c.city === current.info.city && c.name === current.info.name));
  list.unshift({ ...current.info, line: undefined });
  store.set("jaCharts", list.slice(0, 20));
  refreshSaved();
  toast("Harita bu cihaza kaydedildi.");
});
$("#savedBtn").addEventListener("click", () => $("#savedDlg").showModal());
$("#savedDlg").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (e.target === $("#savedDlg") || t?.dataset.close !== undefined) return $("#savedDlg").close();
  if (t?.dataset.load) {
    const c = saved()[Number(t.dataset.load)];
    fillForm(c);
    show({ ...c });
    $("#savedDlg").close();
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (t?.dataset.del) {
    const list = saved();
    list.splice(Number(t.dataset.del), 1);
    store.set("jaCharts", list);
    refreshSaved();
  }
});
function fillForm(c) {
  $("#fName").value = c.name || "";
  $("#fDate").value = c.date;
  $("#fTime").value = c.time;
  $("#fNoTime").checked = !!c.noTime;
  $("#fTime").disabled = !!c.noTime;
  $("#fCity").value = findCity(c.city) ? c.city : "Diğer (koordinat gir)";
  $("#fLat").value = c.lat;
  $("#fLon").value = c.lon;
  $("#fOff").value = c.off;
  offTouched = true;
  $("#manual").hidden = !!findCity(c.city);
}

// ---------- haftalık / aylık ----------
let fc = null, sel = store.get("jaSign", E.signOf(E.sunLon(E.julian(new Date()))));
function pickers() {
  $$(".signPick").forEach((box) => {
    box.innerHTML = SIGNS.map((s, i) => `<button type="button" role="tab" data-sign="${i}" aria-selected="${i === sel}" style="--c:${s.c}"><span>${s.g}</span><b>${s.n}</b><small>${s.dates}</small></button>`).join("");
  });
}
function setSign(i, quiet) {
  sel = i;
  if (!quiet) store.set("jaSign", i);
  $$(".signPick button").forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.sign) === i)));
  drawForecast();
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-sign]");
  if (t) setSign(Number(t.dataset.sign));
});
function drawForecast() {
  if (!fc) return;
  const s = SIGNS[sel], w = fc.week.signs[s.id], m = fc.month.signs[s.id];
  const head = (t) => `<div class="fcHead" style="--c:${s.c}"><span>${s.g}</span><div><b>${s.n}</b><small>${t} · ${s.el} · ${s.dates}</small></div></div>`;
  $("#weekBox").innerHTML = head(fc.week.title) + `
    <div class="fcGrid">
      <div class="fcItem main"><h4>Haftanın havası</h4><p>${esc(w.general)}</p></div>
      <div class="fcItem"><h4>Aşk</h4><p>${esc(w.love)}</p></div>
      <div class="fcItem"><h4>İş ve para</h4><p>${esc(w.work)}</p></div>
      <div class="fcItem tip"><h4>Haftanın önerisi</h4><p>${esc(w.tip)}</p><span class="lucky">Şanslı günün: <b>${esc(w.lucky)}</b></span></div>
    </div>`;
  $("#monthBox").innerHTML = head(fc.month.title) + `
    <div class="fcGrid">
      <div class="fcItem main"><h4>Ayın genel havası</h4><p>${esc(m.general)}</p></div>
      <div class="fcItem"><h4>Aşk</h4><p>${esc(m.love)}</p></div>
      <div class="fcItem"><h4>İş ve para</h4><p>${esc(m.work)}</p></div>
      <div class="fcItem tip"><h4>Ayın önerisi</h4><p>${esc(m.tip)}</p>${m.dates?.length ? `<span class="lucky">Önemli günler: <b>${m.dates.map(esc).join(", ")}</b></span>` : ""}</div>
    </div>
    ${fc.month.sky.length ? `<details class="monthSky"><summary>Bu ayın gökyüzü takvimi</summary><ul>${fc.month.sky.map((n) => `<li>${esc(n.text)}</li>`).join("")}</ul></details>` : ""}`;
}
async function loadForecast() {
  try {
    const r = await fetch("data/forecast.json", { cache: "no-cache" });
    fc = await r.json();
    $("#weekTitle").textContent = fc.week.title;
    $("#monthTitle").textContent = fc.month.title;
    $("#weekSky").innerHTML = fc.week.sky.length ? fc.week.sky.map((n) => `<li>${esc(n.text)}</li>`).join("") : "<li>Bu hafta büyük bir geçiş yok; sakin bir gökyüzü.</li>";
    drawForecast();
  } catch {
    $("#weekBox").innerHTML = $("#monthBox").innerHTML = `<p class="muted">Yorumlar şu an yüklenemedi. Biraz sonra tekrar dene.</p>`;
  }
}

// ---------- uyum ----------
function signFromPick(v) {
  if (String(v).startsWith("c")) {
    const c = saved()[Number(String(v).slice(1))];
    return c ? E.signOf(compute(c).pos.sun.lon) : 0;
  }
  return Number(v) || 0;
}
function updateMatch() {
  const a = signFromPick($("#m1").value), bb = signFromPick($("#m2").value);
  const dist = Math.min(Math.abs(a - bb), 12 - Math.abs(a - bb));
  const M = MATCH[dist];
  const sameEl = SIGNS[a].el === SIGNS[bb].el;
  const bonus = sameEl && dist ? 0 : (SIGNS[a].el === "Ateş" && SIGNS[bb].el === "Hava") || (SIGNS[a].el === "Hava" && SIGNS[bb].el === "Ateş") || (SIGNS[a].el === "Su" && SIGNS[bb].el === "Toprak") || (SIGNS[a].el === "Toprak" && SIGNS[bb].el === "Su") ? 3 : 0;
  const score = Math.min(98, M.score + bonus);
  $("#mNum").textContent = score;
  $("#mArc").style.strokeDashoffset = 100 - score;
  $("#mText").innerHTML = `<h3>${SIGNS[a].g} ${SIGNS[a].n} <span>&amp;</span> ${SIGNS[bb].g} ${SIGNS[bb].n}</h3><span class="mType">${M.t} · ${SIGNS[a].el} ile ${SIGNS[bb].el}</span><p>${M.d}</p>`;
}
$("#m1").addEventListener("change", updateMatch);
$("#m2").addEventListener("change", updateMatch);

// ---------- bugün ----------
function phaseName(p) {
  if (p < 0.03 || p > 0.97) return ["Yeni Ay", "🌑"];
  if (p < 0.22) return ["Büyüyen Hilal", "🌒"];
  if (p < 0.28) return ["İlk Dördün", "🌓"];
  if (p < 0.47) return ["Büyüyen Ay", "🌔"];
  if (p < 0.53) return ["Dolunay", "🌕"];
  if (p < 0.72) return ["Küçülen Ay", "🌖"];
  if (p < 0.78) return ["Son Dördün", "🌗"];
  return ["Küçülen Hilal", "🌘"];
}
function drawNow() {
  const jd = E.julian(new Date()), pos = E.positions(jd), ph = E.moonPhase(jd);
  const [pn, pe] = phaseName(ph);
  const lit = Math.round(((1 - Math.cos(ph * 2 * Math.PI)) / 2) * 100);
  const d = new Date();
  $("#nowTitle").textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  $("#nowGrid").innerHTML = `<article class="moonCard glass"><span class="moonE">${pe}</span><b>${pn}</b><small>Ay %${lit} aydınlık · ${signName(pos.moon.lon)} burcunda</small></article>` +
    ORDER.map((bd) => {
      const p = pos[bd], sg = SIGNS[E.signOf(p.lon)];
      return `<article class="nowCard glass" style="--c:${PLANETS[bd].c}"><span class="ng">${PLANETS[bd].g}</span><b>${PLANETS[bd].n}</b><small><span style="color:${sg.c}">${sg.g}</span> ${sg.n} ${Math.floor(E.degIn(p.lon))}°</small>${p.retro ? '<em class="rx">geri</em>' : ""}</article>`;
    }).join("");
}

// ---------- açılış ----------
pickers();
refreshSaved();
$("#m2").value = "6";
updateMatch();
drawNow();
loadForecast();
const last = saved()[0];
if (last) fillForm(last);
else $("#fCity").value = "İstanbul";
autoOffset();
const startSky = () => (window.THREE ? initSky() : setTimeout(startSky, 60));
startSky();
