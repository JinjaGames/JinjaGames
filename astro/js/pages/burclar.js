// Burç profilleri: ?sign=koc gibi; parametre yoksa kendi burcun.
import { SIGNS, PLANETS } from "../zodiac.js";
import { PROFILE } from "../readings.js";
import { $, esc, SLUGS, signBySlug, mySign, shareLink } from "../common.js";
import { signGridHtml, loadForecast } from "./ui.js";

const i = signBySlug(new URLSearchParams(location.search).get("sign")) ?? mySign();
const s = SIGNS[i], p = PROFILE[i];
document.title = `${s.n} burcu özellikleri: aşk, kariyer, para · JinjaAstro`;
const good = [4, 2].flatMap((d) => [(i + d) % 12, (i - d + 12) % 12]), hard = [(i + 3) % 12, (i + 9) % 12];
const link = (j) => `<a class="mini" href="/astro/compatibility/?a=${SLUGS[i]}&b=${SLUGS[j]}" style="--c:${SIGNS[j].c}"><span>${SIGNS[j].g}</span>${SIGNS[j].n}</a>`;
$("#profile").innerHTML = `
  <header class="pHead" style="--c:${s.c}">
    <span class="pG" aria-hidden="true">${s.g}</span>
    <div><span class="eyebrow">${s.dates}</span><h1 class="h2">${s.n} burcu</h1>
      <div class="facts"><span>Element: <b>${s.el}</b></span><span>Nitelik: <b>${s.mod}</b></span><span>Yönetici: <b>${PLANETS[s.ruler].g} ${PLANETS[s.ruler].n}</b></span></div>
      <div class="chips">${p.plus.map((x) => `<span class="ok">${x}</span>`).join("")}${p.minus.map((x) => `<span class="no">${x}</span>`).join("")}</div>
    </div>
    <button type="button" class="btn glass sm" id="shareP">Paylaş</button>
  </header>
  <p class="lead">${p.intro}</p>
  <div class="pGrid">
    <section class="rd glass"><h3>Aşk ve ilişkiler</h3><p>${p.love}</p></section>
    <section class="rd glass"><h3>Kariyer</h3><p>${p.career}</p></section>
    <section class="rd glass"><h3>Para</h3><p>${p.money}</p></section>
    <section class="rd glass"><h3>Sağlık</h3><p>${p.health}</p></section>
    <section class="rd glass"><h3>Arkadaşlık</h3><p>${p.friend}</p></section>
    <section class="rd glass"><h3>Uyum</h3><p>En rahat anlaştığı burçlar:</p><div class="minis">${good.map(link).join("")}</div><p>Çekimin de sürtüşmenin de bol olduğu burçlar:</p><div class="minis">${hard.map(link).join("")}</div></section>
  </div>
  <div class="glass weekTeaser" id="teaser"></div>`;
$("#shareP").addEventListener("click", () => shareLink(location.href, `${s.n} burcu özellikleri`));
$("#signGrid").innerHTML = signGridHtml();
try {
  const fc = await loadForecast();
  const w = fc.week.signs[s.id];
  $("#teaser").innerHTML = `<h3>${s.n} bu hafta (${esc(fc.week.title)})</h3><p>${esc(w.general)}</p><p class="more"><a class="btn gold" href="/astro/weekly/?sign=${SLUGS[i]}">Haftalık yorumun tamamı</a><a class="btn glass" href="/astro/monthly/?sign=${SLUGS[i]}">Aylık yorum</a></p>`;
} catch { $("#teaser").remove(); }
