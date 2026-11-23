// Haftalık ve aylık yorum sayfası (hangisi olduğu bölümün data-period değerinden okunur).
import * as E from "../ephem.js?v=9";
import { SIGNS } from "../zodiac.js?v=9";
import { $, $$, esc, store, SLUGS, signBySlug, mySign, saved, computeChart } from "../common.js?v=9";
import { shareBar } from "../card.js?v=9";
import { loadForecast, secNav } from "./ui.js?v=9";

const period = $("[data-period]").dataset.period; // week | month
const isWeek = period === "week";
let sel = signBySlug(new URLSearchParams(location.search).get("sign")) ?? mySign();
let fc = null;

// kayıtlı harita varsa güneş ve yükselen için kısayol
const c0 = saved()[0];
const mine = c0 ? (() => { const ch = computeChart(c0); return { sun: E.signOf(ch.pos.sun.lon), asc: c0.noTime ? null : E.signOf(ch.houses.asc) }; })() : null;

function picker() {
  $("#signPick").innerHTML = SIGNS.map((s, i) => `<a role="tab" href="?sign=${SLUGS[i]}" data-sign="${i}" aria-selected="${i === sel}" style="--c:${s.c}"><span>${s.g}</span><b>${s.n}</b><small>${s.dates}</small></a>`).join("");
}
$("#signPick").addEventListener("click", (e) => {
  const a = e.target.closest("[data-sign]");
  if (!a) return;
  e.preventDefault();
  setSign(Number(a.dataset.sign), true);
});
function setSign(i, scroll) {
  sel = i;
  history.replaceState(null, "", `?sign=${SLUGS[i]}`);
  picker();
  draw();
  if (scroll) $("#fcBox").scrollIntoView({ behavior: "smooth", block: "start" });
}

const SCORE_NAMES = [["ask", "Aşk"], ["para", "Para"], ["kariyer", "Kariyer"], ["saglik", "Sağlık"]];
const meter = (v) => `<i class="dots" aria-label="5 üzerinden ${v}">${[1, 2, 3, 4, 5].map((k) => `<b class="${k <= v ? "on" : ""}"></b>`).join("")}</i>`;
// "Bekarsan:" gibi baştaki etiketi kalın yaz
const para = (t) => `<p>${esc(t).replace(/^(Bekarsan:|İlişkin varsa:)/, "<b>$1</b>")}</p>`;
const chips = (pos, neg) => (pos?.length || neg?.length)
  ? `<div class="pn">${pos?.length ? `<div class="pnCol ok"><small>Destekleyen</small>${pos.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}${neg?.length ? `<div class="pnCol no"><small>Dikkat</small>${neg.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}</div>` : "";

function draw() {
  if (!fc) return;
  const P = fc[period], s = SIGNS[sel], d = P.signs[s.id];
  const label = isWeek ? "Haftanın" : "Ayın";
  // eski biçimdeki veri (önbellekten) gelirse yine de göster
  const secs = d.sections || [
    { id: "genel", title: `${label} genel havası`, paras: [d.general] },
    { id: "ask", title: "Aşk ve ilişkiler", paras: [d.love] },
    { id: "kariyer", title: "İş ve para", paras: [d.work] },
  ];
  const flowId = isWeek ? "gun" : "hafta";
  const flow = isWeek
    ? (d.days?.length ? `<section class="fcSec" id="s-gun"><h3>Gün gün bu hafta</h3><ol class="days">${d.days.map((x) => `<li class="t${x.tone === "+" ? "p" : x.tone === "-" ? "n" : "z"}"><b>${esc(x.day)}</b><small>Ay ${esc(x.moon)} burcunda</small><p>${esc(x.text)}</p></li>`).join("")}</ol><p class="hint">Yeşil günler sana daha kolay, turuncu günler biraz daha dikkat isteyen günler.</p></section>` : "")
    : (d.weeks?.length ? `<section class="fcSec" id="s-hafta"><h3>Hafta hafta bu ay</h3><ol class="weeks">${d.weeks.map((w) => `<li><b>${esc(w.range)}</b>${w.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</li>`).join("")}</ol></section>` : "");
  const nav = [...secs.map((x) => [x.id, x.title.replace(/ ve .*/, "")]), ...(flow ? [[flowId, isWeek ? "Gün gün" : "Hafta hafta"]] : []), ["oneri", "Öneri"]];
  const quick = mine
    ? `<div class="quick">${mine.sun !== sel ? `<button type="button" data-go="${mine.sun}">Güneş burcum: ${SIGNS[mine.sun].g} ${SIGNS[mine.sun].n}</button>` : ""}${mine.asc != null && mine.asc !== sel ? `<button type="button" data-go="${mine.asc}">Yükselenim: ${SIGNS[mine.asc].g} ${SIGNS[mine.asc].n}</button>` : ""}</div>`
    : `<p class="hint">Yükselen burcunu da okumak en doğrusu. Bilmiyorsan <a href="/astro/chart/">doğum haritanı çıkar</a>.</p>`;

  $("#fcBox").innerHTML = `
    <header class="fcHead" style="--c:${s.c}"><span aria-hidden="true">${s.g}</span><div><h2>${s.n} ${isWeek ? "bu hafta" : "bu ay"}</h2><small>${esc(P.title)} · ${s.el} grubu · ${s.dates}</small></div></header>
    ${d.motto ? `<p class="motto">“${esc(d.motto)}”</p>` : ""}
    ${d.scores ? `<div class="scores">${SCORE_NAMES.map(([k, n]) => `<div><span>${n}</span>${meter(d.scores[k])}</div>`).join("")}</div>` : ""}
    <div id="fcShare"></div>
    ${quick}
    <nav class="secNav" aria-label="Bölümler">${nav.map(([id, t]) => `<a href="#s-${id}">${esc(t)}</a>`).join("")}</nav>
    ${secs.map((x) => `<section class="fcSec" id="s-${x.id}"><h3>${esc(x.title)}</h3>${x.paras.map(para).join("")}${chips(x.pos, x.neg)}</section>`).join("")}
    ${flow}
    <section class="fcSec advice" id="s-oneri"><h3>${label} önerisi</h3><p>${esc(d.tip)}</p>
      <div class="pills">${d.lucky ? `<span class="pill">Şanslı gün: <b>${esc(d.lucky)}</b></span>` : ""}${d.color ? `<span class="pill">Şanslı renk: <b>${esc(d.color)}</b></span>` : ""}${d.dates?.length ? `<span class="pill">Önemli günler: <b>${d.dates.map(esc).join(", ")}</b></span>` : ""}</div></section>
    <footer class="fcFoot"><a href="/astro/signs/?sign=${SLUGS[sel]}">${s.n} burcunun tüm özellikleri →</a><a href="/astro/${isWeek ? "monthly" : "weekly"}/?sign=${SLUGS[sel]}">${isWeek ? "Aylık" : "Haftalık"} yorumu oku →</a><a href="/astro/compatibility/?a=${SLUGS[sel]}">${s.n} uyumları →</a></footer>`;

  shareBar($("#fcShare"), {
    file: () => `${SLUGS[sel]}-${isWeek ? "haftalik" : "aylik"}`,
    url: () => location.href,
    text: () => `${s.n} burcu ${isWeek ? "bu hafta" : "bu ay"} (${P.title}):`,
    card: () => ({ glyph: s.g, color: s.c, eyebrow: `${isWeek ? "Haftalık" : "Aylık"} yorum · ${P.title}`, title: s.n, sub: d.motto ? `“${d.motto}”` : s.dates,
      blocks: secs.slice(0, 4).map((x) => ({ h: x.title, t: x.paras.join(" ") })) }),
    save: { label: "Burcum olarak kaydet", doneLabel: "Burcum kaydedildi", toast: `${s.n} burcun olarak kaydedildi; diğer sayfalar bununla açılacak.`, done: () => store.get("jaSign", -1) === sel, onSave: () => store.set("jaSign", sel) },
  });
  $$("[data-go]", $("#fcBox")).forEach((b) => b.addEventListener("click", () => setSign(Number(b.dataset.go), false)));
  secNav($(".secNav", $("#fcBox")));
}
picker();
try {
  fc = await loadForecast();
  const P = fc[period];
  $("#periodTitle").textContent = P.title;
  $("#skyList").innerHTML = P.sky.length ? P.sky.map((n) => `<li>${esc(n.text)}</li>`).join("") : "<li>Bu dönemde büyük bir geçiş yok; sakin bir gökyüzü.</li>";
  draw();
} catch {
  $("#fcBox").innerHTML = `<p class="hint">Yorumlar şu an yüklenemedi. Biraz sonra tekrar dene.</p>`;
}
