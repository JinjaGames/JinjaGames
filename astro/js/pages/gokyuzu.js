import { $, esc } from "../common.js";
import { mountSky, nowHtml, loadForecast } from "./_ui.js";

const now = nowHtml();
$("#todayTitle").textContent = now.title;
$("#nowGrid").innerHTML = now.html;
mountSky((sky) => sky.setPositions(now.pos));
try {
  const fc = await loadForecast();
  const li = (arr) => arr.length ? arr.map((n) => `<li>${esc(n.text)}</li>`).join("") : "<li>Büyük bir geçiş yok.</li>";
  $("#weekSky").innerHTML = li(fc.week.sky);
  $("#monthSkyTitle").textContent = `${fc.month.title} gökyüzü takvimi`;
  $("#monthSky").innerHTML = li(fc.month.sky);
} catch {}
