// Veri katmanı: statik JSON parçalarını tembel yükler ve önbellekler.
const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(`data/${path}`, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }).catch(e => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}
const tryJSON = (p, fallback) => getJSON(p).catch(() => fallback);

export const MATCH_KEYS = ['id', 'date', 'round', 'h', 'a', 'hg', 'ag', 'hpos', 'apos', 'hform', 'aform', 'stadium', 'att', 'ref', 'hmgr', 'amgr', 'agg'];
const toMatch = r => { const m = {}; MATCH_KEYS.forEach((k, i) => (m[k] = r[i])); return m; };

import { lang } from './i18n.js';
import { countryEn, COMP_EN } from './nations.js';
// Yarışma adları ve ülkeleri veride Türkçe; İngilizce modda bir kez çevrilir.
let compsEn = null;
export const loadComps = async () => {
  const c = await getJSON('competitions.json');
  if (lang !== 'en') return c;
  if (!compsEn) compsEn = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { ...v, name: COMP_EN[v.name] || v.name, country: countryEn(v.country) }]));
  return compsEn;
};
export const loadClubs = () => getJSON('clubs.json');
export const loadMatchIndex = () => getJSON('match_index.json');

export async function loadMatches(comp, season) {
  const rows = await tryJSON(`matches/${comp}/${season}.json`, []);
  return rows.map(toMatch);
}

export const loadElo = async season => (await tryJSON(`elo/${season}.json`, null));
export const loadSquads = async season => {
  if (season >= CURRENT_SEASON) {   // güncel sezon: günlük kadro verisinden ({kulüp: [[oyuncu, değer]]})
    const c = await loadCurrent();
    return Object.fromEntries(Object.entries(c.clubs).map(([id, rows]) => [id, rows.map(p => [p.id || -p.e, p.v || 5e5]).sort((a, b) => b[1] - a[1]).slice(0, 45)]));
  }
  return tryJSON(`squads/${season}.json`, {});
};
export const loadTransfers = async season => {
  const rows = await tryJSON(`transfers/${season}.json`, []);
  return rows.map(r => ({ pid: r[0], date: r[1], from: r[2], to: r[3], fee: r[4], mv: r[5], det: r[6] === 1, season }));
};

const PKEYS = ['id', 'name', 'line', 'pos', 'dob', 'nat', 'club', 'value', 'peak', 'foot', 'height', 'contract', 'lastSeason', 'caps', 'img'];
let playersP;
export function loadPlayers() {
  return playersP ??= getJSON('players.json').then(rows => {
    const list = rows.map(r => { const p = {}; PKEYS.forEach((k, i) => (p[k] = r[i])); return p; });
    const byId = new Map(list.map(p => [p.id, p]));
    return { list, byId };
  });
}

export async function loadValuations(pid) {
  const shard = await tryJSON(`valuations/${pid % 32}.json`, {});
  return (shard[pid] || []).map(([mi, v, club]) => ({ mi, v, club }));
}

export async function loadIntl() {
  const rows = await getJSON('intl/matches.json');
  return rows.map(r => ({ date: r[0], h: r[1], a: r[2], hg: r[3], ag: r[4], tour: r[5], city: r[6], country: r[7], neutral: !!r[8], eh: r[9], ea: r[10], so: r[11] }));
}
export const loadIntlElo = () => getJSON('intl/elo_year_end.json');

/** Günlük güncellenen güncel kadrolar (ESPN) + sakatlıklar (FPL). { asOf, clubs:{id:[...]}, injuries } */
export const loadCurrent = () => tryJSON('current.json', { asOf: null, clubs: {}, injuries: 0 });
/** Teknik direktörler ve kulüp yönetimi. { asOf, m:{ad:[elo,maç,G,B,M,ppg,beklenenPpg,ilk,son,[kulüpler]]}, c:{kulüp:{cur,chair,ceo,own,hist}} } */
export const loadManagers = () => tryJSON('managers.json', { asOf: null, m: {}, c: {} });
/** Hocanın Elo farkı modele bu oranla yansır: kısmı şans, kısmı kadro/kulüp etkisi olduğundan düşürülür. */
export const MGR_DAMP = 0.8, MGR_CAP = 55;
export const mgrElo = (M, name) => { const r = M.m[name]?.[0]; return r == null ? 0 : r; };
/** Hoca değişikliğinin takım gücüne etkisi (Elo): yeni hoca − eski hoca, küçültülmüş. */
export const mgrDelta = (M, from, to) => Math.max(-MGR_CAP, Math.min(MGR_CAP, MGR_DAMP * (mgrElo(M, to) - mgrElo(M, from))));
export const mgrInfo = (M, name) => { const r = M.m[name]; return r && { name, elo: r[0], g: r[1], w: r[2], d: r[3], l: r[4], ppg: r[5], xppg: r[6], first: r[7], last: r[8], clubs: r[9], att: r[10] ?? r[0], def: r[11] ?? r[0], forms: r[12] || [] }; };
/** Hoca değişikliğinin takımın hücum ve savunma puanına etkisi (Elo, küçültülmüş): [hücum, savunma]. */
export const mgrAD = (M, from, to) => { const a = mgrInfo(M, from), b = mgrInfo(M, to); const f = (x, y) => Math.max(-MGR_CAP, Math.min(MGR_CAP, MGR_DAMP * ((y ?? 0) - (x ?? 0)))); return [f(a?.att ?? 0, b?.att ?? 0), f(a?.def ?? 0, b?.def ?? 0)]; };
/** Güncellemelerde fark edilen değişiklikler: { updated, prev, items:[[tarih, tür, kulüp, metin]] } */
export const loadChanges = () => tryJSON('changes.json', { updated: null, prev: null, items: [] });
/** Günün haberleri: indeks ve gün dosyası. */
export const loadNewsIndex = () => tryJSON('news/index.json', { asOf: null, days: [] });
export const loadNews = d => tryJSON(`news/${d}.json`, { d, leagues: [] });
/** Oyuncu kulüp dönemleri (takım kimyası): { oyuncu: [kulüp, başlangıç_ay, bitiş_ay, ...] } */
export const loadStints = () => tryJSON('stints.json', {});
export const loadUpcoming = () => tryJSON('upcoming.json', { fixtures: [], asOf: null });

// En güncel veri sezonu (ham veri bu sezonla bitiyor)
export const LAST_SEASON = 2025;
// Yaklaşan sezon (openfootball gibi kaynaklardan)
export const CURRENT_SEASON = 2026;

export const monthIdxToDate = mi => `${2000 + Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, '0')}`;
export const dateToMonthIdx = d => (+d.slice(0, 4) - 2000) * 12 + (+d.slice(5, 7) - 1);
export const seasonOfDate = d => (+d.slice(5, 7) >= 7 ? +d.slice(0, 4) : +d.slice(0, 4) - 1);
