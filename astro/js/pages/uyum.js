// Uyum sayfası: iki burç ya da iki kayıtlı harita; ayrıntılı bölümler ve harita karşılaştırması.
import * as E from "../ephem.js?v=14";
import { SIGNS, PLANETS, MATCH } from "../zodiac.js?v=14";
import { PROFILE, ELEMENT_PAIR, MOD_PAIR, REL } from "../readings.js?v=14";
import { $, $$, esc, SLUGS, signBySlug, saved, computeChart, combo } from "../common.js?v=14";
import { mountCharts } from "./uyumHarita.js?v=14";
import { shareBar } from "../card.js?v=14";
import { MOON_LOVE, LEARN, SPEND, HOME_STYLE } from "../readings2.js?v=14";
import { TIP } from "../forecast-texts.js?v=14";
import { secNav } from "./ui.js?v=14";

const EL_ORDER = ["Ateş", "Toprak", "Hava", "Su"], MOD_ORDER = ["Öncü", "Sabit", "Değişken"];
const pairKey = (a, b, order) => [a, b].sort((x, y) => order.indexOf(x) - order.indexOf(y)).join("-");
const q = new URLSearchParams(location.search);
const list = saved();
// seçenekler: 12 burç + kayıtlı haritalar
const OPTS = [...SIGNS.map((s, i) => ({ id: SLUGS[i], n: `${s.g} ${s.n}`, sign: i })), ...list.map((c, i) => ({ id: "h" + i, n: `★ ${c.name || "Kayıtlı harita"}`, chart: c }))];
const pickOf = (id) => OPTS.find((o) => o.id === id) || (signBySlug(id) != null ? OPTS[signBySlug(id)] : undefined);
// varsayılan: solda Kova, sağda Terazi; kullanıcı istediğini seçer
let A = pickOf(q.get("a")) || pickOf("aquarius"), B = pickOf(q.get("b")) || pickOf("libra");
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
  const two = (fa, fb) => `<p><b>${sa.n}:</b> ${fa}</p><p><b>${sb.n}:</b> ${fb}</p>`;
  const low = (t) => t.charAt(0).toLocaleLowerCase("tr") + t.slice(1);
  const sameEl = sa.el === sb.el, sameMod = sa.mod === sb.mod;
  const SECS = [
    ["genel", "Genel uyum", `<p>${M.d}</p><p>${el}</p><p>${sa.n} ${sa.el.toLocaleLowerCase("tr")}, ${sb.n} ${sb.el.toLocaleLowerCase("tr")} grubundan. ${sameEl ? "Aynı elementten oldukları için birbirlerini sözsüz anlarlar; ama aynı zayıflıkları da paylaşırlar." : "Farklı elementlerden geldikleri için birbirlerine eksik olanı tamamlayabilirler; bunun için farkı merak etmek gerekir."}</p>`],
    ["ask", "Aşkta", `<p>${el}</p>${two(PROFILE[a].love, PROFILE[b].love)}`],
    ["ihtiyac", "İlişkide ne isterler", `${two(MOON_LOVE[a], MOON_LOVE[b])}<p>Bu ihtiyaçları açıkça konuşmak, tahmin etmeye çalışmaktan her zaman daha iyi sonuç verir.</p>`],
    ["iletisim", "İletişim ve tartışmalar", `${two(LEARN[a], LEARN[b])}<p>${sameMod ? "İkisi de aynı nitelikte olduğu için tartışmada ikisi de geri adım atmak istemeyebilir; sırayla konuşmak ve konuyu ertesi güne bırakmak işe yarar." : "Nitelikleri farklı; biri harekete geçmek, öteki beklemek isteyebilir. Kararları birlikte bir takvime bağlamak çatışmayı azaltır."}</p>`],
    ["dost", "Arkadaşlıkta", `<p><b>${sa.n}</b> ${low(PROFILE[a].friend)}</p><p><b>${sb.n}</b> ${low(PROFILE[b].friend)}</p>`],
    ["is", "İşte ve ortak projelerde", `<p>${mod}</p><p>${sa.n} ${sa.mod.toLocaleLowerCase("tr")}, ${sb.n} ${sb.mod.toLocaleLowerCase("tr")} bir burç; ${sameMod ? "aynı tempoda çalışırlar ama ikisi de aynı rolü isteyebilir." : "iş bölümünü bu farka göre yaparlarsa birbirlerini tamamlarlar."}</p>${two(PROFILE[a].career, PROFILE[b].career)}`],
    ["para", "Para ve ortak hayat", `${two(SPEND[a], SPEND[b])}<p>Ortak bir bütçe, ikisinin de harcama tarzına alan bırakacak şekilde kurulursa para konusu tartışma değil güven kaynağı olur.</p>`],
    ["ev", "Ev ve aile hayatı", two(HOME_STYLE[a], HOME_STYLE[b])],
    ["guc", "Güçlü yanlar ve dikkat", `<p>${R.good}</p><p>${R.hard}</p><div class="pn"><div class="pnCol ok"><small>Destekleyen</small>${[...new Set([...PROFILE[a].plus.slice(0, 3), ...PROFILE[b].plus.slice(0, 3)])].map((x) => `<span>${x}</span>`).join("")}</div><div class="pnCol no"><small>Dikkat</small>${[...new Set([...PROFILE[a].minus.slice(0, 2), ...PROFILE[b].minus.slice(0, 2)])].map((x) => `<span>${x}</span>`).join("")}</div></div>`],
    ["oneri", "Öneriler", `<p>${R.tip}</p><ul class="plain"><li><b>${sa.n} için:</b> ${TIP[sa.el][a % 3]}</li><li><b>${sb.n} için:</b> ${TIP[sb.el][(b + 1) % 3]}</li></ul>`],
  ];
  $("#mDetail").innerHTML = `
    <header class="mHead"><h2>${sa.g} ${sa.n} <span>&amp;</span> ${sb.g} ${sb.n}</h2><span class="mType">${M.t} · ${sa.el} ile ${sb.el}</span><p>${M.d}</p>
      <div class="subScores"><span>Aşk <b>%${sub(friendly ? 2 : dist === 3 ? 4 : 0)}</b></span><span>Arkadaşlık <b>%${sub(dist === 2 || dist === 4 ? 4 : -3)}</b></span><span>İş <b>%${sub(sa.mod !== sb.mod ? 3 : -4)}</b></span></div>
      </header>
    <div id="mShare"></div>
    <article class="glass fc mLong">
      <nav class="secNav" aria-label="Bölümler">${SECS.map(([id, t]) => `<a href="#s-${id}">${t}</a>`).join("")}</nav>
      ${SECS.map(([id, t, h]) => `<section class="fcSec" id="s-${id}"><h3>${t}</h3>${h}</section>`).join("")}
    </article>
    ${synastry()}
    ${!A.chart || !B.chart ? `<p class="hint">İkinizin de doğum haritası kayıtlıysa Venüs, Mars ve Ay karşılaştırması da burada görünür. <a href="/astro/chart/">Harita çıkar ve sakla →</a></p>` : ""}`;
  secNav($(".secNav", $("#mDetail")));
  const nm = (o, sg) => (o.chart ? o.chart.name || sg.n : sg.n);
  shareBar($("#mShare"), {
    file: () => `uyum-${SLUGS[a]}-${SLUGS[b]}`,
    url: () => location.href,
    text: () => `${nm(A, sa)} ve ${nm(B, sb)} uyumu: %${score}`,
    card: () => ({ color: "#ff8fc7", eyebrow: "Burç uyumu", title: `${nm(A, sa)} & ${nm(B, sb)}`,
      match: { a: nm(A, sa), b: nm(B, sb), ga: sa.g, gb: sb.g, score, type: `${M.t} · ${sa.el} ile ${sb.el}`,
        subs: [["Aşk", sub(friendly ? 2 : dist === 3 ? 4 : 0)], ["Arkadaşlık", sub(dist === 2 || dist === 4 ? 4 : -3)], ["İş", sub(sa.mod !== sb.mod ? 3 : -4)]] },
      blocks: [{ h: "Aşkta", t: el }, { h: "Güçlü yanlarınız", t: R.good }, { h: "Dikkat", t: R.hard }, { h: "Öneri", t: R.tip }] }),
  });
}
draw();

// Burçlarla / Doğum haritalarıyla
function setMode(m) {
  $$("[data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
  $("#signMode").hidden = m !== "signs";
  $("#chartMode").hidden = m !== "charts";
  if (m === "charts") { mountCharts(); history.replaceState(null, "", "?mode=charts"); } else draw();
}
$$("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
if (q.get("mode") === "charts") setMode("charts");
