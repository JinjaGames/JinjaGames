// Milli takımlar: Elo sıralaması, geçmiş maçlarda what-if (Elo yeniden oynatma), iki ülkenin simülasyonu.
import { h, mount, setCrumbs, fmtDate, fmtPct, lineChart, norm, debounce, go, toast, fmtMoney, crest, u } from '../util.js';
import { boot, pick, select, field, seg, sheet, pageHead, delta } from '../ui.js';
import { loadIntl, loadIntlElo, loadPlayers } from '../data.js';
import { lambdas, poissonMatrix, eloUpdate } from '../engine.js';
import { simulate, autoXI, lineupStrength } from '../matchsim.js';
import * as store from '../store.js';

import { TR, NAT_ALIAS, tr } from '../nations.js';
import { t as tp, LOC } from '../i18n.js';

function tournWeight(t) {
  if (t === 'FIFA World Cup') return 60;
  if (t.includes('qualification') && (t.includes('FIFA') || t.includes('World Cup'))) return 40;
  if (t === 'Friendly') return 20;
  if (['UEFA Euro', 'Copa América', 'African Cup of Nations', 'AFC Asian Cup', 'Gold Cup', 'CONCACAF Championship', 'Confederations Cup'].includes(t)) return 50;
  if (t.includes('qualification')) return 40;
  if (t.includes('Nations League')) return 40;
  return 30;
}
const key = m => `${m.date}|${m.h}|${m.a}`;

/** 2000'den itibaren tüm milli maçları (override'lı) oynat; yıl sonu Elo'larını verir. */
function replay(matches, start, overrides) {
  const r = new Map(); const ye = new Map();
  const get = t => r.get(t) ?? start[t] ?? 1500;
  let year = null;
  const snap = y => { for (const [t, v] of r) { (ye.get(t) || ye.set(t, new Map()).get(t)).set(y, Math.round(v)); } };
  for (const m of matches) {
    const y = +m.date.slice(0, 4);
    if (year !== null && y !== year) snap(year);
    year = y;
    const o = overrides?.get(key(m));
    const hg = o ? o.hg : m.hg, ag = o ? o.ag : m.ag;
    const rh = get(m.h), ra = get(m.a);
    const ha = m.neutral ? 0 : 100;
    const e = 1 / (1 + 10 ** (-(rh + ha - ra) / 400));
    const s = hg > ag ? 1 : hg === ag ? .5 : 0, gd = Math.abs(hg - ag), gm = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const d = tournWeight(m.tour) * gm * (s - e);
    r.set(m.h, rh + d); r.set(m.a, ra - d);
  }
  if (year !== null) snap(year);
  return { final: r, ye };
}

export async function render(app, teamArg) {
  const ctx = await boot();
  const [matches, yeRaw] = await Promise.all([loadIntl(), loadIntlElo()]);
  const start = {}; for (const [t, d] of Object.entries(yeRaw)) if (d['1999']) start[t] = d['1999'];
  const team = teamArg ? decodeURIComponent(teamArg) : null;

  const edits = store.intlEdits();
  const real = replay(matches, start, null);
  const alt = edits.size ? replay(matches, start, edits) : real;
  const recent = new Set(matches.filter(m => m.date >= '2024-01-01').flatMap(m => [m.h, m.a]));
  const rank = [...alt.final].filter(([t]) => recent.has(t)).sort((a, b) => b[1] - a[1]);

  if (!team) return rankingView();
  return teamView();

  // ------------------------------------------------------------------ sıralama
  function rankingView() {
    setCrumbs(tp('Milli takımlar'));
    const q = { s: '' };
    const box = h('div');
    const draw = () => {
      const f = norm(q.s).trim();
      const rows = rank.map(([t, v], i) => ({ t, v, i })).filter(r => !f || norm(tr(r.t) + ' ' + r.t).includes(f));
      const prev = t => { const m = real.ye.get(t); return m?.get(2025) ?? null; };
      mount(box, sheet(h('h2', null, tp('Elo sıralaması')), h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', { class: 'num' }, '#'), h('th', null, tp('Takım')), h('th', { class: 'num' }, 'Elo'), h('th', { class: 'num' }, tp('Yıllık değişim')))),
        h('tbody', null, rows.slice(0, 100).map(r => { const p = (alt.ye.get(r.t)?.get(2025)); return h('tr', null, h('td', { class: 'num dim' }, r.i + 1), h('td', null, h('a', { class: 'team', href: u(`/milli/${encodeURIComponent(r.t)}`) }, crest(tr(r.t)), h('span', null, tr(r.t)))), h('td', { class: 'num pts' }, Math.round(r.v)), h('td', { class: 'num' }, p ? delta(Math.round(r.v - p)) : '—')); })))), { tight: true }));
    };
    const search = h('input', { type: 'search', placeholder: tp('Takım ara…'), oninput: debounce(e => { q.s = e.target.value; draw(); }, 100) });
    const sim = simPanel(null);
    mount(app, pageHead(tp('Milli takımlar'), `${tp('{n} aktif takım · Elo 1872’den bu yana tüm maçlardan hesaplanır', { n: rank.length })}${edits.size ? tp(' · senaryondaki değişiklikler uygulanıyor') : ''}.`, field(tp('Ara'), search)),
      h('div', { class: 'grid cols-2' }, box, h('div', { class: 'grid', style: 'align-content:start' }, sim)));
    draw();
  }

  // ------------------------------------------------------------------ takım
  async function teamView() {
    setCrumbs(tp('Milli takımlar'), tr(team));
    const P = await loadPlayers();
    const natName = NAT_ALIAS[team] || team;
    const squad = P.list.filter(p => p.nat === natName && (p.lastSeason ?? 0) >= 2025).sort((a, b) => b.value - a.value).slice(0, 26);
    const ser = (m, color, dash) => ({ pts: [...(m.get(team) || new Map())].filter(([y]) => y >= 2000).map(([y, v]) => [y, v]).sort((a, b) => a[0] - b[0]), color, dash, w: 2 });
    const series = [ser(real.ye, edits.size ? 'var(--chalk-3)' : 'var(--chalk)')];
    if (edits.size) series.push(ser(alt.ye, 'var(--marker)'));
    const years = [...new Set(matches.filter(m => m.h === team || m.a === team).map(m => +m.date.slice(0, 4)))].sort((a, b) => b - a);
    let yr = years[0];
    const matchBox = h('div');
    const S = { editing: null };
    const drawMatches = () => {
      const list = matches.filter(m => (m.h === team || m.a === team) && +m.date.slice(0, 4) === yr).map(m => { const o = edits.get(key(m)); return o ? { ...m, real: [m.hg, m.ag], hg: o.hg, ag: o.ag, edited: true } : m; });
      mount(matchBox, sheet(h('h2', null, tp('{yr} maçları', { yr })), h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' }, h('tbody', null, list.map(m => {
        const mine = m.h === team, own = mine ? m.hg : m.ag, opp = mine ? m.ag : m.hg, r = own > opp ? 'G' : own === opp ? 'B' : 'M';
        const editing = S.editing === key(m);
        const hi = h('input', { type: 'number', min: 0, max: 30, value: m.hg, style: 'width:46px' }), ai = h('input', { type: 'number', min: 0, max: 30, value: m.ag, style: 'width:46px' });
        const apply = () => { const orig = matches.find(x => key(x) === key(m)); const hg = +hi.value, ag = +ai.value; if (hg === orig.hg && ag === orig.ag) store.removeEdit(e => e.t === 'intl' && e.key === key(m)); else store.addEdit({ t: 'intl', key: key(m), hg, ag, real: [orig.hg, orig.ag], label: `${tr(m.h)} ${hg}-${ag} ${tr(m.a)} (${fmtDate(m.date)})` }); render(app, teamArg); };
        return h('tr', { class: m.edited ? 'chg' : '' }, h('td', { class: 'dim' }, fmtDate(m.date)), h('td', { class: 'dim' }, m.tour), h('td', { style: 'text-align:right' }, mine ? h('b', null, tr(m.h)) : tr(m.h)),
          h('td', { class: 'num' }, editing ? h('span', { class: 'scoreedit' }, hi, '-', ai, h('button', { class: 'btn sm mk', onclick: apply }, tp('Uygula'))) : h('button', { class: 'btn sm', style: m.edited ? 'border-color:var(--marker);color:var(--marker)' : '', title: m.edited ? tp('Gerçek: {s}', { s: `${m.real[0]}-${m.real[1]}` }) : tp('Skoru değiştir'), onclick: () => { S.editing = key(m); drawMatches(); } }, `${m.hg} - ${m.ag}`)),
          h('td', null, m.a === team ? h('b', null, tr(m.a)) : tr(m.a)), h('td', null, h('span', { class: `form` }, h('i', { class: { G: 'W', B: 'D', M: 'L' }[r] }, { G: tp('G'), B: tp('B'), M: tp('M') }[r]))));
      })))), { tight: true, actions: [select(years.map(y => [y, y]), yr, v => { yr = +v; S.editing = null; drawMatches(); })] }));
    };
    const cur = alt.final.get(team) ?? 1500, rk = rank.findIndex(([t]) => t === team) + 1;
    mount(app, pageHead(tr(team), `Elo ${Math.round(cur)}${rk ? tp(' · dünya sıralaması {rk}.', { rk }) : ''}${edits.size && Math.abs(cur - (real.final.get(team) ?? cur)) >= 1 ? tp(' · gerçekte {n}', { n: Math.round(real.final.get(team)) }) : ''}`, crest(tr(team), 'xl')),
      h('div', { class: 'grid cols-2' }, h('div', { class: 'grid', style: 'align-content:start' },
        sheet(h('h2', null, tp('Elo geçmişi')), lineChart({ series, xFmt: v => Math.round(v), yFmt: v => Math.round(v), height: 230 }), { actions: edits.size ? [h('span', { class: 'chip mk' }, tp('Sarı: alternatif'))] : [] }),
        matchBox),
        h('div', { class: 'grid', style: 'align-content:start' }, simPanel(team), squad.length ? sheet(h('h2', null, tp('Tahmini kadro (piyasa değeri)')), h('table', { class: 'tbl', style: 'margin:calc(var(--pad) * -1) 0' }, h('tbody', null, squad.map(p => h('tr', null, h('td', null, h('span', { class: 'chip' }, p.pos || p.line)), h('td', null, h('a', { href: u(`/oyuncu/${p.id}`) }, p.name)), h('td', { class: 'mute' }, p.club ? ctx.clubName(p.club) : ''), h('td', { class: 'num' }, fmtMoney(p.value))))))) : null)));
    drawMatches();
  }

  // ------------------------------------------------------------------ iki ülke simülasyonu
  function simPanel(initial) {
    const st = { a: initial || 'Turkey', b: 'Germany', neutral: true, n: 10000 };
    const box = h('div'), out = h('div');
    const draw = () => {
      const ra = alt.final.get(st.a) ?? 1500, rb = alt.final.get(st.b) ?? 1500;
      const ha = st.neutral ? 0 : 100;
      const [lh, la] = lambdas(ra, rb, 2.55, ha);
      const sim = simulate({ lh, la, n: st.n, seed: 12345 });
      const bar = (l, p, c) => h('div', { class: 'pbar' }, h('span', null, l), h('div', { class: 'meter' }, h('i', { style: `width:${p * 100}%;background:${c}` })), h('b', { class: 'num' }, fmtPct(p, 1)));
      const pickBtn = k => h('button', { class: 'btn', onclick: async () => { const id = await pick({ title: tp('Takım seç'), items: rank.map(([t, v]) => ({ id: t, label: tr(t), right: Math.round(v) })) }); if (id) { st[k] = id; draw(); } } }, tr(st[k]));
      mount(out, h('div', { class: 'row center' }, pickBtn('a'), h('span', { class: 'cap' }, 'vs'), pickBtn('b'),
        h('label', { class: 'row center', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: st.neutral, onchange: e => { st.neutral = e.target.checked; draw(); } }), tp('Tarafsız saha'))),
      h('div', { style: 'margin-top:12px' }, bar(`${tr(st.a)}`, sim.hw, 'var(--ucl)'), bar(tp('Beraberlik'), sim.dr, 'var(--chalk-2)'), bar(`${tr(st.b)}`, sim.aw, 'var(--el)')),
      h('div', { class: 'row', style: 'gap:8px' }, ...sim.top.slice(0, 5).map(t => h('span', { class: 'chip' }, `${t.h}-${t.a} · ${fmtPct(t.p, 1)}`))),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('a', { class: 'btn mk', href: u(`/simulator/mode=nation&h=${encodeURIComponent(st.a)}&a=${encodeURIComponent(st.b)}`) }, tp('İlk 11’leri düzenle ve simüle et'))),
      h('div', { class: 'dim', style: 'font-size:12px;margin-top:8px' }, tp('Elo {ra} – {rb} · beklenen gol {lh} – {la} · {n} simülasyon', { ra: Math.round(ra), rb: Math.round(rb), lh: lh.toFixed(2), la: la.toFixed(2), n: st.n.toLocaleString(LOC) })));
    };
    draw();
    return sheet(h('h2', null, tp('Karşılaşma simülasyonu')), out);
  }
}
