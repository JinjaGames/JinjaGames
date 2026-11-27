// JinjaQuiz topluluk quizlerini kalıcı tutar.
// Herkese açık Nostr röleleri eski kayıtları zamanla silebilir; bu betik rölelerdeki imzalı kayıtları
// quiz/data/community.json içine biriktirir. Site bu arşivi de okur ve rölelerde eksik olanları
// rölelere geri gönderir. Kayıtlar imzalı olduğu için arşivdeki hiçbir quiz değiştirilemez.
// Puan sıralaması kayıtlarını da (quiz/js/board.js) quiz/data/scores.json içine biriktirir.
// Kullanım: node tools/archive_community.mjs   (GitHub Actions'ta 6 saatte bir çalışır)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { schnorr, sha256, bytesToHex, hexToBytes } from "../quiz/vendor/nostr-sign.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "quiz/data/community.json");
const RELAYS = ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.damus.io", "wss://nostr.mom", "wss://relay.nostr.band", "wss://offchain.pub"];
const KIND = 30078;
const TAG = "jinjaquiz";
const MAX_EVENTS = 3000;
// Sitedeki SONG_CUTOFF ile aynı: bu tarihten önceki şarkı listeleri arşive alınmaz.
const SONG_CUTOFF = Number((readFileSync(join(ROOT, "quiz/js/community.js"), "utf8").match(/SONG_CUTOFF = (\d+)/) || [])[1] || 0);
const enc = new TextEncoder();

const dTag = (e) => (e.tags.find((t) => t[0] === "d") || [])[1] || "";
function valid(e) {
  try {
    if (!e || e.kind !== KIND || typeof e.content !== "string" || e.content.length > 60000) return false;
    if (!/^jinjaquiz:[a-z0-9]{6,24}$/.test(dTag(e))) return false;
    if (!e.tags.some((t) => t[0] === "t" && t[1] === TAG)) return false;
    if (e.created_at < SONG_CUTOFF && !/"kind":"trivia"/.test(e.content)) return false;
    const id = bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
    if (id !== e.id) return false;
    return schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    return false;
  }
}
const pick = ({ id, pubkey, created_at, kind, tags, content, sig }) => ({ id, pubkey, created_at, kind, tags, content, sig });

function fetchRelay(url) {
  return new Promise((resolve) => {
    const got = [];
    let ws;
    const done = () => { clearTimeout(t); try { ws.close(); } catch {} resolve(got); };
    const t = setTimeout(done, 12000);
    try { ws = new WebSocket(url); } catch { return done(); }
    ws.onopen = () => ws.send(JSON.stringify(["REQ", "arc", { kinds: [KIND], "#t": [TAG], limit: 1000 }]));
    ws.onerror = done;
    ws.onmessage = (m) => {
      let x;
      try { x = JSON.parse(m.data); } catch { return; }
      if (x[0] === "EVENT" && x[1] === "arc") got.push(x[2]);
      if ((x[0] === "EOSE" || x[0] === "CLOSED") && x[1] === "arc") done();
    };
  });
}

let old = [];
try { old = JSON.parse(readFileSync(OUT, "utf8")).events || []; } catch {}
const best = new Map();
const add = (e) => {
  if (!valid(e)) return;
  const k = e.pubkey + "|" + dTag(e);
  const p = best.get(k);
  // NIP-01: daha yeni olan, eşitse kimliği küçük olan kazanır. Silinmiş sürüm de saklanır ki geri gelmesin.
  if (!p || p.created_at < e.created_at || (p.created_at === e.created_at && e.id < p.id)) best.set(k, pick(e));
};
old.forEach(add);
const before = JSON.stringify(old.map((e) => e.id).sort());
const results = await Promise.all(RELAYS.map(fetchRelay));
results.flat().forEach(add);
const events = [...best.values()].sort((a, b) => b.created_at - a.created_at).slice(0, MAX_EVENTS);
const after = JSON.stringify(events.map((e) => e.id).sort());
console.log(`Röleler: ${results.map((r, i) => `${RELAYS[i].slice(6)}=${r.length}`).join(", ")}`);
console.log(`Arşiv: ${old.length} → ${events.length} kayıt`);
if (before === after && old.length) {
  console.log("Değişiklik yok.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ note: "JinjaQuiz topluluk quizleri arşivi (imzalı Nostr kayıtları). tools/archive_community.mjs üretir.", events }) + "\n");
}

// ---- Puan sıralaması kayıtları (quiz/js/board.js) ----
// Her oyuncunun her quizdeki en İYİ kaydı saklanır (röleler yalnızca en yenisini tutar).
const SCORES = join(ROOT, "quiz/data/scores.json");
const SCORE_TAG = "jinjaquiz-score";
const MAX_SCORES = 20000;
const scoreOf = (e) => { try { const c = JSON.parse(e.content); return Number.isInteger(c?.s) ? c.s : -1; } catch { return -1; } };
function validScore(e) {
  try {
    if (!e || e.kind !== KIND || typeof e.content !== "string" || e.content.length > 600) return false;
    const d = dTag(e);
    if (!/^jqscore:[a-z0-9][a-z0-9-]{0,63}$/.test(d)) return false;
    if (!e.tags.some((t) => t[0] === "t" && t[1] === SCORE_TAG)) return false;
    const c = JSON.parse(e.content);
    if (!c || c.v !== 1 || "jqscore:" + c.q !== d || !Number.isInteger(c.s) || c.s < 0 || c.s > 2000) return false;
    const id = bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
    if (id !== e.id) return false;
    return schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    return false;
  }
}
function fetchScores(url) {
  return new Promise((resolve) => {
    const got = [];
    let ws;
    const done = () => { clearTimeout(t); try { ws.close(); } catch {} resolve(got); };
    const t = setTimeout(done, 15000);
    try { ws = new WebSocket(url); } catch { return done(); }
    ws.onopen = () => ws.send(JSON.stringify(["REQ", "sc", { kinds: [KIND], "#t": [SCORE_TAG], limit: 5000 }]));
    ws.onerror = done;
    ws.onmessage = (m) => {
      let x;
      try { x = JSON.parse(m.data); } catch { return; }
      if (x[0] === "EVENT" && x[1] === "sc") got.push(x[2]);
      if ((x[0] === "EOSE" || x[0] === "CLOSED") && x[1] === "sc") done();
    };
  });
}
let oldS = [];
try { oldS = JSON.parse(readFileSync(SCORES, "utf8")).events || []; } catch {}
const bestS = new Map();
const addS = (e) => {
  if (!validScore(e)) return;
  const k = e.pubkey + "|" + dTag(e);
  const p = bestS.get(k);
  const s = scoreOf(e), ps = p ? scoreOf(p) : -1;
  if (!p || s > ps || (s === ps && e.created_at < p.created_at)) bestS.set(k, pick(e));
};
oldS.forEach(addS);
const beforeS = JSON.stringify(oldS.map((e) => e.id).sort());
const resS = await Promise.all(RELAYS.map(fetchScores));
resS.flat().forEach(addS);
const scoreEvents = [...bestS.values()].sort((a, b) => b.created_at - a.created_at).slice(0, MAX_SCORES);
console.log(`Puan kayıtları: ${oldS.length} → ${scoreEvents.length}`);
if (beforeS !== JSON.stringify(scoreEvents.map((e) => e.id).sort()) || !oldS.length) {
  mkdirSync(dirname(SCORES), { recursive: true });
  writeFileSync(SCORES, JSON.stringify({ note: "JinjaQuiz puan sıralaması arşivi (imzalı Nostr kayıtları, oyuncu başına en iyi puan). tools/archive_community.mjs üretir.", events: scoreEvents }) + "\n");
}
// ---- Oynanma sayıları (quiz/js/plays.js) ----
// Her oyuncunun her quiz için kaydında o quizi kaç kez bitirdiği yazar; arşiv kişi başına en yüksek sayıyı tutar
// (kişi = açık anahtarın ilk 12 hanesi). Site toplamı arşiv + rölelerden hesaplar.
const PLAYS = join(ROOT, "quiz/data/plays.json");
const PLAYS_TAG = "jinjaquiz-plays";
const PLAYS_MAX = 500;
function playOf(e) {
  try {
    if (!e || e.kind !== KIND || typeof e.content !== "string" || e.content.length > 400) return null;
    if (!e.tags.some((t) => t[0] === "t" && t[1] === PLAYS_TAG)) return null;
    const c = JSON.parse(e.content);
    const k = String(c?.q || "");
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(k) || /^(my|dz)/.test(k) || dTag(e) !== "jqplays:" + k || c.v !== 1 || !Number.isInteger(c.n) || c.n < 1) return null;
    const id = bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
    if (id !== e.id || !schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey))) return null;
    return { k, pk: e.pubkey.slice(0, 12), n: Math.min(PLAYS_MAX, c.n) };
  } catch {
    return null;
  }
}
function fetchPlays(url) {
  return new Promise((resolve) => {
    const got = [];
    let ws;
    const done = () => { clearTimeout(t); try { ws.close(); } catch {} resolve(got); };
    const t = setTimeout(done, 15000);
    try { ws = new WebSocket(url); } catch { return done(); }
    ws.onopen = () => ws.send(JSON.stringify(["REQ", "pl", { kinds: [KIND], "#t": [PLAYS_TAG], limit: 5000 }]));
    ws.onerror = done;
    ws.onmessage = (m) => {
      let x;
      try { x = JSON.parse(m.data); } catch { return; }
      if (x[0] === "EVENT" && x[1] === "pl") got.push(x[2]);
      if ((x[0] === "EOSE" || x[0] === "CLOSED") && x[1] === "pl") done();
    };
  });
}
let by = {};
try { by = JSON.parse(readFileSync(PLAYS, "utf8")).by || {}; } catch {}
const beforeP = JSON.stringify(by);
const resP = await Promise.all(RELAYS.map(fetchPlays));
let nP = 0;
for (const e of resP.flat()) {
  const p = playOf(e);
  if (!p) continue;
  nP++;
  by[p.k] ||= {};
  if (!(by[p.k][p.pk] >= p.n)) by[p.k][p.pk] = p.n;
}
const sortedBy = Object.fromEntries(Object.keys(by).sort().map((k) => [k, Object.fromEntries(Object.entries(by[k]).sort())]));
console.log(`Oynanma kayıtları: ${nP} geçerli, ${Object.keys(sortedBy).length} quiz`);
if (JSON.stringify(sortedBy) !== beforeP) {
  writeFileSync(PLAYS, JSON.stringify({ note: "JinjaQuiz oynanma sayıları (kişi başına en yüksek sayı; kişi = açık anahtarın ilk 12 hanesi). tools/archive_community.mjs üretir.", by: sortedBy }) + "\n");
}
process.exit(0);
