import { $, h, mount, toast, u, go, appPath, BASE } from './util.js';
import * as store from './store.js';
import { openPalette, openHelp, copyShareLink } from './palette.js';
import { icon } from './icons.js';
import { logoSvg, spinLogo } from './logo.js';
import { t, lang, setLang, applyStatic } from './i18n.js';
export { icon };


const NAV = [
  ['/', t('Ana sayfa'), 'home'],
  ['/degistir', t('Geçmişi değiştir'), 'edit'],
  ['/simulator', t('Maç oyna'), 'sim'],
  ['/haberler', t('Haberler'), 'news'],
  ['/takimlar', t('Takımlar'), 'shield'],
  ['/oyuncular', t('Oyuncular'), 'players'],
];
const SECTION = [
  [/^\/(degistir|lig|kupa|transfer)/, '/degistir'], [/^\/simulator/, '/simulator'], [/^\/haberler/, '/haberler'], [/^\/(takim|takimlar|milli|hocalar)/, '/takimlar'], [/^\/oyuncu/, '/oyuncular'],
];

const ROUTES = [
  [/^\/?$/, () => import('./views/home.js')],
  [/^\/degistir$/, () => import('./views/hub.js')],
  [/^\/takimlar$/, () => import('./views/teams.js')],
  [/^\/hocalar$/, () => import('./views/managers.js')],
  [/^\/veri$/, () => import('./views/about.js')],
  [/^\/haberler(?:\/(\d{4}-\d{2}-\d{2}))?$/, () => import('./views/news.js')],
  [/^\/lig(?:\/([^/]+))?(?:\/(\d{4}))?$/, () => import('./views/league.js')],
  [/^\/kupa(?:\/([^/]+))?(?:\/(\d{4}))?$/, () => import('./views/cup.js')],
  [/^\/takim\/(\d+)(?:\/(\d{4}|now))?(?:\/([a-z]+))?$/, () => import('./views/team.js')],
  [/^\/oyuncular$/, () => import('./views/players.js')],
  [/^\/oyuncu\/(\d+)$/, () => import('./views/player.js')],
  [/^\/transfer(?:\/(\d{4}))?$/, () => import('./views/transfer.js')],
  [/^\/simulator(?:\/(.*))?$/, () => import('./views/simulator.js')],
  [/^\/milli(?:\/(.+))?$/, () => import('./views/national.js')],
  [/^\/paylas\/(.+)$/, () => import('./views/share.js')],
  [/^\/senaryolar$/, () => import('./views/scenarios.js')],
];

let navToken = 0;
async function route() {
  const path = appPath().replace(/\/+$/, '') || '/';
  const token = ++navToken;
  const app = $('#app');
  renderNav(path);
  for (const [re, loader] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    app.replaceChildren(h('div', { class: 'skel', style: 'width:260px;height:34px;margin-bottom:20px' }), h('div', { class: 'skel', style: 'height:320px;border-radius:18px' }));
    try {
      const mod = await loader();
      if (token !== navToken) return;
      const view = await mod.render(app, ...m.slice(1));
      if (token !== navToken) return;
      scrollTo({ top: 0 });
      return view;
    } catch (e) {
      console.error(e);
      if (token === navToken) mount(app, h('div', { class: 'empty' }, h('h3', null, t('Bu ekran yüklenemedi')), h('div', null, String(e.message || e)), h('a', { class: 'btn', href: u('/') }, t('Ana sayfaya dön'))));
      return;
    }
  }
  mount(app, h('div', { class: 'empty' }, h('h3', null, t('Sayfa bulunamadı')), h('a', { class: 'btn primary', href: u('/') }, t('Ana sayfaya dön'))));
}

function currentSection(path) {
  if (path === '/') return '/';
  for (const [re, p] of SECTION) if (re.test(path)) return p;
  return null;
}

// Menüde sığmayanlar "Daha fazla"ya taşınır (ölçerek). Telefonda alt çubukta 4 sekme + Menü.
const EXTRA = [
  ['/hocalar', t('Teknik direktörler'), 'manager'],
  ['/milli', t('Milli takımlar'), 'globe'],
  ['/senaryolar', t('Senaryolarım'), 'edit'],
  ['/veri', t('Veri kaynakları'), 'table'],
];
const JG_MARK = '<img src="/favicon-j-shuriken-32.png" width="20" height="20" alt="">';
let closeMenu = () => {};

function menuPanel(cur, items, { title } = {}) {
  const row = ([p, label, ic]) => h('a', { class: 'mm-i', href: u(p), 'aria-current': p === cur ? 'page' : null, html: `${icon(ic)}<span>${label}</span>` });
  return h('div', { class: 'mm-panel', role: 'menu', 'aria-label': title || t('Diğer sayfalar') },
    items.length ? h('div', { class: 'mm-grp' }, items.map(row)) : null,
    h('div', { class: 'mm-grp' }, EXTRA.map(row)),
    h('div', { class: 'mm-grp mm-out' },
      h('a', { class: 'mm-i', href: '/', html: `${JG_MARK}<span>${t('JinjaGames ana sayfa')}</span>` }),
      h('a', { class: 'mm-i', href: '/apps/', html: `${icon('spark')}<span>${t('Diğer web uygulamaları')}</span>` })));
}

function openMenu(btn, panelFactory) {
  closeMenu();
  const panel = panelFactory();
  const wrap = h('div', { class: 'mm-wrap' }, panel);
  document.body.append(wrap);
  const r = btn.getBoundingClientRect();
  if (innerWidth > 820) { panel.style.top = `${Math.round(r.bottom + 8)}px`; panel.style.left = `${Math.round(Math.min(innerWidth - 292, Math.max(12, r.right - 280)))}px`; }
  else wrap.classList.add('sheet-mode');
  btn.setAttribute('aria-expanded', 'true');
  const onKey = e => { if (e.key === 'Escape') { closeMenu(); btn.focus(); } };
  const onDown = e => { if (!panel.contains(e.target) && !btn.contains(e.target)) closeMenu(); };
  setTimeout(() => { addEventListener('pointerdown', onDown); }, 0);
  addEventListener('keydown', onKey);
  panel.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  panel.querySelector('a')?.focus({ preventScroll: true });
  closeMenu = () => { wrap.remove(); btn.setAttribute('aria-expanded', 'false'); removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); closeMenu = () => {}; };
}

function fitNav(nav, more) {
  const links = [...nav.querySelectorAll(':scope > a')];
  links.forEach(a => { a.hidden = false; });
  more.hidden = true;
  const wrap = nav.parentElement, gap = 4;
  const widths = links.map(a => a.offsetWidth + gap);
  const total = widths.reduce((x, y) => x + y, 0);
  if (total <= wrap.clientWidth) return [];
  more.hidden = false;
  let avail = wrap.clientWidth - more.offsetWidth - gap * 2;
  const curIdx = links.findIndex(a => a.getAttribute('aria-current') === 'page');
  if (curIdx > 0) avail -= widths[curIdx];
  const hidden = [];
  links.forEach((a, i) => {
    if (i === curIdx) return;
    if (widths[i] <= avail) avail -= widths[i]; else { a.hidden = true; hidden.push(i); avail = -1; }
  });
  return hidden;
}

let navRO = null;
let introDone = false; // logo yalnızca ilk açılışta "fırlatılarak" gelir
addEventListener('jf:goal', () => spinLogo());
function renderNav(path) {
  closeMenu();
  const cur = currentSection(path);
  const link = ([p, label, ic]) => h('a', { href: u(p), 'aria-current': p === cur ? 'page' : null, html: `${icon(ic)}<span>${label}</span>` });
  const s = store.active(), n = s?.edits.length || 0;
  const dark = document.documentElement.dataset.theme === 'dark';
  let hiddenIdx = [];
  const more = h('button', { class: 'nav-more', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', html: `<span>${t('Daha fazla')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
    onclick: e => { if (e.currentTarget.getAttribute('aria-expanded') === 'true') return closeMenu(); openMenu(e.currentTarget, () => menuPanel(cur, hiddenIdx.map(i => TOP[i]))); } });
  const TOP = NAV.slice(1); // marka zaten ana sayfaya gider
  const nav = h('nav', { class: 'nav', 'aria-label': t('Ana gezinti') }, TOP.map(link));
  $('#topbar').replaceChildren(
    h('a', { class: 'jg-home', href: '/', title: t('JinjaGames ana sayfasına dön'), 'aria-label': t('JinjaGames ana sayfasına dön'), html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>${JG_MARK}` }),
    h('a', { class: 'brand', href: u('/'), 'aria-label': t('Jinja Football ana sayfa'), html: `${logoSvg()}<span lang="en">Jinja <b>Football</b></span>`, onmouseenter: e => { if (introDone) e.currentTarget.querySelector('.jf-logo')?.classList.add('hov'); }, onanimationend: e => e.target.closest?.('.jf-logo')?.classList.remove('hov', 'kick', 'intro') }),

    h('div', { class: 'nav-wrap' }, nav, more),
    h('div', { class: 'top-right' },
      h('button', { class: 'search-btn', onclick: openPalette, 'aria-label': t('Ara'), title: t('Ara (Ctrl K)'), html: `${icon('search')}<span class="tx">${t('Takım, oyuncu, lig ara…')}</span><kbd>Ctrl K</kbd>` }),
      n ? h('button', { class: 'icon-btn', title: t('Son değişikliği geri al'), 'aria-label': t('Geri al'), html: icon('undo'), onclick: () => { store.undo(); toast(t('Son değişiklik geri alındı')); } }) : null,
      n ? h('button', { class: 'icon-btn', title: t('Senaryo bağlantısını kopyala'), 'aria-label': t('Paylaş'), html: icon('share'), onclick: () => copyShareLink(s) }) : null,
      h('a', { class: `scn-pill ${n ? 'live' : ''}`, href: u('/senaryolar'), title: t('Senaryolarım (sekme kapanınca silinir)') }, n ? [h('span', { class: 'nm' }, s.name), h('b', null, t('{n} değişiklik', { n }))] : t('Senaryolarım')),
      h('button', { class: 'icon-btn help-btn', title: t('Nasıl kullanılır?'), 'aria-label': t('Yardım'), onclick: openHelp }, '?'),
      h('button', { class: 'icon-btn lang-btn', type: 'button', lang: lang === 'tr' ? 'en' : 'tr', title: t('Dili değiştir (TR / EN)'), 'aria-label': t('Dili değiştir (TR / EN)'), onclick: () => setLang(lang === 'tr' ? 'en' : 'tr') }, lang === 'tr' ? 'EN' : 'TR'),
      h('button', { class: 'icon-btn', title: dark ? t('Açık tema') : t('Koyu tema'), 'aria-label': t('Temayı değiştir'), html: icon(dark ? 'sun' : 'moon'), onclick: toggleTheme }),
    ),
  );
  if (!introDone) { $('#topbar .jf-logo')?.classList.add('intro'); setTimeout(() => { introDone = true; }, 1300); }
  const refit = () => { hiddenIdx = fitNav(nav, more); };
  navRO?.disconnect(); navRO = new ResizeObserver(refit); navRO.observe(nav.parentElement);
  document.fonts?.ready.then(refit); refit();
  const DOCK = NAV.slice(0, 4);
  const menuBtn = h('button', { class: `dock-more ${DOCK.some(([p]) => p === cur) ? '' : 'on'}`, type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>${t('Menü')}</span>`,
    onclick: e => { if (e.currentTarget.getAttribute('aria-expanded') === 'true') return closeMenu(); openMenu(e.currentTarget, () => menuPanel(cur, NAV.slice(4), { title: t('Menü') })); } });
  $('#dock').replaceChildren(...DOCK.map(link), menuBtn);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('wif.theme', next); } catch { /* yok */ }
  renderNav(appPath());
}

store.subscribe(() => renderNav(appPath()));

// ---- adres çubuğu: '#' yok. Eski #/… bağlantıları ve 404.html'in ?r= yönlendirmesi temiz yola çevrilir.
(function normalizeUrl() {
  const q = new URLSearchParams(location.search);
  const r = q.get('r');
  if (r && r.startsWith('/')) { history.replaceState(null, '', BASE + r); return; }
  if (location.hash.startsWith('#/')) history.replaceState(null, '', BASE + location.hash.slice(1));
})();
let lastPath = location.pathname;
const navigate = () => { lastPath = location.pathname; route(); };
addEventListener('popstate', () => { if (location.pathname !== lastPath) navigate(); });
addEventListener('wif:navigate', navigate);
// Aynı sekmede açılan uygulama içi bağlantılar sayfayı yeniden yüklemez.
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href]');
  if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !(url.pathname === BASE + '/' || url.pathname.startsWith(BASE + '/'))) return;
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return; // dosya bağlantıları (json, png…)
  e.preventDefault();
  if (url.pathname + url.search === location.pathname + location.search) { if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }); return; }
  history.pushState(null, '', url.pathname + url.search);
  navigate();
});
applyStatic();
route();

addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
});
try { if (!localStorage.getItem('wif.seenHelp')) { localStorage.setItem('wif.seenHelp', '1'); setTimeout(openHelp, 800); } } catch { /* yok */ }

// 3D eğilen kartlar: imleç konumuna göre hafif perspektif ve ışık
document.addEventListener('pointermove', e => {
  const t = e.target.closest?.('.tile'); if (!t || e.pointerType === 'touch') return;
  const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  t.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`); t.style.setProperty('--rx', `${(-(y - 0.5) * 9).toFixed(2)}deg`);
  t.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`); t.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
});
document.addEventListener('pointerout', e => { const t = e.target.closest?.('.tile'); if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); } });
