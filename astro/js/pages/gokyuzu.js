import { $, esc } from "../common.js?v=14";
import { SIGNS, PLANETS } from "../zodiac.js?v=14";
import * as E from "../ephem.js?v=14";
import { shareBar } from "../card.js?v=14";
import { mountSky, nowHtml, loadForecast, phaseName } from "./ui.js?v=14";

const now = nowHtml();
$("#todayTitle").textContent = now.title;
$("#nowGrid").innerHTML = now.html;
mountSky((sky) => sky.setPositions(now.pos));
const line = (b) => `${PLANETS[b].n} ${SIGNS[E.signOf(now.pos[b].lon)].n}${now.pos[b].retro ? " (geri)" : ""}`;
shareBar($("#skyShare"), {
  file: () => "gokyuzu-bugun",
  url: () => location.href,
  text: () => `Bugün gökyüzü (${now.title}):`,
  card: () => ({ glyph: "☉", color: "#f5c66b", eyebrow: "Gökyüzü şu an", title: now.title, sub: `${phaseName(E.moonPhase(E.julian(new Date())))[0]} · Ay ${SIGNS[E.signOf(now.pos.moon.lon)].n} burcunda`,
    blocks: [{ h: "Kişisel gezegenler", t: ["sun", "moon", "mercury", "venus", "mars"].map(line).join(" · ") }, { h: "Dış gezegenler", t: ["jupiter", "saturn", "uranus", "neptune", "pluto"].map(line).join(" · ") }] }),
});
try {
  const fc = await loadForecast();
  const li = (arr) => arr.length ? arr.map((n) => `<li>${esc(n.text)}</li>`).join("") : "<li>Büyük bir geçiş yok.</li>";
  $("#weekSky").innerHTML = li(fc.week.sky);
  $("#monthSkyTitle").textContent = `${fc.month.title} gökyüzü takvimi`;
  $("#monthSky").innerHTML = li(fc.month.sky);
} catch {}
