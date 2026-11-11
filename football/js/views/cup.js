// Kupa & Eleme what-if: eşleşmeler, ayak skorları, penaltı kazananı; değişiklik sonraki turlara yayılır.
import { h, mount, toast, fmtDay, seasonLabel, fmtPct, setCrumbs, go } from '../util.js';
import { boot, teamLink, crestFor, select, field, sheet, pageHead, emptyState, delta, moneyDelta } from '../ui.js';
import { CUP_PRIZE } from '../rules.js';
import { loadMatches, loadElo } from '../data.js';
import { buildTies, resolveReal, evaluate, trStage } from '../cup.js';
import * as store from '../store.js';
import { t as tp, LOC } from '../i18n.js';

const PREF = 'lastCup';

export async function render(app, compArg, seasonArg) {
  const ctx = await boot();
  const cups = Object.values(ctx.comps).filter(c => ['cup', 'euro'].includes(c.type) && ctx.idx[c.id]);
  const last = store.pref(PREF, { comp: 'CL', season: 2024 });
  const comp = compArg && ctx.comps[compArg] ? compArg : last.comp;
  const seasons = Object.keys(ctx.idx[comp] || {}).map(Number).sort((a, b) => b - a);
  const season = seasonArg && seasons.includes(+seasonArg) ? +seasonArg : (seasons.includes(last.season) ? last.season : seasons[0]);
  store.setPref(PREF, { comp, season });
  setCrumbs(tp('Kupalar'), `${ctx.compName(comp)} ${seasonLabel(season)}`);

  const matches = await loadMatches(comp, season);
  const eloRaw = await loadElo(season);
  const startElo = new Map(Object.entries(eloRaw || {}).map(([k, v]) => [+k, v]));
  const tieSet = buildTies(matches);
  const head = pageHead(ctx.compName(comp), tp('Bir ayağın skorunu ya da penaltı kazananını değiştir; elenen takımın yerine geçen takım sonraki turlarda yeniden oynatılır.'),
    field(tp('Kupa'), select(cups.map(c => [c.id, `${c.name}${c.country && c.country !== 'UEFA' ? ' · ' + c.country : ''}`]), comp, v => go(`/kupa/${v}`))),
    field(tp('Sezon'), select(seasons.map(s => [s, seasonLabel(s)]), season, v => go(`/kupa/${comp}/${v}`))));
  if (!tieSet.ties.length) { mount(app, head, emptyState(tp('Bu sezon için eleme eşleşmesi yok'), tp('Grup/lig aşaması dışındaki maçlar burada gösterilir.'))); return; }
  const R = resolveReal(tieSet, { comp, season });
  const { ties, stages } = R;

  const S = { si: null, editing: null, ev: null, gi: 0, gteam: null };
  const counts = stages.map((_, i) => ties.filter(t => t.si === i).length);
  S.si = Math.max(0, counts.findIndex(c => c <= 16));
  if (!ties.length) S.si = -1;
  const listBox = h('div'), impactBox = h('div'), navBox = h('div');
  mount(app, head, h('div', { class: 'grid cols-2' }, h('div', { class: 'grid', style: 'align-content:start' }, navBox, listBox), impactBox));

  const nm = id => ctx.clubName(id);
  const scoresOf = () => store.resultEdits(comp, season);
  const pensOf = () => store.penEdits(comp, season);
  const compute = () => evaluate(R, { comp, season, edits: scoresOf(), pens: pensOf(), startElo, n: 3000 });

  function commit(m, hg, ag) {
    if (!Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0) { toast(tp('Geçerli bir skor gir')); return; }
    if (hg === m.hg && ag === m.ag) store.removeEdit(e => e.t === 'result' && e.id === m.id);
    else store.addEdit({ t: 'result', comp, season, id: m.id, hg, ag, real: [m.hg, m.ag], label: `${ctx.compName(comp)} ${seasonLabel(season)}: ${nm(m.h)} ${hg}-${ag} ${nm(m.a)}` });
    S.editing = null; refresh();
  }

  function tieCard(t, ev) {
    const d = ev.det[t.idx], edits = scoresOf();
    const reach = ev.reach[t.idx];
    const affected = !(reach.size === 2 && t.teams.every(x => reach.get(x) > 0.999));
    const winnerId = affected ? null : d.winner;
    const [a, b] = t.teams;
    const legs = t.matches.map(m => {
      const e = edits.get(m.id), hg = e ? e.hg : m.hg, ag = e ? e.ag : m.ag, editing = S.editing === m.id;
      if (affected) return h('div', { class: 'row center dim', style: 'font-size:12.5px' }, fmtDay(m.date), h('span', { class: 'chip' }, tp('yeniden oynanır')));
      if (editing) {
        const ih = h('input', { type: 'number', min: 0, max: 20, value: hg, style: 'width:46px', 'aria-label': tp('Ev golleri') }), ia = h('input', { type: 'number', min: 0, max: 20, value: ag, style: 'width:46px', 'aria-label': tp('Deplasman golleri') });
        for (const el of [ih, ia]) el.addEventListener('keydown', k => { if (k.key === 'Enter') commit(m, +ih.value, +ia.value); if (k.key === 'Escape') { S.editing = null; drawList(); } });
        queueMicrotask(() => ih.focus());
        return h('div', { class: 'row center' }, h('span', { style: 'flex:1;text-align:right' }, nm(m.h)), h('span', { class: 'scoreedit' }, ih, '-', ia, h('button', { class: 'btn sm mk', onclick: () => commit(m, +ih.value, +ia.value) }, tp('Uygula')), h('button', { class: 'btn sm ghost', onclick: () => { S.editing = null; drawList(); } }, '×')), h('span', { style: 'flex:1' }, nm(m.a)));
      }
      return h('div', { class: 'row center', style: 'flex-wrap:nowrap' }, h('span', { class: 'dim', style: 'width:44px;font-size:12px' }, fmtDay(m.date)),
        h('span', { style: 'flex:1;text-align:right', class: winnerId === m.h ? '' : 'mute' }, nm(m.h)),
        h('button', { class: 'btn sm', style: e ? 'border-color:var(--marker);color:var(--marker)' : '', title: e ? tp('Gerçek: {s}', { s: `${m.hg}-${m.ag}` }) : tp('Skoru değiştir'), onclick: () => { S.editing = m.id; drawList(); } }, `${hg} - ${ag}`),
        h('span', { style: 'flex:1', class: winnerId === m.a ? '' : 'mute' }, nm(m.a)));
    });
    const foot = [];
    if (affected) {
      const top = [...reach].sort((x, y) => y[1] - x[1]).slice(0, 4);
      foot.push(h('div', { class: 'note mk' }, tp('Katılımcılar değişti: '), top.map(([id, p]) => `${nm(id)} ${fmtPct(p)}`).join(' · ')));
    } else {
      if (d.how === 'pens') {
        const cur = pensOf().get(t.key) ?? d.winner;
        foot.push(h('div', { class: 'row center' }, h('span', { class: 'cap' }, tp('Penaltılar')), h('span', { class: 'dim', style: 'font-size:12px' }, t.real.inferred && !scoresOf().size ? tp('(gerçek kazanan sonraki turdan çıkarıldı)') : ''),
          select([[a, nm(a)], [b, nm(b)]], cur, v => { store.addEdit({ t: 'pens', comp, season, key: t.key, winner: +v, label: tp('Penaltı: {team} ({stage})', { team: nm(+v), stage: t.stage }) }); refresh(); }, { 'aria-label': tp('Penaltı kazananı') })));
      }
      foot.push(h('div', { class: 'dim', style: 'font-size:12.5px' }, d.how === 'away' ? tp('Deplasman golüyle') : d.how === 'agg' && t.matches.length > 1 ? tp('Toplam {a}–{b}', { a: d.agg[a], b: d.agg[b] }) : '', ' ', h('b', { style: 'color:var(--chalk)' }, d.winner != null ? `→ ${nm(d.winner)}` : '')));
    }
    const changed = d.edited || affected;
    return h('div', { class: `sheet`, style: `margin:10px 12px;${changed ? 'border-color:var(--marker)' : ''}` }, h('div', { class: 'bd', style: 'display:grid;grid-template-columns:minmax(0,1fr);gap:8px' }, ...legs, ...foot));
  }

  function drawNav() {
    const tabs = [];
    if (R.groups.length) tabs.push(h('button', { role: 'tab', 'aria-selected': String(S.si === -1), onclick: () => { S.si = -1; S.editing = null; drawList(); drawNav(); } }, `${R.groups.length > 1 ? tp('Gruplar') : tp('Lig aşaması')}`));
    stages.forEach((s, i) => tabs.push(h('button', { role: 'tab', 'aria-selected': String(S.si === i), onclick: () => { S.si = i; S.editing = null; drawList(); drawNav(); } }, `${trStage(s)} · ${counts[i]}`)));
    navBox.replaceChildren(h('div', { class: 'tabs', role: 'tablist' }, tabs));
  }

  // ---- grup / lig aşaması
  function groupMatchRow(m) {
    const e = scoresOf().get(m.id), hg = e ? e.hg : m.hg, ag = e ? e.ag : m.ag;
    if (S.editing === m.id) {
      const ih = h('input', { type: 'number', min: 0, max: 20, value: hg, style: 'width:46px', 'aria-label': tp('Ev golleri') }), ia = h('input', { type: 'number', min: 0, max: 20, value: ag, style: 'width:46px', 'aria-label': tp('Deplasman golleri') });
      for (const el of [ih, ia]) el.addEventListener('keydown', k => { if (k.key === 'Enter') commit(m, +ih.value, +ia.value); if (k.key === 'Escape') { S.editing = null; drawList(); } });
      queueMicrotask(() => ih.focus());
      return h('div', { class: 'fx' }, h('span', { class: 'd' }, fmtDay(m.date)), h('span', { class: 'h' }, h('span', { class: 'n' }, nm(m.h)), crestFor(ctx, m.h)), h('span', { class: 'sc' }, h('span', { class: 'scoreedit' }, ih, '-', ia)), h('span', { class: 'a' }, crestFor(ctx, m.a), h('span', { class: 'n' }, nm(m.a))), h('button', { class: 'btn sm mk', onclick: () => commit(m, +ih.value, +ia.value) }, tp('Tamam')));
    }
    return h('div', { class: `fx ${e ? 'chg' : ''}` }, h('span', { class: 'd' }, fmtDay(m.date)), h('span', { class: 'h' }, h('span', { class: 'n' }, nm(m.h)), crestFor(ctx, m.h)),
      h('span', { class: 'sc' }, h('button', { class: 'score', title: tp('Skoru değiştir'), onclick: () => { S.editing = m.id; drawList(); } }, `${hg} - ${ag}`)),
      h('span', { class: 'a' }, crestFor(ctx, m.a), h('span', { class: 'n' }, nm(m.a))), e ? h('span', { class: 'chip mk', title: tp('Gerçek skor') }, `${m.hg}-${m.ag}`) : h('span'));
  }
  function drawGroups() {
    const ev = S.ev, gi = Math.min(S.gi, R.groups.length - 1), g = R.groups[gi], alt = ev.groupAlt[gi].table;
    const big = g.table.length > 8;
    const sel = R.groups.length > 1 ? select(R.groups.map((x, i) => [i, trStage(x.label)]), gi, v => { S.gi = +v; S.editing = null; drawList(); }) : null;
    const realPos = new Map(g.table.map(r => [r.id, r.pos]));
    const tb = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { class: 'num' }, '#'), h('th', null, tp('Takım')), ...[tp('O'), tp('G'), tp('B'), tp('M'), tp('AV'), tp('P')].map(x => h('th', { class: 'num' }, x)), h('th', { class: 'num' }, 'Δ'))),
      h('tbody', null, alt.map(r => { const ent = g.entry.get(r.id); const real = realPos.get(r.id); return h('tr', { class: real !== r.pos ? 'chg' : '' }, h('td', { class: 'num' }, r.pos), h('td', null, teamLink(ctx, r.id, season), ent != null ? h('span', { class: 'chip uecl', style: 'margin-left:6px', title: tp('Gerçekte eleme turuna çıktı') }, trStage(stages[ent])) : null),
        h('td', { class: 'num' }, r.p), h('td', { class: 'num' }, r.w), h('td', { class: 'num' }, r.d), h('td', { class: 'num' }, r.l), h('td', { class: 'num' }, r.gd > 0 ? `+${r.gd}` : r.gd), h('td', { class: 'num pts' }, r.pts), h('td', { class: 'num' }, real !== r.pos ? delta(real - r.pos) : '')); })));
    let list = g.matches;
    let teamSel = null;
    if (big) {
      const tid = S.gteam ?? alt[0].id;
      list = g.matches.filter(m => m.h === tid || m.a === tid);
      teamSel = select(alt.map(r => [r.id, `${r.pos}. ${nm(r.id)}`]), tid, v => { S.gteam = +v; S.editing = null; drawList(); }, { 'aria-label': tp('Takım') });
    }
    mount(listBox, sheet(h('h2', null, R.groups.length > 1 ? tp('Grup aşaması') : tp('Lig aşaması')), h('div', null, h('div', { style: 'overflow:auto' }, tb),
      h('div', { class: 'md-h' }, big ? tp('Takımın maçları') : tp('Maçlar'), teamSel), ...list.map(groupMatchRow)), { tight: true, actions: [sel] }));
  }

  function drawList() {
    if (S.si === -1) { drawGroups(); return; }
    const ev = S.ev;
    const inStage = ties.filter(t => t.si === S.si);
    mount(listBox, sheet(h('h2', null, trStage(stages[S.si])), h('div', null, ...inStage.map(t => tieCard(t, ev))), { tight: true }));
  }

  // ---- tahmini UEFA primi
  const prize = CUP_PRIZE[comp];
  function prizeMap(ev) {
    const m = new Map(), add = (tm, v) => m.set(tm, (m.get(tm) || 0) + v);
    ties.forEach(t => { const b = prize[t.stage.toLowerCase()] ?? 0; if (b) for (const [tm, p] of ev.reach[t.idx]) add(tm, p * b); });
    for (const [tm, p] of ev.champs) add(tm, p * (prize.champion || 0));
    return m;
  }
  let base0 = null;

  function drawImpact() {
    const ev = S.ev, edits = [...(store.active()?.edits || [])].filter(e => (e.t === 'result' || e.t === 'pens') && e.comp === comp && e.season === season);
    const lastTie = ties[ties.length - 1];
    const realChamp = lastTie.real.winner;
    const top = [...ev.champs].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const list = edits.length ? h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1) calc(var(--pad) * -1) 12px' }, edits.map(e => h('li', null, h('span', { class: 'chip mk' }, e.t === 'pens' ? tp('Penaltı') : `${e.real[0]}-${e.real[1]} → ${e.hg}-${e.ag}`), h('span', { style: 'flex:1' }, e.label),
      h('button', { class: 'btn sm ghost', onclick: () => { store.removeEdit(x => x.t === e.t && x.comp === comp && x.season === season && (e.t === 'pens' ? x.key === e.key : x.id === e.id)); refresh(); } }, tp('Kaldır'))))) : null;
    const rows = top.map(([id, p]) => h('tr', { class: id === realChamp ? 'me' : '' }, h('td', null, teamLink(ctx, id, season)), h('td', null, id === realChamp ? h('span', { class: 'chip gold' }, tp('Gerçek şampiyon')) : ''), h('td', { class: 'num' }, fmtPct(p, 1))));
    const realP = ev.champs.get(realChamp) ?? 0;
    let money = null;
    if (prize && edits.length) {
      base0 ??= prizeMap(evaluate(R, { comp, season, edits: new Map(), pens: new Map(), startElo, n: 1 }));
      const alt = prizeMap(ev);
      const diffs = [...new Set([...alt.keys(), ...base0.keys()])].map(id => [id, (alt.get(id) || 0) - (base0.get(id) || 0)]).filter(x => Math.abs(x[1]) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
      if (diffs.length) money = h('div', { style: 'margin-top:14px' }, h('div', { class: 'cap', style: 'margin-bottom:4px' }, tp('Tahmini UEFA primi farkı')), h('table', { class: 'tbl' }, h('tbody', null, diffs.map(([id, v]) => h('tr', null, h('td', null, teamLink(ctx, id, season)), h('td', { class: 'num' }, moneyDelta(v * 1e6)))))), h('div', { class: 'dim', style: 'font-size:12px;margin-top:4px' }, tp('Yalnızca tura çıkma ve şampiyonluk primleri (kaba ortalama); gruptaki katılım payı dahil değil.')));
    }
    const body = h('div', null, list,
      edits.length ? h('div', { class: 'kpi', style: 'margin-bottom:10px' }, h('div', { class: 'l' }, tp('Gerçek şampiyonun şansı')), h('div', { class: 'v', style: realP < 0.999 ? 'color:var(--marker)' : '' }, fmtPct(realP, 1)), h('div', { class: 'dim', style: 'font-size:12px' }, ev.affected ? tp('{name} · {n} simülasyon', { name: nm(realChamp), n: ev.n.toLocaleString(LOC) }) : tp('Değişiklik şampiyonu etkilemedi'))) : h('div', { class: 'note', style: 'margin-bottom:10px' }, tp('Bir ayağın skoruna tıkla ya da penaltı kazananını değiştir. Grup/lig aşamasında bir maçı değiştirirsen, tura çıkan takımlar da değişir ve yerine geçenler eleme turlarında yeniden oynanır.')),
      h('div', { class: 'cap', style: 'margin-bottom:4px' }, tp('Şampiyonluk olasılığı')),
      h('table', { class: 'tbl' }, h('tbody', null, rows)), money,
      h('div', { class: 'dim', style: 'font-size:12px;margin-top:8px' }, tp('Gerçek kazananlar, bir sonraki turda görünen takımdan çıkarılır (veri penaltı sonucunu içermez). Deplasman golü kuralı 2021 öncesi UEFA kupalarında uygulanır. Grup sıralaması puan–averaj–atılan gol ile hesaplanır.')));
    mount(impactBox, sheet(h('h2', null, tp('Etki')), body));
  }

  function refresh() { S.ev = compute(); drawNav(); drawList(); drawImpact(); }
  refresh();
}
