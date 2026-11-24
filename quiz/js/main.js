import { PRESETS, loadTracks, searchArtists, customLists, saveCustom, removeCustom, fold, cdn, realPic, loadPresetPictures } from "./music.js";
import { sfx, sfxEnabled, setSfx } from "./sfx.js";
import { randomName } from "./names.js";
import { fetchCommunity, removeQuiz, hideQuiz, unhideQuiz, hiddenList } from "./community.js";
import { Game, MAX_PLAYERS } from "./engine.js?v=2";
import { TRIVIA, TCATS, TART, EMOJIS, cleanItems, IMG, FLAG, flagUrl, cleanEmo } from "./trivia.js";
import { NUMCATS, fmtNum, farEnough } from "./numdata.js";
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
const NUM = new Set(["rankAt", "pts", "count", "clip", "score", "round", "points", "ms", "index", "set", "seconds", "start", "end", "offset", "autoAt", "now", "streak"]);
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
  if (k === "pic") return IMG.test(x || "") ? x : null;
  if (k === "flag") return FLAG.test(x || "") ? x : null;
  if (k === "emo") return cleanEmo(x) || null;
  if (k === "avatar") return AVATARS.includes(x) ? x : "headphones";
  if (k === "color") return COLORS.includes(x) ? x : "coral";
  if (k === "art") return x === "hero" ? "hero" : "";
  if (k === "emoji") return EMOJIS.includes(x) ? x : "";
  if (k === "kind") return x === "trivia" ? "trivia" : "song";
  if (typeof x === "string") return x.slice(0, 300);
  return typeof x === "number" || typeof x === "boolean" || x === null ? x : null;
}

const app = $("#app");
const sheet = $("#sheet");
const sheetBody = $("#sheetBody");

let profile = store.get("jqProfile", null);
const pid = store.get("jqPid", null, sessionStorage) || uid();
store.set("jqPid", pid, sessionStorage);

const ui = { cat: "", genre: "Keşfet", query: "", results: null, searching: false, community: null, communityErr: false };
let mode = null; // { role: "host"|"guest"|"solo", game?, net?, code }
let view = null; // oyuncuya özel oyun durumu
let lastSig = "";
let lastCore = "";

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
let barHtml = "";
function topbar() {
  const inRoom = mode && mode.role !== "solo" && screen !== "room"; // solo oyunda "Lobiye dön" yok
  const html = `
    ${screen === "home" ? `<a class="jg-back" href="/" title="JinjaGames ana sayfasına dön" aria-label="JinjaGames ana sayfasına dön"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg><img src="/favicon-j-shuriken-32.png" width="20" height="20" alt=""></a>` : `<button class="jg-back" data-go="home" title="JinjaQuiz ana sayfasına dön" aria-label="JinjaQuiz ana sayfasına dön"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg><img src="/favicon-j-shuriken-32.png" width="20" height="20" alt=""></button>`}
    <button class="brand" data-go="home" aria-label="JinjaQuiz ana sayfa"><span class="mark"><svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="jqG" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse"><stop stop-color="#ff3b2f"/><stop offset=".6" stop-color="#e3171f"/><stop offset="1" stop-color="#ff6a3d"/></linearGradient></defs><path d="M36.4 9.6A19.5 19.5 0 1 0 43.3 30" fill="none" stroke="url(#jqG)" stroke-width="3.6" stroke-linecap="round"/><path d="M12.2 13.1A16 16 0 0 0 20 39.5" fill="none" stroke="#ff3b2f" stroke-width="1.1" stroke-linecap="round" opacity=".45"/><g class="eq" stroke="#ff8a5c" stroke-width="2.4" stroke-linecap="round"><path d="M40.2 12.6v3.4"/><path d="M43.6 15.2v5.2"/><path d="M46.6 18.6v2.6"/></g><path d="M19.4 10L38 7.4l-3.3 6-6.7.6-1.8 14.6c-.7 5.6-4.6 8.4-9.2 8-3.9-.4-5.9-3.2-5.4-6.9l5.8-.6c-.1 2 .8 2.9 2.1 2.8 1.3-.1 2-1.2 2.2-3.2l1.7-14-5.4.6z" fill="url(#jqG)" stroke="#1a0606" stroke-width=".8" stroke-linejoin="round"/><path d="M25.2 14.6l-1.6 13.2M21.2 11l11.6-1.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".92"/><g transform="rotate(14 32.5 32)"><path d="M32.5 22.5l2.3 7.2 7.2 2.3-7.2 2.3-2.3 7.2-2.3-7.2-7.2-2.3 7.2-2.3z" fill="#18161b" stroke="#f6f1ef" stroke-width="1.2" stroke-linejoin="round"/><path d="M32.5 22.5l2.3 7.2-2.3 2.3zM42 32l-7.2 2.3-2.3-2.3zM32.5 41.5l-2.3-7.2 2.3-2.3zM23 32l7.2-2.3 2.3 2.3z" fill="#3a3640"/></g><circle cx="32.5" cy="32" r="2.1" fill="#f6f1ef"/><circle cx="32.5" cy="32" r=".9" fill="#18161b"/></svg></span><b lang="en">JINJA</b><span lang="en">QUIZ</span></button>
    <div class="barEnd">
      ${inRoom ? `<button class="pill live" data-go="room">${ic("users")}<span>Lobiye dön</span></button>` : ""}
      ${screen === "room" && mode ? `<label class="vol" title="Ses düzeyi">${ic("volume-2")}<input type="range" id="vol" min="0" max="100" step="1" value="${Math.round(volume() * 100)}" aria-label="Ses düzeyi"></label>` : ""}
      ${screen !== "room" && hiddenList().length ? `<button class="icon hidBtn" data-sheet="hidden" title="Gizlenen quizler (${hiddenList().length})" aria-label="Gizlenen quizler">${ic("eye-off")}<small>${hiddenList().length}</small></button>` : ""}
      <button class="meBtn" data-sheet="profile" aria-label="Profili düzenle">${avatar(profile || {})}<span>${esc(profile?.name || "Profil")}</span></button>
    </div>`;
  // Yalnızca değiştiğinde yeniden çiz: ses sürgüsü sürüklenirken ya da düğmeye basılırken kaybolmasın.
  if (html !== barHtml) {
    barHtml = html;
    $("#bar").innerHTML = html;
  }
}

// ---------- ses ----------
const audio = new Audio();
audio.preload = "auto";
const volume = () => Math.min(1, Math.max(0, num(store.get("jqVolume", 0.8))));
audio.volume = volume();
// Bir olayı bekler; hata ya da zaman aşımında reddeder.
function waitAudio(ev, ms) {
  return new Promise((res, rej) => {
    const done = (fn) => () => {
      clearTimeout(t);
      audio.removeEventListener(ev, ok);
      audio.removeEventListener("error", bad);
      fn();
    };
    const ok = done(res);
    const bad = done(() => rej(Error("load")));
    const t = setTimeout(done(() => rej(Error("timeout"))), ms);
    audio.addEventListener(ev, ok, { once: true });
    audio.addEventListener("error", bad, { once: true });
  });
}
async function startAt(offset) {
  if (audio.readyState < 1) await waitAudio("loadedmetadata", 7000);
  if (Math.abs(audio.currentTime - offset) > 0.05) {
    const seeked = waitAudio("seeked", 5000);
    audio.currentTime = offset;
    await seeked;
  }
  if (audio.readyState < 3) await waitAudio("canplay", 5000).catch(() => {});
  audio.volume = volume();
  await audio.play();
}
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
  if (player.loading) return;
  prime(q.url);
  player.loading = true;
  player.needTap = false;
  paint();
  // Ses gerçekten ilerliyor mu? Bazen play() başarılı döner ama ağ takıldığı için ses gelmez.
  const flowing = async () => {
    const t0 = audio.currentTime;
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (audio.currentTime - t0 > 0.12) return true;
    }
    return false;
  };
  const reload = () => {
    audio.src = player.url;
    audio.load();
  };
  try {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      if (attempt) reload(); // takılan ya da yarım kalan yükleme: kaynağı baştan yükle
      try {
        await startAt(q.offset);
        ok = await flowing();
        if (!ok) audio.pause();
      } catch (e) {
        if (e.name === "NotAllowedError") throw e;
      }
      if (view?.question?.id !== q.id) break;
    }
    if (!ok) throw Error("stall");
  } catch (e) {
    player.loading = false;
    // Tarayıcı otomatik çalmaya izin vermediyse diski parlat; dokununca çalar.
    if (e.name === "NotAllowedError") player.needTap = true;
    if (!auto) fail(e.name === "NotAllowedError" ? Error("Dinlemek için butona dokun.") : Error("Kesit yüklenemedi. Tekrar dinle'ye bas."));
    paint();
    return;
  }
  player.loading = false;
  // Soru bu arada değiştiyse çalma.
  if (view?.question?.id !== q.id) return stopClip();
  store.set(playsKey(q.id), playsUsed(q.id) + 1, sessionStorage);
  player.playing = true;
  player.qid = q.id;
  // Ses akışı kontrol edilirken çalan kısım da klipten sayılır (1 sn'lik kesit uzamasın).
  const played = Math.max(0, Math.min(0.5, audio.currentTime - q.offset)) * 1000;
  player.startedAt = performance.now() - played;
  player.clip = q.clip * 1000;
  document.body.classList.add("playing");
  player.stopT = setTimeout(() => {
    stopClip();
    paint();
  }, q.clip * 1000 - played);
  paint();
}

// ---------- saat ----------
const hostNow = () => Date.now() + (mode?.role === "guest" ? mode.net.offset : 0);

// ---------- oturum ----------
// Kurucunun oyun durumu (cevaplar dahil) oturum deposunda düz metin durmasın: basit karıştırma.
// Tam gizlilik değildir; geliştirici araçlarına bakıp cevabı okumayı zorlaştırır.
function seal(obj) {
  let k = sessionStorage.getItem("jqK");
  if (!k) sessionStorage.setItem("jqK", (k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")));
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= parseInt(k.substr((i % 16) * 2, 2), 16) ^ (i * 31) & 255;
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function unseal(str) {
  const k = sessionStorage.getItem("jqK");
  if (!k || typeof str !== "string") return null;
  const bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= parseInt(k.substr((i % 16) * 2, 2), 16) ^ (i * 31) & 255;
  return JSON.parse(new TextDecoder().decode(bytes));
}
function persist() {
  if (!mode || mode.role === "solo") return;
  try {
    store.set("jqSession", { role: mode.role, code: mode.code, game: mode.role === "host" ? seal(mode.game) : null }, sessionStorage);
  } catch {}
}
function onGame(game) {
  if (!mode || mode.game !== game) return; // lobiden çıkıldıktan sonra gelen olaylar
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
  if (!solo) attachHost();
  screen = "room";
  onGame(game);
  return game;
}
// Kurucunun ağ bağlantısı. Telefon arka plana düşünce (ör. kodu WhatsApp'tan paylaşırken) tarayıcı
// röle ve eş bağlantılarını kapatabilir; sayfa öne gelince bu fonksiyonla yeniden kurulur.
function attachHost() {
  const { game, code } = mode;
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
        // Kurucu ana sayfadayken son oyuncu da çıktıysa lobiyi kapat; dönülecek kimse kalmadı.
        if (screen !== "room" && hostAlone()) leaveRoom();
      },
    });
}
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!mode || mode.role === "solo" || !hiddenAt || Date.now() - hiddenAt < 2500) return;
  hiddenAt = 0;
  try {
    if (mode.role === "host") {
      mode.net?.close({ quiet: true });
      attachHost();
    } else if (mode.role === "guest" && !mode.net?.connected) {
      startGuest(mode.code);
    }
  } catch {}
});
function startGuest(code) {
  if (!profile) return openSheet("profile", { then: () => startGuest(code) });
  leaveRoom(true);
  mode = { role: "guest", code, connecting: true, since: Date.now() };
  view = null;
  screen = "room";
  mode.net = guestRoom(code, pid, profile, {
    onState(s) {
      if (mode?.role !== "guest") return;
      if (!s || typeof s !== "object") return;
      mode.connecting = false;
      mode.lost = false;
      const was = view?.phase;
      view = cleanView(s);
      if (was === "done" && view.phase === "lobby") {
        screen = "room";
        toast("Kurucu herkesi lobiye döndürdü.");
      }
      persist();
      render();
    },
    onDenied(reason) {
      if (mode?.role !== "guest") return;
      leaveRoom(true);
      toast(reason, "bad");
    },
    onHostLost() {
      if (mode?.role !== "guest") return;
      mode.lost = true;
      render();
    },
    onHostBack() {
      if (mode?.role !== "guest") return;
      mode.lost = false;
      toast("Kurucu geri döndü.");
    },
  });
  persist();
  render();
}
// Kurucu lobide tek başına mı? (Bağlı başka oyuncu yok.)
function hostAlone() {
  return mode?.role === "host" && !mode.game.players.some((p) => p.online && p.pid !== pid);
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
  u.searchParams.set("room", mode.code);
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
// ses efektleri: oyun durumundaki değişikliklere göre (quiz açılışı, soru geçişi, doğru/yanlış, bitiş)
const snd = { q: null, phase: null, done: false };
function sfxTrack() {
  const v = view;
  if (!v) return;
  const q = v.question;
  if (v.phase === "question" && q && q.id !== snd.q) {
    snd.q = q.id;
    snd.done = false;
    sfx(num(v.index) === 0 ? "open" : "whoosh");
  }
  if (v.phase === "reveal" && q && snd.phase !== "reveal:" + q.id) {
    snd.phase = "reveal:" + q.id;
    const r = q.reveal?.results?.[v.me];
    sfx(r?.correct ? "good" : "bad");
  }
  if ((v.phase === "done" || v.phase === "ranking") && !snd.done) { snd.done = true; sfx("end"); }
}
function render() {
  topbar();
  if (screen === "room" && mode) { const out = renderRoom(); sfxTrack(); return out; }
  if (screen === "detail" && sheetCtx?.list) return renderDetail();
  if (screen === "number") return renderNumber();
  screen = "home";
  lastSig = "";
  renderHome();
}

function allLists() {
  return [...PRESETS, ...TRIVIA, ...(ui.community || []), ...customLists().map((l) => ({ ...l, genre: "Senin" }))];
}
const hue = (name) => {
  let h = 0;
  for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
};
function cover(l, cls = "", big = false) {
  if (EMOJIS.includes(l?.emoji)) {
    const [h, d1, d2] = TART[l.cat] || [hue(l.name), "✨", "❓"];
    const hh = TART[l.cat] ? (h + (hue(l.name) % 36) - 18 + 360) % 360 : h;
    if (!big) return `<span class="${esc(cls)} noart mono emo" style="--h:${hh}">${l.emoji}</span>`;
    return `<span class="${esc(cls)} noart art" style="--h:${hh}"><i class="artGhost">${l.emoji}</i><i class="artDeco d1">${d1}</i><i class="artDeco d2">${d2}</i><i class="artMain">${l.emoji}</i></span>`;
  }
  if (realPic(l?.picture)) return `<img class="${esc(cls)}" src="${esc(l.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  // Görsel yoksa addan türeyen renkli harf rozeti
  const name = String(l?.name || "?");
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLocaleUpperCase("tr") || "♪";
  return `<span class="${esc(cls)} noart mono" style="--h:${h % 360}">${esc(initials)}</span>`;
}
function renderHome() {
  const q = fold(ui.query);
  const mine = customLists().map((l) => ({ ...l, genre: "Senin" }));
  if (ui.genre === "Senin" && !mine.length) ui.genre = "Keşfet";
  const browsing = ui.genre !== "Keşfet" || q;
  const lists = allLists().filter(
    (l) => inTab(l) && (!q || fold(l.name).includes(q) || fold(l.author || "").includes(q) || fold(l.cat || "").includes(q)),
  );
  const commTrivia = (ui.community || []).filter((l) => l.kind === "trivia");
  const comm = ui.community || [];
  const tab = TABS.find((t) => t[0] === ui.genre) || TABS[0];
  const pics = PRESETS.map((p) => realPic(p.picture)).filter(Boolean);
  const inviteCode = esc((new URLSearchParams(location.search).get("room") || new URLSearchParams(location.search).get("oda")) || "");
  app.innerHTML = `
  <section class="hm-hero">
    <div class="hm-bg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i>
      <span class="hm-eq">${Array.from({ length: 48 }, (_, k) => `<i style="--k:${k}"></i>`).join("")}</span></div>
    <div class="hm-copy">
      <h1>Şarkıyı<br><em>ilk sen</em> bil.</h1>
      <p>Bir saniyelik kesiti dinle ya da trivia sorusunu çöz; dört şıktan doğrusunu herkesten önce bul. Lobi kur, bağlantıyı gönder; arkadaşların tek tıkla katılsın.</p>
      <div class="hm-actions">
        <button class="btn primary lg" data-do="create">${ic("users")}Lobi kur</button>
        <button class="btn light lg" data-do="toCatalog">${ic("play")}Solo oyna</button>
        <button class="btn ghost lg" data-do="toTrivia">${ic("circle-help")}Trivia</button>
      </div>
      <form class="hm-join" id="joinForm" autocomplete="off">
        <span>${ic("log-in")}<b>Kodun mu var?</b></span>
        <input id="joinCode" maxlength="5" spellcheck="false" placeholder="K7QXM" aria-label="Lobi kodu" value="${inviteCode}">
        <button class="btn primary" type="submit">Katıl ${ic("chevron-right")}</button>
      </form>
    </div>
    <div class="hm-stage" id="hmStage">
      <div class="hm-ring" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><circle class="arc" cx="50" cy="50" r="46" pathLength="100"/></svg></div>
      <div class="hm-vinyl" id="hmVinyl" aria-hidden="true"><span class="hm-grooves"></span><span class="hm-shine"></span></div>
      <button class="hm-label" id="hmLabel" data-do="randomQuiz" title="Rastgele bir quiz aç" aria-label="Rastgele bir quiz aç">${pics[0] ? `<img src="${esc(pics[0])}" alt="">` : ic("audio-lines")}<span class="hm-dice">${ic("dices")}</span></button>
      <div class="hm-arm" aria-hidden="true"><i></i></div>
      <div class="hm-timer" aria-hidden="true">${ic("timer")}<b>3</b></div>
      <div class="hm-notes" aria-hidden="true">${["music", "music-2", "music", "audio-lines"].map((n, k) => `<i style="--k:${k}">${ic(n)}</i>`).join("")}</div>
      ${PRESETS.filter((p) => realPic(p.picture)).slice(1, 4).map((p, k) => `<button class="hm-cov c${k}" data-list="${esc(p.id)}" title="${esc(p.name)}" aria-label="${esc(p.name)} quizini aç"><img src="${esc(p.picture)}" alt=""></button>`).join("")}
      <span class="hm-hint">${ic("rotate-ccw")}Plağı çevir · ortasına dokun, rastgele quiz</span>
    </div>
  </section>

  <section class="hm-modes" aria-label="Oyun modları">
    <button class="mode m-song" data-tab="Müzik" data-scroll="1"><span class="modeIc">${ic("music")}</span><b>Şarkı Quizi</b><small>Bir saniyelik kesitten şarkıyı bil</small><i class="modeGo">${ic("chevron-right")}</i></button>
    <button class="mode m-trivia" data-tab="Trivia" data-scroll="1"><span class="modeIc">${ic("circle-help")}</span><b>Trivia</b><small>${TRIVIA.length} quiz, binlerce soru</small><i class="modeGo">${ic("chevron-right")}</i></button>
    <button class="mode m-num" data-do="numHome"><span class="modeIc">${ic("hash")}</span><b>Sayı Quizi <em>Yeni</em></b><small>Hangisi daha büyük? Seriyi bozma</small><i class="modeGo">${ic("chevron-right")}</i></button>
    <button class="mode m-party" data-do="create"><span class="modeIc">${ic("users")}</span><b>Arkadaşlarla</b><small>Lobi kur, 12 kişiye kadar oynayın</small><i class="modeGo">${ic("chevron-right")}</i></button>
  </section>

  <section class="catalog hm-cat" id="catalog">
    <div class="hm-catHead">
      <div><span class="kicker">${ic(tab[1])} ${esc(tab[0])}</span><h2>${esc(tab[2])}</h2></div>
      <form class="search hm-search" id="searchForm" role="search">
        ${ic("search")}
        <input id="search" type="search" placeholder="Quiz, kategori ya da sanatçı ara…" value="${esc(ui.query)}" aria-label="Quiz, kategori ya da sanatçı ara">
        <button class="btn soft" type="submit" title="Deezer'da sanatçı ara">Sanatçı bul</button>
      </form>
    </div>
    <nav class="hm-tabs" role="tablist" aria-label="Quiz türleri">
      ${TABS.filter((t) => t[0] !== "Senin" || mine.length)
        .map(([name, icon]) => `<button role="tab" aria-selected="${ui.genre === name}" data-tab="${esc(name)}">${ic(icon)}<span>${esc(name)}</span>${tabCount(name, mine) ? `<small>${tabCount(name, mine)}</small>` : ""}</button>`)
        .join("")}
    </nav>
    ${SUBS[ui.genre] ? `<div class="seg chips subChips">${["", ...SUBS[ui.genre]].map((c) => `<button data-sub="${esc(c)}" aria-pressed="${ui.cat === c}">${esc(c || "Hepsi")}</button>`).join("")}</div>` : ""}
    <div id="results">${resultsHtml()}</div>
    ${
      ui.genre === "Sayı"
        ? `<div class="numGrid">${NUMCATS.map((c, k) => numCard(c, k)).join("")}</div>`
        : browsing
        ? `${lists.length ? `<div class="hm-grid">${lists.map((l, k) => qcard(l, k)).join("")}</div>` : ""}
          ${ui.genre === "Topluluk" ? communityState() : ""}
          ${!lists.length && !ui.results && (ui.genre !== "Topluluk" || ui.community?.length) ? `<p class="hm-empty">${ic("search")}<span>Burada bir şey yok.${ui.genre === "Keşfet" || ui.genre === "Müzik" ? ' "Sanatçı bul" ile Deezer\'da ara; binlerce sanatçı var.' : ""}</span></p>` : ""}`
        : `${rail("Popüler sanatçılar", "flame", PRESETS.map((l, k) => acard(l, k)).join(""), "Müzik")}
          ${triviaRail(commTrivia)}
          ${numRail()}
          ${rail("Topluluk quizleri", "users", comm.slice(0, 12).map((l, k) => qcard(l, k)).join("") || communityState(), comm.length ? "Topluluk" : "")}
          ${mine.length ? rail("Senin quizlerin", "bookmark", mine.map((l, k) => qcard(l, k)).join(""), "Senin") : ""}`
    }
  </section>

  <section class="hm-make">
    <div class="hm-makeArt" aria-hidden="true">${pics.length >= 3 ? pics.slice(0, 5).map((u, k) => `<img src="${esc(u)}" alt="" style="--k:${k}">`).join("") : TRIVIA.slice(0, 5).map((t, k) => `<span class="mkEmo" style="--k:${k};--h:${hue(t.name)}">${t.emoji}</span>`).join("")}</div>
    <div><span class="kicker">${ic("sparkles")} Kendi quizin</span><h2>Kendi quizini yap, herkes oynasın.</h2>
      <p>Bir sanatçının albümlerinden şarkı quizi ya da kendi sorularınla trivia yap. Herkese açık yayınlarsan Topluluk'ta herkes görür.</p>
      <div class="hm-actions"><a class="btn primary lg" href="create/">${ic("music")}Şarkı quizi oluştur</a><a class="btn light lg" href="create/?type=trivia">${ic("circle-help")}Trivia oluştur</a></div></div>
  </section>
  <footer><a href="/">JinjaGames</a> · <a href="/apps/">Diğer web uygulamaları</a> · <a href="/privacy/">Gizlilik</a></footer>`;
  keepVisible('.subChips [aria-pressed="true"]');
  keepVisible('.hm-tabs [aria-selected="true"]');
  initVinyl();
}

// ---------- ana sayfa plağı: sürükleyip çevir, bırakınca ivmeyle döner ----------
let vinylRAF = 0, vinylAngle = 0;
function initVinyl() {
  cancelAnimationFrame(vinylRAF);
  const stage = $("#hmStage"), disc = $("#hmVinyl"), label = $("#hmLabel");
  if (!stage || !disc) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let angle = vinylAngle, speed = still ? 0 : 0.9, base = still ? 0 : 0.9, drag = null, moved = 0;
  const center = () => { const r = disc.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const at = (e) => { const [cx, cy] = center(); return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI; };
  const onDown = (e) => {
    if (e.button !== 0) return;
    drag = { a: at(e), t: performance.now() };
    moved = 0;
    stage.classList.add("grab");
    stage.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    stage.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    stage.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    if (!drag) return;
    const a = at(e);
    let d = a - drag.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const now = performance.now();
    angle += d;
    moved += Math.abs(d);
    speed = Math.max(-30, Math.min(30, (d / Math.max(8, now - drag.t)) * 16));
    drag = { a, t: now };
  };
  const onUp = () => {
    if (!drag) return;
    drag = null;
    stage.classList.remove("grab");
    stage.classList.toggle("scratched", moved > 8);
  };
  stage.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) onDown(e); });
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("pointerleave", () => { stage.style.setProperty("--tx", 0); stage.style.setProperty("--ty", 0); });
  const tick = () => {
    if (!disc.isConnected) return;
    if (!drag) speed += (base - speed) * 0.02;
    angle += speed;
    vinylAngle = angle % 360;
    disc.style.transform = `rotate(${angle}deg)`;
    if (label) label.style.setProperty("--r", `${angle}deg`);
    vinylRAF = requestAnimationFrame(tick);
  };
  disc.style.transform = `rotate(${angle}deg)`;
  if (label) label.style.setProperty("--r", `${angle}deg`);
  vinylRAF = requestAnimationFrame(tick);
}

// ---------- Sayı Quizi kartları ----------
const numBest = (id) => num(store.get("jqNumBest", {})[id]);
function numCard(c, k = 0) {
  const sample = c.items.filter((x) => x.f).slice(0, 3);
  return `<button class="numCard" data-numcat="${esc(c.id)}" style="--h:${c.hue};--i:${k}">
    <span class="numArt">${sample.length ? sample.map((x, i) => `<img src="${esc(flagUrl(x.f))}" alt="" style="--j:${i}">`).join("") : `<i>${c.emoji}</i>`}</span>
    <span class="numInfo"><b>${c.emoji} ${esc(c.name)}</b><small>${c.items.length} öğe${numBest(c.id) ? ` · rekorun ${numBest(c.id)}` : ""}</small></span>
    <span class="numPlay">${ic("play")}</span>
  </button>`;
}
function numRail() {
  return `<div class="hm-rail num">
    <div class="hm-railHead"><h3>${ic("hash")}Sayı Quizi <em class="newTag">Yeni</em></h3><button class="hm-more" data-tab="Sayı">Tümünü gör ${ic("chevron-right")}</button></div>
    <div class="hm-track">${NUMCATS.map((c, k) => numCard(c, k)).join("")}</div>
  </div>`;
}
// Seçili sekme/alt kategori yatay kaydırmalı şeritte görünür kalsın
function keepVisible(sel) {
  const b = app.querySelector(sel);
  const bar = b?.parentElement;
  if (!bar || bar.scrollWidth <= bar.clientWidth) return;
  const r = b.getBoundingClientRect(), br = bar.getBoundingClientRect();
  bar.scrollLeft += r.left - br.left - (br.width - r.width) / 2;
}
// Katalog sekmeleri: [ad, simge, başlık]
const TABS = [
  ["Keşfet", "compass", "Ne oynamak istersin?"],
  ["Müzik", "music", "Ne dinlemek istersin?"],
  ["Trivia", "circle-help", "Ne kadar biliyorsun?"],
  ["Sayı", "hash", "Hangisi daha büyük?"],
  ["Topluluk", "users", "Topluluğun quizleri"],
  ["Senin", "bookmark", "Senin quizlerin"],
];
const SUBS = { Müzik: ["Rap", "Pop", "Rock"], Trivia: TCATS, Topluluk: ["Müzik", "Trivia"] };
function inTab(l) {
  const trivia = l.kind === "trivia";
  const c = ui.cat;
  switch (ui.genre) {
    case "Müzik": return !trivia && (!c || l.genre === c);
    case "Trivia": return trivia && (!c || l.cat === c);
    case "Topluluk": return l.genre === "Topluluk" && (!c || (c === "Trivia") === trivia);
    case "Senin": return l.genre === "Senin";
    default: return true;
  }
}
function tabCount(name, mine) {
  if (name === "Trivia") return TRIVIA.length + (ui.community || []).filter((l) => l.kind === "trivia").length;
  if (name === "Sayı") return NUMCATS.length;
  if (name === "Topluluk") return ui.community?.length || 0;
  if (name === "Senin") return mine.length;
  return 0;
}
// Rafta her kategoriden sırayla birer quiz göster (hepsi Genel Kültür'le başlamasın)
function mixCats(list) {
  const groups = TCATS.map((c) => list.filter((t) => t.cat === c));
  const out = [];
  const most = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < most; i++) for (const g of groups) if (g[i]) out.push(g[i]);
  return out;
}
function triviaRail(comm) {
  const cats = TCATS.filter((c) => TRIVIA.some((t) => t.cat === c) || comm.some((t) => t.cat === c));
  return `<div class="hm-rail trivia">
    <div class="hm-railHead"><h3>${ic("circle-help")}Trivia</h3><button class="hm-more" data-tab="Trivia">Tümünü gör ${ic("chevron-right")}</button></div>
    <div class="catTiles">${cats
      .map((c) => {
        const n = TRIVIA.filter((t) => t.cat === c).length + comm.filter((t) => t.cat === c).length;
        const e = TRIVIA.find((t) => t.cat === c)?.emoji || "🧠";
        return `<button class="catTile" data-tab="Trivia" data-cat="${esc(c)}" style="--h:${TART[c]?.[0] ?? hue(c)}"><span>${e}</span><b>${esc(c)}</b><small>${n} quiz</small></button>`;
      })
      .join("")}</div>
    <div class="hm-track">${[...comm.slice(0, 4), ...mixCats(TRIVIA).slice(0, 24)].map((l, k) => qcard(l, k)).join("")}</div>
  </div>`;
}
function rail(title, icon, inner, more, cls = "") {
  return `<div class="hm-rail ${cls}">
    <div class="hm-railHead"><h3>${ic(icon)}${esc(title)}</h3>${more ? `<button class="hm-more" data-tab="${esc(more)}">Tümünü gör ${ic("chevron-right")}</button>` : ""}</div>
    <div class="hm-track">${inner}</div>
  </div>`;
}
function communityState() {
  if (ui.community === null) return `<p class="hm-empty">${spinner()} Topluluk quizleri yükleniyor…</p>`;
  if (ui.communityErr) return `<p class="hm-empty">Topluluk quizlerine şu an ulaşılamadı. Biraz sonra tekrar dene.</p>`;
  if (!ui.community.length) return `<a class="hm-empty cta" href="create/">${ic("plus")}<span><b>Henüz topluluk quizi yok.</b> İlkini sen oluştur!</span></a>`;
  return "";
}
function qcard(l, k = 0) {
  return `<div class="qcard ${l.genre === "Topluluk" ? "community" : ""}" style="--i:${Math.min(k, 20)}">
    <button class="qcardBtn" data-list="${esc(l.id)}" aria-label="${esc(l.name)} quizini aç">
      <span class="qcardArt">${cover(l, "qcardImg", true)}</span>
      <span class="qcardTag">${esc(l.genre)}</span>
      <span class="qcardInfo"><b>${esc(l.name)}</b><small>${cardSub(l)}</small></span>
      <span class="qcardPlay">${ic("play")}</span>
    </button>
    ${cardTools(l)}
  </div>`;
}
function acard(l, k = 0) {
  return `<button class="acard" data-list="${esc(l.id)}" style="--i:${k}" aria-label="${esc(l.name)} quizini aç">
    <span class="acardArt">${cover(l, "acardImg")}</span>
    <b>${esc(l.name)}</b><small>${esc(l.genre)}</small>
  </button>`;
}
function cardSub(l) {
  const n = l.kind === "trivia" ? `${num(l.items?.length)} soru` : `${num(l.tracks?.length)} şarkı`;
  if (l.genre === "Topluluk") return `${ic("user")}${esc(l.author)} · ${l.kind === "trivia" ? esc(l.cat) + " · " : ""}${n}`;
  if (l.kind === "trivia") return `Trivia · ${n}`;
  if (l.tracks?.length) return `${esc(l.genre)} · ${l.tracks.length} şarkı`;
  return esc(l.genre);
}
function cardTools(l) {
  const btn = (attr, icon, label) => `<button class="icon sm" ${attr}="${esc(l.id)}" aria-label="${esc(label)}" title="${esc(label)}">${ic(icon)}</button>`;
  if (l.genre === "Topluluk")
    return `<span class="cardTools">${l.mine ? btn("data-edit", "sliders-horizontal", "Düzenle") + btn("data-unpublish", "trash-2", "Yayından kaldır") : btn("data-hidequiz", "x", "Bu quizi gizle")}</span>`;
  if (l.genre === "Senin")
    return `<span class="cardTools">${l.tracks?.length || l.items?.length ? btn("data-edit", "sliders-horizontal", "Düzenle") : ""}${btn("data-unsave", "x", "Listeden kaldır")}</span>`;
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
  // Soru sürerken başkası cevaplayınca yalnızca küçük parçaları güncelle; düğmeleri baştan çizme
  // (aksi halde o an basılan şık kaybolabiliyor).
  const core = JSON.stringify({ ...v, now: 0, lost: mode.lost, players: v.players.map((p) => ({ ...p, online: 0 })), question: v.question ? { ...v.question, answered: 0, votes: 0 } : null });
  if (core === lastCore && v.phase === "question" && !v.question?.mine && $("#ansCount")) {
    lastSig = sig;
    $(".gEnd .mini").innerHTML = miniHtml(v);
    $("#ansCount").textContent = ansCountText(v);
    return paint();
  }
  lastCore = core;
  // Yazılı cevap kutusundaki metni ve odağı koru.
  const typed = $("#guess")?.value || "";
  const focused = document.activeElement?.id === "guess";
  lastSig = sig;
  const prevQ = app.dataset.q;
  // Oyun ekranı yeniden çizilirken sayfa kaymasın (soru → sonuç geçişi).
  const keepY = GAME.has(v.phase) && GAME.has(app.dataset.phase || "") ? scrollY : null;
  app.dataset.phase = v.phase;
  if (v.phase === "lobby") app.innerHTML = lobbyHtml(v);
  else if (["preparing", "question", "reveal"].includes(v.phase)) app.innerHTML = gameHtml(v);
  else app.innerHTML = rankingHtml(v);
  app.dataset.q = v.question?.id || "";
  if (keepY != null && Math.abs(scrollY - keepY) > 1) scrollTo(0, keepY);
  animateCounts();
  if (v.question?.url) prime(v.question.url);
  if (v.phase !== "question" || v.question?.mine) stopClip();
  if ($("#guess")) {
    $("#guess").value = prevQ === app.dataset.q ? typed : "";
    if (focused || (window.matchMedia("(pointer:fine)").matches && v.phase === "question")) $("#guess").focus();
  }
  paint();
}

const GAME = new Set(["preparing", "question", "reveal"]);
const isHost = () => view && view.host === view.me;
const playerMap = () => new Map(view.players.map((p) => [p.pid, p]));

function miniHtml(v) {
  const q = v.question;
  return v.players
    .filter((p) => p.online)
    .map((p) => `<span class="dotAv ${q?.answered?.includes(p.pid) ? "done" : ""}" title="${esc(p.name)}">${avatar(p, "xs")}</span>`)
    .join("");
}
const ansCountText = (v) => (v.solo ? "" : `${num(v.question?.answered?.length)}/${v.players.filter((p) => p.online).length} cevapladı`);

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
              <span class="qInfo"><b>${esc(s.name)}</b><small>${num(s.count)} soru · ${s.kind === "trivia" ? "Trivia" : `${s.mode === "text" ? "Yazarak" : "Şıklı"} · ${LEVELS[s.clip] || ""} (${num(s.clip)} sn)`}</small></span>
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

// Trivia cevabını destekleyen görsel: bayrak, yüklenen görsel ya da büyük emoji
function tqVisual(r) {
  if (r.flag) return `<span class="tqVis flag"><img src="${esc(flagUrl(r.flag))}" alt=""></span>`;
  if (r.pic) return `<span class="tqVis pic"><img src="${esc(r.pic)}" alt=""></span>`;
  if (r.emo) return `<span class="tqVis emo">${esc(r.emo)}</span>`;
  return "";
}
// Yüklenemeyen cevap görseli (ör. bayrak servisi erişilemezse) boş kutu bırakmasın.
document.addEventListener("error", (e) => e.target?.closest?.(".tqVis")?.remove(), true);
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
      <span class="gq">${cover(set, "gImg")}<span><b>${esc(set.name)}</b><small>Soru ${num(v.index) + 1}/${num(set.count)} · ${set.kind === "trivia" ? "Trivia" : `${LEVELS[set.clip] || ""} ${num(set.clip)} sn`}</small></span></span>
      <span class="gEnd">
        <span class="myScore ${myRes?.correct ? "up" : ""}" title="Bu quizdeki puanın"><b>${myPts}</b><small>puan</small>${myRes ? `<i class="plus ${myRes.correct ? "" : "zero"}">+${num(myRes.points)}</i>` : ""}</span>
        <button class="icon sm sfxBtn" data-do="sfx" aria-pressed="${sfxEnabled()}" aria-label="Ses efektleri ${sfxEnabled() ? "açık" : "kapalı"}" title="Ses efektleri">${ic(sfxEnabled() ? "volume-2" : "volume-x")}</button>
        <span class="mini">${miniHtml(v)}</span>
        <span class="timer ${reveal ? "gone" : ""}" ${reveal ? 'aria-hidden="true"' : 'id="timer"'}><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/><circle ${reveal ? "" : 'id="timerArc"'} cx="18" cy="18" r="16" pathLength="100"/></svg><b ${reveal ? "" : 'id="timerNum"'}></b></span>
      </span>
    </div>
    <div class="progress"><span style="width:${Math.min(100, ((num(v.index) + (reveal ? 1 : 0)) / Math.max(1, num(set.count))) * 100)}%"></span></div>`;
  if (v.phase === "preparing")
    return `<section class="game">${head}<div class="stage"><div class="pulse">${ic("headphones")}</div><h2>Sıradaki şarkı hazırlanıyor…</h2></div></section>`;

  const mine = q.mine;
  const trivia = q.kind === "trivia";
  // Geri sayım ilk çizimden itibaren açık olsun: şıklar bir an bile okunmasın.
  const pre0 = !reveal && q.start && hostNow() < q.start;
  const intro = num(v.index) === 0 && !reveal ? `<div class="introCard" aria-hidden="true"><div class="inArt">${cover(set, "inImg", true)}</div><span class="kicker">${set.kind === "trivia" ? "Trivia" : "Şarkı quizi"}${set.survival ? " · Hayatta Kalma" : ""}</span><h2>${esc(set.name)}</h2><p>${num(set.count)} ${set.kind === "trivia" ? "soru" : "şarkı"} · ${set.survival ? "ilk yanlışta oyun biter" : "hızlı olan kazanır"}</p><b class="inNum" id="inNum"></b></div>` : "";
  let stage;
  if (trivia) {
    const r = reveal ? q.reveal.results[v.me] : null;
    const verdict = !reveal ? "" : r?.correct ? `<span class="verdict good">${ic("check")} +${num(r.points)}</span>` : r ? `<span class="verdict bad">${ic("x")} Yanlış</span>` : `<span class="verdict">${ic("timer")} Süre doldu</span>`;
    stage = `<div class="tq ${reveal ? "done" : ""}">
      <div class="countdown ${pre0 ? "on" : ""}" id="countdown" aria-hidden="true"><div class="cdRing"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/><circle class="cdArc" id="cdArc" cx="50" cy="50" r="46" pathLength="100"/></svg><b id="cdNum"></b><small>Başlıyor</small></div></div>
      <span class="tqNo">${ic("circle-help")} Soru ${num(v.index) + 1}</span>
      ${q.pic ? `<img class="tqPic" src="${esc(q.pic)}" alt="">` : ""}
      <h2 class="tqText">${esc(q.text)}</h2>
      ${reveal ? `<div class="tqAns ${tqVisual(q.reveal) ? "hasVis" : ""}">${tqVisual(q.reveal)}<span class="tqAnsText"><small>Doğru cevap</small><b>${esc(q.reveal.title)}</b>${verdict}</span></div>` : `<div class="tqAns slot" aria-hidden="true"></div>`}
    </div>`;
  } else if (reveal) {
    const r = q.reveal.results[v.me];
    const verdict = r?.correct ? `<span class="verdict good">${ic("check")} +${num(r.points)}</span>` : r ? `<span class="verdict bad">${ic("x")} Yanlış</span>` : `<span class="verdict">${ic("timer")} Süre doldu</span>`;
    stage = `<div class="reveal">
      ${q.reveal.cover ? `<img class="art" src="${esc(q.reveal.cover)}" alt="">` : `<span class="art noart">${ic("disc-3")}</span>`}
      <div class="revealText">
        <small>Doğru cevap</small>
        <h2>${esc(q.reveal.title)}</h2>
        <p>${esc(q.reveal.artist)}${q.reveal.album && fold(q.reveal.album) !== fold(q.reveal.title) ? ` · ${esc(q.reveal.album)}` : ""}</p>
        <div class="revealActs">${verdict}<a class="btn yt sm" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${q.reveal.artist} ${q.reveal.title}`)}" target="_blank" rel="noopener noreferrer">${ic("circle-play")}YouTube'da aç</a></div>
      </div>
    </div>`;
  } else {
    stage = `<div class="stage">
      <div class="countdown ${pre0 ? "on" : ""}" id="countdown" aria-hidden="true"><div class="cdRing"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/><circle class="cdArc" id="cdArc" cx="50" cy="50" r="46" pathLength="100"/></svg><b id="cdNum"></b><small>Başlıyor</small></div></div>
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
    answers = `<div class="answers ${v.solo ? "" : "multi"}">${q.options
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
      .sort((a, b) => num(b.p.round) - num(a.p.round) || num(b.r?.points) - num(a.r?.points));
    // Çubuk quiz toplamını gösterir; bu sorudan gelen kısım parlak uçta.
    const top = Math.max(1, ...v.players.map((p) => num(p.round)));
    foot = `<div class="block board"><div class="blockHead"><h2>Quiz sıralaması</h2><small class="muted">Bu soru · Toplam</small></div>${rows
      .map(
        ({ p, r }, i) => `<div class="row ${p.pid === v.me ? "me" : ""}" style="--i:${i}">${avatar(p, "sm")}<span class="rowName"><b>${esc(p.name)}</b>
        <span class="meter"><span style="width:${top ? Math.max(2, (num(p.round) / top) * 100) : 0}%"></span>${r?.correct ? `<span class="gain" style="left:${((num(p.round) - num(r.points)) / top) * 100}%;width:${(num(r.points) / top) * 100}%"></span>` : ""}</span></span>
        <span class="pts ${r?.correct ? "good" : ""}">${r?.correct ? "+" + num(r.points) : r ? "0" : "—"}${r?.correct ? `<small>${(num(r.ms) / 1000).toFixed(1)} sn</small>` : ""}</span><b class="tot" data-count="${num(p.round)}">${num(p.round)}</b></div>`,
      )
      .join("")}</div>`;
  }
  const answeredCount = q.answered.length;
  const online = v.players.filter((p) => p.online).length;
  const dock = reveal
    ? host && v.solo
      ? `<button class="btn primary lg wide" data-do="next" id="nextBtn">${v.index + 1 >= set.count ? "Sonuçları gör" : "Sonraki soru"} ${ic("chevron-right")}</button>`
      : `<p class="waiting" id="autoInfo">${spinner()} Sıradaki soru birazdan</p>`
    : `<p class="waiting">${mine ? `${ic("check")} Cevabın kilitlendi · ` : ""}<span id="ansCount">${v.solo ? "" : ansCountText(v)}</span></p>`;
  return `${mode.lost ? `<div class="banner">${spinner()} Kurucunun bağlantısı koptu, bekleniyor…</div>` : ""}
    <section class="game ${reveal ? "isReveal" : ""}">${head}${stage}${answers}${foot}${intro}</section>
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
    const rec = final ? saveBest(set, sc) : {};
    if (set?.survival) {
      const st = num(set.streak);
      return `<section class="ranking">
      <span class="kicker">${esc(set.name)} · Hayatta Kalma</span>
      <h1><span data-count="${st}">${st}</span> <small>soruluk seri</small></h1>
      <p class="muted">${rec.newStreak ? "Yeni rekor!" : rec.streak ? `Rekorun: ${num(rec.streak)}` : ""} ${st >= num(set.count) ? "Hepsini bildin, inanılmaz!" : st >= 10 ? "Çok iyi gidiyordun!" : "Bir daha dene, seriyi uzat."}</p>
      ${rec.newStreak && st > 2 ? confetti() : ""}
    </section>
    <div class="dock split"><button class="btn primary lg" data-do="again">${ic("rotate-ccw")}Tekrar dene</button><button class="btn ghost lg" data-do="leave">Ana sayfa</button></div>`;
    }
    return `<section class="ranking">
      <span class="kicker">${final ? "Oyun bitti" : esc(set?.name || "") + " bitti"}</span>
      <h1><span data-count="${sc}">${sc}</span> <small>/ ${num(maxQ)} puan</small></h1>
      ${rec.newScore ? `<p class="recNew">${ic("trophy")} Yeni rekor!</p>` : ""}
      <p class="muted">${sc >= maxQ * 0.7 ? (set?.kind === "trivia" ? "Bilgin sağlam!" : "Kulağın keskin!") : sc >= maxQ * 0.4 ? "Fena değil, bir tur daha?" : "Isınma turuydu sayalım."}</p>
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
  const next = final ? null : v.queue[v.set + 1];
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
    ${next ? `<div class="nextCard">${cover(next, "qImg")}<span class="qInfo"><small>Sıradaki quiz</small><b>${esc(next.name)}</b><small>${num(next.count)} soru · ${next.kind === "trivia" ? "Trivia" : "Şarkı"}</small></span><span class="rankLeft" id="rankLeft2"></span></div>` : ""}
  </section>
  <div class="dock split">
    ${
      host
        ? final
          ? `<button class="btn primary lg" data-do="tolobby">${ic("users")}Herkesi lobiye döndür</button><button class="btn ghost lg" data-do="leaveask">${ic("door-open")}Lobiyi kapat</button>`
          : `<button class="btn primary lg wide nextQuiz" data-do="next"><span>Sıradaki quiz: ${esc(v.queue[v.set + 1]?.name || "")}</span><span class="rankLeft" id="rankLeft"></span>${ic("chevron-right")}</button>`
        : final
          ? `<p class="waiting">${spinner()} Kurucu lobiye dönünce yeni quizlerle devam edebilirsiniz</p><button class="btn ghost" data-do="leaveask">Ayrıl</button>`
          : `<p class="waiting">${spinner()} Kurucu başlatınca ya da süre dolunca başlıyor</p>`
    }
  </div>`;
}

// Solo rekorlar (bu tarayıcıda): quiz adına göre en iyi puan ve en uzun hayatta kalma serisi
let savedFor = "";
function saveBest(set, score) {
  const l = allLists().find((x) => x.name === set?.name && (x.kind === "trivia") === (set?.kind === "trivia"));
  if (!l) return {};
  const all = bests();
  const b = { ...(all[l.id] || {}) };
  const key = mode?.code + ":" + set.id + ":" + (set.survival ? set.streak : score);
  if (savedFor === key) return { ...b, newScore: b.lastNew === "s", newStreak: b.lastNew === "k" };
  savedFor = key;
  b.lastNew = "";
  if (set.survival) {
    if (num(set.streak) > num(b.streak)) (b.streak = num(set.streak)), (b.lastNew = "k");
  } else if (score > num(b.score)) (b.score = score), (b.lastNew = "s");
  all[l.id] = b;
  store.set("jqBest", all);
  return { ...b, newScore: b.lastNew === "s", newStreak: b.lastNew === "k" };
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
  // Quiz arası: sıradaki quize geri sayım (çok oyunculu)
  if (screen === "room" && view?.phase === "ranking" && view.rankAt) {
    const t = `${Math.max(0, Math.ceil((view.rankAt - hostNow()) / 1000))} sn`;
    for (const id of ["rankLeft", "rankLeft2"]) {
      const el = document.getElementById(id);
      if (el) el.textContent = t;
    }
    return;
  }
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
      // ilk soruda önce quiz kartı görünür; sayı yalnızca son 3 saniyede çıkar
      const cdOn = pre && q.start - now <= 3000;
      const s = cdOn ? String(Math.ceil((q.start - now) / 1000)) : "";
      cd.classList.toggle("on", cdOn);
      const n = $("#cdNum");
      const inN = $("#inNum");
      if (inN && inN.textContent !== s) inN.textContent = s;
      if (n && n.textContent !== s) {
        if (s) sfx("tick");
        else if (n.textContent && !pre) sfx("go");
        n.textContent = s;
        cd.dataset.s = s;
        // Her yeni saniyede sayı ve dalga animasyonunu yeniden başlat
        cd.classList.remove("beat");
        void cd.offsetWidth;
        cd.classList.add("beat");
      }
      const arc = $("#cdArc");
      if (arc && pre) arc.style.strokeDashoffset = 100 - (((q.start - now) % 1000) / 1000) * 100;
    }
    const used = playsUsed(q.id);
    const disc = $("#disc");
    if (disc) {
      const can = !pre && left > 0 && used < 3 && !q.mine && !player.playing && !player.loading;
      disc.disabled = !can && !player.playing;
      disc.classList.toggle("on", player.playing && player.qid === q.id);
      disc.classList.toggle("tap", !!player.needTap && can && !used);
      $("#listenLabel").textContent = player.loading
        ? "Yükleniyor…"
        : player.playing
        ? "Çalıyor…"
        : q.mine
          ? "Cevap verildi"
          : pre
            ? "Hazırlan"
            : player.needTap && !used
            ? "Dinlemek için dokun"
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
  if (kind === "hidden") {
    const list = hiddenList();
    sheetBody.innerHTML = `<div class="sheetHead"><h2>Gizlenen quizler</h2><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
      <p class="muted">Bunlar yalnızca sana gösterilmiyor. Yanlışlıkla gizlediysen geri açabilirsin.</p>
      ${list.length ? `<ol class="hidList">${list.map((x) => `<li>${ic("eye-off")}<span><b>${esc(x.name || "Adsız quiz")}</b>${x.author ? `<small>${esc(x.author)}</small>` : ""}</span><button class="btn soft sm" data-unhide="${esc(x.id)}">${ic("eye")}Geri göster</button></li>`).join("")}</ol>` : `<p class="muted">Gizlenen quiz yok.</p>`}`;
  }
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
// Profil seçmeden geçen oyuncuya rastgele ad, simge ve renk ver; bekleyen işi (lobi, oyun) sürdür
function autoProfile() {
  if (profile) return closeSheet();
  const ed = sheetCtx?.ed || {};
  const rnd = (l) => l[Math.floor(Math.random() * l.length)];
  profile = { name: ($("#pName")?.value || "").trim() || ed.suggest || randomName(), avatar: ed.avatar || rnd(AVATARS), color: ed.color || rnd(COLORS), photo: ed.photo || "" };
  store.set("jqProfile", profile);
  const then = sheetCtx?.then;
  sheetCtx = {};
  closeSheet();
  topbar();
  toast(`Adın: ${profile.name}. Sağ üstten istediğin zaman değiştirebilirsin.`);
  then?.();
}
sheet.addEventListener("cancel", (e) => { if (sheetCtx?.kind === "profile" && !profile) { e.preventDefault(); autoProfile(); } });
sheet.addEventListener("click", (e) => {
  if (e.target !== sheet) return;
  if (sheetCtx?.kind === "profile" && !profile) return autoProfile();
  closeSheet();
});

function profileSheet() {
  const ed = (sheetCtx.ed ??= { name: "", avatar: "headphones", color: "coral", photo: "", ...(profile || {}) });
  sheetBody.innerHTML = `<div class="sheetHead"><h2>${profile ? "Profilin" : "Adını seç"}</h2>${profile ? `<button class="icon" data-close aria-label="Kapat">${ic("x")}</button>` : `<button class="icon" data-do="skipProfile" aria-label="Geç, rastgele bir ad ver" title="Geç (rastgele ad)">${ic("x")}</button>`}</div>
    <div class="profPreview">${avatar(ed, "xl")}</div>
    <label class="field"><span>Oyuncu adı</span><span class="nameRow"><input id="pName" maxlength="20" value="${esc(ed.name)}" placeholder="${esc(ed.suggest ??= randomName())}" autocomplete="nickname"><button type="button" class="icon soft" data-do="rollName" aria-label="Rastgele ad" title="Rastgele ad">${ic("dices")}</button></span></label>
    ${profile ? "" : `<p class="muted small">Boş bırakırsan ya da geçersen sana rastgele bir ad verilir; sonra istediğin zaman değiştirebilirsin.</p>`}
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

function justPublished() {
  try {
    const q = JSON.parse(sessionStorage.getItem("jqJustPublished"));
    if (q && q.id && q.kind === "trivia") return { ...q, items: cleanItems(q.items), mine: true, genre: "Topluluk" };
    return q && q.id && Array.isArray(q.tracks) ? { ...q, tracks: cleanTracksLite(q.tracks), mine: true, genre: "Topluluk" } : null;
  } catch {
    return null;
  }
}
const cleanTracksLite = (arr) => arr.filter((t) => t && Number.isSafeInteger(t.id) && typeof t.title === "string").map((t) => ({ id: t.id, title: t.title.slice(0, 120), artist: String(t.artist || "").slice(0, 80), cover: cdn(t.cover) }));
async function loadCommunity() {
  const jp = justPublished();
  if (jp && !ui.community) ui.community = [jp];
  try {
    const list = await fetchCommunity();
    ui.community = jp && !list.some((x) => x.id === jp.id) ? [jp, ...list] : list;
    ui.communityErr = false;
  } catch {
    ui.community = [];
    ui.communityErr = true;
  }
  if (screen === "home" && !mode && !sheet.open) renderHome();
}

function pickerSheet() {
  const lists = allLists();
  sheetBody.innerHTML = `<div class="sheetHead"><h2>Quiz ekle</h2><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
    <form class="search" id="pickSearch">${ic("search")}<input id="pickQ" type="search" placeholder="Başka sanatçı ara…"><button class="btn soft" type="submit">Ara</button></form>
    <div id="pickResults"></div>
    <div class="pickGrid">${lists
      .map((l) => `<button class="pickItem" data-list="${esc(l.id)}">${cover(l, "pImg")}<b>${esc(l.name)}</b></button>`)
      .join("")}</div>`;
}

function setupFoot(enqueue, disabled = "") {
  return enqueue
    ? `<button class="btn primary wide" data-do="enqueue" ${disabled}>${ic("list-plus")}Sıraya ekle</button>`
    : `<button class="btn ghost" data-do="soloGo" ${disabled}>${ic("play")}Solo oyna</button><button class="btn primary" data-do="hostGo" ${disabled}>${ic("users")}Arkadaşlarla oyna</button>`;
}
// Quiz ayarları (soru sayısı, cevap türü, kesit, şarkı seçimi): hem lobideki pencerede hem detay sayfasında
function optsHtml(l) {
  if (l.kind === "trivia") {
    const n = num(l.items?.length);
    const counts = [5, 10, 15, 20, 30].filter((c) => c < n);
    if (!counts.includes(sheetCtx.count) && sheetCtx.count !== n) sheetCtx.count = Math.min(10, n);
    return `<div class="opts">
        <div class="opt optCount"><span>Soru sayısı</span><div class="seg" data-opt="count">${[...counts, n].map((c) => `<button data-v="${c}" aria-pressed="${sheetCtx.count === c}">${c === n ? `Hepsi (${c})` : c}</button>`).join("")}</div></div>
      </div>`;
  }
  return `<div class="opts">
      <div class="opt"><span>Soru sayısı</span><div class="seg" data-opt="count">${[5, 10, 15, 20, 30].map((n) => `<button data-v="${n}" aria-pressed="${sheetCtx.count === n}">${n}</button>`).join("")}</div></div>
      <div class="opt"><span>Cevap</span><div class="seg" data-opt="mode"><button data-v="choice" aria-pressed="${sheetCtx.mode === "choice"}">Şıklı</button><button data-v="text" aria-pressed="${sheetCtx.mode === "text"}">Yazarak</button></div></div>
      <div class="opt"><span>Kesit uzunluğu</span><div class="seg" data-opt="clip">${[5, 3, 1].map((n) => `<button data-v="${n}" aria-pressed="${sheetCtx.clip === n}">${LEVELS[n]} · ${n} sn</button>`).join("")}</div></div>
    </div>
    <details class="tracks" id="tracksBox"><summary>${ic("list-music")} Şarkıları seç <span id="selCount"></span></summary><div id="trackList"><p class="muted">${spinner()}</p></div></details>`;
}
async function fillTracks(l, ok) {
  try {
    const tracks = await loadTracks(l);
    if (sheetCtx.list !== l || !ok()) return;
    sheetCtx.tracks = tracks;
    sheetCtx.ids ??= new Set(tracks.map((t) => t.id));
    if ($("#trackCount")) $("#trackCount").textContent = `${tracks.length} şarkı`;
    drawTracks();
    $$("[data-needtracks]").forEach((b) => (b.disabled = false));
  } catch (e) {
    if ($("#trackCount")) $("#trackCount").textContent = e.message;
    if ($("#trackList")) $("#trackList").innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}
async function setupSheet() {
  const l = sheetCtx.list;
  const enqueue = mode && mode.role !== "solo" && isHost();
  if (l.kind === "trivia") {
    const n = num(l.items?.length);
    sheetBody.innerHTML = `<div class="sheetHead setupHead">${cover(l, "sImg")}<div><small class="kicker">Trivia · ${esc(l.cat || "")}</small><h2>${esc(l.name)}</h2><small class="muted">${n} soru${l.author ? ` · ${esc(l.author)}` : ""}</small></div><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
      ${l.desc ? `<p class="muted">${esc(l.desc)}</p>` : ""}
      ${optsHtml(l)}
      <p class="hint">Süre bitmeden doğru şıkkı seç; ne kadar hızlıysan o kadar puan. Cevap süresini lobiden değiştirebilirsin.</p>
      <div class="sheetFoot">${setupFoot(enqueue)}</div>`;
    return;
  }
  sheetBody.innerHTML = `<div class="sheetHead setupHead">${cover(l, "sImg")}<div><small class="kicker">${esc(l.genre || "Quiz")}</small><h2>${esc(l.name)}</h2><small class="muted" id="trackCount">${spinner()} Şarkılar yükleniyor…</small></div><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
    ${optsHtml(l)}
    <div class="sheetFoot">${setupFoot(enqueue, "disabled")}</div>`;
  $$(".sheetFoot .btn").forEach((b) => (b.dataset.needtracks = "1"));
  fillTracks(l, () => sheet.open);
}

// ---------- quiz detay sayfası: kapak, bilgiler, oyun türü ve modu, BAŞLA ----------
const bests = () => store.get("jqBest", {});
function renderDetail() {
  const l = sheetCtx.list;
  const trivia = l.kind === "trivia";
  const b = bests()[l.id] || {};
  const n = trivia ? num(l.items?.length) : num(l.tracks?.length);
  const surv = trivia && sheetCtx.gmode === "survival";
  app.innerHTML = `<section class="dt" data-g="${surv ? "survival" : "normal"}" data-play="${esc(sheetCtx.play)}">
    <button class="dtBack" data-go="home">${ic("arrow-left")}Tüm quizler</button>
    <div class="dtGrid">
      <aside class="dtCard">
        <div class="dtArt">${cover(l, "dtImg", true)}</div>
        <div class="dtShade"></div>
        <div class="dtCardInfo">
          <h1>${esc(l.name)}</h1>
          <div class="dtStats">
            <span>${ic(trivia ? "circle-help" : "list-music")}<b id="trackCount">${trivia ? `${n} soru` : n ? `${n} şarkı` : `${spinner()} şarkılar`}</b></span>
            <span>${ic("layers")}${esc(trivia ? l.cat || "Trivia" : l.genre || "Müzik")}</span>
            ${b.score ? `<span>${ic("trophy")}${num(b.score)}</span>` : ""}
          </div>
          ${l.author ? `<div class="dtBy">${ic("user")}<span><small>Oluşturan</small><b>${esc(l.author)}</b></span></div>` : ""}
        </div>
      </aside>
      <div class="dtPanel">
        <span class="kicker">${trivia ? "Trivia" : "Şarkı quizi"}</span>
        <h2>${esc(l.name)}</h2>
        ${l.desc ? `<p class="dtDesc">${esc(l.desc)}</p>` : `<p class="dtDesc">${trivia ? "Dört şıktan doğrusunu süre bitmeden bul; ne kadar hızlıysan o kadar puan." : "Kesiti dinle, şarkının adını herkesten önce bul."}</p>`}
        <div class="dtLabel">Nasıl oynamak istersin?</div>
        <div class="dtChoice" data-opt="play">
          <button data-v="solo" aria-pressed="${sheetCtx.play === "solo"}">${ic("user")}<span><b>Solo</b><small>Tek başına oyna</small></span></button>
          <button data-v="party" aria-pressed="${sheetCtx.play === "party"}">${ic("users")}<span><b>Arkadaşlarla</b><small>Lobi kur, bağlantıyı gönder</small></span></button>
        </div>
        ${trivia ? `<div class="dtLabel">Oyun modu</div>
        <div class="dtChoice modes" data-opt="gmode">
          <button data-v="normal" aria-pressed="${!surv}">${ic("shuffle")}<span><b>Rastgele</b><small>Seçtiğin sayıda karışık soru</small></span></button>
          <button data-v="survival" aria-pressed="${surv}" class="onlySolo">${ic("heart")}<span><b>Hayatta Kalma</b><small>İlk yanlışta oyun biter${b.streak ? ` · rekorun ${num(b.streak)}` : ""}</small></span></button>
        </div>` : ""}
        <div class="dtOpts">${optsHtml(l)}</div>
        <button class="btn primary xl wide dtStart" data-do="detailGo" ${trivia ? "" : "disabled data-needtracks=1"}>${ic("sparkles")}Başla</button>
        ${b.score || b.streak ? `<div class="dtRec">${ic("trophy")}<span>Rekorların: ${b.score ? `<b>${num(b.score)}</b> puan` : ""}${b.score && b.streak ? " · " : ""}${b.streak ? `<b>${num(b.streak)}</b> soruluk seri` : ""}</span></div>` : ""}
      </div>
    </div>
  </section>`;
  if (!trivia) fillTracks(l, () => screen === "detail");
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
  if (list.kind === "trivia") {
    const survival = sheetCtx.gmode === "survival" && sheetCtx.play !== "party";
    return { type: "add", kind: "trivia", list: { name: list.name, emoji: list.emoji || "" }, items: list.items, count: survival ? list.items.length : count, mode: "choice", clip: 0, survival };
  }
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
  const l = allLists().find((x) => String(x.id) === String(id));
  if (!l) return;
  const last = store.get("jqSetup", {});
  const ctx = { list: l, count: last.count || 10, mode: last.mode || "choice", clip: last.clip || 3, play: "solo", gmode: "normal" };
  // Lobide kurucu quiz eklerken pencere; ana sayfada tam detay sayfası
  if (mode && mode.role !== "solo" && isHost()) return openSheet("setup", ctx);
  sheetCtx = ctx;
  screen = "detail";
  render();
  scrollTo({ top: 0 });
}

// ---------- Sayı Quizi: "hangisi daha büyük?" (solo, seri) ----------
let nq = null;
function pickPair(cat, keep) {
  const items = cat.items;
  for (let t = 0; t < 400; t++) {
    const a = keep || items[Math.floor(Math.random() * items.length)];
    const b = items[Math.floor(Math.random() * items.length)];
    if (a === b || !farEnough(cat, a, b)) continue;
    if (nq?.recent?.includes(b.n) && t < 300) continue;
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }
  return [items[0], items[items.length - 1]];
}
function startNumber(id) {
  const cat = NUMCATS.find((c) => c.id === id);
  if (!cat) return;
  if (mode) leaveRoom(true);
  nq = { cat, streak: 0, phase: "pick", recent: [], pair: null, pick: -1 };
  nq.pair = pickPair(cat);
  screen = "number";
  render();
  scrollTo({ top: 0 });
}
function numSide(x, i) {
  const shown = nq.phase !== "pick" && (nq.phase !== "half" || i === nq.pick);
  const win = nq.phase === "done" || nq.phase === "over" ? (nq.pair[i].v >= nq.pair[1 - i].v ? "win" : "lose") : "";
  return `<button class="nqSide s${i} ${win} ${nq.pick === i ? "picked" : ""}" data-npick="${i}" ${nq.phase === "pick" ? "" : "disabled"} style="--h:${(nq.cat.hue + i * 40) % 360}">
    ${x.f ? `<img class="nqBg" src="${esc(flagUrl(x.f))}" alt="">` : `<span class="nqEmo">${x.e || nq.cat.emoji}</span>`}
    <span class="nqName">${esc(x.n)}</span>
    <span class="nqVal ${shown ? "on" : ""}" ${shown ? `data-val="${x.v}"` : ""}>${shown ? esc(fmtNum(x.v, nq.cat.fmt)) : "?"}</span>
    ${nq.phase === "pick" ? `<span class="nqTap">Seçmek için dokun</span>` : ""}
  </button>`;
}
function renderNumber() {
  if (!nq) return (screen = "home"), render();
  const best = numBest(nq.cat.id);
  const mid = nq.phase === "done" ? `<span class="nqVs ok">${nq.streak}</span>` : nq.phase === "over" ? `<span class="nqVs bad">${ic("x")}</span>` : `<span class="nqVs">VS</span>`;
  app.innerHTML = `<section class="nq">
    <div class="nqTop"><button class="icon" data-do="numExit" aria-label="Çık">${ic("x")}</button><span class="nqAsk"><small>${nq.cat.emoji} ${esc(nq.cat.name)}</small><b>${esc(nq.cat.ask)}</b></span><span class="nqStreak">Seri <b>${nq.streak}</b>${best ? `<small>Rekor ${best}</small>` : ""}</span></div>
    <div class="nqBoard">${numSide(nq.pair[0], 0)}${mid}${numSide(nq.pair[1], 1)}</div>
    ${nq.phase === "over" ? `<div class="nqOver"><div><span class="kicker">Oyun bitti</span><h2>Seri: ${nq.streak}</h2><p>${nq.newBest ? "Yeni rekor!" : best ? `Rekorun ${best}` : ""}</p><div class="nqBtns"><button class="btn primary lg" data-do="numAgain">${ic("rotate-ccw")}Tekrar oyna</button><button class="btn ghost lg" data-do="numExit">Kategoriler</button></div></div></div>` : ""}
  </section>`;
  animateCounts();
  $$(".nqVal.on").forEach((el) => countUp(el));
}
// Açılan değeri sıfırdan sayarak göster
function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const v = Number(el.dataset.val), fmt = nq.cat.fmt, t0 = performance.now(), dur = fmt === "year" ? 500 : 700;
  if (fmt === "year") return;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmtNum(v * (1 - Math.pow(1 - k, 3)), fmt);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
    else el.textContent = fmtNum(v, fmt);
  };
  requestAnimationFrame(step);
}
function numPick(i) {
  if (!nq || nq.phase !== "pick") return;
  nq.pick = i;
  nq.phase = "half";
  renderNumber();
  setTimeout(() => {
    if (!nq || nq.phase !== "half") return;
    const ok = nq.pair[i].v >= nq.pair[1 - i].v;
    if (ok) nq.streak++;
    nq.phase = ok ? "done" : "over";
    if (!ok) {
      const all = store.get("jqNumBest", {});
      nq.newBest = nq.streak > num(all[nq.cat.id]);
      if (nq.newBest) (all[nq.cat.id] = nq.streak), store.set("jqNumBest", all);
    }
    renderNumber();
    if (ok)
      setTimeout(() => {
        if (!nq || nq.phase !== "done") return;
        // Kazanan tarafta kalır; yanına yeni bir rakip gelir
        const keep = nq.pair[0].v >= nq.pair[1].v ? nq.pair[0] : nq.pair[1];
        nq.recent = [...nq.recent, ...nq.pair.map((x) => x.n)].slice(-8);
        nq.pair = pickPair(nq.cat, keep);
        nq.pick = -1;
        nq.phase = "pick";
        renderNumber();
      }, 1500);
  }, 850);
}

// ---------- olaylar ----------
async function doAction(a, el) {
  switch (a) {
    case "create":
      return startHost();
    case "detailGo":
      if (sheetCtx.list?.kind === "trivia") sheetCtx.survival = sheetCtx.gmode === "survival";
      return doAction(sheetCtx.play === "party" ? "hostGo" : "soloGo");
    case "randomQuiz": {
      const pool = [...PRESETS, ...TRIVIA];
      return openList(pool[Math.floor(Math.random() * pool.length)].id);
    }
    case "numHome":
      ui.genre = "Sayı";
      ui.cat = "";
      screen = "home";
      render();
      return document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    case "numAgain":
      return startNumber(nq.cat.id);
    case "numExit":
      nq = null;
      screen = "home";
      ui.genre = "Sayı";
      render();
      return document.getElementById("catalog")?.scrollIntoView({ block: "start" });
    case "toCatalog":
      return document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    case "toTrivia":
      ui.genre = "Trivia";
      ui.cat = "";
      renderHome();
      return document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    case "sfx":
      setSfx(!sfxEnabled());
      lastSig = "";
      return render();
    case "again":
      return act({ type: "again" });
    case "tolobby":
      return act({ type: "lobby" });
    case "reset":
      return act({ type: "reset" });

    case "listen":
      if (el.dataset.pressed) return;
      return listen();
    case "rollName": {
      const inp = $("#pName");
      inp.value = randomName();
      sheetCtx.ed.name = inp.value;
      return;
    }
    case "skipProfile":
      return autoProfile();
    case "saveProfile": {
      const ed = sheetCtx.ed;
      ed.name = $("#pName").value.trim() || ed.suggest || randomName();
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
      if (payload.kind !== "trivia") store.set("jqSetup", { count: payload.count, mode: payload.mode, clip: payload.clip });
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

// Şıklar ve plak normal "click" ile işlenir: basıp parmağını / fareyi şıkkın dışına kaydırıp
// bırakırsan seçilmiş sayılmaz (telefonda kaydırırken yanlışlıkla cevap vermeyi önler).
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button, [data-close]");
  if (!b || b.disabled) return;
  const d = b.dataset;
  try {
    if ("close" in d) return closeSheet();
    if (d.go) {
      // Tek başına oynarken ana sayfaya dönmek oyunu bitirir (geri dönülecek bir lobi yok).
      if (d.go === "home" && (mode?.role === "solo" || hostAlone())) return leaveRoom();
      screen = d.go === "room" && mode ? "room" : "home";
      lastSig = "";
      return render();
    }
    if (d.sheet) return openSheet(d.sheet);
    if (d.do) return await doAction(d.do, b);
    if (d.list) return openList(d.list);
    if (d.numcat) return startNumber(d.numcat);
    if (d.npick !== undefined) return numPick(Number(d.npick));
    if (d.tab && d.scroll) {
      ui.genre = d.tab;
      ui.cat = "";
      renderHome();
      return document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (d.sub !== undefined) {
      ui.cat = d.sub;
      return renderHome();
    }
    if (d.tab) {
      const from = ui.genre;
      ui.genre = d.tab;
      ui.cat = d.cat || "";
      ui.results = null;
      if (d.tab === "Topluluk" && (ui.communityErr || ui.community?.length === 0)) (ui.community = null), loadCommunity();
      renderHome();
      // Keşfet'ten bir rafa geçerken katalogun başına kaydır
      if (from === "Keşfet" && d.tab !== "Keşfet") document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (d.genre) {
      ui.genre = d.genre;
      ui.cat = "";
      if (d.genre === "Topluluk" && (ui.communityErr || ui.community?.length === 0)) (ui.community = null), loadCommunity();
      return renderHome();
    }
    if (d.requeue) return act({ type: "requeue", id: d.requeue });
    if (d.edit) {
      location.href = "create/?edit=" + encodeURIComponent(d.edit);
      return;
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
      const q = (ui.community || []).find((x) => x.id === d.hidequiz);
      hideQuiz(q || d.hidequiz);
      ui.community = (ui.community || []).filter((x) => x.id !== d.hidequiz);
      topbar();
      toast("Gizlendi. Profilinin yanındaki göz simgesinden geri açabilirsin.");
      return renderHome();
    }
    if (d.unhide) {
      unhideQuiz(d.unhide);
      ui.community = null;
      loadCommunity();
      topbar();
      if (hiddenList().length) openSheet("hidden");
      else closeSheet();
      return toast("Quiz yeniden gösteriliyor.");
    }
    if (d.unsave) {
      removeCustom(d.unsave);
      return renderHome();
    }
    if (d.hit) return pickHit(Number(d.hit));
    if (d.pressed) return; // basıldığı anda işlendi
    if (d.ans !== undefined) {
      sfx("lock");
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
      sheetCtx[k] = Number.isNaN(Number(d.v)) ? d.v : Number(d.v);
      $$("button", b.parentElement).forEach((x) => x.setAttribute("aria-pressed", x === b));
      const dt = $(".dt");
      if (dt && k === "gmode") dt.dataset.g = d.v;
      if (dt && k === "play") dt.dataset.play = d.v;
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
  if (t.id === "vol") {
    const v = Number(t.value) / 100;
    audio.volume = v;
    store.set("jqVolume", v);
  }

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
// Sayfa yenilenirken lobi kapanmasın (kurucu geri dönebilir); "Ayrıl" ise lobiyi herkes için kapatır.
window.addEventListener("beforeunload", () => mode?.net?.close({ quiet: true }));

// ---------- açılış ----------
function boot() {
  const tab = new URLSearchParams(location.search).get("tab");
  if (tab === "topluluk") ui.genre = "Topluluk";
  if (tab === "muzik") ui.genre = "Müzik";
  if (tab === "trivia") ui.genre = "Trivia";
  if (tab === "senin" && customLists().length) ui.genre = "Senin";
  if (tab) history.replaceState(null, "", location.pathname);
  loadCommunity();
  loadPresetPictures().then((changed) => {
    if (changed && screen === "home" && !mode) renderHome();
  });
  const saved = store.get("jqSession", null, sessionStorage);
  const invite = ((new URLSearchParams(location.search).get("room") || new URLSearchParams(location.search).get("oda")) || "").toUpperCase();
  if (saved?.role === "host" && saved.game) {
    try {
      startHost({ restore: typeof saved.game === "string" ? unseal(saved.game) : saved.game });
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
