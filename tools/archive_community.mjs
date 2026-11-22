// JinjaQuiz topluluk quizlerini kalıcı tutar.
// Herkese açık Nostr röleleri eski kayıtları zamanla silebilir; bu betik rölelerdeki imzalı kayıtları
// quiz/data/community.json içine biriktirir. Site bu arşivi de okur ve rölelerde eksik olanları
// rölelere geri gönderir. Kayıtlar imzalı olduğu için arşivdeki hiçbir quiz değiştirilemez.
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
const enc = new TextEncoder();

const dTag = (e) => (e.tags.find((t) => t[0] === "d") || [])[1] || "";
function valid(e) {
  try {
    if (!e || e.kind !== KIND || typeof e.content !== "string" || e.content.length > 60000) return false;
    if (!/^jinjaquiz:[a-z0-9]{6,24}$/.test(dTag(e))) return false;
    if (!e.tags.some((t) => t[0] === "t" && t[1] === TAG)) return false;
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
const before = JSON.stringify([...best.values()].map((e) => e.id).sort());
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
process.exit(0);
