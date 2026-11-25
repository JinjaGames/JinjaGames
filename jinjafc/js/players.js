// JinjaFC · oyuncu veritabanı listesi
import { loadDB, fold, POS_TR, STAT_TR, GK_TR, crest, flag } from "./db.js?v=3";
import { cardHtml } from "./fccard.js?v=3";
import { bestRole, grade, metaAt } from "./meta.js?v=2";
import { esc } from "./util.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
const q = new URLSearchParams(location.search);
const ATTR_TR = { acceleration: "Hızlanma", sprintSpeed: "Sprint hızı", positioning: "Pozisyon alma", finishing: "Bitiricilik", shotPower: "Şut gücü", longShots: "Uzaktan şut", volleys: "Vole",
  penalties: "Penaltı", vision: "Görüş", crossing: "Orta", freeKickAccuracy: "Serbest vuruş", shortPassing: "Kısa pas", longPassing: "Uzun pas", curve: "Falso", agility: "Çeviklik",
  balance: "Denge", reactions: "Reaksiyon", ballControl: "Top kontrolü", dribbling: "Dripling", composure: "Soğukkanlılık", interceptions: "Top kesme", headingAccuracy: "Kafa isabeti",
  defensiveAwareness: "Defans farkındalığı", standingTackle: "Ayakta müdahale", slidingTackle: "Kayarak müdahale", jumping: "Zıplama", stamina: "Dayanıklılık", strength: "Güç",
  aggression: "Agresiflik", gkDiving: "Uçuş", gkHandling: "Top tutma", gkKicking: "Vuruş", gkPositioning: "Pozisyon", gkReflexes: "Refleks" };
const GROUPS = [["Hız", 0, 2], ["Şut", 2, 8], ["Pas", 8, 14], ["Dripling", 14, 20], ["Defans", 20, 25], ["Fizik", 25, 29], ["Kalecilik", 29, 34]];
const ALLPOS = ["GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"];
const f = { q: q.get("q") || "", pos: q.get("pos") || "", league: q.get("league") || "", nation: q.get("nation") || "", g: q.get("g") || "all", sort: q.get("sort") || "meta" };
let DB, limit = 40;
const statCls = (v) => (v >= 85 ? "s5" : v >= 75 ? "s4" : v >= 65 ? "s3" : v >= 50 ? "s2" : "s1");
const SORT = { r: (p) => p.r, pac: (p) => p.stats[0], sho: (p) => p.stats[1], pas: (p) => p.stats[2], dri: (p) => p.stats[3], def: (p) => p.stats[4], phy: (p) => p.stats[5], sm: (p) => p.skill * 100 + p.r, wf: (p) => p.wf * 100 + p.r };

function row(p) {
  const best = f.pos && p.pos.includes(f.pos) ? { pos: f.pos, v: metaAt(p, f.pos) } : bestRole(p);
  const lab = p.pos[0] === "GK" ? GK_TR : STAT_TR;
  return `<article class="pr" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)} ayrıntıları">
    <div class="prCard">${cardHtml(p, { size: "s" })}</div>
    <div class="prName"><b>${esc(p.name)}</b><span class="poss">${p.pos.map((x) => `<i>${POS_TR[x]}</i>`).join("")}</span><small class="clubL">${crest(p, "crestI")}${esc(p.club)} · ${flag(p.nat)}${esc(p.nat.tr)} · ${esc(p.league)}${p.women ? " · Kadın" : ""}</small></div>
    <div class="prPs">${p.psp.map((s) => `<span class="ps plus" title="${esc(s)}+">${esc(s)}+</span>`).join("")}${p.ps.slice(0, 3).map((s) => `<span class="ps" title="${esc(s)}">${esc(s)}</span>`).join("")}</div>
    <div class="prStats">${p.stats.map((v, i) => `<span class="${statCls(v)}"><em>${lab[i]}</em>${v}</span>`).join("")}<span><em>BH</em>${p.skill}★</span><span><em>ZA</em>${p.wf}★</span></div>
    <div class="prBest"><small>En iyi: ${POS_TR[best.pos]}</small><span class="meta"><i>M</i>${best.v.toFixed(1)}</span><b class="gr g${grade(best.v, p.r).replace("+", "p")}">${grade(best.v, p.r)}</b></div>
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
// ---------- oyuncu ayrıntısı ----------
function detailHtml(p) {
  const A = DB.attrNames || [];
  const gk = p.pos[0] === "GK";
  const groups = GROUPS.filter((g) => (gk ? g[0] === "Kalecilik" || g[0] === "Fizik" || g[0] === "Hız" : g[0] !== "Kalecilik"));
  const roles = p.pos.map((x) => ({ pos: x, v: metaAt(p, x) })).sort((a, b) => b.v - a.v);
  const best = roles[0];
  // benzer oyuncular: aynı en iyi mevki, Meta Rating'i en yakın olanlar
  const sim = DB.players.filter((o) => o !== p && o.pos.includes(best.pos)).map((o) => ({ o, d: Math.abs(metaAt(o, best.pos) - best.v) + (o.women !== p.women ? 50 : 0) }))
    .sort((a, b) => a.d - b.d).slice(0, 6).map((x) => x.o);
  return `<button type="button" class="pdX" data-close aria-label="Kapat">✕</button><div class="pdTop">
      <div class="pdCard">${cardHtml(p, { pos: best.pos })}</div>
      <div class="pdInfo">
        <h2 id="pdTitle">${esc(p.name)}</h2>
        <p class="clubL">${crest(p, "crestI")}${esc(p.club)}</p>
        <p class="clubL">${flag(p.nat)}${esc(p.nat.tr)} · ${esc(p.league)}${p.women ? " · Kadın" : ""}</p>
        <div class="pdFacts"><span><em>Boy</em>${p.h || "–"} cm</span><span><em>Ayak</em>${p.foot === "R" ? "Sağ" : "Sol"}</span><span><em>Yetenek</em>${p.skill}★</span><span><em>Zayıf ayak</em>${p.wf}★</span></div>
        <h4>Mevkilere göre Meta Rating</h4>
        <div class="pdRoles">${roles.map((r) => `<span class="${r === best ? "on" : ""}"><b>${POS_TR[r.pos]}</b><i class="meta"><i>M</i>${r.v.toFixed(1)}</i><b class="gr g${grade(r.v, p.r).replace("+", "p")}">${grade(r.v, p.r)}</b></span>`).join("")}</div>
      </div>
    </div>
    ${p.psp.length || p.ps.length ? `<h4>PlayStyle'lar</h4><div class="prPs pdPs">${p.psp.map((s) => `<span class="ps plus">${esc(s)}+</span>`).join("")}${p.ps.map((s) => `<span class="ps">${esc(s)}</span>`).join("")}</div>` : ""}
    <h4>Ayrıntılı özellikler</h4>
    <div class="pdAttrs">${groups.map(([name, a, b]) => {
      const vals = p.attrs.slice(a, b), avg = Math.round(vals.reduce((x, y) => x + y, 0) / (vals.length || 1));
      return `<section><h5>${name}<b class="${statCls(avg)}">${avg}</b></h5>${vals.map((v, i) => `<div class="at"><span>${ATTR_TR[A[a + i]] || A[a + i]}</span><b>${v}</b><i class="${statCls(v)}" style="--w:${v}%"></i></div>`).join("")}</section>`;
    }).join("")}</div>
    <h4>Benzer oyuncular <small>(${POS_TR[best.pos]}, Meta Rating'i en yakın)</small></h4>
    <div class="pdSim">${sim.map((o) => `<button type="button" class="pdS" data-id="${o.id}" title="${esc(o.name)}">${cardHtml(o, { pos: best.pos, size: "s" })}<span class="meta"><i>M</i>${metaAt(o, best.pos).toFixed(1)}</span></button>`).join("")}</div>`;
}
// Ayrıntı ayrı bir pencerede değil, listenin içinde (tıklanan satırın hemen altında) açılır.
function detail(p, row) {
  const cur = $(".pdIn");
  const same = cur && cur.dataset.id === String(p.id);
  if (same && row) return closeDetail();
  const box = cur && !row ? cur : document.createElement("section");
  box.className = "pdIn";
  box.dataset.id = p.id;
  box.setAttribute("aria-label", `${p.name} ayrıntıları`);
  box.innerHTML = detailHtml(p);
  if (box !== cur) {
    cur?.remove();
    $$(".pr.open").forEach((x) => x.classList.remove("open"));
    if (row) row.after(box), row.classList.add("open");
    else $("#list").prepend(box);
  }
  requestAnimationFrame(() => box.scrollIntoView({ behavior: "smooth", block: row ? "nearest" : "start" }));
  const u = new URL(location.href); u.searchParams.set("id", p.id); history.replaceState(null, "", u);
}
function closeDetail() {
  $(".pdIn")?.remove();
  $$(".pr.open").forEach((x) => x.classList.remove("open"));
  const u = new URL(location.href); u.searchParams.delete("id"); history.replaceState(null, "", u);
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
$("#list").addEventListener("click", (e) => {
  if (e.target.closest(".pdIn [data-close]")) return closeDetail();
  const s = e.target.closest(".pdS");
  if (s) return detail(DB.byId.get(+s.dataset.id));
  const r = e.target.closest(".pr");
  if (r) detail(DB.byId.get(+r.dataset.id), r);
});
$("#list").addEventListener("keydown", (e) => { const r = e.target.closest(".pr"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); detail(DB.byId.get(+r.dataset.id), r); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $(".pdIn")) closeDetail(); });
const openId = +q.get("id");
if (openId && DB.byId.has(openId)) detail(DB.byId.get(openId));
