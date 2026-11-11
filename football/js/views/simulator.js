// Maç Simülatörü: iki takım, ilk 11, diziliş, taktik → binlerce kez simüle et.
import { h, mount, setCrumbs, crest, fmtMoney, fmtPct, ageOn, seasonLabel, debounce, toast, clamp, u } from '../util.js';
import { boot, pick, clubItems, select, field, seg, sheet, pageHead, crestFor, formStrip } from '../ui.js';
import { loadPlayers, loadSquads, loadElo, loadUpcoming, loadIntlElo, loadCurrent, loadManagers, loadStints, mgrAD, mgrInfo, LAST_SEASON } from '../data.js';
import { stintMap, chemistry, chemElo, monthNow, monthOfSeason, formFamiliarity, favouriteFormation, formElo, ovr } from '../strength.js';
import { eloChip, eloText, pickManager } from '../mgr.js';
import { tr, NAT_ALIAS } from '../nations.js';
import { FORMATIONS, autoXI, teamRatings, matchLambdas, simulate, playOne, HEALTHY, availOf } from '../matchsim.js';
import { teamContext, GOAL_ELO } from '../form.js';
import { lineupEditor, lastName } from '../lineup.js';
import { openLive } from '../liveview.js';
import { Match2D, GOAL_TAG } from '../match2d.js';
import { t, tl, LOC } from '../i18n.js';

const NOW = 'now';
const NA = tl('—', '-');       // boş değer göstergesi
const DASH = tl('–', '-');     // skor / aralık ayracı
const DEFAULT_TACTICS = () => ({ mentality: 50, tempo: 50, press: 50, width: 50, counter: 0 });

export async function render(app, argStr) {
  const ctx = await boot();
  const [P, M, rawStints] = await Promise.all([loadPlayers(), loadManagers(), loadStints()]);
  const STINTS = stintMap(rawStints);
  setCrumbs(t('Maç Simülatörü'));
  const params = new URLSearchParams(argStr || '');

  const sides = { h: null, a: null };
  const O = { mode: 'club', active: 'h', neutral: false, knockout: false, n: 10000 };
  let res = null, story = null, editor = null;

  async function loadSide(clubId, season, kind = O.mode) {
    if (kind === 'nation') {
      const squad = buildNationSquad(P, clubId);
      const elo = (await natElo()).get(clubId) ?? teamEloFromSquad(squad);
      return { kind, clubId, season: NOW, squad, baseSquad: [...squad], removed: [], avail: new Map(), tc: null, elo, formation: '4-2-3-1', xi: autoXI(squad, '4-2-3-1'), tactics: DEFAULT_TACTICS() };
    }
    const squad = await buildSquad(ctx, P, clubId, season);
    const eloSnap = await loadElo(season === NOW ? LAST_SEASON + 1 : season);
    const elo = eloSnap?.[clubId] ?? teamEloFromSquad(squad);
    const base = baseMgr(clubId, season), tc = await teamContext(ctx, clubId, season, NOW).catch(() => null);
    const formation = favouriteFormation(mgrInfo(M, base)?.forms) || '4-2-3-1';       // hocanın en çok kullandığı diziliş
    return { kind, clubId, season, squad, baseSquad: [...squad], removed: [], avail: new Map(), tc, elo, formation, xi: autoXI(squad, formation), tactics: DEFAULT_TACTICS(), mgr: { base, alt: null } };
  }
  /** Seçilen dönemde kulübü çalıştıran hoca: güncel kadroda görevdeki, geçmiş sezonda o yılın ocak ayındaki. */
  function baseMgr(clubId, season) {
    const c = M.c[clubId];
    if (!c) return null;
    if (season === NOW) return c.cur?.n || null;
    const d = `${season + 1}-01-15`;
    return (c.hist || []).find(r => r[1] <= d && d <= r[2])?.[0] || null;
  }
  const effElo = s => s.elo;
  const compOf = c => ctx.clubs[c]?.c;
  const refOf = s => (s.season === NOW ? monthNow() : monthOfSeason(s.season));
  const clubOf = s => (s.kind === 'nation' ? null : s.clubId);
  /** Kimya (FIFA tarzı bağlar): kim kiminle daha önce oynadı + kulübe uyum süresi. */
  const chemOf = (s, xi = s.xi, formation = s.formation, squad = s.squad) => chemistry({ xi, formation, byId: new Map(squad.map(p => [p.id, p])), S: STINTS, ref: refOf(s), club: clubOf(s), compOf });
  /** Bir tarafın maça özgü hücum/savunma puanı: kadro farkı + kimya + hoca + diziliş uyumu + taktik. Canlı izlemede de bu kullanılır. */
  function rateSide(s, squad = s.squad, formation = s.formation, xi = s.xi, tactics = s.tactics) {
    const c0 = chemOf(s, autoXI(s.baseSquad, formation, HEALTHY), formation, s.baseSquad), c1 = chemOf(s, xi, formation, squad);
    const [mA, mD] = s.mgr?.alt ? mgrAD(M, s.mgr.base, s.mgr.alt) : [0, 0];
    const name = s.mgr?.alt || s.mgr?.base, fam = name ? formFamiliarity(mgrInfo(M, name)?.forms, formation) : null;
    const tc = s.tc;      // sezon içi gelişim + son maç formu + oyun tarzı (hücum/savunma eğilimi, açık/kapalı oyun)
    const r = teamRatings({ baseElo: s.elo, squad, baseSquad: s.baseSquad, formation, xi, tactics, chemElo: chemElo(c1.team, c0.team), mgrA: mA, mgrD: mD, formElo: formElo(fam),
      avail: s.avail, seasonElo: tc?.elo0 != null ? tc.elo1 - tc.elo0 : 0, recentElo: tc?.form || 0, tiltElo: tc ? clamp(GOAL_ELO * 0.45 * tc.tilt, -30, 30) : 0, tot: tc?.tot ?? null });
    return { ...r, chemTeam: c1.team, chemRef: c0.team, newcomers: c1.newcomers, fam };
  }
  async function changeMgr(side) {
    const s = sides[side];
    const alt = await pickManager(ctx, M, { title: t('{team} için teknik direktör', { team: nameOf(s) }), exclude: s.mgr?.base });
    if (!alt) return;
    s.mgr.alt = alt;
    const fav = favouriteFormation(mgrInfo(M, alt)?.forms);     // yeni hoca kendi sistemini kurar
    if (fav) { s.formation = fav; s.xi = autoXI(s.squad, fav, s.avail); }
    editor = null; refresh();
  }
  function resetMgr(side) {
    const s = sides[side]; s.mgr.alt = null;
    const fav = favouriteFormation(mgrInfo(M, s.mgr.base)?.forms);
    if (fav) { s.formation = fav; s.xi = autoXI(s.squad, fav, s.avail); }
    editor = null; refresh();
  }
  const nameOf = s => (s.kind === 'nation' ? tr(s.clubId) : ctx.clubName(s.clubId));

  const defH = +(params.get('h') || 36), defA = +(params.get('a') || 141);
  const root = h('div');
  mount(app, pageHead(t('Maç Simülatörü'), t('İlk 11’i, dizilişi ve taktiği sen belirle; maçı on binlerce kez oynat. Geçmiş sezonların kadroları da seçilebilir.')), root);
  const upcoming = await loadUpcoming();

  function calc() {
    const hh = sides.h, aa = sides.a;
    const hr = rateSide(hh), ar = rateSide(aa);
    const [lh, la] = matchLambdas(hr, ar, { neutral: O.neutral, ha: O.mode === 'nation' ? 100 : undefined });
    const edge = Math.tanh(((hr.att + hr.def) - (ar.att + ar.def)) / 2 / 600) * 0.12;
    res = { hr, ar, lh, la, sim: simulate({ lh, la, n: O.n, knockout: O.knockout, qualityEdge: edge, seed: 20261027 }) };   // sabit tohum: paylaşılan maçı açan herkes aynı sayıları görür
    story = null;
  }

  async function changeTeam(side, clubId, season = sides[side].season) {
    sides[side] = await loadSide(clubId, season, O.mode);
    if (O.active === side) editor = null;
    refresh();
  }

  async function chooseClub(side) {
    if (O.mode === 'nation') {
      const elo = await natElo();
      const items = [...elo].filter(([, v]) => v > 1300).sort((x, y) => y[1] - x[1]).slice(0, 120).map(([t, v]) => ({ id: t, label: tr(t), sub: '', right: Math.round(v) }));
      const id = await pick({ title: side === 'h' ? t('Ev sahibi milli takım') : t('Deplasman milli takım'), items, placeholder: t('Ülke ara… (ör. Türkiye)') });
      if (id) await changeTeam(side, id);
      return;
    }
    const ids = Object.keys(ctx.clubs).map(Number).filter(id => ctx.clubs[id].c && ctx.comps[ctx.clubs[id].c]?.type === 'league');
    const id = await pick({ title: side === 'h' ? t('Ev sahibi takım') : t('Deplasman takımı'), items: clubItems(ctx, ids, id => ctx.compName(ctx.clubs[id].c)), placeholder: t('Takım ara… (ör. Galatasaray)') });
    if (id) { await changeTeam(side, id); }
  }
  async function setMode(mode) {
    O.mode = mode; O.neutral = mode === 'nation'; editor = null;
    sides.h = await loadSide(mode === 'nation' ? 'Turkey' : 36, NOW, mode); sides.a = await loadSide(mode === 'nation' ? 'Germany' : 141, NOW, mode);
    refresh();
  }
  async function changeSeason(season) {
    const s = season === NOW ? NOW : +season;
    sides.h = await loadSide(sides.h.clubId, s, 'club'); sides.a = await loadSide(sides.a.clubId, s, 'club'); editor = null; refresh();
  }

  const rec = debounce(() => { calc(); drawResults(); drawStrength(); }, 60);
  const resultsBox = h('div'), strengthBox = h('div'), tacticsBox = h('div');

  /** Kart içinde hoca satırı: görevdeki hoca + puanı; değiştirildiyse yeni hoca ve etkisi. */
  function mgrRow(side, s) {
    const m = s.mgr, name = m?.alt || m?.base, i = name && mgrInfo(M, name);
    const act = (txt, f) => h('span', { role: 'button', tabindex: 0, class: 'btn sm ghost', style: 'margin-left:6px', onclick: e => { e.stopPropagation(); f(); }, onkeydown: e => { if (e.key === 'Enter') { e.stopPropagation(); f(); } } }, txt);
    return h('div', { class: 'row center', style: 'gap:6px;margin-top:6px;font-size:13px;flex-wrap:wrap' }, h('span', { class: 'cap' }, t('Hoca')),
      name ? h('b', null, name) : h('span', { class: 'dim' }, t('bilinmiyor')), i ? eloChip(i.elo, { label: '' }) : null,
      m?.alt ? h('span', { class: 'chip mk', title: t('{prev} yerine; hücum {a}, savunma {d} Elo', { prev: m.base || t('önceki hoca'), a: eloText(Math.round(mgrAD(M, m.base, m.alt)[0])), d: eloText(Math.round(mgrAD(M, m.base, m.alt)[1])) }) }, t('H {a} · S {d}', { a: eloText(Math.round(mgrAD(M, m.base, m.alt)[0])), d: eloText(Math.round(mgrAD(M, m.base, m.alt)[1])) })) : null,
      act(t('Hoca seç'), () => changeMgr(side)), m?.alt ? act(t('Geri al'), () => resetMgr(side)) : null);
  }

  /** Kart içinde: son maç formu, oyun tarzı, sakat/şüpheli sayısı. */
  function ctxRow(s) {
    const tc = s.tc, hurt = s.squad.filter(p => availOf(p, s.avail) < 1);
    if (!tc && !hurt.length) return null;
    return h('div', { class: 'row center', style: 'gap:6px;margin-top:6px;font-size:13px;flex-wrap:wrap' },
      tc?.last?.length ? [h('span', { class: 'cap' }, t('Form')), formStrip(tc.last)] : null,
      tc?.played ? h('span', { class: `chip ${tc.form >= 8 ? 'uecl' : tc.form <= -8 ? 'rel' : ''}`, title: t('Son 6 maçın beklentiye göre puanı; takım gücüne en fazla ±25 Elo yansır') }, `${eloText(Math.round(tc.form))} Elo`) : null,
      tc ? h('span', { class: 'chip', title: t('Maç başına {gf} gol atıyor, {ga} yiyor (beklentiye göre hücum/savunma eğilimi ve maçlarındaki toplam gol)', { gf: tc.gf?.toFixed(2) ?? NA, ga: tc.ga?.toFixed(2) ?? NA }) }, t('Tarz: {label}', { label: tc.label })) : null,
      hurt.length ? h('span', { class: 'chip rel', title: hurt.map(p => `${p.name} (${t('%{n}', { n: Math.round(availOf(p, s.avail) * 100) })})`).join(', ') }, t('{n} sakat/şüpheli', { n: hurt.length })) : null);
  }

  function drawTeamBar() {
    const seasons = [[NOW, t('Güncel kadro')], ...Array.from({ length: LAST_SEASON - 2004 + 1 }, (_, i) => LAST_SEASON - i).map(s => [s, seasonLabel(s)])];
    const teamCard = side => {
      const s = sides[side];
      return h('button', { class: 'tile', style: `text-align:left;cursor:pointer;color:inherit;font:inherit;${O.active === side ? 'border-color:var(--chalk)' : ''}`, onclick: () => { O.active = side; editor = null; refresh(); }, 'aria-pressed': String(O.active === side) },
        h('div', { class: 'row center', style: 'gap:12px;flex-wrap:nowrap' }, (s.kind === 'nation' ? crest(nameOf(s), 'lg') : crestFor(ctx, s.clubId, 'lg')),
          h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'cap' }, side === 'h' ? t('Ev sahibi') : t('Deplasman')), h('div', { style: 'font:600 22px var(--font-c);letter-spacing:.03em;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, nameOf(s)),
            h('div', { class: 'dim', style: 'font-size:12.5px' }, t('{comp} · Elo {elo} · {n} oyuncu', { comp: s.kind === 'nation' ? t('Milli takım') : ctx.compName(ctx.clubs[s.clubId]?.c), elo: Math.round(effElo(s)), n: s.squad.length })),
            s.kind === 'nation' ? null : mgrRow(side, s), s.kind === 'nation' ? null : ctxRow(s)),
          h('span', { role: 'button', tabindex: 0, class: 'btn sm', onclick: e => { e.stopPropagation(); chooseClub(side); }, onkeydown: e => { if (e.key === 'Enter') { e.stopPropagation(); chooseClub(side); } } }, t('Değiştir'))));
    };
    const ups = upcoming.fixtures.slice(0, 6);
    return h('div', { class: 'grid', style: 'margin-bottom:14px' },
      h('div', { class: 'grid teams-row' }, teamCard('h'), h('div', { class: 'cap vs', style: 'font-size:18px' }, 'vs'), teamCard('a')),
      h('div', { class: 'row center' }, seg([['club', t('Kulüpler')], ['nation', t('Milli takımlar')]], O.mode, setMode, 'mk'), O.mode === 'club' ? field(t('Kadro dönemi'), select(seasons, sides.h.season, v => changeSeason(v))) : null,
        h('button', { class: 'btn', style: 'align-self:flex-end', onclick: async () => { const t = sides.h; sides.h = await loadSide(sides.a.clubId, t.season, O.mode); sides.a = await loadSide(t.clubId, t.season, O.mode); editor = null; refresh(); } }, t('⇄ Yer değiştir')),
        O.mode === 'club' && ups.length ? h('div', { class: 'row center', style: 'align-self:flex-end' }, h('span', { class: 'cap' }, t('Yaklaşan:')), ...ups.map(f => h('button', { class: 'btn sm', onclick: async () => { if (f.h && f.a) { sides.h = await loadSide(f.h, NOW); sides.a = await loadSide(f.a, NOW); editor = null; refresh(); } } }, `${ctx.clubs[f.h] ? ctx.clubName(f.h) : f.hn} ${DASH} ${ctx.clubs[f.a] ? ctx.clubName(f.a) : f.an}`))) : null));
  }

  function drawTactics() {
    const s = sides[O.active];
    const sl = (key, label, lo, hi) => h('div', { class: 'sl mk' }, h('div', { class: 't' }, h('span', null, label), h('span', { class: 'dim' }, `${lo} ↔ ${hi}`)),
      h('input', { type: 'range', min: 0, max: 100, value: s.tactics[key], 'aria-label': label, oninput: e => { s.tactics[key] = +e.target.value; rec(); } }));
    mount(tacticsBox, h('div', { class: 'sliders' }, sl('mentality', t('Mentalite'), t('Defansif'), t('Hücumcu')), sl('tempo', t('Tempo'), t('Yavaş'), t('Hızlı')), sl('press', t('Pres'), t('Düşük'), t('Yüksek')), sl('width', t('Kanat oyunu'), t('Dar'), t('Geniş')), sl('counter', t('Kontra ataklar'), t('Yok'), t('Çok'))),
      h('div', { class: 'dim', style: 'font-size:12px;margin-top:10px' }, t('Taktik etkileri sezgiseldir ve küçüktür (gol beklentisinde yaklaşık ±%10). Asıl fark ilk 11’den ve takım gücünden gelir.')));
  }

  function drawStrength() {
    const { hr, ar, lh, la } = res;
    const sg = x => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(Math.round(x))}`;
    const pair = (a, d) => `${sg(a)} / ${sg(d)}`;
    const col = (r, s) => ({
      base: Math.round(r.base), sezon: sg(r.season), form: sg(r.recent), tarz: t('{a} H / {d} S', { a: sg(r.tilt), d: sg(-r.tilt) }), sak: pair(r.injA, r.injD), kadro: pair(r.sqA, r.sqD), kimya: `${sg(r.chem)}  (${t('%{n}', { n: Math.round(r.chemTeam * 100) })}${r.newcomers ? `, ${t('{n} yeni', { n: r.newcomers })}` : ''})`,
      hoca: s.mgr?.alt || s.mgr?.base ? pair(r.mgrA, r.mgrD) : NA, dizi: r.fam == null ? NA : sg(r.form), takt: pair(r.tactA, r.tactD), out: `${Math.round(r.att)} / ${Math.round(r.def)}`,
    });
    const H = col(hr, sides.h), A = col(ar, sides.a);
    const row = (label, k, tip, strong) => h('tr', null, h('td', { title: tip }, strong ? h('b', null, label) : label), h('td', { class: 'num' }, strong ? h('b', null, H[k]) : H[k]), h('td', { class: 'num' }, strong ? h('b', null, A[k]) : A[k]));
    mount(strengthBox, h('div', { class: 'cap', style: 'margin-bottom:6px' }, t('Neden bu olasılıklar? (Elo · hücum / savunma)')),
      h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'num' }, nameOf(sides.h)), h('th', { class: 'num' }, nameOf(sides.a)))),
        h('tbody', null,
          row(t('Taban (sezon başı Elo)'), 'base', t('Kulübün gerçek (sağlıklı) kadrosunun gücü')),
          row(t('Sezon içi gelişme'), 'sezon', t('Bu sezon oynanan maçlarla güncellenen Elo − sezon başı Elo')),
          row(t('Son 6 maç formu'), 'form', t('Son maçların beklentiye göre puanı (en fazla ±25 Elo)')),
          row(t('Oyun tarzı (hücum / savunma)'), 'tarz', t('Gol atma/yeme eğiliminin beklentiden sapması; toplam gücü değiştirmez, hücum ve savunmaya ters yönde dağıtır')),
          row(t('Sakatlık / ilk 11 seçimi'), 'sak', t('Sakat ya da şüpheli oyuncuların yerine yedeğin oynaması ve en iyi 11’den elle yaptığın sapmalar; durumu slotta değiştirebilirsin')),
          row(t('Kadro farkı'), 'kadro', t('İlk 11’in kulübün gerçek en iyi 11’ine göre farkı; oyuncu gücü piyasa değerinden ve yaştan, mevki uyumuyla')),
          row(t('Takım kimyası'), 'kimya', t('Komşu mevkideki oyuncuların daha önce birlikte oynaması, ortak uyruk/lig, kulübe uyum süresi; gerçek ilk 11’e göre fark')),
          row(t('Teknik direktör'), 'hoca', t('Değiştirilen hocanın hücum/savunma farkı (eski hoca − yeni hoca)')),
          row(t('Diziliş uyumu'), 'dizi', t('Hocanın bu dizilişi ne kadar sık kullandığı')),
          row(t('Taktik'), 'takt', t('Mentalite, pres ve kanat oyunu ayarları')),
          row(t('Sonuç (hücum / savunma)'), 'out', '', true))),
      h('div', { class: 'dim', style: 'font-size:12px;margin-top:6px' }, t('Beklenen gol: {lh} – {la} (maç toplamı {tot}{src})', { lh: lh.toFixed(2), la: la.toFixed(2), tot: (lh + la).toFixed(2), src: hr.tot && ar.tot ? t('; iki takımın tarzından') : '' })));
  }

  function drawResults() {
    const { sim, lh, la } = res;
    const hn = nameOf(sides.h), an = nameOf(sides.a);
    const bar = (label, p, color) => h('div', { class: 'pbar' }, h('span', null, label), h('div', { class: 'meter' }, h('i', { style: `width:${p * 100}%;background:${color}` })), h('b', { class: 'num' }, fmtPct(p, 1)));
    const max = Math.max(...sim.grid.slice(0, 6).flatMap(r => r.slice(0, 6)));
    const heat = h('div', { class: 'heat', style: 'grid-template-columns:34px repeat(6,1fr)' },
      h('div', { style: 'background:none;color:var(--chalk-3);font-size:10px' }, ''), ...[0, 1, 2, 3, 4, 5].map(j => h('div', { style: 'background:none;color:var(--chalk-3)' }, j)),
      ...[0, 1, 2, 3, 4, 5].flatMap(i => [h('div', { style: 'background:none;color:var(--chalk-3)' }, i), ...[0, 1, 2, 3, 4, 5].map(j => { const p = sim.grid[i][j]; const a = Math.sqrt(p / max); return h('div', { style: `background:color-mix(in srgb, ${i > j ? 'var(--ucl)' : i === j ? 'var(--chalk-2)' : 'var(--el)'} ${Math.round(18 + a * 82)}%, var(--bg-1));color:${a > .55 ? '#08120d' : 'var(--chalk)'}`, title: `${i}-${j}: ${fmtPct(p, 1)}` }, p >= .005 ? Math.round(p * 100) + '%' : ''); })]));
    const out = h('div', { class: 'grid', style: 'gap:18px' },
      h('div', null, bar(t('{team} galibiyet', { team: hn }), sim.hw, 'var(--ucl)'), bar(t('Beraberlik'), sim.dr, 'var(--chalk-2)'), bar(t('{team} galibiyet', { team: an }), sim.aw, 'var(--el)'),
        sim.knock ? h('div', { class: 'note mk', style: 'margin-top:8px' }, t('Eleme: {hn} tur atlar {hp} · {an} {ap} (uzatma {et}, penaltı {pen})', { hn, an, hp: fmtPct(sim.knock.hAdv, 1), ap: fmtPct(sim.knock.aAdv, 1), et: fmtPct(sim.knock.et), pen: fmtPct(sim.knock.pen) })) : null),
      h('div', { class: 'grid', style: 'grid-template-columns:repeat(4,1fr);gap:10px' },
        kv(t('Ortalama gol'), `${sim.avgH.toFixed(2)} ${DASH} ${sim.avgA.toFixed(2)}`), kv(t('2,5 üstü'), fmtPct(sim.over25)), kv(t('Karşılıklı gol'), fmtPct(sim.btts)), kv(t('Gol yemeden'), `${fmtPct(sim.hCs)} / ${fmtPct(sim.aCs)}`)),
      h('div', null, h('div', { class: 'cap', style: 'margin-bottom:6px' }, t('Skor olasılıkları · satır: {h} golü, sütun: {a}', { h: lastName(hn), a: lastName(an) })), heat,
        h('div', { class: 'row', style: 'margin-top:8px;gap:8px' }, ...sim.top.slice(0, 5).map(t => h('span', { class: 'chip' }, `${t.h}-${t.a} · ${fmtPct(t.p, 1)}`)))),
      h('div', null, h('div', { class: 'row center', style: 'margin-bottom:8px' }, h('button', { class: 'btn mk', onclick: playStory }, t('Tek maç oyna')), h('span', { class: 'dim', style: 'font-size:12px' }, t('{n} simülasyon üzerinden', { n: sim.n.toLocaleString(LOC) }))), h('div', { id: 'story' }, storyView())));
    mount(resultsBox, out);
  }
  const kv = (l, v) => h('div', { class: 'kpi' }, h('div', { class: 'v', style: 'font-size:20px' }, v), h('div', { class: 'l' }, l));

  function playStory() {
    const mk = k => { const x = sides[k], by = new Map(x.squad.map(q => [q.id, q])); return { name: nameOf(x), formation: x.formation, squad: x.squad, xi: x.xi.map(id => by.get(id) || null), tactics: { ...x.tactics } }; };
    const m = new Match2D({ sides: { h: mk('h'), a: mk('a') }, rates: () => ({ lh: res.lh, la: res.la }), seed: (Math.random() * 1e9) | 0 });
    m.finishNow(); story = m;
    const box = document.getElementById('story'); if (box) box.replaceChildren(storyView());
  }
  function storyView() {
    if (!story) return h('div', { class: 'dim' }, t('Bir maç oynat: skor, gol dakikaları, golü atanlar ve maç istatistikleri.'));
    const m = story, hn = nameOf(sides.h), an = nameOf(sides.a), s = m.stats, tot = Math.max(1, s.h.seq + s.a.seq);
    const goals = m.events.filter(e => e.type === 'goal'), best = m.summary().best;
    const row = (l, a, b) => h('tr', null, h('td', { class: 'num' }, a), h('td', { style: 'text-align:center;color:var(--ink-3)' }, l), h('td', null, b));
    return h('div', { class: 'grid', style: 'gap:12px' },
      h('div', { style: 'font:700 30px var(--font-c);letter-spacing:.03em' }, `${hn} ${m.score.h} ${DASH} ${m.score.a} ${an}`),
      goals.length ? h('ul', { class: 'list-plain' }, goals.map(e => h('li', { style: 'padding:5px 0' }, h('span', { class: 'chip' }, `${e.min}'`), h('span', null, e.text.replace(GOAL_TAG + ' ', '')))))
        : h('div', { class: 'mute' }, t('Gol yok.')),
      h('table', { class: 'tbl' }, h('tbody', null, row(t('Top hakimiyeti'), fmtPct(s.h.seq / tot), fmtPct(s.a.seq / tot)), row(t('Şut (isabetli)'), `${s.h.shots} (${s.h.on})`, `${s.a.shots} (${s.a.on})`),
        row(t('Beklenen gol (xG)'), s.h.xg.toFixed(2), s.a.xg.toFixed(2)), row(t('Korner'), s.h.corner, s.a.corner), row(t('Kart (sarı / kırmızı)'), `${s.h.y} / ${s.h.r}`, `${s.a.y} / ${s.a.r}`))),
      best ? h('div', { class: 'note' }, t('Maçın oyuncusu: {p} ({team}) — {g} gol, {a} asist, {s} şut{k}', { p: best.p.name, team: nameOf(sides[best.side]), g: best.st.g, a: best.st.a, s: best.st.s, k: best.st.k ? t(', {n} kurtarış', { n: best.st.k }) : '' })) : null);
  }

  const toAdded = x => ({ id: x.id, name: x.name, line: x.line, pos: x.pos, value: x.value || 3e5, age: ageOn(x.dob), nat: x.nat, img: x.img, added: true });

  // ------------------------------------------------------------ paylaş / dışa aktar / içe aktar
  const sideSnap = s => ({ kind: s.kind, id: s.clubId, season: s.season, f: s.formation, xi: s.xi, t: s.tactics, add: s.squad.filter(p => p.added).map(p => p.id), out: s.removed, alt: s.mgr?.alt || null, inj: [...s.avail] });
  function snapshot() {
    const r = res.sim;
    return { v: 1, app: 'what-if-football', at: new Date().toISOString(), mode: O.mode, neutral: O.neutral, knockout: O.knockout, n: O.n, h: sideSnap(sides.h), a: sideSnap(sides.a),
      özet: { ev: nameOf(sides.h), dep: nameOf(sides.a), evGalibiyet: +r.hw.toFixed(3), beraberlik: +r.dr.toFixed(3), depGalibiyet: +r.aw.toFixed(3), beklenenGol: [+res.lh.toFixed(2), +res.la.toFixed(2)] } };
  }
  const b64 = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = t => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))));
  const shareLink = () => `${location.origin}${u(`/simulator/sim=${b64(snapshot())}`)}`;
  async function restoreSide(sn) {
    const s = await loadSide(sn.id, sn.season, sn.kind);
    for (const id of sn.add || []) { const x = P.byId.get(id); if (x && !s.squad.some(q => q.id === id)) s.squad.push(toAdded(x)); }
    for (const id of sn.out || []) { s.squad = s.squad.filter(q => q.id !== id); s.removed.push(id); }
    if (sn.alt && M.m[sn.alt]) s.mgr.alt = sn.alt;
    for (const [id, a] of sn.inj || []) if (typeof a === 'number') s.avail.set(id, a);
    if (FORMATIONS[sn.f]) s.formation = sn.f;
    const have = new Set(s.squad.map(q => q.id)), xi = (sn.xi || []).map(id => (have.has(id) ? id : null));
    s.xi = xi.length === 11 && xi.some(Boolean) ? xi : autoXI(s.squad, s.formation, s.avail);
    s.tactics = { ...DEFAULT_TACTICS(), ...(sn.t || {}) };
    return s;
  }
  async function applySnapshot(o) {
    if (!o || o.app !== 'what-if-football' || !o.h || !o.a) throw new Error(t('Bu bir Jinja Football maç dosyası değil'));
    O.mode = o.mode === 'nation' ? 'nation' : 'club'; O.neutral = !!o.neutral; O.knockout = !!o.knockout; O.n = [1000, 10000, 100000, 1000000].includes(o.n) ? o.n : 10000;
    sides.h = await restoreSide(o.h); sides.a = await restoreSide(o.a); editor = null;
  }
  const parseImport = txt => {
    const t = String(txt).trim(), m = t.match(/sim=([A-Za-z0-9_-]+)/);
    if (t.startsWith('{')) return JSON.parse(t);
    return unb64(m ? m[1] : t);
  };
  function importDialog() {
    const ta = h('textarea', { rows: 6, placeholder: t('Bağlantıyı ya da dosya içeriğini buraya yapıştır…'), style: 'width:100%;font:13px var(--f-mono, monospace)' });
    const file = h('input', { type: 'file', accept: '.json,application/json', onchange: async e => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
    const dlg = h('dialog', { 'aria-label': t('Maçı içe aktar'), style: 'max-width:min(560px,94vw)' });
    const go = async () => {
      try { await applySnapshot(parseImport(ta.value)); dlg.close(); dlg.remove(); toast(t('Maç yüklendi')); refresh(); }
      catch (e) { toast(t('İçe aktarılamadı: {err}', { err: e.message || e })); }
    };
    dlg.append(h('div', { style: 'padding:16px;display:grid;gap:12px' }, h('h3', { style: 'text-transform:uppercase;letter-spacing:.06em' }, t('Maçı içe aktar')),
      h('div', { class: 'dim' }, t('Birinin paylaştığı bağlantıyı ya da dışa aktarılan .json dosyasını ekle.')), ta, file,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'btn', onclick: () => { dlg.close(); dlg.remove(); } }, t('Vazgeç')), h('button', { class: 'btn primary', onclick: go }, t('Yükle')))));
    document.body.append(dlg); dlg.showModal();
  }
  const shareRow = () => h('div', { class: 'row center' }, h('span', { class: 'cap' }, t('Bu maçı')),
    h('button', { class: 'btn sm', onclick: async () => { const l = shareLink(); try { await navigator.clipboard.writeText(l); toast(t('Bağlantı kopyalandı; açan herkes aynı maçı görür')); } catch { prompt(t('Bağlantıyı kopyala'), l); } } }, t('Bağlantıyı kopyala')),
    h('button', { class: 'btn sm', onclick: () => { const a = h('a', { download: `mac-${lastName(nameOf(sides.h))}-${lastName(nameOf(sides.a))}.json`, href: URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' })) }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } }, t('Dışa aktar')),
    h('button', { class: 'btn sm', onclick: importDialog }, t('İçe aktar')));

  function drawEditor() {
    const s = sides[O.active];
    if (!editor) editor = lineupEditor({ squad: s.squad, formation: s.formation, xi: s.xi, addPlayer: async () => {
      const have = new Set(s.squad.map(q => q.id));
      const items = P.list.filter(x => x.value >= 1e6 && (x.lastSeason ?? 0) >= LAST_SEASON && !have.has(x.id)).sort((x, y) => y.value - x.value).slice(0, 5000).map(x => ({ id: x.id, label: x.name, sub: `${x.club ? ctx.clubName(x.club) : ''} ${x.nat || ''}`, right: fmtMoney(x.value), tag: x.pos || x.line, tagCls: x.line }));
      const id = await pick({ title: t('Kadroya kim katılsın?'), items, placeholder: t('Oyuncu ara… (ör. Haaland)') });
      const x = id && P.byId.get(id); return x ? toAdded(x) : null;
    }, getChem: () => chemOf(s), avail: () => s.avail, setAvail: (pid, v) => { if (v >= 1) s.avail.delete(pid); else s.avail.set(pid, v); }, ovr, onSell: pid => { s.squad = s.squad.filter(q => q.id !== pid); s.removed.push(pid); }, onChange: (xi, f) => { s.xi = xi; s.formation = f; rec(); } });
    return editor.el;
  }

  const watchBtn = () => h('button', { class: 'btn primary', onclick: () => {
    const side = k => { const x = sides[k]; return { squad: x.squad, elo: x.elo, formation: x.formation, xi: [...x.xi], tactics: { ...x.tactics }, rate: (squad, formation, xi, tactics) => rateSide(x, squad, formation, xi, tactics) }; };
    openLive({ names: { h: nameOf(sides.h), a: nameOf(sides.a) }, sides: { h: side('h'), a: side('a') }, neutral: O.neutral, haValue: O.mode === 'nation' ? 100 : undefined });
  } }, t('Maçı 2D izle'));
  function refresh() {
    calc();
    const left = sheet(h('h2', null, t('İlk 11 · {team}', { team: nameOf(sides[O.active]) })), drawEditor(), { actions: [seg([['h', t('Ev sahibi')], ['a', t('Deplasman')]], O.active, v => { O.active = v; editor = null; refresh(); })] });
    drawTactics(); drawResults(); drawStrength();
    const opts = h('div', { class: 'row center' },
      h('label', { class: 'row center', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: O.neutral, onchange: e => { O.neutral = e.target.checked; rec(); } }), t('Tarafsız saha')),
      h('label', { class: 'row center', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: O.knockout, onchange: e => { O.knockout = e.target.checked; rec(); } }), t('Eleme maçı')),
      field(t('Simülasyon'), select([1000, 10000, 100000, 1000000].map(n => [n, n.toLocaleString(LOC)]), O.n, v => { O.n = +v; rec(); })));
    mount(root, drawTeamBar(),
      h('div', { class: 'grid cols-2' }, left,
        h('div', { class: 'grid', style: 'align-content:start' }, sheet(h('h2', null, t('Sonuç')), resultsBox, { actions: [watchBtn()] }), sheet(h('h2', null, t('Maç ayarları')), h('div', { class: 'grid' }, opts, shareRow(), strengthBox)), sheet(h('h2', null, t('Taktik · {team}', { team: nameOf(sides[O.active]) })), tacticsBox))));
  }
  let shared = null;
  if (params.get('sim')) { try { shared = unb64(params.get('sim')); } catch { /* bozuk bağlantı: varsayılan maç açılır */ } }
  if (shared) {
    try { await applySnapshot(shared); } catch { shared = null; }
  }
  if (shared) { /* paylaşılan maç yüklendi */ } else if (params.get('mode') === 'nation') {
    O.mode = 'nation'; O.neutral = true;
    sides.h = await loadSide(params.get('h') || 'Turkey', NOW, 'nation'); sides.a = await loadSide(params.get('a') || 'Germany', NOW, 'nation');
  } else {
    sides.h = await loadSide(defH, params.get('s') === null ? NOW : (params.get('s') === NOW ? NOW : +params.get('s')), 'club');
    sides.a = await loadSide(defA, sides.h.season, 'club');
  }


  refresh();
}

// ---------------------------------------------------------------------------- kadro kurma
export async function buildSquad(ctx, P, clubId, season) {
  if (season === NOW) {
    const cur = (await loadCurrent()).clubs[clubId];
    if (cur?.length >= 14) {
      const now = new Date();
      return cur.map(c => ({ form: playerForm(c), id: c.id || -c.e, name: c.n, line: c.l, pos: c.p || '', value: c.v || estimateValue(c, now), age: ageOn(c.dob, now), nat: c.nat || '', inj: c.inj, st: c.st, jersey: c.j, dob: c.dob, tm: !!c.id, img: P.byId.get(c.id)?.img, esp: c.e }));
    }
  }
  let rows;
  if (season === NOW) {
    rows = P.list.filter(p => p.club === clubId && (p.lastSeason == null || p.lastSeason >= LAST_SEASON)).map(p => ({ pid: p.id, v: p.value })).sort((a, b) => b.v - a.v).slice(0, 45);
    if (rows.length < 14) rows = P.list.filter(p => p.club === clubId).map(p => ({ pid: p.id, v: p.value })).sort((a, b) => b.v - a.v).slice(0, 45);
  } else {
    const sq = (await loadSquads(season))[clubId] || [];
    rows = sq.map(([pid, v]) => ({ pid, v }));
  }
  const ref = season === NOW ? new Date() : new Date(`${season + 1}-01-01`);
  return rows.map(r => P.byId.get(r.pid) && ({ id: r.pid, name: P.byId.get(r.pid).name, line: P.byId.get(r.pid).line, pos: P.byId.get(r.pid).pos, value: r.v || P.byId.get(r.pid).value || 3e5, age: ageOn(P.byId.get(r.pid).dob, ref), nat: P.byId.get(r.pid).nat, img: P.byId.get(r.pid).img })).filter(Boolean);
}
/** Sezon istatistiklerinden küçük form düzeltmesi (ln): beklenenden çok gol+asist yapan hücum/orta saha oyuncusu +, az yapan −; en çok ±%10-15. */
function playerForm(c) {
  const st = c.st;
  if (!st || st.ap < 4) return 0;
  const base = { A: .42, M: .2, D: .06 }[c.l];
  if (!base) return 0;
  const exp = base * Math.exp(0.22 * Math.log(Math.max(c.v || 1e6, 3e5) / 1e7));      // değerli oyuncudan daha çok katkı beklenir
  const rate = (st.g + 0.7 * st.as) / st.ap;
  return 0.10 * clamp((rate - exp) / (exp + 0.1), -1, 1.5) * st.ap / (st.ap + 8);
}
// Transfermarkt'ta bulunmayan (yeni) oyuncu için kaba değer tahmini: yaşa göre
const estimateValue = (c, now) => { const a = ageOn(c.dob, now) || 26; return a <= 21 ? 1.5e6 : a <= 30 ? 1e6 : 4e5; };
function teamEloFromSquad(squad) {
  const top = squad.map(p => p.value).sort((a, b) => b - a).slice(0, 18).reduce((s, v) => s + v, 0);
  return 1500 + 120 * Math.log(Math.max(top, 2e6) / 60e6);
}

// ---------------------------------------------------------------------------- milli takım kadrosu
let natP;
const natElo = () => natP ??= loadIntlElo().then(o => new Map(Object.entries(o).map(([t, d]) => { const ys = Object.keys(d).map(Number); return [t, d[Math.max(...ys)]]; })));
export function buildNationSquad(P, name) {
  const nat = NAT_ALIAS[name] || name;
  return P.list.filter(p => p.nat === nat && (p.lastSeason ?? 0) >= LAST_SEASON).sort((a, b) => b.value - a.value).slice(0, 40)
    .map(p => ({ id: p.id, name: p.name, line: p.line, pos: p.pos, value: p.value || 3e5, age: ageOn(p.dob), nat: p.nat }));
}
