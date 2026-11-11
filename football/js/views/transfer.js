// Transfer What-If: bir transferi iptal et ya da yeni bir transfer yap; kadro değeri → takım gücü → sezon sonucu zinciri.
import { h, svg, mount, setCrumbs, crest, fmtMoney, fmtPct, fmtDate, seasonLabel, norm, debounce, toast, go, ageOn } from '../util.js';
import { autoXI, lineupQuality, ELO_PER_LN } from '../matchsim.js';
import { stintMap, chemistry, CHEM_PER_UNIT, monthOfSeason } from '../strength.js';
import { boot, pick, clubItems, select, field, seg, sheet, pageHead, delta, moneyDelta, teamLink, crestFor, avatar } from '../ui.js';
import { loadTransfers, loadPlayers, loadSquads, loadElo, loadMatches, loadStints, LAST_SEASON, CURRENT_SEASON } from '../data.js';
import { simulateSeason, probIn, computeTable } from '../engine.js';
import { defaultSlots, positionOutcome } from '../rules.js';
import * as store from '../store.js';
import { t, lang } from '../i18n.js';

const YEARS_AHEAD = 3;

export async function render(app, seasonArg) {
  const ctx = await boot();
  const P = await loadPlayers();
  const season = seasonArg ? +seasonArg : CURRENT_SEASON;
  setCrumbs(t('Transfer'), seasonLabel(season));

  const all = await loadTransfers(season);
  const S = { mode: store.pref('trMode', 'cancel'), q: '', paid: season < CURRENT_SEASON, shown: 40, impact: null, b: { pid: null, to: null, fee: 0 } };
  const edits = () => store.transferEdits(season);

  const seaSel = select(Array.from({ length: CURRENT_SEASON - 2003 + 1 }, (_, i) => CURRENT_SEASON - i).map(s => [s, (s === CURRENT_SEASON ? t('{s} transfer dönemi (güncel)', { s: seasonLabel(s) }) : t('{s} transfer dönemi', { s: seasonLabel(s) }))]), season, v => go(`/transfer/${v}`));
  const modeBox = h('div'), bodyBox = h('div'), impactBox = h('div');
  mount(app, pageHead(t('Transferi değiştir'), t('Gerçekleşen bir transferi iptal et ya da hiç olmamış bir transfer yap. Takımların sezonu nasıl değişirdi, görürsün.'), field(t('Hangi dönem?'), seaSel)),
    h('div', { style: 'margin-bottom:20px' }, modeBox),
    h('div', { class: 'grid cols-2' }, bodyBox, impactBox));

  function drawMode() {
    mount(modeBox, seg([['cancel', t('Bir transferi iptal et')], ['new', t('Yeni bir transfer yap')]], S.mode, v => { S.mode = v; store.setPref('trMode', v); drawMode(); drawBody(); }));
  }
  const drawBody = () => (S.mode === 'cancel' ? drawCancel() : drawNew());

  // ------------------------------------------------------------ 1) iptal
  const search = h('input', { type: 'search', placeholder: t('Oyuncu ya da kulüp ara… (ör. Bellingham)'), value: S.q, style: 'width:100%', 'aria-label': t('Oyuncu ya da kulüp ara'), oninput: debounce(e => { S.q = e.target.value; S.shown = 40; drawCancel(); }, 120) });
  function drawCancel() {
    const q = norm(S.q).trim().split(' ').filter(Boolean);
    let rows = all.filter(tr => tr.to && tr.from && (!S.paid || (tr.fee || 0) > 0));
    if (q.length) rows = rows.filter(tr => { const k = norm(`${P.byId.get(tr.pid)?.name || ''} ${ctx.clubName(tr.from)} ${ctx.clubName(tr.to)}`); return q.every(x => k.includes(x)); });
    rows.sort((a, b) => (b.fee || 0) - (a.fee || 0) || b.mv - a.mv);
    const shown = rows.slice(0, S.shown);
    const cancelled = new Set(edits().filter(e => e.mode === 'cancel').map(e => e.pid));
    const list = h('ul', { class: 'list-plain' }, shown.map(tr => {
      const p = P.byId.get(tr.pid);
      return h('li', { style: cancelled.has(tr.pid) ? 'background:var(--marker-soft)' : '' },
        avatar({ name: p?.name, img: p?.img }),
        h('div', { style: 'flex:1;min-width:160px' }, h('div', { style: 'font-weight:600' }, p ? p.name : `#${tr.pid}`), h('div', { class: 'dim', style: 'font-size:14px' }, `${ctx.clubName(tr.from)} → ${ctx.clubName(tr.to)} · ${fmtDate(tr.date)}`)),
        h('div', { style: 'font:700 16px var(--f-display)' }, tr.fee ? fmtMoney(tr.fee) : tr.det ? t('ücret bilinmiyor') : t('serbest')),
        cancelled.has(tr.pid) ? h('span', { class: 'chip mk' }, t('İptal edildi')) : h('button', { class: 'btn sm primary', onclick: () => cancelTransfer(tr, p) }, t('İptal et')));
    }));
    mount(bodyBox, sheet(h('h2', null, t('{s} transferleri', { s: seasonLabel(season) })), h('div', null,
      h('div', { style: 'padding:14px 20px;display:grid;gap:10px;border-bottom:1px solid var(--line)' }, search,
        h('label', { class: 'row center', style: 'gap:8px;font-size:14.5px' }, h('input', { type: 'checkbox', checked: S.paid, onchange: e => { S.paid = e.target.checked; drawCancel(); } }), t('Sadece bonservisli transferler'))),
      rows.length ? list : h('div', { class: 'empty' }, h('h3', null, t('Transfer bulunamadı')), h('div', null, t('Aramayı değiştir ya da başka bir dönem seç.'))),
      rows.length > S.shown ? h('div', { style: 'padding:14px 20px' }, h('button', { class: 'btn', onclick: () => { S.shown += 60; drawCancel(); } }, t('Daha fazla göster ({n})', { n: rows.length - S.shown }))) : null), { tight: true }));
    if (document.activeElement === document.body && S.q) search.focus();
  }
  function cancelTransfer(tr, p) {
    store.addEdit({ t: 'transfer', mode: 'cancel', season, pid: tr.pid, from: tr.from, to: tr.to, fee: tr.fee || 0, label: t('İptal: {p} {from} → {to} ({s})', { p: p?.name || tr.pid, from: ctx.clubName(tr.from), to: ctx.clubName(tr.to), s: seasonLabel(season) }) });
    toast(t('Transfer iptal edildi')); S.impact = null; refresh();
  }

  // ------------------------------------------------------------ 2) yeni transfer
  function drawNew() {
    const b = S.b, p = b.pid ? P.byId.get(b.pid) : null;
    const step = (n, title, done, content) => h('div', { class: 'sheet', style: 'margin-bottom:14px' }, h('div', { class: 'bd', style: 'display:grid;gap:12px' },
      h('div', { class: 'row center', style: 'gap:12px' }, h('span', { class: 'chip', style: `background:${done ? 'var(--brand-soft)' : 'var(--surface-3)'};color:${done ? 'var(--brand)' : 'var(--ink-2)'}` }, done ? '✓' : n), h('h3', { style: 'font-size:18px' }, title)), content));
    const pickPlayer = h('button', { class: 'btn lg', onclick: async () => {
      const items = P.list.filter(x => x.value >= 1e6 && (x.lastSeason ?? 0) >= season).sort((a, c) => c.value - a.value).slice(0, 6000).map(x => ({ id: x.id, label: x.name, sub: x.nat || '', right: fmtMoney(x.value), tag: x.pos || x.line, tagCls: x.line }));
      const id = await pick({ title: t('Oyuncu seç'), items, placeholder: t('Oyuncu ara… (ör. Icardi)') });
      if (id) { b.pid = id; b.fee = P.byId.get(id).value || 0; drawNew(); }
    } }, p ? `${p.name} · ${fmtMoney(p.value)}` : t('Oyuncu seç'));
    const pickClub = h('button', { class: 'btn lg', disabled: !p, onclick: async () => {
      const ids = Object.keys(ctx.clubs).map(Number).filter(i => ctx.clubs[i].c && ctx.comps[ctx.clubs[i].c]?.type === 'league');
      const id = await pick({ title: t('Hangi kulübe gitsin?'), items: clubItems(ctx, ids, i => ctx.compName(ctx.clubs[i].c)), placeholder: t('Kulüp ara…') });
      if (id) { b.to = id; drawNew(); }
    } }, b.to ? ctx.clubName(b.to) : t('Kulüp seç'));
    const fee = h('div', { class: 'row center' }, h('input', { type: 'number', min: 0, step: 1, value: Math.round((b.fee || 0) / 1e6), style: 'width:120px', 'aria-label': t('Bonservis milyon euro'), onchange: e => { b.fee = Math.max(0, +e.target.value || 0) * 1e6; } }), h('span', { class: 'mute' }, t('milyon € (varsayılan: oyuncunun piyasa değeri)')));
    mount(bodyBox,
      step(1, t('Hangi oyuncu?'), !!p, pickPlayer),
      step(2, t('Hangi kulübe gitsin?'), !!b.to, pickClub),
      step(3, t('Ne kadar bonservis?'), !!(p && b.to), fee),
      h('button', { class: 'btn primary lg', disabled: !(b.pid && b.to), onclick: () => addNew(b) }, t('Transferi yap ve sonucu gör')));
  }
  async function addNew(b) {
    const sq = await loadSquads(season);
    let from = 0;
    for (const [cid, list] of Object.entries(sq)) if (list.some(r => r[0] === b.pid)) { from = +cid; break; }
    const p = P.byId.get(b.pid);
    if (!from) { toast(t('Bu oyuncu o sezon bir takım kadrosunda görünmüyor; başka bir dönem dene')); return; }
    if (from === b.to) { toast(t('Oyuncu zaten bu kulüpte')); return; }
    store.addEdit({ t: 'transfer', mode: 'move', season, pid: b.pid, from, to: b.to, fee: b.fee, label: t('Yeni: {p} {from} → {to} ({s})', { p: p.name, from: ctx.clubName(from), to: ctx.clubName(b.to), s: seasonLabel(season) }) });
    toast(t('Transfer yapıldı')); S.impact = null; S.b = { pid: null, to: null, fee: 0 }; refresh();
  }

  // ------------------------------------------------------------ sonuç
  async function drawImpact() {
    const es = edits();
    if (!es.length) {
      mount(impactBox, sheet(h('h2', null, t('Ne değişti?')), h('div', { class: 'empty' }, h('h3', null, t('Henüz bir transfer değiştirmedin')), h('div', null, S.mode === 'cancel' ? t('Soldan bir transferin yanındaki “İptal et” düğmesine bas.') : t('Soldaki adımları tamamla.')), h('div', { class: 'dim' }, t('Sonuç, gelecek 3 sezon için hesaplanır.')))));
      return;
    }
    mount(impactBox, sheet(h('h2', null, t('Ne değişti?')), h('div', null, editList(es), h('div', { class: 'skel', style: 'height:140px;margin-top:14px' }))));
    const imp = S.impact ??= await computeImpact(ctx, P, season, es);
    if (!document.body.contains(impactBox)) return;
    mount(impactBox, sheet(h('h2', null, t('Ne değişti?')), h('div', null, editList(es), impactView(imp))));
  }
  const editList = es => h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1) calc(var(--pad) * -1) 16px' }, es.map(e => h('li', null, h('span', { class: `chip ${e.mode === 'cancel' ? 'rel' : 'promo'}` }, e.mode === 'cancel' ? t('İptal') : t('Yeni')), h('span', { style: 'flex:1;min-width:160px' }, e.label),
    h('button', { class: 'btn sm ghost', onclick: () => { store.removeEdit(x => x.t === 'transfer' && x.pid === e.pid && x.season === e.season); S.impact = null; refresh(); } }, t('Kaldır')))));

  function impactView(imp) {
    if (!imp.rows.length) return h('div', { class: 'note' }, t('Bu değişiklik, elimizdeki kadro verisiyle ölçülebilir bir güç farkı yaratmıyor (oyuncu kadro listesinde olmayabilir).'));
    const byClub = new Map();
    for (const r of imp.rows) (byClub.get(r.club) || byClub.set(r.club, []).get(r.club)).push(r);
    const f1 = x => (lang === 'en' ? x.toFixed(1) : x.toFixed(1).replace('.', ','));
    const ord = x => (x >= 0 ? '+' : '−') + f1(Math.abs(x));
    const kpi = (l, v, sub, tone) => h('div', { class: 'kpi' }, h('div', { class: 'v', style: `font-size:20px;${tone === 'up' ? 'color:var(--win)' : tone === 'dn' ? 'color:var(--loss)' : ''}` }, v), h('div', { class: 'l' }, l), sub ? h('div', { class: 'dim', style: 'font-size:12px' }, sub) : null);
    const playerLines = [...imp.players.values()].map(o => {
      const p = P.byId.get(o.pid); if (!p) return null;
      const where = (c, st) => (st == null ? ctx.clubName(c) : st ? t('{c} (ilk 11)', { c: ctx.clubName(c) }) : t('{c} (yedek)', { c: ctx.clubName(c) }));
      return h('div', { class: 'row center', style: 'gap:12px;padding:10px 0;border-bottom:1px solid var(--line)' }, avatar({ name: p.name, img: p.img }),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { style: 'font-weight:700' }, p.name, h('span', { class: 'dim', style: 'font-weight:500' }, `  ${p.pos || p.line} · ${fmtMoney(o.v)}`)),
          h('div', { class: 'dim', style: 'font-size:13.5px' }, t('Gerçekte {a}  ·  Değişiklikle {b}', { a: where(o.realClub, o.startsReal), b: where(o.altClub, o.startsAlt) }))));
    }).filter(Boolean);
    const blocks = [...byClub].map(([club, rs]) => {
      const first = rs.find(r => r.sim) || rs[0], cash = imp.cash.get(club) || 0, sm = first.sim;
      let sentence = t('Takım gücü değişirdi.'), tone = 'eq';
      if (sm) {
        tone = sm.dPts > 0.4 ? 'up' : sm.dPts < -0.4 ? 'dn' : 'eq';
        const pos = Math.round(sm.expPos[0]) === Math.round(sm.expPos[1]) ? t('Beklenen sıra aynı kalırdı ({p}).', { p: f1(sm.expPos[1]) }) : t('Beklenen sıra {a} → {b}.', { a: f1(sm.expPos[0]), b: f1(sm.expPos[1]) });
        sentence = Math.abs(sm.dPts) < 0.4 ? t('Sezon sonucu neredeyse değişmezdi ({d} puan). {pos}', { d: ord(sm.dPts), pos }) : sm.dPts > 0 ? t('Sezonu ortalama {d} puan daha fazla bitirirdi. {pos}', { d: f1(Math.abs(sm.dPts)), pos }) : t('Sezonu ortalama {d} puan daha az bitirirdi. {pos}', { d: f1(Math.abs(sm.dPts)), pos });
      }
      const head = first, hs = head.sim;
      const tiles = hs ? h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:10px 0' },
        kpi(t('Puan (ortalama)'), ord(hs.dPts), t('güç {d} Elo', { d: `${head.dElo >= 0 ? '+' : '−'}${Math.abs(Math.round(head.dElo))}` }), hs.dPts > 0.4 ? 'up' : hs.dPts < -0.4 ? 'dn' : ''),
        kpi(t('Şampiyonluk'), t('%{p}', { p: Math.round(hs.title[1] * 100) }), t('önce %{p}', { p: Math.round(hs.title[0] * 100) }), hs.title[1] > hs.title[0] + .005 ? 'up' : hs.title[1] < hs.title[0] - .005 ? 'dn' : ''),
        kpi(t('Avrupa'), t('%{p}', { p: Math.round(hs.euro[1] * 100) }), t('önce %{p}', { p: Math.round(hs.euro[0] * 100) }), hs.euro[1] > hs.euro[0] + .005 ? 'up' : hs.euro[1] < hs.euro[0] - .005 ? 'dn' : ''),
        hs.slots.rel > 0 ? kpi(t('Küme düşme'), t('%{p}', { p: Math.round(hs.rel[1] * 100) }), t('önce %{p}', { p: Math.round(hs.rel[0] * 100) }), hs.rel[1] < hs.rel[0] - .005 ? 'up' : hs.rel[1] > hs.rel[0] + .005 ? 'dn' : '') : null) : null;
      const tb = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, t('Sezon')), h('th', { class: 'num' }, t('Puan')), h('th', { class: 'num' }, t('Beklenen sıra')), h('th', { class: 'num' }, t('Şampiyonluk')), h('th', { class: 'num' }, t('Avrupa')), h('th', { class: 'num' }, t('Gelir')))),
        h('tbody', null, rs.map(r => h('tr', null, h('td', null, seasonLabel(r.season), r.real ? h('span', { class: 'dim' }, '  ' + t('(gerçek {n}.)', { n: r.real })) : null),
          h('td', { class: 'num' }, r.sim ? delta(r.sim.dPts, { digits: 1 }) : h('span', { class: 'dim' }, '—')),
          h('td', { class: 'num' }, r.sim ? `${f1(r.sim.expPos[0])} → ${f1(r.sim.expPos[1])}` : '—'),
          h('td', { class: 'num' }, r.sim ? pp(r.sim.title) : '—'), h('td', { class: 'num' }, r.sim ? pp(r.sim.euro) : '—'), h('td', { class: 'num' }, r.sim ? moneyDelta(r.sim.rev) : '—')))));
      return h('div', { style: 'margin-bottom:22px;padding-bottom:6px' },
        h('div', { class: 'row center', style: 'margin-bottom:4px' }, teamLink(ctx, club, season), h('span', { class: 'dim' }, t('transfer kasası:')), moneyDelta(cash)),
        h('p', { style: `margin:4px 0 0;font-size:16.5px;font-weight:600;${tone === 'up' ? 'color:var(--win)' : tone === 'dn' ? 'color:var(--loss)' : ''}` }, sentence), tiles,
        hs ? h('div', null, h('div', { class: 'cap', style: 'margin:6px 0 2px' }, t('{s} · sezon sonu sıra olasılığı (gri: gerçek, yeşil: değişiklikle)', { s: seasonLabel(head.season) })), posChart(hs)) : null,
        h('div', { style: 'overflow:auto;margin:12px calc(var(--pad) * -1) 0' }, tb));
    });
    return h('div', null, playerLines.length ? h('div', { style: 'margin-bottom:16px' }, ...playerLines) : null, ...blocks, h('div', { class: 'dim', style: 'font-size:13.5px' }, t('Her sezon {n} kez yeniden oynatıldı. Takım gücü, en iyi dizilişteki ilk 11’in konuma ve yaşa göre hesaplanan hücum/savunma kalitesinden ve takım kimyasından (kim kiminle daha önce oynadı, yeni gelen kulübe ne kadar uyum sağladı) bulunur; oyuncu gerçekte bir sonraki kulüp değişikliğine kadar yeni takımında kalıyor sayıldı.', { n: imp.n })));
  }
  function posChart(sm) {
    const n = Math.min(sm.nC, 20), W = 620, Hh = 110, pl = 6, bw = (W - pl * 2) / n, max = Math.max(0.05, ...sm.pa.slice(0, n), ...sm.pb.slice(0, n));
    const root = svg('svg', { viewBox: `0 0 ${W} ${Hh + 20}`, width: '100%', role: 'img', 'aria-label': t('Sezon sonu sıra olasılığı') });
    const zone = i => (i < sm.slots.ucl ? 'var(--ucl)' : i < sm.slots.ucl + sm.slots.el ? 'var(--el)' : sm.slots.rel > 0 && i >= sm.nC - sm.slots.rel ? 'var(--loss)' : 'var(--line-2)');
    for (let i = 0; i < n; i++) {
      const x = pl + i * bw, ha = sm.pa[i] / max * Hh, hb = sm.pb[i] / max * Hh;
      root.append(svg('rect', { x: x + bw * 0.1, y: Hh - ha, width: bw * 0.38, height: Math.max(1, ha), rx: 2, fill: 'var(--ink-3)', opacity: 0.5 }),
        svg('rect', { x: x + bw * 0.5, y: Hh - hb, width: bw * 0.38, height: Math.max(1, hb), rx: 2, fill: 'var(--brand)' }),
        svg('rect', { x: x + 2, y: Hh + 3, width: bw - 4, height: 3, rx: 1.5, fill: zone(i) }),
        svg('text', { x: x + bw / 2, y: Hh + 18, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-3)' }, String(i + 1)));
    }
    return h('div', { style: 'max-width:100%' }, root);
  }
  const pp = ([b, a]) => h('span', null, h('span', { class: 'dim' }, fmtPct(b) + ' → '), h('span', { style: a > b + .005 ? 'color:var(--win);font-weight:700' : a < b - .005 ? 'color:var(--loss);font-weight:700' : '' }, fmtPct(a)));

  function refresh() { drawMode(); drawBody(); drawImpact(); }
  refresh();
}

// ------------------------------------------------------------------------------ hesap
const FORMS = ['4-2-3-1', '4-3-3', '4-4-2'];
/**
 * Kadronun konuma duyarlı gücü (Elo ölçeğinde): ilk 11'in (mevki uyumlu, yaşa göre düzeltilmiş) hücum/savunma kalitesi
 * + TAKIM KİMYASI (kim kiminle daha önce oynadı, yeni gelen kulübe ne kadar uyum sağladı). Üç dizilişten en iyisi alınır.
 * Böylece yıldız alıp kimyayı bozmak da, derin kadrodan birini satmak da gerçekçi biçimde ölçülür.
 */
function power(list, { club, ref, S, compOf }) {
  const by = new Map(list.map(p => [p.id, p]));
  let best = -1e9, bestXI = [], bestF = FORMS[0];
  for (const f of FORMS) {
    const xi = autoXI(list, f), q = lineupQuality(by, f, xi);
    const sc = ELO_PER_LN * 0.5 * (q.A + q.D);
    if (sc > best) { best = sc; bestXI = xi; bestF = f; }
  }
  const c = chemistry({ xi: bestXI, formation: bestF, byId: by, S, ref, club, compOf });
  return { score: best + CHEM_PER_UNIT * c.team, xi: bestXI, chem: c.team };
}

async function computeImpact(ctx, P, season, edits) {
  const n = 1500;
  const S = stintMap(await loadStints());
  const compOf = c => ctx.clubs[c]?.c;
  const toPl = (r, sn = season) => { const p = P.byId.get(r[0]); return { id: r[0], value: r[1] || p?.value || 3e5, line: p?.line || 'M', pos: p?.pos || '', age: ageOn(p?.dob, new Date(`${sn + 1}-01-01`)), nat: p?.nat || '' }; };
  const players = new Map();
  const squads = {};
  for (let k = 0; k <= YEARS_AHEAD; k++) squads[season + k] = season + k <= CURRENT_SEASON ? await loadSquads(season + k) : null;
  const clubOf = (pid, s) => { const sq = squads[s]; if (!sq) return null; for (const [cid, list] of Object.entries(sq)) if (list.some(r => r[0] === pid)) return +cid; return null; };
  const valOf = (pid, s) => { const sq = squads[s]; if (!sq) return null; for (const list of Object.values(sq)) { const r = list.find(x => x[0] === pid); if (r) return r[1]; } return P.byId.get(pid)?.value ?? null; };

  // her düzenleme için sezon başına: {real club, alt club, value}
  const moves = [];
  for (const e of edits) {
    const realClub = e.mode === 'cancel' ? e.to : e.from, altClub = e.mode === 'cancel' ? e.from : e.to;
    for (let k = 0; k <= YEARS_AHEAD; k++) {
      const s = season + k;
      if (!squads[s]) break;
      const rc = k === 0 ? realClub : clubOf(e.pid, s);
      if (k > 0 && rc !== realClub) break;     // gerçekte oyuncu başka yere gitti: gerçeğe dön
      moves.push({ s, pid: e.pid, realClub, altClub, v: valOf(e.pid, s) ?? e.fee ?? 0 });
    }
  }
  const rows = [], cash = new Map();
  for (const e of edits) {
    const alt = e.mode === 'cancel' ? e.from : e.to, rl = e.mode === 'cancel' ? e.to : e.from;
    // iptal: alıcı (rl) harcamaz, satıcı (alt) para almaz; yeni: tersi
    const sign = e.mode === 'cancel' ? 1 : -1;
    cash.set(rl, (cash.get(rl) || 0) + sign * e.fee);
    cash.set(alt, (cash.get(alt) || 0) - sign * e.fee);
  }
  for (let k = 0; k <= YEARS_AHEAD; k++) {
    const s = season + k;
    if (!squads[s]) break;
    const ms = moves.filter(m => m.s === s);
    if (!ms.length) continue;
    const clubs = new Set(ms.flatMap(m => [m.realClub, m.altClub]));
    const dElo = new Map(), dV = new Map();
    for (const c of clubs) {
      const base = [...(squads[s][c] || [])];
      let list = [...base];
      for (const m of ms) {
        if (m.realClub === c) list = list.filter(r => r[0] !== m.pid);
        if (m.altClub === c && !list.some(r => r[0] === m.pid)) list.push([m.pid, m.v]);
      }
      const top = a => a.map(r => r[1]).sort((x, y) => y - x).slice(0, 18).reduce((q, v) => q + v, 0);
      // kimya: gelen oyuncu bu kulübe ilk kez katılmış sayılır (cancel modunda gerçekte gittiği kulübe hiç gitmemiş = oradaki dönemi sürer)
      const Sx = new Map(S);
      for (const m of ms) if (m.altClub === c) {
        const st = [...(S.get(m.pid) || [])], at = st.findIndex(x => x[0] === c);
        if (at >= 0) st[at] = [c, st[at][1], 9999]; else st.push([c, monthOfSeason(season), 9999]);
        Sx.set(m.pid, st);
      }
      const opt = { club: c, ref: monthOfSeason(s), compOf };
      const pb = power(base.map(r => toPl(r, s)), { ...opt, S }), pa = power(list.map(r => toPl(r, s)), { ...opt, S: Sx });
      dElo.set(c, pa.score - pb.score); dV.set(c, top(list) - top(base));
      if (s === season) for (const m of ms) {
        const o = players.get(m.pid) || { pid: m.pid };
        o.v = m.v; o.altClub = m.altClub; o.realClub = m.realClub;
        if (m.realClub === c) o.startsReal = pb.xi.includes(m.pid);
        if (m.altClub === c) o.startsAlt = pa.xi.includes(m.pid);
        players.set(m.pid, o);
      }
    }
    // lig bazında simülasyon
    const byComp = new Map();
    for (const c of clubs) { const comp = ctx.clubs[c]?.c; if (comp) (byComp.get(comp) || byComp.set(comp, []).get(comp)).push(c); }
    const simOut = new Map();
    for (const [comp, cs] of byComp) {
      if (ctx.comps[comp]?.type !== 'league') continue;
      const matches = await loadMatches(comp, s);
      if (!matches.length) continue;
      const present = cs.filter(c => matches.some(m => m.h === c || m.a === c));
      if (!present.length) continue;
      const eloRaw = await loadElo(s); const startElo = new Map(Object.entries(eloRaw || {}).map(([a, b]) => [+a, b]));
      const delta = new Map(present.map(c => [c, dElo.get(c)]));
      const A = simulateSeason({ matches, startElo, n, seed: 5 + s }), B = simulateSeason({ matches, startElo, ratingDelta: delta, n, seed: 5 + s });
      const nC = new Set(matches.flatMap(m => [m.h, m.a])).size, slots = defaultSlots(comp, s, nC);
      const realTable = k === 0 ? computeTable(matches, { comp }) : null;
      for (const c of present) {
        const a = A.teams.get(c), b = B.teams.get(c);
        const rev = x => x.posProb.reduce((q, p, i) => q + p * positionOutcome(comp, i + 1, nC, slots).revenue, 0);
        const ep = x => x.posProb.reduce((q, p, i) => q + p * (i + 1), 0), rl = x => (slots.rel > 0 ? probIn(x.posProb, nC - slots.rel + 1, nC) : 0);
        simOut.set(c, { expPos: [ep(a), ep(b)], rel: [rl(a), rl(b)], pa: a.posProb, pb: b.posProb, nC, slots, dPts: b.expPts - a.expPts, title: [probIn(a.posProb, 1, 1), probIn(b.posProb, 1, 1)], euro: [probIn(a.posProb, 1, slots.ucl + slots.el + slots.uecl), probIn(b.posProb, 1, slots.ucl + slots.el + slots.uecl)], rev: rev(b) - rev(a), real: realTable?.find(r => r.id === c)?.pos });
      }
    }
    for (const c of clubs) rows.push({ club: c, season: s, dV: dV.get(c), dElo: dElo.get(c), sim: simOut.get(c), real: simOut.get(c)?.real });
  }
  return { rows, cash, n, players };
}
