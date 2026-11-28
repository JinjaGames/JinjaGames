// Günün quizi: o gün herkese aynı 10 soru. Sorular Türkiye saatine göre tarihten türeyen bir tohumla,
// sitenin kendi trivia havuzundan (her biri farklı kategoriden) seçilir; sunucu gerekmez.
// Sıralaması board.js ile tutulur (anahtar: daily-YYYYMMDD); yalnızca o günkü ilk oyun sıralamaya girer.

/** Türkiye saatine göre bugünün tarihi: "2026-11-27" */
export const dailyDate = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
/** Bir sonraki günün quizine kalan süre (ms) */
export const dailyLeft = (t = Date.now()) => {
  const tr = t + 3 * 3600e3;
  return 86400e3 - (tr % 86400e3);
};

function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (a, r) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const dailyLabel = (date) => {
  const d = new Date(date + "T12:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${DAYS[d.getUTCDay()]}`;
};

/** O günün quizi (trivia biçiminde). Dört şıklı sorular; her kategoriden en fazla bir soru. */
export function dailyQuiz(TRIVIA, date = dailyDate()) {
  const r = rng("jinjaquiz-daily-" + date);
  const byCat = new Map();
  // since: o tarihten önce eklenmemiş sayılır (sonradan eklenen sorular geçmiş günlerin sorularını değiştirmesin)
  for (const t of [...TRIVIA].filter((t) => !t.noDaily && !(t.since > date)).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!byCat.has(t.cat)) byCat.set(t.cat, []);
    byCat.get(t.cat).push(t);
  }
  const cats = shuffle([...byCat.keys()].sort(), r).slice(0, 10);
  const items = [];
  const used = new Set();
  for (const c of cats) {
    const quiz = shuffle(byCat.get(c), r)[0];
    const pool = (quiz.dailyItems || quiz.items).filter((it) => it.a.length === 4 && !it.img && !it.qf && !it.qs && !(it.since > date) && !used.has(it.q));
    const it = shuffle(pool, r)[0];
    if (!it) continue;
    used.add(it.q);
    items.push({ ...it, cat: c });
  }
  return {
    id: "daily-" + date.replace(/-/g, ""), kind: "trivia", daily: date, cat: "Genel Kültür", genre: "Günün Quizi", emoji: "🎯",
    name: `Günün Quizi · ${dailyLabel(date)}`, desc: "Bugün herkes aynı 10 soruyu çözüyor. İlk oyunun günün sıralamasına yazılır.",
    items, cats: items.map((x) => x.cat),
  };
}

// ---- bu tarayıcıdaki sonuçlar ve seri ----
const KEY = "jqDaily";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const dailyResult = (date = dailyDate()) => read()[date] || null;
export function saveDaily(date, res) {
  const all = read();
  if (all[date]) return; // yalnızca o günün ilk oyunu
  all[date] = res;
  const keys = Object.keys(all).sort().slice(-60);
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, all[k]])))); } catch {}
}
/** Arka arkaya kaç gün oynandı (bugün ya da dün biten seri) */
export function dailyStreak(today = dailyDate()) {
  const all = read();
  let n = 0;
  let t = Date.parse(today + "T12:00:00Z");
  if (!all[today]) t -= 86400e3;
  while (all[new Date(t).toISOString().slice(0, 10)]) { n++; t -= 86400e3; }
  return n;
}
