// Uyum sayfası: iki burç ya da iki kayıtlı harita; ayrıntılı bölümler ve harita karşılaştırması.
import * as E from "../ephem.js";
import { SIGNS, PLANETS, MATCH } from "../zodiac.js";
import { PROFILE, ELEMENT_PAIR, MOD_PAIR, REL } from "../readings.js";
import { $, esc, SLUGS, signBySlug, mySign, saved, computeChart, shareLink, combo } from "../common.js";

const EL_ORDER = ["Ateş", "Toprak", "Hava", "Su"], MOD_ORDER = ["Öncü", "Sabit", "Değişken"];
const pairKey = (a, b, order) => [a, b].sort((x, y) => order.indexOf(x) - order.indexOf(y)).join("-");
const q = new URLSearchParams(location.search);
const list = saved();
// seçenekler: 12 burç + kayıtlı haritalar
const OPTS = [...SIGNS.map((s, i) => ({ id: SLUGS[i], n: `${s.g} ${s.n}`, sign: i })), ...list.map((c, i) => ({ id: "h" + i, n: `★ ${c.name || "Kayıtlı harita"}`, chart: c }))];
const pickOf = (id) => OPTS.find((o) => o.id === id) || (signBySlug(id) != null ? OPTS[signBySlug(id)] : undefined);
let A = pickOf(q.get("a")) || (list[0] ? pickOf("h0") : pickOf(SLUGS[mySign()])), B = pickOf(q.get("b")) || pickOf(SLUGS[(signOf(A) + 6) % 12]);
function signOf(o) { return o.sign ?? E.signOf(computeChart(o.chart).pos.sun.lon); }

function select(el, cur, onPick) {
  combo(el, { items: OPTS, placeholder: "Burç seç", label: "Burç ya da harita", onPick }).set(cur);
}
select($("#m1"), A, (o) => { A = o; draw(); });
select($("#m2"), B, (o) => { B = o; draw(); });

const SYN = {
  "venus-mars": ["Venüs ve Mars arasındaki bu bağ güçlü bir fiziksel çekim demek.", "Biri sevgiyle yaklaşırken öteki tutkuyla karşılık veriyor."],
  "sun-moon": ["Güneş ve Ay arasındaki bu bağ ilişkinin temelini oluşturur; biri yön verir, öteki duygusal yuva olur."],
  "moon-moon": ["Ay ve Ay arasındaki bağ duygusal ritminizi anlatır; birbirinizin ruh hâlini nasıl yaşadığınızı gösterir."],
  "venus-venus": ["İki Venüs arasındaki bağ zevklerinizi ve sevgiyi gösterme biçiminizi karşılaştırır."],
  "sun-sun": ["İki Güneş arasındaki bağ kimliklerinizin ve hedeflerinizin nasıl buluştuğunu anlatır."],
  "mercury-mercury": ["İki Merkür arasındaki bağ nasıl konuştuğunuzu ve tartıştığınızı anlatır."],
};
const ASP_FEEL = { conj: "çok yakın ve yoğun", sext: "kolay ve destekleyici", square: "çekici ama gergin", trine: "akıcı ve uyumlu", opp: "karşılıklı çeken ama denge isteyen" };
function synastry() {
  if (!A.chart || !B.chart) return "";
  const a = computeChart(A.chart).pos, b = computeChart(B.chart).pos;
  const pairs = [["venus", "mars"], ["mars", "venus"], ["sun", "moon"], ["moon", "sun"], ["moon", "moon"], ["venus", "venus"], ["sun", "sun"], ["mercury", "mercury"]];
  const rows = [];
  for (const [x, y] of pairs) {
    let d = Math.abs(a[x].lon - b[y].lon) % 360;
    if (d > 180) d = 360 - d;
    const asp = E.ASPECTS.find((t) => Math.abs(d - t.angle) <= t.orb);
    if (!asp) continue;
    const key = [x, y].sort().join("-") === "mars-venus" ? "venus-mars" : `${x}-${y}`;
    const txt = (SYN[key] || SYN[[x, y].sort().join("-")] || [""])[0];
    rows.push(`<li><span class="at ${asp.id}">${asp.glyph}</span><p><b>${esc(A.chart.name || "Sen")}: ${PLANETS[x].n} · ${esc(B.chart.name || "O")}: ${PLANETS[y].n}</b> ${asp.name}, yani ${ASP_FEEL[asp.id]} bir bağ. ${txt}</p></li>`);
  }
  return `<section class="rd glass"><h3>Haritalarınız karşılaştırıldığında</h3>${rows.length ? `<ul class="asp">${rows.join("")}</ul>` : "<p>Kişisel gezegenleriniz arasında güçlü bir açı yok; ilişkiniz daha çok güneş burçlarınızın uyumuyla şekilleniyor.</p>"}</section>`;
}
function draw() {
  const a = signOf(A), b = signOf(B), sa = SIGNS[a], sb = SIGNS[b];
  const dist = Math.min(Math.abs(a - b), 12 - Math.abs(a - b)), M = MATCH[dist], R = REL[dist];
  const el = ELEMENT_PAIR[pairKey(sa.el, sb.el, EL_ORDER)], mod = MOD_PAIR[pairKey(sa.mod, sb.mod, MOD_ORDER)];
  const friendly = { "Ateş-Hava": 4, "Su-Toprak": 4 }[pairKey(sa.el, sb.el, EL_ORDER)] || 0;
  const score = Math.min(98, M.score + friendly);
  $("#mNum").textContent = score;
  $("#mArc").style.strokeDashoffset = 100 - score;
  history.replaceState(null, "", `?a=${A.id}&b=${B.id}`);
  const first = (t) => t.split(". ").slice(0, 2).join(". ") + (t.split(". ").length > 2 ? "." : "");
  const sub = (k) => Math.max(30, Math.min(98, score + k));
  $("#mDetail").innerHTML = `
    <header class="mHead"><h2>${sa.g} ${sa.n} <span>&amp;</span> ${sb.g} ${sb.n}</h2><span class="mType">${M.t} · ${sa.el} ile ${sb.el}</span><p>${M.d}</p>
      <div class="subScores"><span>Aşk <b>%${sub(friendly ? 2 : dist === 3 ? 4 : 0)}</b></span><span>Arkadaşlık <b>%${sub(dist === 2 || dist === 4 ? 4 : -3)}</b></span><span>İş <b>%${sub(sa.mod !== sb.mod ? 3 : -4)}</b></span></div>
      <button type="button" class="btn glass sm" id="shareM">Paylaş</button></header>
    <div class="mGrid">
      <section class="rd glass"><h3>Aşkta</h3><p>${el}</p><p><b>${sa.n}:</b> ${first(PROFILE[a].love)}</p><p><b>${sb.n}:</b> ${first(PROFILE[b].love)}</p></section>
      <section class="rd glass"><h3>Arkadaşlıkta</h3><p><b>${sa.n}</b> ${PROFILE[a].friend.charAt(0).toLocaleLowerCase("tr") + PROFILE[a].friend.slice(1)}</p><p><b>${sb.n}</b> ${PROFILE[b].friend.charAt(0).toLocaleLowerCase("tr") + PROFILE[b].friend.slice(1)}</p></section>
      <section class="rd glass"><h3>İşte ve ortak projelerde</h3><p>${mod}</p><p>${sa.n} ${sa.mod.toLocaleLowerCase("tr")}, ${sb.n} ${sb.mod.toLocaleLowerCase("tr")} bir burç; ${sa.mod === sb.mod ? "aynı tempoda çalışırsınız ama ikiniz de aynı rolü isteyebilirsiniz." : "iş bölümünü bu farka göre yaparsanız birbirinizi tamamlarsınız."}</p></section>
      <section class="rd glass two"><h3>Güçlü yanlarınız</h3><p>${R.good}</p><div class="chips">${[...new Set([...PROFILE[a].plus.slice(0, 2), ...PROFILE[b].plus.slice(0, 2)])].map((x) => `<span class="ok">${x}</span>`).join("")}</div></section>
      <section class="rd glass two"><h3>Dikkat etmeniz gerekenler</h3><p>${R.hard}</p><div class="chips">${[...new Set([PROFILE[a].minus[0], PROFILE[b].minus[0]])].map((x) => `<span class="no">${x}</span>`).join("")}</div></section>
      <section class="rd glass wide"><h3>Öneri</h3><p>${R.tip}</p></section>
    </div>
    ${synastry()}
    ${!A.chart || !B.chart ? `<p class="hint">İkinizin de doğum haritası kayıtlıysa Venüs, Mars ve Ay karşılaştırması da burada görünür. <a href="/astro/chart/">Harita çıkar ve sakla →</a></p>` : ""}`;
  $("#shareM").addEventListener("click", () => shareLink(location.href, `${sa.n} ve ${sb.n} uyumu: %${score}`));
}
draw();
