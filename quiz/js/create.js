// JinjaQuiz: quiz oluşturma sayfası (/quiz/olustur/). Sanatçı ve şarkı araması ayrı sekmelerde;
// sanatçının popüler şarkıları ve tüm albümleri tek tek ya da topluca eklenebilir.
import { searchArtists, searchTracks, artistInfo, artistTop, artistAlbums, albumTracks, isAlternate, customLists, saveCustom, removeCustom, cleanTracks, fold, cdn } from "./music.js";
import { fetchCommunity, publishQuiz, removeQuiz, myPubkey, MIN_TRACKS, MAX_TRACKS } from "./community.js";
import { TCATS, EMOJIS, T_MIN, T_MAX, cleanItems, cleanCat, cleanEmoji, isTF } from "./trivia.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ic = (n) => `<i class="ic" aria-hidden="true" style="--i:url(/quiz/assets/icons/${/^[a-z0-9-]{1,32}$/.test(n) ? n : "music"}.svg)"></i>`;
const spinner = () => `<span class="spin" aria-hidden="true"></span>`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const app = $("#app");
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
  kind: "song", items: [], cat: "Genel Kültür", emoji: "🧠", bulk: false,
};
const hue = (name) => { let h = 0; for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
const blank = () => ({ q: "", type: "4", a: ["", "", "", ""], tf: true });
const toEditor = (it) => isTF(it.a) ? { q: it.q, type: "tf", a: ["", "", "", ""], tf: it.a[0] === "Doğru" } : { q: it.q, type: "4", a: [...it.a, "", "", ""].slice(0, 4), tf: true };
const fromEditor = (e) => e.type === "tf" ? { q: e.q.trim(), a: e.tf ? ["Doğru", "Yanlış"] : ["Yanlış", "Doğru"] } : { q: e.q.trim(), a: [e.a[0].trim(), ...e.a.slice(1).map((x) => x.trim()).filter(Boolean)] };
const isBlank = (e) => !e.q.trim() && (e.type === "tf" || e.a.every((x) => !x.trim()));
const editing = () => !!(st.d || st.localId);
const hasContent = () => st.tracks.length > 0 || st.items.some((e) => !isBlank(e));
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
  return `<div class="crCard">
    ${kindSwitch()}
    <div class="crCover">${cover ? `<img src="${esc(cover)}" alt="">` : `<span class="noart">${ic("list-music")}</span>`}<span class="crCount"><b>${n}</b>/${MAX_TRACKS} şarkı</span></div>
    <label class="field"><span>Quiz adı</span><input id="qName" maxlength="60" value="${esc(st.name)}" placeholder="Örn. 2010'ların Türkçe pop hitleri" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(st.desc)}" placeholder="Bu quiz ne hakkında?" autocomplete="off"></label>
    <label class="setRow toggle"><span>Herkese açık yayınla<small>Topluluk sekmesinde herkes görür ve oynar.</small></span><input type="checkbox" id="qPublic" ${st.public ? "checked" : ""}><span class="sw"></span></label>
    ${st.public ? `<label class="field"><span>Yazar adı</span><input id="qAuthor" maxlength="24" value="${esc(st.author)}" placeholder="Quizde görünecek adın" autocomplete="nickname"></label>` : ""}
    <div class="crSelHead"><b>Quizdeki şarkılar</b>${n ? `<button class="btn ghost sm" data-do="clear">${ic("trash-2")}Temizle</button>` : ""}</div>
    <div class="crSel" id="crSel">${n ? st.tracks.map((t, i) => `<div class="crRow on sel"><span class="crNo">${i + 1}</span>${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}<span class="crMeta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span><button class="crAdd" data-del="${i}" aria-label="Çıkar">${ic("x")}</button></div>`).join("") : `<p class="muted">Sağdan bir sanatçı ya da şarkı ara ve ekle. En az ${MIN_TRACKS} şarkı gerekir.</p>`}</div>
    <button class="btn primary lg wide" data-do="save" ${st.saving ? "disabled" : ""}>${st.saving ? `${spinner()} ${st.public ? "Yayınlanıyor…" : "Kaydediliyor…"}` : `${ic("check")}${st.public ? (st.d ? "Güncelle ve yayınla" : "Yayınla") : "Kaydet (sadece bende)"}`}</button>
    ${st.d ? `<button class="btn ghost wide" data-do="unpublish">${ic("trash-2")}Yayından kaldır</button>` : ""}
  </div>`;
}

function kindSwitch() {
  if (editing()) return "";
  return `<div class="seg crKind" role="tablist" aria-label="Quiz türü">
    <button role="tab" aria-selected="${st.kind === "song"}" data-kind="song">${ic("music")}Şarkı quizi</button>
    <button role="tab" aria-selected="${st.kind === "trivia"}" data-kind="trivia">${ic("circle-help")}Trivia</button>
  </div>`;
}
function publishBlock() {
  return `<label class="setRow toggle"><span>Herkese açık yayınla<small>Topluluk sekmesinde herkes görür ve oynar.</small></span><input type="checkbox" id="qPublic" ${st.public ? "checked" : ""}><span class="sw"></span></label>
    ${st.public ? `<label class="field"><span>Yazar adı</span><input id="qAuthor" maxlength="24" value="${esc(st.author)}" placeholder="Quizde görünecek adın" autocomplete="nickname"></label>` : ""}
    <button class="btn primary lg wide" data-do="save" ${st.saving ? "disabled" : ""}>${st.saving ? `${spinner()} ${st.public ? "Yayınlanıyor…" : "Kaydediliyor…"}` : `${ic("check")}${st.public ? (st.d ? "Güncelle ve yayınla" : "Yayınla") : "Kaydet (sadece bende)"}`}</button>
    ${st.d ? `<button class="btn ghost wide" data-do="unpublish">${ic("trash-2")}Yayından kaldır</button>` : ""}`;
}
const filled = () => st.items.filter((e) => !isBlank(e)).length;
function triviaSide() {
  return `<div class="crCard">
    ${kindSwitch()}
    <div class="crCover emo" style="--h:${hue(st.name || st.cat)}">${esc(st.emoji)}<span class="crCount"><b>${filled()}</b>/${T_MAX} soru</span></div>
    <label class="field"><span>Trivia adı</span><input id="qName" maxlength="60" value="${esc(st.name)}" placeholder="Örn. 90'lar Çizgi Filmleri" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(st.desc)}" placeholder="Bu trivia ne hakkında?" autocomplete="off"></label>
    <label class="field"><span>Kategori</span><select id="qCat">${TCATS.map((c) => `<option ${c === st.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
    <div class="field"><span>Simge</span><div class="emojiPick">${EMOJIS.map((e) => `<button data-emoji="${e}" aria-pressed="${st.emoji === e}" aria-label="Simge ${e}">${e}</button>`).join("")}</div></div>
    ${publishBlock()}
  </div>`;
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
      <span class="tvBtns"><button class="icon sm" data-tvmove="${i}:-1" ${i ? "" : "disabled"} aria-label="Yukarı taşı"><span class="up">${ic("chevron-down")}</span></button><button class="icon sm" data-tvmove="${i}:1" ${i < last ? "" : "disabled"} aria-label="Aşağı taşı">${ic("chevron-down")}</button><button class="icon sm" data-tvdel="${i}" aria-label="Soruyu sil">${ic("trash-2")}</button></span>
    </div>
    <textarea class="tvQ" id="tvq-${i}" data-tvq="${i}" maxlength="200" rows="2" placeholder="${e.type === "tf" ? "Bir ifade yaz… (ör. Ay, Dünya'nın uydusudur.)" : "Soruyu yaz… (ör. Türkiye'nin başkenti neresidir?)"}">${esc(e.q)}</textarea>
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
    <form class="search" id="crSearch" role="search" autocomplete="off">${ic("search")}<input id="crq" type="search" value="${esc(st.q)}" placeholder="${st.tab === "artist" ? "Sanatçı ya da grup adı… (ör. Duman)" : "Şarkı adı ya da şarkı + sanatçı…"}"><button class="btn soft" type="submit">Ara</button></form>
    <label class="crAlt"><input type="checkbox" id="hideAlt" ${st.hideAlt ? "checked" : ""}> Remix, canlı, hızlandırılmış ve benzeri sürümleri gizle</label>`;
  let body = "";
  if (st.busy) body = `<p class="muted crPad">${spinner()} Aranıyor…</p>`;
  else if (st.tab === "artist" && st.artist) body = artistHtml();
  else if (st.tab === "artist" && st.results)
    body = st.results.length
      ? `<div class="crArtists">${st.results.map((a, i) => `<button class="crArtist" data-artist="${i}">${a.picture ? `<img src="${esc(a.picture)}" alt="" loading="lazy">` : `<span class="noart">${ic("mic-vocal")}</span>`}<b>${esc(a.name)}</b><small>${num(a.fans).toLocaleString("tr")} hayran</small></button>`).join("")}</div>`
      : `<p class="muted crPad">Sanatçı bulunamadı. Yazımı kontrol et.</p>`;
  else if (st.tab === "track" && st.results) {
    const list = visible(st.results);
    body = list.length ? `<div class="crList">${rows(list)}</div>` : `<p class="muted crPad">Şarkı bulunamadı.</p>`;
  } else body = `<div class="crHint">${ic(st.tab === "artist" ? "mic-vocal" : "music")}<p>${st.tab === "artist" ? "Bir sanatçı ara; popüler şarkılarını ve tüm albümlerini gör, istediklerini ya da hepsini ekle." : "Tek tek şarkı ara ve ekle. Farklı sanatçılardan karışık bir quiz yapabilirsin."}</p></div>`;
  return `<section class="crMain">${tabs}<div id="crBody">${body}</div></section>`;
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
      ${top ? `<div class="crList">${rows(top)}</div>` : `<p class="muted crPad">${spinner()} Yükleniyor…</p>`}
    </div>
    <div class="crGroup">
      <div class="crGroupHead"><b>Albümler ${A.albums ? `<small>${A.albums.length}</small>` : ""}</b>${A.albums?.length ? `<button class="btn primary sm" data-do="addAllAlbums" ${A.loadingAll ? "disabled" : ""}>${A.loadingAll ? `${spinner()} ${A.loadingAll}` : `${ic("list-plus")}Tüm albümlerdeki şarkıları ekle`}</button>` : ""}</div>
      ${A.albums ? A.albums.map((al) => {
        const open = A.open.has(al.id);
        const tr = A.albumTracks.get(al.id);
        const vis = tr ? visible(tr) : null;
        return `<div class="crAlbum ${open ? "open" : ""}">
          <button class="crAlbumHead" data-album="${al.id}" aria-expanded="${open}">${al.cover ? `<img src="${esc(al.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}<span class="crMeta"><b>${esc(al.title)}</b><small>${esc(al.year)}${al.type ? ` · ${esc(al.type === "single" ? "single" : al.type === "ep" ? "EP" : "albüm")}` : ""}</small></span>${ic("chevron-down")}</button>
          ${open ? (vis ? `<div class="crAlbumBody"><div class="crGroupHead"><small class="muted">${vis.length} şarkı</small><button class="btn soft sm" data-addalbum="${al.id}">${ic("list-plus")}Albümü ekle</button></div><div class="crList">${rows(vis)}</div></div>` : `<p class="muted crPad">${spinner()} Yükleniyor…</p>`) : ""}
        </div>`;
      }).join("") : `<p class="muted crPad">${spinner()} Yükleniyor…</p>`}
    </div>`;
}

function drawAll() {
  const trivia = st.kind === "trivia";
  app.innerHTML = `<div class="crGrid"><aside class="crSide">${trivia ? triviaSide() : sideHtml()}</aside>${trivia ? triviaMain() : mainHtml()}</div>`;
  $("#crTitle").textContent = trivia ? (editing() ? "Triviayı düzenle" : "Trivia oluştur") : editing() ? "Quizi düzenle" : "Quiz oluştur";
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
async function runSearch() {
  const q = $("#crq").value.trim();
  if (q.length < 2) return;
  st.q = q; st.busy = true; st.results = null; st.artist = null; drawLists();
  try {
    st.results = st.tab === "artist" ? await searchArtists(q) : await searchTracks(q);
  } catch (e) { fail(e); st.results = []; }
  st.busy = false; drawLists();
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
  const tr = await albumTracks(al);
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
  if (new Set(st.tracks.map((t) => fold(t.title))).size < Math.max(4, MIN_TRACKS)) return toast(`En az ${MIN_TRACKS} farklı şarkı ekle.`, "bad");
  st.saving = true; drawLists();
  try {
    const tracks = cleanTracks(st.tracks);
    if (st.public) {
      const q = await publishQuiz({ d: st.d, name: st.name, desc: st.desc, author: st.author || "Anonim", tracks, prevAt: st.prevAt });
      if (st.localId) removeCustom(st.localId);
      // Ana sayfa röleler yanıt vermeden de göstersin
      try { sessionStorage.setItem("jqJustPublished", JSON.stringify(q)); } catch {}
      location.href = "../?tab=topluluk";
    } else {
      if (st.d) await removeQuiz({ d: st.d, pubkey: myPubkey(), at: st.prevAt }).catch(() => {});
      saveCustom({ id: st.localId || "my" + Math.random().toString(36).slice(2, 10), name: st.name, desc: st.desc, picture: tracks.find((t) => t.cover)?.cover || "", artists: [], tracks, genre: "Senin" });
      location.href = "../?tab=senin";
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
  st.saving = true; drawLists();
  try {
    if (st.public) {
      const q = await publishQuiz({ kind: "trivia", d: st.d, name: st.name, desc: st.desc, author: st.author || "Anonim", cat: st.cat, emoji: st.emoji, items, prevAt: st.prevAt });
      if (st.localId) removeCustom(st.localId);
      try { sessionStorage.setItem("jqJustPublished", JSON.stringify(q)); } catch {}
      location.href = "../?tab=topluluk";
    } else {
      if (st.d) await removeQuiz({ d: st.d, pubkey: myPubkey(), at: st.prevAt }).catch(() => {});
      saveCustom({ id: st.localId || "my" + Math.random().toString(36).slice(2, 10), kind: "trivia", name: st.name, desc: st.desc, cat: st.cat, emoji: st.emoji, items, genre: "Senin" });
      location.href = "../?tab=senin";
    }
  } catch (e) {
    st.saving = false; drawLists(); fail(e);
  }
}
function setKind(kind) {
  if (kind === st.kind) return;
  if (hasContent() && !confirm("Quiz türünü değiştirirsen eklediklerin silinir. Devam edilsin mi?")) return;
  st.kind = kind; st.tracks = []; st.items = kind === "trivia" ? [blank()] : [];
  history.replaceState(null, "", kind === "trivia" ? "?tur=trivia" : location.pathname);
  drawAll();
  (kind === "trivia" ? $("#qName") : $("#crq"))?.focus();
}
const pair = (v) => v.split(":").map(Number);

// ---- olaylar ----
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  try {
    if (d.kind) return setKind(d.kind);
    if (d.emoji) { st.emoji = cleanEmoji(d.emoji); return drawLists(); }
    if (d.tvtype) { const [i, t] = d.tvtype.split(":"); st.items[Number(i)].type = t === "tf" ? "tf" : "4"; return drawLists(); }
    if (d.tvtf) { const [i, v] = pair(d.tvtf); st.items[i].tf = !!v; return drawLists(); }
    if (d.tvdel) { const i = Number(d.tvdel); if (!isBlank(st.items[i]) && !confirm(`${i + 1}. soru silinsin mi?`)) return; st.items.splice(i, 1); if (!st.items.length) st.items.push(blank()); return drawLists(); }
    if (d.tvmove) { const [i, dir] = pair(d.tvmove); const j = i + dir; if (j < 0 || j >= st.items.length) return; [st.items[i], st.items[j]] = [st.items[j], st.items[i]]; return drawLists(); }
    if (d.tab) { st.tab = d.tab; st.results = null; st.artist = null; drawLists(); return $("#crq").focus(); }
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
      case "clear": if (confirm("Quizdeki tüm şarkılar çıkarılsın mı?")) (st.tracks = []), drawLists(); return;
      case "save": return save();
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
        if (!confirm(`"${st.name}" yayından kaldırılsın mı? Başkaları artık göremez.`)) return;
        await removeQuiz({ d: st.d, at: st.prevAt, pubkey: myPubkey() });
        toast("Quiz yayından kaldırıldı.");
        return setTimeout(() => (location.href = "../?tab=topluluk"), 600);
    }
  } catch (err) { fail(err); }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "qName") st.name = t.value;
  if (t.id === "qDesc") st.desc = t.value;
  if (t.id === "qAuthor") st.author = t.value;
  if (t.dataset.tvq) { st.items[Number(t.dataset.tvq)].q = t.value; t.closest(".tvCard")?.classList.remove("bad"); }
  if (t.dataset.tva) { const [i, j] = pair(t.dataset.tva); st.items[i].a[j] = t.value; t.closest(".tvCard")?.classList.remove("bad"); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "qPublic") { st.public = t.checked; drawLists(); }
  if (t.id === "hideAlt") { st.hideAlt = t.checked; drawLists(); }
  if (t.id === "qCat") st.cat = cleanCat(t.value);
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "crSearch") runSearch();
});
addEventListener("beforeunload", (e) => {
  if (hasContent() && !st.saving) { e.preventDefault(); e.returnValue = ""; }
});

// ---- açılış: ?duzenle=<id> ----
(async function boot() {
  const params = new URLSearchParams(location.search);
  const id = params.get("duzenle") || "";
  if (params.get("tur") === "trivia" && !id) { st.kind = "trivia"; st.items = [blank()]; }
  drawAll();
  if (!id) return (st.kind === "trivia" ? $("#qName") : $("#crq")).focus();
  const localT = customLists().find((l) => l.id === id && l.kind === "trivia" && l.items?.length);
  if (localT) {
    Object.assign(st, { kind: "trivia", name: localT.name, desc: localT.desc || "", cat: localT.cat, emoji: localT.emoji, items: localT.items.map(toEditor), public: false, localId: localT.id });
    return drawAll();
  }
  const local = customLists().find((l) => l.id === id && l.tracks?.length);
  if (local) {
    Object.assign(st, { name: local.name, desc: local.desc || "", tracks: [...local.tracks], public: false, localId: local.id });
    return drawAll();
  }
  if (id.startsWith("nq-")) {
    const sel = app.querySelector("#crSel");
    if (sel) sel.innerHTML = `<p class="muted">${spinner()} Quiz yükleniyor…</p>`;
    try {
      const q = (await fetchCommunity()).find((x) => x.id === id && x.mine);
      if (!q) throw Error("Bu quiz bulunamadı ya da senin değil.");
      if (q.kind === "trivia") Object.assign(st, { kind: "trivia", name: q.name, desc: q.desc, author: q.author, cat: q.cat, emoji: q.emoji, items: q.items.map(toEditor), public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
      else Object.assign(st, { name: q.name, desc: q.desc, author: q.author, tracks: [...q.tracks], public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
    } catch (e) { fail(e); }
    drawAll();
  }
})();
