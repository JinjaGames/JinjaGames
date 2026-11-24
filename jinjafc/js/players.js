// JinjaFC · oyuncu veritabanı listesi
import { loadDB, fold, POS_TR, STAT_TR, GK_TR } from "./db.js?v=1";
import { cardHtml } from "./fccard.js?v=1";
import { bestRole, grade, metaAt } from "./meta.js?v=1";
import { esc } from "./util.js";

const $ = (s) => document.querySelector(s);
const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
const q = new URLSearchParams(location.search);
const f = { q: q.get("q") || "", pos: q.get("pos") || "", league: q.get("league") || "", nation: q.get("nation") || "", g: q.get("g") || "all", sort: q.get("sort") || "meta" };
let DB, limit = 40;
const statCls = (v) => (v >= 85 ? "s5" : v >= 75 ? "s4" : v >= 65 ? "s3" : v >= 50 ? "s2" : "s1");
const SORT = { r: (p) => p.r, pac: (p) => p.stats[0], sho: (p) => p.stats[1], pas: (p) => p.stats[2], dri: (p) => p.stats[3], def: (p) => p.stats[4], phy: (p) => p.stats[5], sm: (p) => p.skill * 100 + p.r, wf: (p) => p.wf * 100 + p.r };

function row(p) {
  const best = f.pos && p.pos.includes(f.pos) ? { pos: f.pos, v: metaAt(p, f.pos) } : bestRole(p);
  const lab = p.pos[0] === "GK" ? GK_TR : STAT_TR;
  return `<article class="pr">
    <div class="prCard">${cardHtml(p, { size: "s" })}</div>
    <div class="prName"><b>${esc(p.name)}</b><span class="poss">${p.pos.map((x) => `<i>${POS_TR[x]}</i>`).join("")}</span><small>${esc(p.club)} · ${esc(p.nat.tr)} · ${esc(p.league)}${p.women ? " · Kadın" : ""}</small></div>
    <div class="prPs">${p.psp.map((s) => `<span class="ps plus" title="${esc(s)}+">${esc(s)}+</span>`).join("")}${p.ps.slice(0, 3).map((s) => `<span class="ps" title="${esc(s)}">${esc(s)}</span>`).join("")}</div>
    <div class="prStats">${p.stats.map((v, i) => `<span class="${statCls(v)}"><em>${lab[i]}</em>${v}</span>`).join("")}<span><em>BH</em>${p.skill}★</span><span><em>ZA</em>${p.wf}★</span></div>
    <div class="prBest"><small>En iyi: ${POS_TR[best.pos]}</small><span class="meta"><i>J</i>${best.v.toFixed(1)}</span><b class="gr g${grade(best.v, p.r).replace("+", "p")}">${grade(best.v, p.r)}</b></div>
  </article>`;
}
function render() {
  const s = fold(f.q.trim());
  let list = DB.players.filter((p) => (!s || p.key.includes(s)) && (!f.pos || p.pos.includes(f.pos)) && (!f.league || p.league === f.league) && (!f.nation || p.nation === f.nation) && (f.g === "all" || (f.g === "w") === p.women));
  if (f.sort === "meta") list.sort((a, b) => (f.pos ? metaAt(b, f.pos) - metaAt(a, f.pos) : bestRole(b).v - bestRole(a).v));
  else list.sort((a, b) => SORT[f.sort](b) - SORT[f.sort](a) || b.r - a.r);
  $("#count").textContent = `${list.length.toLocaleString("tr")} oyuncu`;
  $("#list").innerHTML = list.slice(0, limit).map(row).join("") || `<p class="muted">Bu filtrelerle oyuncu bulunamadı.</p>`;
  $("#more").hidden = list.length <= limit;
  const u = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && !(k === "g" && v === "all") && !(k === "sort" && v === "meta")));
  history.replaceState(null, "", u.toString() ? "?" + u : location.pathname);
}
DB = await loadDB();
$("#plSub").textContent = `${DB.players.length.toLocaleString("tr")} oyuncu, kart özellikleri, PlayStyle+'lar ve her oyuncu için en iyi rol. Liste her gün güncellenir.`;
$("#fPos").innerHTML = opt("", "Tüm mevkiler") + ["GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"].map((p) => opt(p, POS_TR[p])).join("");
$("#fLeague").innerHTML = opt("", "Tüm ligler") + DB.leagues.map((l) => opt(l, l)).join("");
$("#fNation").innerHTML = opt("", "Tüm ülkeler") + DB.nations.map((n) => opt(n.name, n.tr)).join("");
for (const [id, k] of [["#q", "q"], ["#fPos", "pos"], ["#fLeague", "league"], ["#fNation", "nation"], ["#fG", "g"], ["#sort", "sort"]]) {
  $(id).value = f[k];
  $(id).addEventListener(id === "#q" ? "input" : "change", (e) => { f[k] = e.target.value; limit = 40; render(); });
}
$("#more").addEventListener("click", () => { limit += 60; render(); });
render();
