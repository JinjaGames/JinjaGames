/* JinjaPeer web: file transfer protocol on top of an encrypted PeerSession.
   Mirrors lib/services/transfer_service.dart (offer/accept/reject/fend/fdone/cancel/pause/resume). */
import * as C from './core.js';
import { yieldMacro } from './session.js';

export const MAX_ITEMS = 10000;
export const MAX_PENDING = 5;
const READ_BLOCK = 1024 * 1024;
const FINAL = new Set(['done', 'failed', 'canceled']);
export const isFinal = (s) => FINAL.has(s);

/* ---------- CRC32 + store-only ZIP (for "download all" without File System Access) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32Update(crc, data) {
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
export function makeZip(entries /* [{path, blob, size, crc}] */) {
  const enc = new TextEncoder();
  const parts = []; const central = []; let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const e of entries) {
    const name = enc.encode(e.path);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, e.crc, true);
    lh.setUint32(18, e.size, true); lh.setUint32(22, e.size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, e.blob);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, e.crc, true);
    ch.setUint32(20, e.size, true); ch.setUint32(24, e.size, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + e.size;
  }
  let csize = 0; for (const c of central) csize += c.byteLength;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

/* ---------- sinks ---------- */
class MemorySink {
  constructor() { this.parts = []; this.crc = 0; this.size = 0; }
  async write(d) { this.parts.push(d); this.crc = crc32Update(this.crc, d); this.size += d.length; }
  async finish() { return { blob: new Blob(this.parts), crc: this.crc }; }
  async abort() { this.parts = []; }
}
class FsaSink {
  constructor(root, segs, name) { this.root = root; this.segs = segs; this.name = name; this.dir = null; this.w = null; this.fileName = null; }
  async open() {
    let dir = this.root;
    for (const s of this.segs) dir = await dir.getDirectoryHandle(s, { create: true });
    this.dir = dir;
    const dot = this.name.lastIndexOf('.');
    const stem = dot > 0 ? this.name.slice(0, dot) : this.name, ext = dot > 0 ? this.name.slice(dot) : '';
    let cand = this.name;
    for (let i = 1; i < 10000; i++) {
      const exists = await dir.getFileHandle(cand).then(() => true, () => dir.getDirectoryHandle(cand).then(() => true, () => false));
      if (!exists) break;
      cand = `${stem} (${i})${ext}`;
    }
    this.fileName = cand;
    const fh = await dir.getFileHandle(cand, { create: true });
    this.w = await fh.createWritable();
  }
  async write(d) { if (!this.w) await this.open(); await this.w.write(d); }
  async finish() { if (!this.w) await this.open(); await this.w.close(); this.w = null; return { savedAs: this.segs.concat(this.fileName).join('/') }; }
  async abort() {
    try { if (this.w) await this.w.abort(); } catch { /* ignore */ }
    this.w = null;
    try { if (this.dir && this.fileName) await this.dir.removeEntry(this.fileName); } catch { /* ignore */ }
  }
}

/* ---------- model ---------- */
export class FileTask {
  constructor({ fileId, batch, name, relDir, size, source }) {
    this.fileId = fileId; this.idHex = C.hex(fileId); this.batch = batch;
    this.name = name; this.relDir = relDir; this.size = size; this.source = source || null;
    this.status = 'queued'; this.transferred = 0; this.speed = 0; this._last = 0;
    this.startedAt = 0; this.finishedAt = 0; this.error = null; this.sha = null;
    this.sink = null; this.blob = null; this.crc = 0; this.savedAs = null;
  }
  get direction() { return this.batch.direction; }
  get risky() { return C.isRiskyFile(this.name); }
  get path() { return this.relDir ? `${this.relDir}/${this.name}` : this.name; }
}
export class TransferBatch {
  constructor({ reqId, session, direction, peerName }) {
    this.reqId = reqId; this.session = session; this.direction = direction; this.peerName = peerName;
    this.createdAt = Date.now(); this.tasks = []; this.status = 'pending'; // pending accepted rejected canceled done failed
    this.paused = false; this.pausedByPeer = false; this.reason = null; this.dest = null; this.startedAt = 0;
  }
  get totalSize() { return this.tasks.reduce((a, t) => a + t.size, 0); }
  get transferred() { return this.tasks.reduce((a, t) => a + (t.status === 'done' ? t.size : t.transferred), 0); }
  get speed() { return this.tasks.reduce((a, t) => a + (t.status === 'active' ? t.speed : 0), 0); }
  get doneCount() { return this.tasks.filter((t) => t.status === 'done').length; }
  get isFinished() { return ['rejected', 'canceled', 'failed', 'done'].includes(this.status); }
}

export class TransferService {
  constructor({ onUpdate, onNotice }) {
    this.onUpdate = onUpdate || (() => {}); this.onNotice = onNotice || (() => {});
    this.batches = []; this.byId = new Map(); this.queues = new Map(); this.dirty = false;
    this.history = [];
    this._ticker = setInterval(() => this._tick(), 500);
  }
  attach(s) { s.oncontrol = (sess, m) => this._onControl(sess, m); s.onchunk = (sess, f, o, d) => this._onChunk(sess, f, o, d); }
  _mark() { this.dirty = true; }
  _tick() {
    let any = false;
    for (const b of this.batches) for (const t of b.tasks) {
      if (t.status === 'active') { const inst = (t.transferred - t._last) / 0.5; t.speed = t.speed === 0 ? inst : t.speed * 0.6 + inst * 0.4; any = true; }
      else if (t.status !== 'paused') t.speed = 0;
      t._last = t.transferred;
    }
    if (any || this.dirty) { this.dirty = false; this.onUpdate(); }
  }
  flush() { this.dirty = false; this.onUpdate(); }

  /* ---------- sending ---------- */
  async offer(s, sources) {
    if (!s.isLive) { this.onNotice('error', 'notConnected'); return null; }
    if (!sources.length) return null;
    if (sources.length > MAX_ITEMS) { this.onNotice('error', 'tooMany'); return null; }
    const b = new TransferBatch({ reqId: C.hex(C.randomBytes(8)), session: s, direction: 'send', peerName: s.peerName });
    for (const src of sources) {
      b.tasks.push(new FileTask({ fileId: C.randomBytes(16), batch: b, name: src.name, relDir: src.relDir || '', size: src.size, source: src }));
    }
    for (const t of b.tasks) this.byId.set(t.idHex, t);
    this.batches.unshift(b);
    try {
      await s.sendControl({
        t: 'offer', req: b.reqId, total: b.totalSize,
        items: b.tasks.map((t) => ({ id: t.idHex, name: t.name, dir: t.relDir, size: t.size })),
      });
    } catch (e) { this._failBatch(b, 'sendFailed'); }
    this.flush();
    return b;
  }

  _startSending(b) {
    const key = b.session.id;
    const prev = this.queues.get(key) || Promise.resolve();
    this.queues.set(key, prev.then(() => this._sendBatch(b)).catch(() => {}));
  }

  async _gate(b, t) {
    while (b.paused && !isFinal(t.status) && b.status === 'accepted') { t.status = 'paused'; await new Promise((r) => setTimeout(r, 200)); }
    if (t.status === 'paused') t.status = 'active';
    if (isFinal(t.status) || b.status !== 'accepted' || !b.session.isLive) throw new Abort();
  }

  async _sendBatch(b) {
    const s = b.session;
    b.startedAt = Date.now();
    for (const t of b.tasks) {
      if (b.status !== 'accepted') break;
      if (isFinal(t.status)) continue;
      t.status = 'active'; t.startedAt = Date.now(); this._mark();
      try {
        let offset = 0, n = 0;
        while (offset < t.size) {
          await this._gate(b, t);
          const end = Math.min(offset + READ_BLOCK, t.size);
          const buf = new Uint8Array(await t.source.file.slice(offset, end).arrayBuffer());
          if (buf.length !== end - offset) throw new Error('fileChanged');
          for (let pos = 0; pos < buf.length;) {
            await this._gate(b, t);
            const e = Math.min(pos + C.CHUNK_SIZE, buf.length);
            await s.sendChunk(t.fileId, offset + pos, buf.subarray(pos, e));
            t.transferred = offset + e;
            pos = e;
            if (++n % 8 === 0) await yieldMacro();
          }
          offset = end;
        }
        await this._gate(b, t);
        t.status = 'verifying'; t.sha = s.takeFileHash(t.idHex); this._mark();
        await s.sendControl({ t: 'fend', id: t.idHex, sha: t.sha });
        await this._waitFor(() => t.status !== 'verifying' || !s.isLive, 10 * 60 * 1000);
        if (t.status === 'verifying') this._finish(t, 'failed', 'noConfirm');
      } catch (e) {
        s.dropFileHash(t.idHex);
        if (e instanceof Abort) {
          if (!isFinal(t.status)) this._finish(t, 'canceled', 'canceledErr');
          if (s.isLive && b.status === 'accepted') s.sendControl({ t: 'cancel', req: b.reqId, id: t.idHex }).catch(() => {});
        } else {
          if (!isFinal(t.status)) this._finish(t, 'failed', e && e.message === 'fileChanged' ? 'fileChanged' : 'readFailed');
          if (s.isLive) s.sendControl({ t: 'cancel', req: b.reqId, id: t.idHex }).catch(() => {});
        }
      }
    }
    this._settle(b);
  }

  async _waitFor(cond, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  }

  /* ---------- control messages ---------- */
  async _onControl(s, m) {
    switch (m.t) {
      case 'offer': return this._onOffer(s, m);
      case 'accept': {
        const b = this._batch(s, m.req, 'send');
        if (b && b.status === 'pending') { b.status = 'accepted'; this.onNotice('ok', 'offerAccepted', { name: s.peerName }); this._startSending(b); this._mark(); }
        return undefined;
      }
      case 'reject': {
        const b = this._batch(s, m.req, 'send');
        if (b && b.status === 'pending') {
          b.status = 'rejected'; b.reason = reasonOf(m.reason);
          for (const t of b.tasks) this._finish(t, 'canceled', 'rejectedErr');
          this.onNotice('error', 'offerRejected', { name: s.peerName });
          this._mark();
        }
        return undefined;
      }
      case 'fend': return this._onFileEnd(s, m);
      case 'fdone': {
        const t = this._task(s, m.id, 'send');
        if (t && t.status === 'verifying') {
          if (m.ok === true) this._finish(t, 'done'); else this._finish(t, 'failed', reasonOf(m.reason));
          this._settle(t.batch);
        }
        return undefined;
      }
      case 'cancel': return this._onPeerCancel(s, m);
      case 'pause': case 'resume': {
        const b = this.batches.find((x) => x.session === s && x.reqId === m.req);
        if (b) {
          b.paused = m.t === 'pause'; b.pausedByPeer = b.paused;
          for (const t of b.tasks) if (b.direction === 'receive' && !isFinal(t.status) && t.transferred > 0) t.status = b.paused ? 'paused' : 'active';
          this._mark();
        }
        return undefined;
      }
      default: return undefined;
    }
  }

  async _onOffer(s, m) {
    const { req, items } = m;
    if (typeof req !== 'string' || req.length !== 16 || !Array.isArray(items)) return;
    const reject = (reason) => s.sendControl({ t: 'reject', req, reason }).catch(() => {});
    if (this.batches.some((b) => b.reqId === req && b.session === s)) return;
    const pending = this.batches.filter((b) => b.session === s && b.direction === 'receive' && b.status === 'pending').length;
    if (pending >= MAX_PENDING) return reject('busy');
    if (items.length === 0 || items.length > MAX_ITEMS) return reject('invalid');
    const b = new TransferBatch({ reqId: req, session: s, direction: 'receive', peerName: s.peerName });
    const seen = new Set();
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') return reject('invalid');
      const { id, name, size } = raw;
      if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id) || seen.has(id)) return reject('invalid');
      seen.add(id);
      if (typeof name !== 'string' || !Number.isInteger(size) || size < 0 || size > 2 ** 50) return reject('invalid');
      if (this.byId.has(id)) return reject('invalid');
      b.tasks.push(new FileTask({
        fileId: C.unhex(id), batch: b, name: C.sanitizeFileName(name),
        relDir: C.sanitizeRelativeDir(typeof raw.dir === 'string' ? raw.dir : null).join('/'), size,
      }));
    }
    for (const t of b.tasks) this.byId.set(t.idHex, t);
    this.batches.unshift(b);
    this.onNotice('info', 'newOffer', { name: s.peerName });
    this.flush();
  }

  /** dest: {mode:'fsa', handle, label} | {mode:'memory'} */
  async accept(b, dest) {
    if (b.status !== 'pending' || b.direction !== 'receive') return;
    if (!b.session.isLive) { b.status = 'failed'; b.reason = 'r_closed'; this._mark(); return; }
    b.dest = dest; b.status = 'accepted'; this._mark();
    await b.session.sendControl({ t: 'accept', req: b.reqId });
  }
  async reject(b) {
    if (b.status !== 'pending') return;
    b.status = 'rejected';
    for (const t of b.tasks) this._finish(t, 'canceled', 'youRejected');
    this._mark();
    if (b.session.isLive) await b.session.sendControl({ t: 'reject', req: b.reqId, reason: 'user' }).catch(() => {});
  }

  _newSink(t) {
    const d = t.batch.dest;
    if (d.mode === 'fsa') return new FsaSink(d.handle, C.sanitizeRelativeDir(t.relDir), t.name);
    return new MemorySink();
  }

  async _onChunk(s, fid, offset, data) {
    const t = this.byId.get(fid);
    if (!t || t.batch.session !== s || t.direction !== 'receive') return;
    const b = t.batch;
    if (b.status !== 'accepted' || isFinal(t.status)) return;
    if (offset !== t.transferred || t.transferred + data.length > t.size) return this._failReceive(t, 'invalid', 'badOrder');
    try {
      if (!t.sink) { t.sink = this._newSink(t); t.status = 'active'; t.startedAt = Date.now(); this._mark(); }
      if (t.status === 'queued') t.status = 'active';
      const sink = t.sink;
      await sink.write(data);
      if (isFinal(t.status)) return;
      t.transferred += data.length;
    } catch (e) { await this._failReceive(t, 'write', 'writeFailed'); }
  }

  async _onFileEnd(s, m) {
    const t = this._task(s, m.id, 'receive');
    if (!t || isFinal(t.status)) return;
    const b = t.batch;
    if (b.status !== 'accepted') return;
    if (t.transferred !== t.size) return this._failReceive(t, 'invalid', 'incomplete');
    t.status = 'verifying'; this._mark();
    try {
      if (!t.sink) t.sink = this._newSink(t); // zero byte files never produced a chunk
      const actual = s.takeFileHash(t.idHex);
      if (typeof m.sha !== 'string' || actual !== m.sha) return this._failReceive(t, 'hash', 'hashFail', true);
      t.sha = actual;
      const res = await t.sink.finish();
      if (res.blob) { t.blob = res.blob; t.crc = res.crc; }
      if (res.savedAs) t.savedAs = res.savedAs;
      t.sink = null;
      this._finish(t, 'done');
      await s.sendControl({ t: 'fdone', id: t.idHex, ok: true }).catch(() => {});
    } catch (e) { await this._failReceive(t, 'write', 'writeFailed'); }
    this._settle(b);
  }

  async _failReceive(t, code, errKey, hashDone) {
    await this._discard(t);
    if (!hashDone) t.batch.session.dropFileHash(t.idHex);
    this._finish(t, 'failed', errKey);
    if (t.batch.session.isLive) await t.batch.session.sendControl({ t: 'fdone', id: t.idHex, ok: false, reason: code }).catch(() => {});
    this._settle(t.batch);
  }
  async _discard(t) { const sk = t.sink; t.sink = null; if (sk) { try { await sk.abort(); } catch { /* ignore */ } } }

  _onPeerCancel(s, m) {
    const b = this.batches.find((x) => x.session === s && x.reqId === m.req);
    if (!b) return;
    const targets = typeof m.id === 'string' ? b.tasks.filter((t) => t.idHex === m.id) : b.tasks;
    for (const t of targets) {
      if (isFinal(t.status)) continue;
      if (b.direction === 'receive') { this._discard(t); s.dropFileHash(t.idHex); }
      this._finish(t, 'canceled', 'peerCanceled');
    }
    if (typeof m.id !== 'string' && !b.isFinished) { b.status = 'canceled'; b.reason = 'peerCanceled'; }
    this._settle(b);
  }

  /* ---------- user actions ---------- */
  async cancelTask(t) {
    if (isFinal(t.status)) return;
    const b = t.batch;
    if (b.direction === 'receive') { await this._discard(t); b.session.dropFileHash(t.idHex); }
    this._finish(t, 'canceled', 'youCanceled');
    if (b.session.isLive) await b.session.sendControl({ t: 'cancel', req: b.reqId, id: t.idHex }).catch(() => {});
    this._settle(b);
  }
  async cancelBatch(b) {
    if (b.isFinished) return;
    if (b.status === 'pending' && b.direction === 'receive') return this.reject(b);
    b.status = 'canceled'; b.reason = 'youCanceled';
    for (const t of b.tasks) {
      if (isFinal(t.status)) continue;
      if (b.direction === 'receive') { await this._discard(t); b.session.dropFileHash(t.idHex); }
      this._finish(t, 'canceled', 'youCanceled');
    }
    this._mark();
    if (b.session.isLive) await b.session.sendControl({ t: 'cancel', req: b.reqId }).catch(() => {});
  }
  async setPaused(b, paused) {
    if (b.status !== 'accepted') return;
    b.paused = paused; b.pausedByPeer = false;
    for (const t of b.tasks) if (t.status === 'active' || t.status === 'paused') t.status = paused ? 'paused' : 'active';
    this._mark();
    await b.session.sendControl({ t: paused ? 'pause' : 'resume', req: b.reqId }).catch(() => {});
  }
  clearFinished() {
    this.batches = this.batches.filter((b) => {
      const done = b.isFinished || b.tasks.every((t) => isFinal(t.status));
      if (done) for (const t of b.tasks) this.byId.delete(t.idHex);
      return !done;
    });
    this.flush();
  }
  sessionEnded(s) {
    for (const b of this.batches.filter((x) => x.session === s)) {
      if (b.isFinished) continue;
      const wasPending = b.status === 'pending';
      for (const t of b.tasks) {
        if (isFinal(t.status)) continue;
        if (b.direction === 'receive') this._discard(t);
        this._finish(t, wasPending ? 'canceled' : 'failed', 'connLost');
      }
      b.status = 'failed'; b.reason = 'connLost';
    }
    this.queues.delete(s.id);
    this.flush();
  }

  /* ---------- helpers ---------- */
  _batch(s, req, dir) { return this.batches.find((b) => b.session === s && b.reqId === req && b.direction === dir); }
  _task(s, id, dir) {
    if (typeof id !== 'string') return null;
    const t = this.byId.get(id);
    return t && t.batch.session === s && t.direction === dir ? t : null;
  }
  _finish(t, status, error) {
    if (isFinal(t.status)) return;
    t.status = status; t.error = error || null; t.finishedAt = Date.now(); t.speed = 0;
    this.history.unshift({ name: t.path, size: t.size, direction: t.direction, status, peer: t.batch.peerName, at: t.finishedAt, error: t.error, sha: t.sha });
    if (this.history.length > 200) this.history.pop();
    this._mark();
  }
  _failBatch(b, reasonKey) {
    b.status = 'failed'; b.reason = reasonKey;
    for (const t of b.tasks) this._finish(t, 'failed', reasonKey);
    this.onNotice('error', reasonKey);
  }
  _settle(b) {
    if (b.status === 'accepted' && b.tasks.every((t) => isFinal(t.status))) {
      const ok = b.doneCount;
      b.status = ok === 0 ? 'failed' : 'done';
      if (ok === b.tasks.length) this.onNotice('ok', b.direction === 'send' ? 'sendDone' : 'recvDone', { name: b.peerName });
      else b.reason = 'someFailed';
    }
    this._mark();
  }
  dispose() { clearInterval(this._ticker); }
}

class Abort extends Error {}
export function reasonOf(r) {
  return ['user', 'busy', 'size', 'invalid', 'hash', 'write', 'closed'].includes(r) ? 'r_' + r : 'r_unknown';
}
