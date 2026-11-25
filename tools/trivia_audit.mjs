// node tools/trivia_audit.mjs — trivia istatistikleri ve "cevap uzunluğundan belli olan" sorular
const { TRIVIA } = await import("../quiz/js/trivia.js");
const len = (s) => [...s].length;
let total = 0, tells = [];
const byCat = {};
for (const t of TRIVIA) {
  total += t.items.length;
  byCat[t.cat] = (byCat[t.cat] || 0) + 1;
  for (const it of t.items) {
    if (it.a.length < 3) continue;
    const L = it.a.map(len), c = L[0], others = L.slice(1);
    const maxO = Math.max(...others), minO = Math.min(...others);
    // doğru cevap tek başına en uzun ve belirgin farkla uzunsa ya da en kısa ve belirgin kısaysa
    const longTell = c > maxO && c >= maxO * 1.35 + 2;
    const shortTell = c < minO && c * 1.35 + 2 <= minO;
    if (longTell || shortTell) tells.push({ id: t.id, q: it.q, a: it.a, why: longTell ? "uzun" : "kısa" });
  }
}
console.log("Quiz:", TRIVIA.length, "Soru:", total, "Ortalama:", (total / TRIVIA.length).toFixed(1));
console.log(byCat);
console.log("Uzunluktan belli olan:", tells.length);
if (process.argv[2] === "-v") for (const t of tells) console.log(t.id, "|", t.why, "|", t.q, "|", t.a.join(" / "));
const sizes = TRIVIA.map((t) => `${t.id}:${t.items.length}`);
console.log(sizes.join(" "));
