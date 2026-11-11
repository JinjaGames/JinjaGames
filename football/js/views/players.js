// Oyuncular: transfer piyasası gibi filtrele, kısa listeye ekle.
import { h, mount, setCrumbs, fmtMoney, norm, debounce, ageOn, fmtDate, u } from '../util.js';
import { boot, pageHead, sheet, seg, field, avatar } from '../ui.js';
import { loadPlayers, loadCurrent } from '../data.js';
import * as store from '../store.js';
import { t, LOC } from '../i18n.js';

const PRESETS = [
  ['all', t('Tümü')], ['young', t('Genç yetenekler')], ['expiring', t('Sözleşmesi bitiyor')], ['hurt', t('Sakatlar')], ['top', t('En değerliler')], ['short', t('Kısa listem')],
];

export async function render(app) {
  const ctx = await boot();
  const [P, cur] = await Promise.all([loadPlayers(), loadCurrent()]);
  setCrumbs(t('Oyuncular'));
  // güncel bilgi: ESPN kadrolarından (kulüp, sakatlık, sezon istatistikleri)
  const now = new Map();
  for (const [cid, rows] of Object.entries(cur.clubs)) for (const p of rows) if (p.id) now.set(p.id, { club: +cid, st: p.st, inj: p.inj, e: p.e });
  const S = { q: '', line: 'ALL', preset: 'all', minAge: '', maxAge: '', minVal: '', maxVal: '', shown: 60, adv: false };
  const short = new Set(store.pref('shortlist', []));
  const box = h('div');
  const today = new Date();

  const search = h('input', { type: 'search', placeholder: t('Oyuncu, uyruk ya da takım ara…'), style: 'width:min(360px,100%)', 'aria-label': t('Oyuncu ara'), oninput: debounce(e => { S.q = e.target.value; S.shown = 60; draw(); }, 120) });
  const num = (key, ph) => h('input', { type: 'number', min: 0, placeholder: ph, style: 'width:100px', 'aria-label': ph, onchange: e => { S[key] = e.target.value; S.shown = 60; draw(); } });
  const presetBox = h('div'), advBox = h('div');
  const drawPresets = () => mount(presetBox, h('div', { class: 'row center', style: 'gap:8px' }, PRESETS.map(([k, l]) => h('button', { class: `btn sm ${S.preset === k ? 'primary' : ''}`, onclick: () => { S.preset = k; S.shown = 60; drawPresets(); draw(); } }, l, k === 'short' ? ` (${short.size})` : ''))));
  const adv = h('div', { class: 'row center', style: 'margin-top:12px;display:none' }, field(t('Yaş'), h('div', { class: 'row center', style: 'gap:6px' }, num('minAge', t('en az')), '–', num('maxAge', t('en çok')))), field(t('Değer (milyon €)'), h('div', { class: 'row center', style: 'gap:6px' }, num('minVal', t('en az')), '–', num('maxVal', t('en çok')))));

  mount(app, pageHead(t('Oyuncular'), t('{c} oyuncu. Filtrele, kısa listene ekle; güncel kadrolar ve sakatlıklar günlük yenilenir.', { c: P.list.length.toLocaleString(LOC) })),
    h('div', { class: 'sheet', style: 'margin-bottom:20px' }, h('div', { class: 'bd', style: 'display:grid;gap:14px' },
      h('div', { class: 'row center' }, search, seg([['ALL', t('Tüm mevkiler')], ['G', t('Kaleci')], ['D', t('Defans')], ['M', t('Orta saha')], ['A', t('Forvet')]], S.line, v => { S.line = v; S.shown = 60; draw(); }),
        h('button', { class: 'btn ghost', onclick: () => { S.adv = !S.adv; adv.style.display = S.adv ? 'flex' : 'none'; } }, t('Daha fazla filtre'))),
      presetBox, adv)), box);

  function draw() {
    const q = norm(S.q).trim().split(' ').filter(Boolean);
    const minA = S.minAge === '' ? null : +S.minAge, maxA = S.maxAge === '' ? null : +S.maxAge, minV = S.minVal === '' ? null : +S.minVal * 1e6, maxV = S.maxVal === '' ? null : +S.maxVal * 1e6;
    const info = p => now.get(p.id);
    const clubOf = p => info(p)?.club ?? p.club;
    let rows = P.list.filter(p => (p.lastSeason ?? 0) >= 2025 || info(p));
    if (S.line !== 'ALL') rows = rows.filter(p => p.line === S.line);
    if (S.preset === 'young') rows = rows.filter(p => (ageOn(p.dob, today) ?? 99) <= 21 && p.value >= 2e6);
    if (S.preset === 'expiring') rows = rows.filter(p => p.contract && p.contract > today.toISOString().slice(0, 10) && p.contract < new Date(today.getTime() + 365 * 864e5).toISOString().slice(0, 10) && p.value >= 1e6);
    if (S.preset === 'hurt') rows = rows.filter(p => info(p)?.inj);
    if (S.preset === 'short') rows = rows.filter(p => short.has(p.id));
    if (minA != null) rows = rows.filter(p => (ageOn(p.dob, today) ?? 0) >= minA);
    if (maxA != null) rows = rows.filter(p => (ageOn(p.dob, today) ?? 99) <= maxA);
    if (minV != null) rows = rows.filter(p => p.value >= minV);
    if (maxV != null) rows = rows.filter(p => p.value <= maxV);
    if (q.length) rows = rows.filter(p => { const k = norm(`${p.name} ${p.nat || ''} ${clubOf(p) ? ctx.clubName(clubOf(p)) : ''}`); return q.every(t => k.includes(t)); });
    rows.sort((a, b) => (S.preset === 'young' ? b.peak - a.peak : b.value - a.value));
    const shown = rows.slice(0, S.shown);
    mount(box, sheet(h('h2', null, t('{c} oyuncu', { c: rows.length.toLocaleString(LOC), n: rows.length })), rows.length ? h('div', null, h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th'), h('th', null, t('Oyuncu')), h('th', null, t('Takım')), h('th', null, t('Mevki')), h('th', { class: 'num' }, t('Yaş')), h('th', null, t('Uyruk')), h('th', { class: 'num' }, t('Maç')), h('th', { class: 'num' }, t('Gol')), h('th', { class: 'num' }, t('Değer')), h('th', null, t('Sözleşme')))),
      h('tbody', null, shown.map(p => {
        const i = info(p), c = clubOf(p);
        return h('tr', null,
          h('td', null, h('button', { class: 'icon-btn', style: 'width:34px;height:34px;font-size:18px', 'aria-label': short.has(p.id) ? t('Kısa listeden çıkar') : t('Kısa listeye ekle'), title: short.has(p.id) ? t('Kısa listeden çıkar') : t('Kısa listeye ekle'), onclick: () => { short.has(p.id) ? short.delete(p.id) : short.add(p.id); store.setPref('shortlist', [...short]); drawPresets(); draw(); } }, short.has(p.id) ? '★' : '☆')),
          h('td', null, h('div', { class: 'who' }, avatar({ name: p.name, img: p.img, esp: i?.e }, 'sm'), h('a', { href: u(`/oyuncu/${p.id}`), style: 'font-weight:600' }, p.name), i?.inj ? h('span', { class: 'chip rel', title: i.inj.t }, t('Sakat')) : null)),
          h('td', null, c ? h('a', { href: u(`/takim/${c}`), style: 'text-decoration:none' }, ctx.clubName(c)) : ''), h('td', null, h('span', { class: `chip` }, p.pos || p.line)),
          h('td', { class: 'num' }, ageOn(p.dob, today) ?? '—'), h('td', { class: 'mute' }, p.nat || ''), h('td', { class: 'num' }, i?.st?.ap ?? '—'), h('td', { class: 'num' }, i?.st?.g ?? '—'),
          h('td', { class: 'num', style: 'font-weight:700' }, fmtMoney(p.value)), h('td', { class: 'dim' }, p.contract ? fmtDate(p.contract) : '—'));
      })))),
      rows.length > S.shown ? h('div', { style: 'padding:16px 20px' }, h('button', { class: 'btn', onclick: () => { S.shown += 120; draw(); } }, t('Daha fazla göster'))) : null)
      : h('div', { class: 'empty' }, h('h3', null, t('Oyuncu bulunamadı')), h('div', null, S.preset === 'short' ? t('Henüz kısa listene oyuncu eklemedin. Tabloda ☆ simgesine bas.') : t('Filtreleri gevşetmeyi dene.'))), { tight: true }));
  }
  drawPresets(); draw();
}
