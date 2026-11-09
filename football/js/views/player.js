import { h, mount, setCrumbs, fmtMoney, fmtDate, seasonLabel, lineChart, ageOn, u } from '../util.js';
import { boot, sheet, POS_LONG, avatar, crestFor } from '../ui.js';
import { loadPlayers, loadValuations, loadTransfers, loadCurrent, loadStints, monthIdxToDate, LAST_SEASON } from '../data.js';
import { stintMap, ovr, monthNow } from '../strength.js';
import { t as tp } from '../i18n.js';

export async function render(app, idArg) {
  const ctx = await boot();
  const [P, cur] = await Promise.all([loadPlayers(), loadCurrent()]);
  const p = P.byId.get(+idArg);
  if (!p) { mount(app, h('div', { class: 'empty' }, h('h3', null, tp('Oyuncu bulunamadı')), h('a', { class: 'btn primary', href: u('/oyuncular') }, tp('Oyunculara dön')))); return; }
  setCrumbs(p.name);
  // güncel kulüp ve sakatlık: ESPN kadrolarından
  let now = null;
  for (const [cid, rows] of Object.entries(cur.clubs)) { const r = rows.find(x => x.id === p.id); if (r) { now = { club: +cid, ...r }; break; } }
  const club = now?.club ?? p.club;
  const vals = await loadValuations(p.id);
  const trBox = h('div', null, h('div', { class: 'skel', style: 'height:80px' }));
  const careerBox = h('div', null, h('div', { class: 'skel', style: 'height:80px' }));
  const ageNow = ageOn(p.dob);

  const peak = vals.reduce((m, v) => (v.v > m.v ? v : m), { v: 0, mi: 0 });
  const chart = vals.length > 1 ? lineChart({ series: [{ pts: vals.map(v => [v.mi / 12 + 2000, v.v]), color: 'var(--brand)', w: 2.5 }], yFmt: v => fmtMoney(v), xFmt: v => Math.round(v), height: 240 }) : h('div', { class: 'empty' }, tp('Değer geçmişi yok'));
  const age = ageOn(p.dob);
  mount(app,
    h('div', { class: 'page-h', style: 'align-items:center' },
      avatar({ name: p.name, img: p.img, esp: now?.e }, 'xl'),
      h('div', { style: 'min-width:0' }, h('h1', null, p.name),
        h('div', { class: 'row center', style: 'gap:8px;margin-top:10px' },
          h('span', { class: 'chip' }, p.pos || POS_LONG[p.line]), age ? h('span', { class: 'chip' }, tp('{n} yaş', { n: age })) : null, p.nat ? h('span', { class: 'chip' }, p.nat) : null,
          now?.inj ? h('span', { class: 'chip rel', title: now.inj.t }, tp('Sakat: {t}', { t: now.inj.t })) : null),
        club ? h('a', { href: u(`/takim/${club}`), class: 'row center', style: 'gap:10px;margin-top:12px;text-decoration:none;font-weight:600;font-size:17px' }, crestFor(ctx, club), ctx.clubName(club)) : null),
      h('div', { class: 'sp' }),
      h('a', { class: 'btn', href: u(`/transfer/${LAST_SEASON}`) }, tp('Transferi değiştir'))),
    h('div', { class: 'grid cols-2' },
      h('div', { class: 'grid', style: 'align-content:start' },
        sheet(h('h2', null, tp('Piyasa değeri')), chart),
        sheet(h('h2', null, tp('Transfer geçmişi')), trBox, { tight: true })),
      h('div', { class: 'grid', style: 'align-content:start' },
        sheet(h('h2', null, tp('Bilgiler')), h('dl', { class: 'kv' },
          h('dt', null, tp('Genel güç (OVR)')), h('dd', null, h('b', null, ovr({ value: p.value, age: ageNow })), h('span', { class: 'dim', title: tp('Piyasa değeri ve yaştan tahmin; FIFA’daki OVR gibi ama resmî bir puan değildir') }, tp('  tahmini'))),
          h('dt', null, tp('Güncel değer')), h('dd', null, h('b', null, fmtMoney(p.value))),
          h('dt', null, tp('Zirve değer')), h('dd', null, `${fmtMoney(p.peak)}${peak.v ? ` (${monthIdxToDate(peak.mi)})` : ''}`),
          h('dt', null, tp('Doğum')), h('dd', null, p.dob ? fmtDate(p.dob) : '—'),
          h('dt', null, tp('Boy / ayak')), h('dd', null, `${p.height ? p.height + ' cm' : '—'} · ${p.foot || '—'}`),
          h('dt', null, tp('Sözleşme')), h('dd', null, p.contract ? fmtDate(p.contract) : '—'),
          h('dt', null, tp('Milli maç')), h('dd', null, p.caps ?? '—'))),
        sheet(h('h2', null, tp('Kulüp kariyeri')), careerBox, { tight: true }),
        now ? sheet(h('h2', null, tp('Bu sezon')), h('div', { class: 'row', style: 'gap:28px' },
          ...[[tp('Maç'), now.st.ap], [tp('Gol'), now.st.g], [tp('Asist'), now.st.as], [tp('Sarı'), now.st.y], [tp('Kırmızı'), now.st.r]].map(([l, v]) => h('div', { class: 'kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l))))) : null)));

  // kulüp kariyeri + eski takım arkadaşları (kulüp dönemlerinden)
  const S = stintMap(await loadStints()), mine = S.get(p.id) || [], ref = monthNow();
  const mates = new Map();
  for (const [pid, st] of S) if (pid !== p.id) {
    let t = 0;
    for (const [c, a, b] of mine) for (const [c2, a2, b2] of st) if (c === c2) t += Math.max(0, Math.min(b, b2, ref) - Math.max(a, a2));
    if (t >= 12) mates.set(pid, t);
  }
  const top = [...mates].sort((a, b) => b[1] - a[1]).map(([pid, t]) => ({ q: P.byId.get(pid), t })).filter(x => x.q).sort((a, b) => b.q.value - a.q.value || b.t - a.t).slice(0, 6);
  careerBox.replaceChildren(mine.length ? h('div', null,
    h('table', { class: 'tbl' }, h('tbody', null, [...mine].reverse().map(([c, a, b]) => h('tr', null,
      h('td', null, h('a', { class: 'who', href: u(`/takim/${c}`) }, crestFor(ctx, c, 'sm'), ctx.clubs[c] ? ctx.clubName(c) : tp('Kulüp #{id}', { id: c }))),
      h('td', { class: 'dim' }, `${monthIdxToDate(a)} – ${b >= ref ? tp('şimdi') : monthIdxToDate(b)}`), h('td', { class: 'num dim' }, tp('{n} yıl', { n: Math.max(1, Math.round((Math.min(b, ref) - a) / 12 * 10) / 10) })))))),
    top.length ? h('div', { style: 'padding:12px 16px;border-top:1px solid var(--line)' }, h('div', { class: 'cap', style: 'margin-bottom:6px' }, tp('Birlikte oynadığı değerli oyuncular (takım kimyası bağları)')),
      h('div', { class: 'row', style: 'gap:6px' }, top.map(({ q, t }) => h('a', { class: 'chip', href: u(`/oyuncu/${q.id}`), title: tp('{n} ay birlikte', { n: t }) }, `${q.name} · ${tp('{n} yıl', { n: Math.round(t / 12 * 10) / 10 })}`)))) : null)
    : h('div', { class: 'empty' }, tp('Kulüp geçmişi verisi yok.')));

  // transfer geçmişi: tüm dönemleri tara
  const rows = [];
  const seasons = Array.from({ length: LAST_SEASON - 2000 + 2 }, (_, i) => 2000 + i);
  const res = await Promise.all(seasons.map(s => loadTransfers(s).then(l => l.filter(t => t.pid === p.id)).catch(() => [])));
  for (const l of res) rows.push(...l);
  rows.sort((a, b) => b.date.localeCompare(a.date));
  trBox.replaceChildren(rows.length ? h('div', null, rows.map(t => h('div', { class: 'xfer' },
    h('span', { class: 'dim', style: 'font-size:14px' }, fmtDate(t.date)),
    h('span', { class: 'route' }, crestFor(ctx, t.from), ctx.clubName(t.from), h('span', { class: 'arrow' }, '→'), crestFor(ctx, t.to), ctx.clubName(t.to)),
    h('b', { style: 'font:700 16px var(--f-display)' }, t.fee ? fmtMoney(t.fee) : t.det ? tp('ücret bilinmiyor') : tp('serbest')),
    h('a', { class: 'btn sm', href: u(`/transfer/${t.season}`) }, tp('Dönemi aç'))))) : h('div', { class: 'empty' }, tp('Kayıtlı transfer yok.')));
}
