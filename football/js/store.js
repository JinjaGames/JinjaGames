// Senaryo deposu: what-if değişiklikleri GEÇİCİDİR. sessionStorage'da tutulur: sayfa yenilenince durur,
// sekme/site kapanınca silinir. Saklamak isteyen bağlantıyı kopyalar ya da dosya olarak dışa aktarır.
// Eski sürümün localStorage'da bıraktığı kalıcı kayıt bir kez temizlenir.
import { t } from './i18n.js';
import { uid } from './util.js';

const KEY = 'wif.v1';
let state = load();
const subs = new Set();

function load() {
  try {
    try { localStorage.removeItem(KEY); } catch { /* yok */ }
    const s = JSON.parse(sessionStorage.getItem(KEY));
    if (s && Array.isArray(s.scenarios)) return s;
  } catch { /* ilk açılış */ }
  return { scenarios: [], activeId: null };
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* özel pencere */ } subs.forEach(f => f()); }

export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const scenarios = () => state.scenarios;
export const active = () => state.scenarios.find(s => s.id === state.activeId) || null;

export function newScenario(name = t('Adsız senaryo')) {
  const s = { id: uid(), name, created: Date.now(), edits: [] };
  state.scenarios.unshift(s); state.activeId = s.id; save(); return s;
}
export function setActive(id) { state.activeId = id; save(); }
export function rename(id, name) { const s = state.scenarios.find(x => x.id === id); if (s) { s.name = name; save(); } }
export function remove(id) {
  state.scenarios = state.scenarios.filter(s => s.id !== id);
  if (state.activeId === id) state.activeId = state.scenarios[0]?.id ?? null;
  save();
}
export function clearEdits(id) { const s = state.scenarios.find(x => x.id === id); if (s) { s.edits = []; save(); } }

function pushEdit(s, edit) {
  // aynı maç / aynı oyuncu-sezon için eski düzenlemeyi değiştir
  s.edits = s.edits.filter(e => !(e.t === edit.t && ((e.t === 'result' && e.id === edit.id) || (e.t === 'transfer' && e.pid === edit.pid && e.season === edit.season) || (e.t === 'intl' && e.key === edit.key) || (e.t === 'pens' && e.key === edit.key && e.comp === edit.comp && e.season === edit.season))));
  s.edits.push({ ...edit, at: Date.now() });
}
export function addEdit(edit) { const s = active() || newScenario(); pushEdit(s, edit); save(); }
/** Çok sayıda düzenlemeyi tek kayıtta ekler (ör. kalan sezonu simüle etme). */
export function addEdits(list) { const s = active() || newScenario(); for (const e of list) pushEdit(s, e); save(); }
export function removeEdit(match) {
  const s = active(); if (!s) return;
  const i = s.edits.findIndex(e => match(e));
  if (i >= 0) { s.edits.splice(i, 1); save(); }
}
export function undo() { const s = active(); if (s?.edits.length) { s.edits.pop(); save(); } }

export const resultEdits = (comp, season) => {
  const m = new Map();
  for (const e of active()?.edits || []) if (e.t === 'result' && e.comp === comp && e.season === season) m.set(e.id, { hg: e.hg, ag: e.ag });
  return m;
};
export const penEdits = (comp, season) => { const m = new Map(); for (const e of active()?.edits || []) if (e.t === 'pens' && e.comp === comp && e.season === season) m.set(e.key, e.winner); return m; };
export const intlEdits = () => { const m = new Map(); for (const e of active()?.edits || []) if (e.t === 'intl') m.set(e.key, { hg: e.hg, ag: e.ag }); return m; };
export const transferEdits = season => (active()?.edits || []).filter(e => e.t === 'transfer' && (season == null || e.season === season));

export function exportJSON() { return JSON.stringify(state, null, 2); }
export function importJSON(txt) {
  const s = JSON.parse(txt);
  if (!s || !Array.isArray(s.scenarios)) throw new Error(t('Geçersiz dosya'));
  const ids = new Set(state.scenarios.map(x => x.id));
  for (const sc of s.scenarios) { if (ids.has(sc.id)) sc.id = uid(); state.scenarios.push(sc); }
  save();
}

// ---- küçük ayarlar (kontenjan üzerine yazma vb.) ------------------------------------
const PKEY = 'wif.prefs.v1';
let prefs = {};
try { prefs = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch { /* yok */ }
export const pref = (k, d) => (k in prefs ? prefs[k] : d);
export function setPref(k, v) { prefs[k] = v; try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch { /* yok */ } }
