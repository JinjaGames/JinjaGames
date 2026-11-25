// node tools/board_test.mjs — puan sıralaması birleştirme testi (röle taklidiyle)
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
const { schnorr, sha256, bytesToHex } = await import("../quiz/vendor/nostr-sign.js");
const enc = new TextEncoder();
function ev(sk, s, n, at, q = "t-genel1") {
  const e = { pubkey: bytesToHex(schnorr.getPublicKey(sk)), created_at: at, kind: 30078, tags: [["d", "jqscore:" + q], ["t", "jinjaquiz-score"]], content: JSON.stringify({ v: 1, q, s, n, a: "guitar", k: "mint", c: 5 }) };
  e.id = bytesToHex(sha256(enc.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
  e.sig = bytesToHex(schnorr.sign(e.id, sk));
  return e;
}
const others = Array.from({ length: 15 }, () => bytesToHex(schnorr.utils.randomPrivateKey()));
const mySk = bytesToHex(schnorr.utils.randomPrivateKey());
store.jqNostrKey = mySk;
const events = others.map((sk, i) => ev(sk, 1000 - i * 50, "P" + i, 100 + i));
events.push(ev(others[0], 10, "P0-eski", 50)); // aynı oyuncunun düşük puanı sayılmaz
events.push(ev(mySk, 340, "Ben", 500));
const bad = ev(others[1], 1999, "Hileli", 600); bad.content = bad.content.replace("1999", "1998"); events.push(bad); // imzası bozuk
events.push(ev(others[2], 5000, "Sınır", 700)); // sınır dışı
globalThis.fetch = async () => ({ ok: false });
globalThis.WebSocket = class {
  constructor() { setTimeout(() => this.onopen?.(), 1); }
  send(d) { const [, sub] = JSON.parse(d); for (const e of events) this.onmessage?.({ data: JSON.stringify(["EVENT", sub, e]) }); this.onmessage?.({ data: JSON.stringify(["EOSE", sub]) }); }
  close() {}
};
const b = await import("../quiz/js/board.js");
const rows = await b.loadBoard("t-genel1");
const meAt = rows.findIndex(b.isMine);
const ok = rows.length === 16 && rows[0].n === "P0" && rows[0].s === 1000 && meAt === 14 && !rows.some((r) => r.n === "Hileli" || r.n === "Sınır" || r.n === "P0-eski");
console.log(rows.map((r, i) => `${i + 1}. ${r.n} ${r.s}`).join(" | "));
console.log(ok ? "GEÇTİ: sıralama doğru, ben " + (meAt + 1) + ". sıradayım" : "KALDI");
const r2 = await b.submitScore({ key: "t-genel1", score: 300, name: "Ben" });
const r3 = await b.submitScore({ key: "t-genel1", score: 900, name: "Ben" }); const r4 = await b.submitScore({ key: "t-genel1", score: 500, name: "Ben" });
console.log(r2.sent && r3.sent && !r4.sent && b.peekBoard("t-genel1").find(b.isMine).s === 900 ? "GEÇTİ: yalnızca rekor gönderiliyor" : "KALDI: gönderim", r2, r3);
process.exit(0);
