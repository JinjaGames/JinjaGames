// Avrupa kontenjanları, küme düşme ve gelir tahmin varsayımları.
// UYARI: Bunlar tarihsel olarak yaklaşık değerlerdir (kupa kazananlarının devri, eleme turları, ligin sezon içi
// formatı vb. dikkate alınmaz). Arayüzde kullanıcı her sezon için üzerine yazabilir ve "tahmini" etiketi taşır.

import { t, tl } from './i18n.js';

/** @returns {{ucl:number, el:number, uecl:number, rel:number, note?:string}} sıralama sayıları (ucl: ilk N, el: sonraki N ...) */
const LOWER = { GB2: [2, 3], GB3: [2, 2], GB4: [3, 2], GB5: [1, 2], L2: [2, 2], SC2: [1, 1], SC3: [1, 1], SC4: [1, 1] };   // [yükselme, düşme]
export const PROMO_GAIN = { GB2: 100, GB3: 12, GB4: 3, GB5: 3, L2: 25, SC2: 3, SC3: 1, SC4: 0.5 };
export function defaultSlots(comp, season, nClubs) {
  if (LOWER[comp]) return { ucl: 0, el: 0, uecl: 0, promo: LOWER[comp][0], rel: LOWER[comp][1], note: t('Play-off ile yükselme sayılmaz.') };
  const relDefault = nClubs >= 20 ? 3 : nClubs >= 18 ? 2 : nClubs >= 14 ? 2 : 1;
  const modern = season >= 2021;
  const cfg = {
    GB1: { ucl: season >= 2025 ? 5 : 4, el: season >= 2025 ? 1 : 1, uecl: modern ? 1 : 0, rel: 3 },
    ES1: { ucl: season >= 2025 ? 5 : 4, el: 2, uecl: modern ? 1 : 0, rel: 3 },
    IT1: { ucl: season >= 2025 ? 5 : 4, el: modern ? 1 : 2, uecl: modern ? 1 : 0, rel: 3 },
    L1: { ucl: season >= 2025 ? 5 : 4, el: modern ? 1 : 2, uecl: modern ? 1 : 0, rel: 2, note: t('16. sıra: baraj (sayılmaz)') },
    FR1: { ucl: season >= 2024 ? 4 : 3, el: modern ? 1 : 2, uecl: modern ? 1 : 0, rel: nClubs <= 18 ? 3 : 2 },
    TR1: { ucl: 2, el: 1, uecl: 1, rel: nClubs >= 20 ? 4 : 3 },
    NL1: { ucl: 2, el: 1, uecl: 1, rel: 2 },
    PO1: { ucl: 2, el: 1, uecl: 1, rel: 2 },
    BE1: { ucl: 1, el: 1, uecl: 1, rel: 1 },
    SC1: { ucl: 1, el: 1, uecl: 1, rel: 1 },
    GR1: { ucl: 1, el: 1, uecl: 1, rel: 3 },
    RU1: { ucl: 2, el: 2, uecl: 0, rel: 2 },
    UKR1: { ucl: 2, el: 1, uecl: 1, rel: 2 },
  };
  const c = cfg[comp] || { ucl: 1, el: 1, uecl: 0, rel: relDefault };
  return { ...c };
}

/** Tahmini lig içi gelir eğrisi (milyon €): [1. sıra, son sıra] - yayın+ödül toplamı, kabaca son 5 sezonun ortalaması. */
export const DOMESTIC_REV = {
  GB1: [200, 135], ES1: [190, 55], IT1: [120, 35], L1: [105, 40], FR1: [95, 35], TR1: [48, 10],
  NL1: [30, 6], PO1: [40, 5], BE1: [25, 6], SC1: [18, 3], GR1: [14, 3], RU1: [20, 5], UKR1: [14, 3],
  DK1: [8, 3], C1: [8, 3], A1: [10, 4], PL1: [8, 2],
  GB2: [12, 6], GB3: [3, 1.5], GB4: [1.5, .8], GB5: [.8, .3], L2: [14, 6], SC2: [1.2, .5], SC3: [.5, .2], SC4: [.3, .1],
};
export const EURO_REV = { ucl: 55, el: 18, uecl: 9 };       // yaklaşık katılım + performans geliri (M€)
export const REL_COST = { GB1: 110, ES1: 70, IT1: 45, L1: 45, FR1: 35, TR1: 18, default: 8 };   // alt lige düşmenin gelir kaybı (M€)

export function domesticRevenue(comp, pos, n) {
  const [top, bot] = DOMESTIC_REV[comp] || [10, 2];
  const t = n > 1 ? (pos - 1) / (n - 1) : 0;
  return (top + (bot - top) * t) * 1e6;
}

/** Bir sıralamanın tahmini toplam gelir etkisi (€) ve kategorisi. */
export function positionOutcome(comp, pos, n, slots) {
  let tier = 'none';
  if (slots.promo && pos <= slots.promo) tier = 'promo';
  else if (pos <= slots.ucl) tier = 'ucl';
  else if (pos <= slots.ucl + slots.el) tier = 'el';
  else if (pos <= slots.ucl + slots.el + slots.uecl) tier = 'uecl';
  else if (pos > n - slots.rel) tier = 'rel';
  let rev = domesticRevenue(comp, pos, n);
  if (tier === 'promo') rev += (PROMO_GAIN[comp] ?? 5) * 1e6;
  else if (tier === 'ucl') rev += EURO_REV.ucl * 1e6;
  else if (tier === 'el') rev += EURO_REV.el * 1e6;
  else if (tier === 'uecl') rev += EURO_REV.uecl * 1e6;
  else if (tier === 'rel') rev -= (REL_COST[comp] ?? REL_COST.default) * 1e6;
  return { tier, revenue: rev };
}

export const TIER_LABEL = { promo: t('Yükselme'), ucl: t('Şampiyonlar Ligi'), el: t('Avrupa Ligi'), uecl: t('Konferans Ligi'), rel: t('Küme düşme'), none: tl('—', '-') };
export const TIER_SHORT = { promo: tl('YK', 'PRO'), ucl: tl('ŞL', 'CL'), el: tl('AL', 'EL'), uecl: tl('KL', 'ECL'), rel: tl('KD', 'REL'), none: '' };
export const TIER_COLOR = { promo: 'var(--win)', ucl: 'var(--ucl)', el: 'var(--el)', uecl: 'var(--uecl)', rel: 'var(--rel)', none: 'transparent' };

/** UEFA kupalarında tura çıkma başına yaklaşık prim (M€, 2018-24 ortalaması). Anahtar: aşama adı (küçük harf). */
export const CUP_PRIZE = {
  CL: { 'intermediate stage': 0, 'last 16': 9.5, 'quarter-finals': 10.5, 'semi-finals': 12.5, final: 15.5, champion: 4.5 },
  EL: { 'intermediate stage': 0.6, 'last 16': 1.1, 'quarter-finals': 1.5, 'semi-finals': 2.4, final: 4.5, champion: 4 },
  UCOL: { 'intermediate stage': 0.3, 'last 16': 0.6, 'quarter-finals': 1, 'semi-finals': 1.6, final: 3, champion: 2.5 },
};
