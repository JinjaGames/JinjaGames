// Oynanma sayıları: sunucusuz. Her oyuncunun her quiz için tek bir imzalı kaydı vardır (NIP-78, kind 30078,
// d = "jqplays:<quiz>"); içinde o quizi bu tarayıcıda kaç kez bitirdiği yazar. Aynı kişi 4 kez oynadıysa 4 sayılır.
// Bir quizin toplamı = herkesin kendi sayısının toplamı. Röleler eski kayıtları silebileceği için
// tools/archive_community.mjs sayıları quiz/data/plays.json içine biriktirir; site ikisini birleştirir.
import { sign, valid, relayCall, sendToRelays, RELAYS, myPubkey, blocked } from "./community.js?v=10";

const KIND = 30078;
const TAG = "jinjaquiz-plays";
export const PLAYS_MAX = 100; // bir kişinin bir quiz için sayılan en fazla oynanması (şişirmeye karşı)
const LOCAL = "jqPlays";
const DIRTY = "jqPlaysDirty";
const local = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/** Sayılabilir quiz kimliği (kişisel listeler sayılmaz); değilse "". */
export const playKey = (id) => {
  const k = String(id ?? "").toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(k) && !/^(my|dz)/.test(k) ? k : "";
};

const totals = new Map(); // quiz -> toplam
const people = new Map(); // quiz -> kaç farklı kişi
let loaded = false;
const listeners = new Set();
export const onPlays = (fn) => listeners.add(fn);
export const plays = (id) => totals.get(playKey(id)) || 0;
/** Bu quizi oynayan farklı kişi sayısı */
export const players = (id) => people.get(playKey(id)) || 0;
export const playsLoaded = () => loaded;

/** Bir quiz bitti: bu tarayıcının sayısı bir artar ve (biraz sonra) rölelere yazılır. */
export function countPlay(id) {
  const k = playKey(id);
  if (!k) return;
  const m = local.get(LOCAL, {});
  if ((m[k] | 0) >= PLAYS_MAX) return;
  m[k] = (m[k] | 0) + 1;
  local.set(LOCAL, m);
  local.set(DIRTY, [...new Set([...local.get(DIRTY, []), k])].slice(-60));
  if (m[k] === 1 && playsLoaded()) people.set(k, (people.get(k) || 0) + 1); // bu tarayıcının ilk oyunu
  totals.set(k, (totals.get(k) || 0) + 1); // kendi oyunun ekranda hemen görünür
  if (cacheAt) saveCache();
  listeners.forEach((fn) => fn());
  // yazma hemen yapılır; art arda biten quizler (lobide bir oyun) tek seferde gider
  clearTimeout(flushT);
  flushT = setTimeout(flush, 15000);
}
// sekme kapanırken / arka plana atılırken bekleyenleri göndermeyi dene (olmazsa sonraki açılışta gider)
addEventListener("visibilitychange", () => { if (document.hidden && local.get(DIRTY, []).length) { clearTimeout(flushT); flush(); } });
let flushT = 0;
let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const keys = local.get(DIRTY, []);
    local.set(DIRTY, []);
    const m = local.get(LOCAL, {});
    const failed = [];
    for (const k of keys) {
      if (!playKey(k) || !(m[k] > 0)) continue;
      const e = sign(KIND, [["d", "jqplays:" + k], ["t", TAG], ["client", "jinjagames.com/quiz"]], JSON.stringify({ v: 1, q: k, n: Math.min(PLAYS_MAX, m[k] | 0) }));
      if (!(await sendToRelays(e).catch(() => false))) failed.push(k);
    }
    if (failed.length) local.set(DIRTY, [...new Set([...local.get(DIRTY, []), ...failed])].slice(-60));
  } finally {
    flushing = false;
  }
}

function parse(e) {
  const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
  let c;
  try { c = JSON.parse(e.content); } catch { return null; }
  const k = playKey(c?.q);
  const n = Number(c?.n);
  if (!k || c.v !== 1 || d !== "jqplays:" + k || !Number.isInteger(n) || n < 1) return null;
  return { k, pk: e.pubkey.slice(0, 12), n: Math.min(PLAYS_MAX, n) };
}

// Toplamlar herkese anlık değil, en çok 10 dakikada bir yeniden toplanır: arada tarayıcıdaki önbellekten
// okunur (sayfa kaç kez açılırsa açılsın rölelere sorulmaz). Röleler ve sitenin trafiği rahat eder.
export const PLAYS_REFRESH = 10 * 60 * 1000;
const CACHE = "jqPlaysCache";
let cacheAt = 0;
function saveCache() {
  local.set(CACHE, { at: cacheAt, t: [...totals], p: [...people] });
}
function readCache() {
  const c = local.get(CACHE, null);
  if (!c || !Number.isFinite(c.at) || Date.now() - c.at > PLAYS_REFRESH || Date.now() < c.at || !Array.isArray(c.t)) return false;
  const ok = (e) => Array.isArray(e) && playKey(e[0]) && Number.isInteger(e[1]) && e[1] >= 0;
  totals.clear();
  people.clear();
  for (const e of c.t) if (ok(e)) totals.set(e[0], e[1]);
  for (const e of Array.isArray(c.p) ? c.p : []) if (ok(e)) people.set(e[0], e[1]);
  cacheAt = c.at;
  return true;
}
let loadP = null;
let loadAt = 0;
/** Bütün quizlerin oynanma sayılarını toplar (arşiv + röleler + bu tarayıcı). fresh: süresi dolduysa yeniden topla. */
export function loadPlays({ fresh = false } = {}) {
  if (!loadP && readCache()) {
    loaded = true;
    loadAt = cacheAt;
    loadP = Promise.resolve();
    flush();
    queueMicrotask(() => listeners.forEach((fn) => fn()));
    return loadP;
  }
  if (loadP && Date.now() - loadAt < PLAYS_REFRESH) return loadP;
  if (loadP && !fresh) return loadP;
  loadP = null;
  loadAt = Date.now();
  loadP ??= (async () => {
    flush();
    const per = new Map(); // quiz -> Map(kişi -> sayı)
    const put = (k, pk, n) => {
      if (!per.has(k)) per.set(k, new Map());
      const m = per.get(k);
      if (!(m.get(pk) >= n)) m.set(pk, n);
    };
    const bl = await blocked();
    const bad = (pk) => [...bl.pubkeys].some((x) => x.startsWith(pk));
    try {
      const r = await fetch(new URL("../data/plays.json", import.meta.url), { cache: "no-cache" });
      const j = r.ok ? await r.json() : null;
      for (const [k, users] of Object.entries(j?.by || {})) {
        if (!playKey(k) || !users || typeof users !== "object") continue;
        for (const [pk, n] of Object.entries(users)) if (/^[0-9a-f]{12}$/.test(pk) && Number.isInteger(n) && n > 0 && !bad(pk)) put(k, pk, Math.min(PLAYS_MAX, n));
      }
    } catch {}
    const sub = "pl" + Math.random().toString(36).slice(2, 8);
    // okumak için üç röle yeter (her kayıt altı röleye yazılır)
    await Promise.all(RELAYS.slice(0, 3).map((url) => relayCall(url,
      (ws) => ws.send(JSON.stringify(["REQ", sub, { kinds: [KIND], "#t": [TAG], limit: 5000 }])),
      (x) => {
        if ((x[0] === "EOSE" || x[0] === "CLOSED") && x[1] === sub) return true;
        if (x[0] !== "EVENT" || x[1] !== sub || !valid(x[2])) return undefined;
        const p = parse(x[2]);
        if (p && !bad(p.pk)) put(p.k, p.pk, p.n);
        return undefined;
      }, 6000)));
    const me = myPubkey().slice(0, 12);
    for (const [k, n] of Object.entries(local.get(LOCAL, {}))) if (playKey(k) && n > 0) put(k, me, Math.min(PLAYS_MAX, n | 0));
    totals.clear();
    people.clear();
    for (const [k, m] of per) { totals.set(k, [...m.values()].reduce((a, b) => a + b, 0)); people.set(k, m.size); }
    cacheAt = Date.now();
    saveCache();
    loaded = true;
    listeners.forEach((fn) => fn());
  })().catch(() => { loaded = true; });
  return loadP;
}
