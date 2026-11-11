// Senaryo atölyesi: bir takım için "hangi maç sezonu değiştirirdi?" ve hedefe (şampiyonluk, Avrupa, ligde kalma) giden en az maç planı.
import { computeTable, applyEdits } from './engine.js';
import { positionOutcome } from './rules.js';
import { t } from './i18n.js';

export const TARGETS = {
  title: { label: t('Şampiyonluk'), ok: (pos, n, s) => pos === 1 },
  promo: { label: t('Yükselmek'), ok: (pos, n, s) => pos <= s.promo },
  ucl: { label: t('Şampiyonlar Ligi'), ok: (pos, n, s) => pos <= s.ucl },
  euro: { label: t('Avrupa kupaları'), ok: (pos, n, s) => pos <= s.ucl + s.el + s.uecl },
  safe: { label: t('Ligde kalmak'), ok: (pos, n, s) => pos <= n - s.rel },
};
const TIER_RANK = { promo: 5, rel: 0, none: 1, uecl: 2, el: 3, ucl: 4 };

const ownScore = (m, id, up) => {
  // up: takımı kazandıran en küçük skor değişikliği (rakip golü sabit); down: kaybettiren
  const home = m.h === id, opp = home ? m.ag : m.hg, own = home ? m.hg : m.ag;
  let o = up ? Math.max(own, opp + 1) : Math.min(own, Math.max(opp - 1, 0));
  let p = opp;
  if (!up && o >= p) { p = o + 1; }       // örn. 0-0 → 0-1
  return home ? { hg: o, ag: p } : { hg: p, ag: o };
};

const result = (m, id) => { const own = m.h === id ? m.hg : m.ag, opp = m.h === id ? m.ag : m.hg; return own > opp ? 'W' : own === opp ? 'D' : 'L'; };

function standing(matches, id, comp, n, slots, names) {
  const t = computeTable(matches, { comp, names });
  const row = t.find(r => r.id === id);
  return { row, pos: row?.pos ?? n, pts: row?.pts ?? 0, tier: positionOutcome(comp, row?.pos ?? n, n, slots).tier };
}

/** Takımın tek tek maç sonuçlarını çevirerek sezonun nasıl değişeceği. */
export function turningPoints({ matches, id, comp, slots, names, mode = 'up' }) {
  const n = new Set(matches.flatMap(m => [m.h, m.a])).size;
  const base = standing(matches, id, comp, n, slots, names);
  const mine = matches.filter(m => (m.h === id || m.a === id) && m.hg != null);
  const cand = mine.filter(m => (mode === 'up' ? result(m, id) !== 'W' : result(m, id) !== 'L'));
  const flips = cand.map(m => {
    const sc = ownScore(m, id, mode === 'up');
    const alt = applyEdits(matches, new Map([[m.id, sc]]));
    const s = standing(alt, id, comp, n, slots, names);
    return { match: m, score: sc, pos: s.pos, pts: s.pts, tier: s.tier, dPos: base.pos - s.pos, dPts: s.pts - base.pts, tierShift: TIER_RANK[s.tier] - TIER_RANK[base.tier], before: result(m, id) };
  });
  const score = f => (mode === 'up' ? f.tierShift * 100 + f.dPos * 10 : -f.tierShift * 100 - f.dPos * 10);
  flips.sort((a, b) => Math.abs(score(b)) - Math.abs(score(a)) || b.dPts - a.dPts);
  return { base, n, flips };
}

/** Hedefe ulaşmak için kendi sonuçlarını en az sayıda çevir (açgözlü: en çok puan getiren önce). */
export function planTarget({ matches, id, comp, slots, names, target }) {
  const n = new Set(matches.flatMap(m => [m.h, m.a])).size;
  const T = TARGETS[target];
  let edits = new Map(), cur = matches;
  const st = () => standing(cur, id, comp, n, slots, names);
  let s = st();
  if (T.ok(s.pos, n, slots)) return { already: true, edits: [], final: s, n };
  const pool = matches.filter(m => (m.h === id || m.a === id) && m.hg != null && result(m, id) !== 'W');
  pool.sort((a, b) => (result(a, id) === 'L' ? 0 : 1) - (result(b, id) === 'L' ? 0 : 1) || a.date.localeCompare(b.date));
  const used = [];
  for (let guard = 0; guard < 40 && !T.ok(s.pos, n, slots); guard++) {
    let best = null, bs = null;
    for (const m of pool) {
      if (edits.has(m.id)) continue;
      const sc = ownScore(m, id, true);
      const alt = applyEdits(cur, new Map([[m.id, sc]]));
      const x = standing(alt, id, comp, n, slots, names);
      const gain = (s.pos - x.pos) * 10 + (x.pts - s.pts) + (result(m, id) === 'L' ? 0.5 : 0);
      if (!bs || gain > bs.gain) { bs = { gain, x }; best = { m, sc }; }
    }
    if (!best) break;
    edits.set(best.m.id, best.sc);
    used.push({ match: best.m, score: best.sc, before: result(best.m, id) });
    cur = applyEdits(matches, edits);
    s = st();
  }
  return { already: false, ok: T.ok(s.pos, n, slots), edits: used, final: s, n };
}
