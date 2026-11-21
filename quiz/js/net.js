// Sunucusuz çok oyunculu bağlantı: WebRTC (Trystero). Eşleşme için herkese açık Nostr
// röleleri kullanılır; oyun verisi oyuncular arasında doğrudan, şifreli akar.
import { joinRoom, selfId } from "../vendor/trystero.js";

const CONFIG = {
  appId: "jinjagames.jinjaquiz.v1",
  // Varsayılan rastgele röle seçimi bazen kapalı/engelli rölelere düşüyor; bilinen sağlam röleler.
  relayConfig: {
    urls: [
      "wss://relay.damus.io",
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://nostr.mom",
      "wss://relay.nostr.band",
      "wss://offchain.pub",
    ],
  },
  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ],
  },
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % 32]).join("");
export const validCode = (c) => /^[A-HJ-NP-Z2-9]{5}$/.test(c);

function open(code) {
  const room = joinRoom(CONFIG, "jq-" + code);
  const [send, onMessage] = (() => {
    const a = room.makeAction("m");
    return [a.send.bind(a), (fn) => (a.onMessage = fn)];
  })();
  return { room, send, onMessage };
}

// Kurucu: oyuncuların komutlarını alır, her birine kendi durumunu yollar.
export function hostRoom(code, { onHello, onAction, onLeave }) {
  const { room, send, onMessage } = open(code);
  const peers = new Map(); // peerId -> pid
  onMessage((m, ctx) => {
    const peerId = ctx?.peerId ?? ctx;
    if (!m || typeof m !== "object") return;
    if (m.t === "sync") return send({ t: "sync", c: m.c, h: Date.now() }, { target: peerId });
    if (m.t === "hello") {
      // Oyuncu kimliği sayfaya ve olay işleyicilerine girer: yalnızca güvenli karakterler.
      if (typeof m.pid !== "string" || !/^[a-z0-9]{4,16}$/.test(m.pid)) return;
      // Önce eşi kaydet ki onHello'nun tetiklediği durum yayını yeni oyuncuya da ulaşsın.
      peers.set(peerId, m.pid);
      const err = onHello(m.pid, m.profile, peerId);
      if (err) {
        peers.delete(peerId);
        send({ t: "denied", reason: err }, { target: peerId });
      }
      return;
    }
    const pid = peers.get(peerId);
    if (!pid) return;
    if (m.t === "act") {
      let error = null;
      try {
        onAction(pid, m.a);
      } catch (e) {
        error = e.message;
      }
      if (error) send({ t: "error", id: m.id, error }, { target: peerId });
    }
  });
  room.onPeerJoin = (peerId) => send({ t: "host", code }, { target: peerId });
  room.onPeerLeave = (peerId) => {
    const pid = peers.get(peerId);
    peers.delete(peerId);
    if (pid && ![...peers.values()].includes(pid)) onLeave(pid);
  };
  return {
    peers,
    sendState(viewFor) {
      for (const [peerId, pid] of peers) send({ t: "state", s: viewFor(pid) }, { target: peerId });
    },
    kick(pid) {
      for (const [peerId, p] of peers)
        if (p === pid) {
          send({ t: "denied", reason: "Kurucu seni lobiden çıkardı." }, { target: peerId });
          peers.delete(peerId);
        }
    },
    // "Ayrıl": oyunculara lobinin kapandığını söyle, sonra çık. Sayfa yenilenirken (quiet) söyleme;
    // kurucu birkaç saniyede geri döner.
    close({ quiet = false } = {}) {
      if (quiet) return room.leave();
      try { send({ t: "bye" }); } catch {}
      setTimeout(() => room.leave(), 400);
    },
  };
}

// Oyuncu: kurucuyu bulur, saatini eşitler, komut gönderir.
export function guestRoom(code, pid, profile, { onState, onDenied, onHostLost, onHostBack }) {
  const { room, send, onMessage } = open(code);
  let hostPeer = null;
  let offset = 0;
  let bestRtt = Infinity;
  let lostTimer = null;
  const pending = new Map();
  let n = 0;

  const sync = () => {
    if (hostPeer) send({ t: "sync", c: Date.now() }, { target: hostPeer });
  };
  onMessage((m, ctx) => {
    const peerId = ctx?.peerId ?? ctx;
    if (!m || typeof m !== "object") return;
    if (m.t === "host") {
      send({ t: "hello", pid, profile }, { target: peerId });
      return;
    }
    if (m.t === "state") {
      if (hostPeer !== peerId) {
        const wasLost = lostTimer !== null;
        hostPeer = peerId;
        clearTimeout(lostTimer);
        lostTimer = null;
        bestRtt = Infinity;
        sync();
        setTimeout(sync, 400);
        setTimeout(sync, 1200);
        if (wasLost) onHostBack?.();
      }
      onState(m.s, offset);
      return;
    }
    if (peerId !== hostPeer && m.t !== "denied") return;
    if (m.t === "sync") {
      const now = Date.now();
      const rtt = now - m.c;
      if (rtt < bestRtt) {
        bestRtt = rtt;
        offset = m.h + rtt / 2 - now;
      }
    } else if (m.t === "denied") {
      onDenied(m.reason);
    } else if (m.t === "bye") {
      clearTimeout(lostTimer);
      onDenied("Kurucu lobiyi kapattı.");
    } else if (m.t === "error") {
      pending.get(m.id)?.(m.error);
      pending.delete(m.id);
    }
  });
  room.onPeerLeave = (peerId) => {
    if (peerId !== hostPeer) return;
    hostPeer = null;
    onHostLost?.();
    // Kurucu sayfayı yenilediyse birkaç saniyede döner; dönmezse lobi kapanmış sayılır.
    lostTimer = setTimeout(() => onDenied("Kurucu ayrıldı, lobi kapandı."), 20000);
  };
  const resync = setInterval(sync, 15000);
  return {
    get offset() {
      return offset;
    },
    get connected() {
      return !!hostPeer;
    },
    act(a) {
      if (!hostPeer) return Promise.reject(Error("Kurucuya bağlı değilsin."));
      const id = ++n;
      send({ t: "act", id, a }, { target: hostPeer });
      // Hata gelmezse işlem kabul edilmiştir; sonuç durum güncellemesiyle görünür.
      return new Promise((resolve, reject) => {
        pending.set(id, (e) => reject(Error(e)));
        setTimeout(() => {
          pending.delete(id);
          resolve();
        }, 1500);
      });
    },
    close() {
      clearInterval(resync);
      clearTimeout(lostTimer);
      room.leave();
    },
  };
}

export { selfId };
