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

// Bu tarayıcının gizli cihaz anahtarı: oyuncu aynı cihazdan yeniden katılınca (sekme kapanıp link yeniden
// açılınca, telefon uygulamayı arka planda kapatınca) eski kaydının yerine geçer, ikinci bir kopya oluşmaz.
// Başkalarına gösterilmez; yalnızca kurucuya "merhaba" ile gider.
export const deviceKey = (() => {
  let k = "";
  try { k = localStorage.getItem("jqDevKey") || ""; } catch {}
  if (!/^[a-z0-9]{16,32}$/.test(k)) {
    k = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => (b % 36).toString(36)).join("");
    try { localStorage.setItem("jqDevKey", k); } catch {}
  }
  return k;
})();
const STALE = 75000; // bu kadar süre hiç ses vermeyen oyuncu (telefonu arka planda) çevrimdışı sayılır

// Kurucu: oyuncuların komutlarını alır, her birine kendi durumunu yollar.
// claim(pid, key): bu oyuncu katılabilir mi; { old } aynı cihazın lobideki eski kimliği, { err } ret sebebi.
export function hostRoom(code, { onHello, onAction, onLeave, onBack, claim, onChat }) {
  const { room, send, onMessage } = open(code);
  const peers = new Map(); // peerId -> pid
  const seen = new Map(); // peerId -> son mesaj zamanı
  const stale = new Set(); // sessiz kaldığı için çevrimdışı sayılan eşler
  const profiles = new Map(); // peerId -> profil (geri dönünce yeniden eklemek için)
  const drop = (peerId, reason) => {
    send({ t: "denied", reason }, { target: peerId });
    peers.delete(peerId);
    seen.delete(peerId);
    stale.delete(peerId);
    profiles.delete(peerId);
  };
  onMessage((m, ctx) => {
    const peerId = ctx?.peerId ?? ctx;
    if (!m || typeof m !== "object") return;
    seen.set(peerId, Date.now());
    if (stale.delete(peerId) && peers.has(peerId)) onBack?.(peers.get(peerId), profiles.get(peerId));
    if (m.t === "sync") return send({ t: "sync", c: m.c, h: Date.now() }, { target: peerId });
    if (m.t === "hello") {
      // Oyuncu kimliği sayfaya ve olay işleyicilerine girer: yalnızca güvenli karakterler.
      if (typeof m.pid !== "string" || !/^[a-z0-9]{4,16}$/.test(m.pid)) return;
      const key = typeof m.key === "string" && /^[a-z0-9]{16,32}$/.test(m.key) ? m.key : "";
      const pw = typeof m.pw === "string" ? m.pw.slice(0, 40) : "";
      // Bir oyuncunun kimliğini kopyalayıp onun yerine cevap vermek engellenir: aynı kimlik ancak aynı cihaz anahtarıyla
      // devralınabilir. Aynı cihazdan gelen yeni bağlantı eskisinin (kopmuş ya da arka planda kalmış) yerine geçer.
      const c = claim ? claim(m.pid, key, pw) : {};
      if (c.err) return send({ t: "denied", reason: c.err, ...(c.pw ? { pw: 1 } : {}) }, { target: peerId });
      for (const [p, id] of [...peers]) if (p !== peerId && (id === m.pid || (c.old && id === c.old))) drop(p, "Bu cihazdan yeniden bağlandın; eski bağlantı kapatıldı.");
      // Önce eşi kaydet ki onHello'nun tetiklediği durum yayını yeni oyuncuya da ulaşsın.
      peers.set(peerId, m.pid);
      profiles.set(peerId, m.profile);
      const err = onHello(m.pid, m.profile, key, c.old || null);
      if (err) {
        peers.delete(peerId);
        send({ t: "denied", reason: err }, { target: peerId });
      }
      return;
    }
    const pid = peers.get(peerId);
    if (!pid) return;
    if (m.t === "chat") return onChat?.(pid, m.x);
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
    seen.delete(peerId);
    stale.delete(peerId);
    profiles.delete(peerId);
    if (pid && ![...peers.values()].includes(pid)) onLeave(pid);
  };
  // Telefonu arka plana atılan oyuncunun bağlantısı çoğu zaman kapanmaz, yalnızca susar: uzun süre ses
  // vermeyen oyuncu çevrimdışı sayılır (lobiden düşer), yeniden ses verince geri gelir.
  const watch = setInterval(() => {
    const now = Date.now();
    for (const [peerId, pid] of peers) {
      if (stale.has(peerId) || now - (seen.get(peerId) || now) < STALE) continue;
      stale.add(peerId);
      if (![...peers].some(([p, id]) => id === pid && !stale.has(p))) onLeave(pid);
    }
  }, 10000);
  return {
    peers,
    sendState(viewFor) {
      for (const [peerId, pid] of peers) send({ t: "state", s: viewFor(pid) }, { target: peerId });
    },
    // Sohbet mesajı herkese gider; hiçbir yerde saklanmaz.
    chat(msg) {
      for (const peerId of peers.keys()) send({ t: "chat", m: msg }, { target: peerId });
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
      clearInterval(watch);
      if (quiet) return room.leave();
      try { send({ t: "bye" }); } catch {}
      setTimeout(() => room.leave(), 400);
    },
  };
}

// Oyuncu: kurucuyu bulur, saatini eşitler, komut gönderir.
export function guestRoom(code, pid, profile, pw, { onState, onDenied, onHostLost, onHostBack, onChat }) {
  const { room, send, onMessage } = open(code);
  let hostPeer = null;
  let offset = 0;
  let bestRtt = Infinity;
  let lostTimer = null;
  const pending = new Map();
  let n = 0;
  const helloTo = new Set(); // kendini kurucu olarak tanıtan ve "merhaba" dediğimiz eşler
  const hostCands = new Set(); // kurucu bağlıyken kendini kurucu ilan edenler

  const sync = () => {
    if (hostPeer) send({ t: "sync", c: Date.now() }, { target: hostPeer });
  };
  onMessage((m, ctx) => {
    const peerId = ctx?.peerId ?? ctx;
    if (!m || typeof m !== "object") return;
    if (m.t === "host") {
      // Kurucu bilinirken başka biri kendini kurucu ilan edemez; kurucu ayrılırsa (sayfayı yenilediyse) bu adaylara dönülür.
      if (hostPeer && hostPeer !== peerId) { hostCands.add(peerId); return; }
      helloTo.add(peerId);
      send({ t: "hello", pid, profile, key: deviceKey, pw }, { target: peerId });
      return;
    }
    if (m.t === "state") {
      // Oyun durumu yalnızca kurucudan kabul edilir; kurucu yoksa (ilk bağlantı ya da yeniden bağlanma)
      // yalnızca merhaba dediğimiz eşten. Lobideki başka bir oyuncu sahte ekran gönderemez.
      if (hostPeer ? hostPeer !== peerId : !helloTo.has(peerId)) return;
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
    // "Lobiden çıkarıldın" gibi mesajlar da yalnızca kurucudan (ya da henüz kurucu belli değilken merhaba dediğimiz eşten).
    if (peerId !== hostPeer && !(m.t === "denied" && !hostPeer && helloTo.has(peerId))) return;
    if (m.t === "sync") {
      const now = Date.now();
      const rtt = now - m.c;
      if (rtt < bestRtt) {
        bestRtt = rtt;
        offset = m.h + rtt / 2 - now;
      }
    } else if (m.t === "chat") {
      onChat?.(m.m);
    } else if (m.t === "denied") {
      onDenied(m.reason, !!m.pw);
    } else if (m.t === "bye") {
      clearTimeout(lostTimer);
      onDenied("Kurucu lobiyi kapattı.");
    } else if (m.t === "error") {
      pending.get(m.id)?.(m.error);
      pending.delete(m.id);
    }
  });
  room.onPeerLeave = (peerId) => {
    helloTo.delete(peerId);
    hostCands.delete(peerId);
    if (peerId !== hostPeer) return;
    for (const c of hostCands) { helloTo.add(c); send({ t: "hello", pid, profile, key: deviceKey, pw }, { target: c }); }
    hostCands.clear();
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
    chat(text) {
      if (!hostPeer) throw Error("Kurucuya bağlı değilsin.");
      send({ t: "chat", x: text }, { target: hostPeer });
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
