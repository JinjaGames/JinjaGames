// Ortak arayüz parçaları ve uygulama bağlamı (ctx).
import { t } from './i18n.js';
import { h, crest, norm, debounce, esc, fmtMoney, u } from './util.js';
import { loadComps, loadClubs, loadMatchIndex } from './data.js';

let ctxP;
export function boot() {
  return ctxP ??= Promise.all([loadComps(), loadClubs(), loadMatchIndex()]).then(([comps, clubs, idx]) => {
    const ctx = { comps, clubs, idx };
    const CLEAN = /(S\.p\.A\.|Football Club|Associazione Sportiva|Società Sportiva|Unione Sportiva|Calcio|Club de Fútbol|Real Club Deportivo|Sporting Club)/gi;
    ctx.clubName = id => (clubs[id]?.n ?? `#${id}`).replace(/\s*\(.*?\)\s*$/, '').replace(CLEAN, ' ').replace(/\s+\d{4}\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    ctx.compName = c => comps[c]?.name ?? c;
    ctx.compFull = c => { const m = comps[c]; return m ? (m.country && m.type === 'league' ? `${m.name} · ${m.country}` : m.name) : c; };
    return ctx;
  });
}

/** Armayı (varsa TheSportsDB'den) gösterir; yoksa ya da yüklenemezse addan türeyen baş harf rozeti. */
export function crestFor(ctx, id, size = '') {
  const name = ctx.clubName(id), b = ctx.clubs[id]?.b;
  const fallback = crest(name, size);
  // önce Transfermarkt arması, olmazsa TheSportsDB arması, olmazsa baş harf rozeti
  const srcs = [id > 0 ? `https://tmssl.akamaized.net/images/wappen/head/${id}.png` : null, b ? `${b}/${size ? 'small' : 'tiny'}` : null].filter(Boolean);
  if (!srcs.length) return fallback;
  let i = 0;
  const img = h('img', { class: `crest img ${size}`, src: srcs[0], alt: name, loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => { i++; if (i < srcs.length) img.src = srcs[i]; else img.replaceWith(fallback); });
  return img;
}

/** Oyuncu fotoğrafı (Transfermarkt; yoksa ESPN; yoksa baş harfler). p: { name, img?, esp? } size: '' | 'sm' | 'lg' | 'xl' */
export function avatar(p, size = '') {
  const initials = String(p?.name || '?').split(/\s+/).filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase();
  const el = h('span', { class: `avatar ${size}`, 'aria-hidden': 'true' }, initials);
  const srcs = [p?.img ? `https://img.a.transfermarkt.technology/portrait/header/${p.img}` : null, p?.esp ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.esp}.png` : null].filter(Boolean);
  if (!srcs.length) return el;
  let i = 0;
  const img = h('img', { src: srcs[0], alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => { i++; if (i < srcs.length) img.src = srcs[i]; else img.remove(); });
  el.append(img);
  return el;
}

export function teamLink(ctx, id, season, { nameOnly = false } = {}) {
  const name = ctx.clubName(id);
  const kids = nameOnly ? [h('span', null, name)] : [crestFor(ctx, id), h('span', null, name)];
  return h('a', { class: 'team', href: u(`/takim/${id}${season != null ? '/' + season : ''}`) }, ...kids);
}

export function delta(n, { digits = 0, suffix = '', invert = false } = {}) {
  if (n == null || isNaN(n)) return h('span', { class: 'delta eq' }, '—');
  const r = +n.toFixed(digits);
  if (r === 0) return h('span', { class: 'delta eq' }, '0' + suffix);
  const good = invert ? r < 0 : r > 0;
  return h('span', { class: `delta ${good ? 'up' : 'dn'}` }, (r > 0 ? '+' : '−') + Math.abs(r).toFixed(digits) + suffix);
}
export const moneyDelta = v => {
  if (v == null || !isFinite(v)) return h('span', { class: 'delta eq' }, '—');
  if (Math.abs(v) < 5e4) return h('span', { class: 'delta eq' }, '€0');
  return h('span', { class: `delta ${v > 0 ? 'up' : 'dn'}` }, fmtMoney(v, { sign: true }));
};

export function formStrip(results = []) {
  return h('span', { class: 'form' }, results.map(r => h('i', { class: r, title: { W: t('Galibiyet'), D: t('Beraberlik'), L: t('Mağlubiyet') }[r] }, { W: t('G'), D: t('B'), L: t('M') }[r])));
}

export function seg(options, value, onchange, cls = '') {
  const wrap = h('div', { class: `seg ${cls}`, role: 'group' });
  for (const [v, label] of options) {
    wrap.append(h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { [...wrap.children].forEach(b => b.setAttribute('aria-pressed', 'false')); wrap.children[options.findIndex(o => o[0] === v)].setAttribute('aria-pressed', 'true'); onchange(v); } }, label));
  }
  return wrap;
}

export function select(options, value, onchange, attrs = {}) {
  const el = h('select', { ...attrs, onchange: e => onchange(e.target.value) },
    options.map(o => (o.group ? h('optgroup', { label: o.group }, o.items.map(i => h('option', { value: i[0], selected: String(i[0]) === String(value) }, i[1]))) : h('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1]))));
  return el;
}

export function field(label, control) { return h('label', { class: 'lbl' }, h('span', null, label), control); }

/** Aranabilir seçim penceresi. items: [{id,label,sub,tag}] — Promise<id|null> döner */
export function pick({ title, items, placeholder = 'Ara…', limit = 80 }) {
  return new Promise(resolve => {
    const dlg = h('dialog', { 'aria-label': title });
    const list = h('div', { class: 'pop-list' });
    const input = h('input', { type: 'search', placeholder, style: 'width:100%', autocomplete: 'off' });
    const pre = items.map(i => ({ ...i, key: norm(i.label + ' ' + (i.sub || '')) }));
    const draw = () => {
      const q = norm(input.value).trim();
      const hit = (q ? pre.filter(i => q.split(' ').every(t => i.key.includes(t))) : pre).slice(0, limit);
      list.replaceChildren(...(hit.length ? hit.map(i => h('button', { class: 'pl', style: 'grid-template-columns:34px minmax(0,1fr) auto', onclick: () => close(i.id) },
        i.tag ? h('span', { class: `p ${i.tagCls || ''}` }, i.tag) : h('span'), h('span', null, i.label, i.sub ? h('span', { class: 'dim' }, '  ' + i.sub) : null), h('span', { class: 'mute' }, i.right || ''))) : [h('div', { class: 'empty' }, t('Sonuç yok'))]));
    };
    const close = v => { dlg.close(); dlg.remove(); resolve(v); };
    input.addEventListener('input', debounce(draw, 80));
    dlg.addEventListener('cancel', () => { dlg.remove(); resolve(null); });
    dlg.append(h('div', { class: 'hd', style: 'display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)' }, h('h3', { style: 'font-size:18px;text-transform:uppercase;letter-spacing:.06em;flex:1' }, title), h('button', { class: 'btn sm ghost', onclick: () => close(null) }, t('Kapat'))),
      h('div', { style: 'padding:10px 14px' }, input), list);
    document.body.append(dlg); draw(); dlg.showModal(); input.focus();
  });
}

export function clubItems(ctx, ids, extra) {
  return ids.map(id => ({ id, label: ctx.clubName(id), sub: ctx.comps[ctx.clubs[id]?.c]?.country || '', right: extra?.(id) || '' }));
}

export const POS_LABEL = { G: t('KL'), D: t('DF'), M: t('OS'), A: t('FV') };
export const POS_LONG = { G: t('Kaleci'), D: t('Defans'), M: t('Orta saha'), A: t('Forvet') };

export function emptyState(title, text, action) {
  return h('div', { class: 'empty' }, h('h3', null, title), text ? h('div', null, text) : null, action || null);
}
export function pageHead(title, sub, ...actions) {
  return h('div', { class: 'page-h' }, h('div', null, h('h1', null, title), sub ? h('div', { class: 'sub' }, sub) : null), h('div', { class: 'sp' }), ...actions);
}
export function sheet(title, body, { tight = false, actions = [] } = {}) {
  return h('section', { class: `sheet ${tight ? 'tight' : ''}` },
    title ? h('div', { class: 'hd' }, typeof title === 'string' ? h('h2', null, title) : title, h('div', { class: 'sp' }), ...actions) : null,
    h('div', { class: 'bd' }, body));
}
export { esc };
