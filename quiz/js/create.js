// JinjaQuiz: quiz oluşturma sayfası (/quiz/create/). Sanatçı ve şarkı araması ayrı sekmelerde;
// sanatçının popüler şarkıları ve tüm albümleri tek tek ya da topluca eklenebilir.
import { searchArtists, searchTracks, artistInfo, artistTop, artistAlbums, albumTracks, ownTracks, isAlternate, customLists, saveCustom, removeCustom, cleanTracks, fold, cdn } from "./music.js?v=5";
import { fetchCommunity, loadFull, publishQuiz, removeQuiz, myPubkey, MIN_TRACKS, MAX_TRACKS } from "./community.js?v=10";
import { TCATS, TART, EMOJIS, T_MIN, T_MAX, cleanItems, cleanCat, cleanEmoji, isTF, IMG } from "./trivia.js?v=4";
import { cleanOps, RANK_PTS, OP_PTS } from "./engine.js?v=11";
import { initI18n } from "./i18n.js?v=10";
import { rankItems } from "./rank.js?v=4";
import { OP_MIN } from "./community.js?v=10";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ic = (n) => `<i class="ic" aria-hidden="true" style="--i:url(/quiz/assets/icons/${/^[a-z0-9-]{1,32}$/.test(n) ? n : "music"}.svg)"></i>`;
const spinner = () => `<span class="spin" aria-hidden="true"></span>`;
// Yüklenirken iskelet görünüm (dönen simge yerine içeriğin taslağı)
const skRows = (n = 4) => `<div class="skWrap" aria-busy="true" aria-label="Yükleniyor">${Array.from({ length: n }, (_, i) => `<div class="skRow" style="--i:${i}"><span class="sk skAv"></span><span class="skCol"><span class="sk skL" style="width:${60 - (i % 3) * 12}%"></span><span class="sk skL" style="width:${34 + (i % 2) * 10}%"></span></span></div>`).join("")}</div>`;
const skCards = (n = 4) => Array.from({ length: n }, (_, i) => `<div class="skCard" style="--i:${i}" aria-hidden="true"><span class="sk skArt"></span><span class="sk skL" style="width:70%"></span><span class="sk skL" style="width:45%"></span></div>`).join("");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const app = $("#app");
initI18n();
let toastT;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show " + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.className = ""), 3200);
}
const fail = (e) => toast(e?.message || String(e), "bad");
const profile = (() => { try { return JSON.parse(localStorage.getItem("jqProfile")); } catch { return null; } })();

// ---- durum ----
const st = {
  name: "", desc: "", author: profile?.name || "", public: true, tracks: [],
  d: undefined, prevAt: 0, localId: undefined,
  tab: "artist", q: "", busy: false, results: null,
  artist: null,          // { info, top, albums, open: Set(albumId), albumTracks: Map }
  hideAlt: true, saving: false,
  // trivia
  kind: null, items: [], cat: "Genel Kültür", emoji: "🧠", bulk: false,
  // sıralama
  rank: null,            // { artist, items, busy, err }
  // anime opening
  ops: [],
};
const KINDS = [
  ["song", "music", "Şarkı quizi", "Sanatçı ya da şarkı ara, listeni kur. Oyuncular kesiti dinleyip şarkıyı bilir."],
  ["rev", "rewind", "Tersten Şarkı", "Şarkı quizi gibi listeni kur; oyunda kesitler tersten çalar."],
  ["trivia", "circle-help", "Trivia", "Kendi sorularını ve şıklarını yaz, istersen görsel ekle."],
  ["rank", "list-ordered", "Sıralama", "Bir sanatçı seç; en çok dinlenen 5 şarkısı ve 20 şık otomatik hazırlanır."],
  ["op", "tv", "Anime Opening", "YouTube bağlantısını yapıştır, animenin ve şarkının adını yaz."],
];
const kindTitle = (k) => (KINDS.find((x) => x[0] === k) || [])[2] || "Quiz";
const blankOp = () => ({ url: "", anime: "", song: "" });
// YouTube bağlantısından video kimliği ve başlangıç saniyesi (t= / start=)
function ytParse(u) {
  const m = String(u || "").trim().match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/) || String(u || "").trim().match(/^([\w-]{11})$/);
  if (!m) return null;
  let sec = 0;
  const t = String(u).match(/[?&#](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(\d+)s?/);
  if (t) sec = (Number(t[1]) || 0) * 3600 + (Number(t[2]) || 0) * 60 + (Number(t[3]) || 0);
  return { yt: m[1], s: sec };
}
const opItems = () => cleanOps(st.ops.map((o) => ({ ...(ytParse(o.url) || {}), anime: o.anime, song: o.song })));
const hue = (name) => { let h = 0; for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
const blank = () => ({ q: "", type: "4", a: ["", "", "", ""], tf: true });
const visOf = (it) => ({ ...(it.img ? { img: it.img, iw: it.iw === "q" ? "q" : "a" } : {}), ...(it.f ? { f: it.f } : {}), ...(it.e ? { e: it.e } : {}) });
const toEditor = (it) => ({ ...(isTF(it.a) ? { q: it.q, type: "tf", a: ["", "", "", ""], tf: it.a[0] === "Doğru" } : { q: it.q, type: "4", a: [...it.a, "", "", ""].slice(0, 4), tf: true }), ...visOf(it) });
const fromEditor = (e) => ({ ...(e.type === "tf" ? { q: e.q.trim(), a: e.tf ? ["Doğru", "Yanlış"] : ["Yanlış", "Doğru"] } : { q: e.q.trim(), a: [e.a[0].trim(), ...e.a.slice(1).map((x) => x.trim()).filter(Boolean)] }), ...visOf(e) });
// Yayınlanan quiz tek bir Nostr kaydına sığmalı (~60 KB); görseller küçük WebP olarak gömülür.
const PUBLISH_LIMIT = 58000;
const sizeOf = () => JSON.stringify(st.items.filter((e) => !isBlank(e)).map(fromEditor)).length;
async function shrinkImage(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    img.src = url;
    await img.decode();
    for (const [side, q] of [[360, 0.62], [280, 0.5], [200, 0.45]]) {
      const k = Math.min(1, side / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let out = c.toDataURL("image/webp", q);
      if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", q);
      if (IMG.test(out) && out.length < 16000) return out;
    }
    throw Error("Görsel çok büyük, daha basit bir görsel dene.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
const isBlank = (e) => !e.q.trim() && (e.type === "tf" || e.a.every((x) => !x.trim()));
const editing = () => !!(st.d || st.localId);
const hasContent = () => st.tracks.length > 0 || st.items.some((e) => !isBlank(e)) || !!st.rank?.items || st.ops.some((o) => o.url || o.anime || o.song);

// ---- onay paneli (tarayıcının düz onay kutusu yerine): çıkarken, türü değiştirirken, silerken ----
const askDlg = document.createElement("dialog");
askDlg.className = "sheet";
askDlg.innerHTML = `<div id="sheetBody"></div>`;
document.body.append(askDlg);
function ask({ title, text = "", ok = "Evet", danger = true }) {
  return new Promise((res) => {
    askDlg.firstElementChild.innerHTML = `<div class="sheetHead"><h2>${esc(title)}</h2><button type="button" class="icon" data-ask="0" aria-label="Kapat">${ic("x")}</button></div>
      ${text ? `<p class="muted">${esc(text)}</p>` : ""}
      <div class="sheetFoot"><button type="button" class="btn ghost" data-ask="0" autofocus>Vazgeç</button><button type="button" class="btn ${danger ? "danger" : "primary"}" data-ask="1">${esc(ok)}</button></div>`;
    const done = (v) => { askDlg.removeEventListener("click", onClick); askDlg.removeEventListener("cancel", onCancel); askDlg.close(); res(v); };
    const onClick = (e) => { if (e.target === askDlg) return done(false); const b = e.target.closest("[data-ask]"); if (b) done(b.dataset.ask === "1"); };
    const onCancel = (e) => { e.preventDefault(); done(false); };
    askDlg.addEventListener("click", onClick);
    askDlg.addEventListener("cancel", onCancel);
    askDlg.showModal();
  });
}
// Sayfadan çıkan bağlantılar (geri ok, logo): kaydedilmemiş içerik varsa önce sor
document.addEventListener("click", async (e) => {
  const a = e.target.closest("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
  if (!hasContent() || st.saving) return;
  e.preventDefault();
  const yes = await ask({ title: editing() ? "Düzenlemeden çıkılsın mı?" : "Quiz oluşturmaktan çıkılsın mı?", text: "Kaydetmediğin değişiklikler kaybolur.", ok: "Çık" });
  if (yes) { st.saving = true; location.href = a.href; }
}, true);
const have = () => new Set(st.tracks.map((t) => t.id));
const full = () => st.tracks.length >= MAX_TRACKS;

// ---- önizleme dinleme ----
const audio = new Audio();
let playing = null;
function togglePreview(t) {
  if (playing === t.id) { audio.pause(); playing = null; return drawLists(); }
  audio.src = t.preview; audio.currentTime = 0;
  audio.volume = Math.min(1, Math.max(0, num(JSON.parse(localStorage.getItem("jqVolume") || "0.8"))));
  audio.play().then(() => { playing = t.id; drawLists(); }).catch(() => toast("Önizleme çalınamadı.", "bad"));
}
audio.addEventListener("ended", () => { playing = null; drawLists(); });

// ---- ekleme / çıkarma ----
function add(list, { quiet = false } = {}) {
  const h = have(); const titles = new Set(st.tracks.map((t) => fold(t.title) + "|" + fold(t.artist)));
  let n = 0;
  for (const t of list) {
    if (full()) break;
    const k = fold(t.title) + "|" + fold(t.artist);
    if (h.has(t.id) || titles.has(k)) continue; // aynı şarkının ikinci sürümü eklenmez
    st.tracks.push({ id: t.id, title: t.title, artist: t.artist, cover: t.cover });
    h.add(t.id); titles.add(k); n++;
  }
  if (!quiet) toast(n ? `${n} şarkı eklendi.` : full() ? `En fazla ${MAX_TRACKS} şarkı.` : "Bunlar zaten ekli.");
  drawAll();
  return n;
}
function toggle(t) {
  const i = st.tracks.findIndex((x) => x.id === t.id);
  if (i >= 0) st.tracks.splice(i, 1);
  else if (full()) return toast(`En fazla ${MAX_TRACKS} şarkı.`, "bad");
  else st.tracks.push({ id: t.id, title: t.title, artist: t.artist, cover: t.cover });
  drawAll();
}
const visible = (arr) => (st.hideAlt ? arr.filter((t) => !isAlternate(t)) : arr);

// ---- çizim ----
function trackRow(t, i) {
  const on = have().has(t.id);
  return `<div class="crRow ${on ? "on" : ""}">
    ${t.preview ? `<button class="crPlay ${playing === t.id ? "on" : ""}" data-prev="${i}" aria-label="Önizlemeyi dinle">${ic(playing === t.id ? "volume-2" : "play")}</button>` : ""}
    ${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}
    <span class="crMeta"><b>${esc(t.title)}</b><small>${esc(t.artist)}${t.version ? ` · ${esc(t.version)}` : ""}</small></span>
    <button class="crAdd" data-tog="${i}" aria-pressed="${on}" aria-label="${on ? "Çıkar" : "Ekle"}">${ic(on ? "check" : "plus")}</button>
  </div>`;
}
let rowSource = []; // data-tog / data-prev indeksleri bu diziye işaret eder
function rows(arr) {
  const start = rowSource.length;
  rowSource.push(...arr);
  return arr.map((t, i) => trackRow(t, start + i)).join("");
}

function sideHtml() {
  const n = st.tracks.length;
  const cover = st.tracks.find((t) => t.cover)?.cover;
  return `<div class="crCard"><div class="crScroll">
    ${kindSwitch()}
    <div class="crCover">${cover ? `<img src="${esc(cover)}" alt="">` : `<span class="noart">${ic("list-music")}</span>`}<span class="crCount"><b>${n}</b>/${MAX_TRACKS} şarkı</span></div>
    <label class="field"><span>Quiz adı</span><input id="qName" maxlength="60" value="${esc(st.name)}" placeholder="Örn. 2010'ların Türkçe pop hitleri" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(st.desc)}" placeholder="Bu quiz ne hakkında?" autocomplete="off"></label>
    ${publishFields()}
    <div class="crSelHead"><b>Quizdeki şarkılar</b>${n ? `<button class="btn ghost sm" data-do="clear">${ic("trash-2")}Temizle</button>` : ""}</div>
    <div class="crSel" id="crSel">${n ? st.tracks.map((t, i) => `<div class="crRow on sel"><span class="crNo">${i + 1}</span>${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}<span class="crMeta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span><button class="crAdd" data-del="${i}" aria-label="Çıkar">${ic("x")}</button></div>`).join("") : `<p class="muted">Sağdan bir sanatçı ya da şarkı ara ve ekle. En az ${MIN_TRACKS} şarkı gerekir.</p>`}</div>
  </div>${saveFoot(n, MIN_TRACKS, "şarkı")}</div>`;
}

function kindSwitch() {
  const k = KINDS.find((x) => x[0] === st.kind);
  // Düzenlerken tür baştan seçilemez (sorular kaybolurdu); ama şarkı quizi normal ↔ tersten arasında değiştirilebilir.
  if (editing() && (st.kind === "song" || st.kind === "rev"))
    return `<div class="crKindNow">${ic(k?.[1] || "music")}<span><small>Quiz türü</small><b>${esc(k?.[2] || "")}</b></span><div class="seg crRevSeg" role="radiogroup" aria-label="Çalış"><button data-do="setSong" aria-pressed="${st.kind === "song"}">${ic("music")}Normal</button><button data-do="setRev" aria-pressed="${st.kind === "rev"}">${ic("rewind")}Tersten</button></div></div>`;
  return `<div class="crKindNow">${ic(k?.[1] || "music")}<span><small>Quiz türü</small><b>${esc(k?.[2] || "")}</b></span>${editing() ? "" : `<button class="btn ghost sm" data-do="chooseKind">Değiştir</button>`}</div>`;
}
function chooserHtml() {
  return `<section class="crChoose">
    <span class="kicker">Yeni quiz</span>
    <h2>Ne tür bir quiz oluşturmak istersin?</h2>
    <div class="crKinds">${KINDS.map(([k, icon, t, d], i) => `<button class="crKindCard k-${k}" data-kind="${k}" style="--i:${i}"><span class="crKindIc">${ic(icon)}</span><b>${t}${k === "rank" || k === "op" || k === "rev" ? " <em>Yeni</em>" : ""}</b><small>${d}</small><i class="crKindGo">${ic("chevron-right")}</i></button>`).join("")}</div>
  </section>`;
}

// ---- sıralama quizi: sanatçı seç, gerisi otomatik ----
function rankSide() {
  const R = st.rank;
  const pic = R?.artist?.picture;
  return `<div class="crCard"><div class="crScroll">
    ${kindSwitch()}
    <div class="crCover">${pic ? `<img src="${esc(pic)}" alt="">` : `<span class="noart">${ic("list-ordered")}</span>`}<span class="crCount"><b>${R?.items ? 5 : 0}</b>/5 sıra · 20 şık</span></div>
    <label class="field"><span>Quiz adı</span><input id="qName" maxlength="60" value="${esc(st.name)}" placeholder="Örn. Wegh · En çok dinlenen 5 şarkı" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(st.desc)}" placeholder="Bu quiz ne hakkında?" autocomplete="off"></label>
    ${publishFields()}
    <div class="rkRules"><span>${ic("check")}<b>+${RANK_PTS.exact}</b> doğru yerdeki her şarkı</span><span>${ic("list-ordered")}<b>+${RANK_PTS.near}</b> ilk 5'te, yeri yanlış</span><span>${ic("trophy")}<b>+${RANK_PTS.perfect}</b> sıranın tamamı doğru</span><span>${ic("timer")}<b>Hız</b> erken kilitleyen tam puan, son saniyede %60</span></div>
  </div>${saveFoot(R?.items ? 1 : 0, 1, R?.items ? "sıralama hazır" : "sanatçı seç")}</div>`;
}
function rankMain() {
  const R = st.rank;
  let body;
  if (R?.busy) body = `<div class="crBuild">${R.artist.picture ? `<img src="${esc(R.artist.picture)}" alt="">` : ""}<div class="crBuildSteps"><b>${esc(R.artist.name)}</b><span class="on">${spinner()} Dinlenme verileri alınıyor</span><span>En çok dinlenen 5 şarkı sıralanıyor</span><span>15 şaşırtmaca şık seçiliyor</span></div></div>`;
  else if (R?.items) {
    const it = R.items[0];
    // Oluşturan da cevapları görmesin: yalnızca hazır olduğu ve kaç şık olduğu gösterilir.
    body = `<div class="crRankDone"><div class="crGroupHead"><b>${ic("check")} Quiz hazır</b><button class="btn soft sm" data-do="rankRefresh">${ic("rotate-ccw")}Şıkları yeniden karıştır</button></div>
      <p class="muted">${esc(R.artist.name)} için en çok dinlenen 5 şarkı ve 15 şaşırtmaca şık hazırlandı. Cevapları sen de görmüyorsun; yayınladıktan sonra sen de oynayabilirsin.</p>
      <p class="muted">${ic("list-ordered")} Sıra, sanatçının YouTube'daki gerçek izlenmelerine göre kurulur. Bu sanatçı listemizde yeniyse quiz en geç 1–2 gün içinde oynanabilir hale gelir.</p>
      <ol class="crRankTop hidden">${it.top.map(() => `<li><span class="crLock">${ic("eye-off")} Gizli</span></li>`).join("")}</ol>
      <p class="crRankPoolInfo">${ic("list-music")} ${it.pool.length} şık</p></div>`;
  } else if (st.busy && !st.results) body = `<div class="crArtists skGrid" aria-busy="true" aria-label="Aranıyor">${skCards(8)}</div>`;
  else if (st.results)
    body = st.results.length
      ? `<div class="crArtists">${st.results.map((a, i) => `<button class="crArtist" data-rankartist="${i}">${a.picture ? `<img src="${esc(a.picture)}" alt="" loading="lazy">` : `<span class="noart">${ic("mic-vocal")}</span>`}<b>${esc(a.name)}</b><small>${num(a.fans).toLocaleString("tr")} hayran</small></button>`).join("")}</div>`
      : `<p class="muted crPad">Sanatçı bulunamadı. Yazımı kontrol et.</p>`;
  else body = `<div class="crHint">${ic("list-ordered")}<p>Bir sanatçı ara ve seç. En çok dinlenen şarkıları otomatik çekilir, sıralama quizi kendiliğinden hazırlanır. Sen sadece bekle.</p></div>`;
  return `<section class="crMain">
    <form class="search" id="crSearch" role="search" autocomplete="off">${ic("search")}<input id="crq" type="search" value="${esc(st.q)}" placeholder="Sanatçı ya da grup adı… (ör. Wegh)">${st.busy ? spinner() : ""}<button class="btn soft" type="submit">Ara</button></form>
    <div id="crBody">${body}</div></section>`;
}
async function buildRank(a, refresh = false) {
  st.rank = { artist: a, busy: true };
  if (!st.name || st.autoName) { st.name = `${a.name} · En çok dinlenen 5 şarkı`; st.autoName = true; }
  drawLists();
  const R = st.rank;
  const t0 = performance.now();
  try {
    const items = await rankItems(a.id, a.name, a.picture);
    if (refresh) items[0].pool = [...items[0].pool].sort(() => Math.random() - 0.5);
    await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (performance.now() - t0)))); // adımlar görünsün
    if (st.rank !== R) return;
    Object.assign(R, { busy: false, items });
  } catch (e) {
    if (st.rank !== R) return;
    st.rank = null;
    fail(e);
  }
  drawLists();
}

// ---- anime opening quizi ----
function opSide() {
  const n = opItems().length;
  return `<div class="crCard"><div class="crScroll">
    ${kindSwitch()}
    <div class="crCover emo"><span class="noart art" style="--h:330"><i class="artGhost">${esc(st.emoji)}</i><i class="artDeco d1">⚔️</i><i class="artDeco d2">🌸</i><i class="artMain">${esc(st.emoji)}</i></span><span class="crCount"><b>${n}</b> opening</span></div>
    <label class="field"><span>Quiz adı</span><input id="qName" maxlength="60" value="${esc(st.name)}" placeholder="Örn. 2010'ların efsane anime openingleri" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(st.desc)}" placeholder="Bu quiz ne hakkında?" autocomplete="off"></label>
    <div class="field"><span>Simge</span><div class="emojiPick">${["📺", "🐉", "🦸", "🧙", "🔥", "⚡", "👾", "🎤", "🎧", "👑"].map((e) => `<button data-emoji="${e}" aria-pressed="${st.emoji === e}" aria-label="Simge ${e}">${e}</button>`).join("")}</div></div>
    ${publishFields()}
    <div class="rkRules"><span>${ic("tv")}<b>+${OP_PTS.anime}</b> animeyi bilen</span><span>${ic("music")}<b>+${OP_PTS.song}</b> şarkıyı bilen</span><span>${ic("sparkles")}<b>+${OP_PTS.both}</b> ikisini birden bilen</span></div>
  </div>${saveFoot(n, OP_MIN, "opening")}</div>`;
}
function opMain() {
  return `<section class="crMain">
    <div class="crHint small">${ic("tv")}<p>Her opening için YouTube bağlantısını yapıştır, animenin adını ve şarkının adını ayrı ayrı yaz. Bağlantıda <b>t=</b> varsa opening o saniyeden başlar. Oyuncular şıklardan hem animeyi hem şarkıyı seçer; birini bilmek de puan getirir.</p></div>
    <div class="opList">${st.ops.map((o, i) => {
      const y = ytParse(o.url);
      return `<div class="opCard" id="op-${i}">
        <div class="opThumb">${y ? `<img src="https://i.ytimg.com/vi/${y.yt}/mqdefault.jpg" alt="" loading="lazy">${y.s ? `<small>${y.s} sn'den</small>` : ""}` : `<span class="noart">${ic("circle-play")}</span>`}<b>${i + 1}</b></div>
        <div class="opFields">
          <label class="field"><span>YouTube bağlantısı</span><input data-opurl="${i}" value="${esc(o.url)}" placeholder="https://www.youtube.com/watch?v=…" inputmode="url" autocomplete="off" class="${o.url && !y ? "bad" : ""}"></label>
          <div class="opTwo">
            <label class="field"><span>Anime adı</span><input data-opanime="${i}" maxlength="80" value="${esc(o.anime)}" placeholder="Örn. Attack on Titan" autocomplete="off"></label>
            <label class="field"><span>Şarkı adı</span><input data-opsong="${i}" maxlength="80" value="${esc(o.song)}" placeholder="Örn. Guren no Yumiya" autocomplete="off"></label>
          </div>
        </div>
        <button class="icon sm" data-opdel="${i}" aria-label="${i + 1}. openingi sil">${ic("trash-2")}</button>
      </div>`;
    }).join("")}</div>
    <button class="btn soft wide" data-do="opAdd">${ic("plus")}Opening ekle</button>
  </section>`;
}
// Lobiden açıldıysa (?lobi=1, yeni sekme): quiz kaydedilince lobi sekmesine haber verilir, orada sıraya eklenmeye hazır açılır.
const keepCustom = (l) => (saveCustom(l), l);
const FROM_LOBBY = new URLSearchParams(location.search).has("lobi");
function finish(q, tab) {
  if (FROM_LOBBY && !window.opener) {
    // tarayıcı yeni sekme yerine aynı sekmede açtıysa: lobiye geri dön, quiz orada açılır
    try { sessionStorage.setItem("jqLobbyBack", JSON.stringify({ at: Date.now(), q })); } catch {}
    st.saving = true;
    location.href = "../";
    return;
  }
  if (FROM_LOBBY) {
    try { localStorage.setItem("jqLobbyNew", JSON.stringify({ at: Date.now(), q })); } catch {}
    st.saving = true;
    $("#crTitle").textContent = "Quiz hazır";
    app.innerHTML = `<section class="lobbyDone">${ic("check")}<h2>${esc(q.name || "Quizin")} lobiye gönderildi</h2>
      <p class="muted">Lobi sekmesinde açıldı; ayarlarını seçip sıraya ekleyebilirsin. Bu sekmeyi kapatabilirsin.</p>
      <button class="btn primary lg" data-do="closeTab">${ic("arrow-left")}Lobiye dön</button></section>`;
    setTimeout(() => window.close(), 900);
    return;
  }
  if (tab === "topluluk") try { sessionStorage.setItem("jqJustPublished", JSON.stringify(q)); } catch {}
  location.href = "../?tab=" + tab;
}
async function saveOps() {
  const items = opItems();
  const bad = st.ops.findIndex((o) => (o.url || o.anime || o.song) && !cleanOps([{ ...(ytParse(o.url) || {}), anime: o.anime, song: o.song }]).length);
  if (bad >= 0) { $("#op-" + bad)?.scrollIntoView({ behavior: "smooth", block: "center" }); return toast(`${bad + 1}. opening eksik: geçerli bir YouTube bağlantısı, anime adı ve şarkı adı gerekli.`, "bad"); }
  if (items.length < OP_MIN) return toast(`En az ${OP_MIN} opening ekle (şıklar diğer openinglerden oluşur).`, "bad");
  st.saving = true; drawLists();
  try {
    if (st.public) {
      const q = await publishQuiz({ kind: "op", d: st.d, name: st.name, desc: st.desc, author: st.author || "Anonim", emoji: st.emoji, items, prevAt: st.prevAt });
      if (st.localId) removeCustom(st.localId);
      finish(q, "topluluk");
    } else {
      if (st.d) await removeQuiz({ d: st.d, pubkey: myPubkey(), at: st.prevAt }).catch(() => {});
      finish(keepCustom({ id: st.localId || "my" + Math.random().toString(36).slice(2, 10), kind: "op", cat: "Anime", name: st.name, desc: st.desc, emoji: st.emoji, items, genre: "Senin" }), "senin");
    }
  } catch (e) { st.saving = false; drawLists(); fail(e); }
}
async function saveRank() {
  const R = st.rank;
  if (!R?.items) return toast("Önce bir sanatçı seç.", "bad");
  st.saving = true; drawLists();
  const base = { kind: "rank", name: st.name, desc: st.desc, items: R.items, artist: R.artist.name, artistId: R.artist.id, picture: R.artist.picture || "" };
  try {
    if (st.public) {
      const q = await publishQuiz({ ...base, d: st.d, author: st.author || "Anonim", prevAt: st.prevAt });
      if (st.localId) removeCustom(st.localId);
      finish(q, "topluluk");
    } else {
      if (st.d) await removeQuiz({ d: st.d, pubkey: myPubkey(), at: st.prevAt }).catch(() => {});
      finish(keepCustom({ ...base, id: st.localId || "my" + Math.random().toString(36).slice(2, 10), genre: "Senin" }), "senin");
    }
  } catch (e) { st.saving = false; drawLists(); fail(e); }
}
function publishFields() {
  return `<label class="setRow toggle"><span>Herkese açık yayınla<small>Topluluk sekmesinde herkes görür ve oynar.</small></span><input type="checkbox" id="qPublic" ${st.public ? "checked" : ""}><span class="sw"></span></label>
    ${st.public ? `<label class="field"><span>Yazar adı</span><input id="qAuthor" maxlength="24" value="${esc(st.author)}" placeholder="Quizde görünecek adın" autocomplete="nickname"></label>` : ""}`;
}
// Yayınla düğmesi panelin altında hep görünür (uzun listede aşağı kaydırmaya gerek yok).
function saveFoot(n, min, unit) {
  const ready = n >= min;
  return `<div class="crFoot">
    <div class="crProg ${ready ? "ok" : ""}"><span><b>${n}</b> ${unit}${ready ? "" : ` · en az ${min}`}</span><i style="--p:${Math.min(100, (n / min) * 100)}%"></i></div>
    <span class="crFootBtns">${st.d ? `<button class="btn ghost" data-do="unpublish" aria-label="Yayından kaldır" title="Yayından kaldır">${ic("trash-2")}</button>` : ""}<button class="btn primary lg wide" data-do="save" ${st.saving ? "disabled" : ""}>${st.saving ? `${spinner()} ${st.public ? "Yayınlanıyor…" : "Kaydediliyor…"}` : `${ic("check")}${st.public ? (st.d ? "Güncelle ve yayınla" : "Yayınla") : "Kaydet (sadece bende)"}`}</button></span>
  </div>`;
}
const filled = () => st.items.filter((e) => !isBlank(e)).length;
function triviaSide() {
  return `<div class="crCard"><div class="crScroll">
    ${kindSwitch()}
    <div class="crCover emo"><span class="noart art" style="--h:${(TART[st.cat]?.[0] ?? hue(st.cat)) + (hue(st.name || st.cat) % 36) - 18}"><i class="artGhost">${esc(st.emoji)}</i><i class="artDeco d1">${TART[st.cat]?.[1] || "✨"}</i><i class="artDeco d2">${TART[st.cat]?.[2] || "❓"}</i><i class="artMain">${esc(st.emoji)}</i></span><span class="crCount"><b>${filled()}</b>/${T_MAX} soru</span></div>
    <label class="field"><span>Trivia adı</span><input id="qName" maxlength="60" value="${esc(st.name)}" placeholder="Örn. 90'lar Çizgi Filmleri" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(st.desc)}" placeholder="Bu trivia ne hakkında?" autocomplete="off"></label>
    <label class="field"><span>Kategori</span><select id="qCat">${TCATS.map((c) => `<option ${c === st.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
    <div class="field"><span>Simge</span><div class="emojiPick">${EMOJIS.map((e) => `<button data-emoji="${e}" aria-pressed="${st.emoji === e}" aria-label="Simge ${e}">${e}</button>`).join("")}</div></div>
    ${publishFields()}
    ${st.public && st.items.some((e) => e.img) ? `<div class="crBudget ${sizeOf() > PUBLISH_LIMIT ? "over" : ""}"><span>${ic("image")} Görsel alanı</span><i style="--p:${Math.min(100, (sizeOf() / PUBLISH_LIMIT) * 100)}%"></i><small>${Math.round(sizeOf() / 1000)} / ${PUBLISH_LIMIT / 1000} KB</small></div>` : ""}
  </div>${saveFoot(filled(), T_MIN, "soru")}</div>`;
}
const BULK_EXAMPLE = `Türkiye'nin başkenti neresidir?
*Ankara
İstanbul
İzmir
Bursa

Ay, Dünya'nın uydusudur.
*Doğru
Yanlış`;
function triviaMain() {
  const n = filled();
  return `<section class="crMain">
    <div class="tvHead"><h2>Sorular <small>${n}/${T_MAX}</small></h2><span><button class="btn soft sm" data-do="tvBulk">${ic("list-plus")}Toplu ekle</button><button class="btn primary sm" data-do="tvAdd">${ic("plus")}Soru ekle</button></span></div>
    ${st.bulk ? `<div class="tvBulk"><b>Toplu ekle</b><small class="muted">Her soruyu boş bir satırla ayır. İlk satır soru, altındakiler şıklar. Doğru şıkkın başına * koy (koymazsan ilk şık doğru sayılır). 2 ile 4 şık olabilir.</small><pre>${esc(BULK_EXAMPLE)}</pre><textarea id="tvBulkText" placeholder="Sorularını buraya yapıştır…"></textarea><span><button class="btn ghost sm" data-do="tvBulkClose">Vazgeç</button><button class="btn primary sm" data-do="tvBulkAdd">${ic("check")}Soruları ekle</button></span></div>` : ""}
    <p class="tvHelp">Yeşil noktalı kutu doğru cevap, diğerleri yanlış şıklar. Oyunda şıklar karıştırılır. En az ${T_MIN} soru gerekir; boş bıraktığın kartlar kaydedilmez.</p>
    <div class="tvList">${st.items.map((e, i) => tvCard(e, i)).join("")}</div>
    ${st.items.length < T_MAX ? `<button class="tvAddBig" data-do="tvAdd">${ic("plus")}Soru ekle</button>` : ""}
  </section>`;
}
function tvCard(e, i) {
  const last = st.items.length - 1;
  return `<div class="tvCard" id="tv-${i}">
    <div class="tvTop"><span class="tvNo">${i + 1}</span>
      <div class="seg"><button data-tvtype="${i}:4" aria-pressed="${e.type === "4"}">Çoktan seçmeli</button><button data-tvtype="${i}:tf" aria-pressed="${e.type === "tf"}">Doğru / Yanlış</button></div>
      <span class="tvBtns"><button class="icon sm" data-tvmove="${i}:-1" ${i ? "" : "disabled"} aria-label="Yukarı taşı"><span class="up">${ic("chevron-down")}</span></button><button class="icon sm" data-tvmove="${i}:1" ${i < last ? "" : "disabled"} aria-label="Aşağı taşı">${ic("chevron-down")}</button><label class="icon sm tvImgBtn" title="Görsel ekle" aria-label="Görsel ekle">${ic("image")}<input type="file" accept="image/*" data-tvimg="${i}" hidden></label><button class="icon sm" data-tvdel="${i}" aria-label="Soruyu sil">${ic("trash-2")}</button></span>
    </div>
    ${e.img ? `<div class="tvImg"><img src="${esc(e.img)}" alt=""><span><div class="seg"><button data-tviw="${i}:q" aria-pressed="${e.iw === "q"}">Soruyla göster</button><button data-tviw="${i}:a" aria-pressed="${e.iw !== "q"}">Cevapla göster</button></div><small class="muted">${e.iw === "q" ? "Soru sorulurken görünür (ör. “Bu kim?”)." : "Doğru cevap açılınca görünür."}</small></span><button class="icon sm" data-tvimgdel="${i}" aria-label="Görseli kaldır">${ic("x")}</button></div>` : ""}
    <textarea class="tvQ" id="tvq-${i}" data-tvq="${i}" maxlength="200" rows="2" placeholder=""${e.type === "tf" ? "Bir ifade yaz… (ör. Ay, Dünya'nın uydusudur.)" : "Soruyu yaz… (ör. Türkiye'nin başkenti neresidir?)"}">${esc(e.q)}</textarea>
    ${e.type === "tf"
      ? `<div class="tvTF">Bu ifade: <button data-tvtf="${i}:1" aria-pressed="${e.tf}">Doğru</button><button data-tvtf="${i}:0" aria-pressed="${!e.tf}">Yanlış</button></div>`
      : `<div class="tvOpts">${[0, 1, 2, 3].map((j) => `<label class="tvOpt ${j ? "" : "ok"}"><i class="dot"></i><input id="tva-${i}-${j}" data-tva="${i}:${j}" maxlength="80" value="${esc(e.a[j])}" placeholder="${j === 0 ? "Doğru cevap" : `Yanlış şık${j > 1 ? " (isteğe bağlı)" : ""}`}" aria-label="${j === 0 ? "Doğru cevap" : "Yanlış şık " + j}"></label>`).join("")}</div>`}
  </div>`;
}
function parseBulk(text) {
  const out = [];
  for (const block of String(text).replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const q = lines[0].replace(/^(soru\s*)?\d{1,3}\s*[.)\-:]\s*/i, "");
    let correct = 0;
    const opts = lines.slice(1, 5).map((l, k) => {
      l = l.replace(/^[-•]\s*/, "");
      if (l.startsWith("*")) { correct = k; l = l.slice(1).trim(); }
      return l.replace(/^[a-dA-D]\s*[).:-]\s*/, "");
    }).filter(Boolean);
    if (opts.length < 2) continue;
    const a = [opts[correct] ?? opts[0], ...opts.filter((_, k) => k !== correct)];
    out.push(toEditor({ q, a }));
  }
  return out;
}

function mainHtml() {
  rowSource = [];
  const tabs = `<div class="seg crTabs" role="tablist">
      <button role="tab" aria-selected="${st.tab === "artist"}" data-tab="artist">${ic("mic-vocal")}Sanatçı</button>
      <button role="tab" aria-selected="${st.tab === "track"}" data-tab="track">${ic("music")}Şarkı</button>
    </div>
    <form class="search" id="crSearch" role="search" autocomplete="off">${ic("search")}<input id="crq" type="search" value="${esc(st.q)}" placeholder="${st.tab === "artist" ? "Sanatçı ya da grup adı… (ör. Duman)" : "Şarkı adı ya da şarkı + sanatçı…"}">${st.busy ? spinner() : ""}<button class="btn soft" type="submit">Ara</button></form>
    <label class="crAlt"><input type="checkbox" id="hideAlt" ${st.hideAlt ? "checked" : ""}> Remix, canlı, hızlandırılmış ve benzeri sürümleri gizle</label>`;
  let body = "";
  if (st.busy && !st.results) body = `<div class="crArtists skGrid" aria-busy="true" aria-label="Aranıyor">${skCards(8)}</div>`;
  else if (st.tab === "artist" && st.artist) body = artistHtml();
  else if (st.tab === "artist" && st.results)
    body = st.results.length
      ? `<div class="crArtists">${st.results.map((a, i) => `<button class="crArtist" data-artist="${i}">${a.picture ? `<img src="${esc(a.picture)}" alt="" loading="lazy">` : `<span class="noart">${ic("mic-vocal")}</span>`}<b>${esc(a.name)}</b><small>${num(a.fans).toLocaleString("tr")} hayran</small></button>`).join("")}</div>`
      : `<p class="muted crPad">Sanatçı bulunamadı. Yazımı kontrol et.</p>`;
  else if (st.tab === "track" && st.results) {
    const list = visible(st.results);
    body = list.length ? `<div class="crList">${rows(list)}</div>` : `<p class="muted crPad">Şarkı bulunamadı.</p>`;
  } else body = `<div class="crHint">${ic(st.tab === "artist" ? "mic-vocal" : "music")}<p>${st.tab === "artist" ? "Bir sanatçı ara; popüler şarkılarını ve tüm albümlerini gör, istediklerini ya da hepsini ekle." : "Tek tek şarkı ara ve ekle. Farklı sanatçılardan karışık bir quiz yapabilirsin."}</p></div>`;
  return `<section class="crMain">${tabs}<div id="crBody" class="${st.busy ? "busy" : ""}">${body}</div></section>`;
}

function artistHtml() {
  const A = st.artist;
  const top = A.top ? visible(A.top) : null;
  return `<div class="crArtistHead">
      <button class="icon" data-do="backArtists" aria-label="Sanatçı sonuçlarına dön">${ic("chevron-down")}</button>
      ${A.info.picture ? `<img src="${esc(A.info.picture)}" alt="">` : ""}
      <div><small class="kicker">Sanatçı</small><h2>${esc(A.info.name)}</h2><small class="muted">${num(A.info.fans).toLocaleString("tr")} hayran · ${num(A.info.albums)} albüm</small></div>
    </div>
    <div class="crGroup">
      <div class="crGroupHead"><b>Popüler şarkılar ${top ? `<small>${top.length}</small>` : ""}</b>${top?.length ? `<span><button class="btn soft sm" data-do="addTop15">İlk 15'i ekle</button><button class="btn primary sm" data-do="addTop">${ic("list-plus")}Hepsini ekle</button></span>` : ""}</div>
      ${top ? `<div class="crList">${rows(top)}</div>` : skRows(5)}
    </div>
    <div class="crGroup">
      <div class="crGroupHead"><b>Albümler ${A.albums ? `<small>${A.albums.length}</small>` : ""}</b>${A.albums?.length ? `<button class="btn primary sm" data-do="addAllAlbums" ${A.loadingAll ? "disabled" : ""}>${A.loadingAll ? `${spinner()} ${A.loadingAll}` : `${ic("list-plus")}Tüm albümlerdeki şarkıları ekle`}</button>` : ""}</div>
      ${A.albums ? A.albums.map((al) => {
        const open = A.open.has(al.id);
        const tr = A.albumTracks.get(al.id);
        const vis = tr ? visible(tr) : null;
        return `<div class="crAlbum ${open ? "open" : ""}">
          <button class="crAlbumHead" data-album="${al.id}" aria-expanded="${open}">${al.cover ? `<img src="${esc(al.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}<span class="crMeta"><b>${esc(al.title)}</b><small>${esc(al.year)}${al.type ? ` · ${esc(al.type === "single" ? "single" : al.type === "ep" ? "EP" : "albüm")}` : ""}</small></span>${ic("chevron-down")}</button>
          ${open ? (vis ? `<div class="crAlbumBody"><div class="crGroupHead"><small class="muted">${vis.length} şarkı</small><button class="btn soft sm" data-addalbum="${al.id}">${ic("list-plus")}Albümü ekle</button></div><div class="crList">${rows(vis)}</div></div>` : skRows(5)) : ""}
        </div>`;
      }).join("") : skRows(5)}
    </div>`;
}

function drawAll() {
  if (!st.kind) {
    app.innerHTML = chooserHtml();
    $("#crTitle").textContent = "Quiz oluştur";
    return;
  }
  const [side, main] = { trivia: [triviaSide, triviaMain], rank: [rankSide, rankMain], op: [opSide, opMain] }[st.kind] || [sideHtml, mainHtml];
  app.innerHTML = `<div class="crGrid"><aside class="crSide">${side()}</aside>${main()}</div>`;
  $("#crTitle").textContent = `${kindTitle(st.kind)} ${editing() ? "düzenle" : "oluştur"}`;
}
// Arama kutusundaki yazıyı ve odağı kaybetmeden yalnızca listeleri yenile
function drawLists() {
  const scroll = scrollY;
  const sel = $("#crSel")?.scrollTop;
  const q = $("#crq")?.value;
  const focus = document.activeElement?.id;
  drawAll();
  if (q != null) $("#crq").value = q;
  scrollTo(0, scroll);
  if (sel != null && $("#crSel")) $("#crSel").scrollTop = sel;
  if (focus && $("#" + focus)) $("#" + focus).focus({ preventScroll: true });
}

// ---- arama ----
let searchN = 0;
async function runSearch() {
  clearTimeout(liveT);
  const q = $("#crq").value.trim();
  if (q.length < 2) return;
  const n = ++searchN;
  const tab = st.tab;
  st.q = q; st.busy = true; st.artist = null; if (st.kind === "rank") st.rank = null; drawLists();
  let res;
  try {
    res = tab === "artist" || st.kind === "rank" ? await searchArtists(q) : await searchTracks(q);
  } catch (e) { if (n === searchN) fail(e); res = []; }
  if (n !== searchN || st.tab !== tab) return; // daha yeni bir arama başladı
  st.results = res; st.busy = false; drawLists();
}
async function openArtist(a) {
  st.artist = { info: { ...a, albums: 0 }, top: null, albums: null, open: new Set(), albumTracks: new Map() };
  drawLists();
  const A = st.artist;
  artistInfo(a.id).then((i) => { if (st.artist === A) (A.info = { ...A.info, ...i, picture: i.picture || a.picture }), drawLists(); }).catch(() => {});
  try { A.top = await artistTop(a.id); } catch (e) { A.top = []; fail(e); }
  if (st.artist === A) drawLists();
  try { A.albums = await artistAlbums(a.id); } catch (e) { A.albums = []; fail(e); }
  if (st.artist === A) drawLists();
}
async function loadAlbum(al) {
  const A = st.artist;
  if (A.albumTracks.has(al.id)) return A.albumTracks.get(al.id);
  // Derleme albümlerinde başka sanatçıların şarkıları da olur; yalnızca bu sanatçınınkiler.
  const tr = ownTracks(await albumTracks(al), A.info.id);
  A.albumTracks.set(al.id, tr);
  return tr;
}

// ---- kaydet ----
async function save() {
  st.name = $("#qName").value.trim();
  st.desc = $("#qDesc").value.trim();
  if ($("#qAuthor")) st.author = $("#qAuthor").value.trim();
  if (!st.name) return $("#qName").focus(), toast("Quize bir ad ver.", "bad");
  if (st.kind === "trivia") return saveTrivia();
  if (st.kind === "rank") return saveRank();
  if (st.kind === "op") return saveOps();
  if (new Set(st.tracks.map((t) => fold(t.title))).size < Math.max(4, MIN_TRACKS)) return toast(`En az ${MIN_TRACKS} farklı şarkı ekle.`, "bad");
  st.saving = true; drawLists();
  try {
    const tracks = cleanTracks(st.tracks);
    if (st.public) {
      const q = await publishQuiz({ d: st.d, name: st.name, desc: st.desc, author: st.author || "Anonim", tracks, rev: st.kind === "rev", prevAt: st.prevAt });
      if (st.localId) removeCustom(st.localId);
      // Ana sayfa röleler yanıt vermeden de göstersin
      finish(q, "topluluk");
    } else {
      if (st.d) await removeQuiz({ d: st.d, pubkey: myPubkey(), at: st.prevAt }).catch(() => {});
      finish(keepCustom({ id: st.localId || "my" + Math.random().toString(36).slice(2, 10), name: st.name, desc: st.desc, picture: tracks.find((t) => t.cover)?.cover || "", artists: [], tracks, ...(st.kind === "rev" ? { rev: true } : {}), genre: "Senin" }), "senin");
    }
  } catch (e) {
    st.saving = false; drawLists(); fail(e);
  }
}

async function saveTrivia() {
  const keep = [];
  for (let i = 0; i < st.items.length; i++) {
    const e = st.items[i];
    if (isBlank(e)) continue;
    const it = fromEditor(e);
    const bad = !it.q ? "soru metni boş" : !it.a[0] ? "doğru cevap boş" : it.a.length < 2 ? "en az bir yanlış şık yaz" : new Set(it.a.map((x) => x.toLocaleLowerCase("tr"))).size !== it.a.length ? "aynı şık iki kez yazılmış" : "";
    if (bad) {
      const card = $("#tv-" + i);
      card?.classList.add("bad");
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast(`${i + 1}. soru: ${bad}.`, "bad");
    }
    keep.push(it);
  }
  const items = cleanItems(keep);
  if (items.length < T_MIN) return toast(`En az ${T_MIN} soru yaz (şu an ${items.length}).`, "bad");
  if (st.public && JSON.stringify(items).length > PUBLISH_LIMIT) return toast("Görseller herkese açık yayın için çok yer kaplıyor. Birkaç görseli kaldır ya da “Herkese açık”ı kapatıp sadece kendine kaydet.", "bad");
  st.saving = true; drawLists();
  try {
    if (st.public) {
      const q = await publishQuiz({ kind: "trivia", d: st.d, name: st.name, desc: st.desc, author: st.author || "Anonim", cat: st.cat, emoji: st.emoji, items, prevAt: st.prevAt });
      if (st.localId) removeCustom(st.localId);
      finish(q, "topluluk");
    } else {
      if (st.d) await removeQuiz({ d: st.d, pubkey: myPubkey(), at: st.prevAt }).catch(() => {});
      finish(keepCustom({ id: st.localId || "my" + Math.random().toString(36).slice(2, 10), kind: "trivia", name: st.name, desc: st.desc, cat: st.cat, emoji: st.emoji, items, genre: "Senin" }), "senin");
    }
  } catch (e) {
    st.saving = false; drawLists(); fail(e);
  }
}
// push: tür seçiminden editöre geçiş geçmişe yazılır; tarayıcının geri tuşu tür seçimine döner.
async function setKind(kind, push = false) {
  if (kind === st.kind) return;
  if (hasContent() && !(await ask({ title: "Quiz türü değiştirilsin mi?", text: "Türü değiştirirsen eklediklerin silinir.", ok: "Değiştir" }))) return;
  st.kind = kind; st.tracks = []; st.items = kind === "trivia" ? [blank()] : [];
  st.rank = null; st.ops = kind === "op" ? [blankOp(), blankOp(), blankOp(), blankOp()] : []; st.results = null; st.q = ""; st.busy = false;
  if (kind === "op") st.emoji = "📺"; else if (kind === "trivia") st.emoji = "🧠";
  history[push ? "pushState" : "replaceState"](null, "", kind ? `?tur=${kind === "song" ? "sarki" : kind === "rev" ? "tersten" : kind === "rank" ? "siralama" : kind === "op" ? "opening" : "trivia"}` : location.pathname);
  drawAll();
  scrollTo({ top: 0 });
  if (kind) (kind === "trivia" || kind === "op" ? $("#qName") : $("#crq"))?.focus();
}
const pair = (v) => v.split(":").map(Number);

// ---- olaylar ----
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  try {
    if (d.kind) return setKind(d.kind, !st.kind);
    if (d.rankartist !== undefined) return buildRank(st.results[Number(d.rankartist)]);
    if (d.opdel !== undefined) { const i = Number(d.opdel); const o = st.ops[i]; if ((o.url || o.anime || o.song) && !(await ask({ title: `${i + 1}. opening silinsin mi?`, ok: "Sil" }))) return; st.ops.splice(i, 1); if (!st.ops.length) st.ops.push(blankOp()); return drawLists(); }
    if (d.emoji) { st.emoji = cleanEmoji(d.emoji); return drawLists(); }
    if (d.tvtype) { const [i, t] = d.tvtype.split(":"); st.items[Number(i)].type = t === "tf" ? "tf" : "4"; return drawLists(); }
    if (d.tviw) { const [i, w] = d.tviw.split(":"); st.items[Number(i)].iw = w === "q" ? "q" : "a"; return drawLists(); }
    if (d.tvimgdel) { const e = st.items[Number(d.tvimgdel)]; delete e.img; delete e.iw; return drawLists(); }
    if (d.tvtf) { const [i, v] = pair(d.tvtf); st.items[i].tf = !!v; return drawLists(); }
    if (d.tvdel) { const i = Number(d.tvdel); if (!isBlank(st.items[i]) && !(await ask({ title: `${i + 1}. soru silinsin mi?`, ok: "Sil" }))) return; st.items.splice(i, 1); if (!st.items.length) st.items.push(blank()); return drawLists(); }
    if (d.tvmove) { const [i, dir] = pair(d.tvmove); const j = i + dir; if (j < 0 || j >= st.items.length) return; [st.items[i], st.items[j]] = [st.items[j], st.items[i]]; return drawLists(); }
    if (d.tab) { st.tab = d.tab; st.results = null; st.artist = null; st.busy = false; searchN++; st.q = ""; drawLists(); runSearch(); return $("#crq").focus(); }
    if (d.artist !== undefined) return openArtist(st.results[Number(d.artist)]);
    if (d.tog !== undefined) return toggle(rowSource[Number(d.tog)]);
    if (d.prev !== undefined) return togglePreview(rowSource[Number(d.prev)]);
    if (d.del !== undefined) { st.tracks.splice(Number(d.del), 1); return drawLists(); }
    if (d.album) {
      const A = st.artist; const id = Number(d.album);
      if (A.open.has(id)) A.open.delete(id); else A.open.add(id);
      drawLists();
      if (A.open.has(id)) { await loadAlbum(A.albums.find((x) => x.id === id)).catch(fail); drawLists(); }
      return;
    }
    if (d.addalbum) {
      const tr = await loadAlbum(st.artist.albums.find((x) => x.id === Number(d.addalbum)));
      return add(visible(tr));
    }
    switch (d.do) {
      case "backArtists": st.artist = null; return drawLists();
      case "chooseKind": return setKind(null);
      case "setSong": if (st.kind === "rev") { st.kind = "song"; drawAll(); } return;
      case "setRev": if (st.kind === "song") { st.kind = "rev"; drawAll(); } return;
      case "rankRefresh": return st.rank?.artist && buildRank(st.rank.artist, true);
      case "opAdd": {
        if (st.ops.length >= 100) return toast("En fazla 100 opening.", "bad");
        st.ops.push(blankOp()); drawLists();
        const el = $(`[data-opurl="${st.ops.length - 1}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true });
        return;
      }
      case "addTop": return add(visible(st.artist.top));
      case "addTop15": return add(visible(st.artist.top).slice(0, 15));
      case "addAllAlbums": {
        const A = st.artist; let n = 0, i = 0;
        for (const al of A.albums) {
          if (full() || st.artist !== A) break;
          A.loadingAll = `${++i}/${A.albums.length} albüm…`; drawLists();
          const tr = await loadAlbum(al).catch(() => []);
          n += add(visible(tr), { quiet: true });
          await new Promise((r) => setTimeout(r, 150)); // Deezer'ı boğmamak için
        }
        A.loadingAll = null; drawLists();
        return toast(n ? `${n} şarkı eklendi.` : "Yeni şarkı yok.");
      }
      case "clear": if (await ask({ title: "Quizdeki tüm şarkılar çıkarılsın mı?", ok: "Hepsini çıkar" })) (st.tracks = []), drawLists(); return;
      case "save": return save();
      case "closeTab": window.close(); return toast("Bu sekmeyi kapatıp lobi sekmesine dönebilirsin.");
      case "tvAdd": {
        if (st.items.length >= T_MAX) return toast(`En fazla ${T_MAX} soru.`, "bad");
        st.items.push(blank()); drawLists();
        const el = $("#tvq-" + (st.items.length - 1));
        el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true });
        return;
      }
      case "tvBulk": st.bulk = true; drawLists(); return $("#tvBulkText")?.focus();
      case "tvBulkClose": st.bulk = false; return drawLists();
      case "tvBulkAdd": {
        const got = parseBulk($("#tvBulkText").value);
        if (!got.length) return toast("Soru bulunamadı. Örnekteki biçimi kullan: soru, altında şıklar, sorular arasında boş satır.", "bad");
        st.items = st.items.filter((e) => !isBlank(e));
        const room = T_MAX - st.items.length;
        st.items.push(...got.slice(0, room));
        if (!st.items.length) st.items.push(blank());
        st.bulk = false; drawLists();
        return toast(`${Math.min(got.length, room)} soru eklendi.`);
      }
      case "unpublish":
        if (!(await ask({ title: "Yayından kaldırılsın mı?", text: `“${st.name}” topluluktan kalkar; artık kimse göremez ve oynayamaz. Bu işlem geri alınamaz.`, ok: "Yayından kaldır" }))) return;
        await removeQuiz({ d: st.d, at: st.prevAt, pubkey: myPubkey() });
        toast("Quiz yayından kaldırıldı.");
        return setTimeout(() => (location.href = "../?tab=topluluk"), 600);
    }
  } catch (err) { fail(err); }
});
// Yazarken sonuçları getir: yazmayı bırakınca ~0,8 sn sonra (her tuşta değil).
let liveT;
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "crq") {
    clearTimeout(liveT);
    const v = t.value.trim();
    if (v.length >= 2 && v !== st.q) liveT = setTimeout(() => $("#crq")?.value.trim() === v && runSearch(), 800);
  }
  if (t.id === "qName") { st.name = t.value; st.autoName = false; }
  if (t.dataset.opanime) st.ops[Number(t.dataset.opanime)].anime = t.value;
  if (t.dataset.opsong) st.ops[Number(t.dataset.opsong)].song = t.value;
  if (t.dataset.opurl) { st.ops[Number(t.dataset.opurl)].url = t.value; }
  if (t.id === "qDesc") st.desc = t.value;
  if (t.id === "qAuthor") st.author = t.value;
  if (t.dataset.tvq) { st.items[Number(t.dataset.tvq)].q = t.value; t.closest(".tvCard")?.classList.remove("bad"); }
  if (t.dataset.tva) { const [i, j] = pair(t.dataset.tva); st.items[i].a[j] = t.value; t.closest(".tvCard")?.classList.remove("bad"); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "qPublic") { st.public = t.checked; drawLists(); }
  if (t.id === "hideAlt") { st.hideAlt = t.checked; drawLists(); }
  if (t.id === "qCat") { st.cat = cleanCat(t.value); drawLists(); }
  if (t.dataset.opurl) drawLists(); // küçük resim ve başlangıç saniyesi
  if (t.dataset.tvimg && t.files?.[0]) {
    const i = Number(t.dataset.tvimg);
    shrinkImage(t.files[0]).then((img) => {
      st.items[i].img = img;
      st.items[i].iw ||= "a";
      drawLists();
      if (st.public && sizeOf() > PUBLISH_LIMIT) toast("Görseller yayın sınırını aşıyor; birkaçını kaldır ya da quizi sadece kendine kaydet.", "bad");
    }).catch(fail);
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "crSearch") runSearch();
});
addEventListener("beforeunload", (e) => {
  if (hasContent() && !st.saving) { e.preventDefault(); e.returnValue = ""; }
});

const turOf = (params) => ({ trivia: "trivia", sarki: "song", song: "song", tersten: "rev", rev: "rev", siralama: "rank", rank: "rank", opening: "op", op: "op" })[params.get("type") || params.get("tur")];
addEventListener("popstate", async () => {
  const params = new URLSearchParams(location.search);
  if (params.get("edit") || params.get("duzenle")) return;
  const k = turOf(params) || null;
  if (k === st.kind) return;
  await setKind(k);
  // Eklenenler silinmesin diye vazgeçildiyse adres yine bulunduğun türü göstersin.
  if (st.kind !== k && st.kind) history.pushState(null, "", `?tur=${{ song: "sarki", rev: "tersten", rank: "siralama", op: "opening" }[st.kind] || "trivia"}`);
});

// ---- açılış: ?duzenle=<id> ----
(async function boot() {
  const params = new URLSearchParams(location.search);
  const id = (params.get("edit") || params.get("duzenle")) || "";
  const tur = turOf(params);
  if (tur && !id) { st.kind = null; setKind(tur); return; }
  drawAll();
  if (!id) return;
  const localK = customLists().find((l) => l.id === id && (l.kind === "rank" || l.kind === "op") && l.items?.length);
  if (localK) {
    Object.assign(st, { kind: localK.kind, name: localK.name, desc: localK.desc || "", emoji: localK.emoji || "📺", public: false, localId: localK.id });
    if (localK.kind === "rank") st.rank = { artist: { id: localK.artistId, name: localK.artist, picture: localK.picture }, items: localK.items };
    else st.ops = localK.items.map((o) => ({ url: `https://www.youtube.com/watch?v=${o.yt}${o.s ? `&t=${o.s}` : ""}`, anime: o.anime, song: o.song }));
    return drawAll();
  }
  const localT = customLists().find((l) => l.id === id && l.kind === "trivia" && l.items?.length);
  if (localT) {
    Object.assign(st, { kind: "trivia", name: localT.name, desc: localT.desc || "", cat: localT.cat, emoji: localT.emoji, items: localT.items.map(toEditor), public: false, localId: localT.id });
    return drawAll();
  }
  const local = customLists().find((l) => l.id === id && l.tracks?.length);
  if (local) {
    Object.assign(st, { kind: local.rev ? "rev" : "song", name: local.name, desc: local.desc || "", tracks: [...local.tracks], public: false, localId: local.id });
    return drawAll();
  }
  if (id.startsWith("nq-")) {
    const sel = app.querySelector("#crSel");
    if (sel) sel.innerHTML = skRows(4);
    try {
      const q = (await fetchCommunity()).find((x) => x.id === id && x.mine);
      if (!q) throw Error("Bu quiz bulunamadı ya da senin değil.");
      await loadFull(q);
      if (q.kind === "rank") Object.assign(st, { kind: "rank", name: q.name, desc: q.desc, author: q.author, rank: { artist: { id: q.artistId, name: q.artist, picture: q.picture }, items: q.items }, public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
      else if (q.kind === "op") Object.assign(st, { kind: "op", name: q.name, desc: q.desc, author: q.author, emoji: q.emoji, ops: q.items.map((o) => ({ url: `https://www.youtube.com/watch?v=${o.yt}${o.s ? `&t=${o.s}` : ""}`, anime: o.anime, song: o.song })), public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
      else if (q.kind === "trivia") Object.assign(st, { kind: "trivia", name: q.name, desc: q.desc, author: q.author, cat: q.cat, emoji: q.emoji, items: q.items.map(toEditor), public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
      else Object.assign(st, { kind: q.rev ? "rev" : "song", name: q.name, desc: q.desc, author: q.author, tracks: [...q.tracks], public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
    } catch (e) { fail(e); }
    drawAll();
  }
})();
