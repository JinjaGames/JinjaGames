// Günün haberleri: her lig için biten maçlar, skorlar; maça tıklayınca dakika dakika olaylar (gol türü, penaltı, kartlar).
import { h, mount, setCrumbs, crest, norm, debounce, u } from '../util.js';
import { boot, pageHead, crestFor } from '../ui.js';
import { loadNewsIndex, loadNews } from '../data.js';
import { icon } from '../icons.js';
import { t, tl, LOC } from '../i18n.js';

const EV = {
  g: ['ball', tl('Gol', 'Goal')], h: ['ball', t('Kafa golü')], v: ['ball', t('Röveşata golü')], f: ['ball', t('Frikik golü')], p: ['penalty', t('Penaltıdan gol')],
  o: ['own', t('Kendi kalesine')], y: ['yellow', tl('Sarı kart', 'Yellow card')], r: ['red', tl('Kırmızı kart', 'Red card')],
};
const isGoal = k => 'ghvfpo'.includes(k);
const opp = s => (s === 'h' ? 'a' : 'h');
const goalSide = e => (e[1] === 'o' ? opp(e[2]) : e[2]);        // kendi kalesine gol rakibin hanesine yazılır
const STATUS = { AET: t('Uzatmalı'), PEN: t('Penaltılarla') };
const dayLong = d => new Date(`${d}T12:00:00`).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayShort = d => new Date(`${d}T12:00:00`).toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
const wd = d => new Date(`${d}T12:00:00`).toLocaleDateString(LOC, { weekday: 'short' });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el, to) {
  if (reduced || to < 2) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700;
  setTimeout(() => { el.textContent = to; }, dur + 150);   // arka plan sekmesinde animasyon kareleri durabilir; son değer garanti
  const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export async function render(app, dayArg) {
  const ctx = await boot();
  setCrumbs(t('Haberler'));
  const index = await loadNewsIndex();
  const days = index.days || [];
  if (!days.length) {
    mount(app, pageHead(t('Günün haberleri'), t('Her lige o günün sonuçları ve maç olayları.')), h('div', { class: 'empty' }, h('h3', null, t('Henüz haber yok')), h('div', null, t('Veri güncellendiğinde (her gece 00.00) biten maçlar burada listelenir.'))));
    return;
  }
  const day = days.includes(dayArg) ? dayArg : days[0];
  const data = await loadNews(day);
  const leagues = data.leagues || [];
  const all = leagues.flatMap(l => l.m.map(m => ({ ...m, c: l.c })));
  const name = (id, fallback) => (id > 0 && ctx.clubs[id] ? ctx.clubName(id) : fallback);
  const logo = (id, fallback, size = 'sm') => (id > 0 && ctx.clubs[id] ? crestFor(ctx, id, size) : crest(fallback, size));
  const cat = index.leagues || [], seen = index.seen || {};
  const catById = new Map(cat.map(c => [c.id, c]));
  const cName = c => (catById.get(c)?.n ? t(catById.get(c).n) : (ctx.comps[c] ? ctx.compName(c) : c));
  const stLabel = m => (m.st === 'PEN' ? `${STATUS.PEN}${m.ps ? ` (${m.ps[0]}-${m.ps[1]})` : ''}` : STATUS[m.st]);

  // ---------------------------------------------------------------- günün özeti
  const goalsOf = m => m.hg + m.ag;
  const evs = k => all.flatMap(m => m.ev.filter(e => e[1] === k).map(e => ({ m, e })));
  const stat = { n: all.length, goals: all.reduce((s, m) => s + goalsOf(m), 0), pen: evs('p').length, red: evs('r').length };
  const scorers = new Map();
  for (const m of all) for (const e of m.ev) if (isGoal(e[1]) && e[1] !== 'o') { const k = `${m.id}|${e[3]}`; const o = scorers.get(k) || { who: e[3], m, side: e[2], n: 0 }; o.n++; scorers.set(k, o); }
  const multi = [...scorers.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n);
  const topMatch = [...all].sort((a, b) => goalsOf(b) - goalsOf(a) || Math.abs(a.hg - a.ag) - Math.abs(b.hg - b.ag))[0];
  const biggest = [...all].sort((a, b) => Math.abs(b.hg - b.ag) - Math.abs(a.hg - a.ag))[0];
  const draws0 = all.filter(m => m.hg === 0 && m.ag === 0).length;
  const mt = m => `${name(m.h, m.hn)} ${m.hg}-${m.ag} ${name(m.a, m.an)}`;

  const focus = id => {
    const row = document.getElementById(`m-${id}`);
    if (!row) return;
    if (S.grp !== 'all' || S.q) { S.grp = 'all'; S.q = ''; search.value = ''; drawLeagues(); }
    const r = document.getElementById(`m-${id}`);
    r.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    if (r.querySelector('.nm-head').getAttribute('aria-expanded') !== 'true') r.querySelector('.nm-head').click();
  };
  const hl = [];
  if (topMatch && goalsOf(topMatch) >= 4) hl.push(['fire', t('Gol yağmuru'), mt(topMatch), topMatch.id]);
  else if (topMatch) hl.push(['ball', t('Günün en golcü maçı'), mt(topMatch), topMatch.id]);
  if (biggest && Math.abs(biggest.hg - biggest.ag) >= 3 && biggest !== topMatch) hl.push(['spark', t('En farklı skor'), mt(biggest), biggest.id]);
  for (const x of multi.slice(0, 3)) hl.push([x.n >= 3 ? 'trophy' : 'boot', x.n >= 3 ? t('Hat-trick') : t('Duble'), `${x.who} · ${name(x.side === 'h' ? x.m.h : x.m.a, x.side === 'h' ? x.m.hn : x.m.an)} (${mt(x.m)})`, x.m.id]);
  for (const { m, e } of evs('r').slice(0, 3)) hl.push(['red', tl('Kırmızı kart', 'Red card'), `${e[3] || t('Bir oyuncu')} · ${e[0]} (${mt(m)})`, m.id]);
  if (stat.pen) { const x = evs('p')[0]; hl.push(['penalty', stat.pen > 1 ? t('{n} penaltı golü', { n: stat.pen }) : t('Penaltı golü', { n: 1 }), stat.pen > 1 ? t('Günün penaltıları maç satırlarında işaretli') : `${x.e[3]} · ${x.e[0]} (${mt(x.m)})`, x.m.id]); }
  if (draws0 >= 2) hl.push(['whistle', t('Gol çıkmadı'), t('{n} maç 0-0 bitti', { n: draws0 }), null]);

  const kpi = (label, v, ic) => { const el = h('b', null, '0'); queueMicrotask(() => countUp(el, v)); return h('div', { class: 'nm-kpi' }, h('span', { class: 'ev-ic', html: icon(ic) }), h('div', null, el, h('span', null, label))); };
  const summary = h('section', { class: 'nm-sum' },
    h('div', { class: 'nm-kpis' }, kpi(t('Maç', { n: stat.n }), stat.n, 'whistle'), kpi(t('Gol', { n: stat.goals }), stat.goals, 'ball'), kpi(t('Penaltı golü', { n: stat.pen }), stat.pen, 'penalty'), kpi(t('Kırmızı kart', { n: stat.red }), stat.red, 'red')),
    hl.length ? h('div', { class: 'nm-hl' }, hl.map(([ic, ttl, d, id]) => h(id ? 'button' : 'div', { class: 'nm-hl-i', type: id ? 'button' : null, onclick: id ? () => focus(id) : null },
      h('span', { class: 'ev-ic', html: icon(ic) }), h('span', null, h('b', null, ttl), h('span', null, d))))) : null);

  // ---------------------------------------------------------------- tarih şeridi
  const idx = days.indexOf(day);
  const nav = (to, ic, label) => h(to ? 'a' : 'span', { class: `btn sm ${to ? '' : 'off'}`, href: to ? u(`/haberler/${to}`) : null, 'aria-label': label, html: icon(ic) });
  const strip = h('div', { class: 'nm-strip', role: 'tablist', 'aria-label': t('Gün seç') }, days.slice(0, 60).reverse().map(d => h('a', { class: 'nm-day', href: u(`/haberler/${d}`), role: 'tab', 'aria-selected': String(d === day) },
    h('span', null, wd(d)), h('b', null, new Date(`${d}T12:00:00`).getDate()), h('span', null, dayShort(d).split(' ')[1]))));
  // eski günler solda, yeni günler sağda: seçili gün ortalanır (sayfa dikey kaymaz)
  requestAnimationFrame(() => { const el = strip.querySelector('[aria-selected="true"]'); if (el) strip.scrollLeft = el.offsetLeft - strip.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2; });

  // ---------------------------------------------------------------- lig bölümleri
  const S = { grp: 'all', q: '', empty: true };
  const chips = h('div', { class: 'nm-chips' });
  const box = h('div', { class: 'nm-leagues' });
  const search = h('input', { type: 'search', placeholder: t('Takım ara…'), 'aria-label': t('Takım ara'), style: 'width:min(240px,100%)', oninput: debounce(e => { S.q = e.target.value; drawLeagues(); }, 120) });
  const emptyToggle = h('label', { class: 'row center', style: 'gap:6px;font-size:14px' }, h('input', { type: 'checkbox', checked: true, onchange: e => { S.empty = e.target.checked; drawLeagues(); } }), t('Maçı olmayan ligleri de göster'));

  function timeline(m) {
    let sh = 0, sa = 0;
    const rows = m.ev.map(e => {
      const side = isGoal(e[1]) ? goalSide(e) : e[2];
      if (isGoal(e[1])) { if (side === 'h') sh++; else sa++; }
      const [ic, label] = EV[e[1]];
      const cell = h('div', { class: `nm-ev ${side}` },
        h('span', { class: 'ev-ic', html: icon(ic) }),
        h('span', { class: 'nm-who' }, h('b', null, e[3] || '—'), h('span', null, e[1] === 'o' ? `${label} (${(e[2] === 'h' ? m.hn : m.an)})` : label)),
        isGoal(e[1]) ? h('span', { class: 'nm-run' }, `${sh}-${sa}`) : null);
      return h('li', { class: 'nm-tl' }, side === 'h' ? cell : h('div'), h('span', { class: 'nm-min' }, e[0]), side === 'a' ? cell : h('div'));
    });
    return m.ev.length ? h('ol', { class: 'nm-timeline' }, rows) : h('div', { class: 'dim', style: 'padding:6px 0' }, t('Bu maç için olay verisi yok.'));
  }

  function matchRow(m) {
    const hw = m.hg > m.ag, aw = m.ag > m.hg;
    const flags = [];
    if (m.ev.some(e => e[1] === 'p')) flags.push(['penalty', t('Penaltı golü var')]);
    if (m.ev.some(e => e[1] === 'o')) flags.push(['own', t('Kendi kalesine gol var')]);
    if (m.ev.some(e => e[1] === 'r')) flags.push(['red', t('Kırmızı kart var')]);
    const panel = h('div', { class: 'nm-panel', hidden: true });
    let built = false;
    const head = h('button', { class: 'nm-head', type: 'button', 'aria-expanded': 'false', onclick: () => {
      const open = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', String(open));
      if (open && !built) {
        built = true;
        panel.append(timeline(m),
          h('div', { class: 'nm-foot' }, h('span', { class: 'dim' }, [m.v, m.att ? t('{n} seyirci', { n: m.att.toLocaleString(LOC) }) : null, m.st !== 'FT' ? stLabel(m) : null].filter(Boolean).join(' · ')),
            h('span', { class: 'row' },
              m.h > 0 && ctx.clubs[m.h] ? h('a', { class: 'btn sm', href: u(`/takim/${m.h}`) }, name(m.h, m.hn)) : null,
              m.a > 0 && ctx.clubs[m.a] ? h('a', { class: 'btn sm', href: u(`/takim/${m.a}`) }, name(m.a, m.an)) : null,
              m.h > 0 && m.a > 0 && ctx.clubs[m.h] && ctx.clubs[m.a] ? h('a', { class: 'btn sm mk', href: u(`/simulator/h=${m.h}&a=${m.a}`) }, t('Yeniden simüle et')) : null)));
      }
      panel.hidden = !open;
      row.classList.toggle('open', open);
    } },
      h('span', { class: 'nm-time' }, m.t),
      h('span', { class: `nm-team h ${hw ? 'w' : ''}` }, h('span', { class: 'nm-name' }, name(m.h, m.hn)), logo(m.h, m.hn)),
      h('span', { class: 'nm-score' }, h('b', null, m.hg), h('i', null, '–'), h('b', null, m.ag)),
      h('span', { class: `nm-team a ${aw ? 'w' : ''}` }, logo(m.a, m.an), h('span', { class: 'nm-name' }, name(m.a, m.an))),
      h('span', { class: 'nm-flags' }, flags.map(([ic, tip]) => h('span', { class: 'ev-ic', title: tip, html: icon(ic) })), m.st !== 'FT' ? h('span', { class: 'chip' }, stLabel(m)) : null),
      h('span', { class: 'nm-chev', html: icon('chevr') }));
    const row = h('li', { class: 'nm-match', id: `m-${m.id}`, 'data-c': m.c }, head, panel);
    return row;
  }

  function leagueSummary(l) {
    const hw = l.m.filter(m => m.hg > m.ag).length, aw = l.m.filter(m => m.ag > m.hg).length, d = l.m.length - hw - aw;
    const g = l.m.reduce((s, m) => s + goalsOf(m), 0);
    const parts = [t('{n} maç oynandı', { n: l.m.length })];
    if (hw) parts.push(t('{n} ev sahibi galibiyeti', { n: hw }));
    if (d) parts.push(t('{n} beraberlik', { n: d }));
    if (aw) parts.push(t('{n} deplasman galibiyeti', { n: aw }));
    return t('{parts} · {goals} (maç başı {avg})', { parts: parts.join(' · '), goals: t('{n} gol', { n: g }), avg: (g / l.m.length).toFixed(1) });
  }

  /** Bir lig bölümü: başlık, özet, maçlar. Maçı olmayan ligler tek satırlık başlık olarak gösterilir. */
  const leagueBlock = l => h('section', { class: 'nm-league', id: `lg-${l.c}` },
    h('header', null, h('h2', null, cName(l.c)), h('span', { class: 'dim' }, leagueSummary(l)),
      ctx.comps[l.c]?.type === 'league' && ctx.idx[l.c]?.[2026] ? h('a', { class: 'btn sm', href: u(`/lig/${l.c}/2026`) }, t('Puan durumu')) : null),
    h('ul', { class: 'nm-list' }, l.m.map(matchRow)));
  const emptyRow = id => h('div', { class: 'nm-lg0' }, h('b', null, cName(id)), h('span', { class: 'dim' }, seen[id] ? t('Bugün maç yok · son maç {d}', { d: dayShort(seen[id]) }) : t('Bugün maç yok')),
    ctx.comps[id]?.type === 'league' && ctx.idx[id]?.[2026] ? h('a', { class: 'btn sm', href: u(`/lig/${id}/2026`) }, t('Puan durumu')) : null);

  function drawLeagues() {
    const q = norm(S.q).trim();
    // günün maçları (arama filtresiyle)
    const today = new Map(leagues.map(l => [l.c, q ? { ...l, m: l.m.filter(m => norm(`${name(m.h, m.hn)} ${name(m.a, m.an)}`).includes(q)) } : l]));
    for (const [k, v] of today) if (!v.m.length) today.delete(k);
    // gruplar: katalog sırasıyla; katalogda olmayan (eski günler) "Diğer"e
    const groups = new Map();
    const put = (g, e) => (groups.get(g) || groups.set(g, []).get(g)).push(e);
    for (const c of cat) put(c.g, c.id);
    for (const id of today.keys()) if (!catById.has(id)) put('Diğer', id);
    const info = [...groups].map(([g, ids]) => {
      const withM = ids.filter(id => today.has(id)), idle = ids.filter(id => !today.has(id) && seen[id]), off = ids.filter(id => !today.has(id) && !seen[id]);
      return { g, withM, idle, off, n: withM.reduce((s, id) => s + today.get(id).m.length, 0), total: ids.length };
    });
    chips.replaceChildren(h('button', { type: 'button', 'aria-pressed': String(S.grp === 'all'), onclick: () => { S.grp = 'all'; drawLeagues(); } }, t('Tümü'), h('em', null, [...today.values()].reduce((s, l) => s + l.m.length, 0))),
      ...info.map(x => h('button', { type: 'button', 'aria-pressed': String(S.grp === x.g), onclick: () => { S.grp = x.g; drawLeagues(); } }, t(x.g), h('em', null, x.n))));
    const shown = info.filter(x => S.grp === 'all' || x.g === S.grp);
    const out = [];
    for (const x of shown) {
      if (q && !x.withM.length) continue;                                    // arama: yalnızca eşleşen maçı olan ligler
      const idleRows = S.empty && !q ? x.idle : [];
      if (!x.withM.length && !idleRows.length && !(S.empty && !q && x.off.length && S.grp !== 'all')) continue;
      out.push(h('section', { class: 'nm-group' },
        h('h3', { class: 'nm-gh' }, t(x.g), h('span', null, x.n ? (x.withM.length === 1 ? t('1 ligde {n} maç', { n: x.n }) : t('{l} ligde {n} maç', { l: x.withM.length, n: x.n })) : t('bugün maç yok'))),
        ...x.withM.map(id => leagueBlock(today.get(id))),
        idleRows.length ? h('div', { class: 'nm-idle' }, idleRows.map(emptyRow)) : null,
        S.empty && !q && x.off.length ? h('details', { class: 'nm-off' }, h('summary', null, t('{n} lig şu an maç oynamıyor (sezon arası / veri yok)', { n: x.off.length })), h('div', { class: 'dim' }, x.off.map(cName).join(' · '))) : null));
    }
    mount(box, ...(out.length ? out : [h('div', { class: 'empty' }, h('h3', null, q ? t('Bu takımın bugün biten maçı yok') : t('Bu gün biten maç yok')))]));
  }

  mount(app,
    pageHead(t('Günün haberleri'), dayLong(day),
      h('div', { class: 'row center' }, nav(days[idx + 1], 'chevl', t('Önceki gün')), nav(days[idx - 1], 'chevr', t('Sonraki gün')))),
    strip, summary, h('div', { class: 'row center', style: 'margin:0 0 12px;gap:14px' }, search, emptyToggle), chips, box,
    h('div', { class: 'dim', style: 'font-size:12.5px;margin-top:18px' }, t('Veri: ESPN, {d}. {n} lig ve kupa izleniyor; günler Türkiye saatine göre, haberler her gece 00.05’te güncellenir. Yalnızca biten maçlar gösterilir; Türkiye Kupası, TFF 1. Lig ve Türkiye’nin alt ligleri ESPN’de olmadığı için yer almıyor. Maça tıklayınca gol dakikaları, penaltılar ve kartlar açılır.', { d: index.asOf ? index.asOf.slice(0, 10) : '', n: cat.length })));
  drawLeagues();
}
