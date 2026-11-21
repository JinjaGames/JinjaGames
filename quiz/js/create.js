// JinjaQuiz: quiz oluşturma sayfası (/quiz/olustur/). Sanatçı ve şarkı araması ayrı sekmelerde;
// sanatçının popüler şarkıları ve tüm albümleri tek tek ya da topluca eklenebilir.
import { searchArtists, searchTracks, artistInfo, artistTop, artistAlbums, albumTracks, isAlternate, customLists, saveCustom, removeCustom, cleanTracks, fold, cdn } from "./music.js";
import { fetchCommunity, publishQuiz, removeQuiz, myPubkey, MIN_TRACKS, MAX_TRACKS } from "./community.js";

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
};
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
  app.innerHTML = `<div class="crGrid"><aside class="crSide">${sideHtml()}</aside>${mainHtml()}</div>`;
  $("#crTitle").textContent = st.d || st.localId ? "Quizi düzenle" : "Quiz oluştur";
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

// ---- olaylar ----
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  try {
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
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "qPublic") { st.public = t.checked; drawLists(); }
  if (t.id === "hideAlt") { st.hideAlt = t.checked; drawLists(); }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "crSearch") runSearch();
});
addEventListener("beforeunload", (e) => {
  if (st.tracks.length && !st.saving) { e.preventDefault(); e.returnValue = ""; }
});

// ---- açılış: ?duzenle=<id> ----
(async function boot() {
  const id = new URLSearchParams(location.search).get("duzenle") || "";
  drawAll();
  if (!id) return $("#crq").focus();
  const local = customLists().find((l) => l.id === id && l.tracks?.length);
  if (local) {
    Object.assign(st, { name: local.name, desc: local.desc || "", tracks: [...local.tracks], public: false, localId: local.id });
    return drawAll();
  }
  if (id.startsWith("nq-")) {
    app.querySelector("#crSel").innerHTML = `<p class="muted">${spinner()} Quiz yükleniyor…</p>`;
    try {
      const q = (await fetchCommunity()).find((x) => x.id === id && x.mine);
      if (!q) throw Error("Bu quiz bulunamadı ya da senin değil.");
      Object.assign(st, { name: q.name, desc: q.desc, author: q.author, tracks: [...q.tracks], public: true, d: q.d, prevAt: q.at, pubkey: q.pubkey });
    } catch (e) { fail(e); }
    drawAll();
  }
})();
