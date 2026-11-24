// JinjaFC ana sayfası: canlı kartlar, sayaçlar, otomatik en iyi 11, mevki sıralamaları
import { loadDB, POS_TR, crest } from "./db.js?v=3";
import { cardHtml } from "./fccard.js?v=3";
import { metaAt, bestRole, squadMeta, autoBuild } from "./meta.js?v=2";
import { FORMATIONS } from "./formations.js?v=2";
import { chemistry } from "./chem.js?v=3";
import { esc } from "./util.js";

const $ = (s) => document.querySelector(s);
const DB = await loadDB();
const men = DB.players.filter((p) => !p.women);

// sayaçlar (yukarı sayarak)
const nums = [DB.players.length, DB.leagues.length, DB.nations.length, Object.keys(FORMATIONS).length];
[...$("#counters").querySelectorAll("b")].forEach((b, i) => {
  const end = nums[i], t0 = performance.now();
  const tick = (now) => { const k = Math.min(1, (now - t0) / 1200); b.textContent = Math.round(end * (1 - (1 - k) ** 3)).toLocaleString("tr"); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
$("#updated").textContent = DB.updated ? `Oyuncu listesi son güncelleme: ${new Date(DB.updated).toLocaleString("tr", { dateStyle: "long", timeStyle: "short" })}` : "";

// süzülen kartlar: en yüksek reytingli 5 oyuncu
const top5 = DB.players.slice(0, 5);
$("#heroCards").innerHTML = top5.map((p, i) => `<div class="hc hc${i}">${cardHtml(p)}</div>`).join("");

// mevki sıralamaları
const TABS = [["ST", "Forvet"], ["LW", "Kanat"], ["CAM", "10 numara"], ["CM", "Orta saha"], ["CDM", "Ön libero"], ["CB", "Stoper"], ["LB", "Bek"], ["GK", "Kaleci"]];
let tab = "ST";
function topList() {
  $("#posTabs").innerHTML = TABS.map(([p, t]) => `<button type="button" data-p="${p}" aria-pressed="${p === tab}">${t}</button>`).join("");
  const list = DB.players.filter((p) => p.pos.includes(tab)).sort((a, b) => metaAt(b, tab) - metaAt(a, tab)).slice(0, 6);
  $("#topList").innerHTML = list.map((p, i) => `<a class="tl" href="/jinjafc/players/?id=${p.id}"><span class="rk">${i + 1}</span>${cardHtml(p, { pos: tab })}<span class="meta"><i>M</i>${metaAt(p, tab).toFixed(1)}</span><small>${crest(p, "crestI")}${esc(p.club)}</small></a>`).join("");
}
$("#posTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { tab = b.dataset.p; topList(); } });
topList();

// otomatik en iyi 11 (erkekler, 4-3-3, Meta Rating öncelikli)
const f = "4-3-3", slots = FORMATIONS[f].slots.map((s) => s[0]);
const res = await autoBuild(men, { [f]: slots }, { want: "meta" });
const best = res.sort((a, b) => b.meta + 0.35 * b.chem - (a.meta + 0.35 * a.chem))[0];
if (best) {
  $("#best").innerHTML = FORMATIONS[f].slots.map(([pos, x, y], i) => `<span class="mp" style="left:${x}%;bottom:${y <= 10 ? 9 : 26 + ((y - 20) / 70) * 66}%">${cardHtml(best.xi[i], { pos, size: "s" })}</span>`).join("");
  const c = chemistry(slots, best.xi);
  $("#bestInfo").innerHTML = `<div class="bi"><span class="ico jr">M</span><small>Meta Rating</small><b>${best.meta.toFixed(1)}</b></div>
    <div class="bi"><span class="ico ch"><i></i><i></i><i></i></span><small>Kimya</small><b>${c.total}/33</b></div>
    <p>Tüm erkek oyuncular arasından ${FORMATIONS[f].name} dizilişinde, kimyayı da gözeterek otomatik kuruldu. Kadro kurucuda kendi filtrelerinle (lig, ülke, kulüp) yüzlerce farklı kadro kurabilirsin.</p>`;
  $("#openBest").href = `/jinjafc/squad/#f=${encodeURIComponent(f)}&xi=${best.xi.map((p) => p.id).join(".")}`;
}
