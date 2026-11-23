// Doğum haritası sayfası: form, sonuçlar, 3D/çark görünümü, kategori kategori okuma, kaydet ve paylaş.
import * as E from "../ephem.js?v=7";
import { SIGNS, PLANETS, HOUSES, SUN, MOON, ASC, MERCURY, VENUS, MARS, ASPECT_TXT } from "../zodiac.js?v=7";
import { PROFILE, MC_SIGN, H2_SIGN, H7_SIGN, H4_SIGN, PLANET_DO, HOUSE_AREA } from "../readings.js?v=7";
import { MOON_HOME, HOME_STYLE, MOON_CARE, H12_SIGN, LEARN, H9_SIGN, H6_SIGN, SPEND, MOON_LOVE } from "../readings2.js?v=7";
import { SUN_WEEK, VENUS_LOVE, MARS_WORK, JUPITER_LUCK, TOPIC } from "../forecast-texts.js?v=7";
import { $, $$, esc, toast, saved, keepChart, computeChart, lineOf, degTxt, ORDER, placePicker, shareImage, downloadBlob, MONTHS } from "../common.js?v=7";
import { drawWheel, renderCard } from "../wheel.js?v=7";
import { mountSky } from "./ui.js?v=7";

let sky = null, current = null, cat = "ozet", view = "3d";
mountSky((s) => { sky = s; if (current) paintSky(); });

// ---------- form ----------
const place = placePicker($("#fCountry"), $("#fCity"), updateTz);
let offManual = false;
function updateTz() {
  if (offManual) return;
  const off = place.offset($("#fDate").value);
  if (off == null) { $("#tzInfo").textContent = place.city ? "Tarihi seçince hesaplanır" : "Şehir seçince hesaplanır"; return; }
  $("#fOff").value = off;
  const sign = off >= 0 ? "+" : "−";
  const abs = Math.abs(off), h = Math.floor(abs), m = Math.round((abs - h) * 60);
  $("#tzInfo").innerHTML = `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""} <small>· ${place.city.n} için o tarihteki saat</small>`;
}
$("#fDate").addEventListener("input", updateTz);
$("#fOff").addEventListener("input", () => { offManual = true; $("#tzInfo").textContent = `UTC${Number($("#fOff").value) >= 0 ? "+" : ""}${$("#fOff").value} (elle girildi)`; });
$("#fNoTime").addEventListener("change", (e) => ($("#fTime").disabled = e.target.checked));
place.set("Türkiye", "İstanbul");
updateTz();

$("#birthForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const date = $("#fDate").value;
  if (!date) return toast("Doğum tarihini seç."), $("#fDate").focus();
  if (!place.city) return toast("Doğduğun şehri seç."), $("#fCity .comboBtn").focus();
  const noTime = $("#fNoTime").checked;
  const info = { name: $("#fName").value.trim(), date, time: noTime ? "12:00" : $("#fTime").value || "12:00", noTime, country: place.country.name, city: place.city.n, lat: place.city.la, lon: place.city.lo, off: Number($("#fOff").value) || 0 };
  show(info);
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
});
function fill(c) {
  $("#fName").value = c.name || "";
  $("#fDate").value = c.date;
  $("#fTime").value = c.time;
  $("#fNoTime").checked = !!c.noTime;
  $("#fTime").disabled = !!c.noTime;
  place.set(c.country, c.city);
  offManual = false;
  updateTz();
  if (Math.abs((Number($("#fOff").value) || 0) - c.off) > 0.01) { offManual = true; $("#fOff").value = c.off; }
}
function savedRow() {
  const list = saved();
  $("#savedRow").innerHTML = list.length ? `<span>Kayıtlı haritaların:</span>${list.map((c, i) => `<span class="chipWrap"><button type="button" class="chip" data-load="${i}">${esc(c.name || "Adsız")} <small>${esc(c.date.split("-").reverse().join("."))}</small></button><button type="button" class="chipX" data-del="${i}" aria-label="${esc(c.name || "Harita")} sil">✕</button></span>`).join("")}` : "";
}
$("#savedRow").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const list = saved();
  if (b.dataset.load) { const c = list[Number(b.dataset.load)]; fill(c); show({ ...c }); $("#result").scrollIntoView({ behavior: "smooth", block: "start" }); }
  if (b.dataset.del) { list.splice(Number(b.dataset.del), 1); localStorage.setItem("jaCharts", JSON.stringify(list)); savedRow(); }
});
savedRow();

// ---------- sonuç ----------
const S = (lon) => SIGNS[E.signOf(lon)];
function show(info) {
  const chart = computeChart(info);
  info.line = lineOf(info);
  current = { info, chart };
  $("#result").hidden = false;
  const s = E.signOf(chart.pos.sun.lon), mo = E.signOf(chart.pos.moon.lon), as = E.signOf(chart.houses.asc);
  const card = (label, sign, deg, txt) => `<article class="tri" style="--c:${SIGNS[sign].c}"><span class="triG" aria-hidden="true">${SIGNS[sign].g}</span><small>${label}</small><b>${SIGNS[sign].n}</b><em>${deg}</em><p>${txt}</p></article>`;
  $("#trio").innerHTML = card("Güneş burcun", s, degTxt(chart.pos.sun.lon), SUN[s]) + card("Ay burcun", mo, degTxt(chart.pos.moon.lon), MOON[mo]) +
    (info.noTime ? `<article class="tri off"><span class="triG" aria-hidden="true">?</span><small>Yükselen burcun</small><b>Saat gerekli</b><p>Doğum saatini girersen yükselenin ve evlerin hesaplanır.</p></article>` : card("Yükselen burcun", as, degTxt(chart.houses.asc), ASC[as]));
  paintSky();
  drawW();
  tabs();
  panel();
}
function paintSky() { if (sky && current) sky.setPositions(current.chart.pos, current.info.noTime ? { aspects: current.chart.aspects } : current.chart); }
function drawW() {
  const c = $("#wheel"), x = c.getContext("2d");
  x.clearRect(0, 0, c.width, c.height);
  drawWheel(x, current.chart, c.width / 2, c.height / 2, c.width * 0.43, { hideHouses: current.info.noTime });
}
document.fonts?.ready.then(() => current && drawW());
$$("[data-view]").forEach((b) => b.addEventListener("click", () => {
  view = b.dataset.view;
  $$("[data-view]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  $("#skyBox").hidden = view !== "3d";
  $("#wheel").hidden = view !== "wheel";
}));

// ---------- kategoriler ----------
const CATS = [["ozet", "Özet"], ["kisilik", "Kişilik"], ["duygular", "Duygular"], ["ask", "Aşk"], ["kariyer", "Kariyer"], ["para", "Para"], ["zihin", "Zihin"], ["aile", "Ev ve aile"], ["buay", "Bu ay sana"], ["tablo", "Gezegenler ve evler"]];
function tabs() {
  $("#catTabs").innerHTML = CATS.map(([id, t]) => `<button type="button" role="tab" data-cat="${id}" aria-selected="${id === cat}">${t}</button>`).join("");
}
$("#catTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  cat = b.dataset.cat;
  tabs();
  panel();
  b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  $("#catTabs [aria-selected=true]")?.focus({ preventScroll: true });
});
const P = (b) => `<span class="pgl" style="color:${PLANETS[b].c}">${PLANETS[b].g}</span>`;
const sec = (title, html) => `<section class="rd"><h3>${title}</h3>${html}</section>`;
// saat yoksa evler güneş burcuna göre (güneş evi) hesaplanır
const houseOf = (b) => current.info.noTime ? ((E.signOf(current.chart.pos[b].lon) - E.signOf(current.chart.pos.sun.lon) + 12) % 12) + 1 : current.chart.pos[b].house;
const cuspSign = (h) => current.info.noTime ? (E.signOf(current.chart.pos.sun.lon) + h - 1) % 12 : E.signOf(current.chart.houses.cusps[h]);
const inHouse = (h) => ORDER.filter((b) => houseOf(b) === h);
const planetLine = (b) => `<li>${P(b)}<p><b>${PLANETS[b].n} ${houseOf(b)}. evinde:</b> ${HOUSE_AREA[houseOf(b)]}, ${PLANET_DO[b]}. <small>${S(current.chart.pos[b].lon).n} ${degTxt(current.chart.pos[b].lon)}${current.chart.pos[b].retro ? " · geri" : ""}</small></p></li>`;
const aspFor = (names) => current.chart.aspects.filter((a) => names.includes(a.a) || names.includes(a.b)).filter((a) => ORDER.indexOf(a.a) < 7 && ORDER.indexOf(a.b) < 7).slice(0, 4);
const aspList = (list) => list.length ? `<ul class="asp">${list.map((a) => `<li><span class="at ${a.type}">${E.ASPECTS.find((x) => x.id === a.type).glyph}</span><p><b>${PLANETS[a.a].n} ve ${PLANETS[a.b].n}</b> ${ASPECT_TXT[a.type]} <small>${E.ASPECTS.find((x) => x.id === a.type).name} · ${a.orb.toFixed(1)}° sapma</small></p></li>`).join("")}</ul>` : "";
const pList = (h) => inHouse(h).length ? `<ul class="pl2">${inHouse(h).map(planetLine).join("")}</ul>` : "";
// bir evin yöneticisi gezegen haritada nerede: o alanın hangi konuyla bağlandığını söyler
const rulerLine = (h, what) => { const r = SIGNS[cuspSign(h)].ruler, rh = houseOf(r); return `<p><b>${what} yöneticisi ${PLANETS[r].n}</b>, ${S(current.chart.pos[r].lon).n} burcunda ve ${rh}. evinde. ${rh === h ? "Bu alan kendi içinde güçlü; dışarıdan pek etkilenmez." : `Bu yüzden bu konu hayatında en çok ${HOUSE_AREA[rh]} ile iç içe geçer.`}</p>`; };
const noTimeNote = () => current.info.noTime ? `<p class="note">Doğum saatin olmadığı için evler güneş burcuna göre yaklaşık hesaplandı. Saatini eklersen bu bölüm sana özel hâle gelir.</p>` : "";

function elementBalance() {
  const cnt = { Ateş: 0, Toprak: 0, Hava: 0, Su: 0 }, mod = { Öncü: 0, Sabit: 0, Değişken: 0 };
  for (const b of ORDER.slice(0, 7)) { const s = S(current.chart.pos[b].lon); cnt[s.el] += b === "sun" || b === "moon" ? 2 : 1; mod[s.mod]++; }
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const EL = { Ateş: "Ateş ağırlıklı haritalar hızlı, cesur ve tutkulu olur.", Toprak: "Toprak ağırlıklı haritalar pratik, sabırlı ve somut sonuç odaklı olur.", Hava: "Hava ağırlıklı haritalar düşünceli, sosyal ve meraklı olur.", Su: "Su ağırlıklı haritalar duygusal, sezgisel ve şefkatli olur." };
  const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
  return `<div class="bars">${Object.entries(cnt).map(([k, v]) => `<div class="bar el-${k}"><span>${k}</span><i style="--w:${Math.round((v / tot) * 100)}%"></i><b>%${Math.round((v / tot) * 100)}</b></div>`).join("")}</div><p>${EL[top[0][0]]}${top[3][1] === 0 ? ` Haritanda hiç ${top[3][0].toLocaleLowerCase("tr")} yok; bu enerjiyi çevrendeki insanlardan ya da bilinçli alışkanlıklardan alırsın.` : ""}</p>`;
}
function panel() {
  if (!current) return;
  const c = current.chart, info = current.info;
  const s = E.signOf(c.pos.sun.lon), mo = E.signOf(c.pos.moon.lon), as = E.signOf(c.houses.asc);
  let html = "";
  if (cat === "ozet") {
    html = sec("Büyük üçlün", `<p>Güneşin ${SIGNS[s].n}, ayın ${SIGNS[mo].n}${info.noTime ? "" : `, yükselenin ${SIGNS[as].n}`}. Güneş kim olduğunu, ay neye ihtiyaç duyduğunu${info.noTime ? "" : ", yükselen ise dünyanın seni ilk nasıl gördüğünü"} anlatır.</p><p>${PROFILE[s].intro}</p>`) +
      sec("Element dengen", elementBalance()) +
      sec("Öne çıkan açılar", aspList(c.aspects.filter((a) => ORDER.indexOf(a.a) < 7 && ORDER.indexOf(a.b) < 7).slice(0, 5)));
  } else if (cat === "kisilik") {
    const ruler = SIGNS[as].ruler;
    html = sec(`${SIGNS[s].g} Güneş ${SIGNS[s].n}`, `<p>${SUN[s]}</p><p>${PROFILE[s].intro}</p><div class="chips">${PROFILE[s].plus.map((x) => `<span class="ok">${x}</span>`).join("")}${PROFILE[s].minus.map((x) => `<span class="no">${x}</span>`).join("")}</div>`) +
      (info.noTime ? "" : sec(`↑ Yükselen ${SIGNS[as].n}`, `<p>${ASC[as]}</p><p>Yükselen burcunun yöneticisi ${PLANETS[ruler].n}; haritanda ${S(c.pos[ruler].lon).n} burcunda ve ${houseOf(ruler)}. evinde. Bu, hayatının en çok ${HOUSE_AREA[houseOf(ruler)]} etrafında şekillendiğini gösterir.</p>`)) +
      sec("Güneşin açıları", aspList(aspFor(["sun"])));
  } else if (cat === "duygular") {
    html = sec(`${P("moon")} Ay ${SIGNS[mo].n}`, `<p>${MOON[mo]}</p><p>Ay ${houseOf("moon")}. evinde: duygusal huzurunu en çok ${HOUSE_AREA[houseOf("moon")]} alanında ararsın.</p>`) +
      sec("Seni ne yatıştırır, ne zorlar", `<p>${MOON_CARE[mo]}</p>`) +
      sec("12. ev: iç dünyan", `<p>${H12_SIGN[cuspSign(12)]}</p>${pList(12)}`) +
      sec("Ayın açıları", aspList(aspFor(["moon"])) || "<p>Ayın diğer kişisel gezegenlerle güçlü bir açısı yok; duyguların daha bağımsız ve kendi ritminde akar.</p>") + noTimeNote();
  } else if (cat === "ask") {
    const vs = E.signOf(c.pos.venus.lon), ms = E.signOf(c.pos.mars.lon);
    html = sec(`${P("venus")} Venüs ${SIGNS[vs].n}: nasıl seversin`, `<p>${VENUS[vs]}</p><p>${PROFILE[vs].love}</p>`) +
      sec(`${P("mars")} Mars ${SIGNS[ms].n}: seni ne çeker`, `<p>${MARS[ms]} Mars, arzunu ve neyin peşinden koştuğunu anlatır; ${SIGNS[ms].n} enerjisi taşıyan insanlar ilgini kolayca çeker.</p>`) +
      sec(`${P("moon")} Ay ${SIGNS[mo].n}: ilişkide neye ihtiyaç duyarsın`, `<p>${MOON_LOVE[mo]}</p>`) +
      sec("7. ev: nasıl bir partner", `<p>${H7_SIGN[cuspSign(7)]}</p>${info.noTime ? "" : rulerLine(7, "İlişki evinin")}${pList(7)}`) +
      sec("5. ev: flört ve keyif", `<p>Beşinci evin ${SIGNS[cuspSign(5)].n} burcunda. ${SIGNS[cuspSign(5)].n} ruhu, nasıl flört ettiğini ve neyle eğlendiğini anlatır: ${SIGNS[cuspSign(5)].kw.join(", ")}.</p>${inHouse(5).length ? `<ul class="pl2">${inHouse(5).map(planetLine).join("")}</ul>` : ""}`) +
      sec("Venüs ve Mars açıları", aspList(aspFor(["venus", "mars"]))) + noTimeNote();
  } else if (cat === "kariyer") {
    html = sec("10. ev: kariyer yönün", `<p>${MC_SIGN[cuspSign(10)]}</p>${info.noTime ? "" : rulerLine(10, "Kariyer evinin")}${pList(10)}`) +
      sec("6. ev: günlük işin ve çalışma düzenin", `<p>${H6_SIGN[cuspSign(6)]}</p>${pList(6)}`) +
      sec(`${P("saturn")} Satürn: emeğin karşılığı`, `<p>Satürn ${houseOf("saturn")}. evinde, ${S(c.pos.saturn.lon).n} burcunda. ${HOUSE_AREA[houseOf("saturn")]} alanında yavaş ama kalıcı bir başarı inşa edersin; burada sabır en büyük silahın.</p>`) +
      sec(`${P("mars")} Mars: çalışma tarzın`, `<p>${MARS[E.signOf(c.pos.mars.lon)]}</p>`) +
      sec(`${SIGNS[s].g} Güneş burcunun kariyer eğilimi`, `<p>${PROFILE[s].career}</p>`) + noTimeNote();
  } else if (cat === "para") {
    html = sec("2. ev: para ve değerler", `<p>${H2_SIGN[cuspSign(2)]}</p>${info.noTime ? "" : rulerLine(2, "Para evinin")}${pList(2)}`) +
      sec(`${P("venus")} Venüs ${SIGNS[E.signOf(c.pos.venus.lon)].n}: harcama tarzın`, `<p>${SPEND[E.signOf(c.pos.venus.lon)]}</p>`) +
      sec(`${P("jupiter")} Jüpiter: şansın nerede`, `<p>Jüpiter ${houseOf("jupiter")}. evinde, ${S(c.pos.jupiter.lon).n} burcunda. Bolluk ve fırsatlar en çok ${HOUSE_AREA[houseOf("jupiter")]} alanından gelir.</p>`) +
      sec("8. ev: ortak kaynaklar", `<p>Sekizinci evin ${SIGNS[cuspSign(8)].n} burcunda. Ortak para, yatırım ve başkalarının kaynaklarıyla ilişkin ${SIGNS[cuspSign(8)].kw[0]} bir tavır taşır.</p>${inHouse(8).length ? `<ul class="pl2">${inHouse(8).map(planetLine).join("")}</ul>` : ""}`) +
      sec(`${SIGNS[s].g} Güneş burcunun para ilişkisi`, `<p>${PROFILE[s].money}</p>`) + noTimeNote();
  } else if (cat === "zihin") {
    const me = E.signOf(c.pos.mercury.lon);
    html = sec(`${P("mercury")} Merkür ${SIGNS[me].n}`, `<p>${MERCURY[me]}</p><p>Merkür ${houseOf("mercury")}. evinde: zihnin en çok ${HOUSE_AREA[houseOf("mercury")]} ile meşgul.${c.pos.mercury.retro ? " Doğduğunda Merkür geri hareketteydi; düşüncelerini içinde uzun süre olgunlaştırır, sonra konuşursun." : ""}</p>`) +
      sec("Nasıl öğrenir, nasıl karar verirsin", `<p>${LEARN[me]}</p>`) +
      sec("3. ev: iletişim tarzın", `<p>Üçüncü evin ${SIGNS[cuspSign(3)].n} burcunda; yakın çevrenle ${SIGNS[cuspSign(3)].kw.join(", ")} bir dil kurarsın.</p>${pList(3)}`) +
      sec("9. ev: inançların, eğitim ve seyahat", `<p>${H9_SIGN[cuspSign(9)]}</p>${pList(9)}`) +
      sec("Merkür'ün açıları", aspList(aspFor(["mercury"]))) + noTimeNote();
  } else if (cat === "aile") {
    html = sec("4. ev: köklerin ve evin", `<p>${H4_SIGN[cuspSign(4)]}</p>${info.noTime ? "" : rulerLine(4, "Ev ve aile evinin")}${pList(4)}`) +
      sec(`${P("moon")} Ay ${SIGNS[mo].n}: evde neye ihtiyaç duyarsın`, `<p>${MOON_HOME[mo]}</p>`) +
      sec(`${SIGNS[s].g} Kurduğun aile`, `<p>${HOME_STYLE[s]}</p>`) +
      sec(`${P("saturn")} Satürn: aileden gelen sorumluluklar`, `<p>Satürn ${houseOf("saturn")}. evinde. Ailenden öğrendiğin kurallar ve taşıdığın sorumluluklar en çok ${HOUSE_AREA[houseOf("saturn")]} alanında kendini gösterir; burada zamanla olgunlaşır, kendi kurallarını koymayı öğrenirsin.</p>`) +
      sec("Ayın açıları", aspList(aspFor(["moon"])) || "<p>Ayın güçlü bir açısı yok; aile duyguların daha sakin ve kendi hâlinde akar.</p>") + noTimeNote();
  } else if (cat === "buay") {
    html = transits();
  } else if (cat === "tablo") {
    html = sec("Gezegenler", `<table class="pl"><thead><tr><th>Gezegen</th><th>Burç</th><th>Derece</th><th>Ev</th></tr></thead><tbody>${ORDER.map((b) => { const p = c.pos[b], sg = S(p.lon); return `<tr><td>${P(b)} ${PLANETS[b].n}${p.retro ? ' <em class="rx">R</em>' : ""}</td><td><span style="color:${sg.c}">${sg.g}</span> ${sg.n}</td><td>${degTxt(p.lon)}</td><td>${info.noTime ? "–" : p.house}</td></tr>`; }).join("")}</tbody></table>`) +
      (info.noTime ? "" : sec("Evler", `<ol class="houses">${Array.from({ length: 12 }, (_, i) => i + 1).map((h) => { const sg = SIGNS[cuspSign(h)]; return `<li><b>${h}</b><span style="color:${sg.c}">${sg.g} ${sg.n} ${Math.floor(E.degIn(c.houses.cusps[h]))}°</span><small>${HOUSES[h]}</small><i>${inHouse(h).map(P).join("")}</i></li>`; }).join("")}</ol>`)) +
      sec("Tüm açılar", aspList(c.aspects.slice(0, 12)).replace('class="asp"', 'class="asp all"'));
  }
  $("#catPanel").innerHTML = html;
}
// Bu ay sana: şu anki gezegenlerin doğum haritandaki evlere göre yorumu
function transits() {
  const jd = E.julian(new Date()), now = E.positions(jd);
  const c = current.chart;
  const hh = (b) => current.info.noTime ? ((E.signOf(now[b].lon) - E.signOf(c.pos.sun.lon) + 12) % 12) + 1 : E.houseOf(now[b].lon, c.houses.cusps);
  const d = new Date();
  const lun = E.lunations(jd, jd + 31).slice(0, 2);
  const pick = (arr) => arr[d.getMonth() % arr.length];
  return `<p class="lead">${d.getDate()} ${MONTHS[d.getMonth()]} itibarıyla gökyüzündeki gezegenler senin haritanın hangi evlerinden geçiyor, ona göre sana özel bir okuma.</p>` +
    sec(`${P("sun")} Güneş ${hh("sun")}. evinde: gündemin`, `<p>${pick(SUN_WEEK[hh("sun")])}</p>`) +
    sec(`${P("venus")} Venüs ${hh("venus")}. evinde: aşk`, `<p>${pick(VENUS_LOVE[hh("venus")])}</p>${now.venus.retro ? "<p class='note'>Venüs şu an geri harekette; geçmişten gelen duygular gündeme gelebilir.</p>" : ""}`) +
    sec(`${P("mars")} Mars ${hh("mars")}. evinde: enerji ve iş`, `<p>${pick(MARS_WORK[hh("mars")])}</p>`) +
    sec(`${P("jupiter")} Jüpiter ${hh("jupiter")}. evinde: şans`, `<p>${JUPITER_LUCK[hh("jupiter")]}</p>`) +
    sec(`${P("saturn")} Satürn ${hh("saturn")}. evinde: sınav`, `<p>Satürn bu dönemde ${TOPIC[hh("saturn")]} sorumluluk yüklüyor. Burada acele etmek yerine sağlam adımlar atarsan uzun vadede karşılığını alırsın.</p>`) +
    (lun.length ? sec("Yaklaşan ay olayları", `<ul class="plain">${lun.map((l) => { const dd = new Date((l.jd - 2440587.5) * 864e5); return `<li><b>${dd.getDate()} ${MONTHS[dd.getMonth()]}:</b> ${l.kind === "new" ? "Yeni Ay" : "Dolunay"} ${S(l.lon).n} burcunda, senin ${current.info.noTime ? ((E.signOf(l.lon) - E.signOf(c.pos.sun.lon) + 12) % 12) + 1 : E.houseOf(l.lon, c.houses.cusps)}. evinde: ${TOPIC[current.info.noTime ? ((E.signOf(l.lon) - E.signOf(c.pos.sun.lon) + 12) % 12) + 1 : E.houseOf(l.lon, c.houses.cusps)]} odaklan.</li>`; }).join("")}</ul>`) : "") + noTimeNote();
}

// ---------- kaydet ve paylaş ----------
const slug = () => (current.info.name || "harita").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/gi, "-");
const quote = () => SUN[E.signOf(current.chart.pos.sun.lon)].split(". ")[0] + ".";
$$("[data-save]").forEach((btn) => btn.addEventListener("click", async () => {
  if (!current) return;
  btn.disabled = true;
  try {
    const kind = btn.dataset.save;
    const blob = await renderCard(current.chart, { ...current.info, quote: quote() }, kind);
    downloadBlob(blob, `${slug()}-dogum-haritasi${kind === "story" ? "-hikaye" : ""}.png`);
    toast("Görsel indirildi.");
  } finally { btn.disabled = false; }
}));
$("[data-share]").addEventListener("click", async (e) => {
  if (!current) return;
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const story = matchMedia("(max-width: 760px)").matches;
    const blob = await renderCard(current.chart, { ...current.info, quote: quote() }, story ? "story" : "post");
    const s = SIGNS[E.signOf(current.chart.pos.sun.lon)].n, as = current.info.noTime ? "" : `, yükselenim ${SIGNS[E.signOf(current.chart.houses.asc)].n}`;
    const r = await shareImage(blob, `${slug()}-dogum-haritasi.png`, `Güneşim ${s}${as}. Sen de haritanı çıkar: https://jinjagames.com/astro/chart/`);
    if (r === "downloaded") toast("Bu cihazda paylaşım menüsü yok; görsel indirildi, istediğin yere gönderebilirsin.");
  } finally { btn.disabled = false; }
});
$("#keepBtn").addEventListener("click", () => {
  if (!current) return;
  keepChart(current.info);
  savedRow();
  toast("Harita bu cihaza kaydedildi.");
});

// açılışta son kayıtlı haritayı yükle
const last = saved()[0];
if (last) { fill(last); show({ ...last }); }
