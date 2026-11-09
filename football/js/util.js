// Küçük DOM ve biçimlendirme yardımcıları
import { lang, t } from './i18n.js';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mount(root, ...nodes) { root.replaceChildren(...nodes.flat().filter(Boolean)); return root; }

export function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 2600);
}

export const fmtMoney = (v, { sign = false } = {}) => {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '−' : (sign && v > 0 ? '+' : '');
  if (a >= 1e9) return `${s}€${(a / 1e9).toFixed(2)}${lang === 'en' ? 'B' : 'Mr'}`;
  if (a >= 1e6) return `${s}€${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.0', '')}M`;
  if (a >= 1e3) return `${s}€${Math.round(a / 1e3)}K`;
  return `${s}€${Math.round(a)}`;
};
export const fmtPct = (p, d = 0) => `${(p * 100).toFixed(d)}%`;
export const seasonLabel = s => `${s}/${String((s + 1) % 100).padStart(2, '0')}`;
export const MONTHS = lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export function fmtDate(d) { // YYYY-MM-DD -> 25 Eki 2015
  if (!d) return '';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${+dd} ${MONTHS[+m - 1]} ${y}`;
}
export const fmtDay = d => { const [, m, dd] = d.slice(0, 10).split('-'); return `${+dd} ${MONTHS[+m - 1]}`; };
export const ageOn = (dob, date = new Date()) => {
  if (!dob) return null;
  const b = new Date(dob), t = typeof date === 'string' ? new Date(date) : date;
  return Math.floor((t - b) / 31557600000);
};
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sum = a => a.reduce((s, x) => s + x, 0);
export const uid = () => Math.random().toString(36).slice(2, 9);

// Kulüp "arması": adından türeyen renk + baş harfler (gerçek amblem değil)
export function hue(str) { let x = 0; for (const c of String(str)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
export function crest(name, size = '') {
  const initials = String(name || '?').replace(/\b(FC|AFC|SK|FK|CF|AC|AS|SC|SV|1\.|de|la|the)\b/gi, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const el = h('span', { class: `crest ${size}`, 'aria-hidden': 'true' }, initials);
  el.style.background = `hsl(${hue(name)} 45% 68%)`;
  return el;
}

// debounce
export function debounce(fn, ms = 160) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Türkçe duyarlı arama normalizasyonu
export const norm = s => String(s ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9 ]/g, ' ');

// Basit SVG yardımcıları
export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

export function lineChart({ series, width = 640, height = 220, yFmt = v => v, xFmt = v => v, pad = { l: 62, r: 14, t: 12, b: 26 }, xTicks = 6 }) {
  const all = series.flatMap(s => s.pts);
  if (!all.length) return h('div', { class: 'empty' }, t('Veri yok'));
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const nonNeg = y0 >= 0;
  const padY = (y1 - y0) * 0.08; y0 -= padY; y1 += padY;
  if (nonNeg && y0 < 0) y0 = 0;
  const X = x => pad.l + (x1 === x0 ? .5 : (x - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const Y = y => pad.t + (1 - (y - y0) / (y1 - y0)) * (height - pad.t - pad.b);
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', width: '100%', role: 'img' });
  const g = svg('g', { class: 'grid' });
  for (let i = 0; i <= 4; i++) {
    const v = y0 + (y1 - y0) * i / 4, y = Y(v);
    g.append(svg('line', { x1: pad.l, x2: width - pad.r, y1: y, y2: y }), svg('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }, yFmt(v)));
  }
  for (let i = 0; i <= xTicks; i++) {
    const v = x0 + (x1 - x0) * i / xTicks;
    g.append(svg('text', { x: X(v), y: height - 6, 'text-anchor': 'middle' }, xFmt(v)));
  }
  root.append(g);
  for (const s of series) {
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    root.append(svg('path', { d, fill: 'none', stroke: s.color || 'var(--chalk)', 'stroke-width': s.w || 2, 'stroke-dasharray': s.dash || null, 'stroke-linejoin': 'round' }));
    if (s.markers) for (const p of s.pts) root.append(svg('circle', { cx: X(p[0]), cy: Y(p[1]), r: 2.6, fill: s.color || 'var(--chalk)' }));
  }
  return root;
}

// Adresler '#' içermez: /football/takim/123. u() uygulama içi yolu tam adrese çevirir.
export const BASE = '/football';
export const u = p => BASE + (!p || p === '/' ? '/' : (p[0] === '/' ? p : '/' + p));
export const go = (path, { replace = false, silent = false } = {}) => {
  const url = u(path);
  try { if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url); } catch { location.href = url; return; }
  if (!silent) dispatchEvent(new Event('wif:navigate'));
};
/** Uygulama içi yol (BASE olmadan): /takim/123 */
export const appPath = () => { const p = decodeURIComponent(location.pathname); return (p.startsWith(BASE) ? p.slice(BASE.length) : p) || '/'; };
export function setCrumbs(...parts) {
  const t = parts.map(p => (typeof p === 'string' ? p : p?.textContent || '')).filter(Boolean);
  document.title = t.length ? `${t.join(' · ')} — Jinja Football` : 'Jinja Football';
}

/** Basit çubuk grafik: data=[{label,value}] (negatifler aşağı), fmt: değer biçimleyici. */
export function barChart({ data, width = 640, height = 220, fmt = v => v, pos = 'var(--win)', neg = 'var(--loss)' }) {
  const pad = { l: 8, r: 8, t: 18, b: 26 };
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)));
  const hasNeg = data.some(d => d.value < 0);
  const zero = hasNeg ? pad.t + (height - pad.t - pad.b) / 2 : height - pad.b;
  const scale = (hasNeg ? (height - pad.t - pad.b) / 2 : height - pad.t - pad.b) / max;
  const bw = (width - pad.l - pad.r) / data.length;
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', width: '100%', role: 'img' });
  root.append(svg('line', { x1: pad.l, x2: width - pad.r, y1: zero, y2: zero, stroke: 'var(--line-2)' }));
  data.forEach((d, i) => {
    const hgt = Math.abs(d.value) * scale, x = pad.l + i * bw + bw * 0.18, y = d.value >= 0 ? zero - hgt : zero;
    root.append(svg('rect', { x, y, width: bw * 0.64, height: Math.max(1, hgt), rx: 4, fill: d.value >= 0 ? pos : neg }),
      svg('text', { x: x + bw * 0.32, y: height - 8, 'text-anchor': 'middle' }, d.label),
      svg('text', { x: x + bw * 0.32, y: d.value >= 0 ? y - 5 : y + hgt + 12, 'text-anchor': 'middle' }, fmt(d.value)));
  });
  return root;
}
