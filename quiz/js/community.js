// Topluluk quizleri: sunucusuz ve ücretsiz. Her quiz, herkese açık Nostr rölelerine imzalı bir kayıt
// (NIP-78 uygulama verisi, kind 30078) olarak yazılır; herkes aynı etiketle okur. Yazar, bu tarayıcıda
// saklanan anahtarla imzalar; aynı quizi yalnızca o güncelleyebilir ya da kaldırabilir.
// Gelen her kayıt imzası doğrulandıktan ve alan alan süzüldükten sonra kullanılır.
import { schnorr, sha256, bytesToHex, hexToBytes } from "../vendor/nostr-sign.js";
import { cdn } from "./music.js?v=5";
import { cleanItems, cleanCat, cleanEmoji, T_MIN, T_MAX } from "./trivia.js?v=4";
import { cleanRank, cleanOps } from "./engine.js?v=12";
import { isBadName, maskName } from "./badwords.js?v=1";
// Önceden yayınlanmış quizlerde uygunsuz ad / açıklama / yazar ekranda gizlenir (kayda dokunulmaz).
const tidy = (q) => (isBadName(q.name) || isBadName(q.desc) || isBadName(q.author) ? { ...q, name: maskName(q.name), desc: isBadName(q.desc) ? "" : q.desc, author: maskName(q.author) } : q);

export const OP_MIN = 4; // anime opening quizinde en az (şıklar diğer openinglerden oluşur)

export const RELAYS = globalThis.__JQ_TEST_RELAYS || ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.damus.io", "wss://nostr.mom", "wss://relay.nostr.band", "wss://offchain.pub"];
const KIND = 30078;
// Bu tarihten önce yayınlanan şarkı listeleri gösterilmez: eski oluşturucu, sanatçının konuk olduğu
// başka sanatçı şarkılarını da ekliyordu. Trivialar etkilenmez.
export const SONG_CUTOFF = 1795317508;
const TAG = "jinjaquiz";
const KEY = "jqNostrKey";
const HIDE = "jqHidden";
const enc = new TextEncoder();
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n) : "");
const int = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0);

export const MIN_TRACKS = 5;
export const MAX_TRACKS = 200;

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

export const eventId = (e) => bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
export function sign(kind, tags, content, after = 0) {
  const sk = secret();
  // Değiştirilebilir kayıtta en yeni zaman damgası kazanır: önceki sürümden kesinlikle sonra olmalı.
  const e = { pubkey: bytesToHex(schnorr.getPublicKey(sk)), created_at: Math.max(Math.floor(Date.now() / 1000), after + 1), kind, tags, content };
  e.id = eventId(e);
  e.sig = bytesToHex(schnorr.sign(e.id, sk));
  return e;
}
export function valid(e) {
  try {
    if (!e || typeof e !== "object" || e.kind !== KIND || typeof e.content !== "string" || e.content.length > 60000) return false;
    if (!/^[0-9a-f]{64}$/.test(e.pubkey) || !/^[0-9a-f]{64}$/.test(e.id) || !/^[0-9a-f]{128}$/.test(e.sig)) return false;
    if (eventId(e) !== e.id) return false;
    return schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    return false;
  }
}

/** Bir kaydı quiz nesnesine çevirir; bozuk ya da eksikse null. (Arşiv betiği de kullanır.) */
export function parse(e) {
  const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
  if (!/^jinjaquiz:[a-z0-9]{6,24}$/.test(d)) return null;
  let c;
  try { c = JSON.parse(e.content); } catch { return null; }
  if (!c || c.v !== 1 || c.deleted) return null;
  const id = "nq-" + e.pubkey.slice(0, 16) + "-" + d.slice(10);
  if (c.kind !== "trivia" && e.created_at < SONG_CUTOFF) return null;
  if (c.kind === "rank" || c.kind === "op") {
    const items = c.kind === "rank" ? cleanRank(c.items).slice(0, 1) : cleanOps(c.items);
    const name = str(c.name, 60);
    if (!name || items.length < (c.kind === "rank" ? 1 : OP_MIN)) return null;
    return {
      id, d, pubkey: e.pubkey, at: e.created_at, kind: c.kind,
      name, desc: str(c.desc, 160), author: str(c.author, 24) || "Anonim",
      emoji: c.kind === "op" ? cleanEmoji(c.emoji) : "", picture: c.kind === "rank" ? cdn(c.cover) : "",
      artist: str(c.artist, 80), artistId: int(c.artistId), rcat: "Topluluk", cat: c.kind === "op" ? "Anime" : "",
      genre: "Topluluk", items, mine: e.pubkey === myPubkey(),
    };
  }
  if (c.kind === "trivia") {
    const items = cleanItems(c.items);
    const name = str(c.name, 60);
    if (!name || items.length < T_MIN) return null;
    return {
      id, d, pubkey: e.pubkey, at: e.created_at, kind: "trivia",
      name, desc: str(c.desc, 160), author: str(c.author, 24) || "Anonim",
      cat: cleanCat(c.cat), emoji: cleanEmoji(c.emoji), picture: "",
      genre: "Topluluk", items, mine: e.pubkey === myPubkey(),
    };
  }
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
    genre: "Topluluk", tracks, rev: !!c.rev, mine: e.pubkey === myPubkey(),
  };
}

export function relayCall(url, onOpen, onMsg, ms) {
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

// Röleler eski kayıtları zamanla silebilir; sitedeki arşiv (tools/archive_community.mjs) quizleri kalıcı tutar.
// Arşiv iki parçadır: hafif bir dizin (ad, yazar, tür, kapak, soru sayısı; ana sayfa için) ve her quizin kendi
// dosyası (imzalı kaydın tamamı; quiz açılınca indirilir). Böylece quiz sayısı artsa da ana sayfa hafif kalır.
const ARCHIVE = new URL("../data/community/", import.meta.url);
const fileOf = (pubkey, d) => `q/${pubkey.slice(0, 16)}-${d.slice(10)}.json`;
async function archiveIndex() {
  try {
    const r = await fetch(new URL("index.json", ARCHIVE), { cache: "no-cache" });
    if (!r.ok) return { upto: 0, items: [] };
    const j = await r.json();
    return { upto: Number(j?.upto) || 0, items: Array.isArray(j?.items) ? j.items : [] };
  } catch {
    return { upto: 0, items: [] };
  }
}
// Dizindeki satır → içeriği henüz yüklenmemiş quiz (full: false). Alanlar parse() ile aynı biçimde süzülür.
function fromIndex(m) {
  const pubkey = String(m?.pk || "").toLowerCase(), d = String(m?.d || "");
  if (!/^[0-9a-f]{64}$/.test(pubkey) || !/^jinjaquiz:[a-z0-9]{6,24}$/.test(d)) return null;
  const at = int(m.at);
  if (m.del) return { del: true, pubkey, d, at };
  const kind = ["trivia", "rank", "op"].includes(m.kind) ? m.kind : "";
  const name = str(m.name, 60);
  const n = Math.min(MAX_TRACKS, int(m.n));
  if (!name || !n) return null;
  return {
    id: "nq-" + pubkey.slice(0, 16) + "-" + d.slice(10), d, pubkey, at, full: false, n,
    ...(kind ? { kind } : {}),
    name, desc: str(m.desc, 160), author: str(m.author, 24) || "Anonim",
    emoji: kind === "trivia" || kind === "op" ? cleanEmoji(m.emoji) : "",
    picture: kind === "trivia" || kind === "op" ? "" : cdn(m.picture),
    artist: str(m.artist, 80), artistId: int(m.artistId),
    ...(kind === "rank" ? { rcat: "Topluluk" } : {}),
    cat: kind === "trivia" ? cleanCat(m.cat) : kind === "op" ? "Anime" : "",
    ...(!kind && m.rev ? { rev: true } : {}),
    genre: "Topluluk", mine: pubkey === myPubkey(),
  };
}
/** Dizinden gelen quizin içeriğini (şarkılar / sorular) arşivdeki kendi dosyasından yükler. */
export async function loadFull(q) {
  if (!q || q.full !== false) return q;
  const r = await fetch(new URL(fileOf(q.pubkey, q.d), ARCHIVE), { cache: "no-cache" }).catch(() => null);
  const e = r?.ok ? await r.json().catch(() => null) : null;
  const p = e && valid(e) && e.pubkey === q.pubkey && dOf(e) === q.d ? parse(e) : null;
  if (!p) throw Error("Bu quiz şu an açılamadı. Biraz sonra tekrar dene.");
  Object.assign(q, p, { full: true });
  return q;
}
// Site engel listesi (quiz/data/blocked.json): kaldırma talebi gelen quizler ve oyuncular gösterilmez.
let blockedP = null;
export function blocked() {
  blockedP ??= fetch(new URL("../data/blocked.json", import.meta.url), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => ({
      quizzes: new Set((Array.isArray(j?.quizzes) ? j.quizzes : []).map(String)),
      pubkeys: new Set((Array.isArray(j?.pubkeys) ? j.pubkeys : []).map((x) => String(x).toLowerCase())),
    }))
    .catch(() => ({ quizzes: new Set(), pubkeys: new Set() }));
  return blockedP;
}
const dOf = (e) => (e.tags.find((t) => t[0] === "d") || [])[1] || "";
// NIP-01: daha yeni olan, eşitse kimliği küçük olan kazanır.
const newer = (a, b) => !b || a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);

/** Arşiv dizininden ve rölelerdeki yeni kayıtlardan topluluk quizlerini toplar (en yeni sürüm kazanır).
 *  Rölelerden yalnızca arşivin son güncellemesinden (bir gün payla) sonraki kayıtlar istenir; eskileri arşivde.
 *  Rölelerde eksik kalan kayıtları rölelere geri yazmak arşiv betiğinin işidir (tools/archive_community.mjs). */
export async function fetchCommunity({ limit = 300, ms = 6000 } = {}) {
  const sub = "jq" + Math.random().toString(36).slice(2, 8);
  const idx = await archiveIndex();
  const best = new Map(); // pubkey|d -> { at, q } (q: quiz nesnesi ya da silinmiş işareti)
  for (const m of idx.items) {
    const q = fromIndex(m);
    if (!q) continue;
    const key = q.pubkey + "|" + q.d;
    const cur = best.get(key);
    if (!cur || q.at > cur.at) best.set(key, { at: q.at, q });
  }
  const filter = { kinds: [KIND], "#t": [TAG], limit };
  if (idx.upto) filter.since = idx.upto - 86400;
  const fromRelay = new Map();
  await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(["REQ", sub, filter])),
    (x) => {
      if (x[0] === "EOSE" && x[1] === sub) return true;
      if (x[0] !== "EVENT" || x[1] !== sub || !valid(x[2])) return undefined;
      const e = x[2];
      const key = e.pubkey + "|" + dOf(e);
      if (newer(e, fromRelay.get(key))) fromRelay.set(key, e);
      return undefined;
    }, ms)));
  for (const [key, e] of fromRelay) {
    const cur = best.get(key);
    if (cur && cur.at >= e.created_at) continue;
    best.set(key, { at: e.created_at, q: parse(e) || { del: true } }); // silinmiş ya da bozuk sürüm eskisini gizler
  }
  const hidden = hiddenSet();
  const bl = await blocked();
  const out = [];
  for (const { q } of best.values()) {
    if (q && !q.del && !hidden.has(q.id) && !bl.quizzes.has(q.id) && !bl.pubkeys.has(q.pubkey)) out.push(tidy(q));
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Quizi yayınlar (aynı d ile tekrar çağırmak günceller). En az bir röle kabul ederse başarılıdır. */
export async function publishQuiz({ d, name, desc, author, tracks, kind, items, cat, emoji, artist, artistId, picture, rev, prevAt = 0 }) {
  d ||= "jinjaquiz:" + bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
  const content = kind === "rank" ? JSON.stringify({
    v: 1, kind: "rank", name: str(name, 60), desc: str(desc, 160), author: str(author, 24), artist: str(artist, 80), artistId: int(artistId), cover: cdn(picture),
    items: cleanRank(items).slice(0, 1),
  }) : kind === "op" ? JSON.stringify({
    v: 1, kind: "op", name: str(name, 60), desc: str(desc, 160), author: str(author, 24), emoji: cleanEmoji(emoji),
    items: cleanOps(items),
  }) : kind === "trivia" ? JSON.stringify({
    v: 1, kind: "trivia", name: str(name, 60), desc: str(desc, 160), author: str(author, 24), cat: cleanCat(cat), emoji: cleanEmoji(emoji),
    items: cleanItems(items).slice(0, T_MAX),
  }) : JSON.stringify({
    v: 1, name: str(name, 60), desc: str(desc, 160), author: str(author, 24), cover: tracks.find((t) => t.cover)?.cover || "", ...(rev ? { rev: 1 } : {}),
    tracks: tracks.slice(0, MAX_TRACKS).map((t) => ({ id: t.id, t: str(t.title, 120), a: str(t.artist, 80), ...(t.cover ? { c: t.cover } : {}) })),
  });
  const e = sign(KIND, [["d", d], ["t", TAG], ["client", "jinjagames.com/quiz"]], content, prevAt);
  const ok = await sendToRelays(e);
  if (!ok) throw Error("Quiz yayınlanamadı. İnternet bağlantını kontrol edip tekrar dene.");
  return parse(e);
}

/** Kendi quizini kaldırır: aynı adreste boş bir sürüm ve bir silme isteği (NIP-09) yayınlar. */
export async function removeQuiz(q) {
  // Silme isteği (e2), "silindi" kaydından (e1) önceye tarihlenir: röleler e2'den önceki sürümleri silse de
  // e1 kalır; böylece site arşivindeki eski sürüm de geri gelmez.
  const e2 = sign(5, [["a", `${KIND}:${q.pubkey}:${q.d}`]], "");
  const e1 = sign(KIND, [["d", q.d], ["t", TAG]], JSON.stringify({ v: 1, deleted: true }), Math.max(q.at || 0, e2.created_at));
  const ok = await sendToRelays(e1);
  sendToRelays(e2);
  if (!ok) throw Error("Kaldırılamadı. Bağlantını kontrol et.");
}

export async function sendToRelays(e) {
  const results = await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(["EVENT", e])),
    (x) => (x[0] === "OK" && x[1] === e.id ? !!x[2] : undefined), 7000)));
  return results.some(Boolean);
}

// Başkasının quizini bu tarayıcıda gizleme (uygunsuz içerik için). Ad da saklanır ki "Gizlenen quizler"den geri açılabilsin.
export function hiddenList() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDE)) || [];
    return (Array.isArray(raw) ? raw : []).map((x) => (typeof x === "string" ? { id: x, name: "" } : { id: str(x?.id, 80), name: str(x?.name, 60), author: str(x?.author, 24) })).filter((x) => x.id);
  } catch {
    return [];
  }
}
function hiddenSet() { return new Set(hiddenList().map((x) => x.id)); }
function saveHidden(list) { try { localStorage.setItem(HIDE, JSON.stringify(list.slice(-500))); } catch {} }
export function hideQuiz(q) { const id = typeof q === "string" ? q : q.id; saveHidden([...hiddenList().filter((x) => x.id !== id), { id, name: q.name || "", author: q.author || "" }]); }
export function unhideQuiz(id) { saveHidden(hiddenList().filter((x) => x.id !== id)); }
