// Açık lobiler: sunucusuz. Kurucu, lobisini "herkese açık" yaptıysa lobi beklerken birkaç dakikalık ömrü olan
// imzalı bir duyuru (NIP-78, kind 30078, d = "jqlobby:<kod>", NIP-40 son kullanma etiketiyle) yayınlar ve
// dakikada bir tazeler. Ana sayfa son 3 dakikada tazelenen, oyunu başlamamış ve dolmamış lobileri listeler.
// Her lobi kendi rastgele anahtarıyla imzalanır: duyuru kurucunun topluluk quizleriyle ilişkilendirilemez.
// Özel lobiler hiç duyurulmaz. Sohbet ve oyun verisi duyuruya girmez.
import { schnorr, sha256, bytesToHex } from "../vendor/nostr-sign.js";
import { relayCall, sendToRelays, RELAYS, valid } from "./community.js?v=8";

const KIND = 30078;
const TAG = "jinjaquiz-lobby";
export const LOBBY_TTL = 180; // sn: bu kadar süre tazelenmeyen duyuru listelenmez
const enc = new TextEncoder();
const AVATARS = ["headphones", "guitar", "mic-vocal", "disc-3", "radio", "drum"];
const COLORS = ["coral", "violet", "mint", "gold", "sky", "rose"];
const CODE = /^[A-HJ-NP-Z2-9]{5}$/;
const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");

function lobbyKey(code) {
  let k = "";
  try { k = sessionStorage.getItem("jqLK" + code) || ""; } catch {}
  if (!/^[0-9a-f]{64}$/.test(k)) {
    k = bytesToHex(schnorr.utils.randomPrivateKey());
    try { sessionStorage.setItem("jqLK" + code, k); } catch {}
  }
  return k;
}
function signWith(sk, tags, content) {
  const e = { pubkey: bytesToHex(schnorr.getPublicKey(sk)), created_at: Math.floor(Date.now() / 1000), kind: KIND, tags, content };
  e.id = bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
  e.sig = bytesToHex(schnorr.sign(e.id, sk));
  return e;
}

/** Lobiyi duyurur (info.open = false ise listeden kaldırır). */
export function announceLobby(code, info) {
  if (!CODE.test(code)) return Promise.resolve(false);
  const now = Math.floor(Date.now() / 1000);
  const content = JSON.stringify({
    v: 1, code, open: !!info.open, phase: info.phase === "lobby" ? "lobby" : "game",
    host: { n: str(info.host?.name, 20) || "Oyuncu", a: AVATARS.includes(info.host?.avatar) ? info.host.avatar : "headphones", k: COLORS.includes(info.host?.color) ? info.host.color : "coral" },
    players: Math.max(0, Math.min(99, info.players | 0)), max: Math.max(1, Math.min(99, info.max | 0)),
    quizzes: (Array.isArray(info.quizzes) ? info.quizzes : []).map((x) => str(x, 40)).filter(Boolean).slice(0, 3),
    more: Math.max(0, Math.min(99, info.more | 0)),
  });
  const tags = [["d", "jqlobby:" + code], ["t", TAG], ["expiration", String(now + (info.open ? LOBBY_TTL + 60 : 60))]];
  return sendToRelays(signWith(lobbyKey(code), tags, content)).catch(() => false);
}

function parse(e) {
  const d = (e.tags.find((t) => t[0] === "d") || [])[1] || "";
  let c;
  try { c = JSON.parse(e.content); } catch { return null; }
  if (!c || c.v !== 1 || !CODE.test(c.code) || d !== "jqlobby:" + c.code) return null;
  return {
    code: c.code, at: e.created_at, open: c.open === true, phase: c.phase === "lobby" ? "lobby" : "game",
    host: { name: str(c.host?.n, 20) || "Oyuncu", avatar: AVATARS.includes(c.host?.a) ? c.host.a : "headphones", color: COLORS.includes(c.host?.k) ? c.host.k : "coral" },
    players: Math.max(0, Math.min(99, Number(c.players) | 0)), max: Math.max(1, Math.min(99, Number(c.max) | 0)),
    quizzes: (Array.isArray(c.quizzes) ? c.quizzes : []).map((x) => str(x, 40)).filter(Boolean).slice(0, 3),
    more: Math.max(0, Math.min(99, Number(c.more) | 0)),
  };
}

/** Şu an katılınabilen açık lobiler (en yeni önce). */
export async function listLobbies() {
  const since = Math.floor(Date.now() / 1000) - LOBBY_TTL;
  const sub = "lb" + Math.random().toString(36).slice(2, 8);
  const best = new Map(); // kod -> en yeni duyuru
  await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(["REQ", sub, { kinds: [KIND], "#t": [TAG], since, limit: 200 }])),
    (x) => {
      if ((x[0] === "EOSE" || x[0] === "CLOSED") && x[1] === sub) return true;
      if (x[0] !== "EVENT" || x[1] !== sub || !valid(x[2])) return undefined;
      const l = x[2].created_at >= since ? parse(x[2]) : null;
      const p = l && best.get(l.code);
      if (l && (!p || l.at > p.at)) best.set(l.code, l);
      return undefined;
    }, 4500)));
  return [...best.values()].filter((l) => l.open && l.phase === "lobby" && l.players < l.max).sort((a, b) => b.at - a.at).slice(0, 40);
}
