// Form ve oyun tarzı: bir kulübün oynanmış maçlarından sezon içi güç gelişimi, son maç formu ve hücum/savunma eğilimi.
// Hepsi tarayıcıda, sitedeki maç verisinden hesaplanır (ek veri gerekmez); güncel sezon her gece yeni maçlarla büyür.
import { loadMatches, loadElo, CURRENT_SEASON } from './data.js';
import { lambdas, eloUpdate, winProbs, leagueTotal } from './engine.js';
import { clamp } from './util.js';
import { t as tp } from './i18n.js';

export const GOAL_ELO = 362;            // 1 gol/maç ≈ 362 Elo (engine.lambdas ile tutarlı)
const SHRINK_N = 14;                    // tarz tahmini için "ortalama takım" önsel maç sayısı
const FORM_N = 6;                       // son 6 maç

/** Bir lig-sezonunu başından oynatır: her maçtan önceki Elo ile beklenen gol/puan, kulüp için artıklar. */
async function replaySeason(comp, year, clubId) {
  const ms = (await loadMatches(comp, year)).filter(m => m.hg != null).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (!ms.length) return null;
  const startRaw = (await loadElo(year)) || {};
  const r = new Map(Object.entries(startRaw).map(([k, v]) => [+k, v]));
  const total = leagueTotal(ms), get = id => r.get(id) ?? 1450, rows = [];
  for (const m of ms) {
    const rh = get(m.h), ra = get(m.a);
    if (m.h === clubId || m.a === clubId) {
      const home = m.h === clubId, [lh, la] = lambdas(rh, ra, total), wp = winProbs(rh, ra, total);
      const own = home ? m.hg : m.ag, opp = home ? m.ag : m.hg, lo = home ? lh : la, lp = home ? la : lh;
      const pw = home ? wp.w : wp.l, pd = wp.d;
      rows.push({ date: m.date, res: own > opp ? 'W' : own === opp ? 'D' : 'L', pts: own > opp ? 3 : own === opp ? 1 : 0, xpts: 3 * pw + pd, att: own - lo, def: lp - opp, tot: own + opp, gf: own, ga: opp });
    }
    const d = eloUpdate(rh, ra, m.hg, m.ag);
    r.set(m.h, rh + d); r.set(m.a, ra - d);
  }
  return { rows, total, final: r, start: startRaw };
}

/**
 * @returns {null | { elo0, elo1, form, last, tilt, tot, lgTot, gf, ga, n, played, label }}
 *  elo0/elo1: sezon başı ve oynanan maçlardan sonraki Elo (yalnızca güncel sezonda farklıdır)
 *  form: son maç formunun Elo karşılığı (±25) · tilt: hücum−savunma eğilimi (gol/maç) · tot: bu takımın maçlarında beklenen toplam gol
 */
export async function teamContext(ctx, clubId, season, NOW) {
  const comp = ctx.clubs[clubId]?.c;
  if (!comp || ctx.comps[comp]?.type !== 'league') return null;
  const isNow = season === NOW, Y = isNow ? CURRENT_SEASON : season;
  const [cur, prev] = await Promise.all([isNow ? replaySeason(comp, Y, clubId) : null, replaySeason(comp, Y - 1, clubId)]);
  if (!cur && !prev) return null;
  const elo0 = cur?.start?.[clubId] ?? null, elo1 = cur ? (cur.final.get(clubId) ?? elo0) : elo0;
  // tarz: geçen sezon yarı, bu sezon tam ağırlıkla
  let w = 0, a = 0, d = 0, t = 0, gf = 0, ga = 0;
  const add = (rows, wt) => { for (const x of rows) { w += wt; a += wt * x.att; d += wt * x.def; t += wt * x.tot; gf += wt * x.gf; ga += wt * x.ga; } };
  if (prev) add(prev.rows, 0.5);
  if (cur) add(cur.rows, 1);
  const lgTot = cur?.total ?? prev?.total ?? 2.65;
  const k = w / (w + SHRINK_N);
  const attDev = w ? k * a / w : 0, defDev = w ? k * d / w : 0;
  const tilt = (attDev - defDev) / 2;                       // + hücum ağırlıklı, − savunma ağırlıklı (toplam güç değişmez)
  const tot = (t + SHRINK_N * lgTot) / (w + SHRINK_N);
  // son maç formu (yalnızca güncel sezon)
  const last = (cur?.rows || []).slice(-FORM_N);
  let fw = 0, fs = 0;
  last.forEach((x, i) => { const wt = 0.5 + 0.5 * (i + 1) / last.length; fw += wt; fs += wt * (x.pts - x.xpts); });
  const form = last.length ? clamp(40 * (fs / fw) * last.length / (last.length + 3), -25, 25) : 0;
  const lab = [];
  if (tilt > 0.1) lab.push(tp('hücum ağırlıklı')); else if (tilt < -0.1) lab.push(tp('savunma ağırlıklı'));
  if (tot > lgTot * 1.08) lab.push(tp('açık oyun')); else if (tot < lgTot * 0.92) lab.push(tp('kapalı oyun'));
  return {
    elo0, elo1, form, last: last.map(x => x.res), tilt, tot, lgTot, n: w, played: cur?.rows.length || 0,
    gf: w ? gf / w : null, ga: w ? ga / w : null, label: lab.length ? lab.join(', ') : tp('dengeli'),
  };
}
