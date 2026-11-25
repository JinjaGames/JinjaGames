// Kısa kod: uzun JP1 kodu (imzalı bağlantı teklifi + anahtarlar, ~1000 karakter) yerine karşı tarafa
// 12 karakterlik bir kod gönderilir (ör. 7KQ4-M9TX-2HFA). Uzun kod AES-GCM ile şifrelenip herkese açık
// Nostr rölelerine, kodun geçerlilik süresi kadar bırakılır. Şifreleme anahtarı da rölede aranan etiket de
// yalnızca kısa koddan türetilir (60 bit): kodu bilmeyen kaydı bulamaz, okuyamaz, değiştiremez (GCM).
// Bağlantının kendisi yine uzun koddaki imzalı anahtarlarla uçtan uca şifrelenir; uygulamalarla uyum için
// uzun kod her zaman kullanılabilir (hiçbir sunucuya uğramayan yol).
import { schnorr, bytesToHex } from './vendor/nostr-sign.js';

export const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nostr.mom', 'wss://offchain.pub'];
const KIND = 30078;
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: I, L, O, U yok
const LEN = 12;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Kullanıcının yazdığını kısa koda çevirir (boşluk, tire, küçük harf, O/0 ve I/L/1 karışıklığı). Değilse "". */
export function normalizeShort(text) {
  const s = String(text ?? '').toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return new RegExp(`^[${ALPHA}]{${LEN}}$`).test(s) ? s : '';
}
/** Metnin içinden (bağlantı dahil) kısa kodu bulur. */
export function findShort(text) {
  const t = String(text ?? '');
  if (/JP1[IA]-/.test(t)) return '';
  const hash = t.match(/#([0-9A-Za-z]{4}-?[0-9A-Za-z]{4}-?[0-9A-Za-z]{4})\b/);
  if (hash) return normalizeShort(hash[1]);
  return normalizeShort(t.trim());
}
export const prettyShort = (c) => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;

function newShort() {
  const r = crypto.getRandomValues(new Uint8Array(LEN));
  return Array.from(r, (b) => ALPHA[b & 31]).join('');
}
async function derive(kind, code) {
  const base = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`JinjaPeer kisa kod v1|${kind}|${code}`)));
  const tagBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode('etiket|'), ...base])));
  const key = await crypto.subtle.importKey('raw', base, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { key, tag: 'jinjapeer:' + bytesToHex(tagBytes).slice(0, 40) };
}
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

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

/**
 * Uzun kodu şifreleyip rölelere bırakır ve kısa kodu döndürür. kind: 'i' (davet) | 'a' (yanıt).
 * Hiçbir röle kabul etmezse hata fırlatır (arayan uzun koda döner).
 */
export async function publishShort(kind, longCode, expiresAt) {
  const code = newShort();
  const { key, tag } = await derive(kind, code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(longCode)));
  const sk = schnorr.utils.randomPrivateKey(); // her kayıt için tek kullanımlık, kimliğe bağlanmayan anahtar
  const exp = Math.floor(expiresAt / 1000);
  const e = { pubkey: bytesToHex(schnorr.getPublicKey(sk)), created_at: Math.floor(Date.now() / 1000), kind: KIND, tags: [['d', tag], ['expiration', String(exp)]], content: b64(new Uint8Array([...iv, ...ct])) };
  const idBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
  e.id = bytesToHex(idBytes);
  e.sig = bytesToHex(schnorr.sign(e.id, sk));
  const ok = await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(['EVENT', e])),
    (x) => (x[0] === 'OK' && x[1] === e.id ? !!x[2] : undefined), 7000)));
  if (!ok.some(Boolean)) throw new Error('relay');
  return code;
}

/** Kısa koda ait uzun kodu rölelerden bulup çözer; bulunamazsa null. */
export async function fetchShort(kind, code, ms = 6000) {
  const { key, tag } = await derive(kind, code);
  const sub = 'jp' + Math.random().toString(36).slice(2, 8);
  const found = [];
  await Promise.all(RELAYS.map((url) => relayCall(url,
    (ws) => ws.send(JSON.stringify(['REQ', sub, { kinds: [KIND], '#d': [tag], limit: 3 }])),
    (x) => {
      if ((x[0] === 'EOSE' || x[0] === 'CLOSED') && x[1] === sub) return true;
      if (x[0] === 'EVENT' && x[1] === sub && typeof x[2]?.content === 'string' && x[2].content.length < 20000) found.push(x[2].content);
      return undefined;
    }, ms)));
  for (const c of found) {
    try {
      const raw = unb64(c);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
      const long = dec.decode(pt);
      if (/^JP1[IA]-[A-Za-z0-9_-]+$/.test(long)) return long;
    } catch { /* başka bir koda ait ya da bozuk */ }
  }
  return null;
}
