/* JinjaPeer web: one direct WebRTC connection + the encrypted channel on top.
   Mirrors lib/services/peer_session.dart. Errors are reported as {key, params}
   so the UI can translate them. */
import * as C from './core.js';

export const S = {
  PREPARING: 'preparing', WAITING_ANSWER: 'waitingAnswer', WAITING_PEER: 'waitingPeer',
  CONNECTING: 'connecting', SECURING: 'securing', CONNECTED: 'connected', FAILED: 'failed', CLOSED: 'closed',
};
const ORDER = [S.PREPARING, S.WAITING_ANSWER, S.WAITING_PEER, S.CONNECTING, S.SECURING, S.CONNECTED];
const LABEL = 'jinjapeer';
const HIGH_WATER = 8 * 1024 * 1024;
const LOW_WATER = 2 * 1024 * 1024;
const GATHER_MS = 6000;

export const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'];

export function buildIceServers(turn) {
  const list = DEFAULT_STUN.map((urls) => ({ urls }));
  if (turn && turn.url && turn.url.trim()) {
    list.push({ urls: turn.url.trim(), username: turn.user || '', credential: turn.pass || '' });
  }
  return list;
}

const yieldMacro = () => new Promise((res) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => { ch.port1.close(); res(); };
  ch.port2.postMessage(0);
});
export { yieldMacro };

export class PeerSession {
  constructor({ role, identity, myName, iceServers, password }) {
    this.id = C.hex(C.randomBytes(8));
    this.role = role; // 'inviter' | 'joiner'
    this.identity = identity;
    this.myName = myName;
    this.iceServers = iceServers;
    this.password = password || '';
    this.state = S.PREPARING;
    this.error = null;
    this.myCode = null; this.peerCode = null;
    this.peerName = ''; this.peerFingerprint = ''; this.verificationCode = '';
    this.route = null; this.rttMs = null; this.connectedAt = null;
    this.bytesIn = 0; this.bytesOut = 0;
    this.onchange = null; this.oncontrol = null; this.onchunk = null; this.onended = null; this.onconnected = null;
    this.pc = null; this.dc = null; this.channel = null; this.eph = null; this.sessionId = null;
    this._helloSent = false; this._helloReceived = false;
    this._recvTail = Promise.resolve();
    this._ping = null; this._hsTimer = null; this._lastPong = 0;
  }

  get isLive() { return this.state === S.CONNECTED; }
  get isOver() { return this.state === S.FAILED || this.state === S.CLOSED; }

  _set(state, err) {
    if (this.isOver) return;
    this.state = state;
    if (err) this.error = err;
    this.onchange && this.onchange(this);
    if (this.isOver) { this._teardown(); this.onended && this.onended(this); }
  }
  _fail(key, params) { this._set(S.FAILED, { key, params }); }

  /* ---- creation ---- */
  static async createInvite(opts, validitySeconds) {
    const s = new PeerSession({ ...opts, role: 'inviter' });
    try {
      s.sessionId = C.randomBytes(16);
      s.eph = C.newEphemeral();
      s._createPc();
      s._attachChannel(s.pc.createDataChannel(LABEL, { ordered: true }));
      await s.pc.setLocalDescription(await s.pc.createOffer());
      const sdp = await s._gathered();
      s.myCode = await C.createCode({
        kind: 'invite', identity: s.identity, sessionId: s.sessionId, sdp, ephemeralPublic: s.eph.publicKey,
        name: s.myName, validitySeconds, passwordRequired: !!s.password,
      });
      s._set(S.WAITING_ANSWER);
    } catch (e) { s._fail('createInvite', { detail: String(e && e.message || e) }); }
    return s;
  }

  static async acceptInvite(opts, invite) {
    const s = new PeerSession({ ...opts, role: 'joiner' });
    s.peerCode = invite; s.peerName = invite.name; s.peerFingerprint = C.fingerprintOf(invite.identityKey);
    try {
      if (C.b64(invite.identityKey) === s.identity.publicKeyB64) { s._fail('ownCode'); return s; }
      s.sessionId = invite.sessionId;
      s.eph = C.newEphemeral();
      s._createPc();
      s.pc.ondatachannel = (ev) => {
        if (ev.channel.label === LABEL && !s.dc) s._attachChannel(ev.channel); else ev.channel.close();
      };
      await s.pc.setRemoteDescription({ type: 'offer', sdp: invite.sdp });
      await s.pc.setLocalDescription(await s.pc.createAnswer());
      const sdp = await s._gathered();
      s.myCode = await C.createCode({
        kind: 'answer', identity: s.identity, sessionId: s.sessionId, sdp, ephemeralPublic: s.eph.publicKey,
        name: s.myName, validitySeconds: 600,
      });
      await s._deriveKeys();
      s._set(S.WAITING_PEER);
    } catch (e) {
      if (e instanceof C.CodeError) s._fail(e.key); else s._fail('prepare', { detail: String(e && e.message || e) });
    }
    return s;
  }

  async applyAnswer(answer) {
    if (this.role !== 'inviter' || this.state !== S.WAITING_ANSWER) throw new C.CodeError('notWaiting');
    if (this._applying) throw new C.CodeError('notWaiting'); // a second paste while the first is still being processed
    if (Date.now() > this.myCode.expiresAt) throw new C.CodeError('inviteExpired');
    if (!C.equalBytes(answer.sessionId, this.sessionId)) throw new C.CodeError('otherInvite');
    if (C.b64(answer.identityKey) === this.identity.publicKeyB64) throw new C.CodeError('ownAnswer');
    this._applying = true;
    try {
      this.peerCode = answer; this.peerName = answer.name; this.peerFingerprint = C.fingerprintOf(answer.identityKey);
      await this._deriveKeys();
    } finally { this._applying = false; }
    this._set(S.CONNECTING);
    try { await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp }); }
    catch (e) { this._fail('remoteDesc', { detail: String(e && e.message || e) }); return; }
    this._armHandshake();
  }

  /* ---- WebRTC ---- */
  _createPc() {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, iceCandidatePoolSize: 2 });
    this.pc = pc;
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connecting': if (this.state === S.WAITING_PEER) this._set(S.CONNECTING); break;
        case 'connected':
          if (ORDER.indexOf(this.state) < ORDER.indexOf(S.SECURING)) this._set(S.SECURING);
          this._detectRoute(); break;
        case 'failed': this._fail(this.state === S.CONNECTED ? 'lost' : 'noRoute'); break;
        case 'closed': this._set(S.CLOSED); break;
        default:
      }
    };
  }

  async _gathered() {
    const pc = this.pc;
    if (pc.iceGatheringState !== 'complete') {
      await new Promise((res) => {
        const t = setTimeout(done, GATHER_MS);
        function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); }
        function chk() { if (pc.iceGatheringState === 'complete') done(); }
        pc.addEventListener('icegatheringstatechange', chk);
      });
    }
    if (!pc.localDescription || !pc.localDescription.sdp) throw new Error('no local description');
    return C.compactSdp(pc.localDescription.sdp);
  }

  async _detectRoute() {
    try {
      const stats = await this.pc.getStats();
      const byId = new Map(); let pairId = null; const pairs = [];
      stats.forEach((r) => {
        byId.set(r.id, r);
        if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
        if (r.type === 'candidate-pair') pairs.push(r);
      });
      let pair = pairId ? byId.get(pairId) : pairs.find((p) => p.nominated && p.state === 'succeeded');
      if (pair) {
        const l = byId.get(pair.localCandidateId), r = byId.get(pair.remoteCandidateId);
        const lt = l && l.candidateType, rt = r && r.candidateType;
        if (lt === 'relay' || rt === 'relay') this.route = 'relay';
        else if (lt === 'host' && rt === 'host') this.route = 'lan';
        else if (lt) this.route = 'p2p';
      }
      this.onchange && this.onchange(this);
    } catch { /* optional */ }
  }

  _attachChannel(dc) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = LOW_WATER;
    dc.onopen = () => {
      if (ORDER.indexOf(this.state) < ORDER.indexOf(S.SECURING)) this._set(S.SECURING);
      this._sendHello();
    };
    dc.onclose = () => {
      if (this.state === S.CONNECTED) this._set(S.CLOSED, { key: 'peerClosed' });
      else if (!this.isOver) this._fail('channelClosed');
    };
    dc.onmessage = (ev) => {
      if (typeof ev.data === 'string') return; // only encrypted binary frames
      const data = new Uint8Array(ev.data);
      this.bytesIn += data.length;
      if (data.length > C.MAX_FRAME) { this._fail('oversize'); return; }
      if (!this.channel || this.isOver) return;
      this._recvTail = this._recvTail.then(() => this._handleFrame(data));
    };
    if (dc.readyState === 'open') dc.onopen();
  }

  async _deriveKeys() {
    const offer = this.role === 'inviter' ? this.myCode : this.peerCode;
    const answer = this.role === 'inviter' ? this.peerCode : this.myCode;
    const keys = await C.deriveSessionKeys({
      eph: this.eph, peerEphemeral: this.peerCode.ephemeralKey, offerBody: offer.body, answerBody: answer.body,
      sessionId: this.sessionId, isOfferer: this.role === 'inviter', password: this.password,
    });
    this.verificationCode = keys.verificationCode;
    this.channel = new C.SecureChannel(keys.sendKey, keys.receiveKey);
    this.password = '';
    this.eph = null; // forget the ephemeral secret
  }

  _armHandshake() {
    clearTimeout(this._hsTimer);
    this._hsTimer = setTimeout(() => {
      if (this.state !== S.CONNECTED && !this.isOver) this._fail('timeout');
    }, 45000);
  }

  /* ---- messaging ---- */
  _sendHello() {
    if (this._helloSent || !this.channel) return;
    this._helloSent = true;
    if (this.role === 'joiner') this._armHandshake();
    this.sendControl({ t: 'hello', v: 1, name: this.myName, app: 'JinjaPeer' }).catch(() => {});
  }

  async _handleFrame(data) {
    if (this.isOver) return;
    let plain;
    try { plain = this.channel.open(data); }
    catch (e) { this._fail(this._helloReceived ? 'tamper' : 'handshake', { detail: e.message }); return; }
    const p = C.parsePlain(plain);
    if (!p) return;
    if (p.type === 'control') await this._onControl(p.msg);
    else if (this._helloReceived) { try { await this.onchunk?.(this, p.fid, p.offset, p.data); } catch { /* handler reports */ } }
  }

  async _onControl(msg) {
    const t = msg.t;
    if (t === 'hello') {
      if (this._helloReceived) return;
      this._helloReceived = true;
      clearTimeout(this._hsTimer);
      this._sendHello();
      this.connectedAt = Date.now();
      this._set(S.CONNECTED);
      this._startPing();
      this.onconnected && this.onconnected(this);
      return;
    }
    if (!this._helloReceived) return;
    if (t === 'ping') this.sendControl({ t: 'pong', ts: msg.ts }).catch(() => {});
    else if (t === 'pong') {
      this._lastPong = Date.now();
      if (Number.isInteger(msg.ts)) { this.rttMs = Math.max(0, Date.now() - msg.ts); this.onchange && this.onchange(this); }
    } else if (t === 'bye') this._set(S.CLOSED, { key: 'peerBye' });
    else { try { await this.oncontrol?.(this, msg); } catch (e) { console.warn('control handler', e); } }
  }

  _startPing() {
    this._lastPong = Date.now();
    clearInterval(this._ping);
    this._ping = setInterval(() => {
      if (this.state !== S.CONNECTED) return;
      if (Date.now() - this._lastPong > 40000) { this._fail('pingTimeout'); return; }
      this.sendControl({ t: 'ping', ts: Date.now() }).catch(() => {});
    }, 5000);
  }

  _rawSend(frame) {
    const dc = this.dc;
    if (!dc || dc.readyState !== 'open' || this.isOver) throw new Error('not connected');
    dc.send(frame);
    this.bytesOut += frame.length;
  }

  async sendControl(msg) {
    if (!this.channel || this.isOver) throw new Error('not connected');
    this._rawSend(this.channel.seal(C.controlFrame(msg)));
  }

  /** Sends one file chunk with back-pressure on the data channel. */
  async sendChunk(fileId16, offset, data) {
    if (!this.channel || this.isOver) throw new Error('not connected');
    const dc = this.dc;
    if (dc.bufferedAmount > HIGH_WATER) {
      while (dc.bufferedAmount > LOW_WATER && dc.readyState === 'open' && !this.isOver) {
        await new Promise((res) => {
          const t = setTimeout(done, 250);
          function done() { clearTimeout(t); dc.removeEventListener('bufferedamountlow', done); res(); }
          dc.addEventListener('bufferedamountlow', done);
        });
      }
    }
    this._rawSend(this.channel.seal(C.chunkFrame(fileId16, offset, data)));
  }

  takeFileHash(idHex) { return this.channel ? this.channel.takeFileHash(idHex) : ''; }
  dropFileHash(idHex) { if (this.channel) this.channel.dropFileHash(idHex); }

  async close(reason) {
    if (this.isOver) return;
    if (this.state === S.CONNECTED) { try { await this.sendControl({ t: 'bye' }); } catch { /* ignore */ } }
    this._set(S.CLOSED, reason ? { key: reason } : null);
  }

  _teardown() {
    clearInterval(this._ping); clearTimeout(this._hsTimer);
    const dc = this.dc, pc = this.pc;
    this.dc = null; this.pc = null;
    // let a queued "bye" leave before the socket is torn down
    setTimeout(() => { try { dc && dc.close(); } catch {} try { pc && pc.close(); } catch {} }, 200);
  }
}
