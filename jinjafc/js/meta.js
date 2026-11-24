// Meta Rating: oyuncunun belirli bir mevkide oyunda ne kadar etkili olacağını tahmin eden kendi puanımız.
// Mevkiye göre ağırlıklandırılmış ayrıntılı özellikler + zayıf ayak, yetenek hareketleri, PlayStyle+ ve boy bonusları.
// Ayrıca: seçilen filtrelere göre en iyi kadroları kuran otomatik kadro kurucu.
import { chemistry } from "./chem.js";

// özellik sırası (players.json "attrs" ile aynı)
const A = { acc: 0, spr: 1, pos: 2, fin: 3, sp: 4, ls: 5, vol: 6, pen: 7, vis: 8, cro: 9, fk: 10, sps: 11, lps: 12, cur: 13, agi: 14, bal: 15, rea: 16, bc: 17, dri: 18, com: 19,
  int: 20, hea: 21, da: 22, st: 23, sl: 24, jum: 25, sta: 26, str: 27, agg: 28, gkd: 29, gkh: 30, gkk: 31, gkp: 32, gkr: 33 };
const W = {
  ST: { acc: 12, spr: 12, pos: 10, fin: 16, sp: 7, rea: 7, bc: 6, dri: 6, com: 7, agi: 5, str: 5, hea: 3, ls: 2, vol: 2 },
  W: { acc: 14, spr: 12, dri: 12, bc: 10, agi: 8, fin: 8, cro: 6, sps: 6, rea: 6, com: 6, bal: 5, vis: 4, ls: 3 },
  CAM: { dri: 10, bc: 10, sps: 10, vis: 10, agi: 7, acc: 10, spr: 6, fin: 8, ls: 6, com: 8, rea: 7, bal: 3, pos: 5 },
  CM: { sps: 13, lps: 9, vis: 9, bc: 9, dri: 7, sta: 7, rea: 8, com: 8, int: 6, da: 5, st: 5, acc: 7, spr: 4, ls: 3 },
  CDM: { int: 12, da: 12, st: 12, str: 8, agg: 6, sps: 10, lps: 6, rea: 8, com: 6, sta: 6, acc: 7, spr: 4, bc: 3 },
  FB: { acc: 13, spr: 13, st: 10, da: 10, int: 9, sl: 5, cro: 7, sps: 7, sta: 8, rea: 6, agi: 5, str: 4, bc: 3 },
  CB: { da: 16, st: 15, int: 12, sl: 7, str: 10, jum: 6, hea: 8, spr: 8, acc: 6, rea: 6, com: 4, agg: 2 },
  GK: { gkd: 20, gkh: 15, gkk: 10, gkp: 20, gkr: 25, rea: 10 },
};
export const GROUP = { ST: "ST", CF: "ST", LW: "W", RW: "W", LM: "W", RM: "W", CAM: "CAM", CM: "CM", CDM: "CDM", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", CB: "CB", GK: "GK" };
const ROLE_TR = { ST: "Bitirici forvet", W: "Hızlı kanat", CAM: "Oyun kurucu 10", CM: "Box-to-box orta saha", CDM: "Savunmacı orta saha", FB: "Bindiren bek", CB: "Savunma lideri", GK: "Kaleci" };
const ATTACK = new Set(["ST", "W", "CAM"]);

/** Oyuncunun bir mevkideki Meta Rating'i (bir ondalık). Mevkisi kartında yoksa 0. */
export function metaAt(p, pos) {
  if (!p.pos.includes(pos)) return 0;
  const key = (p.mk ||= {});
  if (key[pos] != null) return key[pos];
  const g = GROUP[pos], w = W[g];
  let sum = 0, tot = 0;
  for (const [k, v] of Object.entries(w)) { sum += p.attrs[A[k]] * v; tot += v; }
  let m = sum / tot;
  if (g !== "GK") {
    m += (p.wf - 3) * 0.7;
    if (ATTACK.has(g)) m += (p.skill - 3) * 0.6;
    if (g === "CB") m += Math.max(-2, Math.min(2, (p.h - 185) / 6));
    if (g === "ST") m += Math.max(-1, Math.min(1.5, (p.h - 180) / 10));
  } else m += Math.max(-2.5, Math.min(2, (p.h - 188) / 5));
  m += Math.min(3, p.psp.length) * 0.6 + Math.min(8, p.ps.length) * 0.08;
  // kartın genel reytingi de oyunda önemli (gizli özellikler, tepkiler); biraz harmanla
  m = m * 0.85 + p.r * 0.15;
  return (key[pos] = Math.round(m * 10) / 10);
}
/** Oyuncunun en iyi mevkisi ve rolü */
export function bestRole(p) {
  let best = null;
  for (const pos of p.pos) { const v = metaAt(p, pos); if (!best || v > best.v) best = { pos, v }; }
  return { ...best, role: ROLE_TR[GROUP[best.pos]] };
}
/** Puanı harf notuna çevir (oyuncu listesinde) */
export function grade(m, r) {
  const d = m - r;
  return d >= 3 ? "S" : d >= 1.5 ? "A+" : d >= 0 ? "A" : d >= -1.5 ? "B" : "C";
}

/** Kadronun Meta Rating'i: oyuncuların kendi mevkilerindeki puan ortalaması (mevki dışı = reytinginin 10 eksiği) */
export function squadMeta(slots, xi) {
  const v = xi.map((p, i) => (p ? metaAt(p, slots[i]) || p.r - 10 : 0));
  const n = xi.filter(Boolean).length;
  return n ? Math.round((v.reduce((a, b) => a + b, 0) / 11) * 10) / 10 : 0;
}

/**
 * Otomatik kadro kurucu. players: süzülmüş oyuncu listesi, formations: { key: slots[] }
 * opts: { want: "meta" | "chem", onProgress } → en iyi kadroların listesi
 * Yöntem: her diziliş için birkaç "çekirdek" (en güçlü ligler ve ülkeler + karışık) ile açgözlü doldurma,
 * ardından değiştirme denemeleriyle yerel iyileştirme. Hedef = ortalama puan + kimya ağırlığı.
 */
export async function autoBuild(players, formations, opts = {}) {
  const lambda = opts.want === "chem" ? 0.9 : 0.35;
  const results = [];
  const keys = Object.keys(formations);
  for (let fi = 0; fi < keys.length; fi++) {
    const fk = keys[fi], slots = formations[fk];
    opts.onProgress?.(fi / keys.length, fk);
    await new Promise((r) => setTimeout(r, 0));
    // her mevki için en iyi 30 aday
    const cand = {};
    for (const pos of new Set(slots)) cand[pos] = players.filter((p) => p.pos.includes(pos)).sort((a, b) => metaAt(b, pos) - metaAt(a, pos)).slice(0, 30);
    if (slots.some((pos, i) => !(opts.fixed || [])[i] && cand[pos].length < slots.filter((x) => x === pos).length)) continue;
    // çekirdekler: adaylar arasında en kalabalık ligler ve ülkeler
    const pool = [...new Set(Object.values(cand).flat())];
    const top = (key) => Object.entries(pool.reduce((m, p) => ((m[p[key]] = (m[p[key]] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => ({ key, val: k }));
    const seeds = [null, ...top("league"), ...top("nation")];
    const fixed = opts.fixed || [];
    // tek bir kurulum: çekirdek (lig/ülke tercihi), kimya ağırlığı ve dışarıda bırakılan oyuncular ile
    const run = (seed, lam, ban) => {
      const xi = slots.map((_, i) => fixed[i] || null), used = new Set(xi.filter(Boolean).map((p) => p.id));
      const ok = (p) => !used.has(p.id) && !ban.has(p.id);
      const order = slots.map((pos, i) => i).filter((i) => !fixed[i]).sort((a, b) => cand[slots[a]].length - cand[slots[b]].length);
      for (const i of order) {
        const pos = slots[i];
        let best = null, bv = -1e9;
        for (const p of cand[pos]) {
          if (!ok(p)) continue;
          const v = metaAt(p, pos) + (seed && p[seed.key] === seed.val ? 4 : 0);
          if (v > bv) { bv = v; best = p; }
        }
        if (!best) return null;
        xi[i] = best; used.add(best.id);
      }
      const score = (x) => squadMeta(slots, x) + lam * chemistry(slots, x).total;
      let cur = score(xi);
      // yerel iyileştirme: her mevkide adayları dene, iyileştiren değişikliği kabul et
      for (let pass = 0; pass < 3; pass++) {
        let improved = false;
        for (let i = 0; i < 11; i++) {
          if (fixed[i]) continue;
          for (const p of cand[slots[i]]) {
            if (!ok(p)) continue;
            const old = xi[i];
            xi[i] = p;
            const sc = score(xi);
            if (sc > cur + 1e-6) { used.delete(old.id); used.add(p.id); cur = sc; improved = true; } else xi[i] = old;
          }
        }
        if (!improved) break;
      }
      return xi;
    };
    const add = (xi) => {
      if (!xi) return;
      const sig = xi.map((p) => p.id).sort().join(".");
      if (results.some((r) => r.sig === sig)) return;
      results.push({ f: fk, xi: xi.slice(), chem: chemistry(slots, xi).total, meta: squadMeta(slots, xi), sig });
    };
    const none = new Set();
    for (const seed of seeds) for (const lam of [lambda, lambda * 2.2, lambda * 0.4]) add(run(seed, lam, none));
    // çeşitlilik: en iyi kadrodaki her oyuncuyu sırayla dışarıda bırakıp yeniden kur
    const mine = results.filter((r) => r.f === fk).sort((a, b) => b.meta + lambda * b.chem - (a.meta + lambda * a.chem))[0];
    if (mine) for (const p of mine.xi) if (!fixed.includes(p)) add(run(null, lambda, new Set([p.id])));
    await new Promise((r) => setTimeout(r, 0));
  }
  opts.onProgress?.(1);
  return results;
}
