// Puan sıralaması: sunucusuz ve ücretsiz. Her oyuncunun her quiz için tek bir imzalı Nostr kaydı vardır
// (NIP-78, kind 30078, d = "jqscore:<quiz>"); yalnızca kendi rekorunu geçince yenisini yayınlar.
// Herkese açık röleler eski kayıtları silebilir; tools/archive_community.mjs bu kayıtları da
// quiz/data/scores.json içine biriktirir. Site ikisini birleştirir, her oyuncunun en iyi puanını sayar.
// Sıralamaya yalnızca 10 soruluk oyunlar girer; puan, süre ayarından bağımsız hesaplanır (engine.js, lbPoints).
import { sign, valid, relayCall, sendToRelays, RELAYS, myPubkey, blocked } from "./community.js?v=8";

export const LB_QUESTIONS = 10;
export const LB_TOP = 20;
export const LB_TAG = "jinjaquiz-score";
export const LB_MAX = 2000;
const KIND = 30078;
const BEST = "jqLbBest";
const PENDING = "jqLbPending";
const AVATARS = ["headphones", "guitar", "mic-vocal", "disc-3", "radio", "drum"];
const COLORS = ["coral", "violet", "mint", "gold", "sky", "rose"];
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Quiz kimliğini sıralama anahtarına çevirir; uygun değilse "" (o quizin sıralaması yok). */
export const lbKey = (id) => {
  const k = String(id ?? "").toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(k) ? k : "";
};

const local = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
};

/** Kaydı sıralama satırına çevirir; bozuksa null. */
function parse(e, key) {
  const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
  if (d !== "jqscore:" + key) return null;
  let c;
  try { c = JSON.parse(e.content); } catch { return null; }
  const s = Number(c?.s);
  if (!c || c.v !== 1 || c.q !== key || !Number.isInteger(s) || s < 0 || s > LB_MAX) return null;
  return {
    pk: e.pubkey,
    s,
    n: str(c.n, 24) || "Anonim",
    a: AVATARS.includes(c.a) ? c.a : "headphones",
    k: COLORS.includes(c.k) ? c.k : "coral",
    c: Math.max(0, Math.min(LB_QUESTIONS, Number(c.c) | 0)),
    at: e.created_at,
  };
}

// Site arşivi bir kez indirilir (bütün quizlerin kayıtları tek dosyada).
let arcP = null;
function archive() {
  arcP ??= fetch(new URL("../data/scores.json", import.meta.url), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (Array.isArray(j?.events) ? j.events.slice(0, 20000) : []))
    .catch(() => []);
  return arcP;
}

const cache = new Map(); // key -> { rows, events, at }
const loading = new Map(); // key -> Promise
const ownEvents = new Map(); // key -> bu oturumda yayınlanan kendi kaydım (röleye ulaşmasa da görünsün)

function merge(key, events) {
  const best = new Map();
  for (const e of events) {
    const r = parse(e, key);
    if (!r) continue;
    const p = best.get(r.pk);
    // Aynı oyuncunun en iyi puanı sayılır; eşitse önce ulaşan önde.
    if (!p || r.s > p.s || (r.s === p.s && r.at < p.at)) best.set(r.pk, r);
  }
  return [...best.values()].sort((a, b) => b.s - a.s || a.at - b.at);
}

/** Bellekteki son sıralama (yoksa undefined). */
export const peekBoard = (key) => cache.get(key)?.rows;

/** Quizin sıralamasını rölelerden ve site arşivinden toplar. Sonuç: sıralı satırlar. */
export function loadBoard(key, { fresh = false } = {}) {
  key = lbKey(key);
  if (!key) return Promise.resolve([]);
  const c = cache.get(key);
  if (!fresh && c && Date.now() - c.at < 60000) return Promise.resolve(c.rows);
  if (loading.has(key)) return loading.get(key);
  const p = (async () => {
    retryPending();
    const sub = "lb" + Math.random().toString(36).slice(2, 8);
    const got = [];
    const arc = archive();
    await Promise.all(RELAYS.map((url) => relayCall(url,
      (ws) => ws.send(JSON.stringify(["REQ", sub, { kinds: [KIND], "#d": ["jqscore:" + key], limit: 1000 }])),
      (x) => {
        if ((x[0] === "EOSE" || x[0] === "CLOSED") && x[1] === sub) return true;
        if (x[0] === "EVENT" && x[1] === sub && valid(x[2])) got.push(x[2]);
        return undefined;
      }, 5000)));
    const fromArc = (await arc).filter((e) => e && Array.isArray(e.tags) && e.tags.some((t) => t[0] === "d" && t[1] === "jqscore:" + key));
    const mine = ownEvents.get(key);
    const bl = await blocked();
    const events = [...got, ...fromArc.filter(valid), ...(mine ? [mine] : [])].filter((e) => !bl.pubkeys.has(e.pubkey));
    const rows = merge(key, events);
    cache.set(key, { rows, events, at: Date.now() });
    return rows;
  })().finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

/** Bu tarayıcının bu quizdeki rekoru (sıralama puanı). */
export const myBest = (key) => Number(local.get(BEST, {})[lbKey(key)]) || 0;

/**
 * 10 soruluk bir oyunun sonucunu sıralamaya gönderir. Yalnızca rekor kırılınca yayınlanır.
 * Dönüş: { sent: bool, best: önceki rekor }.
 */
export async function submitScore({ key, score, correct, name, avatar, color }) {
  key = lbKey(key);
  score = Math.round(Number(score) || 0);
  if (!key || score <= 0 || score > LB_MAX) return { sent: false, best: 0 };
  const bests = local.get(BEST, {});
  const prev = Number(bests[key]) || 0;
  if (score <= prev) return { sent: false, best: prev };
  const content = JSON.stringify({
    v: 1, q: key, s: score, c: Math.max(0, Math.min(LB_QUESTIONS, Number(correct) | 0)),
    n: str(name, 24) || "Anonim", a: AVATARS.includes(avatar) ? avatar : "headphones", k: COLORS.includes(color) ? color : "coral",
  });
  const e = sign(KIND, [["d", "jqscore:" + key], ["t", LB_TAG], ["client", "jinjagames.com/quiz"]], content);
  bests[key] = score;
  local.set(BEST, bests);
  ownEvents.set(key, e);
  // Bellekteki sıralamaya hemen ekle ki oyuncu kendini beklemeden görsün.
  const c = cache.get(key);
  if (c) c.events.push(e), (c.rows = merge(key, c.events));
  const ok = await sendToRelays(e).catch(() => false);
  if (!ok) {
    // Bağlantı yoksa sonraki açılışta yeniden denenir.
    const pend = local.get(PENDING, []).filter((x) => x?.tags?.[0]?.[1] !== "jqscore:" + key);
    local.set(PENDING, [...pend, e].slice(-30));
  }
  return { sent: true, best: prev };
}

let retried = false;
function retryPending() {
  if (retried) return;
  retried = true;
  const pend = local.get(PENDING, []);
  if (!pend.length) return;
  local.set(PENDING, []);
  for (const e of pend) if (valid(e)) sendToRelays(e).then((ok) => { if (!ok) local.set(PENDING, [...local.get(PENDING, []), e].slice(-30)); }).catch(() => {});
}

export const isMine = (row) => row?.pk === myPubkey();
