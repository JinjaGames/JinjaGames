// JinjaFC · FUT kadro kurucu (perspektifli saha, kart görünümü, JinjaFC Rating, otomatik kadro kurma)
import { FORMATIONS, DEFAULT_FORMATION } from "./formations.js?v=2";
import { chemistry, teamRating, THRESH } from "./chem.js?v=2";
import { metaAt, squadMeta, autoBuild } from "./meta.js?v=1";
import { loadDB, fold, POS_TR, flag } from "./db.js?v=1";
import { cardHtml, chemPips } from "./fccard.js?v=1";
import { esc, store, toast, shareOrDownload } from "./util.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let DB = null;
const state = { f: DEFAULT_FORMATION, xi: Array(11).fill(null), bench: Array(7).fill(null) };
const build = { formation: "current", want: "meta", nation: "", league: "", club: "", min: 0, g: "all", results: null, sort: "meta", running: false };
let pick = null; // { slot: i | null, bench: j | null, q, sort, pos, league, nation, club, min, g, limit }

const slots = () => FORMATIONS[state.f].slots.map((s) => s[0]);
const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;

// ---------- perspektif ----------
// (x %, y %: 0 = kendi kalemiz) → ekran (sol %, üst %, ölçek)
// dikey: kaleci en altta, oyuncu satırları kalan alana yayılır (kartlar üst üste binmesin)
const vmap = (y) => (y <= 10 ? 0 : 0.24 + ((Math.min(y, 90) - 20) / 70) * 0.76);
const proj = (x, y, raw) => { const t = raw ? y / 100 : vmap(y); return { l: 50 + (x - 50) * (1 - t * 0.3), t: 89 - t * 79, s: 1 - t * 0.22 }; };
function drawField() {
  const P = (x, y) => { const p = proj(x, y, true); return `${(p.l * 10).toFixed(1)},${(p.t * 7.6).toFixed(1)}`; };
  const quad = (x0, y0, x1, y1) => `M${P(x0, y0)}L${P(x1, y0)}L${P(x1, y1)}L${P(x0, y1)}Z`;
  const line = (x0, y0, x1, y1) => `M${P(x0, y0)}L${P(x1, y1)}`;
  const ell = [];
  for (let a = 0; a <= 360; a += 12) { const r = (a * Math.PI) / 180; ell.push(P(50 + Math.cos(r) * 11, 50 + Math.sin(r) * 9.5)); }
  $("#field").innerHTML = `<path class="turf" d="${quad(0, -6, 100, 106)}"/>
    ${Array.from({ length: 8 }, (_, i) => `<path class="stripe" d="${quad(0, -6 + i * 14, 100, 1 + i * 14)}"/>`).join("")}
    <path class="ln" d="${quad(0, -6, 100, 106)}"/><path class="ln" d="${line(0, 50, 100, 50)}"/><path class="ln" d="M${ell.join("L")}Z"/>
    <path class="ln" d="${quad(22, -6, 78, 13)}"/><path class="ln" d="${quad(36, -6, 64, 3)}"/>
    <path class="ln" d="${quad(22, 87, 78, 106)}"/><path class="ln" d="${quad(36, 97, 64, 106)}"/>`;
}

// ---------- hesaplar ----------
function calc() {
  const sl = slots(), c = chemistry(sl, state.xi);
  return { sl, c, meta: squadMeta(sl, state.xi), rating: teamRating(state.xi), n: state.xi.filter(Boolean).length };
}
function render() {
  const { sl, c, meta, rating, n } = calc();
  $("#slots").innerHTML = FORMATIONS[state.f].slots.map(([pos, x, y], i) => {
    const p = state.xi[i], pr = proj(x, y), per = c.per[i];
    const out = p && !p.pos.includes(pos);
    const m = p && !out ? metaAt(p, pos) : null;
    return `<button type="button" class="slot${pick?.slot === i ? " on" : ""}" data-i="${i}" style="left:${pr.l}%;top:${pr.t}%;--s:${pr.s}" aria-label="${POS_TR[pos]}${p ? ": " + esc(p.name) : ", boş"}">
      ${p ? cardHtml(p, { pos, out }) : `<span class="emptyC"><b>+</b></span>`}
      <span class="labs">${p ? `<span class="meta"><i>J</i>${m ?? "–"}</span>` : ""}<span class="slotLab${p ? (out ? " bad" : per.chem === 3 ? " full" : "") : ""}">${POS_TR[pos]}${p ? ` ${"+".repeat(per.chem) || "0"}` : ""}</span></span></button>`;
  }).join("");
  $("#bench").innerHTML = state.bench.map((p, j) => `<button type="button" class="bslot${pick?.bench === j ? " on" : ""}" data-b="${j}" aria-label="Yedek ${j + 1}${p ? ": " + esc(p.name) : ", boş"}">${p ? cardHtml(p, { size: "s" }) : `<span class="emptyC s"><b>+</b></span>`}</button>`).join("");
  $("#mMeta").textContent = meta ? meta.toFixed(1) : "0";
  $("#mChem").textContent = c.total;
  $("#mRating").textContent = rating;
  $("#mCount").textContent = n;
  // bağlar: lig, ülke, kulüp; her biri için eşik ilerlemesi
  const rows = [];
  const grp = (map, t, kind) => [...map.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, cnt]) => {
    const lvl = cnt >= t[2] ? 3 : cnt >= t[1] ? 2 : cnt >= t[0] ? 1 : 0, next = t.find((x) => x > cnt);
    const nat = kind === "nation" ? DB.natByName.get(k) : null;
    rows.push(`<li class="lv${lvl}"><span class="gi">${nat ? flag(nat) : `<i class="gtag">${kind === "league" ? "LİG" : "KLP"}</i>`}</span><b title="${esc(nat ? nat.tr : k)}">${esc(nat ? nat.tr : k)}</b>
      <span class="gp">${t.map((x, q) => `<i class="${cnt >= x ? "on" : ""}" title="${x} oyuncu: +${q + 1}"></i>`).join("")}</span><em>${cnt}</em><small>${next ? `${next - cnt} oyuncu daha → +${lvl + 1}` : "En üst seviye"}</small></li>`);
  });
  grp(c.count.league, THRESH.league, "league");
  grp(c.count.nation, THRESH.nation, "nation");
  grp(c.count.club, THRESH.club, "club");
  $("#groups").innerHTML = rows.length ? `<ul>${rows.join("")}</ul>` : `<p class="muted">Sahaya oyuncu ekledikçe ligler, ülkeler ve kulüpler burada bağlarıyla görünür.</p>`;
  persist();
}

// ---------- sağ panel ----------
function panel() {
  if (pick) return panelPick();
  if (build.results) return panelResults();
  return panelBuild();
}
function filterSelects(f, prefix) {
  return `<div class="frow"><select id="${prefix}nation" aria-label="Ülke">${opt("", "Ülke (hepsi)", !f.nation)}${DB.nations.map((n) => opt(n.name, n.tr, n.name === f.nation)).join("")}</select>
      <select id="${prefix}league" aria-label="Lig">${opt("", "Lig (hepsi)", !f.league)}${DB.leagues.map((l) => opt(l, l, l === f.league)).join("")}</select></div>
    <div class="frow"><select id="${prefix}club" aria-label="Kulüp">${opt("", "Kulüp (hepsi)", !f.club)}${DB.clubs.filter((c) => !f.league || DB.players.some((p) => p.club === c && p.league === f.league)).map((c) => opt(c, c, c === f.club)).join("")}</select>
      <select id="${prefix}min" aria-label="En düşük reyting">${opt(0, "Her reyting", !+f.min)}${[90, 87, 85, 83, 80, 78, 75, 70].map((v) => opt(v, `${v}+ reyting`, +f.min === v)).join("")}</select></div>
    <div class="seg3" role="radiogroup" aria-label="Futbol türü">${[["all", "Hepsi"], ["m", "Erkek"], ["w", "Kadın"]].map(([v, t]) => `<button type="button" data-g="${v}" aria-pressed="${f.g === v}">${t}</button>`).join("")}</div>`;
}
function bindFilters(f, prefix, onChange) {
  for (const k of ["nation", "league", "club", "min"]) $(`#${prefix}${k}`).addEventListener("change", (e) => { f[k] = e.target.value; if (k === "league") f.club = ""; onChange(k); });
  $$(".seg3 button", $("#panel")).forEach((b) => b.addEventListener("click", () => { f.g = b.dataset.g; onChange("g"); }));
}
function panelBuild() {
  const locked = state.xi.filter(Boolean).length;
  $("#panel").innerHTML = `<h2 class="pTitle">Kadro kur</h2>
    <div class="pBox">
      <div class="prow"><span>Diziliş</span><select id="bForm" aria-label="Kurulacak diziliş">${opt("current", `Şu anki (${FORMATIONS[state.f].name})`, build.formation === "current")}${opt("best", "En iyi diziliş (hepsini dene)", build.formation === "best")}</select></div>
      <div class="prow"><span>Hedef</span><div class="seg2">${[["meta", "JinjaFC Rating"], ["chem", "Tam kimya"]].map(([v, t]) => `<button type="button" data-want="${v}" aria-pressed="${build.want === v}">${t}</button>`).join("")}</div></div>
    </div>
    <div class="pBox"><h3>Filtreler</h3>${filterSelects(build, "b")}</div>
    <p class="hint">${locked ? `Sahadaki <b>${locked} oyuncu kilitli</b> kalır; geri kalanı doldurulur.` : "Sahaya oyuncu koyarsan onların etrafında kadro kurulur."}</p>
    <button type="button" class="btn lime wide" id="buildGo"${build.running ? " disabled" : ""}>${build.running ? "Kadrolar kuruluyor…" : "Kadro kur"}</button>
    <div class="prog" id="prog" hidden><i></i></div>`;
  $("#bForm").addEventListener("change", (e) => (build.formation = e.target.value));
  $$("[data-want]", $("#panel")).forEach((b) => b.addEventListener("click", () => { build.want = b.dataset.want; panelBuild(); }));
  bindFilters(build, "b", () => panelBuild());
  $("#buildGo").addEventListener("click", runBuild);
}
async function runBuild() {
  build.running = true;
  panelBuild();
  $("#prog").hidden = false;
  const pool = DB.players.filter((p) => (!build.nation || p.nation === build.nation) && (!build.league || p.league === build.league) && (!build.club || p.club === build.club) &&
    p.r >= +build.min && (build.g === "all" || (build.g === "w") === p.women));
  const locked = state.xi.map((p, i) => (p ? { p, pos: slots()[i] } : null)).filter(Boolean);
  const forms = {};
  for (const [k, v] of Object.entries(FORMATIONS)) if (build.formation === "best" || k === state.f) forms[k] = v.slots.map((s) => s[0]);
  // kilitli oyuncuları her dizilişte uygun yerlere oturt; oturmuyorsa o dizilişi atla
  const res = [];
  for (const [k, sl] of Object.entries(forms)) {
    const fixed = Array(11).fill(null);
    let ok = true;
    for (const L of locked) {
      const j = sl.findIndex((pos, q) => !fixed[q] && (k === state.f ? pos === L.pos : L.p.pos.includes(pos)));
      if (j < 0) { ok = false; break; }
      fixed[j] = L.p;
    }
    if (!ok) continue;
    const lockedIds = new Set(locked.map((l) => l.p.id));
    const out = await autoBuild(pool.filter((p) => !lockedIds.has(p.id)), { [k]: sl }, { want: build.want, fixed, onProgress: (f) => { const bar = $("#prog i"); if (bar) bar.style.width = `${Math.round(((Object.keys(forms).indexOf(k) + f) / Object.keys(forms).length) * 100)}%`; } });
    res.push(...out);
  }
  build.running = false;
  if (!res.length) { toast("Bu filtrelerle kadro kurulamadı; filtreleri gevşet."); panelBuild(); return; }
  build.results = res;
  build.sort = build.want === "chem" ? "chem" : "meta";
  panelResults();
  if (matchMedia("(max-width: 900px)").matches) setTab("panel");
}
function panelResults() {
  // sıralı liste; her dizilişten ilk 4 öneri öne alınır ki farklı dizilişler de görünsün
  const sorted = build.results.slice().sort((a, b) => (build.sort === "chem" ? b.chem - a.chem || b.meta - a.meta : b.meta - a.meta || b.chem - a.chem));
  const seen = {}, head = [], rest = [];
  for (const r of sorted) ((seen[r.f] = (seen[r.f] || 0) + 1) <= 4 ? head : rest).push(r);
  const list = [...head, ...rest].slice(0, 45);
  $("#panel").innerHTML = `<div class="pHead"><h2 class="pTitle">Önerilen kadrolar</h2><button type="button" class="x" id="resClose" aria-label="Kadro kur paneline dön">✕</button></div>
    <div class="prow"><span>Sıralama</span><div class="seg2">${[["meta", "JinjaFC Rating"], ["chem", "Kimya"]].map(([v, t]) => `<button type="button" data-rs="${v}" aria-pressed="${build.sort === v}">${t}</button>`).join("")}</div></div>
    <div class="tiles">${list.map((r) => `<button type="button" class="tile" data-sig="${r.sig}"><span><i class="ico jr">J</i>${r.meta.toFixed(1)}</span><span><i class="ico ch"><i></i><i></i><i></i></i>${r.chem}</span><small>${FORMATIONS[r.f].name}</small></button>`).join("")}</div>`;
  $("#resClose").addEventListener("click", () => { build.results = null; panelBuild(); });
  $$("[data-rs]", $("#panel")).forEach((b) => b.addEventListener("click", () => { build.sort = b.dataset.rs; panelResults(); }));
  $$(".tile", $("#panel")).forEach((b) => b.addEventListener("click", () => {
    const r = build.results.find((x) => x.sig === b.dataset.sig);
    state.f = r.f; state.xi = r.xi.slice();
    $("#formation").value = state.f;
    $$(".tile.on", $("#panel")).forEach((t) => t.classList.remove("on"));
    b.classList.add("on");
    render();
    if (matchMedia("(max-width: 900px)").matches) setTab("pitch");
  }));
}
function openPick(target) {
  const isBench = target.bench != null, pos = isBench ? null : slots()[target.slot];
  pick = { ...target, q: "", sort: pos ? "meta" : "rating", pos: pos || "", league: "", nation: "", club: "", min: 0, g: "all", limit: 30, showF: false };
  render();
  panelPick(true);
  if (matchMedia("(max-width: 900px)").matches) setTab("panel");
}
function panelPick(focus) {
  const isBench = pick.bench != null, pos = isBench ? null : slots()[pick.slot];
  const cur = isBench ? state.bench[pick.bench] : state.xi[pick.slot];
  $("#panel").innerHTML = `<div class="pHead"><h2 class="pTitle">${isBench ? `Yedek ${pick.bench + 1}` : `${POS_TR[pos]} için oyuncu`}</h2><button type="button" class="x" id="pickClose" aria-label="Kapat">✕</button></div>
    ${cur ? `<div class="curP">${cardHtml(cur, { pos: pos || undefined, size: "s" })}<div><b>${esc(cur.name)}</b><small>${esc(cur.club)}</small><small>${esc(cur.nat.tr)} · ${esc(cur.league)}</small></div><button type="button" class="btn ghost sm" id="rmP">Kaldır</button></div>` : ""}
    <input type="search" id="pq" class="search" placeholder="Oyuncu ara" value="${esc(pick.q)}" autocomplete="off" aria-label="Oyuncu ara">
    <div class="prow"><span>Sıralama</span><div class="seg2">${[...(pos ? [["meta", "JinjaFC"], ["chem", "Kimya"]] : []), ["rating", "Reyting"]].map(([v, t]) => `<button type="button" data-ps="${v}" aria-pressed="${pick.sort === v}">${t}</button>`).join("")}</div></div>
    <button type="button" class="fToggle" id="fTog" aria-expanded="${pick.showF}">Filtreler${[pick.nation, pick.league, pick.club, +pick.min ? 1 : "", pick.g !== "all" ? 1 : ""].filter(Boolean).length ? ` (${[pick.nation, pick.league, pick.club, +pick.min ? 1 : "", pick.g !== "all" ? 1 : ""].filter(Boolean).length})` : ""}</button>
    <div class="pBox" id="pf"${pick.showF ? "" : " hidden"}>${pos ? `<div class="prow"><span>Mevki</span><div class="seg2"><button type="button" data-pp="${pos}" aria-pressed="${pick.pos === pos}">${POS_TR[pos]}</button><button type="button" data-pp="" aria-pressed="${!pick.pos}">Tümü</button></div></div>` : ""}${filterSelects(pick, "p")}</div>
    <div id="res" class="cards"></div>`;
  $("#pickClose").addEventListener("click", closePick);
  $("#rmP")?.addEventListener("click", () => place(null));
  $("#pq").addEventListener("input", (e) => { pick.q = e.target.value; pick.limit = 30; results(); });
  $$("[data-ps]", $("#panel")).forEach((b) => b.addEventListener("click", () => { pick.sort = b.dataset.ps; panelPick(); }));
  $$("[data-pp]", $("#panel")).forEach((b) => b.addEventListener("click", () => { pick.pos = b.dataset.pp; panelPick(); }));
  $("#fTog").addEventListener("click", () => { pick.showF = !pick.showF; panelPick(); });
  bindFilters(pick, "p", () => { pick.limit = 30; panelPick(); });
  results();
  if (focus && matchMedia("(min-width: 901px)").matches) $("#pq").focus();
}
function results() {
  const isBench = pick.bench != null, pos = isBench ? null : slots()[pick.slot];
  const q = fold(pick.q.trim()), used = new Set([...state.xi, ...state.bench].filter(Boolean).map((p) => p.id));
  let list = DB.players.filter((p) => (!q || p.key.includes(q)) && (!pick.pos || p.pos.includes(pick.pos)) && (!pick.nation || p.nation === pick.nation) && (!pick.league || p.league === pick.league) &&
    (!pick.club || p.club === pick.club) && p.r >= +pick.min && (pick.g === "all" || (pick.g === "w") === p.women) && !used.has(p.id));
  const total = list.length;
  let gain = null;
  if (pick.sort === "meta" && pos) list.sort((a, b) => metaAt(b, pos) - metaAt(a, pos) || b.r - a.r);
  else if (pick.sort === "chem" && pos) {
    list = list.slice(0, 500);
    const base = chemistry(slots(), state.xi).total;
    gain = new Map(list.map((p) => { const xi = state.xi.slice(); xi[pick.slot] = p; return [p.id, chemistry(slots(), xi).total - base]; }));
    list.sort((a, b) => gain.get(b.id) - gain.get(a.id) || metaAt(b, pos) - metaAt(a, pos));
  } else list.sort((a, b) => b.r - a.r);
  const shown = list.slice(0, pick.limit);
  $("#res").innerHTML = total ? `<p class="rcount">${total.toLocaleString("tr")} oyuncu</p><div class="cgrid">${shown.map((p) => {
    const m = pos ? metaAt(p, pos) : null, g = gain?.get(p.id);
    return `<button type="button" class="pickC" data-id="${p.id}" title="${esc(p.name)} · ${esc(p.club)}">${cardHtml(p, { pos: pos && p.pos.includes(pos) ? pos : undefined })}
      <span class="under">${m != null ? `<span class="meta"><i>J</i>${m || "–"}</span>` : ""}${g != null ? `<span class="gain ${g > 0 ? "up" : g < 0 ? "down" : ""}">${g > 0 ? "+" : ""}${g} kimya</span>` : ""}</span></button>`;
  }).join("")}</div>${list.length > shown.length ? `<button type="button" class="btn ghost wide" id="more">Daha fazla göster</button>` : ""}` : `<p class="muted pad">Bu filtrelerle oyuncu bulunamadı.</p>`;
  $("#more")?.addEventListener("click", () => { pick.limit += 40; results(); });
}
function place(p) {
  if (pick.bench != null) state.bench[pick.bench] = p; else state.xi[pick.slot] = p;
  const pos = pick.bench == null ? slots()[pick.slot] : null;
  pick = null;
  render();
  panel();
  if (p && pos && !p.pos.includes(pos)) toast(`${p.short} bu mevkide oynamıyor; kimya alamaz.`);
  if (matchMedia("(max-width: 900px)").matches) setTab("pitch");
}
function closePick() { pick = null; render(); panel(); }
$("#panel").addEventListener("click", (e) => { const b = e.target.closest(".pickC"); if (b) place(DB.byId.get(Number(b.dataset.id))); });
$("#slots").addEventListener("click", (e) => { const s = e.target.closest(".slot"); if (s && DB) openPick({ slot: Number(s.dataset.i) }); });
$("#bench").addEventListener("click", (e) => { const s = e.target.closest(".bslot"); if (s && DB) openPick({ bench: Number(s.dataset.b) }); });

// ---------- telefon sekmeleri ----------
function setTab(t) {
  document.body.dataset.tab = t;
  $$(".sbTabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  scrollTo({ top: 0 });
}
$$(".sbTabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
document.body.dataset.tab = "pitch";

// ---------- kaydet / yükle / paylaş ----------
function encode() {
  const q = new URLSearchParams();
  q.set("f", state.f);
  q.set("xi", state.xi.map((p) => (p ? p.id : "")).join("."));
  if (state.bench.some(Boolean)) q.set("b", state.bench.map((p) => (p ? p.id : "")).join("."));
  return q.toString();
}
function decode(str) {
  const q = new URLSearchParams(str);
  if (FORMATIONS[q.get("f")]) state.f = q.get("f");
  const ids = (k, n) => { const a = (q.get(k) || "").split(".").map((x) => DB.byId.get(Number(x)) || null); return Array.from({ length: n }, (_, i) => a[i] || null); };
  if (q.get("xi")) state.xi = ids("xi", 11);
  if (q.get("b")) state.bench = ids("b", 7);
}
const persist = () => { if (!DB) return; store.set("jfcCurrent", encode()); history.replaceState(null, "", "#" + encode()); };
$("#formation").innerHTML = Object.entries(FORMATIONS).map(([k, v]) => opt(k, v.name, k === state.f)).join("");
$("#formation").addEventListener("change", (e) => {
  const old = slots().map((pos, i) => ({ pos, p: state.xi[i] })).filter((x) => x.p);
  state.f = e.target.value;
  const sl = slots(), xi = Array(11).fill(null);
  for (const x of old.slice()) { const j = sl.findIndex((pos, k) => !xi[k] && x.p.pos.includes(pos)); if (j >= 0) { xi[j] = x.p; old.splice(old.indexOf(x), 1); } }
  for (const x of old) { const j = xi.findIndex((v) => !v); if (j >= 0) xi[j] = x.p; }
  state.xi = xi;
  pick = null;
  render(); panel();
});
$("#clearBtn").addEventListener("click", () => {
  if (!state.xi.some(Boolean) && !state.bench.some(Boolean)) return;
  if (!confirm("Sahadaki ve yedekteki tüm oyuncular kaldırılsın mı?")) return;
  state.xi = Array(11).fill(null); state.bench = Array(7).fill(null); pick = null;
  render(); panel();
});
$("#saveBtn").addEventListener("click", () => {
  if (!state.xi.some(Boolean)) return toast("Önce sahaya oyuncu ekle.");
  const name = (prompt("Kadronun adı:", `Kadrom ${new Date().toLocaleDateString("tr")}`) || "").trim();
  if (!name) return;
  const { c, meta } = calc();
  const list = store.get("jfcSquads", []).filter((s) => s.name !== name);
  list.unshift({ name, s: encode(), m: meta, c: c.total, t: Date.now() });
  store.set("jfcSquads", list.slice(0, 30));
  toast("Kadro bu cihaza kaydedildi.");
});
$("#loadBtn").addEventListener("click", () => {
  const list = store.get("jfcSquads", []);
  pick = null; build.results = null;
  $("#panel").innerHTML = `<div class="pHead"><h2 class="pTitle">Kadrolarım</h2><button type="button" class="x" id="lc" aria-label="Kapat">✕</button></div>` +
    (list.length ? `<ul class="saved">${list.map((s, i) => `<li><button type="button" class="sv" data-i="${i}"><b>${esc(s.name)}</b><small>${s.m ?? s.r ?? 0} JinjaFC · ${s.c}/33 kimya · ${new Date(s.t).toLocaleDateString("tr")}</small></button><button type="button" class="x" data-del="${i}" aria-label="${esc(s.name)} kadrosunu sil">✕</button></li>`).join("")}</ul>` : `<p class="muted pad">Henüz kayıtlı kadron yok. Kadronu kurup kaydet düğmesine bas.</p>`);
  $("#lc").addEventListener("click", panel);
  $(".saved", $("#panel"))?.addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]"), o = e.target.closest(".sv");
    if (d) { const l = store.get("jfcSquads", []); l.splice(Number(d.dataset.del), 1); store.set("jfcSquads", l); $("#loadBtn").click(); return; }
    if (o) { decode(list[Number(o.dataset.i)].s); $("#formation").value = state.f; render(); panel(); if (matchMedia("(max-width: 900px)").matches) setTab("pitch"); }
  });
  if (matchMedia("(max-width: 900px)").matches) setTab("panel");
});
$("#shareBtn").addEventListener("click", async () => {
  if (!state.xi.some(Boolean)) return toast("Önce sahaya oyuncu ekle.");
  const url = `${location.origin}${location.pathname}#${encode()}`;
  try {
    const b = await squadImage();
    const file = new File([b], "jinjafc-kadro.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "JinjaFC kadrom", text: url }); return; }
    await shareOrDownload(b, "jinjafc-kadro.png", url, true);
    try { await navigator.clipboard.writeText(url); toast("Görsel kaydedildi, bağlantı kopyalandı."); } catch {}
  } catch (e) { if (e.name !== "AbortError") toast("Paylaşılamadı."); }
});
async function squadImage() {
  await document.fonts?.ready;
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#07130f"; x.fillRect(0, 0, W, H);
  const { sl, c: ch, meta, rating } = calc();
  const P = (px, py) => { const p = proj(px, py); return [60 + (p.l / 100) * (W - 120), 230 + (p.t / 100) * (H - 290)]; };
  x.fillStyle = "#17583a"; x.beginPath(); [[0, -6], [100, -6], [100, 106], [0, 106]].forEach(([a, b], i) => { const [u, v] = P(a, b); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.fill();
  x.fillStyle = "#4ef08a"; x.font = "800 30px Inter, sans-serif"; x.fillText("JINJAFC · KADRO", 60, 78);
  x.fillStyle = "#fff"; x.font = "700 60px 'Space Grotesk', Inter, sans-serif"; x.fillText(FORMATIONS[state.f].name, 60, 150);
  x.textAlign = "right"; x.font = "700 40px 'Space Grotesk', Inter, sans-serif"; x.fillText(`${meta.toFixed(1)} JinjaFC · ${ch.total}/33 kimya · ${rating}`, W - 60, 150); x.textAlign = "left";
  const COL = { elite: ["#9ef0ff", "#2b6cff"], gold: ["#f8dc7a", "#b88a1c"], silver: ["#e9edf2", "#8f99a6"], bronze: ["#e7b087", "#8d5530"] };
  FORMATIONS[state.f].slots.forEach(([pos, sx, sy], i) => {
    const p = state.xi[i], [cx, cy] = P(sx, sy), s = proj(sx, sy).s, cw = 150 * s, chh = 200 * s;
    if (!p) return;
    const t = p.r >= 88 ? "elite" : p.r >= 75 ? "gold" : p.r >= 65 ? "silver" : "bronze";
    const g = x.createLinearGradient(0, cy - chh / 2, 0, cy + chh / 2); g.addColorStop(0, COL[t][0]); g.addColorStop(1, COL[t][1]);
    x.fillStyle = g; x.beginPath(); x.roundRect(cx - cw / 2, cy - chh / 2, cw, chh, 16 * s); x.fill();
    x.fillStyle = "#1b1407"; x.textAlign = "center";
    x.font = `800 ${50 * s}px 'Space Grotesk', Inter`; x.fillText(String(p.r), cx, cy - chh * 0.12);
    x.font = `800 ${22 * s}px Inter`; x.fillText(POS_TR[pos], cx, cy + chh * 0.06);
    x.font = `700 ${21 * s}px Inter`; x.fillText(p.short.length > 12 ? p.short.slice(0, 11) + "…" : p.short, cx, cy + chh * 0.26);
    const cv = ch.per[i]?.chem || 0;
    for (let k = 0; k < 3; k++) { x.fillStyle = k < cv ? "#0f7a3d" : "#00000033"; x.beginPath(); x.arc(cx - 20 * s + k * 20 * s, cy + chh * 0.4, 6 * s, 0, 7); x.fill(); }
    x.textAlign = "left";
  });
  x.fillStyle = "#7f9e90"; x.font = "600 24px Inter"; x.fillText("jinjagames.com/jinjafc", 60, H - 26);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

// ---------- başlat ----------
drawField();
try {
  DB = await loadDB();
  $("#loading").remove();
  const from = location.hash.slice(1) || store.get("jfcCurrent", "");
  if (from) decode(from);
  $("#formation").value = state.f;
  render();
  panel();
} catch (e) {
  console.error(e);
  $("#loading").textContent = "Oyuncu listesi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.";
}
