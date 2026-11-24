// Uyum sayfası, "Doğum haritalarıyla" bölümü: iki kişinin haritası girilir ya da kayıtlılardan seçilir,
// gezegenler arası açılar, ev yerleşimleri ve alt puanlarla ayrıntılı karşılaştırma gösterilir.
import * as E from "../ephem.js?v=13";
import { SIGNS, PLANETS, MATCH } from "../zodiac.js?v=13";
import { ELEMENT_PAIR } from "../readings.js?v=13";
import { $, $$, esc, toast, saved, keepChart, computeChart, placePicker } from "../common.js?v=13";
import { shareBar } from "../card.js?v=13";
import { secNav } from "./ui.js?v=13";
import { enhanceFields } from "../datefield.js?v=13";
import { compare, overlays, PAIR, BODY_NAME, HOUSE_N, OVERLAY } from "../synastry.js?v=13";

// Türkçe ilgi eki: Eren'in, Elif'in, Ali'nin, Ayşe'nin
export function gen(name) {
  const n = String(name).trim();
  if (/kişi$/i.test(n)) return n + "nin"; // "Birinci kişinin"
  const v = (n.toLocaleLowerCase("tr").match(/[aıoueiöü](?=[^aıoueiöü]*$)/) || ["e"])[0];
  const suf = { a: "ın", ı: "ın", e: "in", i: "in", o: "un", u: "un", ö: "ün", ü: "ün" }[v];
  return `${n}'${/[aıoueiöü]$/i.test(n) ? "n" : ""}${suf}`;
}

const people = [];
// iyelik hâlleri: Eren'in Güneşi, Elif'in Venüsü
const POSS = { sun: "Güneşi", moon: "Ayı", mercury: "Merkürü", venus: "Venüsü", mars: "Marsı", jupiter: "Jüpiteri", saturn: "Satürnü", asc: "Yükseleni" };
function personForm(root, idx, preset) {
  root.innerHTML = `
    <h3>${idx === 0 ? "Birinci kişi" : "İkinci kişi"}</h3>
    <div class="savedPick"></div>
    <label class="f"><span>Adı</span><input type="text" data-k="name" placeholder="${idx === 0 ? "Örn. Eren" : "Örn. Deniz"}" maxlength="30" autocomplete="off"></label>
    <label class="f"><span>Doğum tarihi</span><input type="date" data-k="date" min="1900-01-01" max="2100-12-31"></label>
    <div class="f"><span>Doğum saati</span><div class="timeRow"><input type="time" data-k="time" value="12:00" aria-label="Doğum saati"><label class="chk"><input type="checkbox" data-k="noTime"> Bilmiyorum</label></div></div>
    <div class="f"><span>Ülke</span><div data-k="country"></div></div>
    <div class="f"><span>Şehir</span><div data-k="city"></div></div>
    <p class="tzLine" data-k="tz">Şehir ve tarih seçince saat dilimi otomatik hesaplanır.</p>
    <label class="chk keep"><input type="checkbox" data-k="keep"> Bu kişiyi cihazımda sakla</label>`;
  enhanceFields(root);
  const q = (k) => root.querySelector(`[data-k="${k}"]`);
  const updTz = () => {
    const off = place.offset(q("date").value);
    q("tz").textContent = off == null ? "Şehir ve tarih seçince saat dilimi otomatik hesaplanır." : `Saat dilimi: UTC${off >= 0 ? "+" : ""}${off} (o tarihteki yerel saat)`;
  };
  const place = placePicker(q("country"), q("city"), updTz);
  q("date").addEventListener("input", updTz);
  q("noTime").addEventListener("change", () => { q("time").disabled = q("noTime").checked; });
  const fill = (c) => {
    q("name").value = c.name || "";
    q("date").value = c.date;
    q("time").value = c.noTime ? "12:00" : c.time;
    q("noTime").checked = !!c.noTime;
    q("time").disabled = !!c.noTime;
    place.set(c.country, c.city);
    q("keep").checked = false;
    updTz();
  };
  // kayıtlı haritalar: dokununca formu doldurur
  const list = saved();
  const sp = root.querySelector(".savedPick");
  if (list.length) {
    sp.innerHTML = `<small>Kayıtlı kişiler</small><div>${list.map((c, i) => `<button type="button" class="chip" data-i="${i}">${esc(c.name || "İsimsiz")} <small>${esc(c.date.split("-").reverse().join("."))}</small></button>`).join("")}</div>`;
    sp.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]");
      if (!b) return;
      $$(".chip", sp).forEach((x) => x.classList.toggle("on", x === b));
      fill(list[Number(b.dataset.i)]);
    });
  } else sp.innerHTML = `<small>Henüz kayıtlı kişi yok. Bilgileri girip "cihazımda sakla" dersen bir dahakine tek dokunuşla seçebilirsin.</small>`;
  if (list[preset]) { fill(list[preset]); sp.querySelector(`[data-i="${preset}"]`)?.classList.add("on"); }
  return {
    read() {
      const date = q("date").value;
      if (!date) { q("date").focus(); throw Error(`${idx === 0 ? "Birinci" : "İkinci"} kişinin doğum tarihini seç.`); }
      const city = place.city;
      if (!city) throw Error(`${idx === 0 ? "Birinci" : "İkinci"} kişinin doğduğu şehri seç.`);
      const noTime = q("noTime").checked;
      const info = { name: q("name").value.trim() || (idx === 0 ? "Birinci kişi" : "İkinci kişi"), date, time: noTime ? "12:00" : q("time").value || "12:00", noTime,
        country: place.country.name, city: city.n, lat: city.la, lon: city.lo, off: place.offset(date) ?? 0 };
      if (q("keep").checked) keepChart(info);
      return info;
    },
  };
}

const TIPS = {
  ask: "Çekiminizi canlı tutmak için rutini kırın: sürpriz buluşmalar, birlikte yeni deneyimler ve iltifatı esirgememek.",
  duygu: "Duygusal ihtiyaçlarınızı tahmin etmeye bırakmayın; 'şu an neye ihtiyacın var?' diye sormak bağınızı güçlendirir.",
  iletisim: "Önemli konuları sakin bir anda, yüz yüze konuşun. Biriniz anlatırken öteki sözünü kesmeden dinlesin.",
  kalicilik: "Uzun vadeli plan yapmak ve küçük sözleri tutmak güveninizi büyütür; ortak bir hedef sizi birbirinize bağlar.",
};
const GROUP_TITLE = { ask: "Aşk ve çekim", duygu: "Duygusal bağ", iletisim: "İletişim", kalicilik: "Kalıcılık ve bağlılık" };
const GROUP_EMPTY = {
  ask: "Venüs ve Mars arasında güçlü bir açı yok; çekiminiz daha çok güneş ve ay burçlarınızın uyumundan besleniyor. Romantizmi bilinçli olarak beslemek iyi gelir.",
  duygu: "Ay'larınız arasında belirgin bir açı yok; duygusal bağınız zamanla ve ortak deneyimlerle kurulur.",
  iletisim: "Merkür'leriniz arasında güçlü bir açı yok; iletişim tarzınızı birlikte keşfetmeniz gerekecek.",
  kalicilik: "Satürn bağlantısı zayıf; ilişkiyi kalıcı kılmak sizin bilinçli seçiminize kalmış. Bu da bir özgürlüktür.",
};
const band = (v) => (v >= 80 ? "Çok güçlü" : v >= 68 ? "Güçlü" : v >= 55 ? "Dengeli" : v >= 42 ? "Emek isteyen" : "Zorlayıcı");

function render(A, B) {
  const ca = computeChart(A), cb = computeChart(B);
  const PA = { chart: ca, noTime: A.noTime }, PB = { chart: cb, noTime: B.noTime };
  const r = compare(PA, PB);
  const nA = A.name, nB = B.name;
  const who = (x) => `<b>${esc(gen(nA))} ${POSS[x.a]} · ${esc(gen(nB))} ${POSS[x.b]}</b>`;
  const asp = (x) => `<li><span class="at ${x.type}">${x.asp.glyph}</span><p>${who(x)} <small>${x.asp.name} · ${x.orb.toFixed(1)}° sapma</small>${esc(PAIR[x.k][x.tone])}</p></li>`;
  const s = (ch, b) => SIGNS[E.signOf(b === "asc" ? ch.houses.asc : ch.pos[b].lon)];
  const big = (ch, noTime) => ["sun", "moon", "asc"].map((b) => b === "asc" && noTime ? `<span>Yükselen: <b>saat yok</b></span>` : `<span>${BODY_NAME[b]}: <b style="color:${s(ch, b).c}">${s(ch, b).g} ${s(ch, b).n}</b></span>`).join("");
  const sa = E.signOf(ca.pos.sun.lon), sb = E.signOf(cb.pos.sun.lon), dist = Math.min(Math.abs(sa - sb), 12 - Math.abs(sa - sb));
  const EL = ["Ateş", "Toprak", "Hava", "Su"], elKey = [SIGNS[sa].el, SIGNS[sb].el].sort((x, y) => EL.indexOf(x) - EL.indexOf(y)).join("-");
  const used = new Set();
  const groupSec = (g) => {
    const items = r.list.filter((x) => r.groups[g][x.k]);
    items.forEach((x) => used.add(x));
    return `<section class="fcSec" id="s-${g}"><h3>${GROUP_TITLE[g]} <span class="band">%${r.sub[g]} · ${band(r.sub[g])}</span></h3>${items.length ? `<ul class="asp">${items.map(asp).join("")}</ul>` : `<p>${GROUP_EMPTY[g]}</p>`}</section>`;
  };
  const groupsHtml = ["ask", "duygu", "iletisim", "kalicilik"].map(groupSec).join("");
  const others = r.list.filter((x) => !used.has(x));
  const ov = (X, Y, nX, nY) => overlays(X, Y).map((o) => `<li><span class="pgl" style="color:${PLANETS[o.body].c}">${PLANETS[o.body].g}</span><p><b>${esc(gen(nY))} ${POSS[o.body]} → ${esc(gen(nX))} ${o.house}. evinde</b><br>${esc(nY)}, ${esc(gen(nX))} ${HOUSE_N[o.house]} alanına ${OVERLAY[o.body]}.</p></li>`).join("");
  const ovA = ov(PA, PB, nA, nB), ovB = ov(PB, PA, nB, nA);
  const good = r.list.filter((x) => x.tone !== "t").slice(0, 4), hard = r.list.filter((x) => x.tone === "t").slice(0, 3);
  const weakest = Object.entries(r.sub).sort((x, y) => x[1] - y[1])[0][0];
  const label = (x) => `${BODY_NAME[x.a]}–${BODY_NAME[x.b]} ${x.asp.name.toLocaleLowerCase("tr")}`;
  const NAV = [["ozet", "Özet"], ["ask", "Aşk"], ["duygu", "Duygu"], ["iletisim", "İletişim"], ["kalicilik", "Kalıcılık"], ["evler", "Ev yerleşimleri"], ["burclar", "Güneş burçları"], ["guc", "Güçlü yanlar"], ["oneri", "Öneri"]];
  $("#cDetail").innerHTML = `
    <div class="match glass cMatch">
      <div class="mSide"><span>${esc(nA)}</span><div class="bigThree">${big(ca, A.noTime)}</div></div>
      <div class="mScore"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="arc" id="cArc" cx="60" cy="60" r="52" pathLength="100"/></svg><b>${r.total}</b><small>%</small></div>
      <div class="mSide"><span>${esc(nB)}</span><div class="bigThree">${big(cb, B.noTime)}</div></div>
    </div>
    <header class="mHead"><h2>${esc(nA)} <span>&amp;</span> ${esc(nB)}</h2><span class="mType">${band(r.total)} bir uyum · ${r.list.length} gezegen bağlantısı</span>
      <div class="subScores">${Object.entries(GROUP_TITLE).map(([g, t]) => `<span>${t.split(" ")[0]} <b>%${r.sub[g]}</b></span>`).join("")}</div></header>
    <div id="cShare"></div>
    <article class="glass fc mLong">
      <nav class="secNav" aria-label="Bölümler">${NAV.map(([id, t]) => `<a href="#s-${id}">${t}</a>`).join("")}</nav>
      <section class="fcSec" id="s-ozet"><h3>Özet</h3><p>${esc(nA)} ile ${esc(nB)} arasında ${r.list.length} önemli gezegen bağlantısı var. Genel uyumunuz <b>%${r.total}</b>, yani ${band(r.total).toLocaleLowerCase("tr")}. En güçlü alanınız <b>${GROUP_TITLE[Object.entries(r.sub).sort((x, y) => y[1] - x[1])[0][0]].toLocaleLowerCase("tr")}</b>, en çok emek isteyen alanınız <b>${GROUP_TITLE[weakest].toLocaleLowerCase("tr")}</b>.</p>
        ${A.noTime || B.noTime ? `<p class="note">${A.noTime && B.noTime ? "İkinizin de" : esc(gen(A.noTime ? nA : nB))}</p>` : ""}</section>
      ${groupsHtml}
      ${others.length ? `<section class="fcSec" id="s-diger"><h3>Diğer bağlantılar</h3><ul class="asp">${others.map(asp).join("")}</ul></section>` : ""}
      <section class="fcSec" id="s-evler"><h3>Ev yerleşimleri</h3><p>Bir kişinin gezegenleri ötekinin haritasında hangi eve düşüyorsa, o kişi ötekinin hayatının o alanını etkiler.</p>
        ${ovA ? `<h4>${esc(gen(nA))} haritasında ${esc(nB)}</h4><ul class="pl2">${ovA}</ul>` : `<p class="note">${esc(gen(nA))} doğum saati olmadığı için evleri hesaplanamadı.</p>`}
        ${ovB ? `<h4>${esc(gen(nB))} haritasında ${esc(nA)}</h4><ul class="pl2">${ovB}</ul>` : `<p class="note">${esc(gen(nB))} doğum saati olmadığı için evleri hesaplanamadı.</p>`}</section>
      <section class="fcSec" id="s-burclar"><h3>Güneş burçlarınız: ${SIGNS[sa].g} ${SIGNS[sa].n} ve ${SIGNS[sb].g} ${SIGNS[sb].n}</h3><p>${MATCH[dist].d}</p><p>${ELEMENT_PAIR[elKey]}</p></section>
      <section class="fcSec" id="s-guc"><h3>Güçlü yanlar ve dikkat</h3>
        <div class="pn"><div class="pnCol ok"><small>Sizi bağlayan</small>${good.length ? good.map((x) => `<span>${label(x)}</span>`).join("") : "<span>Güneş burçlarınızın uyumu</span>"}</div><div class="pnCol no"><small>Dikkat isteyen</small>${hard.length ? hard.map((x) => `<span>${label(x)}</span>`).join("") : "<span>Belirgin bir gerilim yok</span>"}</div></div></section>
      <section class="fcSec advice" id="s-oneri"><h3>Öneri</h3><p>${TIPS[weakest]}</p></section>
    </article>`;
  // saat eksik notu: tam cümle
  const nt = $("#s-ozet .note");
  if (nt) nt.textContent = `${A.noTime && B.noTime ? "İkinizin de doğum saati olmadığı için" : `${gen(A.noTime ? nA : nB)} doğum saati olmadığı için`} yükselen ve ev yerleşimleri bu karşılaştırmada eksik kalıyor. Saat girilirse sonuç daha ayrıntılı olur.`;
  requestAnimationFrame(() => { $("#cArc").style.strokeDashoffset = 100 - r.total; });
  shareBar($("#cShare"), {
    file: () => "harita-uyumu",
    url: () => location.origin + location.pathname + "?mode=charts",
    text: () => `${nA} ve ${nB} doğum haritası uyumu: %${r.total}`,
    card: () => ({ color: "#ff8fc7", eyebrow: "Doğum haritası uyumu", title: `${nA} & ${nB}`,
      match: { a: nA, b: nB, ga: SIGNS[sa].g, gb: SIGNS[sb].g, score: r.total, type: `${band(r.total)} bir uyum · ${r.list.length} gezegen bağlantısı`,
        subs: Object.entries(GROUP_TITLE).map(([g, t]) => [t.split(" ")[0], r.sub[g]]) },
      blocks: [...(good[0] ? [{ h: "Sizi bağlayan", t: PAIR[good[0].k][good[0].tone] }] : []), ...(hard[0] ? [{ h: "Dikkat", t: PAIR[hard[0].k][hard[0].tone] }] : []), { h: "Öneri", t: TIPS[weakest] }] }),
  });
  secNav($(".secNav", $("#cDetail")));
  $("#cDetail").scrollIntoView({ behavior: "smooth", block: "start" });
}

let ready = false;
export function mountCharts() {
  if (ready) return;
  ready = true;
  // kayıtlı kişi varsa ilk ikisi hazır gelir
  people[0] = personForm($("#p1"), 0, 0);
  people[1] = personForm($("#p2"), 1, 1);
  $("#cGo").addEventListener("click", () => {
    try { render(people[0].read(), people[1].read()); } catch (e) { toast(e.message); }
  });
}
