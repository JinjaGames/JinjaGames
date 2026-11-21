// Topluluk quizleri: sunucusuz ve ücretsiz. Her quiz, herkese açık Nostr rölelerine imzalı bir kayıt
// (NIP-78 uygulama verisi, kind 30078) olarak yazılır; herkes aynı etiketle okur. Yazar, bu tarayıcıda
// saklanan anahtarla imzalar; aynı quizi yalnızca o güncelleyebilir ya da kaldırabilir.
// Gelen her kayıt imzası doğrulandıktan ve alan alan süzüldükten sonra kullanılır.
import { schnorr, sha256, bytesToHex, hexToBytes } from "../vendor/nostr-sign.js";
import { cdn } from "./music.js";

export const RELAYS = globalThis.__JQ_TEST_RELAYS || ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.damus.io", "wss://nostr.mom", "wss://relay.nostr.band", "wss://offchain.pub"];
const KIND = 30078;
const TAG = "jinjaquiz";
const KEY = "jqNostrKey";
const HIDE = "jqHidden";
const enc = new TextEncoder();
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n) : "");
const int = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0);

export const MIN_TRACKS = 5;
export const MAX_TRACKS = 100;

function secret() {
  let k = null;
  try { k = localStorage.getItem(KEY); } catch {}
  if (!k || !/^[0-9a-f]{64}$/.test(k)) {
    k = bytesToHex(schnorr.utils.randomPrivateKey());
    try { localStorage.setItem(KEY, k); } catch {}
  }
  return k;
}
export const myPubkey = () => bytesToHex(schnorr.getPublicKey(secret()));

const eventId = (e) => bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
function sign(kind, tags, content, after = 0) {
  const sk = secret();
  // Değiştirilebilir kayıtta en yeni zaman damgası kazanır: önceki sürümden kesinlikle sonra olmalı.
  const e = { pubkey: bytesToHex(schnorr.getPublicKey(sk)), created_at: Math.max(Math.floor(Date.now() / 1000), after + 1), kind, tags, content };
  e.id = eventId(e);
  e.sig = bytesToHex(schnorr.sign(e.id, sk));
  return e;
}
function valid(e) {
  try {
    if (!e || typeof e !== "object" || e.kind !== KIND || typeof e.content !== "string" || e.content.length > 60000) return false;
    if (!/^[0-9a-f]{64}$/.test(e.pubkey) || !/^[0-9a-f]{64}$/.test(e.id) || !/^[0-9a-f]{128}$/.test(e.sig)) return false;
    if (eventId(e) !== e.id) return false;
    return schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    return false;
  }
}

/** Bir kaydı quiz nesnesine çevirir; bozuk ya da eksikse null. */
function parse(e) {
  const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
  if (!/^jinjaquiz:[a-z0-9]{6,24}$/.test(d)) return null;
  let c;
  try { c = JSON.parse(e.content); } catch { return null; }
  if (!c || c.v !== 1 || c.deleted) return null;
  const seen = new Set();
  const tracks = (Array.isArray(c.tracks) ? c.tracks : []).slice(0, MAX_TRACKS).map((t) => ({
    id: int(t?.id), title: str(t?.t, 120), artist: str(t?.a, 80), cover: cdn(t?.c),
  })).filter((t) => t.id && t.title && !seen.has(t.id) && seen.add(t.id));
  const name = str(c.name, 60);
  if (!name || tracks.length < MIN_TRACKS) return null;
  return {
    id: "nq-" + e.pubkey.slice(0, 16) + "-" + d.slice(10),
    d, pubkey: e.pubkey, at: e.created_at,
    name, desc: str(c.desc, 160), author: str(c.author, 24) || "Anonim",
    picture: cdn(c.cover) || tracks.find((t) => t.cover)?.cover || "",
    genre: "Topluluk", tracks, mine: e.pubkey === myPubkey(),
  };
}

function relayCall(url, onOpen, onMsg, ms) {
  return new Promise((resolve) => {
    let ws;
    const done = (v) => { clearTimeout(t); try { ws.close(); } catch {} resolve(v); };
    const t = setTimeout(() => done(null), ms);
    try { ws = new WebSocket(url); } catch { return done(null); }
    ws.onopen = () => onOpen(ws);
    ws.onerror = () => done(null);
    ws.onmessage = (m) => { let x; try { x = JSON.parse(m.data); } catch { return; } const r = onMsg(x); if (r !== undefined) done(r); };
  });
}

/** Tüm rölelerden topluluk quizlerini toplar (en yeni sürüm kazanır). */
export async function fetchCommunity({ limit = 300, ms = 6000 } = {}) {
  const sub = "jq" + Math.random().toString(36).slice(2, 8);
  const found = new Map();
  const deleted = new Set();
  await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(["REQ", sub, { kinds: [KIND], "#t": [TAG], limit }])),
    (x) => {
      if (x[0] === "EOSE" && x[1] === sub) return true;
      if (x[0] !== "EVENT" || x[1] !== sub || !valid(x[2])) return undefined;
      const e = x[2];
      const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
      const key = e.pubkey + "|" + d;
      const prev = found.get(key);
      // NIP-01: daha yeni olan, eşitse kimliği küçük olan kazanır.
      if (prev && (prev.created_at > e.created_at || (prev.created_at === e.created_at && prev.id <= e.id))) return undefined;
      found.set(key, e);
      return undefined;
    }, ms)));
  const hidden = hiddenSet();
  const out = [];
  for (const e of found.values()) {
    const q = parse(e);
    if (q && !hidden.has(q.id)) out.push(q);
    else if (!q) deleted.add(e.pubkey + "|" + ((e.tags.find((t) => t[0] === "d") || [])[1] || ""));
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Quizi yayınlar (aynı d ile tekrar çağırmak günceller). En az bir röle kabul ederse başarılıdır. */
export async function publishQuiz({ d, name, desc, author, tracks, prevAt = 0 }) {
  d ||= "jinjaquiz:" + bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
  const content = JSON.stringify({
    v: 1, name: str(name, 60), desc: str(desc, 160), author: str(author, 24), cover: tracks.find((t) => t.cover)?.cover || "",
    tracks: tracks.slice(0, MAX_TRACKS).map((t) => ({ id: t.id, t: str(t.title, 120), a: str(t.artist, 80), ...(t.cover ? { c: t.cover } : {}) })),
  });
  const e = sign(KIND, [["d", d], ["t", TAG], ["client", "jinjagames.com/quiz"]], content, prevAt);
  const ok = await sendToRelays(e);
  if (!ok) throw Error("Quiz yayınlanamadı. İnternet bağlantını kontrol edip tekrar dene.");
  return parse(e);
}

/** Kendi quizini kaldırır: aynı adreste boş bir sürüm ve bir silme isteği (NIP-09) yayınlar. */
export async function removeQuiz(q) {
  const e1 = sign(KIND, [["d", q.d], ["t", TAG]], JSON.stringify({ v: 1, deleted: true }), q.at || 0);
  const e2 = sign(5, [["a", `${KIND}:${q.pubkey}:${q.d}`]], "");
  const ok = await sendToRelays(e1);
  sendToRelays(e2);
  if (!ok) throw Error("Kaldırılamadı. Bağlantını kontrol et.");
}

async function sendToRelays(e) {
  const results = await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(["EVENT", e])),
    (x) => (x[0] === "OK" && x[1] === e.id ? !!x[2] : undefined), 7000)));
  return results.some(Boolean);
}

// Başkasının quizini bu tarayıcıda gizleme (uygunsuz içerik için)
function hiddenSet() { try { return new Set(JSON.parse(localStorage.getItem(HIDE)) || []); } catch { return new Set(); } }
export function hideQuiz(id) { const s = hiddenSet(); s.add(id); try { localStorage.setItem(HIDE, JSON.stringify([...s].slice(-500))); } catch {} }
