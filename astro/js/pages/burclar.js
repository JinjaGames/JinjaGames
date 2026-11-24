// Burç profilleri: ?sign=aries gibi; parametre yoksa kendi burcun (ya da bugünkü güneş burcu).
import { SIGNS, PLANETS } from "../zodiac.js?v=14";
import { PROFILE } from "../readings.js?v=14";
import { HOME_STYLE, SPEND, LEARN } from "../readings2.js?v=14";
import { $, esc, store, SLUGS, signBySlug, mySign } from "../common.js?v=14";
import { shareBar } from "../card.js?v=14";
import { signGridHtml, loadForecast, secNav } from "./ui.js?v=14";

const i = signBySlug(new URLSearchParams(location.search).get("sign")) ?? mySign();
const s = SIGNS[i], p = PROFILE[i];
document.title = `${s.n} burcu özellikleri: aşk, kariyer, para · JinjaAstro`;
const good = [4, 2].flatMap((d) => [(i + d) % 12, (i - d + 12) % 12]), hard = [(i + 3) % 12, (i + 9) % 12], opp = (i + 6) % 12;
const link = (j) => `<a class="mini" href="/astro/compatibility/?a=${SLUGS[i]}&b=${SLUGS[j]}" style="--c:${SIGNS[j].c}"><span>${SIGNS[j].g}</span>${SIGNS[j].n}</a>`;
const SECS = [
  ["ask", "Aşk ve ilişkiler", `<p>${p.love}</p>`],
  ["kariyer", "Kariyer", `<p>${p.career}</p>`],
  ["para", "Para ve harcama", `<p>${p.money}</p><p><b>Bu burçtansan:</b> ${SPEND[i]}</p>`],
  ["saglik", "Sağlık", `<p>${p.health}</p>`],
  ["aile", "Ev ve aile", `<p><b>Bu burçtansan:</b> ${HOME_STYLE[i]}</p>`],
  ["zihin", "Zihin ve öğrenme", `<p><b>Bu burçtansan:</b> ${LEARN[i]}</p>`],
  ["dost", "Arkadaşlık", `<p>${p.friend}</p>`],
  ["uyum", "Uyum", `<p>En rahat anlaştığı burçlar:</p><div class="minis">${good.map(link).join("")}</div><p>Karşıt burcu; hem en çok çeken hem en çok öğreten:</p><div class="minis">${link(opp)}</div><p>Çekimin de sürtüşmenin de bol olduğu burçlar:</p><div class="minis">${hard.map(link).join("")}</div>`],
];
$("#profile").innerHTML = `
  <header class="pHead" style="--c:${s.c}">
    <span class="pG" aria-hidden="true">${s.g}</span>
    <div><span class="eyebrow">${s.dates}</span><h1 class="h2">${s.n} burcu</h1>
      <div class="facts"><span>Element: <b>${s.el}</b></span><span>Nitelik: <b>${s.mod}</b></span><span>Yönetici: <b>${PLANETS[s.ruler].g} ${PLANETS[s.ruler].n}</b></span></div>
    </div>
  </header>
  <div class="pn wide"><div class="pnCol ok"><small>Güçlü yanları</small>${p.plus.map((x) => `<span>${x}</span>`).join("")}</div><div class="pnCol no"><small>Zorlandığı yanlar</small>${p.minus.map((x) => `<span>${x}</span>`).join("")}</div></div>
  <div id="pShare"></div>
  <p class="lead">${p.intro}</p>
  <nav class="secNav" aria-label="Bölümler">${SECS.map(([id, t]) => `<a href="#s-${id}">${t.replace(/ ve .*/, "")}</a>`).join("")}<a href="#s-hafta">Bu hafta</a></nav>
  <div class="pGrid">${SECS.map(([id, t, h]) => `<section class="rd glass" id="s-${id}"><h3>${t}</h3>${h}</section>`).join("")}</div>
  <div class="glass weekTeaser" id="s-hafta"></div>`;
shareBar($("#pShare"), {
  file: () => `${SLUGS[i]}-burcu`,
  url: () => location.href,
  text: () => `${s.n} burcunun özellikleri:`,
  card: () => ({ glyph: s.g, color: s.c, eyebrow: `Burç profili · ${s.dates}`, title: `${s.n} burcu`, sub: `${s.el} · ${s.mod} · ${PLANETS[s.ruler].n}`,
    blocks: [{ h: "Kısaca", t: p.intro }, { h: "Aşkta", t: p.love }, { h: "Kariyerde", t: p.career }] }),
  save: { label: "Burcum olarak kaydet", doneLabel: "Burcum kaydedildi", toast: `${s.n} burcun olarak kaydedildi; haftalık ve aylık sayfalar bununla açılacak.`, done: () => store.get("jaSign", -1) === i, onSave: () => store.set("jaSign", i) },
});
secNav($(".secNav", $("#profile")));
$("#signGrid").innerHTML = signGridHtml();
try {
  const fc = await loadForecast();
  const w = fc.week.signs[s.id];
  $("#s-hafta").innerHTML = `<h3>${s.n} bu hafta (${esc(fc.week.title)})</h3><p>${esc(w.sections ? w.sections[0].paras[0] : w.general)}</p><p class="more"><a class="btn gold" href="/astro/weekly/?sign=${SLUGS[i]}">Haftalık yorumun tamamı</a><a class="btn glass" href="/astro/monthly/?sign=${SLUGS[i]}">Aylık yorum</a></p>`;
} catch { $("#s-hafta").remove(); }
