// FC 27 Ultimate Team kimyası ve takım reytingi.
// Kurallar (topluluk kaynaklarına göre, resmî belge değil):
//  - Oyuncu yalnızca kartındaki mevkilerden birinde oynuyorsa kimya alır; mevki dışındaki oyuncu 0 alır ve eşiklere katkı vermez.
//  - Eşikler (1 / 2 / 3 puan): kulüp 2/4/7, ülke 2/5/8, lig 3/5/8 oyuncu. Oyuncu başına en çok 3, takım en çok 33.
//  - Teknik direktör, ülkesine ve ligine birer oyuncu gibi sayılır.
export const THRESH = { club: [2, 4, 7], nation: [2, 5, 8], league: [3, 5, 8] };
const pts = (n, t) => (n >= t[2] ? 3 : n >= t[1] ? 2 : n >= t[0] ? 1 : 0);

/** slots: ["GK","LB",…] · xi: oyuncu nesneleri ya da null · mgr: { nation, league } (isim ya da null) */
export function chemistry(slots, xi, mgr = {}) {
  const inPos = xi.map((p, i) => !!p && p.pos.includes(slots[i]));
  const count = { club: new Map(), nation: new Map(), league: new Map() };
  const add = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  xi.forEach((p, i) => { if (inPos[i]) { add(count.club, p.club); add(count.nation, p.nation); add(count.league, p.league); } });
  if (mgr.nation) add(count.nation, mgr.nation);
  if (mgr.league) add(count.league, mgr.league);
  const per = xi.map((p, i) => {
    if (!p) return null;
    if (!inPos[i]) return { chem: 0, out: true, club: 0, nation: 0, league: 0 };
    const c = pts(count.club.get(p.club), THRESH.club), n = pts(count.nation.get(p.nation), THRESH.nation), l = pts(count.league.get(p.league), THRESH.league);
    return { chem: Math.min(3, c + n + l), out: false, club: c, nation: n, league: l, counts: { club: count.club.get(p.club), nation: count.nation.get(p.nation), league: count.league.get(p.league) } };
  });
  return { per, total: per.reduce((s, x) => s + (x ? x.chem : 0), 0), count };
}

/**
 * Kimyayı en çok artıran teknik direktör (ülke + lig). Yalnızca sahadaki oyuncuların ülke ve ligleri
 * aday olur (başkası kimyayı etkilemez). Hızlı: oyuncu başına kulüp puanı bir kez hesaplanır.
 * fixed: { nation?, league? } verilirse o taraf sabit kalır. → { nation, league, total }
 */
export function bestManager(slots, xi, fixed = {}, fast = false) {
  const ps = [];
  const cN = new Map(), cL = new Map(), cC = new Map();
  const add = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  xi.forEach((p, i) => { if (p && p.pos.includes(slots[i])) { ps.push(p); add(cN, p.nation); add(cL, p.league); add(cC, p.club); } });
  const club = ps.map((p) => pts(cC.get(p.club), THRESH.club));
  const total = (n, l) => {
    let s = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const nn = (cN.get(p.nation) || 0) + (p.nation === n ? 1 : 0), ll = (cL.get(p.league) || 0) + (p.league === l ? 1 : 0);
      s += Math.min(3, club[i] + pts(nn, THRESH.nation) + pts(ll, THRESH.league));
    }
    return s;
  };
  const nats = fixed.nation !== undefined ? [fixed.nation] : ["", ...cN.keys()];
  const lgs = fixed.league !== undefined ? [fixed.league] : ["", ...cL.keys()];
  let best = { nation: nats[0], league: lgs[0], total: -1 };
  const tryP = (n, l) => { const t = total(n, l); if (t > best.total) best = { nation: n, league: l, total: t }; };
  if (fast) {
    // kadro kurma aramasında: önce ülke sonra lig, sonra tersi (tüm çiftlerden çok daha hızlı)
    let bn = nats[0], bv = -1;
    for (const n of nats) { const t = total(n, ""); if (t > bv) { bv = t; bn = n; } }
    for (const l of lgs) tryP(bn, l);
    let bl = lgs[0]; bv = -1;
    for (const l of lgs) { const t = total("", l); if (t > bv) { bv = t; bl = l; } }
    for (const n of nats) tryP(n, bl);
  } else for (const n of nats) for (const l of lgs) tryP(n, l); // tüm çiftler (en çok 12 × 12)
  return best;
}

/** FUT takım reytingi: ortalamanın üstündeki her puan bir kez daha eklenir, sonra 11'e bölünür (aşağı yuvarlanır). */
export function teamRating(xi) {
  const r = xi.filter(Boolean).map((p) => p.r);
  if (!r.length) return 0;
  const all = [...r, ...Array(11 - r.length).fill(0)];
  const sum = all.reduce((a, b) => a + b, 0), avg = sum / 11;
  const extra = all.reduce((a, b) => a + (b > avg ? b - avg : 0), 0);
  return Math.floor(Math.round((sum + extra) * 100) / 100 / 11);
}
