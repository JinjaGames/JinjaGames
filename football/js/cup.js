// Kupa / eleme motoru: maçlardan eşleşme (tie) ağacı kurar, what-if değişikliklerini sonraki turlara yayar.
// Gerçek kazanan, sonraki turda kimin göründüğünden çıkarılır (veri penaltı sonucunu içermez).
import { rng, lambdas, poissonInv, computeTable, applyEdits } from './engine.js';
import { t as tp } from './i18n.js';

export const GROUP_RE = /group|league (phase|stage)|matchday|^[a-l]\s*$/i;
const UEFA_AWAY_GOALS = new Set(['CL', 'EL', 'CLQ', 'ELQ']);   // 2021 öncesi deplasman golü kuralı

export const stageOf = r => String(r || '').replace(/\s*(1st|2nd)\s*leg/i, '').replace(/\s*replay/i, '').trim();
const isExtra = r => /replay|decider/i.test(r || '');
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Grup aşaması dışındaki maçları eşleşmelere ayırır. */
export function buildTies(matches) {
  const ko = matches.filter(m => !GROUP_RE.test(m.round || ''));
  // aşamaları ilk tarihe göre sırala
  const first = new Map();
  for (const m of ko) if (!isExtra(m.round)) { const s = stageOf(m.round); if (!first.has(s) || m.date < first.get(s)) first.set(s, m.date); }
  const stages = [...first].sort((a, b) => a[1].localeCompare(b[1])).map(x => x[0]);
  const ties = new Map(), pairStage = new Map();
  const add = (stage, m) => {
    const key = `${stage}|${pairKey(m.h, m.a)}`;
    if (!ties.has(key)) ties.set(key, { key, stage, si: stages.indexOf(stage), teams: [m.h, m.a], matches: [] });
    ties.get(key).matches.push(m);
    pairStage.set(pairKey(m.h, m.a), stage);
  };
  for (const m of ko.filter(x => !isExtra(x.round))) add(stageOf(m.round), m);
  for (const m of ko.filter(x => isExtra(x.round))) {          // tekrar / belirleyici maçlar önceki eşleşmeye eklenir
    const st = pairStage.get(pairKey(m.h, m.a));
    if (st) add(st, m);
  }
  const gm = new Map();
  for (const m of matches.filter(x => GROUP_RE.test(x.round || ''))) (gm.get(m.round) || gm.set(m.round, []).get(m.round)).push(m);
  const groups = [...gm].map(([label, ms]) => ({ label, matches: ms }));
  const list = [...ties.values()].filter(t => t.si >= 0).sort((a, b) => a.si - b.si || a.matches[0].date.localeCompare(b.matches[0].date));
  for (const t of list) t.matches.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return { stages, ties: list, groups };
}

/** Bir eşleşmenin skorlarına (düzenlemeli) göre toplam; kazananı döndürür ya da null (eşit → penaltı). */
export function decide(tie, scores, { comp, season, pen } = {}) {
  const g = { [tie.teams[0]]: 0, [tie.teams[1]]: 0 }, away = { [tie.teams[0]]: 0, [tie.teams[1]]: 0 };
  for (const m of tie.matches) {
    const s = scores.get(m.id) || { hg: m.hg, ag: m.ag };
    g[m.h] += s.hg; g[m.a] += s.ag; away[m.a] += s.ag;
  }
  const [x, y] = tie.teams;
  if (g[x] !== g[y]) return { winner: g[x] > g[y] ? x : y, agg: g, how: 'agg' };
  if (UEFA_AWAY_GOALS.has(comp) && season <= 2020 && tie.matches.length === 2 && away[x] !== away[y]) return { winner: away[x] > away[y] ? x : y, agg: g, how: 'away' };
  return { winner: pen ?? null, agg: g, how: 'pens' };
}

/**
 * Gerçek ağacı çözer: her eşleşmenin gerçek kazananı (sonraki turdan), her takımın sonraki / önceki eşleşmesi.
 */
export function resolveReal(tieSet, { comp, season }) {
  const { ties } = tieSet;
  const next = new Map();   // takım -> kendisinin göründüğü eşleşme indeksleri
  ties.forEach((t, i) => t.teams.forEach(tm => (next.get(tm) || next.set(tm, []).get(tm)).push(i)));
  ties.forEach((t, i) => {
    const d = decide(t, new Map(), { comp, season });
    t.real = d;
    let w = d.winner;
    if (w == null) {   // eşit: sonraki turda görünen takım
      w = t.teams.find(tm => (next.get(tm) || []).some(j => ties[j].si > t.si)) ?? null;
      t.real = { ...d, winner: w, inferred: w != null };
    }
    t.idx = i;
  });
  // takım -> bir sonraki eşleşme (daha ileri aşama)
  const nextTie = (team, si) => { const js = (next.get(team) || []).filter(j => ties[j].si > si); return js.length ? Math.min(...js) : null; };
  for (const t of ties) { t.nextOf = new Map(t.teams.map(tm => [tm, nextTie(tm, t.si)])); }
  // her eşleşme için "kaynak" (hangi önceki eşleşmenin gerçek kazananı bu takım): prev[i] = Map(team -> tieIdx)
  const prev = ties.map(() => new Map());
  for (const t of ties) { const w = t.real.winner; const n = w != null ? nextTie(w, t.si) : null; if (n != null) prev[n].set(w, t.idx); }
  const firstSi = new Map();
  for (const t of ties) for (const tm of t.teams) if (!firstSi.has(tm) || t.si < firstSi.get(tm)) firstSi.set(tm, t.si);
  const groups = (tieSet.groups || []).map(g => {
    const table = computeTable(g.matches, { comp });
    return { ...g, table, entry: new Map(table.map(r => [r.id, firstSi.has(r.id) ? firstSi.get(r.id) : null])) };
  });
  return { ...tieSet, groups, prev, nextTie };
}

/**
 * Düzenlemeleri uygular; etkilenen eşleşmeleri Monte Carlo ile oynatır.
 * edits: Map<gameId,{hg,ag}>, pens: Map<tieKey, takımId>
 */
export function evaluate(R, { comp, season, edits, pens, startElo, n = 4000, seed = 21 }) {
  const { ties, prev } = R;
  // grup/lig aşaması değişiklikleri: gerçek sıradaki k. takımın yerine alternatif sıradaki k. takım geçer
  const sub = new Map(), groupAlt = [];
  for (const g of R.groups || []) {
    const alt = computeTable(applyEdits(g.matches, edits), { comp });
    groupAlt.push({ label: g.label, table: alt });
    g.table.forEach((r, k) => { const a = alt[k]; if (a && a.id !== r.id && g.entry.get(r.id) != null) sub.set(r.id, a.id); });
  }
  const E = t => startElo?.get?.(t) ?? 1450;
  const det = ties.map(t => {              // düzenlemeli deterministik sonuç
    const d = decide(t, edits, { comp, season, pen: pens.get(t.key) });
    let w = d.winner;
    const edited = t.matches.some(m => edits.has(m.id));
    if (w == null) w = edited ? (E(t.teams[0]) >= E(t.teams[1]) ? t.teams[0] : t.teams[1]) : t.real.winner;
    return { ...d, winner: w, edited, penDefault: d.winner == null };
  });
  const last = ties.length - 1;
  const champs = new Map(), reach = ties.map(() => new Map()), nSims = n;
  let anyAffected = false;
  for (let s = 0; s < nSims; s++) {
    const r = rng(seed * 7919 + s);
    const win = new Array(ties.length);
    const part = new Array(ties.length);
    for (let i = 0; i < ties.length; i++) {
      const t = ties[i];
      const p = t.teams.map(tm => { const from = prev[i].get(tm); return from == null ? (sub.get(tm) ?? tm) : win[from]; });
      part[i] = p;
      const same = p[0] === t.teams[0] && p[1] === t.teams[1];
      if (same) { win[i] = det[i].winner; }
      else {
        anyAffected = true;
        win[i] = simulateTie(t, p, { comp, season, E, r });
      }
      if (s < nSims) { const m = reach[i]; for (const tm of p) m.set(tm, (m.get(tm) || 0) + 1); }
    }
    const c = win[last]; champs.set(c, (champs.get(c) || 0) + 1);
  }
  return { det, champs: new Map([...champs].map(([k, v]) => [k, v / nSims])), reach: reach.map(m => new Map([...m].map(([k, v]) => [k, v / nSims]))), affected: anyAffected, n: nSims, sub, groupAlt };
}

function simulateTie(t, p, { comp, season, E, r }) {
  // p[0] ve p[1], gerçek eşleşmedeki teams[0] ve teams[1] yuvalarını doldurur; saha sırası korunur
  const slot = new Map([[t.teams[0], p[0]], [t.teams[1], p[1]]]);
  const g = new Map([[p[0], 0], [p[1], 0]]), away = new Map([[p[0], 0], [p[1], 0]]);
  const final = t.matches.length === 1 && /final/i.test(t.stage) && !/semi|quarter/i.test(t.stage);
  const legs = t.matches.filter(m => !/replay|decider/i.test(m.round || '')).slice(0, 2);
  for (const m of legs.length ? legs : t.matches.slice(0, 1)) {
    const h = slot.get(m.h), a = slot.get(m.a);
    const [lh, la] = lambdas(E(h), E(a), 2.6, final ? 0 : 60);
    const hg = poissonInv(lh, r()), ag = poissonInv(la, r());
    g.set(h, g.get(h) + hg); g.set(a, g.get(a) + ag); away.set(a, away.get(a) + ag);
  }
  const [x, y] = p;
  if (g.get(x) !== g.get(y)) return g.get(x) > g.get(y) ? x : y;
  if (UEFA_AWAY_GOALS.has(comp) && season <= 2020 && legs.length === 2 && away.get(x) !== away.get(y)) return away.get(x) > away.get(y) ? x : y;
  const [lx, ly] = lambdas(E(x), E(y), 2.6 / 3, 0);          // uzatma
  const ex = poissonInv(lx, r()), ey = poissonInv(ly, r());
  if (ex !== ey) return ex > ey ? x : y;
  const edge = Math.tanh((E(x) - E(y)) / 800) * 0.1;       // penaltılar: neredeyse yazı-tura
  return r() < 0.5 + edge ? x : y;
}

const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 };
/** Kaynaktaki İngilizce aşama adlarını Türkçeleştirir. */
export function trStage(s) {
  const t = String(s || '').trim();
  let m;
  if (/^(last 16|round of 16)$/i.test(t)) return tp('Son 16');
  if (/^round of 32$/i.test(t)) return tp('Son 32');
  if (/quarter/i.test(t)) return tp('Çeyrek final');
  if (/semi/i.test(t)) return tp('Yarı final');
  if (/^final$/i.test(t)) return tp('Final');
  if (/intermediate/i.test(t)) return tp('Ara tur');
  if (/^group stage$/i.test(t)) return tp('Lig aşaması');
  if ((m = t.match(/^group\s+(\w+)$/i))) return tp('{g} Grubu', { g: m[1].toUpperCase() });
  if (/qualifying round/i.test(t)) return tp('Play-off turu');
  if ((m = t.match(/^(\w+)\s+round$/i)) && ORD[m[1].toLowerCase()]) return tp('{n}. Tur', { n: ORD[m[1].toLowerCase()] });
  return t;
}
