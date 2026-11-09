// Takım sayfası: kadro, maçlar, transferler ve güç (Elo) geçmişi.
import { h, mount, toast, norm, setCrumbs, crest, barChart, fmtMoney, fmtDate, fmtDay, seasonLabel, lineChart, ageOn, go, u } from '../util.js';
import { boot, select, sheet, pageHead, delta, formStrip, POS_LONG, crestFor, avatar } from '../ui.js';
import { loadMatches, loadSquads, loadTransfers, loadPlayers, loadElo, loadCurrent, loadManagers, mgrInfo, mgrAD, LAST_SEASON, CURRENT_SEASON } from '../data.js';
import { eloChip, eloText, pickManager, seasonManager, isCaretaker, dampPct } from '../mgr.js';
import { turningPoints, planTarget, TARGETS } from '../workshop.js';
import { defaultSlots, positionOutcome, TIER_LABEL } from '../rules.js';
import { computeTable, simulateSeason, probIn } from '../engine.js';
import * as store from '../store.js';
import { t, tl, LOC } from '../i18n.js';

export async function render(app, idArg, seasonArg, tabArg) {
  if (seasonArg === 'now') seasonArg = undefined;      // "Güncel" = varsayılan sezon (adreste /takim/36/now)
  const ctx = await boot();
  const [P, M] = await Promise.all([loadPlayers(), loadManagers()]);
  const id = +idArg;
  const club = ctx.clubs[id];
  const name = ctx.clubName(id);
  const compId = club?.c;
  // bu kulübün bulunduğu sezonlar (ana lig verisinden)
  const leagueSeasons = compId ? Object.keys(ctx.idx[compId] || {}).map(Number) : [];
  let season = seasonArg ? +seasonArg : LAST_SEASON;
  const dflt = compId && ctx.idx[compId]?.[2026] ? 2026 : LAST_SEASON;   // güncel sezon verisi varsa varsayılan o
  setCrumbs(t('Takımlar'), name);

  const TABS = [['atolye', t('Senaryo atölyesi')], ['yonetim', t('Yönetim')], ['kadro', t('Kadro')], ['mac', t('Maçlar')], ['transfer', t('Transferler')], ['finans', t('Finans')], ['guc', t('Güç geçmişi')]];
  let tab = TABS.some(x => x[0] === tabArg) ? tabArg : 'atolye';
  const mcur = M.c[id]?.cur, mstale = mcur?.src === 'maç' && (M.c[id].hist.at(-1)?.[2] ?? '') < '2026-03-01';   // veri setindeki son maçı eskiyse bu "güncel" hoca değildir
  const head = pageHead(name, `${compId ? ctx.compFull(compId) : ''}${club?.st ? ' · ' + club.st : ''}${mcur?.n ? ` · ${mstale ? t('Son hoca') : t('Teknik direktör')}: ${mcur.n}` : ''}`,
    h('div', { style: 'align-self:center' }, crestFor(ctx, id, 'xl')),
    select([['now', t('Güncel')], [2026, '2026/27'], ...Array.from({ length: LAST_SEASON - 2003 + 1 }, (_, i) => LAST_SEASON - i).map(s => [s, seasonLabel(s)])], seasonArg || 'now', v => go(`/takim/${id}/${v}/${tab}`)));       // yıl değişince açık sekme korunur
  const body = h('div');
  mount(app, head, body);

  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const content = h('div');
  const drawTabs = () => { tabs.replaceChildren(...TABS.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; try { go(`/takim/${id}/${seasonArg || 'now'}/${k}`, { replace: true, silent: true }); } catch { /* adres güncellenemezse sorun değil */ } drawTabs(); drawTab(); } }, l))); };
  mount(body, tabs, content);

  async function drawTab() {
    content.replaceChildren(h('div', { class: 'skel', style: 'height:200px' }));
    const node = await ({ atolye: atolyeTab, yonetim: yonetimTab, finans: financeTab, kadro: squadTab, mac: matchesTab, transfer: transferTab, guc: powerTab }[tab])();
    content.replaceChildren(node);
  }


  // ------------------------------------------------------------------ senaryo atölyesi
  async function findLeague(s) {
    const first = compId && ctx.idx[compId]?.[s] ? [compId] : [];
    const country = ctx.comps[compId]?.country;
    const others = Object.values(ctx.comps).filter(c => c.type === 'league' && c.id !== compId && ctx.idx[c.id]?.[s] && (!country || c.country === country)).sort((a, b) => a.tier - b.tier).map(c => c.id);
    for (const c of [...first, ...others]) {
      const ms = await loadMatches(c, s);
      if (ms.some(m => m.h === id || m.a === id)) return { comp: c, matches: ms };
    }
    return null;
  }

  async function atolyeTab() {
    const s = seasonArg ? season : dflt;
    const L = await findLeague(s);
    if (!L) return h('div', { class: 'empty' }, h('h3', null, t('Bu sezon için lig verisi yok')), h('div', null, t('Başka bir sezon seç; 2000’den bugüne çoğu büyük ligde veri var.')));
    const { comp, matches } = L;
    const names = Object.fromEntries([...new Set(matches.flatMap(m => [m.h, m.a]))].map(x => [x, ctx.clubName(x)]));
    const n = new Set(matches.flatMap(m => [m.h, m.a])).size;
    const slots = defaultSlots(comp, s, n);
    const table = computeTable(matches, { comp, names });
    const me = table.find(r => r.id === id);
    const apply = (list) => {
      for (const f of list) store.addEdit({ t: 'result', comp, season: s, id: f.match.id, hg: f.score.hg, ag: f.score.ag, real: [f.match.hg, f.match.ag], label: `${ctx.compName(comp)} ${seasonLabel(s)}: ${ctx.clubName(f.match.h)} ${f.score.hg}-${f.score.ag} ${ctx.clubName(f.match.a)}` });
      toast(t('{n} maç değiştirildi', { n: list.length })); go(`/lig/${comp}/${s}`);
    };
    const mname = m => `${ctx.clubName(m.h)} – ${ctx.clubName(m.a)}`;
    const planBox = h('div'), tpBox = h('div');
    const drawPlan = key => {
      const p = planTarget({ matches, id, comp, slots, names, target: key });
      if (p.already) { mount(planBox, h('div', { class: 'note' }, t('{name} zaten {target} hedefindeydi ({pos}. sıra).', { name, target: tl(TARGETS[key].label.toLowerCase(), TARGETS[key].label), pos: me.pos }))); return; }
      const flips = p.edits;
      mount(planBox, h('div', { class: p.ok ? 'note mk' : 'note' },
        p.ok ? h('div', null, h('b', null, t('{target} için {n} sonucu çevirmen yeterdi', { target: TARGETS[key].label, n: flips.length })), t(' — sezonu {pos}. sırada bitirirdin ({pts} puan).', { pos: p.final.pos, pts: p.final.pts }))
          : h('div', null, t('Yalnızca {name} sonuçlarını değiştirerek bu hedefe ulaşmak mümkün olmadı (en iyi {pos}. sıra). Rakiplerin sonuçlarını Lig & Sezon ekranından da değiştirebilirsin.', { name, pos: p.final.pos })),
        h('ul', { class: 'list-plain', style: 'margin:8px calc(var(--pad) * -1) 0' }, flips.map(f => h('li', null, h('span', { class: 'chip' }, f.before === 'L' ? t('Mağlubiyet') : t('Beraberlik')), h('span', { style: 'flex:1' }, `${mname(f.match)} `, h('span', { class: 'dim' }, `${fmtDay(f.match.date)} · ${f.match.hg}-${f.match.ag} → ${f.score.hg}-${f.score.ag}`))))),
        h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn mk', onclick: () => apply(flips) }, t('Senaryoyu aç ve düzenle')))));
    };
    let mode = 'up';
    const drawTp = () => {
      const tpr = turningPoints({ matches, id, comp, slots, names, mode });
      const top = tpr.flips.filter(f => f.dPos !== 0 || f.tierShift !== 0).slice(0, 6);
      mount(tpBox, top.length ? h('ul', { class: 'list-plain' }, top.map(f => h('li', null,
        h('span', { style: 'flex:1' }, h('div', null, mname(f.match)), h('div', { class: 'dim', style: 'font-size:12.5px' }, `${fmtDay(f.match.date)} · ${f.match.hg}-${f.match.ag} → ${f.score.hg}-${f.score.ag}`)),
        f.tierShift ? h('span', { class: `chip ${f.tier === 'none' ? '' : f.tier}` }, TIER_LABEL[f.tier]) : null,
        h('span', { class: `delta ${f.dPos > 0 ? 'up' : 'dn'}` }, t('{d} sıra', { d: `${f.dPos > 0 ? '+' : '−'}${Math.abs(f.dPos)}`, n: Math.abs(f.dPos) })),
        h('button', { class: 'btn sm', onclick: () => apply([f]) }, t('Uygula'))))) : h('div', { class: 'dim', style: 'padding:14px' }, mode === 'up' ? t('Tek bir sonucu çevirmek sıralamayı değiştirmezdi.') : t('Tek bir sonucu kötüye çevirmek sıralamayı değiştirmezdi.')));
    };
    drawTp();
    const modeSeg = h('div', { class: 'seg mk' }, ...[['up', t('Kazansaydık')], ['down', t('Kaybetseydik')]].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(mode === k), onclick: e => { mode = k; [...e.currentTarget.parentNode.children].forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); drawTp(); } }, l)));
    const tierKey = positionOutcome(comp, me.pos, n, slots).tier;
    const tier = TIER_LABEL[tierKey];
    return h('div', { class: 'grid cols-2' },
      h('div', { class: 'grid', style: 'align-content:start' },
        sheet(h('h2', null, `${seasonLabel(s)} · ${ctx.compName(comp)}`), h('div', { class: 'row center', style: 'gap:22px' },
          h('div', { class: 'kpi' }, h('div', { class: 'v' }, `${me.pos}.`), h('div', { class: 'l' }, t('Sıra'))), h('div', { class: 'kpi' }, h('div', { class: 'v' }, me.pts), h('div', { class: 'l' }, t('Puan'))),
          h('div', { class: 'kpi' }, h('div', { class: 'v' }, `${me.w}-${me.d}-${me.l}`), h('div', { class: 'l' }, t('G-B-M'))), h('div', { class: 'kpi' }, h('div', { class: 'v', style: 'font-size:18px' }, tierKey === 'none' ? t('Orta sıra') : tier), h('div', { class: 'l' }, t('Sonuç'))),
          h('a', { class: 'btn', style: 'margin-left:auto', href: u(`/lig/${comp}/${s}`) }, t('Sezonu aç')))),
        sheet(h('h2', null, t('Hedef koy')), h('div', { class: 'grid' }, h('div', { class: 'dim' }, t('Hangi hedefe ulaşmak istersin? {name} için en az sayıda sonucu çevirerek bir plan çıkarırım.', { name })), h('div', { class: 'row' }, ...Object.entries(TARGETS).filter(([k]) => k === 'title' || k === 'safe' || (k === 'promo' && slots.promo) || (k === 'ucl' && slots.ucl) || (k === 'euro' && slots.ucl + slots.el + slots.uecl > 0)).map(([k, t]) => h('button', { class: 'btn', onclick: () => drawPlan(k) }, t.label))), planBox))),
      sheet(h('h2', null, t('Dönüm noktaları')), tpBox, { tight: true, actions: [modeSeg] }));
  }


  // ------------------------------------------------------------------ yönetim: seçilen sezonun teknik direktörleri, başkanı, sahipleri + "ya başka hoca olsaydı?"
  async function yonetimTab() {
    const mc = M.c[id] || {};
    const s = seasonArg ? season : dflt;
    const isCur = s >= CURRENT_SEASON;                                  // güncel sezon: maç verisinde hoca adı yok, Wikidata/güncel kayıt kullanılır
    const from = `${s}-06-01`, to = `${s + 1}-05-31`;                 // haziran atamaları yeni sezona sayılır
    const overlap = r => (!r[1] || r[1] <= to) && (!r[2] || r[2] >= from);       // [ad, başlangıç, bitiş, foto]
    const L = await findLeague(s).catch(() => null);
    const cur = mc.cur, ci = cur && mgrInfo(M, cur.n);
    const nm = norm(name), ownNow = (mc.own || []).filter(o => { const k = norm(o); return !k.includes(nm) && !nm.includes(k); });
    const dl = d => (d ? fmtDate(d) : '?');

    const photo = (n, img) => {
      const f = img || M.I?.[n];
      const ini = h('span', { class: 'ph-ini' }, (n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase());
      if (!f) return h('span', { class: 'ph' }, ini);
      return h('a', { class: 'ph', href: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f)}`, target: '_blank', rel: 'noopener', title: t('Fotoğraf: Wikimedia Commons (lisans ve atıf bilgisi için tıkla)') },
        h('img', { src: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=96`, alt: n, loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => e.target.replaceWith(ini) }));
    };
    const person = (n, img, sub, chips) => h('div', { class: 'pp' }, photo(n, img), h('div', { class: 'pp-t' }, h('b', null, n), sub ? h('span', { class: 'ds' }, sub) : null), chips || null);

    // ---- sezonun teknik direktörleri: önce maç verisi (hmgr/amgr), yoksa görev kayıtları, ayrıca Wikidata
    const cm = new Map();
    for (const m of L?.matches || []) {
      if (m.hg == null) continue;
      const side = m.h === id ? 'h' : m.a === id ? 'a' : null, n = side && (side === 'h' ? m.hmgr : m.amgr);
      if (!n) continue;
      const own = side === 'h' ? m.hg : m.ag, opp = side === 'h' ? m.ag : m.hg;
      const o = cm.get(n) || { n, g: 0, w: 0, d: 0, l: 0, first: m.date, last: m.date };
      o.g++; if (own > opp) o.w++; else if (own === opp) o.d++; else o.l++;
      if (m.date < o.first) o.first = m.date; if (m.date > o.last) o.last = m.date;
      cm.set(n, o);
    }
    let coaches = [...cm.values()];
    let basis = coaches.length ? t('maç verisi') : '';
    if (!coaches.length) {
      coaches = (mc.hist || []).filter(r => r[1] <= to && r[2] >= from).map(r => ({ n: r[0], g: r[3], w: r[4], d: r[5], l: r[6], first: r[1] < from ? from : r[1], last: r[2], whole: true }));
      if (coaches.length) basis = t('görev kayıtları');
    }
    for (const r of (mc.roles?.coach || []).filter(overlap)) {
      if (!coaches.some(x => norm(x.n) === norm(r[0]))) coaches.push({ n: r[0], first: r[1] || from, last: r[2] || null, img: r[3], wd: true });
    }
    if (!coaches.length && isCur && cur) coaches.push({ n: cur.n, first: cur.since || from, last: null, wd: true });
    coaches.sort((a, b) => (a.first || '').localeCompare(b.first || ''));
    const coachRows = coaches.map(c => {
      const i = mgrInfo(M, c.n), ppg = c.g ? ((3 * c.w + c.d) / c.g).toFixed(2) : null;
      const sub = `${dl(c.first)} – ${c.last && !(isCur && !c.wd && c.n === cur?.n) ? dl(c.last) : t('sürüyor')}${c.g ? t(' · {g} maç {w}-{d}-{l} · {ppg} puan/maç', { g: c.g, n: c.g, w: c.w, d: c.d, l: c.l, ppg }) + (c.whole ? t(' (tüm görev)') : '') : ''}`;
      return person(c.n, c.img, sub, h('span', { class: 'row', style: 'gap:6px' }, (c.g != null && ((((mc.hist || []).find(r => r[0] === c.n && r[1] <= to && r[2] >= from) || [])[3]) ?? c.g) <= 6) ? h('span', { class: 'chip', title: t('Toplam görev süresi 6 maçı geçmeyen geçici hoca') }, t('vekil')) : null, i ? eloChip(i.elo, { label: t('hoca puanı') }) : null, c.wd && c.g == null ? h('span', { class: 'chip', title: t('Maç verisinde yok; Wikidata kaydı') }, 'Wikidata') : null));
    });
    const change = coaches.length > 1 ? h('div', { class: 'note mk', style: 'margin-top:8px' }, h('b', null, t('{season} sezonunda {n} farklı teknik direktör görev yaptı: ', { season: seasonLabel(s), n: coaches.length })),
      coaches.map((c, i) => (i ? ` → ${c.n} (${dl(c.first)})` : `${c.n}`)).join('')) : null;

    // ---- başkan / genel müdür / sahipler: sezonla kesişen dönemler; güncel sezonda güncel kayıt
    const roleRows = (key, now) => {
      const lst = (mc.roles?.[key] || []).filter(overlap);
      if (!lst.length && isCur && now) return (Array.isArray(now) ? now.map(n => [n]) : [[now.n, now.since, null, now.img]]).map(r => person(r[0], r[3], r[1] ? t('{d}’den beri', { d: dl(r[1]) }) : null));
      return lst.map(r => person(r[0], r[3], r[1] || r[2] ? `${dl(r[1])} – ${r[2] ? dl(r[2]) : t('sürüyor')}` : t('tarih belirtilmemiş')));
    };
    const empty = h('span', { class: 'dim', title: t('Wikidata’da çoğu kulübün yalnızca güncel başkan/sahip kaydı var; geçmiş dönemler için ücretsiz yapılandırılmış bir kaynak yok') }, t('Bu sezon için ücretsiz kaynakta kayıt yok'));
    const block = (label, rows) => h('div', { class: 'mrow' }, h('div', { class: 'cap' }, label), rows.length ? h('div', { class: 'pp-list' }, rows) : empty);
    const staff = sheet(h('h2', null, t('Kulüp yönetimi · {season}', { season: seasonLabel(s) })), h('div', { class: 'mgmt' },
      block(coaches.length > 1 ? t('Teknik direktörler') : t('Teknik direktör'), coachRows),
      block(t('Başkan'), roleRows('chair', mc.chair)),
      (mc.roles?.ceo || []).some(overlap) || (isCur && mc.ceo) ? block(t('Genel müdür / CEO'), roleRows('ceo', mc.ceo)) : null,
      block(ownNow.length > 1 || (mc.roles?.own || []).filter(overlap).length > 1 ? t('Sahipler / ortaklar') : t('Sahip'), roleRows('own', ownNow)),
      block(t('Stadyum'), club?.st ? [h('div', { class: 'pp' }, h('div', { class: 'pp-t' }, h('b', null, club.st), club?.se ? h('span', { class: 'ds' }, t('{n} kişilik', { n: club.se.toLocaleString(LOC) })) : null))] : [])),
      { actions: [h('a', { class: 'btn sm', href: u('/hocalar') }, t('Tüm hocalar'))] });
    const note = h('div', { class: 'dim', style: 'font-size:12.5px' }, `${basis ? t('Hocalar: {basis}. ', { basis }) : ''}${t('Hoca geçmişi Transfermarkt maç verisinden (2006+), başkan/sahip/genel müdür dönemleri ve fotoğraflar Wikidata ve Wikimedia Commons’tan alınır ({asOf}); topluluk verisi olduğu için eksik, gecikmeli ya da tarihsiz olabilir. Fotoğrafa tıklayınca lisans ve atıf sayfası açılır. Yardımcı hocalar, sportif direktör, doktor gibi kadro dışı personel için ücretsiz ve yapılandırılmış bir kaynak yok; bu yüzden yer almıyor.', { asOf: M.asOf || '—' })}`);

    // ---- tüm görevler tablosu (seçili sezonla kesişenler vurgulu)
    const hist = [...(mc.hist || [])].reverse();
    const hs = hist.length ? sheet(h('h2', null, t('Teknik direktör geçmişi')), h('div', null, h('div', { style: 'overflow:auto;max-height:460px' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, t('Hoca')), h('th', null, t('Dönem')), h('th', { class: 'num' }, t('Maç')), h('th', { class: 'num' }, t('G-B-M')), h('th', { class: 'num' }, t('Puan/maç')), h('th', { class: 'num' }, t('Hoca puanı')))),
      h('tbody', null, hist.map(r => { const i = mgrInfo(M, r[0]), hit = r[1] <= to && r[2] >= from; return h('tr', { style: hit ? 'background:var(--brand-soft)' : null },
        h('td', null, h('b', null, r[0]), isCaretaker(r[3]) ? h('span', { class: 'chip', style: 'margin-left:6px' }, t('vekil')) : null, hit ? h('span', { class: 'chip mk', style: 'margin-left:6px' }, seasonLabel(s)) : null),
        h('td', { class: 'dim' }, `${fmtDate(r[1])} – ${cur?.n === r[0] && cur.src === 'maç' ? t('son maç ') : ''}${fmtDate(r[2])}`),
        h('td', { class: 'num' }, r[3]), h('td', { class: 'num' }, `${r[4]}-${r[5]}-${r[6]}`), h('td', { class: 'num' }, ((3 * r[4] + r[5]) / r[3]).toFixed(2)),
        h('td', { class: 'num' }, i ? eloChip(i.elo, { label: '' }) : h('span', { class: 'dim' }, '—'))); })))),
      h('div', { class: 'dim', style: 'padding:10px 14px;font-size:13px' }, t('Lig ve kupa maçları birlikte sayılır. Hoca puanı kariyerinin tamamına bakar, yalnızca bu kulübe değil.'))), { tight: true }) : null;

    const box = h('div');
    const draw = res => {
      if (!res) { mount(box, h('div', { class: 'dim' }, t('Bir hoca seç; seçtiğin hocanın {season} sezonunda bu takımı çalıştırdığını varsayıp sezonu 1500 kez yeniden oynatırım.', { season: seasonLabel(s) }))); return; }
      if (res.err) { mount(box, h('div', { class: 'note' }, res.err)); return; }
      const pc = x => `${(x * 100).toFixed(x < .1 && x > 0 ? 1 : 0)}%`;
      const pp = ([b, a]) => h('span', null, h('span', { class: 'dim' }, `${pc(b)} → `), h('span', { style: a > b + .005 ? 'color:var(--win)' : a < b - .005 ? 'color:var(--loss)' : '' }, pc(a)));
      mount(box, h('div', { class: 'grid' },
        h('div', { class: 'note mk' }, h('b', null, t('{from} yerine {to}', { from: res.from, to: res.to })), t(' · {season} · takım gücü hücum {a}, savunma {d} Elo (hoca farkının %{p}’i)', { season: seasonLabel(res.s), a: eloText(Math.round(res.a)), d: eloText(Math.round(res.d)), p: dampPct })),
        h('div', { class: 'row center', style: 'gap:22px' },
          h('div', { class: 'kpi' }, h('div', { class: 'v' }, `${res.pos[0].toFixed(1)} → ${res.pos[1].toFixed(1)}`), h('div', { class: 'l' }, t('Beklenen sıra'))),
          h('div', { class: 'kpi' }, h('div', { class: 'v' }, delta(res.pts[1] - res.pts[0], { digits: 1 })), h('div', { class: 'l' }, t('Beklenen puan'))),
          h('div', { class: 'kpi' }, h('div', { class: 'v', style: 'font-size:20px' }, pp(res.title)), h('div', { class: 'l' }, t('Şampiyonluk'))),
          h('div', { class: 'kpi' }, h('div', { class: 'v', style: 'font-size:20px' }, pp(res.euro)), h('div', { class: 'l' }, res.promo ? t('Yükselme') : t('Avrupa'))),
          res.rel ? h('div', { class: 'kpi' }, h('div', { class: 'v', style: 'font-size:20px' }, pp(res.rel)), h('div', { class: 'l' }, t('Küme düşme'))) : null),
        h('div', { class: 'dim', style: 'font-size:12.5px' }, t('Aynı rastgele sayılarla karşılaştırıldığı için fark yalnızca hoca değişikliğinden gelir. Hocanın kadroyla uyumu ve sezon içi görevden alınma ihtimali modelde yoktur.'))));
    };
    const run = async alt => {
      mount(box, h('div', { class: 'skel', style: 'height:120px' }));
      if (!L) return draw({ err: t('Bu sezon için lig verisi yok; başka bir sezon seç.') });
      const base = seasonManager(L.matches, id) || cur?.n;
      if (!base) return draw({ err: t('Bu sezon için takımın hocası bilinmiyor.') });
      const eloRaw = (await loadElo(s)) || (await loadElo(LAST_SEASON + 1)) || {};
      const startElo = new Map(Object.entries(eloRaw).map(([a, b]) => [+a, b]));
      const [da, dd] = mgrAD(M, base, alt), d = (da + dd) / 2;
      const n = 1500, a = simulateSeason({ matches: L.matches, startElo, n, seed: 7 + s }), b = simulateSeason({ matches: L.matches, startElo, ratingDelta: new Map([[id, d]]), n, seed: 7 + s });
      const A = a.teams.get(id), B = b.teams.get(id), nC = a.count, sl = defaultSlots(L.comp, s, nC);
      const top = sl.promo || sl.ucl + sl.el + sl.uecl;
      draw({ s, from: base, to: alt, a: da, d: dd, pos: [A.expPos, B.expPos], pts: [A.expPts, B.expPts], title: [probIn(A.posProb, 1, 1), probIn(B.posProb, 1, 1)], euro: [probIn(A.posProb, 1, top), probIn(B.posProb, 1, top)], promo: !!sl.promo, rel: sl.rel > 0 ? [probIn(A.posProb, nC - sl.rel + 1, nC), probIn(B.posProb, nC - sl.rel + 1, nC)] : null });
    };
    draw(null);
    const btn = h('button', { class: 'btn mk', onclick: async () => { const alt = await pickManager(ctx, M, { title: t('{name} için teknik direktör', { name }), exclude: cur?.n }); if (alt) run(alt); } }, t('Hoca seç ve sezonu yeniden oyna'));
    const what = sheet(h('h2', null, t('Ya başka hoca olsaydı?')), h('div', { class: 'grid' }, box), { actions: [btn] });
    return h('div', { class: 'grid' }, staff, change, note, what, hs);
  }

  // ------------------------------------------------------------------ güncel kadro (ESPN) + sakatlıklar
  async function currentSquad(cur, asOf) {
    const order = { G: 0, D: 1, M: 2, A: 3 }, names = { G: tl('Kaleciler', 'Goalkeepers'), D: tl('Defans', 'Defenders'), M: tl('Orta saha', 'Midfielders'), A: tl('Forvet', 'Forwards') };
    const list = [...cur].sort((a, b) => order[a.l] - order[b.l] || (b.v || 0) - (a.v || 0));
    const hurt = list.filter(p => p.inj);
    const total = list.reduce((s, p) => s + (p.v || 0), 0);
    const rows = [];
    let lastLine = null;
    for (const p of list) {
      if (p.l !== lastLine) { rows.push(h('tr', null, h('td', { colspan: 9, style: 'background:var(--surface-2);font-weight:700;padding:8px 12px' }, names[p.l]))); lastLine = p.l; }
      rows.push(h('tr', null, h('td', { class: 'dim num' }, p.j || ''), h('td', null, h('div', { class: 'who' }, avatar({ name: p.n, img: P.byId.get(p.id)?.img, esp: p.e }, 'sm'), p.id ? h('a', { href: u(`/oyuncu/${p.id}`) }, p.n) : p.n, p.inj ? h('span', { class: `chip ${p.inj.c != null && p.inj.c > 50 ? 'mk' : 'rel'}`, title: p.inj.t }, p.inj.c != null && p.inj.c > 50 ? t('Şüpheli') : t('Sakat')) : null)),
        h('td', { class: 'mute' }, p.p || ''), h('td', { class: 'num' }, ageOn(p.dob) ?? '—'), h('td', { class: 'mute' }, p.nat || ''),
        h('td', { class: 'num' }, p.st.ap), h('td', { class: 'num' }, p.st.g), h('td', { class: 'num' }, p.st.as), h('td', { class: 'num' }, p.v ? fmtMoney(p.v) : h('span', { class: 'dim' }, t('bilinmiyor')))));
    }
    return h('div', { class: 'grid' },
      hurt.length ? sheet(h('h2', null, t('Sakat / şüpheli ({n})', { n: hurt.length })), h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1)' }, hurt.map(p => h('li', null, h('b', null, p.n), h('span', { class: 'mute', style: 'flex:1' }, p.inj.t), p.inj.c != null ? h('span', { class: 'chip' }, t('%{c} oynama şansı', { c: p.inj.c })) : null)))) : null,
      sheet(h('h2', null, t('Güncel kadro')), h('div', null, h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', { class: 'num' }, t('No')), h('th', null, t('Oyuncu')), h('th', null, t('Mevki')), h('th', { class: 'num' }, t('Yaş')), h('th', null, t('Uyruk')), h('th', { class: 'num' }, t('Maç')), h('th', { class: 'num' }, t('Gol')), h('th', { class: 'num' }, t('Asist')), h('th', { class: 'num' }, t('Piyasa değeri')))), h('tbody', null, rows))),
      h('div', { class: 'dim', style: 'padding:14px 20px;font-size:14px' }, t('Toplam piyasa değeri {total} · {n} oyuncu · Kaynak: ESPN ({asOf}); sakatlıklar: FPL (yalnızca Premier League). Piyasa değerleri Transfermarkt veri setinden.', { total: fmtMoney(total), n: list.length, asOf }))), { tight: true }));
  }

  // ------------------------------------------------------------------ finans (transfer harcaması)
  async function financeTab() {
    const seasons = Array.from({ length: 12 }, (_, i) => LAST_SEASON - 11 + i);
    const all = await Promise.all(seasons.map(async s => ({ s, t: (await loadTransfers(s)).filter(x => x.from === id || x.to === id) })));
    const per = all.map(({ s, t }) => ({ s, spent: t.filter(x => x.to === id).reduce((q, x) => q + (x.fee || 0), 0), got: t.filter(x => x.from === id).reduce((q, x) => q + (x.fee || 0), 0) }));
    if (!per.some(r => r.spent || r.got)) return h('div', { class: 'empty' }, h('h3', null, t('Bu takım için transfer harcaması verisi yok')));
    const flat = all.flatMap(({ s, t }) => t.map(x => ({ ...x, s })));
    const buys = flat.filter(x => x.to === id && x.fee).sort((a, b) => b.fee - a.fee).slice(0, 5), sells = flat.filter(x => x.from === id && x.fee).sort((a, b) => b.fee - a.fee).slice(0, 5);
    const net = per.reduce((q, r) => q + r.got - r.spent, 0);
    const mini = (title, list, key) => sheet(h('h2', null, title), h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1)' }, list.map(x => h('li', null, h('span', { style: 'flex:1' }, h('b', null, P.byId.get(x.pid)?.name || `#${x.pid}`), h('span', { class: 'dim' }, `  ${ctx.clubName(x[key])} · ${seasonLabel(x.s)}`)), h('b', null, fmtMoney(x.fee))))));
    return h('div', { class: 'grid' },
      sheet(h('h2', null, t('Net transfer harcaması (son 12 sezon)')), h('div', null, h('div', { class: 'row center', style: 'margin-bottom:10px' }, h('div', { class: 'kpi' }, h('div', { class: 'v', style: `color:${net >= 0 ? 'var(--win)' : 'var(--loss)'}` }, fmtMoney(net, { sign: true })), h('div', { class: 'l' }, t('Toplam net (gelir − harcama)')))),
        barChart({ data: per.map(r => ({ label: seasonLabel(r.s).slice(2), value: Math.round((r.got - r.spent) / 1e6) })), fmt: v => (v ? `${v > 0 ? '+' : ''}${v}M` : '') }),
        h('div', { class: 'dim', style: 'font-size:13.5px;margin-top:6px' }, t('Yeşil: transferlerden net gelir. Kırmızı: net harcama (milyon €). Maaş ve sponsor gelirleri veride yok.')))),
      h('div', { class: 'grid cols-2' }, mini(t('En pahalı alımlar'), buys, 'from'), mini(t('En pahalı satışlar'), sells, 'to')));
  }

  async function squadTab() {
    if (!seasonArg || season >= 2026) { const c = await loadCurrent(); if (c.clubs[id]?.length) return currentSquad(c.clubs[id], c.asOf); }
    let list;
    if (!seasonArg || season >= 2026) list = P.list.filter(p => p.club === id).sort((a, b) => b.value - a.value).map(p => ({ id: p.id, value: p.value }));
    else list = ((await loadSquads(season))[id] || []).map(([pid, v]) => ({ id: pid, value: v }));
    if (!list.length) return h('div', { class: 'empty' }, h('h3', null, t('Bu dönem için kadro verisi yok')));
    const ref = seasonArg ? new Date(`${season + 1}-01-01`) : new Date();
    const total = list.reduce((s, p) => s + p.value, 0);
    return sheet(h('h2', null, t('Kadro')), h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th'), h('th', null, t('Oyuncu')), h('th', null, t('Mevki')), h('th', { class: 'num' }, t('Yaş')), h('th', null, t('Uyruk')), h('th', { class: 'num' }, t('Piyasa değeri')))),
      h('tbody', null, list.map(r => { const p = P.byId.get(r.id); return p && h('tr', null, h('td', null, h('span', { class: `chip` }, p.pos || p.line)), h('td', null, h('div', { class: 'who' }, avatar(p, 'sm'), h('a', { href: u(`/oyuncu/${p.id}`) }, p.name))), h('td', { class: 'mute' }, POS_LONG[p.line]), h('td', { class: 'num' }, ageOn(p.dob, ref) ?? '—'), h('td', { class: 'mute' }, p.nat || ''), h('td', { class: 'num' }, fmtMoney(r.value))); }))),
    h('div', { class: 'dim', style: 'padding:10px 14px' }, t('Toplam piyasa değeri: {total} ({n} oyuncu)', { total: fmtMoney(total), n: list.length }))), { tight: true });
  }

  async function matchesTab() {
    const s = seasonArg ? season : dflt;
    const comps = Object.keys(ctx.idx).filter(c => ctx.idx[c][s]);
    const all = (await Promise.all(comps.map(async c => (await loadMatches(c, s)).filter(m => m.h === id || m.a === id).map(m => ({ ...m, comp: c }))))).flat().sort((a, b) => a.date.localeCompare(b.date));
    if (!all.length) return h('div', { class: 'empty' }, h('h3', null, t('Bu sezon için maç verisi yok')));
    const res = all.map(m => { const own = m.h === id ? m.hg : m.ag, opp = m.h === id ? m.ag : m.hg; return own > opp ? 'W' : own === opp ? 'D' : 'L'; });
    const w = res.filter(x => x === 'W').length, d = res.filter(x => x === 'D').length, l = res.filter(x => x === 'L').length;
    return sheet(h('h2', null, t('{season} maçları', { season: seasonLabel(s) })), h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
      h('tbody', null, all.map((m, i) => h('tr', null, h('td', { class: 'dim' }, fmtDay(m.date)), h('td', { class: 'dim' }, ctx.compName(m.comp)), h('td', null, m.h === id ? h('b', null, ctx.clubName(m.h)) : ctx.clubName(m.h)), h('td', { class: 'num' }, h('b', null, `${m.hg} - ${m.ag}`)), h('td', null, m.a === id ? h('b', null, ctx.clubName(m.a)) : ctx.clubName(m.a)), h('td', null, formStrip([res[i]])))))),
    h('div', { class: 'dim', style: 'padding:10px 14px' }, t('{w} galibiyet · {d} beraberlik · {l} mağlubiyet', { w, d, l }))), { tight: true, actions: [compId ? h('a', { class: 'btn sm', href: u(`/lig/${compId}/${s}`) }, t('Lig sayfasında what-if yap')) : null] });
  }

  async function transferTab() {
    const s = seasonArg ? season : dflt;
    const tr = (await loadTransfers(s)).filter(x => x.from === id || x.to === id);
    if (!tr.length) return h('div', { class: 'empty' }, h('h3', null, t('Bu dönem için transfer verisi yok')));
    const spent = tr.filter(x => x.to === id).reduce((q, x) => q + (x.fee || 0), 0), got = tr.filter(x => x.from === id).reduce((q, x) => q + (x.fee || 0), 0);
    return sheet(h('h2', null, t('{season} transferleri', { season: seasonLabel(s) })), h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, t('Tarih')), h('th', null, t('Yön')), h('th', null, t('Oyuncu')), h('th', null, t('Diğer kulüp')), h('th', { class: 'num' }, t('Bonservis')))),
      h('tbody', null, tr.sort((a, b) => (b.fee || 0) - (a.fee || 0)).map(x => { const p = P.byId.get(x.pid), into = x.to === id; return h('tr', null, h('td', { class: 'dim' }, fmtDate(x.date)), h('td', null, h('span', { class: `chip ${into ? 'uecl' : 'rel'}` }, into ? t('Geldi') : t('Gitti'))), h('td', null, p ? h('a', { href: u(`/oyuncu/${x.pid}`) }, p.name) : `#${x.pid}`), h('td', null, ctx.clubName(into ? x.from : x.to)), h('td', { class: 'num' }, x.fee ? fmtMoney(x.fee) : h('span', { class: 'dim' }, x.det ? t('ücret bilinmiyor') : t('serbest/kiralık')))); }))),
    h('div', { style: 'padding:10px 14px', class: 'row center' }, h('span', { class: 'dim' }, t('Harcama')), fmtMoney(spent), h('span', { class: 'dim' }, t('Gelir')), fmtMoney(got), h('span', { class: 'dim' }, t('Net')), delta((got - spent) / 1e6, { digits: 1, suffix: 'M' }))), { tight: true, actions: [h('a', { class: 'btn sm', href: u(`/transfer/${s}`) }, t('Transfer what-if'))] });
  }

  async function powerTab() {
    const pts = [];
    for (let s = 2012; s <= LAST_SEASON + 1; s++) { const e = await loadElo(s); if (e?.[id]) pts.push([s, e[id]]); }
    if (pts.length < 2) return h('div', { class: 'empty' }, h('h3', null, t('Güç geçmişi için yeterli maç verisi yok')));
    return sheet(h('h2', null, t('Sezon başı Elo')), lineChart({ series: [{ pts, color: 'var(--chalk)', markers: true }], xFmt: v => seasonLabel(Math.round(v)), yFmt: v => Math.round(v) }));
  }

  drawTabs(); drawTab();
}
