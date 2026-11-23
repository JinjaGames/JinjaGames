// JinjaFC · FUT kadro kurucu
import { FORMATIONS, DEFAULT_FORMATION } from "./formations.js";
import { chemistry, teamRating } from "./chem.js";
import { esc, store, toast, shareOrDownload } from "./util.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fold = (s) => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/ø/g, "o").replace(/ß/g, "ss");

let DB = null, BY_ID = new Map();
const state = { f: DEFAULT_FORMATION, xi: Array(11).fill(null), bench: Array(7).fill(null), mgr: { nation: null, league: null } };

// ---------- veri ----------
async function loadDB() {
  const r = await fetch("/jinjafc/data/players.json", { cache: "no-cache" });
  if (!r.ok) throw Error("Oyuncu listesi yüklenemedi");
  const d = await r.json();
  const POS = d.positions;
  const players = d.players.map(([id, name, rating, pos, club, league, nation, women, stats, skill, wf, foot, h]) => ({
    id, name, r: rating, pos: pos.map((i) => POS[i]), club: d.clubs[club][0], league: d.leagues[league], nation: d.nations[nation],
    women: !!women, stats, skill, wf, foot, h, short: shortName(name), key: fold(name),
  }));
  DB = { players, leagues: [...new Set(players.map((p) => p.league))].sort((a, b) => a.localeCompare(b, "tr")), nations: [...new Set(players.map((p) => p.nation))].sort((a, b) => a.localeCompare(b, "tr")), updated: d.updated };
  BY_ID = new Map(players.map((p) => [p.id, p]));
}
function shortName(n) {
  const parts = String(n).split(" ");
  if (parts.length <= 1 || n.length <= 12) return n;
  const last = parts.slice(1).join(" ");
  return last.length <= 13 ? last : parts[parts.length - 1];
}

// ---------- durum: kaydet / paylaş bağlantısı ----------
const slots = () => FORMATIONS[state.f].slots.map((s) => s[0]);
function encode() {
  const q = new URLSearchParams();
  q.set("f", state.f);
  q.set("xi", state.xi.map((p) => (p ? p.id : "")).join("."));
  if (state.bench.some(Boolean)) q.set("b", state.bench.map((p) => (p ? p.id : "")).join("."));
  if (state.mgr.nation) q.set("mn", state.mgr.nation);
  if (state.mgr.league) q.set("ml", state.mgr.league);
  return q.toString();
}
function decode(str) {
  const q = new URLSearchParams(str);
  if (FORMATIONS[q.get("f")]) state.f = q.get("f");
  const ids = (k, n) => { const a = (q.get(k) || "").split(".").map((x) => BY_ID.get(Number(x)) || null); return Array.from({ length: n }, (_, i) => a[i] || null); };
  if (q.get("xi")) state.xi = ids("xi", 11);
  if (q.get("b")) state.bench = ids("b", 7);
  state.mgr = { nation: q.get("mn") || null, league: q.get("ml") || null };
}
const persist = () => { store.set("jfcCurrent", encode()); history.replaceState(null, "", "#" + encode()); };

// ---------- çizim ----------
const tier = (r) => (r >= 75 ? "gold" : r >= 65 ? "silver" : "bronze");
const dots = (c) => `<span class="cdots" aria-label="Kimya ${c}/3">${[1, 2, 3].map((k) => `<i class="${k <= c ? "on" : ""}"></i>`).join("")}</span>`;
function cardHtml(p, slotPos, chem) {
  if (!p) return `<span class="empty"><b>+</b><small>${slotPos || "Yedek"}</small></span>`;
  const out = slotPos && !p.pos.includes(slotPos);
  return `<span class="pc ${tier(p.r)}${p.women ? " w" : ""}${out ? " out" : ""}"><span class="pr">${p.r}</span><span class="pp">${slotPos || p.pos[0]}</span><span class="pn">${esc(p.short)}</span>${chem ? dots(chem.chem) : ""}</span>`;
}
function render() {
  const sl = slots(), c = chemistry(sl, state.xi, state.mgr);
  $("#pitch").innerHTML = `<span class="lines" aria-hidden="true"><i class="c"></i><i class="b1"></i><i class="b2"></i><i class="m"></i></span>` +
    FORMATIONS[state.f].slots.map(([pos, x, y], i) => `<button type="button" class="slot" data-i="${i}" style="left:${x}%;bottom:${(9 + y * 0.82).toFixed(1)}%" aria-label="${pos}${state.xi[i] ? ": " + esc(state.xi[i].name) : ", boş"}">${cardHtml(state.xi[i], pos, c.per[i])}<span class="slotPos">${pos}</span></button>`).join("");
  $("#bench").innerHTML = state.bench.map((p, i) => `<button type="button" class="slot b" data-b="${i}" aria-label="Yedek ${i + 1}${p ? ": " + esc(p.name) : ", boş"}">${cardHtml(p, null, null)}</button>`).join("");
  $("#mRating").textContent = teamRating(state.xi);
  $("#mChem").textContent = c.total;
  $("#mCount").textContent = state.xi.filter(Boolean).length;
  $("#mgrLabel").textContent = state.mgr.nation || state.mgr.league ? `TD: ${[state.mgr.nation, state.mgr.league].filter(Boolean).join(" · ")}` : "Teknik direktör";
  // kimya dökümü
  const rows = state.xi.map((p, i) => (p ? { p, i, x: c.per[i] } : null)).filter(Boolean);
  $("#chemList").innerHTML = rows.length ? `<ul class="clist">${rows.map(({ p, i, x }) => `<li class="${x.out ? "bad" : x.chem === 3 ? "full" : ""}"><span class="cl">${sl[i]}</span><b>${esc(p.name)}</b>${dots(x.chem)}<small>${x.out ? `Mevki dışı: kartında ${p.pos.join(", ")} var` : [x.club && `Kulüp +${x.club}`, x.nation && `Ülke +${x.nation}`, x.league && `Lig +${x.league}`].filter(Boolean).join(" · ") || "Bağ yok: aynı kulüp, ülke ya da ligden oyuncu ekle"}</small></li>`).join("")}</ul>` : `<p class="muted">Sahaya oyuncu ekledikçe burada her oyuncunun kimyası ve nedeni görünür.</p>`;
  // bağ özetleri: en kalabalık kulüp / ülke / lig ve bir sonraki eşiğe kalan
  const top = (m, t, label) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => { const next = t.find((x) => x > n); return `<li><span>${label}</span><b>${esc(k)}</b><em>${n}</em><small>${next ? `${next - n} oyuncu daha → +1` : "En üst seviye"}</small></li>`; }).join("");
  $("#links").innerHTML = rows.length ? `<ul class="llist">${top(c.count.league, [3, 5, 8], "Lig")}${top(c.count.nation, [2, 5, 8], "Ülke")}${top(c.count.club, [2, 4, 7], "Kulüp")}</ul>` : `<p class="muted">Henüz bağ yok.</p>`;
}

// ---------- arama paneli ----------
let sheetCtx = null;
function openSheet(title, html, onReady) {
  $("#sheetTitle").textContent = title;
  $("#sheetBody").innerHTML = html;
  $("#sheet").hidden = false;
  document.body.classList.add("noScroll");
  onReady?.();
}
function closeSheet() { $("#sheet").hidden = true; document.body.classList.remove("noScroll"); sheetCtx = null; }
$("#sheet").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
function pickPlayer(target) {
  const isBench = target.bench != null, slotPos = isBench ? null : slots()[target.i];
  const cur = isBench ? state.bench[target.bench] : state.xi[target.i];
  sheetCtx = { target, slotPos, f: { q: "", pos: slotPos || "", league: "", nation: "", club: "", min: 0, g: "all", sort: slotPos ? "chem" : "rating" }, limit: 40 };
  openSheet(isBench ? `Yedek ${target.bench + 1}` : `${slotPos} için oyuncu`, `
    ${cur ? `<div class="curP">${cardHtml(cur, slotPos, null)}<div><b>${esc(cur.name)}</b><small>${esc(cur.club)} · ${esc(cur.nation)} · ${esc(cur.league)}</small><small>${cur.pos.join(", ")} · ${cur.foot === "R" ? "Sağ" : "Sol"} ayak · ${"★".repeat(cur.skill)} yetenek · ${"★".repeat(cur.wf)} zayıf ayak</small></div><button type="button" class="btn ghost sm" id="rmP">Kaldır</button></div>` : ""}
    <div class="filters">
      <input type="search" id="fq" placeholder="Oyuncu ara (ör. Arda, Mbappé)" autocomplete="off" aria-label="Oyuncu ara">
      <div class="frow">
        <select id="fpos" aria-label="Mevki">${opt("", "Tüm mevkiler", !slotPos)}${["GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"].map((p) => opt(p, p === slotPos ? `${p} (bu mevki)` : p, p === slotPos)).join("")}</select>
        <select id="fsort" aria-label="Sıralama">${slotPos ? opt("chem", "Kimyaya katkı", true) : ""}${opt("rating", "Reyting", !slotPos)}${opt("pace", "Hız")}</select>
      </div>
      <div class="frow">
        <select id="fleague" aria-label="Lig">${opt("", "Tüm ligler", true)}${DB.leagues.map((l) => opt(l, l)).join("")}</select>
        <select id="fnation" aria-label="Ülke">${opt("", "Tüm ülkeler", true)}${DB.nations.map((l) => opt(l, l)).join("")}</select>
      </div>
      <div class="frow">
        <select id="fclub" aria-label="Kulüp">${opt("", "Tüm kulüpler", true)}</select>
        <select id="fmin" aria-label="En düşük reyting">${opt(0, "Her reyting", true)}${[90, 85, 83, 80, 78, 75, 70, 65].map((v) => opt(v, `${v}+`)).join("")}</select>
        <select id="fg" aria-label="Futbol türü">${opt("all", "Erkek ve kadın", true)}${opt("m", "Erkek")}${opt("w", "Kadın")}</select>
      </div>
    </div>
    <div id="results" class="results" aria-live="polite"></div>`, () => {
    const f = sheetCtx.f;
    const bind = (id, key, ev = "change") => $(id).addEventListener(ev, (e) => { f[key] = e.target.value; if (key === "league") fillClubs(); sheetCtx.limit = 40; results(); });
    bind("#fq", "q", "input"); bind("#fpos", "pos"); bind("#fsort", "sort"); bind("#fleague", "league"); bind("#fnation", "nation"); bind("#fclub", "club"); bind("#fmin", "min"); bind("#fg", "g");
    $("#rmP")?.addEventListener("click", () => { place(null); });
    fillClubs();
    results();
    if (matchMedia("(min-width: 761px)").matches) $("#fq").focus();
  });
}
function fillClubs() {
  const f = sheetCtx.f;
  const clubs = [...new Set(DB.players.filter((p) => !f.league || p.league === f.league).map((p) => p.club))].sort((a, b) => a.localeCompare(b, "tr"));
  if (!clubs.includes(f.club)) f.club = "";
  $("#fclub").innerHTML = opt("", "Tüm kulüpler", !f.club) + clubs.map((c) => opt(c, c, c === f.club)).join("");
}
function chemGain(p) {
  const { target } = sheetCtx;
  if (target.bench != null) return 0;
  const sl = slots(), base = chemistry(sl, state.xi, state.mgr).total;
  const xi = state.xi.slice();
  xi[target.i] = p;
  return chemistry(sl, xi, state.mgr).total - base;
}
function results() {
  const f = sheetCtx.f, q = fold(f.q.trim()), used = new Set([...state.xi, ...state.bench].filter(Boolean).map((p) => p.id));
  let list = DB.players.filter((p) => (!q || p.key.includes(q)) && (!f.pos || p.pos.includes(f.pos)) && (!f.league || p.league === f.league) && (!f.nation || p.nation === f.nation) &&
    (!f.club || p.club === f.club) && p.r >= Number(f.min) && (f.g === "all" || (f.g === "w") === p.women) && !used.has(p.id));
  let gains = null;
  const total = list.length;
  if (f.sort === "chem") {
    // kimya hesabı pahalı: önce reytinge göre ilk 600 aday
    list = list.slice(0, 600);
    gains = new Map(list.map((p) => [p.id, chemGain(p)]));
    list.sort((a, b) => gains.get(b.id) - gains.get(a.id) || b.r - a.r);
  } else if (f.sort === "pace") list.sort((a, b) => b.stats[0] - a.stats[0] || b.r - a.r);
  const shown = list.slice(0, sheetCtx.limit);
  const LB = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"], LG = ["DIV", "HAN", "KIC", "REF", "SPD", "POS"];
  $("#results").innerHTML = list.length ? `<p class="rcount">${total.toLocaleString("tr")} oyuncu${f.sort === "chem" ? (total > list.length ? ` · reytingi en yüksek ${list.length} aday kimyaya katkıya göre sıralandı` : " · kimyaya katkıya göre") : ""}</p>` +
    shown.map((p) => { const g = gains ? gains.get(p.id) : null; const lab = p.pos[0] === "GK" ? LG : LB; return `<button type="button" class="res" data-id="${p.id}">
      <span class="rr ${tier(p.r)}">${p.r}</span>
      <span class="ri"><b>${esc(p.name)}</b><small>${p.pos.join(" · ")} · ${esc(p.club)}</small><small>${esc(p.nation)} · ${esc(p.league)}${p.women ? " · Kadın" : ""}</small>
        <span class="rs">${p.stats.map((v, k) => `<i><em>${lab[k]}</em>${v}</i>`).join("")}</span></span>
      ${g != null ? `<span class="rg ${g > 0 ? "up" : g < 0 ? "down" : ""}">${g > 0 ? "+" : ""}${g}<small>kimya</small></span>` : ""}</button>`; }).join("") +
    (list.length > shown.length ? `<button type="button" class="btn ghost more" id="moreRes">Daha fazla göster</button>` : "")
    : `<p class="muted pad">Bu filtrelerle oyuncu bulunamadı.</p>`;
  $("#moreRes")?.addEventListener("click", () => { sheetCtx.limit += 60; results(); });
}
$("#sheetBody").addEventListener("click", (e) => {
  const b = e.target.closest(".res");
  if (b) place(BY_ID.get(Number(b.dataset.id)));
});
function place(p) {
  const t = sheetCtx.target;
  if (t.bench != null) state.bench[t.bench] = p; else state.xi[t.i] = p;
  closeSheet();
  render();
  persist();
  if (p && t.bench == null && !p.pos.includes(slots()[t.i])) toast(`${p.short} bu mevkide oynamıyor; kimya alamaz.`);
}
$("#pitch").addEventListener("click", (e) => { const s = e.target.closest(".slot"); if (s && DB) pickPlayer({ i: Number(s.dataset.i) }); });
$("#bench").addEventListener("click", (e) => { const s = e.target.closest(".slot"); if (s && DB) pickPlayer({ bench: Number(s.dataset.b) }); });

// ---------- araç çubuğu ----------
$("#formation").innerHTML = Object.entries(FORMATIONS).map(([k, v]) => opt(k, v.name, k === state.f)).join("");
$("#formation").addEventListener("change", (e) => {
  // oyuncuları koru: aynı mevki adı olan yerlere öncelik ver, kalanları sırayla yerleştir
  const old = slots().map((pos, i) => ({ pos, p: state.xi[i] })).filter((x) => x.p);
  state.f = e.target.value;
  const sl = slots(), xi = Array(11).fill(null);
  for (const x of old.slice()) { const j = sl.findIndex((pos, k) => !xi[k] && x.p.pos.includes(pos)); if (j >= 0) { xi[j] = x.p; old.splice(old.indexOf(x), 1); } }
  for (const x of old) { const j = xi.findIndex((v) => !v); if (j >= 0) xi[j] = x.p; }
  state.xi = xi;
  render();
  persist();
});
$("#mgrBtn").addEventListener("click", () => {
  if (!DB) return;
  openSheet("Teknik direktör", `<p class="muted pad0">Teknik direktörün ülkesi ve ligi kimyaya birer oyuncu gibi sayılır.</p>
    <div class="filters"><div class="frow"><select id="mn" aria-label="Teknik direktörün ülkesi">${opt("", "Ülke yok", !state.mgr.nation)}${DB.nations.map((n) => opt(n, n, n === state.mgr.nation)).join("")}</select>
    <select id="ml" aria-label="Teknik direktörün ligi">${opt("", "Lig yok", !state.mgr.league)}${DB.leagues.map((n) => opt(n, n, n === state.mgr.league)).join("")}</select></div>
    <button type="button" class="btn lime" id="mgrOk">Uygula</button></div>`, () => {
    $("#mgrOk").addEventListener("click", () => { state.mgr = { nation: $("#mn").value || null, league: $("#ml").value || null }; closeSheet(); render(); persist(); });
  });
});
$("#clearBtn").addEventListener("click", () => {
  if (!state.xi.some(Boolean) && !state.bench.some(Boolean)) return;
  if (!confirm("Sahadaki ve yedekteki tüm oyuncular kaldırılsın mı?")) return;
  state.xi = Array(11).fill(null); state.bench = Array(7).fill(null);
  render(); persist();
});
// kayıtlı kadrolar (yalnızca bu cihazda)
$("#saveBtn").addEventListener("click", () => {
  if (!state.xi.some(Boolean)) return toast("Önce sahaya oyuncu ekle.");
  const name = (prompt("Kadronun adı:", `Kadrom ${new Date().toLocaleDateString("tr")}`) || "").trim();
  if (!name) return;
  const list = store.get("jfcSquads", []).filter((s) => s.name !== name);
  list.unshift({ name, s: encode(), r: teamRating(state.xi), c: chemistry(slots(), state.xi, state.mgr).total, t: Date.now() });
  store.set("jfcSquads", list.slice(0, 30));
  toast("Kadro bu cihaza kaydedildi.");
});
$("#loadBtn").addEventListener("click", () => {
  const list = store.get("jfcSquads", []);
  openSheet("Kadrolarım", list.length ? `<ul class="saved">${list.map((s, i) => `<li><button type="button" class="sv" data-i="${i}"><b>${esc(s.name)}</b><small>${s.r} reyting · ${s.c}/33 kimya · ${new Date(s.t).toLocaleDateString("tr")}</small></button><button type="button" class="x" data-del="${i}" aria-label="${esc(s.name)} kadrosunu sil">✕</button></li>`).join("")}</ul>` : `<p class="muted pad">Henüz kayıtlı kadron yok. Kadronu kurup "Kaydet" de.</p>`, () => {
    $("#sheetBody").querySelector(".saved")?.addEventListener("click", (e) => {
      const d = e.target.closest("[data-del]"), o = e.target.closest(".sv");
      if (d) { const l = store.get("jfcSquads", []); l.splice(Number(d.dataset.del), 1); store.set("jfcSquads", l); closeSheet(); $("#loadBtn").click(); return; }
      if (o) { decode(list[Number(o.dataset.i)].s); $("#formation").value = state.f; closeSheet(); render(); persist(); }
    });
  });
});
$("#shareBtn").addEventListener("click", () => {
  if (!state.xi.some(Boolean)) return toast("Önce sahaya oyuncu ekle.");
  openSheet("Kadronu paylaş", `<div class="filters">
    <button type="button" class="btn lime" id="shImg">Görsel olarak paylaş / kaydet</button>
    <button type="button" class="btn ghost" id="shLink">Bağlantıyı kopyala</button>
    <p class="muted">Bağlantıyı açan kişi kadronu aynen görür.</p></div>`, () => {
    $("#shLink").addEventListener("click", async () => { const url = `${location.origin}${location.pathname}#${encode()}`; try { if (navigator.share) await navigator.share({ title: "JinjaFC kadrom", url }); else { await navigator.clipboard.writeText(url); toast("Bağlantı kopyalandı."); } } catch (e) { if (e.name !== "AbortError") toast(url); } });
    $("#shImg").addEventListener("click", async () => { const b = await squadImage(); await shareOrDownload(b, "jinjafc-kadro.png", "JinjaFC kadrom", false); });
  });
});

// ---------- görsel ----------
async function squadImage() {
  await document.fonts?.ready;
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#07130f"; x.fillRect(0, 0, W, H);
  // saha
  const px = 60, py = 190, pw = W - 120, ph = H - 260;
  const g = x.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, "#1d6b42"); g.addColorStop(1, "#145a35");
  x.fillStyle = g; x.beginPath(); x.roundRect(px, py, pw, ph, 28); x.fill();
  x.strokeStyle = "#ffffff30"; x.lineWidth = 3;
  x.strokeRect(px + 30, py + 30, pw - 60, ph - 60);
  x.beginPath(); x.moveTo(px + 30, py + ph / 2); x.lineTo(px + pw - 30, py + ph / 2); x.stroke();
  x.beginPath(); x.arc(W / 2, py + ph / 2, 90, 0, 7); x.stroke();
  const sl = slots(), ch = chemistry(sl, state.xi, state.mgr);
  x.fillStyle = "#4ef08a"; x.font = "800 30px Inter, sans-serif"; x.fillText("JINJAFC · KADRO", 60, 80);
  x.fillStyle = "#fff"; x.font = "700 56px 'Space Grotesk', Inter, sans-serif"; x.fillText(FORMATIONS[state.f].name, 60, 150);
  x.textAlign = "right"; x.font = "700 44px 'Space Grotesk', Inter, sans-serif";
  x.fillText(`${teamRating(state.xi)} reyting · ${ch.total}/33 kimya`, W - 60, 150); x.textAlign = "left";
  const COL = { gold: ["#f5d06b", "#b88a1c"], silver: ["#e3e8ef", "#8f99a6"], bronze: ["#e0a273", "#8d5530"] };
  FORMATIONS[state.f].slots.forEach(([pos, sx, sy], i) => {
    const p = state.xi[i], cx = px + (sx / 100) * pw, cy = py + ph - (sy / 100) * ph, cw = 150, chh = 190;
    if (!p) { x.strokeStyle = "#ffffff55"; x.setLineDash([8, 8]); x.strokeRect(cx - cw / 2, cy - chh / 2, cw, chh); x.setLineDash([]); x.fillStyle = "#ffffffaa"; x.font = "700 30px Inter"; x.textAlign = "center"; x.fillText(pos, cx, cy + 10); x.textAlign = "left"; return; }
    const [a, b] = COL[tier(p.r)];
    const gg = x.createLinearGradient(0, cy - chh / 2, 0, cy + chh / 2); gg.addColorStop(0, a); gg.addColorStop(1, b);
    x.fillStyle = gg; x.beginPath(); x.roundRect(cx - cw / 2, cy - chh / 2, cw, chh, 18); x.fill();
    x.fillStyle = "#1b1407"; x.textAlign = "center";
    x.font = "800 52px 'Space Grotesk', Inter"; x.fillText(String(p.r), cx, cy - 22);
    x.font = "800 24px Inter"; x.fillText(pos, cx, cy + 10);
    x.font = "700 22px Inter"; x.fillText(p.short.length > 12 ? p.short.slice(0, 11) + "…" : p.short, cx, cy + 46);
    const cv = ch.per[i]?.chem || 0;
    for (let k = 0; k < 3; k++) { x.fillStyle = k < cv ? "#0f7a3d" : "#00000033"; x.beginPath(); x.arc(cx - 22 + k * 22, cy + 74, 7, 0, 7); x.fill(); }
    x.textAlign = "left";
  });
  x.fillStyle = "#7f9e90"; x.font = "600 24px Inter"; x.fillText("jinjagames.com/jinjafc", 60, H - 28);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

// ---------- başlat ----------
render();
try {
  await loadDB();
  $("#loading").remove();
  const from = location.hash.slice(1) || store.get("jfcCurrent", "");
  if (from) decode(from);
  $("#formation").value = state.f;
  render();
} catch (e) {
  $("#loading").textContent = "Oyuncu listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.";
}
