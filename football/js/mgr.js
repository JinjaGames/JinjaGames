// Teknik direktör yardımcıları: puan rozeti, seçim penceresi, sezonun hocası.
import { h, fmtDate } from './util.js';
import { t, tl } from './i18n.js';
import { pick } from './ui.js';
import { mgrInfo, MGR_DAMP } from './data.js';

export const eloText = r => `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
const TIP = t('Hoca puanı (net etki): hocanın kulüpten bağımsız olarak, kadro değerine göre beklenenin üstünde attığı ve altında yediği gol farkının Elo karşılığı. Kulüp etkisi ayrıştırılır, az maçlı hocalar ortalamaya çekilir, eski maçlar daha az sayılır. Modele %80’i yansır.');
export const eloChip = (r, { label = 'Elo' } = {}) => h('span', { class: `chip ${r >= 8 ? 'uecl' : r <= -8 ? 'rel' : ''}`, title: TIP }, `${eloText(r)} ${label}`);

/** Kısa görev (vekil) mi? */
export const isCaretaker = games => games <= 6;

/** Bir sezonda kulübün en çok maça çıkan hocası (maç verisindeki hmgr/amgr alanlarından). */
export function seasonManager(matches, clubId) {
  const cnt = new Map();
  for (const m of matches) {
    const n = m.h === clubId ? m.hmgr : m.a === clubId ? m.amgr : null;
    if (n) cnt.set(n, (cnt.get(n) || 0) + 1);
  }
  return [...cnt].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/** Aranabilir hoca seçimi: yalnızca değerlendirilebilecek kadar maçı olanlar. */
export async function pickManager(ctx, M, { title = t('Teknik direktör seç'), exclude = null, minGames = 40 } = {}) {
  const items = Object.entries(M.m).filter(([n, r]) => r[1] >= minGames && n !== exclude)
    .sort((a, b) => b[1][8].localeCompare(a[1][8]) || b[1][1] - a[1][1])
    .map(([n, r]) => {
      const last = r[9].map(c => ctx.clubs[c] && ctx.clubName(c)).find(Boolean);
      return { id: n, label: n, sub: `${last || ''} · ${r[7].slice(0, 4)}${tl('–', '-')}${r[8].slice(0, 4)} · ${t('{n} maç', { n: r[1] })}`, right: eloText(r[0]) };
    });
  return pick({ title, items, placeholder: t('Hoca ara… (ör. Mourinho)'), limit: 100 });
}

/** Hocanın kısa künyesi: "Okan Buruk · 390 maç · 1,78 PPG". */
export function mgrLine(M, name) {
  const i = mgrInfo(M, name);
  return i ? t('{n} maç · {ppg} puan/maç', { n: i.g, ppg: i.ppg.toFixed(2) }) : t('veri yok');
}
export const dampPct = Math.round(MGR_DAMP * 100);
export { fmtDate };
