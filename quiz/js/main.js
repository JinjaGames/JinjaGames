import { PRESETS, MIXES, loadTracks, searchArtists, customLists, saveCustom, removeCustom, fold, cdn, realPic, loadPresetPictures } from "./music.js?v=5";
import { sfx, sfxEnabled, setSfx, setSfxVolume } from "./sfx.js?v=4";
import { randomName } from "./names.js";
import { fetchCommunity, removeQuiz, hideQuiz, unhideQuiz, hiddenList } from "./community.js?v=7";
import { Game, MAX_PLAYERS, RANK_PTS, OP_PTS } from "./engine.js?v=9";
import { lbKey, loadBoard, peekBoard, submitScore, myBest, isMine, LB_TOP, LB_QUESTIONS } from "./board.js?v=2";
import { maskName } from "./badwords.js?v=1";
import { RANK_QUIZZES, RANK_CATS, rankItems, fromYouTube } from "./rank.js?v=4";
import { TRIVIA, TCATS, TART, EMOJIS, cleanItems, IMG, ANI_IMG, FLAG, flagUrl, cleanEmo } from "./trivia.js?v=3";
import { ANIME_QUIZZES, ERAS, animeItems, animeOps } from "./anime.js?v=3";
import { NUMCATS, fmtNum, farEnough } from "./numdata.js";
import { hostRoom, guestRoom, newCode, validCode } from "./net.js?v=2";

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
// Yüklenirken iskelet görünüm (dönen simge yerine içeriğin taslağı)
const skRows = (n = 4) => `<div class="skWrap" aria-busy="true" aria-label="Yükleniyor">${Array.from({ length: n }, (_, i) => `<div class="skRow" style="--i:${i}"><span class="sk skAv"></span><span class="skCol"><span class="sk skL" style="width:${60 - (i % 3) * 12}%"></span><span class="sk skL" style="width:${34 + (i % 2) * 10}%"></span></span></div>`).join("")}</div>`;
const skCards = (n = 4) => Array.from({ length: n }, (_, i) => `<div class="skCard" style="--i:${i}" aria-hidden="true"><span class="sk skArt"></span><span class="sk skL" style="width:70%"></span><span class="sk skL" style="width:45%"></span></div>`).join("");

const AVATARS = ["headphones", "guitar", "mic-vocal", "disc-3", "radio", "drum"];
const COLORS = ["coral", "violet", "mint", "gold", "sky", "rose"];
const LEVELS = { 5: "Kolay", 3: "Orta", 1: "Zor" };
// tersten çalınan quizde zorluklar: kolay 10, orta 5, zor 3 sn
const RLEVELS = { 10: "Kolay", 5: "Orta", 3: "Zor" };
const lvl = (clip, rev) => (rev ? RLEVELS : LEVELS)[clip] || "";
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{1,30000}$/;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Kurucudan gelen oyun durumu (başka birinin tarayıcısı) tür tür süzülür: sayılar sayı, kimlikler
// güvenli karakter, adresler yalnızca Deezer CDN'i, profil parçaları izin listesinden.
const NUM = new Set(["ys", "slots", "rankAt", "pts", "count", "clip", "score", "round", "points", "ms", "index", "set", "seconds", "start", "end", "offset", "autoAt", "now", "streak", "lbr", "hits", "pool"]);
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
  if (k === "pic") return IMG.test(x || "") || ANI_IMG.test(x || "") ? x : null;
  if (k === "flag") return FLAG.test(x || "") ? x : null;
  if (k === "emo") return cleanEmo(x) || null;
  if (k === "avatar") return AVATARS.includes(x) ? x : "headphones";
  if (k === "color") return COLORS.includes(x) ? x : "coral";
  if (k === "art") return x === "hero" ? "hero" : "";
  if (k === "emoji") return EMOJIS.includes(x) ? x : "";
  if (k === "kind") return ["trivia", "rank", "op"].includes(x) ? x : "song";
  if (k === "lid") return lbKey(x);
  if (k === "yt") return /^[\w-]{11}$/.test(x || "") ? x : null;
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
// Kulak sesi doğrusal duymaz: çubuk kareli eğriyle uygulanır. 0 = tamamen sessiz, en sağ = sesin tamamı.
const gainOf = (v) => (v <= 0.001 ? 0 : v * v);
audio.volume = gainOf(volume());
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
  audio.volume = gainOf(volume());
  audio.muted = audio.volume === 0;
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
  try { rsrc?.stop(); } catch {}
  rsrc = null;
  if (player.playing) audio.pause();
  player.playing = false;
  document.body.classList.remove("playing");
}
const playsKey = (qid) => "jqPlays:" + qid;
const playsUsed = (qid) => store.get(playsKey(qid), 0, sessionStorage);
// Tersten çalma: önizleme indirilir, kesit ters çevrilip Web Audio ile çalınır.
let rctx = null, rsrc = null, rgain = null;
const rcache = new Map();
async function reversedClip(url, offset, clip) {
  rctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (rctx.state === "suspended") await rctx.resume();
  const key = `${url}|${offset}|${clip}`;
  if (!rcache.has(key)) {
    rcache.set(key, (async () => {
      const buf = await (await fetch(url)).arrayBuffer();
      const full = await rctx.decodeAudioData(buf);
      const sr = full.sampleRate, a = Math.floor(offset * sr), len = Math.min(full.length - a, Math.floor(clip * sr));
      const out = rctx.createBuffer(full.numberOfChannels, len, sr);
      for (let ch = 0; ch < full.numberOfChannels; ch++) {
        const src = full.getChannelData(ch).subarray(a, a + len), dst = out.getChannelData(ch);
        for (let i = 0; i < len; i++) dst[i] = src[len - 1 - i];
      }
      return out;
    })());
    rcache.get(key).catch(() => rcache.delete(key));
  }
  return rcache.get(key);
}
async function listenReversed(q, auto) {
  player.loading = true;
  player.needTap = false;
  paint();
  try {
    const buf = await reversedClip(cdn(q.url), q.offset, q.clip);
    if (view?.question?.id !== q.id) { player.loading = false; return; }
    if (rctx.state !== "running") throw Object.assign(Error("tap"), { name: "NotAllowedError" });
    const g = (rgain = rctx.createGain());
    g.gain.value = gainOf(volume());
    rsrc = rctx.createBufferSource();
    rsrc.buffer = buf;
    rsrc.connect(g).connect(rctx.destination);
    rsrc.start();
  } catch (e) {
    player.loading = false;
    if (e.name === "NotAllowedError") player.needTap = true;
    if (!auto) fail(e.name === "NotAllowedError" ? Error("Dinlemek için butona dokun.") : Error("Kesit yüklenemedi. Tekrar dinle'ye bas."));
    paint();
    return;
  }
  player.loading = false;
  store.set(playsKey(q.id), playsUsed(q.id) + 1, sessionStorage);
  player.playing = true;
  player.qid = q.id;
  player.startedAt = performance.now();
  player.clip = q.clip * 1000;
  document.body.classList.add("playing");
  player.stopT = setTimeout(() => { stopClip(); paint(); }, q.clip * 1000);
  paint();
}
async function listen(auto = false) {
  const q = view?.question;
  if (!q || view.phase !== "question" || !q.url || player.playing || q.mine) return;
  const now = hostNow();
  if (now < q.start || now >= q.end || playsUsed(q.id) >= 3) return;
  if (player.loading) return;
  if (q.reverse) return listenReversed(q, auto);
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
    sfx(r?.correct ? (q.kind === "rank" ? "perfect" : "good") : r?.partial ? "partial" : "bad");
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
  return [...PRESETS, ...MIXES, ...RANK_QUIZZES, ...ANIME_QUIZZES, ...TRIVIA, ...(ui.community || []), ...customLists().map((l) => ({ ...l, genre: "Senin" }))];
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
// Ana ekran arka planda (topluluk quizleri, görseller yüklenince) yeniden çizilebilir:
// yazılmakta olan lobi kodunu, imleci ve odağı koru.
function renderHome() {
  const keep = ["joinCode", "search"].map((id) => { const el = document.getElementById(id); return el && { id, v: el.value, f: document.activeElement === el, a: el.selectionStart, b: el.selectionEnd }; }).filter(Boolean);
  drawHome();
  for (const k of keep) {
    const el = document.getElementById(k.id);
    if (!el) continue;
    el.value = k.v;
    if (k.f) { el.focus({ preventScroll: true }); try { el.setSelectionRange(k.a, k.b); } catch {} }
  }
}
function drawHome() {
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
    <button class="mode m-rev" data-tab="Tersten" data-scroll="1"><span class="modeIc">${ic("rewind")}</span><b>Tersten Şarkı <em>Yeni</em></b><small>${MIXES.length} karma liste, şarkı tersten çalar</small><i class="modeGo">${ic("chevron-right")}</i></button>
    <button class="mode m-rank" data-tab="Sıralama" data-scroll="1"><span class="modeIc">${ic("list-ordered")}</span><b>Sıralama <em>Yeni</em></b><small>En çok dinlenen 5 şarkıyı sırala</small><i class="modeGo">${ic("chevron-right")}</i></button>
    <button class="mode m-anime" data-tab="Anime" data-scroll="1"><span class="modeIc">${ic("tv")}</span><b>Anime <em>Yeni</em></b><small>Karakter, kapak ve yıl quizleri</small><i class="modeGo">${ic("chevron-right")}</i></button>
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
          ${rail("Sıralama quizleri", "list-ordered", RANK_QUIZZES.slice(0, 24).map((l, k) => acard(l, k)).join(""), "Sıralama")}
          ${rail("Tersten şarkı quizi", "rewind", MIXES.map((l, k) => acard(l, k)).join(""), "Tersten")}
          ${rail("Anime quizleri", "tv", ANIME_QUIZZES.map((l, k) => qcard(l, k)).join(""), "Anime")}
          ${triviaRail(commTrivia)}
          ${numRail()}
          ${rail("Topluluk quizleri", "users", comm.slice(0, 12).map((l, k) => qcard(l, k)).join("") || communityState(), comm.length ? "Topluluk" : "")}
          ${mine.length ? rail("Senin quizlerin", "bookmark", mine.map((l, k) => qcard(l, k)).join(""), "Senin") : ""}`
    }
  </section>

  <section class="hm-make">
    <div class="hm-makeArt" aria-hidden="true">${pics.length >= 3 ? pics.slice(0, 5).map((u, k) => `<img src="${esc(u)}" alt="" style="--k:${k}">`).join("") : TRIVIA.slice(0, 5).map((t, k) => `<span class="mkEmo" style="--k:${k};--h:${hue(t.name)}">${t.emoji}</span>`).join("")}</div>
    <div><span class="kicker">${ic("sparkles")} Kendi quizin</span><h2>Kendi quizini yap, herkes oynasın.</h2>
      <p>Şarkı, tersten şarkı, trivia, sıralama ya da anime opening: türünü seç, quizini kur. Herkese açık yayınlarsan Topluluk'ta herkes görür.</p>
      <div class="hm-actions"><a class="btn primary lg" href="create/">${ic("sparkles")}Kendi quizini oluştur</a></div></div>
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
  ["Sıralama", "list-ordered", "En çok dinlenenleri doğru sırala"],
  ["Tersten", "rewind", "Tersten dinle, şarkıyı bil"],
  ["Anime", "tv", "Anime'yi ne kadar biliyorsun?"],
  ["Trivia", "circle-help", "Ne kadar biliyorsun?"],
  ["Sayı", "hash", "Hangisi daha büyük?"],
  ["Topluluk", "users", "Topluluğun quizleri"],
  ["Senin", "bookmark", "Senin quizlerin"],
];
const SUBS = { Müzik: ["Rap", "Pop", "Rock"], Sıralama: RANK_CATS, Tersten: ["Pop", "Rap", "Rock"], Trivia: TCATS, Topluluk: ["Müzik", "Trivia"] };
function inTab(l) {
  const trivia = l.kind === "trivia";
  const c = ui.cat;
  switch (ui.genre) {
    case "Müzik": return (!l.kind || l.kind === "song") && (!c || l.genre === c);
    case "Sıralama": return l.kind === "rank" && (!c || l.rcat === c);
    case "Tersten": return (!!l.mix || !!l.rev) && (!c || l.genre === c || (l.rev && !l.mix));
    case "Anime": return !!l.anime || l.kind === "op";
    case "Trivia": return trivia && !l.anime && (!c || l.cat === c);
    case "Topluluk": return l.genre === "Topluluk" && (!c || (c === "Trivia") === trivia);
    case "Senin": return l.genre === "Senin";
    default: return true;
  }
}
function tabCount(name, mine) {
  if (name === "Trivia") return TRIVIA.length + (ui.community || []).filter((l) => l.kind === "trivia").length;
  if (name === "Sayı") return NUMCATS.length;
  if (name === "Tersten") return MIXES.length + (ui.community || []).filter((l) => l.rev).length + customLists().filter((l) => l.rev).length;
  if (name === "Anime") return ANIME_QUIZZES.length + (ui.community || []).filter((l) => l.kind === "op").length;
  if (name === "Sıralama") return RANK_QUIZZES.length + (ui.community || []).filter((l) => l.kind === "rank").length;
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
  if (ui.community === null) return `<div class="hm-track skTrack" aria-busy="true" aria-label="Topluluk quizleri yükleniyor">${skCards(5)}</div>`;
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
    <b>${esc(l.name)}</b><small>${esc(l.kind === "rank" ? l.rcat || "Sıralama" : l.genre)}</small>
  </button>`;
}
function cardSub(l) {
  if (l.anime) return l.items?.length ? `Anime · ${l.items.length} soru` : "Anime trivia";
  if (l.kind === "rank") return l.genre === "Topluluk" ? `${ic("user")}${esc(l.author)} · Sıralama` : `${esc(l.rcat || "Sıralama")} · ilk 5 şarkı`;
  if (l.kind === "op") return `${l.genre === "Topluluk" ? `${ic("user")}${esc(l.author)} · ` : ""}${l.items?.length ? `Anime opening · ${num(l.items.length)}` : "Anime opening"}`;
  if (l.mix) return `${esc(l.genre)} · ${num(l.artists?.length)} sanatçı`;
  if (l.rev) return `${l.genre === "Topluluk" ? `${ic("user")}${esc(l.author)} · ` : ""}${ic("rewind")}Tersten · ${num(l.tracks?.length)} şarkı`;
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
  if (ui.searching) return `<div class="results">${skRows(3)}</div>`;
  if (!ui.results) return "";
  if (!ui.results.length) return `<div class="results"><p class="muted">Sonuç yok. Yazımı kontrol et.</p></div>`;
  return `<div class="results"><p class="muted">Doğru sanatçıyı seç:</p><div class="hits">${ui.results
    .map(
      (a, i) =>
        `<button class="hit" data-hit="${i}">${a.picture ? `<img src="${esc(a.picture)}" alt="" loading="lazy">` : `<span class="noart">${ic("mic-vocal")}</span>`}<b>${esc(a.name)}</b><small>${num(a.fans).toLocaleString("tr")} hayran</small></button>`,
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
              <span class="qInfo"><b>${esc(s.name)}</b><small>${num(s.count)} soru · ${s.kind === "rank" || s.kind === "op" ? kindName(s.kind) : s.kind === "trivia" ? "Trivia" : `${s.reverse ? "Tersten · " : ""}${s.mode === "text" ? "Yazarak" : "Şıklı"} · ${lvl(s.clip, s.reverse)} (${num(s.clip)} sn)`}</small></span>
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
      <span class="gq">${cover(set, "gImg")}<span><b>${esc(set.name)}</b><small>Soru ${num(v.index) + 1}/${num(set.count)} · ${set.kind === "rank" || set.kind === "op" ? kindName(set.kind) : set.kind === "trivia" ? "Trivia" : `${set.reverse ? "Tersten · " : ""}${lvl(set.clip, set.reverse)} ${num(set.clip)} sn`}</small></span></span>
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
  const cdHtml = `<div class="countdown ${pre0 ? "on" : ""}" id="countdown" aria-hidden="true"><div class="cdRing"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/><circle class="cdArc" id="cdArc" cx="50" cy="50" r="46" pathLength="100"/></svg><b id="cdNum"></b><small>Başlıyor</small></div></div>`;
  const intro = num(v.index) === 0 && !reveal ? `<div class="introCard" aria-hidden="true"><div class="inArt">${cover(set, "inImg", true)}</div><span class="kicker">${kindName(set.kind)}${set.survival ? " · Hayatta Kalma" : ""}</span><h2>${esc(set.name)}</h2><p>${set.kind === "rank" ? "İlk 5'i doğru sırala · tam isabete +300" : `${num(set.count)} ${set.kind === "trivia" ? "soru" : set.kind === "op" ? "opening" : "şarkı"} · ${set.survival ? "ilk yanlışta oyun biter" : "hızlı olan kazanır"}`}</p><b class="inNum" id="inNum"></b></div>` : "";
  let stage;
  if (q.kind === "rank") stage = rankStage(v, q, reveal, cdHtml);
  else if (q.kind === "op") stage = opStage(v, q, reveal, cdHtml);
  else if (trivia) {
    const r = reveal ? q.reveal.results[v.me] : null;
    const verdict = !reveal ? "" : r?.correct ? `<span class="verdict good">${ic("check")} +${num(r.points)}</span>` : r ? `<span class="verdict bad">${ic("x")} Yanlış</span>` : `<span class="verdict">${ic("timer")} Süre doldu</span>`;
    stage = `<div class="tq ${reveal ? "done" : ""}">
      <div class="countdown ${pre0 ? "on" : ""}" id="countdown" aria-hidden="true"><div class="cdRing"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/><circle class="cdArc" id="cdArc" cx="50" cy="50" r="46" pathLength="100"/></svg><b id="cdNum"></b><small>Başlıyor</small></div></div>
      <span class="tqNo">${ic("circle-help")} Soru ${num(v.index) + 1}</span>
      ${q.pic ? `<img class="tqPic${/^https:/.test(q.pic) ? " big" : ""}" src="${esc(q.pic)}" alt="" referrerpolicy="no-referrer">` : ""}
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
  // Sıralama butonları (Temizle / Kilitle) ekranın altındaki sabit çubukta durur: telefonda kaydırmadan basılır.
  let rkDock = "";
  if (q.kind === "rank") { const a = rankAnswers(v, q, reveal); if (!reveal && !q.mine) rkDock = a; else answers = a; }
  else if (q.kind === "op") answers = opAnswers(v, q, reveal);
  else if (q.mode === "choice") {
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
        <span class="meter"><span style="width:${top ? Math.max(2, (num(p.round) / top) * 100) : 0}%"></span>${num(r?.points) > 0 ? `<span class="gain" style="left:${((num(p.round) - num(r.points)) / top) * 100}%;width:${(num(r.points) / top) * 100}%"></span>` : ""}</span></span>
        <span class="pts ${num(r?.points) > 0 ? "good" : ""}">${num(r?.points) > 0 ? "+" + num(r.points) : r ? "0" : "—"}${num(r?.points) > 0 ? `<small>${(num(r.ms) / 1000).toFixed(1)} sn</small>` : ""}</span><b class="tot" data-count="${num(p.round)}">${num(p.round)}</b></div>`,
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
    <div class="dock split">${rkDock || dock}</div>`;
}

// ---------- Sıralama sorusu ----------
// 57M, 840K, 1B gibi küsuratsız kısa sayı
const shortNum = (n) => (n >= 1e9 ? `${Math.round(n / 1e9)}B` : n >= 1e6 ? `${Math.round(n / 1e6)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));
// Sıralar sabit yerlidir (boşluk kalabilir). Tıklayınca şarkı, en son konulan yerden sonraki ilk boşluğa
// (yoksa baştaki ilk boşluğa) gider; ilk şarkı 1. sıraya. Sürükle-bırak ile istenen sıraya da konur.
const rk = { qid: "", picks: [], last: -1 };
function rkPicks(q) {
  if (rk.qid !== q.id) Object.assign(rk, { qid: q.id, picks: Array(num(q.slots) || 5).fill(null), last: -1 });
  return rk.picks;
}
const rkFilled = (q) => rkPicks(q).filter(Boolean).length;
function rkPlace(q, song, at) {
  const p = rkPicks(q);
  const from = p.indexOf(song);
  if (at == null) {
    if (from >= 0) return;
    const n = p.length;
    for (let k = 1; k <= n; k++) { const i = (rk.last + k + n) % n; if (!p[i]) { at = i; break; } }
    if (at == null) return false;
  }
  // hedefte şarkı varsa: sürüklenen bir sıradan geliyorsa yer değiştirir, havuzdan geliyorsa havuza döner
  const prev = p[at];
  if (from >= 0) p[from] = prev && from !== at ? prev : null;
  p[at] = song;
  rk.last = at;
  return true;
}
function rkRemove(q, i) {
  const p = rkPicks(q);
  if (!p[i]) return;
  p[i] = null;
}
function rankStage(v, q, reveal, cdHtml) {
  const pic = q.picture ? `<img class="rkPic" src="${esc(q.picture)}" alt="" referrerpolicy="no-referrer">` : `<span class="rkPic noart">${ic("mic-vocal")}</span>`;
  return `<div class="rk ${reveal ? "done" : ""}">
    ${reveal ? "" : cdHtml}
    <div class="rkHead">${pic}<div><h2>${esc(q.artist || "")}</h2><p>${esc(q.text || "")}</p></div></div>
    <div id="rkBody">${rankBody(v, q, reveal)}</div>
  </div>`;
}
function rankBody(v, q, reveal) {
  const n = num(q.slots) || 5;
  if (reveal) {
    const r = q.reveal.results[v.me];
    const order = q.reveal.order || [];
    const mineA = Array.isArray(r?.answer) ? r.answer : [];
    // Her sıra için: senin koyduğun şarkı | işaret | o sıradaki doğru şarkı. Yakın olanlarda gerçek yeri de yazılır.
    const cnt = { ok: 0, near: 0, miss: 0 };
    const rows = order.map((t, i) => {
      const said = mineA[i];
      const m = r?.marks?.[i];
      const cls = m === 2 ? "ok" : m === 1 ? "near" : "miss";
      cnt[cls]++;
      const real = said ? order.indexOf(said) : -1;
      const pc = num(q.reveal.plays?.[i]);
      const mark = m === 2 ? ic("check") : m === 1 ? "~" : ic("x");
      const pts = m === 2 ? `+${RANK_PTS.exact}` : m === 1 ? `+${RANK_PTS.near}` : "0";
      const why = !said ? "Boş kaldı" : m === 2 ? "Doğru yerde" : m === 1 ? `İlk 5'te, aslında ${real + 1}. sırada` : "İlk 5'te değil";
      return `<li class="rkCmp ${cls}" style="--i:${i}">
        <b class="rkN">${i + 1}</b>
        <div class="rkMine"><small>Senin</small><span>${said ? esc(said) : "—"}</span><em>${why}</em></div>
        <i class="rkMark" aria-label="${why}">${mark}<small>${pts}</small></i>
        <div class="rkTrue"><small>Doğru</small><span>${esc(t)}</span>${pc ? `<em>${ic("headphones")}${shortNum(pc)} dinlenme</em>` : ""}</div>
      </li>`;
    }).join("");
    const legend = `<div class="rkLegend"><span class="ok">${ic("check")} ${cnt.ok} doğru yerde</span><span class="near">~ ${cnt.near} ilk 5'te ama yeri yanlış</span><span class="miss">${ic("x")} ${cnt.miss} kaçtı</span></div>`;
    const perfect = r?.correct;
    const verdict = !r ? `<span class="verdict">${ic("timer")} Süre doldu</span>` : perfect ? `<span class="verdict good big">${ic("trophy")} Tam isabet! +${num(r.points)}</span>` : num(r.points) > 0 ? `<span class="verdict mid">+${num(r.points)}</span>` : `<span class="verdict bad">${ic("x")} Hiçbiri tutmadı</span>`;
    return `<div class="rkVerdict">${verdict}</div>${r ? legend : ""}<ol class="rkList reveal cmp">${rows}</ol>${perfect ? confetti() : ""}`;
  }
  const mineA = Array.isArray(q.mine?.answer) ? q.mine.answer : null;
  const picks = mineA || rkPicks(q);
  let next = -1;
  if (!mineA) for (let k = 1; k <= n; k++) { const i = (rk.last + k + n) % n; if (!picks[i]) { next = i; break; } }
  const slots = Array.from({ length: n }, (_, i) => {
    const t = picks[i];
    return t
      ? `<li><button class="rkSlot full" data-rs="${i}" data-slot="${i}" ${mineA ? "disabled" : ""} aria-label="${i + 1}. sıradan çıkar"><b class="rkN">${i + 1}</b><span class="rkT">${esc(t)}</span>${mineA ? "" : `<i class="rkGrip" aria-hidden="true">⋮⋮</i><i class="rkX">${ic("x")}</i>`}</button></li>`
      : `<li><div class="rkSlot ${i === next ? "next" : ""}" data-slot="${i}"><b class="rkN">${i + 1}</b><span class="rkT">${i === next ? "Aşağıdan bir şarkı seç" : ""}</span></div></li>`;
  }).join("");
  const pool = mineA ? "" : `<div class="rkPool">${(q.options || []).map((o, i) => {
    const at = picks.indexOf(o);
    return `<button class="rkOpt ${at >= 0 ? "used" : ""}" data-rk="${i}" ${at >= 0 ? `aria-pressed="true"` : ""}>${at >= 0 ? `<b>${at + 1}</b>` : ""}${esc(o)}</button>`;
  }).join("")}</div>`;
  // Sıralar solda (telefonda üstte), şıklar sağda düzenli bir ızgarada; seçilen şık yerinde soluk kalır, numarasıyla.
  return `<div class="rkPlay"><ol class="rkList">${slots}</ol>${pool}</div>`;
}
function rankAnswers(v, q, reveal) {
  if (reveal || q.mine) return q.mine && !reveal ? `<div class="locked">${ic("check")} Sıralaman kilitlendi</div>` : "";
  const n = num(q.slots) || 5, f = rkFilled(q), full = f >= n;
  return `<div class="rkDock"><button class="btn ghost" data-do="rkclear" ${f ? "" : "disabled"} aria-label="Temizle">${ic("rotate-ccw")}<span>Temizle</span></button><button class="btn primary lg" data-do="rkgo" id="rkGo" ${full ? "" : "disabled"}>${ic("check")}${full ? "Sıralamayı kilitle" : `${f}/${n} seçildi`}</button></div>`;
}
function rankRedraw() {
  const q = view?.question;
  if (!q || q.kind !== "rank") return;
  const b = $("#rkBody");
  if (b) b.innerHTML = rankBody(view, q, false);
  const d = $(".rkDock");
  if (d) d.outerHTML = rankAnswers(view, q, false);
}

const drag = { el: null, song: "", from: -1, x: 0, y: 0, ghost: null, moved: false, over: null };
function rkCanDrag() {
  const q = view?.question;
  return screen === "room" && q?.kind === "rank" && view.phase === "question" && !q.mine && hostNow() >= q.start;
}
document.addEventListener("pointerdown", (e) => {
  if (e.button > 0 || !rkCanDrag()) return;
  const el = e.target.closest(".rkOpt, .rkSlot.full");
  if (!el) return;
  const q = view.question;
  const song = el.dataset.rk !== undefined ? q.options[Number(el.dataset.rk)] : rkPicks(q)[Number(el.dataset.rs)];
  if (!song) return;
  Object.assign(drag, { el, song, from: el.dataset.rs !== undefined ? Number(el.dataset.rs) : -1, x: e.clientX, y: e.clientY, moved: false, over: null, touch: e.pointerType === "touch", armed: e.pointerType !== "touch" });
  // dokunmatikte sayfa kaydırılabilsin diye sürükleme kısa basılı tutunca başlar
  clearTimeout(drag.hold);
  if (drag.touch) drag.hold = setTimeout(() => { if (drag.el === el) { drag.armed = true; el.classList.add("armed"); navigator.vibrate?.(15); } }, 220);
});
document.addEventListener("touchmove", (e) => { if (drag.el && drag.armed) e.preventDefault(); }, { passive: false });
document.addEventListener("pointermove", (e) => {
  if (!drag.el) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (!drag.armed) { clearTimeout(drag.hold); drag.el = null; return; } // kaydırma
    drag.moved = true;
    drag.ghost = document.createElement("div");
    drag.ghost.className = "rkGhost";
    drag.ghost.textContent = drag.song;
    document.body.append(drag.ghost);
    drag.el.classList.add("dragging");
    document.body.classList.add("rkDragging");
  }
  e.preventDefault();
  drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -60%)`;
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-slot]");
  if (t !== drag.over) { drag.over?.classList.remove("over"); t?.classList.add("over"); drag.over = t; }
}, { passive: false });
function endDrag(e, cancel) {
  clearTimeout(drag.hold);
  if (!drag.el) return;
  const { moved, over, song, from } = drag;
  drag.ghost?.remove();
  drag.el.classList.remove("dragging", "armed");
  drag.over?.classList.remove("over");
  document.body.classList.remove("rkDragging");
  Object.assign(drag, { el: null, ghost: null, over: null });
  if (!moved || cancel || !rkCanDrag()) return;
  // sürükleme bitti: ardından gelen tıklama yok sayılsın
  drag.skipClick = performance.now();
  const q = view.question;
  if (over) { rkPlace(q, song, Number(over.dataset.slot)); sfx("pick"); }
  else if (from >= 0) { rkRemove(q, from); sfx("unpick"); }
  rankRedraw();
}
document.addEventListener("pointerup", (e) => endDrag(e, false));
document.addEventListener("pointercancel", (e) => endDrag(e, true));
document.addEventListener("click", (e) => {
  if (drag.skipClick && performance.now() - drag.skipClick < 400) { drag.skipClick = 0; e.stopPropagation(); e.preventDefault(); }
}, true);

// ---------- Anime opening sorusu (YouTube) ----------
const op = { qid: "", a: null, s: null };
function opPicks(q) {
  if (op.qid !== q.id) Object.assign(op, { qid: q.id, a: null, s: null });
  return op;
}
function opStage(v, q, reveal, cdHtml) {
  return `<div class="opq ${reveal ? "done" : ""}">
    ${reveal ? "" : cdHtml}
    <span class="tqNo">${ic("tv")} Opening ${num(v.index) + 1}</span>
    <div class="opScreen" id="ytSlot"></div>
    ${reveal ? `<div class="tqAns"><span class="tqAnsText"><small>Doğru cevap</small><b>${esc(q.reveal.title)}</b><small>${ic("music")} ${esc(q.reveal.song || "")}</small>${opVerdict(q.reveal.results[v.me])}</span></div>` : `<button class="btn soft sm opTap" data-do="ytplay">${ic("volume-2")}Ses gelmiyor mu? Dokun</button>`}
  </div>`;
}
function opVerdict(r) {
  if (!r) return `<span class="verdict">${ic("timer")} Süre doldu</span>`;
  if (r.correct) return `<span class="verdict good">${ic("sparkles")} İkisi de doğru! +${num(r.points)}</span>`;
  if (r.partial) return `<span class="verdict mid">${r.hit?.anime ? "Anime doğru" : "Şarkı doğru"} · +${num(r.points)}</span>`;
  return `<span class="verdict bad">${ic("x")} Yanlış</span>`;
}
function opAnswers(v, q, reveal) {
  const p = opPicks(q);
  const mineA = q.mine?.answer && typeof q.mine.answer === "object" ? q.mine.answer : null;
  const row = (opts, key, title, icon, right, picked) => `<div class="opRow"><h3>${ic(icon)}${title}</h3><div class="answers ${v.solo ? "" : "multi"}">${(opts || [])
    .map((o, i) => {
      const isRight = reveal && o === right;
      const isPicked = picked === o;
      const cls = isRight ? "right" : reveal && isPicked ? "wrong" : isPicked ? "picked" : "";
      return `<button class="ans ${cls}" data-${key}="${i}" ${reveal || mineA ? "disabled" : ""}><kbd>${key === "oa" ? "ABCD"[i] : i + 1}</kbd><span class="ansText">${esc(o)}</span></button>`;
    })
    .join("")}</div></div>`;
  const myA = reveal ? q.reveal.results[v.me]?.answer : mineA;
  return `<div class="opAns">${row(q.options, "oa", "Anime", "tv", reveal ? q.reveal.title : null, myA?.anime ?? p.a)}${row(q.options2, "os", "Şarkı", "music", reveal ? q.reveal.song : null, myA?.song ?? p.s)}</div>`;
}
// YouTube oynatıcı: yeniden çizimlerde kesilmesin diye #app dışında, sabit konumda durur ve soru alanının üstüne hizalanır.
const yt = { host: null, frame: null, qid: "", ready: false, playing: false, want: false };
function ytCmd(func, args = []) {
  try { yt.frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com"); } catch {}
}
function ytEnsure(q) {
  if (!yt.host) {
    yt.host = document.createElement("div");
    yt.host.className = "ytHost";
    yt.host.innerHTML = `<div class="ytCover"><span class="eq"><i></i><i></i><i></i><i></i><i></i></span><b>Dinle</b><small>Görüntü kapalı</small></div>`;
    document.body.append(yt.host);
  }
  if (yt.qid === q.id) return;
  yt.frame?.remove();
  Object.assign(yt, { qid: q.id, ready: false, playing: false, want: false });
  const f = document.createElement("iframe");
  f.title = "Anime opening";
  f.allow = "autoplay; encrypted-media";
  f.referrerPolicy = "strict-origin-when-cross-origin";
  f.src = `https://www.youtube-nocookie.com/embed/${q.yt}?enablejsapi=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&cc_load_policy=0&start=${num(q.ys)}&origin=${encodeURIComponent(location.origin)}`;
  f.addEventListener("load", () => {
    yt.ready = true;
    try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "https://www.youtube-nocookie.com"); } catch {}
    if (yt.want) ytPlay();
  });
  yt.frame = f;
  yt.host.prepend(f);
}
function ytPlay() {
  yt.want = true;
  if (!yt.ready) return;
  ytCmd("setVolume", [Math.round(gainOf(volume()) * 100)]);
  if (volume() <= 0.001) ytCmd("mute");
  if (volume() > 0.001) ytCmd("unMute");
  ytCmd("playVideo");
  yt.playing = true;
}
function ytStop() {
  if (!yt.host) return;
  yt.frame?.remove();
  Object.assign(yt, { frame: null, qid: "", ready: false, playing: false, want: false });
  yt.host.hidden = true;
}
function ytPaint() {
  const q = view?.question;
  const slot = screen === "room" && q?.kind === "op" && ["question", "reveal"].includes(view.phase) ? $("#ytSlot") : null;
  if (!slot) return yt.qid && ytStop();
  ytEnsure(q);
  const r = slot.getBoundingClientRect();
  Object.assign(yt.host.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  yt.host.hidden = false;
  const pre = view.phase === "question" && hostNow() < q.start;
  yt.host.classList.toggle("covered", view.phase === "question" && (!q.video || pre));
  yt.host.classList.toggle("pre", pre);
  if (!pre && !yt.want) ytPlay();
}

// ---------- puan sıralaması: her quizde ilk 10 + (ilk 10'da değilse) kendi satırın ----------
const TEN = "";
// Sıralaması olan quizler: hazır ve topluluk quizleri (kişisel listeler ve sanatçı sıralama quizleri hariç)
const lbOf = (l) => (l && l.kind !== "rank" && l.genre !== "Senin" ? lbKey(l.id) : "");
// İlk 20 gösterilir. Oyuncu ilk 20'de değilse sırası "–" olarak, bu cihazdaki en iyi puanıyla en altta görünür.
function boardRows(rows, key) {
  const meAt = rows.findIndex(isMine);
  const best = myBest(key);
  const mine = meAt >= LB_TOP ? rows[meAt] : meAt < 0 && best > 0 ? { s: best, n: profile?.name || "Sen", a: profile?.avatar, k: profile?.color, me: 1 } : null;
  if (!rows.length && !mine) return `<p class="lbEmpty">${ic("trophy")}<span>Henüz kimse yok. Puanlı modda bir oyun bitir, ilk sen ol!</span></p>`;
  const row = (r, i) =>
    `<li class="${r.me || isMine(r) ? "me" : ""}${i >= 0 && i < 3 ? ` t${i + 1}` : ""}"><span class="lbN">${i >= 0 ? i + 1 : "–"}</span>${avatar({ avatar: r.a, color: r.k }, "xs")}<b>${esc(maskName(r.n))}</b>${r.me || isMine(r) ? `<em>Sen</em>` : ""}<span class="lbS">${num(r.s)}</span></li>`;
  return `<ol class="lbList">${rows.slice(0, LB_TOP).map(row).join("")}${mine ? `<li class="lbGap" aria-hidden="true"><i></i><i></i><i></i></li>${row(mine, -1)}` : ""}</ol>`;
}
// note: güvenli HTML olmalı (yalnızca sayılar ve sabit metin)
function boardHtml(key, { title = "Puan sıralaması", note = "" } = {}) {
  if (!key) return "";
  const rows = peekBoard(key);
  loadBoard(key).then(() => fillBoards(key), () => fillBoards(key, true));
  return `<section class="lb" data-lb="${esc(key)}">
    <header class="lbHead"><h3>${ic("trophy")}<span>${esc(title)}</span></h3><small>İlk ${LB_TOP}</small></header>
    ${note ? `<p class="lbNote">${note}</p>` : ""}
    <div class="lbBody" aria-live="polite">${rows ? boardRows(rows, key) : skRows(5)}</div>
    <p class="lbRule">Yalnızca <b>Puanlı</b> modda oynanan oyunlar sıralamaya girer: 10 soru (quizde daha azı varsa hepsi), şarkı seçimi yok. Puan, cevap süresi ayarından bağımsız hesaplanır.</p>
  </section>`;
}
function fillBoards(key, failed = false) {
  const rows = peekBoard(key);
  for (const el of $$(".lb")) {
    if (el.dataset.lb !== key) continue;
    const body = el.querySelector(".lbBody");
    const html = rows ? boardRows(rows, key) : failed ? `<p class="lbEmpty">Sıralama şu an yüklenemedi.</p>` : null;
    if (html != null && body.innerHTML !== html) body.innerHTML = html;
  }
}
// Quiz bitince: 10 soruluk oyunsa sonucu (rekorsa) gönder, sıralamayı göster.
let lbDone = { sig: "", prev: 0 };
function lbResult(v, set) {
  const key = lbKey(set?.lid);
  if (!key || set.kind === "rank" || set.survival) return "";
  const me = v.players.find((p) => p.pid === v.me);
  let note = "";
  const need = Math.min(LB_QUESTIONS, num(set.pool) || LB_QUESTIONS);
  if (!set.ranked) note = `<span>Serbest oyunlar sıralamaya girmez. Puan için quiz sayfasında <b>Puanlı</b> modu seç.</span>`;
  else if (num(set.count) !== need) note = `<span>Bazı şarkılar açılamadığı için bu oyun sıralamaya girmedi.</span>`;
  else if (me) {
    const sig = v.code + ":" + set.id + ":" + me.pid;
    const sc = num(me.lbr);
    if (lbDone.sig !== sig) {
      lbDone = { sig, prev: myBest(key) };
      if (sc > lbDone.prev) submitScore({ key, score: sc, correct: num(me.hits), name: me.name, avatar: me.avatar, color: me.color }).then(() => fillBoards(key)).catch(() => {});
    }
    const prev = lbDone.prev;
    note = sc > prev
      ? `${ic("sparkles")}<span>${prev ? `Yeni rekor! Sıralama puanın <b>${sc}</b> (önceki ${prev})` : `Sıralama puanın <b>${sc}</b>`}</span>`
      : !sc && !prev
        ? `<span>Bu oyunda doğru cevap olmadığı için sıralamaya puan gitmedi. Bir tur daha?</span>`
        : `<span>Sıralama puanın <b>${sc}</b> · rekorun <b>${prev}</b></span>`;
  }
  return boardHtml(key, { title: "Quiz sıralaması", note });
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
      ${lbResult(v, set)}
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
    ${lbResult(v, set)}
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
      // soru, geri sayım bitene kadar hiç görünmez; sayı yalnızca son 3 saniyede çıkar
      const cdOn = pre && q.start - now <= 3000;
      const s = cdOn ? String(Math.ceil((q.start - now) / 1000)) : "";
      cd.classList.toggle("on", pre);
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
// telefonda sekme şeridi sona kaydırılınca sağdaki soluklaşma kalksın
document.addEventListener("scroll", (e) => {
  const t = e.target;
  if (t?.classList?.contains("hm-tabs") || t?.classList?.contains("subChips")) t.classList.toggle("atEnd", t.scrollLeft + t.clientWidth >= t.scrollWidth - 4);
}, true);
// ---------- oyundan yanlışlıkla çıkmayı önle ----------
const LEAVE_Q = "Quizden çıkmak istediğine emin misin? Bu oyundaki ilerlemen kaybolur.";
function inGame() {
  if (screen === "number") return !!nq && nq.phase !== "over" && nq.streak > 0;
  return screen === "room" && !!view && ["preparing", "question", "reveal", "ranking"].includes(view.phase);
}
// Tarayıcının geri tuşu: oyun başlarken geçmişe bir adım eklenir; geri basılınca önce sorulur.
// Lobi ekranında da (oyun başlamadan) geri tuşu önce sorar; yoksa lobi sessizce kapanırdı.
const inLobby = () => screen === "room" && !!mode && mode.role !== "solo" && !inGame();
setInterval(() => {
  if ((inGame() || inLobby()) && !history.state?.jqGame) history.pushState({ jqGame: 1 }, "");
}, 500);
addEventListener("popstate", () => {
  if (inGame() || inLobby()) {
    if (confirm(inGame() ? LEAVE_Q : "Lobiden ayrılmak istediğine emin misin?")) {
      if (screen === "number") showHomeFromHistory();
      else leaveRoom();
    } else history.pushState({ jqGame: 1 }, "");
    return;
  }
  const st = history.state;
  if (st?.jqScreen === "detail" && st.id) {
    if (screen !== "detail" || String(sheetCtx.list?.id) !== st.id) {
      if (screen === "home") homeY = scrollY;
      openList(st.id, true);
    }
    return;
  }
  if (st?.jqScreen === "number") return; // ileri tuşu: sayı quizi yeniden başlamasın, olduğu yerde kal
  if (screen !== "home" && !(screen === "room" && mode)) showHomeFromHistory();
});

(function loop() {
  paint();
  ytPaint();
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
    if (q && q.id && (q.kind === "rank" || q.kind === "op")) return { ...q, items: Array.isArray(q.items) ? q.items.slice(0, 100) : [], picture: cdn(q.picture), mine: true, genre: "Topluluk" };
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
const ITEM_KINDS = ["trivia", "rank", "op"];
const kindName = (k) => ({ trivia: "Trivia", rank: "Sıralama quizi", op: "Anime opening quizi" })[k] || "Şarkı quizi";
function optsHtml(l) {
  if ((l.anime || l.opsrc || l.kind === "rank") && !l.items) return `<div class="opts"><p class="muted skNote">${l.kind === "rank" ? "En çok dinlenen şarkılar getiriliyor…" : "Sorular hazırlanıyor…"}</p>${skRows(3)}</div>`;
  if (l.kind === "rank") {
    if (!l.items.length) return `<div class="opts"><p class="muted">Bu sanatçı için sıralama hazırlanamadı. Biraz sonra tekrar dene.</p></div>`;
    return `<div class="opts"><div class="rkRules">
      <span>${ic("check")}<b>+${RANK_PTS.exact}</b> doğru yerdeki her şarkı</span>
      <span>${ic("list-ordered")}<b>+${RANK_PTS.near}</b> ilk 5'te ama yeri yanlış</span>
      <span>${ic("trophy")}<b>+${RANK_PTS.perfect}</b> sıranın tamamı doğruysa</span>
      <span>${ic("timer")}<b>Hız</b> erken kilitleyen tam puan, son saniyede %60</span>
    </div></div>`;
  }
  if (l.kind === "op") {
    if (l.opsrc && l.items.length < 4) return `<div class="opts"><p class="muted">${ic("tv")} Openingler YouTube'dan her gün toplanıyor; bu quiz çok yakında hazır olacak.</p></div>`;
    const n = num(l.items?.length);
    const counts = [5, 10, 15, 20].filter((c) => c < n);
    if (!counts.includes(sheetCtx.count) && sheetCtx.count !== n) sheetCtx.count = Math.min(10, n);
    return `<div class="opts">
        <div class="opt"><span>Görüntü</span><div class="seg" data-opt="video"><button data-v="0" aria-pressed="${!sheetCtx.video}">${ic("volume-2")}Sadece ses</button><button data-v="1" aria-pressed="${!!sheetCtx.video}">${ic("eye")}Video açık</button></div></div>
        <div class="opt optCount"><span>Soru sayısı</span><div class="seg" data-opt="count">${[...counts, n].map((c) => `<button data-v="${c}" aria-pressed="${sheetCtx.count === c}"${c === LB_QUESTIONS ? TEN : ""}>${c === n ? `Hepsi (${c})` : c}</button>`).join("")}</div></div>
        <div class="rkRules"><span>${ic("tv")}<b>+${OP_PTS.anime}</b> anime</span><span>${ic("music")}<b>+${OP_PTS.song}</b> şarkı</span><span>${ic("sparkles")}<b>+${OP_PTS.both}</b> ikisi birden</span></div>
      </div>`;
  }
  if (l.kind === "trivia") {
    const n = num(l.items?.length);
    const counts = [5, 10, 15, 20, 30].filter((c) => c < n);
    if (!counts.includes(sheetCtx.count) && sheetCtx.count !== n) sheetCtx.count = Math.min(10, n);
    return `<div class="opts">
        ${l.anime && ERAS.length ? `<div class="opt"><span>Dönem</span><div class="seg" data-opt="era">${ERAS.map(([v, t]) => `<button data-v="${v}" aria-pressed="${(l.era || "pop") === v}">${t}</button>`).join("")}</div></div>` : ""}
        <div class="opt optCount"><span>Soru sayısı</span><div class="seg" data-opt="count">${[...counts, n].map((c) => `<button data-v="${c}" aria-pressed="${sheetCtx.count === c}"${c === LB_QUESTIONS ? TEN : ""}>${c === n ? `Hepsi (${c})` : c}</button>`).join("")}</div></div>
      </div>`;
  }
  return `<div class="opts">
      <div class="opt optCount"><span>Soru sayısı</span><div class="seg" data-opt="count">${[5, 10, 15, 20, 30].map((n) => `<button data-v="${n}" aria-pressed="${sheetCtx.count === n}"${n === LB_QUESTIONS ? TEN : ""}>${n}</button>`).join("")}</div></div>
      <div class="opt"><span>Cevap</span><div class="seg" data-opt="mode"><button data-v="choice" aria-pressed="${sheetCtx.mode === "choice"}">Şıklı</button><button data-v="text" aria-pressed="${sheetCtx.mode === "text"}">Yazarak</button></div></div>
      <div class="opt"><span>Çalış</span><div class="seg" data-opt="rev"><button data-v="0" aria-pressed="${!sheetCtx.rev}">Normal</button><button data-v="1" aria-pressed="${!!sheetCtx.rev}">${ic("rewind")}Tersten</button></div></div>
      <div class="opt"><span>Kesit uzunluğu</span>${clipSeg()}</div>
    </div>
    <details class="tracks" id="tracksBox"><summary>${ic("list-music")} Şarkıları seç <span id="selCount"></span></summary><div id="trackList">${skRows(4)}</div></details>`;
}
function clipSeg() {
  const rev = !!sheetCtx.rev, opts = rev ? [10, 5, 3] : [5, 3, 1];
  if (!opts.includes(sheetCtx.clip)) sheetCtx.clip = rev ? 5 : 3;
  return `<div class="seg" data-opt="clip" id="clipSeg">${opts.map((n) => `<button data-v="${n}" aria-pressed="${sheetCtx.clip === n}">${lvl(n, rev)} · ${n} sn</button>`).join("")}</div>`;
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
  if (ITEM_KINDS.includes(l.kind)) {
    const n = num(l.items?.length);
    if (sheetCtx.gmode === "survival") sheetCtx.gmode = lbOf(l) ? "ranked" : "normal";
    sheetBody.dataset.g = sheetCtx.gmode;
    sheetBody.innerHTML = `<div class="sheetHead setupHead">${cover(l, "sImg")}<div><small class="kicker">${l.kind === "trivia" ? `Trivia · ${esc(l.cat || "")}` : kindName(l.kind)}</small><h2>${esc(l.name)}</h2><small class="muted">${l.kind === "rank" ? "20 şık · 5 sıra" : `${n} ${l.kind === "op" ? "opening" : "soru"}`}${l.author ? ` · ${esc(l.author)}` : ""}</small></div><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
      ${l.desc ? `<p class="muted">${esc(l.desc)}</p>` : ""}
      ${modeChoice(l, true)}
      ${optsHtml(l)}
      <p class="hint">${l.kind === "rank" ? "Şıklara dokunarak 1'den 5'e sırayla yerleştir, sonra kilitle." : l.kind === "op" ? "Opening çalarken hem animeyi hem şarkıyı seç; birini bilmek de puan getirir." : "Süre bitmeden doğru şıkkı seç; ne kadar hızlıysan o kadar puan. Cevap süresini lobiden değiştirebilirsin."}</p>
      <div class="sheetFoot">${setupFoot(enqueue)}</div>`;
    return;
  }
  sheetBody.dataset.g = sheetCtx.gmode;
  sheetBody.innerHTML = `<div class="sheetHead setupHead">${cover(l, "sImg")}<div><small class="kicker">${esc(l.genre || "Quiz")}</small><h2>${esc(l.name)}</h2><small class="muted" id="trackCount">${spinner()} Şarkılar yükleniyor…</small></div><button class="icon" data-close aria-label="Kapat">${ic("x")}</button></div>
    ${modeChoice(l, true)}
    ${optsHtml(l)}
    <div class="sheetFoot">${setupFoot(enqueue, "disabled")}</div>`;
  $$(".sheetFoot .btn").forEach((b) => (b.dataset.needtracks = "1"));
  fillTracks(l, () => sheet.open);
}

// ---------- oyun modu: Puanlı (sıralamaya girer) / Serbest / Hayatta Kalma ----------
// Puanlı modda soru sayısı sabittir: 10, quizde daha az soru varsa hepsi. Şarkı seçilemez, sayı seçilemez.
const isRanked = (l) => !!lbOf(l) && sheetCtx.gmode === "ranked";
function lbNeed(l) {
  const n = ITEM_KINDS.includes(l.kind) ? num(l.items?.length) : num(sheetCtx.tracks?.length || l.tracks?.length);
  return n ? Math.min(LB_QUESTIONS, n) : LB_QUESTIONS;
}
function modeChoice(l, inSheet = false) {
  const trivia = l.kind === "trivia";
  const ranked = !!lbOf(l);
  if (!ranked && !(trivia && !inSheet)) return "";
  const g = sheetCtx.gmode;
  const best = bests()[l.id] || {};
  const song = !ITEM_KINDS.includes(l.kind);
  const need = lbNeed(l);
  const b = (v, icon, title, sub, cls = "") => `<button data-v="${v}" aria-pressed="${g === v}"${cls ? ` class="${cls}"` : ""}>${ic(icon)}<span><b>${title}</b><small>${sub}</small></span></button>`;
  return `<div class="dtLabel">Oyun modu</div>
    <div class="dtChoice modes${trivia && !inSheet && ranked ? " three" : ""}" data-opt="gmode">
      ${ranked ? b("ranked", "trophy", "Puanlı", `${need} soru · sıralamaya girer`) : ""}
      ${b("normal", "shuffle", "Serbest", song ? "Soru sayısını ve şarkıları sen seç" : "Soru sayısını sen seç")}
      ${trivia && !inSheet ? b("survival", "heart", "Hayatta Kalma", `İlk yanlışta oyun biter${best.streak ? ` · rekorun ${num(best.streak)}` : ""}`, "onlySolo") : ""}
    </div>
    ${ranked ? `<p class="rankedNote">${ic("trophy")}<span><b>${need} soru</b>${song ? ", tüm şarkılardan karışık" : ""}. Sonucun bu quizin puan sıralamasına yazılır; rekor kırarsan eski puanının yerine geçer.</span></p>` : ""}`;
}

// ---------- quiz detay sayfası: kapak, bilgiler, oyun türü ve modu, BAŞLA ----------
const bests = () => store.get("jqBest", {});
function renderDetail() {
  const l = sheetCtx.list;
  const trivia = l.kind === "trivia";
  const ik = ITEM_KINDS.includes(l.kind);
  const b = bests()[l.id] || {};
  const n = ik ? num(l.items?.length) : num(l.tracks?.length);
  app.innerHTML = `<section class="dt${lbOf(l) ? " hasLb" : ""}" data-g="${esc(sheetCtx.gmode)}" data-play="${esc(sheetCtx.play)}">
    <button class="dtBack" data-go="home">${ic("arrow-left")}Tüm quizler</button>
    <div class="dtGrid">
      <aside class="dtCard">
        <div class="dtArt">${cover(l, "dtImg", true)}</div>
        <div class="dtShade"></div>
        <div class="dtCardInfo">
          <h1>${esc(l.name)}</h1>
          <div class="dtStats">
            <span>${ic(l.kind === "rank" ? "list-ordered" : l.kind === "op" ? "tv" : trivia ? "circle-help" : "list-music")}<b id="trackCount">${l.kind === "rank" ? "İlk 5 · 20 şık" : l.kind === "op" ? `${n} opening` : trivia ? `${n} soru` : n ? `${n} şarkı` : `${spinner()} şarkılar`}</b></span>
            <span>${ic("layers")}${esc(l.kind === "rank" ? l.rcat || "Sıralama" : l.kind === "op" ? "Anime" : trivia ? l.cat || "Trivia" : l.genre || "Müzik")}</span>
            ${b.score ? `<span>${ic("trophy")}${num(b.score)}</span>` : ""}
          </div>
          ${l.author ? `<div class="dtBy">${ic("user")}<span><small>Oluşturan</small><b>${esc(l.author)}</b></span></div>` : ""}
        </div>
      </aside>
      <div class="dtPanel">
        <span class="kicker">${kindName(l.kind)}</span>
        <h2>${esc(l.name)}</h2>
        ${l.desc ? `<p class="dtDesc">${esc(l.desc)}</p>` : `<p class="dtDesc">${l.kind === "rank" ? `${esc(l.name)} için en çok dinlenen 5 şarkıyı 20 şık arasından bul ve doğru sıraya diz.` : l.kind === "op" ? "Opening'i dinle; animeyi ve şarkının adını bul. İkisini birden bilen en çok puanı alır." : trivia ? "Dört şıktan doğrusunu süre bitmeden bul; ne kadar hızlıysan o kadar puan." : "Kesiti dinle, şarkının adını herkesten önce bul."}</p>`}
        <div class="dtLabel">Nasıl oynamak istersin?</div>
        <div class="dtChoice" data-opt="play">
          <button data-v="solo" aria-pressed="${sheetCtx.play === "solo"}">${ic("user")}<span><b>Solo</b><small>Tek başına oyna</small></span></button>
          <button data-v="party" aria-pressed="${sheetCtx.play === "party"}">${ic("users")}<span><b>Arkadaşlarla</b><small>Lobi kur, bağlantıyı gönder</small></span></button>
        </div>
        ${modeChoice(l)}
        <div class="dtOpts">${optsHtml(l)}</div>
        <button class="btn primary xl wide dtStart" data-do="detailGo" ${ik ? "" : "disabled data-needtracks=1"}>${ic("sparkles")}Başla</button>
        ${b.score || b.streak ? `<div class="dtRec">${ic("trophy")}<span>Rekorların: ${b.score ? `<b>${num(b.score)}</b> puan` : ""}${b.score && b.streak ? " · " : ""}${b.streak ? `<b>${num(b.streak)}</b> soruluk seri` : ""}</span></div>` : ""}
      </div>
      ${lbOf(l) ? `<div class="dtBoard">${boardHtml(lbOf(l))}</div>` : ""}
    </div>
  </section>`;
  if (!ik) fillTracks(l, () => screen === "detail");
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
  const { list, tracks, ids, count, mode: m, clip, rev } = sheetCtx;
  if (list.kind === "rank" || list.kind === "op") {
    if (!list.items?.length) throw Error(list.items ? "Bu quiz için soru bulunamadı." : "Sorular hazırlanıyor, birazdan tekrar dene.");
    const ranked = list.kind === "op" && isRanked(list);
    return { type: "add", kind: list.kind, list: { name: list.name, emoji: list.emoji || "", picture: list.picture || "" }, items: list.items, count: list.kind === "rank" ? list.items.length : ranked ? Math.min(LB_QUESTIONS, list.items.length) : count, mode: list.kind, clip: 0, video: !!sheetCtx.video, lid: lbOf(list), ranked };
  }
  if (list.kind === "trivia") {
    const survival = sheetCtx.gmode === "survival" && sheetCtx.play !== "party" && !(mode && mode.role !== "solo");
    const ranked = !survival && isRanked(list);
    return { type: "add", kind: "trivia", list: { name: list.name, emoji: list.emoji || "" }, items: list.items, count: survival ? list.items.length : ranked ? Math.min(LB_QUESTIONS, list.items.length) : count, mode: "choice", clip: 0, survival, lid: lbOf(list), ranked };
  }
  if (!tracks) throw Error("Şarkılar henüz yüklenmedi.");
  const ranked = isRanked(list);
  if (!ranked && !ids.size) throw Error("En az bir şarkı seç.");
  return {
    type: "add",
    list: { name: list.name, art: list.art || "", picture: list.picture || "" },
    tracks,
    ids: ranked || ids.size === tracks.length ? null : [...ids],
    count: ranked ? Math.min(LB_QUESTIONS, tracks.length) : count,
    mode: m,
    clip,
    reverse: !!rev,
    lid: lbOf(list),
    ranked,
  };
}
async function loadAnime(l, era) {
  l.era = era;
  l.items = null;
  try {
    l.items = await animeItems(l.anime, era);
    if (!l.items.length) throw Error("Bu dönem için soru bulunamadı.");
  } catch (e) {
    l.items = [];
    toast(e.message || "Anime verisine şu an ulaşılamadı.", "bad");
  }
  if (sheetCtx?.list === l) { sheetCtx.count = Math.min(10, l.items.length || 10); const o = $(".opts"); if (o) o.outerHTML = optsHtml(l); }
}
async function loadRank(l) {
  l.items = null;
  try {
    l.items = await rankItems(l.artistId, l.name, l.picture);
  } catch (e) {
    l.items = [];
    toast(e.message || "Sıralama verisine şu an ulaşılamadı.", "bad");
  }
  if (sheetCtx?.list === l) { const o = $(".opts"); if (o) o.outerHTML = optsHtml(l); }
}
// ---------- tarayıcı geçmişi: geri tuşu (fare 4/5 dahil) siteden çıkmak yerine bir önceki ekrana döner ----------
// Detay ve Sayı Quizi ekranları geçmişe bir adım ekler; geri basılınca ana ekrana (kaldığın yere) dönülür.
let homeY = 0;
let afterBack = null;
function pushScreen(state) {
  if (screen === "home") homeY = scrollY;
  if (history.state?.jqScreen) history.replaceState(state, "");
  else history.pushState(state, "");
}
// Uygulama içindeki "geri" düğmeleri de tarayıcı geçmişiyle aynı yolu izler (çift geri basma olmasın).
function backHome(after) {
  if (history.state?.jqScreen && !mode) {
    afterBack = after || null;
    return history.back();
  }
  if (screen === "number") nq = null;
  screen = "home";
  lastSig = "";
  render();
  after?.();
}
function showHomeFromHistory() {
  if (screen === "number") nq = null;
  screen = "home";
  lastSig = "";
  render();
  const after = afterBack;
  afterBack = null;
  if (after) after();
  else requestAnimationFrame(() => scrollTo({ top: homeY }));
}
function openList(id, fromHistory = false) {
  const l = allLists().find((x) => String(x.id) === String(id));
  if (!l) return;
  if (l.anime && !l.items) loadAnime(l, l.era || "pop");
  if (l.kind === "rank" && !l.items?.length) loadRank(l);
  // Topluluk sıralama quizi: sanatçının YouTube izlenme verisi hazırsa oluşturulduğu günkü (Deezer) sıra yerine o kullanılır.
  if (l.kind === "rank" && l.genre === "Topluluk" && l.artistId && !l.ytTried) {
    l.ytTried = true;
    fromYouTube(l.artistId, l.artist || l.name, l.picture).then((y) => {
      if (!y) return;
      l.items = y;
      if (sheetCtx?.list === l) { const o = $(".opts"); if (o) o.outerHTML = optsHtml(l); }
    });
  }
  if (l.opsrc && !l.items?.length) animeOps().then((items) => { l.items = items; if (sheetCtx?.list === l) { sheetCtx.count = Math.min(10, items.length || 10); const o = $(".opts"); if (o) o.outerHTML = optsHtml(l); } });
  const last = store.get("jqSetup", {});
  const rev = (l.mix && ui.genre === "Tersten") || l.rev ? 1 : 0;
  const ctx = { list: l, count: last.count || 10, mode: last.mode || "choice", clip: rev ? 5 : last.clip || 3, rev, play: "solo", gmode: lbOf(l) ? "ranked" : "normal" };
  // Lobide kurucu quiz eklerken pencere; ana sayfada tam detay sayfası
  if (mode && mode.role !== "solo" && isHost()) return openSheet("setup", ctx);
  if (!fromHistory) pushScreen({ jqScreen: "detail", id: String(l.id) });
  sheetCtx = ctx;
  screen = "detail";
  render();
  scrollTo({ top: 0 });
}

// ---------- Sayı Quizi: "hangisi daha büyük?" (solo, seri) ----------
let nq = null;
// Eşleştirme kuralı: rakip, sıralamada yakın (değeri yakın) öğelerden seçilir; seri uzadıkça pencere daralır,
// sorular zorlaşır. Kazanan yalnızca yakınında hem büyük hem küçük rakip varsa kalır ve rakibin büyük ya da
// küçük çıkması yarı yarıyadır; böylece "balina"dan sonra hep küçük gelen anlamsız sorular olmaz.
function pickPair(cat, keep) {
  const sorted = cat.items.slice().sort((x, y) => x.v - y.v);
  const rank = new Map(sorted.map((x, i) => [x, i]));
  const n = sorted.length, streak = nq?.streak || 0;
  const win = Math.max(2, Math.round(n * 0.3 * Math.pow(0.88, streak))); // sıralama farkı en çok bu kadar
  const recent = nq?.recent || [];
  const near = (a, dir) => sorted.filter((b) => {
    const d = rank.get(b) - rank.get(a);
    return b !== a && (dir > 0 ? d > 0 : d < 0) && Math.abs(d) <= win && farEnough(cat, a, b) && closeEnough(a, b);
  });
  // iki değer arasındaki fark da sınırlı: seri uzadıkça daha yakın değerler gelir
  function closeEnough(a, b) {
    if (cat.abs) return Math.abs(a.v - b.v) <= Math.max(cat.gap * 2, 120 * Math.pow(0.9, streak));
    const r = Math.max(a.v, b.v) / Math.max(1e-9, Math.min(a.v, b.v));
    return r <= Math.max(cat.gap * 1.4, 6 * Math.pow(0.88, streak));
  }
  const fresh = (l) => { const f = l.filter((b) => !recent.includes(b.n)); return f.length ? f : l; };
  const any = (l) => l[Math.floor(Math.random() * l.length)];
  if (keep) {
    const up = fresh(near(keep, 1)), down = fresh(near(keep, -1));
    if (up.length && down.length) {
      const b = any(Math.random() < 0.5 ? up : down);
      return Math.random() < 0.5 ? [keep, b] : [b, keep];
    }
  }
  for (let t = 0; t < 200; t++) {
    const a = any(sorted);
    if (recent.includes(a.n) && t < 150) continue;
    const opts = fresh([...near(a, 1), ...near(a, -1)]);
    if (!opts.length) continue;
    const b = any(opts);
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }
  return [sorted[0], sorted[n - 1]];
}
function startNumber(id) {
  const cat = NUMCATS.find((c) => c.id === id);
  if (!cat) return;
  if (mode) leaveRoom(true);
  nq = { cat, streak: 0, phase: "pick", recent: [], pair: null, pick: -1 };
  nq.pair = pickPair(cat);
  if (screen !== "number") pushScreen({ jqScreen: "number" });
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
    case "rkgo": {
      const q = view?.question;
      if (!q || q.mine || rkFilled(q) < (num(q.slots) || 5)) return;
      sfx("lock");
      return act({ type: "answer", q: q.id, answer: [...rkPicks(q)] });
    }
    case "rkclear":
      if (view?.question) { rkPicks(view.question).fill(null); rk.last = -1; }
      sfx("unpick");
      return rankRedraw();
    case "ytplay":
      yt.want = false;
      return ytPlay();
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
      return backHome(() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    case "numAgain":
      return startNumber(nq.cat.id);
    case "numExit":
      ui.genre = "Sayı";
      return backHome(() => document.getElementById("catalog")?.scrollIntoView({ block: "start" }));
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
      if (d.go === "home" && inGame() && !confirm(LEAVE_Q)) return;
      // Tek başına oynarken ana sayfaya dönmek oyunu bitirir (geri dönülecek bir lobi yok).
      if (d.go === "home" && (mode?.role === "solo" || hostAlone())) return leaveRoom();
      if (d.go === "home" && !mode && screen !== "home") return backHome();
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
    if (d.rk !== undefined) {
      const q = view?.question;
      if (!q || q.mine || view.phase !== "question" || hostNow() < q.start) return;
      const o = q.options[Number(d.rk)];
      const at = rkPicks(q).indexOf(o);
      if (at >= 0) { rkRemove(q, at); sfx("unpick"); }
      else if (rkPlace(q, o)) sfx("pick");
      return rankRedraw();
    }
    if (d.rs !== undefined) {
      const q = view?.question;
      if (!q || q.mine) return;
      rkRemove(q, Number(d.rs));
      sfx("unpick");
      return rankRedraw();
    }
    if (d.oa !== undefined || d.os !== undefined) {
      const q = view?.question;
      if (!q || q.mine || view.phase !== "question" || hostNow() < q.start) return;
      const p = opPicks(q);
      if (d.oa !== undefined) p.a = q.options[Number(d.oa)];
      else p.s = q.options2[Number(d.os)];
      sfx("pick");
      $$("[data-oa]").forEach((b) => b.classList.toggle("picked", q.options[Number(b.dataset.oa)] === p.a));
      $$("[data-os]").forEach((b) => b.classList.toggle("picked", q.options2[Number(b.dataset.os)] === p.s));
      if (p.a && p.s) {
        sfx("lock");
        return act({ type: "answer", q: q.id, answer: { anime: p.a, song: p.s } });
      }
      return;
    }
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
      if (k === "gmode") { if (dt) dt.dataset.g = d.v; sheetBody.dataset.g = d.v; }
      if (dt && k === "play") dt.dataset.play = d.v;
      if (k === "rev") { const cs = $("#clipSeg"); if (cs) cs.outerHTML = clipSeg(); }
      if (k === "video") sheetCtx.video = d.v === "1";
      if (k === "era" && sheetCtx.list?.anime) { const o = $(".opts"); if (o) o.innerHTML = `<p class="muted">${spinner()} Sorular hazırlanıyor…</p>`; loadAnime(sheetCtx.list, d.v); }
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
    const g = gainOf(v);
    audio.volume = g;
    audio.muted = g === 0;
    store.set("jqVolume", v);
    // çalmakta olan sese de hemen uygula: tersten kesit, YouTube opening ve ses efektleri
    if (rgain) rgain.gain.value = g;
    if (yt.frame) { ytCmd("setVolume", [Math.round(g * 100)]); ytCmd(g === 0 ? "mute" : "unMute"); }
    setSfxVolume(g);
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
window.addEventListener("beforeunload", (e) => {
  // oyun sürerken sekmeyi kapatma / yenileme / siteden çıkma: tarayıcı "emin misin?" diye sorar
  if (inGame()) { e.preventDefault(); e.returnValue = ""; return; }
  mode?.net?.close({ quiet: true });
});
window.addEventListener("pagehide", () => mode?.net?.close({ quiet: true }));

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
