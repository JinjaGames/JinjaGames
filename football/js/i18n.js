// TR / EN. Anahtar = Türkçe kaynak metin; Türkçe modunda olduğu gibi döner, İngilizce modunda sözlükten gelir.
//   t('Gol attın: {n}', { n: 3 })      → {ad} yer tutucuları doldurulur
//   Sözlük değeri dizi ise [tekil, çoğul] olarak seçilir ve p.n === 1 ise ilki kullanılır:
//     'maç': ['{n} match', '{n} matches']  →  t('{n} maç', { n })
// Dil tercihi sitenin geri kalanıyla aynı anahtarı kullanır (localStorage jg_lang).
const DICT_FILES = ['core', 'sim', 'views', 'news'];

function detect() {
  let l = null;
  try { l = localStorage.getItem('jg_lang'); } catch { /* özel mod */ }
  if (l !== 'tr' && l !== 'en') l = /^tr\b/i.test(navigator.language || (navigator.languages && navigator.languages[0]) || '') ? 'tr' : 'en';
  return l;
}

export let lang = detect();
export const isEn = () => lang === 'en';
export const LOC = lang === 'en' ? 'en-GB' : 'tr-TR';

const EN = Object.create(null);
if (lang === 'en') {
  // Yalnızca İngilizce modunda yüklenir. Eksik dosya sayfayı bozmaz.
  const mods = await Promise.all(DICT_FILES.map(f => import(`./i18n/en-${f}.js`).catch(() => ({ default: {} }))));
  for (const m of mods) Object.assign(EN, m.default);
}

const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] ?? m)) : s);
const warned = new Set();
export function t(key, p) {
  if (lang !== 'en') return fill(key, p);
  let v = EN[key];
  if (v == null) {
    if (!warned.has(key)) { warned.add(key); if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(key)) console.debug('[i18n] eksik çeviri:', key); }
    v = key;
  }
  if (Array.isArray(v)) v = p && p.n === 1 ? v[0] : v[1];
  return fill(v, p);
}

// Dil verisinden gelen (iki dilli) alanlar için kısayol: tl(tr, en)
export const tl = (tr, en) => (lang === 'en' ? en : tr);

export function setLang(l) {
  if (l !== 'tr' && l !== 'en') return;
  try { localStorage.setItem('jg_lang', l); } catch { /* özel mod */ }
  location.reload();
}

document.documentElement.lang = lang;
document.documentElement.setAttribute('data-lang', lang);

// Sayfa kabuğundaki (index.html) sabit metinler: data-i18n="anahtar" ve data-i18n-attr="öznitelik:anahtar"
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split('|')) { const i = pair.indexOf(':'); el.setAttribute(pair.slice(0, i), t(pair.slice(i + 1))); }
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
}
