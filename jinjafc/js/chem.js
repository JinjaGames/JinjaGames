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

/** FUT takım reytingi: ortalamanın üstündeki her puan bir kez daha eklenir, sonra 11'e bölünür (aşağı yuvarlanır). */
export function teamRating(xi) {
  const r = xi.filter(Boolean).map((p) => p.r);
  if (!r.length) return 0;
  const all = [...r, ...Array(11 - r.length).fill(0)];
  const sum = all.reduce((a, b) => a + b, 0), avg = sum / 11;
  const extra = all.reduce((a, b) => a + (b > avg ? b - avg : 0), 0);
  return Math.floor(Math.round((sum + extra) * 100) / 100 / 11);
}
