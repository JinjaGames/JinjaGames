// Oynanma sayıları: sunucusuz. Her oyuncunun her quiz için tek bir imzalı kaydı vardır (NIP-78, kind 30078,
// d = "jqplays:<quiz>"); içinde o quizi bu tarayıcıda kaç kez bitirdiği yazar. Aynı kişi 4 kez oynadıysa 4 sayılır.
// Bir quizin toplamı = herkesin kendi sayısının toplamı. Röleler eski kayıtları silebileceği için
// tools/archive_community.mjs sayıları quiz/data/plays.json içine biriktirir; site ikisini birleştirir.
import { sign, valid, relayCall, sendToRelays, RELAYS, myPubkey, blocked } from "./community.js?v=10";

const KIND = 30078;
const TAG = "jinjaquiz-plays";
export const PLAYS_MAX = 500; // bir kişinin bir quiz için sayılan en fazla oynanması (şişirmeye karşı)
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
let loaded = false;
const listeners = new Set();
export const onPlays = (fn) => listeners.add(fn);
export const plays = (id) => totals.get(playKey(id)) || 0;
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
  totals.set(k, (totals.get(k) || 0) + 1);
  listeners.forEach((fn) => fn());
  clearTimeout(flushT);
  flushT = setTimeout(flush, 2500);
}
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

let loadP = null;
/** Bütün quizlerin oynanma sayılarını toplar (arşiv + röleler + bu tarayıcı). */
export function loadPlays() {
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
    await Promise.all(RELAYS.map((url) => relayCall(url,
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
    for (const [k, m] of per) totals.set(k, [...m.values()].reduce((a, b) => a + b, 0));
    loaded = true;
    listeners.forEach((fn) => fn());
  })().catch(() => { loaded = true; });
  return loadP;
}
