// Yeniden kullanılabilir ilk 11 düzenleyici: saha + kadro listesi. Kulüpler ve milli takımlar için aynı bileşen.
import { h, svg, mount, norm, debounce, fmtMoney } from './util.js';
import { FORMATIONS, ROLE_LINE, autoXI, fit, isOut, effLn, availOf } from './matchsim.js';
import { POS_LABEL, avatar } from './ui.js';
import { t, tl } from './i18n.js';

export const lastName = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p.slice(-1)[0] : p[0] || tl('—', '-'); };

export function pitchLines() {
  const s = svg('svg', { class: 'lines', viewBox: '0 0 68 100', preserveAspectRatio: 'none' });
  const r = (x, y, w, hh) => svg('rect', { x, y, width: w, height: hh });
  s.append(r(2, 2, 64, 96), svg('line', { x1: 2, y1: 50, x2: 66, y2: 50 }), svg('circle', { cx: 34, cy: 50, r: 8.7 }),
    r(14, 2, 40, 15.7), r(24, 2, 20, 5.2), r(14, 82.3, 40, 15.7), r(24, 92.8, 20, 5.2), svg('circle', { cx: 34, cy: 50, r: .6 }));
  return s;
}

/**
 * @param {object} o { squad:[{id,name,line,pos,value,age}], formation, xi:[id|null], onChange(xi,formation) }
 */
export function lineupEditor(o) {
  let selected = null, filter = 'ALL', q = '';
  const root = h('div', { class: 'grid', style: 'gap:12px' });
  const byId = new Map(o.squad.map(p => [p.id, p]));

  const setXI = (xi, formation = o.formation) => { o.xi = xi; o.formation = formation; o.onChange?.(xi, formation); draw(); };

  const place = pid => {
    const xi = [...o.xi], slots = FORMATIONS[o.formation];
    const cur = xi.indexOf(pid);
    let target = selected;
    if (target == null) {
      // seçili slot yoksa: boş slotlardan en uygun olanı
      let best = -1, bf = -1;
      slots.forEach((s, i) => { if (xi[i] == null) { const f = fit(byId.get(pid), s.role); if (f > bf) { bf = f; best = i; } } });
      target = best;
      if (target < 0) return;
    }
    if (cur >= 0) { xi[cur] = xi[target]; }       // takas
    xi[target] = pid;
    selected = null;
    setXI(xi);
  };

  const lineColor = s => (s >= .66 ? '#5dff8a' : s >= .38 ? '#ffd24a' : '#ff6b5b');
  function linkLayer(chem, slots) {
    const sv = svg('svg', { class: 'links', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
    for (const l of chem?.links || []) {
      sv.append(svg('line', { x1: slots[l.i].x, y1: slots[l.i].y, x2: slots[l.j].x, y2: slots[l.j].y, stroke: lineColor(l.s), 'stroke-width': .6 + 1.4 * l.s, 'stroke-linecap': 'round', opacity: .45 + .5 * l.s }));
    }
    return sv;
  }
  function draw() {
    const slots = FORMATIONS[o.formation];
    const used = new Set(o.xi.filter(Boolean));
    const chem = o.getChem?.() || null;
    const avail = o.avail?.() || null;
    const pitch = h('div', { class: 'pitch-wrap' }, pitchLines(), chem ? linkLayer(chem, slots) : null,
      ...slots.map((s, i) => {
        const p = byId.get(o.xi[i]);
        const f = p ? fit(p, s.role) : 1;
        const btn = h('button', { class: `slot ${p ? p.line : 'empty'} ${selected === i ? 'sel' : ''} ${f < .8 || (p && availOf(p, avail) < 1) ? 'out' : ''}`, style: `left:${s.x}%;top:${s.y}%`, title: p ? `${p.name} · ${fmtMoney(p.value)}${f < .8 ? ' · ' + t('mevki dışı') : ''}${p && availOf(p, avail) < 1 ? ` · ${availOf(p, avail) > .5 ? t('ŞÜPHELİ') : t('SAKAT')}${p.inj ? ': ' + p.inj.t : ''}` : ''}` : t('{role} seç', { role: s.role }),
          onclick: () => { selected = selected === i ? null : i; draw(); }, 'aria-label': `${s.role} ${p ? p.name : t('boş')}` },
          h('span', { class: 'disc' }, p ? (p.img || p.esp ? avatar(p) : s.role) : '+'), p && o.ovr ? h('span', { class: 'ov', title: t('Tahmini genel güç (piyasa değeri ve yaştan)') }, o.ovr(p)) : null,
          p && chem ? h('span', { class: `ch c${Math.min(3, Math.round(chem.per[i] * 3))}`, title: t('Kimya {n}%', { n: Math.round(chem.per[i] * 100) }) }, '●●●'.slice(0, Math.max(1, Math.round(chem.per[i] * 3)))) : null,
          h('span', { class: 'nm' }, p ? lastName(p.name) : s.role), p ? h('span', { class: 'vl' }, `${s.role} · ${fmtMoney(p.value)}`) : null);
        return btn;
      }));

    const formSel = h('select', { 'aria-label': t('Diziliş'), onchange: e => { const f = e.target.value; setXI(autoXI(o.squad, f, o.avail?.()), f); } },
      Object.keys(FORMATIONS).map(f => h('option', { value: f, selected: f === o.formation }, f)));
    const bar = h('div', { class: 'row center', style: 'justify-content:space-between' },
      h('div', { class: 'row center' }, formSel, h('button', { class: 'btn sm', onclick: () => { selected = null; setXI(autoXI(o.squad, o.formation, o.avail?.())); } }, t('En iyi 11')),
        o.addPlayer ? h('button', { class: 'btn sm', onclick: async () => { const np = await o.addPlayer(); if (np) { o.squad.push(np); byId.set(np.id, np); autoPlace(np); } } }, t('+ Oyuncu ekle (hayali transfer)')) : null,
        selected != null && o.xi[selected] ? h('button', { class: 'btn sm', onclick: () => { const xi = [...o.xi]; xi[selected] = null; selected = null; setXI(xi); } }, t('Çıkar')) : null,
        selected != null && o.xi[selected] && o.onSell ? h('button', { class: 'btn sm', title: t('Oyuncuyu kadrodan tamamen çıkarır (hayali satış)'), onclick: () => { const pid = o.xi[selected]; o.onSell(pid); o.squad = o.squad.filter(q => q.id !== pid); byId.delete(pid); const xi = o.xi.map(x => (x === pid ? null : x)); const hole = xi.indexOf(null); selected = null; setXI(fillHole(xi, hole)); } }, t('Kadrodan sat')) : null,
        selected != null && o.xi[selected] && o.setAvail ? (() => { const pp = byId.get(o.xi[selected]), a = availOf(pp, avail), nx = a >= .99 ? .5 : a > .5 ? 0 : 1;
          return h('button', { class: `btn sm ${a < 1 ? 'mk' : ''}`, title: t('Oyuncunun durumunu değiştir: sağlam → şüpheli (%50) → sakat. Veri kaynağı yalnızca Premier League sakatlıklarını bilir; diğerlerini sen işaretleyebilirsin.'), onclick: () => { o.setAvail(pp.id, nx); const xi = [...o.xi]; if (nx === 0) { xi[selected] = null; const hole = selected; selected = null; setXI(fillHole(xi, hole)); } else setXI(xi); } }, t('Durum: {a} → {b}', { a: a >= .99 ? t('sağlam') : a > .5 ? t('şüpheli') : t('sakat'), b: nx === 1 ? t('sağlam') : nx === .5 ? t('şüpheli') : t('sakat') })); })() : null,
        chem ? h('span', { class: `chip ${chem.team >= .6 ? 'uecl' : chem.team < .35 ? 'rel' : ''}`, title: t('Takım kimyası: komşu mevkideki oyuncuların daha önce birlikte oynamış olması, ortak uyruk/lig ve kulübe uyum süresi') }, t('Kimya %{n}', { n: Math.round(chem.team * 100) })) : null),
      h('span', { class: 'dim', style: 'font-size:12px' }, selected != null ? t('{role} için oyuncu seç', { role: slots[selected].role }) : t('Bir slota tıkla, sonra oyuncu seç')));

    const list = h('div', { class: 'pl-list' });
    const drawList = () => {
      const qq = norm(q).trim();
      const rows = o.squad.filter(p => (filter === 'ALL' || p.line === filter) && (!qq || norm(p.name).includes(qq)));
      const sel = selected != null ? slots[selected].role : null;
      if (sel) rows.sort((a, b) => effLn(b, fit(b, sel)) - effLn(a, fit(a, sel)));
      list.replaceChildren(...rows.map(p => h('button', { class: `pl ${used.has(p.id) ? 'used' : ''}`, onclick: () => place(p.id), title: used.has(p.id) ? t('İlk 11’de — tıkla: yer değiştir') : '' },
        h('span', { class: `p ${p.line}` }, p.pos || POS_LABEL[p.line]),
        h('span', { class: 'who' }, avatar(p, 'sm'), h('span', null, p.name, h('span', { class: 'dim' }, p.age ? `  ${p.age}` : ''), sel && fit(p, sel) < .8 ? h('span', { class: 'chip', style: 'margin-left:6px' }, t('mevki dışı')) : null, p.inj ? h('span', { class: `chip ${isOut(p) ? 'rel' : 'mk'}`, style: 'margin-left:6px', title: p.inj.t }, isOut(p) ? t('Sakat') : t('Şüpheli')) : null, p.added ? h('span', { class: 'chip promo', style: 'margin-left:6px' }, t('Yeni transfer')) : null, p.st && p.st.ap ? h('span', { class: 'dim', style: 'margin-left:8px;font-size:12.5px' }, t('{n} maç {g}g {a}a', { n: p.st.ap, g: p.st.g, a: p.st.as })) : null)),
        h('span', { class: 'mute' }, fmtMoney(p.value)))));
      if (!rows.length) list.append(h('div', { class: 'empty', style: 'padding:16px' }, t('Oyuncu bulunamadı')));
    };
    const search = h('input', { type: 'search', placeholder: t('Oyuncu ara…'), style: 'flex:1;min-width:120px', oninput: debounce(e => { q = e.target.value; drawList(); }, 80) });
    const tabs = h('div', { class: 'seg' }, ...[['ALL', t('Tümü')], ['G', tl('KL', 'GK')], ['D', tl('DF', 'DF')], ['M', tl('OS', 'MF')], ['A', tl('FV', 'FW')]].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; draw(); } }, l)));
    drawList();
    mount(root, bar, h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));align-items:start' },
      pitch,
      h('div', { class: 'sheet tight' }, h('div', { class: 'hd', style: 'gap:8px;flex-wrap:wrap' }, search, tabs), list)));
  }
  /** Yeni gelen oyuncu, en çok kazandıran mevkideki oyuncunun yerine ilk 11'e girer (kendisinden zayıfsa yedek kalır). */
  function autoPlace(np) {
    const xi = [...o.xi], slots = FORMATIONS[o.formation];
    const sc = (p, role) => (p ? effLn(p, fit(p, role)) : 0);
    let best = -1, gain = 0.05;
    slots.forEach((sl, i) => { const g = sc(np, sl.role) - sc(byId.get(xi[i]), sl.role); if (g > gain) { gain = g; best = i; } });
    if (best >= 0) { xi[best] = np.id; selected = null; setXI(xi); } else draw();
  }
  /** Satılan oyuncunun yerine kadrodaki en uygun boştaki oyuncuyu koyar. */
  function fillHole(xi, i) {
    if (i < 0) return xi;
    const role = FORMATIONS[o.formation][i].role, taken = new Set(xi.filter(Boolean));
    const cand = o.squad.filter(p => !taken.has(p.id) && !isOut(p, o.avail?.())).sort((a, b) => effLn(b, fit(b, role)) - effLn(a, fit(a, role)))[0];
    if (cand) xi[i] = cand.id;
    return xi;
  }
  draw();
  return { el: root, refresh: draw, setSquad: sq => { o.squad = sq; byId.clear(); sq.forEach(p => byId.set(p.id, p)); draw(); } };
}
