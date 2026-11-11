/* JinjaPeer web: protocol v1 core (no DOM). Same wire format as the Flutter app
   (lib/core/codes.dart, crypto.dart, secure_channel.dart, sanitize.dart).
   All primitives come from the vendored @noble libraries; nothing is hand-rolled. */
import { ed25519, x25519, chacha20poly1305, sha256, hkdf, pbkdf2 } from './vendor/noble.bundle.js';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export const INVITE_PREFIX = 'JP1I-';
export const ANSWER_PREFIX = 'JP1A-';
export const MAX_ENCODED = 24 * 1024;
export const MAX_DECODED = 96 * 1024;
export const MAX_FRAME = 160 * 1024;
export const CHUNK_SIZE = 128 * 1024;
export const TYPE_CONTROL = 0x01;
export const TYPE_CHUNK = 0x02;
export const CHUNK_HEADER = 1 + 16 + 8;
export const PBKDF2_ITERATIONS = 200000;
const MAX_OPEN_HASHES = 256;

/* ---------- errors (keys are translated by the UI) ---------- */
export class CodeError extends Error {
  constructor(key, message) { super(message || key); this.key = key; this.name = 'CodeError'; }
}
export class FrameError extends Error {
  constructor(message) { super(message); this.name = 'FrameError'; }
}

/* ---------- bytes helpers ---------- */
export function randomBytes(n) {
  const b = new Uint8Array(n);
  for (let o = 0; o < n; o += 65536) crypto.getRandomValues(b.subarray(o, Math.min(n, o + 65536)));
  return b;
}
export function concat(...arrs) {
  let len = 0; for (const a of arrs) len += a.length;
  const out = new Uint8Array(len); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
export function hex(bytes) {
  let s = ''; for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
export function unhex(s) {
  if (s.length % 2) throw new Error('bad hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const v = parseInt(s.substr(i * 2, 2), 16);
    if (Number.isNaN(v)) throw new Error('bad hex');
    out[i] = v;
  }
  return out;
}
export function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
export function b64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad base64url');
  const pad = (4 - (s.length % 4)) % 4;
  if (pad === 3) throw new Error('bad base64url');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const sha256Bytes = (data) => sha256(data);

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function base32(bytes, chars) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5 && out.length < chars) {
      out += CROCKFORD[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
    if (out.length >= chars) break;
  }
  return out;
}
export function groupString(s, size, sep = ' ') {
  const parts = [];
  for (let i = 0; i < s.length; i += size) parts.push(s.substring(i, Math.min(i + size, s.length)));
  return parts.join(sep);
}

/* ---------- identity ---------- */
export function fingerprintOf(pub) { return groupString(base32(sha256(pub), 16), 4); }

export function newIdentity(seed = randomBytes(32)) {
  const publicKey = ed25519.getPublicKey(seed);
  return { seed, publicKey, publicKeyB64: b64(publicKey), fingerprint: fingerprintOf(publicKey) };
}
export function sign(identity, message) { return ed25519.sign(message, identity.seed); }
export function verifySignature(message, sig, pub) {
  try { return ed25519.verify(sig, message, pub); } catch { return false; }
}

/* ---------- ephemeral X25519 ---------- */
export function newEphemeral(priv = randomBytes(32)) {
  return { priv, publicKey: x25519.getPublicKey(priv) };
}
export function agree(eph, remotePublic) {
  if (!remotePublic || remotePublic.length !== 32) throw new CodeError('invalid', 'Invalid key length');
  let secret;
  try { secret = x25519.getSharedSecret(eph.priv, remotePublic); } catch { throw new CodeError('weakKey', 'Unsafe key rejected'); }
  let nz = 0; for (const b of secret) nz |= b;
  if (nz === 0) throw new CodeError('weakKey', 'Unsafe key rejected');
  return secret;
}

/* ---------- gzip (bounded) ---------- */
async function pump(stream, input, limit) {
  const writer = stream.writable.getWriter();
  const writing = writer.write(input).then(() => writer.close()).catch(() => {});
  const reader = stream.readable.getReader();
  const parts = []; let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (limit && total > limit) { try { await reader.cancel(); } catch {} throw new CodeError('tooBig'); }
      parts.push(value);
    }
  } finally { await writing; }
  return concat(...parts);
}
export const gzip = (bytes) => pump(new CompressionStream('gzip'), bytes, 0);
export const gunzipBounded = (bytes, limit = MAX_DECODED) => pump(new DecompressionStream('gzip'), bytes, limit);

/* ---------- sanitizing (mirror of lib/core/sanitize.dart) ---------- */
export const MAX_NAME = 160;
export const MAX_DEPTH = 24;
const RESERVED = new Set(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']);
function extOf(name) { const i = name.lastIndexOf('.'); return i <= 0 ? '' : name.substring(i); }

export function sanitizeFileName(input, fallback = 'dosya') {
  let name = String(input)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();
  name = name.replace(/[. ]+$/, '');
  if (name === '' || name === '.' || name === '..') name = fallback;
  const stem = name.split('.')[0].toUpperCase();
  if (RESERVED.has(stem)) name = '_' + name;
  if (name.length > MAX_NAME) {
    const ext = extOf(name);
    const keep = ext.length <= 16 ? ext : '';
    name = name.substring(0, MAX_NAME - keep.length) + keep;
  }
  return name;
}
export function sanitizeRelativeDir(rel) {
  if (typeof rel !== 'string' || rel === '') return [];
  return rel.split(/[\\/]+/)
    .filter((s) => s !== '' && s !== '.' && s !== '..' && !s.includes(':'))
    .map((s) => sanitizeFileName(s, 'klasor'))
    .slice(0, MAX_DEPTH);
}
export function sanitizeDisplayName(input, fallback = 'İsimsiz') {
  const s = String(input ?? '')
    .replace(/[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩]/g, '')
    .trim();
  if (s === '') return fallback;
  return s.length > 40 ? s.substring(0, 40) : s;
}
const DANGEROUS = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'hta', 'lnk', 'reg', 'cpl', 'msc', 'jar', 'dll', 'sys', 'apk', 'appx', 'msix', 'dmg', 'pkg', 'app', 'sh', 'command', 'run',
  'deb', 'rpm', 'iso', 'img', 'vhd', 'vhdx', 'docm', 'xlsm', 'pptm', 'chm']);
export function isRiskyFile(name) { return DANGEROUS.has(extOf(name).replace(/^\./, '').toLowerCase()); }

/* ---------- connection codes ---------- */
export function normalizeCode(text) { return String(text ?? '').replace(/\s+/g, '').replace(/"/g, '').replace(/`/g, ''); }

export function sniffKind(text) {
  const t = normalizeCode(text);
  if (t.startsWith(INVITE_PREFIX)) return 'invite';
  if (t.startsWith(ANSWER_PREFIX)) return 'answer';
  return null;
}

/** Extracts a code from pasted text or a share link (https://…/peer/#JP1I-…). */
export function extractCode(text) {
  const t = String(text ?? '');
  const m = t.match(/JP1[IA]-[A-Za-z0-9_\-\s"`]+/);
  return m ? normalizeCode(m[0]) : normalizeCode(t);
}

export async function createCode({ kind, identity, sessionId, sdp, ephemeralPublic, name, validitySeconds, passwordRequired = false, nowMs = Date.now() }) {
  const exp = Math.floor(nowMs / 1000) + Math.floor(validitySeconds);
  // Field order and compact separators match Dart's jsonEncode of the same map.
  const body = JSON.stringify({
    app: 'JinjaPeer', v: 1, k: kind === 'invite' ? 'i' : 'a', sid: b64(sessionId), sdp,
    ek: b64(ephemeralPublic), ik: identity.publicKeyB64, n: name, exp, pw: !!passwordRequired,
  });
  const sig = sign(identity, enc.encode(body));
  const wrapped = enc.encode(JSON.stringify({ b: body, s: b64(sig) }));
  const gz = await gzip(wrapped);
  const encoded = (kind === 'invite' ? INVITE_PREFIX : ANSWER_PREFIX) + b64(gz);
  return {
    kind, sessionId, sdp, ephemeralKey: ephemeralPublic, identityKey: identity.publicKey, name,
    expiresAt: exp * 1000, passwordRequired: !!passwordRequired, body, encoded,
  };
}

export async function parseCode(text, { expect = null, nowMs = Date.now() } = {}) {
  const t = normalizeCode(text);
  if (!t) throw new CodeError('empty');
  let kind;
  if (t.startsWith(INVITE_PREFIX)) kind = 'invite';
  else if (t.startsWith(ANSWER_PREFIX)) kind = 'answer';
  else throw new CodeError('notJp');
  if (expect && kind !== expect) throw new CodeError(expect === 'invite' ? 'expectInvite' : 'expectAnswer');
  if (t.length > MAX_ENCODED) throw new CodeError('tooLong');

  let wrapper, map, body;
  try {
    const gz = unb64(t.substring(5));
    const raw = await gunzipBounded(gz);
    wrapper = JSON.parse(dec.decode(raw));
    body = wrapper.b;
    if (typeof body !== 'string') throw new Error('no body');
    map = JSON.parse(body);
    if (map === null || typeof map !== 'object' || Array.isArray(map)) throw new Error('bad body');
  } catch (e) {
    if (e instanceof CodeError) throw e;
    throw new CodeError('corrupt');
  }
  if (map.app !== 'JinjaPeer' || map.v !== 1) throw new CodeError('version');
  if ((map.k === 'i') !== (kind === 'invite')) throw new CodeError('kindMismatch');

  let sid, ek, ik, sig;
  try {
    sid = unb64(map.sid); ek = unb64(map.ek); ik = unb64(map.ik); sig = unb64(wrapper.s);
    if (typeof map.sdp !== 'string') throw new Error('sdp');
    if (sid.length !== 16 || ek.length !== 32 || ik.length !== 32 || sig.length !== 64) throw new Error('len');
    if (map.sdp.length > 60000 || !map.sdp.startsWith('v=0')) throw new Error('sdp');
    if (!Number.isInteger(map.exp)) throw new Error('exp');
  } catch { throw new CodeError('invalid'); }
  if (!verifySignature(enc.encode(body), sig, ik)) throw new CodeError('badSig');
  const expMs = map.exp * 1000;
  if (nowMs > expMs) throw new CodeError('expired');
  if (expMs - nowMs > 25 * 3600 * 1000) throw new CodeError('expiryInvalid');
  return {
    kind, sessionId: sid, sdp: map.sdp, ephemeralKey: ek, identityKey: ik,
    name: sanitizeDisplayName(typeof map.n === 'string' ? map.n : null),
    expiresAt: expMs, passwordRequired: map.pw === true, body, encoded: t,
  };
}

/* ---------- session keys ---------- */
export async function passwordKey(password, salt) {
  const pw = enc.encode(password);
  if (globalThis.crypto && crypto.subtle) {
    try {
      const k = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, k, 256);
      return new Uint8Array(bits);
    } catch { /* fall through to noble */ }
  }
  return pbkdf2(sha256, pw, salt, { c: PBKDF2_ITERATIONS, dkLen: 32 });
}

export async function deriveSessionKeys({ eph, peerEphemeral, offerBody, answerBody, sessionId, isOfferer, password }) {
  const dh = agree(eph, peerEphemeral);
  const transcript = sha256(concat(enc.encode('JinjaPeer/1 transcript'), enc.encode(offerBody), new Uint8Array([0]), enc.encode(answerBody)));
  const pw = password ? await passwordKey(password, sessionId) : new Uint8Array(0);
  const okm = hkdf(sha256, concat(dh, pw), transcript, enc.encode('JinjaPeer/1 session keys'), 64);
  const o2a = okm.slice(0, 32), a2o = okm.slice(32, 64);
  const sasBytes = hkdf(sha256, dh, transcript, enc.encode('JinjaPeer/1 verification'), 10);
  const sas = base32(sasBytes, 12);
  return {
    sendKey: isOfferer ? o2a : a2o,
    receiveKey: isOfferer ? a2o : o2a,
    verificationCode: `${sas.substring(0, 4)}-${sas.substring(4, 8)}-${sas.substring(8)}`,
  };
}

/* ---------- secure channel (frames) ---------- */
function nonceFor(counter) {
  const n = new Uint8Array(12);
  const dv = new DataView(n.buffer);
  dv.setUint32(4, Math.floor(counter / 4294967296));
  dv.setUint32(8, counter >>> 0);
  return n;
}

export class SecureChannel {
  constructor(sendKey, receiveKey) {
    this.sendKey = sendKey; this.receiveKey = receiveKey;
    this.sendCounter = 0; this.recvCounter = 0;
    this.poisoned = false;
    this.hashes = new Map();
  }
  _hashChunk(plain) {
    if (plain.length < CHUNK_HEADER || plain[0] !== TYPE_CHUNK) return;
    const fid = hex(plain.subarray(1, 17));
    let h = this.hashes.get(fid);
    if (!h) {
      // Files are sent one after another, so only a handful of hashers are ever open. A peer that
      // invents file ids to make us keep a hasher for each one is cut off instead of eating memory.
      if (this.hashes.size >= MAX_OPEN_HASHES) { this.poisoned = true; throw new FrameError('too many open files'); }
      h = sha256.create(); this.hashes.set(fid, h);
    }
    h.update(plain.subarray(CHUNK_HEADER));
  }
  seal(plain) {
    this._hashChunk(plain);
    const counter = this.sendCounter++;
    const box = chacha20poly1305(this.sendKey, nonceFor(counter)).encrypt(plain);
    const out = new Uint8Array(8 + box.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, Math.floor(counter / 4294967296));
    dv.setUint32(4, counter >>> 0);
    out.set(box, 8);
    return out;
  }
  open(frame) {
    if (this.poisoned) throw new FrameError('channel poisoned');
    if (frame.length > MAX_FRAME) { this.poisoned = true; throw new FrameError('oversized frame'); }
    if (frame.length < 8 + 1 + 16) { this.poisoned = true; throw new FrameError('invalid frame'); }
    const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    const counter = hi * 4294967296 + lo;
    if (hi > 0x1fffff || counter !== this.recvCounter) { this.poisoned = true; throw new FrameError('out of order or replayed frame'); }
    let plain;
    try { plain = chacha20poly1305(this.receiveKey, nonceFor(counter)).decrypt(frame.subarray(8)); }
    catch { this.poisoned = true; throw new FrameError('authentication failed'); }
    this.recvCounter++;
    this._hashChunk(plain);
    return plain;
  }
  takeFileHash(idHex) {
    const h = this.hashes.get(idHex);
    this.hashes.delete(idHex);
    return hex(h ? h.digest() : sha256(new Uint8Array(0)));
  }
  dropFileHash(idHex) { this.hashes.delete(idHex); }
}

export function controlFrame(msg) {
  const body = enc.encode(JSON.stringify(msg));
  const plain = new Uint8Array(body.length + 1);
  plain[0] = TYPE_CONTROL; plain.set(body, 1);
  return plain;
}
export function chunkFrame(fileId16, offset, data) {
  const plain = new Uint8Array(CHUNK_HEADER + data.length);
  plain[0] = TYPE_CHUNK; plain.set(fileId16, 1);
  const dv = new DataView(plain.buffer);
  dv.setUint32(17, Math.floor(offset / 4294967296));
  dv.setUint32(21, offset >>> 0);
  plain.set(data, CHUNK_HEADER);
  return plain;
}
/** Parses a decrypted plaintext frame: {type:'control',msg} | {type:'chunk',fid,offset,data} | null */
export function parsePlain(plain) {
  if (plain.length === 0) return null;
  if (plain[0] === TYPE_CONTROL) {
    if (plain.length > 2 * 1024 * 1024) return null;
    try {
      const msg = JSON.parse(dec.decode(plain.subarray(1)));
      return msg && typeof msg === 'object' && !Array.isArray(msg) ? { type: 'control', msg } : null;
    } catch { return null; }
  }
  if (plain[0] === TYPE_CHUNK && plain.length >= CHUNK_HEADER) {
    const dv = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
    const offset = dv.getUint32(17) * 4294967296 + dv.getUint32(21);
    return { type: 'chunk', fid: hex(plain.subarray(1, 17)), offset, data: plain.subarray(CHUNK_HEADER) };
  }
  return null;
}

/* ---------- SDP compaction (same as the app) ---------- */
export function compactSdp(sdp) {
  const lines = sdp.split(/\r?\n/).filter((l) => {
    if (!l) return false;
    if (l.startsWith('a=extmap')) return false;
    if (l.startsWith('a=candidate') && l.includes(' tcp ')) return false;
    return true;
  });
  return lines.join('\r\n') + '\r\n';
}

/* ---------- formatting ---------- */
export function formatBytes(bytes, lang = 'tr') {
  if (bytes < 1024) return `${Math.trunc(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  const s = v.toFixed(v >= 100 ? 0 : 1);
  return `${lang === 'tr' ? s.replace('.', ',') : s} ${units[i]}`;
}
export function formatDuration(sec, lang = 'tr') {
  sec = Math.round(sec);
  const sn = lang === 'tr' ? 'sn' : 's', dk = lang === 'tr' ? 'dk' : 'm', sa = lang === 'tr' ? 'sa' : 'h';
  if (!isFinite(sec) || sec < 0) return '-';
  if (sec < 1) return `<1 ${sn}`;
  if (sec < 60) return `${sec} ${sn}`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} ${dk} ${sec % 60} ${sn}`;
  return `${Math.floor(m / 60)} ${sa} ${m % 60} ${dk}`;
}
