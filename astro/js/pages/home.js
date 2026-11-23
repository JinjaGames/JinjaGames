import * as E from "../ephem.js?v=10";
import { $, SLUGS, mySign, saved, computeChart } from "../common.js?v=10";
import { mountSky, signGridHtml, nowHtml } from "./ui.js?v=10";

$("#signGrid").innerHTML = signGridHtml();
const now = nowHtml(5);
$("#todayTitle").textContent = now.title;
$("#nowGrid").innerHTML = now.html;
$("#myWeek").href = `/astro/weekly/?sign=${SLUGS[mySign()]}`;

mountSky((sky) => {
  const c = saved()[0];
  if (c) {
    // son kayıtlı harita varsa onu göster, yoksa şu anki gökyüzü
    const ch = computeChart(c);
    sky.setPositions(ch.pos, c.noTime ? { aspects: ch.aspects } : ch);
    $("#skyMode").textContent = `${c.name ? c.name + " · " : ""}doğum haritası`;
  } else sky.setPositions(E.positions(E.julian(new Date())));
});
