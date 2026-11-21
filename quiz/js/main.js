import { PRESETS, FEATURED, loadTracks, searchArtists, customLists, saveCustom, removeCustom, fold, cdn, loadPresetPictures, searchTracks, cleanTracks } from "./music.js";
import { fetchCommunity, publishQuiz, removeQuiz, hideQuiz, MIN_TRACKS, MAX_TRACKS } from "./community.js";
import { Game, MAX_PLAYERS } from "./engine.js";
import { hostRoom, guestRoom, newCode, validCode } from "./net.js";

// ---------- yardımcılar ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ic = (n, cls = "") =>
  `<i class="ic ${esc(cls)}" aria-hidden="true" style="--i:url(assets/icons/${/^[a-z0-9-]{1,32}$/.test(n) ? n : "music"}.svg)"></i>`;
const store = {
  get(k, d, s = localStorage) {
    try {
      return JSON.parse(s.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v, s = localStorage) {
    try {
      s.setItem(k, JSON.stringify(v));
    } catch {}
  },
  del(k, s = localStorage) {
    try {
      s.removeItem(k);
    } catch {}
  },
};
const uid = () => Math.random().toString(36).slice(2, 12);
const AVATARS = ["headphones", "guitar", "mic-vocal", "disc-3", "radio", "drum"];
const COLORS = ["coral", "violet", "mint", "gold", "sky", "rose"];
const LEVELS = { 5: "Kolay", 3: "Orta", 1: "Zor" };
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{1,30000}$/;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Kurucudan gelen oyun durumu (başka birinin tarayıcısı) tür tür süzülür: sayılar sayı, kimlikler
// güvenli karakter, adresler yalnızca Deezer CDN'i, profil parçaları izin listesinden.
const NUM = new Set(["pts", "count", "clip", "score", "round", "points", "ms", "index", "set", "seconds", "start", "end", "offset", "autoAt", "now"]);
const IDK = new Set(["id", "pid", "host", "me", "code"]);
function cleanView(x, k = "", depth = 0) {
  if (depth > 10) return null;
  if (Array.isArray(x)) return x.slice(0, 500).map((y) => cleanView(y, k, depth + 1));
  if (x && typeof x === "object") {
    const o = {};
    for (const [kk, v] of Object.entries(x).slice(0, 300)) {
      if (kk === "__proto__" || kk === "constructor" || kk === "prototype") continue;
      o[kk.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)] = cleanView(v, kk, depth + 1);
    }
    return o;
  }
  if (NUM.has(k)) return x == null ? null : num(x);
  if (IDK.has(k)) return String(x ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (k === "url" || k === "cover" || k === "picture") return cdn(x);
  if (k === "photo") return PHOTO.test(x || "") ? x : "";
  if (k === "avatar") return AVATARS.includes(x) ? x : "headphones";
  if (k === "color") return COLORS.includes(x) ? x : "coral";
  if (k === "art") return x === "hero" ? "hero" : "";
  if (typeof x === "string") return x.slice(0, 300);
  return typeof x === "number" || typeof x === "boolean" || x === null ? x : null;
}

const app = $("#app");
const sheet = $("#sheet");
const sheetBody = $("#sheetBody");

let profile = store.get("jqProfile", null);
const pid = store.get("jqPid", null, sessionStorage) || uid();
store.set("jqPid", pid, sessionStorage);

const ui = { genre: "Tümü", query: "", results: null, searching: false, community: null, communityErr: false };
let mode = null; // { role: "host"|"guest"|"solo", game?, net?, code }
let view = null; // oyuncuya özel oyun durumu
let lastSig = "";

// ---------- bildirim ----------
let toastT;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show " + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.className = ""), 3200);
}
const fail = (e) => toast(e?.message || String(e), "bad");

// ---------- profil ----------
function avatar(p, size = "") {
  const color = COLORS.includes(p.color) ? p.color : "coral";
  const av = AVATARS.includes(p.avatar) ? p.avatar : "headphones";
  return `<span class="av ${color} ${esc(size)}">${PHOTO.test(p.photo || "") ? `<img src="${esc(p.photo)}" alt="">` : ic(av)}</span>`;
}
function topbar() {
  const inRoom = mode && screen !== "room";
  $("#bar").innerHTML = `
    <a class="jg-back" href="/" title="JinjaGames ana sayfasına dön" aria-label="JinjaGames ana sayfasına dön"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg><img src="/favicon-j-shuriken-32.png" width="20" height="20" alt=""></a>
    <button class="brand" data-go="home" aria-label="JinjaQuiz ana sayfa"><span class="mark">${ic("audio-lines")}</span><b lang="en">JINJA</b><span lang="en">QUIZ</span></button>
    <div class="barEnd">
      ${inRoom ? `<button class="pill live" data-go="room">${ic("users")}<span>Lobiye dön</span></button>` : ""}
      <button class="meBtn" data-sheet="profile" aria-label="Profili düzenle">${avatar(profile || {})}<span>${esc(profile?.name || "Profil")}</span></button>
    </div>`;
}

// ---------- ses ----------
const audio = new Audio();
audio.preload = "auto";
const player = { url: null, qid: null, playing: false, stopT: null, startedAt: 0, clip: 0 };
function prime(url) {
  url = cdn(url);
  if (url && url !== player.url) {
    player.url = url;
    audio.src = url;
    audio.load();
  }
}
function stopClip() {
  clearTimeout(player.stopT);
  if (player.playing) audio.pause();
  player.playing = false;
  document.body.classList.remove("playing");
}
const playsKey = (qid) => "jqPlays:" + qid;
const playsUsed = (qid) => store.get(playsKey(qid), 0, sessionStorage);
async function listen(auto = false) {
  const q = view?.question;
  if (!q || view.phase !== "question" || !q.url || player.playing || q.mine) return;
  const now = hostNow();
  if (now < q.start || now >= q.end || playsUsed(q.id) >= 3) return;
  prime(q.url);
  try {
    if (audio.readyState < 1)
      await new Promise((res, rej) => {
        audio.addEventListener("loadedmetadata", res, { once: true });
        audio.addEventListener("error", () => rej(Error("Kesit yüklenemedi.")), { once: true });
        setTimeout(() => rej(Error("Kesit yüklenemedi.")), 8000);
      });
    audio.currentTime = q.offset;
    audio.volume = store.get("jqVolume", 0.9);
    await audio.play();
  } catch (e) {
    if (!auto) fail(e.name === "NotAllowedError" ? Error("Dinlemek için butona dokun.") : e);
    return;
  }
  store.set(playsKey(q.id), playsUsed(q.id) + 1, sessionStorage);
  player.playing = true;
  player.qid = q.id;
  player.startedAt = performance.now();
  player.clip = q.clip * 1000;
  document.body.classList.add("playing");
  player.stopT = setTimeout(() => {
    stopClip();
    paint();
  }, q.clip * 1000);
  paint();
}

// ---------- saat ----------
const hostNow = () => Date.now() + (mode?.role === "guest" ? mode.net.offset : 0);

// ---------- oturum ----------
function persist() {
  if (!mode || mode.role === "solo") return;
  store.set(
    "jqSession",
    { role: mode.role, code: mode.code, game: mode.role === "host" ? mode.game : null },
    sessionStorage,
  );
}
function onGame(game) {
  view = game.view(pid);
  mode.net?.sendState((p) => game.view(p));
  persist();
  render();
}
function startHost({ solo = false, restore = null } = {}) {
  if (!profile) return openSheet("profile", { then: () => startHost({ solo }) });
  const code = restore?.code || newCode();
  const game = restore
    ? Game.restore(restore, onGame)
    : new Game({ code, solo, host: { pid, profile }, onChange: onGame });
  mode = { role: solo ? "solo" : "host", game, code };
  if (!solo) {
    mode.net = hostRoom(code, {
      onHello(p, prof) {
        try {
          game.join(p, prof);
          game.emit();
          if (game.phase === "lobby") toast(`${prof?.name || "Bir oyuncu"} lobiye katıldı.`);
          return null;
        } catch (e) {
          return e.message;
        }
      },
      onAction: (p, a) => game.handle(p, a),
      onLeave(p) {
        game.setOnline(p, false);
        game.emit();
      },
    });
  }
  screen = "room";
  onGame(game);
  return game;
}
function startGuest(code) {
  if (!profile) return openSheet("profile", { then: () => startGuest(code) });
  leaveRoom(true);
  mode = { role: "guest", code, connecting: true, since: Date.now() };
  view = null;
  screen = "room";
  mode.net = guestRoom(code, pid, profile, {
    onState(s) {
      if (!s || typeof s !== "object") return;
      mode.connecting = false;
      mode.lost = false;
      view = cleanView(s);
      persist();
      render();
    },
    onDenied(reason) {
      leaveRoom(true);
      toast(reason, "bad");
    },
    onHostLost() {
      mode.lost = true;
      render();
    },
    onHostBack() {
      mode.lost = false;
      toast("Kurucu geri döndü.");
    },
  });
  persist();
  render();
}
function leaveRoom(silent = false) {
  stopClip();
  mode?.game && clearTimeout(mode.game.timer);
  mode?.net?.close();
  mode = null;
  view = null;
  store.del("jqSession", sessionStorage);
  history.replaceState(null, "", location.pathname);
  if (!silent || screen === "room") {
    screen = "home";
    render();
  }
}
async function act(a) {
  try {
    if (!mode) return;
    if (mode.role === "guest") await mode.net.act(a);
    else mode.game.handle(pid, a);
  } catch (e) {
    fail(e);
  }
}
function inviteLink() {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("oda", mode.code);
  return u.href;
}
async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    prompt("Kopyala:", text);
  }
}

// ---------- ekranlar ----------
let screen = "home";
function render() {
  topbar();
  if (screen === "room" && mode) return renderRoom();
  screen = "home";
  lastSig = "";
  renderHome();
}

function allLists() {
  return [...PRESETS, ...(ui.community || []), ...customLists().map((l) => ({ ...l, genre: "Senin" }))];
}
function cover(l, cls = "") {
  if (l?.art === "hero") return `<img class="${esc(cls)}" src="assets/art/hero.webp" alt="" loading="lazy">`;
  if (cdn(l?.picture)) return `<img class="${esc(cls)}" src="${esc(cdn(l.picture))}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  return `<span class="${esc(cls)} noart">${ic("disc-3")}</span>`;
}
function renderHome() {
  const q = fold(ui.query);
  const lists = allLists().filter(
    (l) => (ui.genre === "Tümü" || l.genre === ui.genre) && (!q || fold(l.name).includes(q)),
  );
  const mine = customLists().length;
  app.innerHTML = `
  <section class="hero">
    <div class="heroText">
      <span class="kicker">${ic("zap")} Kurulum yok · Tarayıcıda · ${MAX_PLAYERS} kişiye kadar</span>
      <h1>Şarkıyı<br><em>ilk sen</em> bil.</h1>
      <p>Bir saniyelik kesitten şarkıyı tahmin et. Lobi kur, bağlantıyı at, arkadaşların anında katılsın.</p>
      <div class="heroActions">
        <button class="btn primary lg" data-do="create">${ic("users")}Lobi kur</button>
        <button class="btn ghost lg" data-do="featured">${ic("play")}Hızlı solo</button>
      </div>
    </div>
    <form class="joinCard" id="joinForm" autocomplete="off">
      <span class="label">${ic("log-in")} Lobiye katıl</span>
      <input id="joinCode" maxlength="5" spellcheck="false" placeholder="KOD" aria-label="Lobi kodu" value="${esc(new URLSearchParams(location.search).get("oda") || "")}">
      <button class="btn primary" type="submit">Katıl ${ic("chevron-right")}</button>
      <small>Arkadaşının paylaştığı 5 haneli kodu yaz.</small>
    </form>
  </section>

  <button class="feature" data-list="${FEATURED.id}">
    <img src="assets/art/hero.webp" alt="">
    <span class="featureText">
      <span class="tag">${ic("flame")} Öne çıkan</span>
      <b>${esc(FEATURED.name)}</b>
      <span>${esc(FEATURED.blurb)}</span>
    </span>
    <span class="btn light">${ic("play")}Oyna</span>
  </button>

  <section class="catalog">
    <div class="catHead">
      <h2>Quiz seç</h2>
      <button class="btn primary sm createBtn" data-sheet="create">${ic("plus")}Quiz oluştur</button>
      <div class="seg chips" role="tablist">
        ${["Tümü", "Topluluk", "Rap", "Pop", "Rock", ...(mine ? ["Senin"] : [])]
          .map((g) => `<button role="tab" aria-selected="${ui.genre === g}" data-genre="${esc(g)}">${esc(g)}</button>`)
          .join("")}
      </div>
    </div>
    <form class="search" id="searchForm" role="search">
      ${ic("search")}
      <input id="search" type="search" placeholder="Herhangi bir sanatçıyı ara…" value="${esc(ui.query)}" aria-label="Sanatçı ara">
      <button class="btn soft" type="submit">Ara</button>
    </form>
    <div id="results">${resultsHtml()}</div>
    <div class="grid">
      ${lists
        .map(
          (l, i) => `<div class="card ${l.genre === "Topluluk" ? "community" : ""}" style="--i:${Math.min(i, 24)}">
          <button class="cardBtn" data-list="${esc(l.id)}">
            ${cover(l, "cardImg")}
            <span class="cardInfo"><b>${esc(l.name)}</b><small>${cardSub(l)}</small></span>
            <span class="cardPlay">${ic("play")}</span>
          </button>
          ${cardTools(l)}
        </div>`,
        )
        .join("")}
    </div>
    ${ui.genre === "Topluluk" && ui.community === null ? `<p class="empty">${spinner()} Topluluk quizleri yükleniyor…</p>` : ""}
    ${ui.genre === "Topluluk" && ui.communityErr ? `<p class="empty">Topluluk quizlerine şu an ulaşılamadı. Biraz sonra tekrar dene.</p>` : ""}
    ${ui.genre === "Topluluk" && ui.community?.length === 0 ? `<p class="empty">Henüz topluluk quizi yok. İlkini sen oluştur!</p>` : ""}
    ${!lists.length && !ui.results && ui.genre !== "Topluluk" ? `<p class="empty">Burada yok. Yukarıdan ara, binlerce sanatçı var.</p>` : ""}
  </section>
  <footer>Şarkı önizlemeleri ve sanatçı görselleri <a href="https://www.deezer.com" target="_blank" rel="noopener noreferrer">Deezer</a> kataloğundan gelir. Oyun verisi oyuncular arasında doğrudan (P2P) akar. · <a href="/">JinjaGames</a> · <a href="/apps/">Diğer web uygulamaları</a> · <a href="/privacy/">Gizlilik</a></footer>`;
}
function cardSub(l) {
  if (l.genre === "Topluluk") return `${ic("user")}${esc(l.author)} · ${l.tracks.length} şarkı`;
  if (l.tracks?.length) return `${esc(l.genre)} · ${l.tracks.length} şarkı`;
  return esc(l.genre);
}
function cardTools(l) {
  const btn = (attr, icon, label) => `<button class="icon sm" ${attr}="${esc(l.id)}" aria-label="${esc(label)}" title="${esc(label)}">${ic(icon)}</button>`;
  if (l.genre === "Topluluk")
    return `<span class="cardTools">${l.mine ? btn("data-edit", "sliders-horizontal", "Düzenle") + btn("data-unpublish", "trash-2", "Yayından kaldır") : btn("data-hidequiz", "x", "Bu quizi gizle")}</span>`;
  if (l.genre === "Senin")
    return `<span class="cardTools">${l.tracks?.length ? btn("data-edit", "sliders-horizontal", "Düzenle") : ""}${btn("data-unsave", "x", "Listeden kaldır")}</span>`;
  return "";
}
function resultsHtml() {
  if (ui.searching) return `<div class="results"><p class="muted">${spinner()} Aranıyor…</p></div>`;
  if (!ui.results) return "";
  if (!ui.results.length) return `<div class="results"><p class="muted">Sonuç yok. Yazımı kontrol et.</p></div>`;
  return `<div class="results"><p class="muted">Doğru sanatçıyı seç:</p><div class="hits">${ui.results
    .map(
      (a, i) =>
        `<button class="hit" data-hit="${i}"><img src="${esc(a.picture)}" alt="" loading="lazy"><b>${esc(a.name)}</b><small>${num(a.fans).toLocaleString("tr")} hayran</small></button>`,
    )
    .join("")}</div></div>`;
}
const spinner = () => `<span class="spin" aria-hidden="true"></span>`;

// ---- oda ekranları ----
function renderRoom() {
  if (mode.connecting || !view) {
    const long = Date.now() - mode.since > 15000;
    app.innerHTML = `<section class="center">
      <div class="pulse">${ic("radio")}</div>
      <h1>Lobiye bağlanılıyor</h1>
      <p class="muted">Kod <b class="mono">${esc(mode.code)}</b> · Kurucu aranıyor…</p>
      ${long ? `<p class="hint">Uzun sürüyorsa kodu kontrol et ve kurucunun sayfası açık mı sor. Bazı okul/iş ağları doğrudan bağlantıyı engelleyebilir.</p>` : ""}
      <button class="btn ghost" data-do="leave">Vazgeç</button>
    </section>`;
    lastSig = "";
    return;
  }
  const v = view;
  const sig = JSON.stringify({ ...v, now: 0, lost: mode.lost });
  if (sig === lastSig) return paint();
  // Yazılı cevap kutusundaki metni ve odağı koru.
  const typed = $("#guess")?.value || "";
  const focused = document.activeElement?.id === "guess";
  lastSig = sig;
  const prevQ = app.dataset.q;
  if (v.phase === "lobby") app.innerHTML = lobbyHtml(v);
  else if (["preparing", "question", "reveal"].includes(v.phase)) app.innerHTML = gameHtml(v);
  else app.innerHTML = rankingHtml(v);
  app.dataset.q = v.question?.id || "";
  animateCounts();
  if (v.question?.url) prime(v.question.url);
  if (v.phase !== "question" || v.question?.mine) stopClip();
  if ($("#guess")) {
    $("#guess").value = prevQ === app.dataset.q ? typed : "";
    if (focused || (window.matchMedia("(pointer:fine)").matches && v.phase === "question")) $("#guess").focus();
  }
  paint();
}

const isHost = () => view && view.host === view.me;
const playerMap = () => new Map(view.players.map((p) => [p.pid, p]));

function vchip(p, q, reveal, me) {
  const r = reveal ? q.reveal?.results?.[p.pid] : null;
  return `<span class="vchip ${p.pid === me ? "me" : ""}">${avatar(p, "xs")}<b>${esc(p.name)}</b>${r ? `<em class="${r.correct ? "good" : ""}">+${num(r.points)}</em>` : ""}</span>`;
}

function lobbyHtml(v) {
  const host = isHost();
  const solo = v.solo;
  return `
  ${mode.lost ? `<div class="banner">${spinner()} Kurucunun bağlantısı koptu, geri dönmesi bekleniyor…</div>` : ""}
  <section class="lobby">
    <div class="lobbyMain">
      <div class="roomHead">
        <div>
          <span class="kicker">${solo ? "Solo oyun" : "Lobi"}</span>
          <h1>${solo ? "Hazır mısın?" : host ? "Arkadaşlarını çağır" : "Kurucu hazırlanıyor"}</h1>
        </div>
        <button class="btn ghost sm" data-do="leaveask">${ic("door-open")}Ayrıl</button>
      </div>
      ${
        solo
          ? ""
          : `<div class="invite">
        <div class="codeBox"><small>Lobi kodu</small><b class="mono">${esc(v.code)}</b></div>
        <div class="inviteBtns">
          <button class="btn primary" data-do="link">${ic("copy")}Davet bağlantısı</button>
          <button class="btn soft" data-do="code">Kodu kopyala</button>
        </div>
      </div>`
      }
      <div class="block">
        <div class="blockHead"><h2>Quiz sırası</h2>${host ? `<button class="btn soft sm" data-sheet="picker">${ic("plus")}Quiz ekle</button>` : ""}</div>
        ${
          v.queue.length
            ? `<ol class="queue">${v.queue
                .map(
                  (s, i) => `<li>
              ${cover(s, "qImg")}
              <span class="qInfo"><b>${esc(s.name)}</b><small>${num(s.count)} soru · ${s.mode === "text" ? "Yazarak" : "Şıklı"} · ${LEVELS[s.clip] || ""} (${num(s.clip)} sn)</small></span>
              ${
                host
                  ? `<span class="qBtns">
                <button class="icon" data-move="${esc(s.id)}" data-dir="-1" ${i ? "" : "disabled"} aria-label="Yukarı">${ic("chevron-down", "up")}</button>
                <button class="icon" data-move="${esc(s.id)}" data-dir="1" ${i < v.queue.length - 1 ? "" : "disabled"} aria-label="Aşağı">${ic("chevron-down")}</button>
                <button class="icon" data-remove="${esc(s.id)}" aria-label="Kaldır">${ic("trash-2")}</button>
              </span>`
                  : ""
              }
            </li>`,
                )
                .join("")}</ol>`
            : `<button class="emptyQueue" ${host ? 'data-sheet="picker"' : "disabled"}>${ic("list-plus")}<span>${host ? "İlk quizi ekle" : "Kurucu henüz quiz eklemedi"}</span></button>`
        }
      </div>
      ${historyHtml(v, host)}
      <div class="block settings">
        <div class="setRow"><span>Cevap süresi</span>
          <div class="seg" ${host ? "" : "aria-disabled=true"}>${[10, 15, 20, 30, 45]
            .map((n) => `<button data-secs="${n}" aria-pressed="${v.seconds === n}" ${host ? "" : "disabled"}>${n} sn</button>`)
            .join("")}</div>
        </div>
        ${
          solo
            ? ""
            : `<label class="setRow toggle"><span>Sonuçtan sonra otomatik devam<small>Herkes cevaplayınca soru erken biter.</small></span>
          <input type="checkbox" data-auto ${v.autoNext ? "checked" : ""} ${host ? "" : "disabled"}><span class="sw"></span></label>`
        }
      </div>
    </div>
    ${
      solo
        ? ""
        : `<aside class="players block">
      <div class="blockHead"><h2>Oyuncular</h2><span class="count">${num(v.players.length)}/${MAX_PLAYERS}</span></div>
      ${v.history?.length ? `<p class="standHead">${ic("trophy")} Genel sıralama · ${v.history.length} quiz</p>` : ""}
      <ul class="${v.history?.length ? "standings" : ""}">${(v.history?.length ? [...v.players].sort((a, b) => num(b.score) - num(a.score)) : v.players)
        .map(
          (p, i) => `<li class="${p.online ? "" : "off"} ${p.pid === v.me ? "me" : ""}" style="--i:${i}">${v.history?.length ? `<span class="rank r${i + 1}">${i + 1}</span>` : ""}${avatar(p)}<b>${esc(p.name)}${p.pid === v.me ? " <small>(sen)</small>" : ""}</b>
          ${v.history?.length ? `<span class="pscore" data-count="${num(p.score)}">${num(p.score)}</span>` : ""}
          ${p.pid === v.host ? `<span class="crown" title="Kurucu">${ic("crown")}</span>` : host ? `<button class="icon sm" data-kick="${esc(p.pid)}" aria-label="${esc(p.name)} lobiden çıkar">${ic("x")}</button>` : ""}</li>`,
        )
        .join("")}</ul>
      ${v.players.length < 2 ? `<p class="hint">Bağlantıyı gönder; açan herkes buraya düşer.</p>` : ""}
    </aside>`
    }
  </section>
  <div class="dock">
    ${
      host
        ? `<button class="btn primary lg wide" data-do="start" ${v.queue.length ? "" : "disabled"}>${ic("play")}${v.queue.length ? "Oyunu başlat" : "Önce quiz ekle"}</button>`
        : `<p class="waiting">${spinner()} Kurucunun oyunu başlatması bekleniyor</p>`
    }
  </div>`;
}

function historyHtml(v, host) {
  if (v.solo || !v.history?.length) return "";
  const pm = playerMap();
  return `<div class="block history">
    <div class="blockHead"><h2>Oynanan quizler</h2>${host ? `<button class="btn ghost sm" data-do="reset">${ic("shuffle")}Puanları sıfırla</button>` : ""}</div>
    <ol class="hist">${[...v.history]
      .reverse()
      .map((h) => {
        const w = h.top?.[0];
        const wp = w && pm.get(w.pid);
        return `<li>${cover(h, "qImg")}<span class="qInfo"><b>${esc(h.name)}</b><small>${num(h.count)} soru${w ? ` · ${ic("crown")} ${esc(wp?.name || w.name)} <em>${num(w.pts)}</em>` : ""}</small></span>
          ${host ? `<button class="btn soft sm" data-requeue="${esc(h.id)}">${ic("list-plus")}Tekrar ekle</button>` : ""}</li>`;
      })
      .join("")}</ol>
  </div>`;
}

function gameHtml(v) {
  const q = v.question;
  const set = v.queue[v.set];
  const host = isHost();
  const pm = playerMap();
  const reveal = v.phase === "reveal";
  const meP = pm.get(v.me);
  const myRes = reveal ? q?.reveal?.results?.[v.me] : null;
  const myPts = meP ? num(v.solo ? meP.score : meP.round) : 0;
  const head = `<div class="gameBar">
      <span class="gq">${cover(set, "gImg")}<span><b>${esc(set.name)}</b><small>Soru ${num(v.index) + 1}/${num(set.count)} · ${LEVELS[set.clip] || ""} ${num(set.clip)} sn</small></span></span>
      <span class="gEnd">
        <span class="myScore ${myRes?.correct ? "up" : ""}" title="Bu quizdeki puanın"><b>${myPts}</b><small>puan</small>${myRes ? `<i class="plus ${myRes.correct ? "" : "zero"}">+${num(myRes.points)}</i>` : ""}</span>
        <span class="mini">${v.players
          .filter((p) => p.online)
          .map((p) => `<span class="dotAv ${q?.answered.includes(p.pid) ? "done" : ""}" title="${esc(p.name)}">${avatar(p, "xs")}</span>`)
          .join("")}</span>
        ${reveal ? "" : `<span class="timer" id="timer"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/><circle id="timerArc" cx="18" cy="18" r="16" pathLength="100"/></svg><b id="timerNum"></b></span>`}
      </span>
    </div>
    <div class="progress"><span style="width:${Math.min(100, ((num(v.index) + (reveal ? 1 : 0)) / Math.max(1, num(set.count))) * 100)}%"></span></div>`;
  if (v.phase === "preparing")
    return `<section class="game">${head}<div class="stage"><div class="pulse">${ic("headphones")}</div><h2>Sıradaki şarkı hazırlanıyor…</h2></div></section>`;

  const mine = q.mine;
  let stage;
  if (reveal) {
    const r = q.reveal.results[v.me];
    const verdict = r?.correct ? `<span class="verdict good">${ic("check")} +${num(r.points)}</span>` : r ? `<span class="verdict bad">${ic("x")} Yanlış</span>` : `<span class="verdict">${ic("timer")} Süre doldu</span>`;
    stage = `<div class="reveal">
      ${q.reveal.cover ? `<img class="art" src="${esc(q.reveal.cover)}" alt="">` : `<span class="art noart">${ic("disc-3")}</span>`}
      <div class="revealText">
        <small>Doğru cevap</small>
        <h2>${esc(q.reveal.title)}</h2>
        <p>${esc(q.reveal.artist)}${q.reveal.album && fold(q.reveal.album) !== fold(q.reveal.title) ? ` · ${esc(q.reveal.album)}` : ""}</p>
        ${verdict}
      </div>
    </div>`;
  } else {
    stage = `<div class="stage">
      <div class="countdown" id="countdown"></div>
      <button class="disc" data-do="listen" id="disc" aria-label="Kesiti dinle">
        <svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" pathLength="100"/><circle id="clipArc" cx="50" cy="50" r="47" pathLength="100"/></svg>
        <span class="eq"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="discIcon">${ic("play")}</span>
      </button>
      <div class="listenInfo"><b id="listenLabel">Kesiti dinle</b><span class="plays" id="plays"></span></div>
    </div>`;
  }

  let answers = "";
  if (q.mode === "choice") {
    answers = `<div class="answers">${q.options
      .map((o, i) => {
        const right = reveal && o === q.reveal.title;
        const picked = mine?.answer === o;
        const cls = right ? "right" : reveal && picked ? "wrong" : picked ? "picked" : "";
        const voters = Object.entries(q.votes)
          .filter(([, a]) => a === o)
          .map(([p]) => pm.get(p))
          .filter(Boolean);
        return `<button class="ans ${cls}" data-ans="${i}" ${reveal || mine ? "disabled" : ""}>
          <kbd>${i + 1}</kbd><span class="ansText">${esc(o)}</span>
          ${voters.length ? `<span class="voters">${voters.map((p) => vchip(p, q, reveal, v.me)).join("")}</span>` : ""}
        </button>`;
      })
      .join("")}</div>`;
  } else if (!reveal) {
    answers = mine
      ? `<div class="locked">${ic("check")} Cevabın: <b>${esc(mine.answer)}</b></div>`
      : `<form class="guess" id="guessForm" autocomplete="off"><input id="guess" maxlength="120" placeholder="Şarkının adını yaz…" aria-label="Şarkı adı" enterkeyhint="send"><button class="btn primary" type="submit">Gönder</button></form>`;
  } else {
    answers = `<div class="typed">${v.players
      .map((p) => {
        const r = q.reveal.results[p.pid];
        return r ? `<span class="${r.correct ? "right" : "wrong"}">${avatar(p, "xs")}<b>${esc(p.name)}</b><span class="said">${esc(r.answer)}</span><em>+${num(r.points)}</em></span>` : "";
      })
      .join("")}</div>`;
  }

  let foot = "";
  if (reveal && !v.solo) {
    const rows = [...v.players]
      .map((p) => ({ p, r: q.reveal.results[p.pid] }))
      .sort((a, b) => num(b.r?.points) - num(a.r?.points) || num(b.p.round) - num(a.p.round));
    foot = `<div class="block board"><div class="blockHead"><h2>Bu soru</h2><small class="muted">Quiz toplamı</small></div>${rows
      .map(
        ({ p, r }, i) => `<div class="row ${p.pid === v.me ? "me" : ""}" style="--i:${i}">${avatar(p, "sm")}<span class="rowName"><b>${esc(p.name)}</b>
        <span class="meter"><span style="width:${Math.min(100, num(r?.points))}%"></span></span></span>
        <span class="pts ${r?.correct ? "good" : ""}">${r?.correct ? "+" + num(r.points) : r ? "0" : "—"}${r?.correct ? `<small>${(num(r.ms) / 1000).toFixed(1)} sn</small>` : ""}</span><b class="tot" data-count="${num(p.round)}">${num(p.round)}</b></div>`,
      )
      .join("")}</div>`;
  }
  const answeredCount = q.answered.length;
  const online = v.players.filter((p) => p.online).length;
  const dock = reveal
    ? host
      ? `<button class="btn primary lg wide" data-do="next" id="nextBtn">${v.index + 1 >= set.count ? "Sonuçları gör" : "Sonraki soru"} ${ic("chevron-right")}</button>`
      : `<p class="waiting" id="autoInfo">${spinner()} Sıradaki soru birazdan</p>`
    : `<p class="waiting">${mine ? `${ic("check")} Cevabın kilitlendi · ` : ""}${v.solo ? "" : `${answeredCount}/${online} cevapladı`}</p>${
        host ? `<button class="btn ghost sm" data-do="skip">${ic("skip-forward")}${v.solo ? "Pas" : "Süreyi bitir"}</button>` : ""
      }`;
  return `${mode.lost ? `<div class="banner">${spinner()} Kurucunun bağlantısı koptu, bekleniyor…</div>` : ""}
    <section class="game ${reveal ? "isReveal" : ""}">${head}${stage}${answers}${foot}</section>
    <div class="dock split">${dock}</div>`;
}

function rankingHtml(v) {
  const final = v.phase === "done";
  const host = isHost();
  const set = v.queue[v.set];
  if (v.solo) {
    const ps = v.players;
    const maxQ = v.queue.slice(0, v.set + 1).reduce((s, x) => s + num(x.count), 0) * 100;
    const sc = num(ps[0]?.score);
    return `<section class="ranking">
      <span class="kicker">${final ? "Oyun bitti" : esc(set?.name || "") + " bitti"}</span>
      <h1><span data-count="${sc}">${sc}</span> <small>/ ${num(maxQ)} puan</small></h1>
      <p class="muted">${sc >= maxQ * 0.7 ? "Kulağın keskin!" : sc >= maxQ * 0.4 ? "Fena değil, bir tur daha?" : "Isınma turuydu sayalım."}</p>
      ${sc >= maxQ * 0.7 ? confetti() : ""}
    </section>
    <div class="dock split">${
      final
        ? `<button class="btn primary lg" data-do="again">${ic("shuffle")}Tekrar oyna</button><button class="btn ghost lg" data-do="leave">Ana sayfa</button>`
        : `<button class="btn primary lg wide" data-do="next">Sıradaki quiz: ${esc(v.queue[v.set + 1]?.name || "")} ${ic("chevron-right")}</button>`
    }</div>`;
  }
  // Bu quizin sıralaması: yalnızca bu quizde toplanan puan (round).
  const ps = [...v.players].sort((a, b) => num(b.round) - num(a.round));
  const podium = [ps[1], ps[0], ps[2]];
  const total = [...v.players].sort((a, b) => num(b.score) - num(a.score));
  const showTotal = (v.history?.length || 0) > 1;
  return `<section class="ranking">
    ${confetti()}
    <span class="kicker">${esc(set?.name || "Quiz")} bitti</span>
    <h1>Quiz sıralaması</h1>
    <div class="podium">${podium
      .map((p, i) =>
        p
          ? `<div class="pod p${[2, 1, 3][i]} ${p.pid === v.me ? "me" : ""}">${[2, 1, 3][i] === 1 ? `<span class="crownTop">${ic("crown")}</span>` : ""}${avatar(p, "lg")}<b>${esc(p.name)}</b><span data-count="${num(p.round)}">${num(p.round)}</span><div class="step">${[2, 1, 3][i]}</div></div>`
          : `<div class="pod empty"></div>`,
      )
      .join("")}</div>
    ${ps.length > 3 ? `<ol class="list">${ps.slice(3).map((p, i) => `<li class="${p.pid === v.me ? "me" : ""}" style="--i:${i}">${i + 4}. ${avatar(p, "sm")}<b>${esc(p.name)}</b><span>${num(p.round)}</span></li>`).join("")}</ol>` : ""}
    ${
      showTotal
        ? `<div class="totals"><h2>${ic("trophy")} Genel sıralama <small>${num(v.history.length)} quiz</small></h2><ol class="list">${total
            .map((p, i) => `<li class="${p.pid === v.me ? "me" : ""}" style="--i:${i}"><span class="rank r${i + 1}">${i + 1}</span>${avatar(p, "sm")}<b>${esc(p.name)}</b><span data-count="${num(p.score)}">${num(p.score)}</span></li>`)
            .join("")}</ol></div>`
        : ""
    }
  </section>
  <div class="dock split">
    ${
      host
        ? final
          ? `<button class="btn primary lg" data-do="tolobby">${ic("users")}Lobiye dön</button><button class="btn ghost lg" data-do="leaveask">${ic("door-open")}Lobiyi kapat</button>`
          : `<button class="btn primary lg wide" data-do="next">Sıradaki quiz: ${esc(v.queue[v.set + 1]?.name || "")} ${ic("chevron-right")}</button>`
        : final
          ? `<p class="waiting">${spinner()} Kurucu lobiye dönünce yeni quizlerle devam edebilirsiniz</p><button class="btn ghost" data-do="leaveask">Ayrıl</button>`
          : `<p class="waiting">${spinner()} Kurucu sıradaki quizi başlatacak</p>`
    }
  </div>`;
}

function confetti() {
  const colors = ["#ff5b3a", "#ffc23d", "#34d67f", "#5aa0ff", "#c78bff", "#ff8a5c"];
  let out = "";
  for (let i = 0; i < 46; i++)
    out += `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 1.6).toFixed(2)}s;--t:${(2.2 + Math.random() * 1.8).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--c:${colors[i % colors.length]}"></i>`;
  return `<div class="confetti" aria-hidden="true">${out}</div>`;
}

// Puanlar ekrana gelirken sıfırdan sayarak yükselir.
function animateCounts(root = app) {
  if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll("[data-count]").forEach((el) => {
    const to = num(el.dataset.count);
    if (!to || el.dataset.done) return;
    el.dataset.done = 1;
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------- canlı boyama (zamanlayıcılar, dinleme halkası) ----------
let autoPlayedFor = null;
function paint() {
  if (screen !== "room" || !view?.question) return;
  const q = view.question;
  const now = hostNow();
  if (view.phase === "question") {
    const left = Math.max(0, q.end - now);
    const pre = now < q.start;
    const num = $("#timerNum");
    if (num) {
      num.textContent = pre ? "" : Math.ceil(left / 1000);
      $("#timerArc").style.strokeDashoffset = pre ? 0 : 100 - (left / (q.end - q.start)) * 100;
      $("#timer").classList.toggle("hurry", !pre && left < 5000);
    }
    const cd = $("#countdown");
    if (cd) {
      cd.textContent = pre ? Math.ceil((q.start - now) / 1000) : "";
      cd.classList.toggle("on", pre);
    }
    const used = playsUsed(q.id);
    const disc = $("#disc");
    if (disc) {
      const can = !pre && left > 0 && used < 3 && !q.mine && !player.playing;
      disc.disabled = !can && !player.playing;
      disc.classList.toggle("on", player.playing && player.qid === q.id);
      $("#listenLabel").textContent = player.playing
        ? "Çalıyor…"
        : q.mine
          ? "Cevap verildi"
          : pre
            ? "Hazırlan"
            : used >= 3
              ? "Dinleme hakkın bitti"
              : used
                ? "Tekrar dinle"
                : "Kesiti dinle";
      $("#plays").innerHTML = [0, 1, 2].map((i) => `<i class="${i < 3 - used ? "on" : ""}"></i>`).join("");
      const arc = $("#clipArc");
      if (arc)
        arc.style.strokeDashoffset = player.playing
          ? 100 - Math.min(100, ((performance.now() - player.startedAt) / player.clip) * 100)
          : 100;
    }
    $$("[data-ans], #guessForm button, #guess").forEach((b) => (b.disabled = !!q.mine || pre || left <= 0));
    // Soru açılır açılmaz ilk dinlemeyi otomatik başlat (tarayıcı izin verirse).
    if (!pre && autoPlayedFor !== q.id && !q.mine && store.get("jqAutoplay", true)) {
      autoPlayedFor = q.id;
      if (playsUsed(q.id) === 0) listen(true);
    }
  } else if (view.phase === "reveal") {
    const n = $("#nextBtn") || $("#autoInfo");
    if (n && q.autoAt) {
      const s = Math.max(0, Math.ceil((q.autoAt - now) / 1000));
      const label = n.id === "nextBtn" ? n.firstChild : null;
      if (label) label.textContent = `${view.index + 1 >= view.queue[view.set].count ? "Sonuçları gör" : "Sonraki soru"} · ${s} `;
      else n.innerHTML = `${spinner()} Sıradaki soru ${s} sn içinde`;
    }
  }
}
(function loop() {
  paint();
  requestAnimationFrame(loop);
})();
setInterval(() => {
  if (mode?.connecting && Date.now() - mode.since > 15000 && !$(".hint")) render();
}, 1000);

// ---------- alt sayfalar (sheet) ----------
let sheetCtx = {};
function openSheet(kind, ctx = {}) {
  sheetCtx = { kind, ...ctx };
  sheet.dataset.kind = kind;
  if (kind === "profile") profileSheet();
  if (kind === "picker") pickerSheet();
  if (kind === "setup") setupSheet();
  if (kind === "create") createSheet();
  if (kind === "leave") {
    sheetBody.innerHTML = `<div class="sheetHead"><h2>Lobiden ayrılsın mı?</h2></div>
      <p class="muted">${isHost() && !view?.solo ? "Kurucu sensin; ayrılırsan oyun herkes için biter." : "Puanın bu lobide kalır, kodla geri dönebilirsin."}</p>
      <div class="sheetFoot"><button class="btn ghost" data-close>Vazgeç</button><button class="btn danger" data-do="leave">${ic("door-open")}Ayrıl</button></div>`;
  }
  if (!sheet.open) sheet.showModal();
}
function closeSheet() {
  if (sheet.open) sheet.close();
}
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) closeSheet();
});

function profileSheet() {
  const ed = (sheetCtx.ed ??= { name: "", avatar: "headphones", color: "coral", photo: "", ...(profile || {}) });
  sheetBody.innerHTML = `<div class="sheetHead"><h2>${profile ? "Profilin" : "Önce adını seç"}</h2>${profile ? `<button class="icon" data-close aria-label="Kapat">${ic("x")}</button>` : ""}</div>
    <div class="profPreview">${avatar(ed, "xl")}</div>
    <label class="field"><span>Oyuncu adı</span><input id="pName" maxlength="20" value="${esc(ed.name)}" placeholder="Takma adın" autocomplete="nickname"></label>
    <div class="field"><span>Simge</span><div class="pick">${AVATARS.map((a) => `<button data-pav="${a}" aria-pressed="${!ed.photo && ed.avatar === a}">${avatar({ ...ed, avatar: a, photo: "" })}</button>`).join("")}
      <label class="upload" title="Fotoğraf yükle">${ed.photo ? avatar(ed) : ic("plus")}<input type="file" id="pPhoto" accept="image/*" hidden></label></div></div>
    <div class="field"><span>Renk</span><div class="pick colors">${COLORS.map((c) => `<button data-pcol="${c}" class="sw ${c}" aria-pressed="${ed.color === c}" aria-label="${c}"></button>`).join("")}</div></div>
    <div class="sheetFoot"><button class="btn primary wide" data-do="saveProfile">${ic("check")}Kaydet</button></div>`;
  setTimeout(() => !profile && $("#pName")?.focus(), 50);
}
async function resizePhoto(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const s = Math.min(img.width, img.height);
    c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
    return c.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- quiz oluştur / düzenle ----
function createSheet() {
  const dr = (sheetCtx.draft ??= { name: "", desc: "", tracks: [], public: true });
  sheetBody.innerHTML = `<div class="sheetHead"><h2>${dr.d || dr.localId ? "Quizi düzenle" : "Quiz oluştur"}</h2><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
    <label class="field"><span>Quiz adı</span><input id="qName" maxlength="60" value="${esc(dr.name)}" placeholder="Örn. 2010'ların Türkçe pop hitleri" autocomplete="off"></label>
    <label class="field"><span>Kısa açıklama <small class="muted">(isteğe bağlı)</small></span><input id="qDesc" maxlength="160" value="${esc(dr.desc)}" placeholder="Bu quiz ne hakkında?" autocomplete="off"></label>
    <div class="field"><span>Şarkı ekle</span>
      <form class="search" id="trackSearch" autocomplete="off">${ic("search")}<input id="tsq" type="search" placeholder="Şarkı ya da sanatçı ara…" value="${esc(dr.q || "")}"><button class="btn soft" type="submit">Ara</button></form>
      <div id="tsRes" class="tsRes">${tsResHtml()}</div>
    </div>
    <div class="field"><span>Quizdeki şarkılar <b id="selN">${dr.tracks.length}</b>/${MAX_TRACKS} <small class="muted">(en az ${MIN_TRACKS})</small></span><div id="selList" class="selList">${selHtml()}</div></div>
    <label class="setRow toggle"><span>Herkese açık yayınla<small>Topluluk sekmesinde herkes görür ve oynar. Yazar olarak "${esc(profile?.name || "Anonim")}" görünür.</small></span>
      <input type="checkbox" id="qPublic" ${dr.public ? "checked" : ""}><span class="sw"></span></label>
    <div class="sheetFoot"><button class="btn primary wide" data-do="saveQuiz">${ic("check")}${dr.public ? "Yayınla" : "Kaydet"}</button></div>`;
}
function tsResHtml() {
  const dr = sheetCtx.draft;
  if (dr.searching) return `<p class="muted">${spinner()} Aranıyor…</p>`;
  if (!dr.res) return "";
  if (!dr.res.length) return `<p class="muted">Sonuç yok.</p>`;
  const have = new Set(dr.tracks.map((t) => t.id));
  const artists = [...new Map(dr.res.filter((t) => t.artistId).map((t) => [t.artistId, t.artist])).entries()].slice(0, 3);
  return `${artists.length ? `<div class="artistAdd">${artists.map(([id, name]) => `<button class="chipBtn" data-addartist="${num(id)}">${ic("list-plus")}${esc(name)}: popüler 15 şarkı</button>`).join("")}</div>` : ""}
    <div class="tsList">${dr.res
      .map((t, i) => `<button class="tsHit ${have.has(t.id) ? "on" : ""}" data-addt="${i}">${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}<span><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span>${ic(have.has(t.id) ? "check" : "plus")}</button>`)
      .join("")}</div>`;
}
function selHtml() {
  const dr = sheetCtx.draft;
  if (!dr.tracks.length) return `<p class="muted">Henüz şarkı yok. Yukarıdan ara ve ekle.</p>`;
  return dr.tracks
    .map((t, i) => `<div class="selRow">${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : `<span class="noart">${ic("disc-3")}</span>`}<span><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span><button class="icon sm" data-delt="${i}" aria-label="Çıkar">${ic("x")}</button></div>`)
    .join("");
}
function redrawCreate() {
  if (sheetCtx.kind !== "create") return;
  $("#tsRes") && ($("#tsRes").innerHTML = tsResHtml());
  $("#selList") && ($("#selList").innerHTML = selHtml());
  $("#selN") && ($("#selN").textContent = sheetCtx.draft.tracks.length);
}
function addTracks(list) {
  const dr = sheetCtx.draft;
  const have = new Set(dr.tracks.map((t) => t.id));
  for (const t of list) if (!have.has(t.id) && dr.tracks.length < MAX_TRACKS) (dr.tracks.push(t), have.add(t.id));
  redrawCreate();
}
async function saveQuiz(btn) {
  const dr = sheetCtx.draft;
  dr.name = $("#qName").value.trim();
  dr.desc = $("#qDesc").value.trim();
  dr.public = $("#qPublic").checked;
  if (!dr.name) return $("#qName").focus(), toast("Quize bir ad ver.", "bad");
  const titles = new Set(dr.tracks.map((t) => fold(t.title)));
  if (dr.tracks.length < MIN_TRACKS || titles.size < 4) return toast(`En az ${MIN_TRACKS} farklı şarkı ekle.`, "bad");
  btn.disabled = true;
  btn.innerHTML = `${spinner()} ${dr.public ? "Yayınlanıyor…" : "Kaydediliyor…"}`;
  try {
    const tracks = cleanTracks(dr.tracks);
    if (dr.public) {
      const q = await publishQuiz({ d: dr.d, name: dr.name, desc: dr.desc, author: profile?.name || "Anonim", tracks, prevAt: ui.community?.find((x) => x.d === dr.d && x.mine)?.at || 0 });
      ui.community = [q, ...(ui.community || []).filter((x) => x.id !== q.id)];
      if (dr.localId) removeCustom(dr.localId);
      toast("Quiz yayınlandı! Topluluk sekmesinde herkes görebilir.");
      ui.genre = "Topluluk";
    } else {
      if (dr.d) {
        const old = ui.community?.find((x) => x.d === dr.d && x.mine);
        if (old) await removeQuiz(old).catch(() => {});
        ui.community = (ui.community || []).filter((x) => x.d !== dr.d);
      }
      saveCustom({ id: dr.localId || "my" + uid(), name: dr.name, picture: tracks.find((t) => t.cover)?.cover || "", artists: [], tracks, genre: "Senin" });
      toast("Quiz bu tarayıcıya kaydedildi.");
      ui.genre = "Senin";
    }
    closeSheet();
    if (!mode) renderHome();
  } catch (e) {
    fail(e);
    btn.disabled = false;
    btn.innerHTML = `${ic("check")}${dr.public ? "Yayınla" : "Kaydet"}`;
  }
}
async function loadCommunity() {
  try {
    ui.community = await fetchCommunity();
    ui.communityErr = false;
  } catch {
    ui.community = [];
    ui.communityErr = true;
  }
  if (screen === "home" && !mode && !sheet.open) renderHome();
}

function pickerSheet() {
  const lists = [FEATURED, ...allLists()];
  sheetBody.innerHTML = `<div class="sheetHead"><h2>Quiz ekle</h2><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
    <form class="search" id="pickSearch">${ic("search")}<input id="pickQ" type="search" placeholder="Başka sanatçı ara…"><button class="btn soft" type="submit">Ara</button></form>
    <div id="pickResults"></div>
    <div class="pickGrid">${lists
      .map((l) => `<button class="pickItem" data-list="${esc(l.id)}">${cover(l, "pImg")}<b>${esc(l.name)}</b></button>`)
      .join("")}</div>`;
}

async function setupSheet() {
  const l = sheetCtx.list;
  const enqueue = mode && mode.role !== "solo" && isHost();
  sheetBody.innerHTML = `<div class="sheetHead setupHead">${cover(l, "sImg")}<div><small class="kicker">${esc(l.genre || "Quiz")}</small><h2>${esc(l.name)}</h2><small class="muted" id="trackCount">${spinner()} Şarkılar yükleniyor…</small></div><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
    <div class="opts">
      <div class="opt"><span>Soru sayısı</span><div class="seg" data-opt="count">${[5, 10, 15, 20, 30].map((n) => `<button data-v="${n}" aria-pressed="${sheetCtx.count === n}">${n}</button>`).join("")}</div></div>
      <div class="opt"><span>Cevap</span><div class="seg" data-opt="mode"><button data-v="choice" aria-pressed="${sheetCtx.mode === "choice"}">Şıklı</button><button data-v="text" aria-pressed="${sheetCtx.mode === "text"}">Yazarak</button></div></div>
      <div class="opt"><span>Kesit uzunluğu</span><div class="seg" data-opt="clip">${[5, 3, 1].map((n) => `<button data-v="${n}" aria-pressed="${sheetCtx.clip === n}">${LEVELS[n]} · ${n} sn</button>`).join("")}</div></div>
    </div>
    <details class="tracks" id="tracksBox"><summary>${ic("list-music")} Şarkıları seç <span id="selCount"></span></summary><div id="trackList"><p class="muted">${spinner()}</p></div></details>
    <div class="sheetFoot">${
      enqueue
        ? `<button class="btn primary wide" data-do="enqueue" disabled>${ic("list-plus")}Sıraya ekle</button>`
        : `<button class="btn ghost" data-do="soloGo" disabled>${ic("play")}Solo oyna</button><button class="btn primary" data-do="hostGo" disabled>${ic("users")}Arkadaşlarla oyna</button>`
    }</div>`;
  try {
    const tracks = await loadTracks(l);
    if (sheetCtx.list !== l || !sheet.open) return;
    sheetCtx.tracks = tracks;
    sheetCtx.ids ??= new Set(tracks.map((t) => t.id));
    $("#trackCount").textContent = `${tracks.length} şarkı`;
    drawTracks();
    $$(".sheetFoot .btn").forEach((b) => (b.disabled = false));
  } catch (e) {
    $("#trackCount").textContent = e.message;
    $("#trackList").innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}
function drawTracks() {
  const { tracks, ids } = sheetCtx;
  $("#selCount").textContent = `${ids.size}/${tracks.length}`;
  $("#trackList").innerHTML = `<div class="trackTools"><input type="search" id="trackQ" placeholder="Listede ara"><button class="btn soft sm" data-tracks="all">Tümü</button><button class="btn soft sm" data-tracks="none">Hiçbiri</button></div>
    <div class="trackRows">${tracks
      .map((t) => `<label data-t="${esc(fold(t.title))}"><input type="checkbox" data-tid="${num(t.id)}" ${ids.has(t.id) ? "checked" : ""}><span>${esc(t.title)}</span>${t.artist && fold(t.artist) !== fold(sheetCtx.list.name) ? `<small>${esc(t.artist)}</small>` : ""}</label>`)
      .join("")}</div>`;
}
function setupPayload() {
  const { list, tracks, ids, count, mode: m, clip } = sheetCtx;
  if (!tracks) throw Error("Şarkılar henüz yüklenmedi.");
  if (!ids.size) throw Error("En az bir şarkı seç.");
  return {
    type: "add",
    list: { name: list.name, art: list.art || "", picture: list.picture || "" },
    tracks,
    ids: ids.size === tracks.length ? null : [...ids],
    count,
    mode: m,
    clip,
  };
}
function openList(id) {
  const l = id === FEATURED.id ? FEATURED : allLists().find((x) => String(x.id) === String(id));
  if (!l) return;
  const last = store.get("jqSetup", {});
  openSheet("setup", { list: l, count: last.count || 10, mode: last.mode || "choice", clip: last.clip || 3 });
}

// ---------- olaylar ----------
async function doAction(a, el) {
  switch (a) {
    case "create":
      return startHost();
    case "featured":
      openList(FEATURED.id);
      return;
    case "leave":
      closeSheet();
      return leaveRoom();
    case "leaveask":
      return openSheet("leave");
    case "link":
      return copy(inviteLink(), "Davet bağlantısı kopyalandı. Arkadaşlarına gönder!");
    case "code":
      return copy(mode.code, "Kod kopyalandı.");
    case "start":
      return act({ type: "start" });
    case "next":
      return act({ type: "next" });
    case "skip":
      return act({ type: "skip" });
    case "again":
      return act({ type: "again" });
    case "tolobby":
      return act({ type: "lobby" });
    case "reset":
      return act({ type: "reset" });
    case "saveQuiz":
      return saveQuiz(el);
    case "listen":
      return listen();
    case "saveProfile": {
      const ed = sheetCtx.ed;
      ed.name = $("#pName").value.trim();
      if (!ed.name) {
        $("#pName").focus();
        return toast("Bir ad yaz.", "bad");
      }
      profile = { name: ed.name, avatar: ed.avatar, color: ed.color, photo: ed.photo };
      store.set("jqProfile", profile);
      const then = sheetCtx.then;
      closeSheet();
      topbar();
      if (mode) toast("Profil kaydedildi. Yeni lobilerde görünecek.");
      then?.();
      return;
    }
    case "enqueue":
    case "soloGo":
    case "hostGo": {
      const payload = setupPayload();
      store.set("jqSetup", { count: payload.count, mode: payload.mode, clip: payload.clip });
      closeSheet();
      if (a === "enqueue") return act(payload);
      if (mode) leaveRoom(true);
      const game = startHost({ solo: a === "soloGo" });
      if (!game) return; // önce profil
      game.handle(pid, payload);
      if (a === "soloGo") game.handle(pid, { type: "start" });
      return;
    }
  }
}

async function runSearch(q, target) {
  q = q.trim();
  if (q.length < 2) return;
  ui.searching = true;
  const paintRes = () => {
    if (target === "home") $("#results") && ($("#results").innerHTML = resultsHtml());
    else $("#pickResults") && ($("#pickResults").innerHTML = resultsHtml());
  };
  paintRes();
  try {
    ui.results = await searchArtists(q);
  } catch (e) {
    ui.results = null;
    fail(e);
  }
  ui.searching = false;
  paintRes();
}
function pickHit(i) {
  const a = ui.results?.[i];
  if (!a) return;
  const list = { id: "dz" + a.id, name: a.name, picture: a.picture, artists: [a.id], genre: "Senin" };
  saveCustom(list);
  ui.results = null;
  if (screen === "home" && !sheet.open) renderHome();
  const last = store.get("jqSetup", {});
  openSheet("setup", { list, count: last.count || 10, mode: last.mode || "choice", clip: last.clip || 3 });
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button, [data-close]");
  if (!b || b.disabled) return;
  const d = b.dataset;
  try {
    if ("close" in d) return closeSheet();
    if (d.go) {
      screen = d.go === "room" && mode ? "room" : "home";
      lastSig = "";
      return render();
    }
    if (d.sheet) return openSheet(d.sheet);
    if (d.do) return await doAction(d.do, b);
    if (d.list) return openList(d.list);
    if (d.genre) {
      ui.genre = d.genre;
      if (d.genre === "Topluluk" && (ui.communityErr || ui.community?.length === 0)) (ui.community = null), loadCommunity();
      return renderHome();
    }
    if (d.requeue) return act({ type: "requeue", id: d.requeue });
    if (d.edit) {
      const l = allLists().find((x) => String(x.id) === d.edit);
      if (!l?.tracks) return;
      return openSheet("create", { draft: { name: l.name, desc: l.desc || "", tracks: [...l.tracks], public: l.genre === "Topluluk", d: l.genre === "Topluluk" ? l.d : undefined, localId: l.genre === "Senin" ? l.id : undefined } });
    }
    if (d.unpublish) {
      const l = ui.community?.find((x) => x.id === d.unpublish && x.mine);
      if (!l || !confirm(`"${l.name}" yayından kaldırılsın mı? Başkaları artık göremez.`)) return;
      await removeQuiz(l);
      ui.community = ui.community.filter((x) => x !== l);
      toast("Quiz yayından kaldırıldı.");
      return renderHome();
    }
    if (d.hidequiz) {
      hideQuiz(d.hidequiz);
      ui.community = (ui.community || []).filter((x) => x.id !== d.hidequiz);
      toast("Bu quiz artık sana gösterilmeyecek.");
      return renderHome();
    }
    if (d.addt !== undefined) {
      const t = sheetCtx.draft?.res?.[Number(d.addt)];
      if (!t) return;
      const dr = sheetCtx.draft;
      const at = dr.tracks.findIndex((x) => x.id === t.id);
      if (at >= 0) dr.tracks.splice(at, 1);
      else addTracks([t]);
      return redrawCreate();
    }
    if (d.addartist) {
      b.disabled = true;
      try {
        const top = await loadTracks({ artists: [Number(d.addartist)] });
        addTracks(top.slice(0, 15));
        toast(`${Math.min(15, top.length)} şarkı eklendi.`);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (d.delt !== undefined) {
      sheetCtx.draft.tracks.splice(Number(d.delt), 1);
      return redrawCreate();
    }
    if (d.unsave) {
      removeCustom(d.unsave);
      return renderHome();
    }
    if (d.hit) return pickHit(Number(d.hit));
    if (d.ans !== undefined) {
      const q = view.question;
      return act({ type: "answer", q: q.id, answer: q.options[Number(d.ans)] });
    }
    if (d.secs) return act({ type: "settings", seconds: Number(d.secs) });
    if (d.remove) return act({ type: "remove", id: d.remove });
    if (d.move) return act({ type: "move", id: d.move, dir: Number(d.dir) });
    if (d.kick) {
      if (mode.role === "host") mode.net.kick(d.kick);
      return act({ type: "kick", pid: d.kick });
    }
    if (d.pav) {
      Object.assign(sheetCtx.ed, { avatar: d.pav, photo: "", name: $("#pName").value });
      return profileSheet();
    }
    if (d.pcol) {
      Object.assign(sheetCtx.ed, { color: d.pcol, name: $("#pName").value });
      return profileSheet();
    }
    if (d.v && b.parentElement.dataset.opt) {
      const k = b.parentElement.dataset.opt;
      sheetCtx[k] = k === "mode" ? d.v : Number(d.v);
      $$("button", b.parentElement).forEach((x) => x.setAttribute("aria-pressed", x === b));
      return;
    }
    if (d.tracks) {
      const vis = $$(".trackRows label").filter((l) => !l.hidden);
      for (const l of vis) {
        const id = Number(l.querySelector("input").dataset.tid);
        if (d.tracks === "all") sheetCtx.ids.add(id);
        else sheetCtx.ids.delete(id);
      }
      const q = $("#trackQ").value;
      drawTracks();
      $("#trackQ").value = q;
      filterTracks(q);
      return;
    }
  } catch (err) {
    fail(err);
  }
});
function filterTracks(q) {
  const f = fold(q);
  $$(".trackRows label").forEach((l) => (l.hidden = f && !l.dataset.t.includes(f)));
}
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "search") {
    ui.query = t.value;
    const pos = t.selectionStart;
    if (!t.value) ui.results = null;
    renderHome();
    const s = $("#search");
    s.focus();
    s.setSelectionRange(pos, pos);
  }
  if (t.id === "trackQ") filterTracks(t.value);
  if (t.id === "qName" && sheetCtx.draft) sheetCtx.draft.name = t.value;
  if (t.id === "qDesc" && sheetCtx.draft) sheetCtx.draft.desc = t.value;
  if (t.id === "joinCode") t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.dataset.tid) {
      const id = Number(t.dataset.tid);
      t.checked ? sheetCtx.ids.add(id) : sheetCtx.ids.delete(id);
      $("#selCount").textContent = `${sheetCtx.ids.size}/${sheetCtx.tracks.length}`;
    }
    if ("auto" in t.dataset) act({ type: "settings", autoNext: t.checked });
    if (t.id === "qPublic" && sheetCtx.draft) {
      sheetCtx.draft.public = t.checked;
      $('[data-do="saveQuiz"]').innerHTML = `${ic("check")}${t.checked ? "Yayınla" : "Kaydet"}`;
    }
    if (t.id === "pPhoto" && t.files[0]) {
      sheetCtx.ed.name = $("#pName").value;
      sheetCtx.ed.photo = await resizePhoto(t.files[0]);
      profileSheet();
    }
  } catch (err) {
    fail(err);
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "joinForm") {
    const code = $("#joinCode").value.trim().toUpperCase();
    if (!validCode(code)) return toast("Kod 5 karakter olmalı (ör. K7QXM).", "bad");
    return startGuest(code);
  }
  if (f.id === "searchForm") return runSearch($("#search").value, "home");
  if (f.id === "pickSearch") return runSearch($("#pickQ").value, "picker");
  if (f.id === "trackSearch") {
    const dr = sheetCtx.draft;
    const q = $("#tsq").value.trim();
    if (q.length < 2) return;
    dr.q = q;
    dr.searching = true;
    redrawCreate();
    searchTracks(q)
      .then((r) => (dr.res = r))
      .catch((e) => (fail(e), (dr.res = null)))
      .finally(() => ((dr.searching = false), redrawCreate()));
    return;
  }
  if (f.id === "guessForm") {
    const v = $("#guess").value.trim();
    if (!v) return;
    act({ type: "answer", q: view.question.id, answer: v });
  }
});
document.addEventListener("keydown", (e) => {
  if (screen !== "room" || sheet.open || !view?.question || view.phase !== "question") return;
  if (e.target.matches("input, textarea")) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4 && view.question.options) {
    e.preventDefault();
    $(`[data-ans="${n - 1}"]`)?.click();
  } else if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    listen();
  }
});
window.addEventListener("beforeunload", () => mode?.net?.close());

// ---------- açılış ----------
function boot() {
  loadCommunity();
  loadPresetPictures().then(() => {
    if (screen === "home" && !mode) renderHome();
  });
  const saved = store.get("jqSession", null, sessionStorage);
  const invite = (new URLSearchParams(location.search).get("oda") || "").toUpperCase();
  if (saved?.role === "host" && saved.game) {
    try {
      startHost({ restore: saved.game });
      return;
    } catch {
      store.del("jqSession", sessionStorage);
    }
  }
  if (saved?.role === "guest" && validCode(saved.code) && profile) return startGuest(saved.code);
  render();
  if (validCode(invite)) {
    if (profile) startGuest(invite);
    else openSheet("profile", { then: () => startGuest(invite) });
  } else if (!profile) openSheet("profile");
}
boot();
