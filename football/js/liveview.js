// Maçı 2D izle: tuval, hız kontrolü, anlık taktik ve oyuncu değişikliği.
import { h, mount, fmtPct } from './util.js';
import { Match2D, W, H, GOAL_TAG } from './match2d.js';
import { t as tp, tl as tlang } from './i18n.js';
import { teamRatings, matchLambdas } from './matchsim.js';
import { lastName } from './lineup.js';

const COLORS = { h: '#2563d6', a: '#e0452b' };
const SPEEDS = [['3', tp('Yavaş')], ['8', tp('Normal')], ['20', tp('Hızlı')], ['60', tp('Çok hızlı')], ['hl', tp('Önemli anlar')]];
const ICON = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔁', save: '🧤', corner: '🚩', foul: '✋', pen: '🎯', block: '🛡️', ht: '⏸', ft: '🏁', ko2: '▶️', clear: '🧹' };
const DEAD = { corner: tlang('Korner', 'Corner'), pen: tp('Penaltı'), free: tp('Serbest vuruş'), throw: tp('Taç atışı'), goalkick: tp('Kale vuruşu'), kickoff: tp('Başlama vuruşu') };

export function openLive({ names, sides, neutral = false, haValue }) {
  // sides: { h:{ squad, elo, formation, xi:[id], tactics }, a:{...} }
  const live = {};
  const fresh = () => {
    for (const k of ['h', 'a']) {
      const s = sides[k], byId = new Map(s.squad.map(p => [p.id, p]));
      live[k] = { name: names[k], color: COLORS[k], formation: s.formation, squad: s.squad, elo: s.elo, rate: s.rate, tactics: { ...(live[k]?.tactics || s.tactics) }, xi: s.xi.map(id => byId.get(id) || null) };
    }
  };
  fresh();
  const rates = () => {
    const rt = k => { const a = { squad: live[k].squad, formation: live[k].formation, xi: live[k].xi.map(p => p?.id ?? null), tactics: live[k].tactics }; return live[k].rate ? live[k].rate(a.squad, a.formation, a.xi, a.tactics) : teamRatings({ baseElo: live[k].elo, ...a }); };
    const [lh, la] = matchLambdas(rt('h'), rt('a'), { neutral, ha: haValue });
    return { lh, la };
  };
  let m = new Match2D({ sides: live, rates });

  const dlg = h('dialog', { 'aria-label': tp('Maçı izle'), style: 'max-width:min(1180px,97vw);width:97vw' });
  const canvas = h('canvas', { 'aria-label': tp('Maç sahası') });
  const pitch = h('div', { class: 'live-pitch' }, canvas);
  const board = h('div', { class: 'scoreboard' });
  const scorers = h('div', { class: 'dim', style: 'text-align:center;font-size:13.5px;min-height:20px;margin-top:-8px' });
  const tl = h('ul', { class: 'timeline' });
  const statsBox = h('div'), ctrlBox = h('div'), tacBox = h('div'), motm = h('div');
  let raf = 0, last = 0, speedKey = '8', side = 'h', showNames = false, hover = null;

  const play = h('button', { class: 'btn primary lg', onclick: () => { if (m.finished) restart(); else if (m.paused) m.resume(); else m.paused = true; drawCtrl(); } });
  function restart() { fresh(); m = new Match2D({ sides: live, rates }); m.paused = false; m.h2started = false; m.speed = effSpeed(); evCount = -1; drawCtrl(); drawTac(); }
  const effSpeed = () => speedKey === 'hl' ? (m.hot ? 6 : 70) : +speedKey;
  function drawCtrl() {
    play.textContent = m.finished ? tp('Tekrar oyna') : m.paused ? (m.sec === 0 ? tp('Başlat') : m.atHalfTime ? tp('2. yarıyı başlat') : tp('Devam et')) : tp('Duraklat');
    const sp = h('div', { class: 'seg' }, SPEEDS.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(speedKey === k), onclick: () => { speedKey = k; drawCtrl(); } }, l)));
    mount(ctrlBox, h('div', { class: 'row center', style: 'gap:10px' }, play, sp,
      h('label', { class: 'row center', style: 'gap:6px;font-size:13.5px' }, h('input', { type: 'checkbox', checked: showNames, onchange: e => { showNames = e.target.checked; } }), tp('İsimler')),
      h('span', { style: 'flex:1' }), h('button', { class: 'btn', onclick: () => { m.finishNow(); drawCtrl(); drawTac(); } }, tp('Sonucu hemen göster')), h('button', { class: 'btn ghost', onclick: close }, tp('Kapat'))));
  }
  function drawTac() {
    const L = live[side], q = (key, label, lo, hi) => h('div', { class: 'sl' }, h('div', { class: 't' }, h('span', null, label), h('span', { class: 'dim' }, `${lo} ↔ ${hi}`)),
      h('input', { type: 'range', min: 0, max: 100, value: L.tactics[key] ?? 50, 'aria-label': label, oninput: e => { L.tactics[key] = +e.target.value; } }));
    const onPitch = m.players[side].filter(p => p.p && !p.off);
    const used = new Set(m.players[side].map(p => p.p?.id));
    const bench = L.squad.filter(p => !used.has(p.id)).sort((a, b) => b.value - a.value);
    const outSel = h('select', { 'aria-label': tp('Çıkacak oyuncu') }, onPitch.map(p => h('option', { value: p.slot }, `${p.role} · ${p.p.name}`)));
    const inSel = h('select', { 'aria-label': tp('Girecek oyuncu') }, bench.map(p => h('option', { value: p.id }, `${p.pos || p.line} · ${p.name}`)));
    mount(tacBox, h('div', { class: 'seg', style: 'margin-bottom:12px' }, [['h', names.h], ['a', names.a]].map(([k, n]) => h('button', { type: 'button', 'aria-pressed': String(side === k), onclick: () => { side = k; drawTac(); } }, n))),
      h('div', { class: 'sliders' }, q('mentality', tp('Mentalite'), tp('Defansif'), tp('Hücumcu')), q('press', tp('Pres'), tp('Düşük'), tp('Yüksek')), q('tempo', tp('Tempo'), tp('Yavaş'), tp('Hızlı'))),
      h('div', { style: 'margin-top:16px;display:grid;gap:8px' }, h('div', { class: 'cap' }, tp('Oyuncu değişikliği ({n}/5)', { n: m.subs[side] })), outSel, inSel,
        h('button', { class: 'btn', disabled: !bench.length || m.subs[side] >= 5, onclick: () => { const np = bench.find(p => p.id === +inSel.value); if (np && m.substitute(side, +outSel.value, np)) drawTac(); } }, tlang('Değiştir', 'Make substitution'))),
      h('div', { class: 'dim', style: 'font-size:13px;margin-top:10px' }, tp('Maç sürerken de değiştirebilirsin; etkisi hemen başlar.')));
  }
  function drawSide() {
    const s = m.stats, tot = Math.max(1, s.h.seq + s.a.seq), acc = t => (s[t].pass ? Math.round(s[t].pc / s[t].pass * 100) + '%' : tlang('—', '-'));
    const row = (l, a, b) => h('tr', null, h('td', { class: 'num' }, a), h('td', { style: 'text-align:center;color:var(--ink-3)' }, l), h('td', null, b));
    mount(statsBox, h('table', { class: 'tbl' }, h('tbody', null,
      row(tp('Top hakimiyeti'), fmtPct(s.h.seq / tot), fmtPct(s.a.seq / tot)), row(tp('Şut'), s.h.shots, s.a.shots), row(tp('İsabetli şut'), s.h.on, s.a.on), row(tp('Beklenen gol (xG)'), s.h.xg.toFixed(2), s.a.xg.toFixed(2)),
      row(tp('Pas isabeti'), acc('h'), acc('a')), row(tp('Korner'), s.h.corner, s.a.corner), row(tp('Faul'), s.h.foul, s.a.foul), row(tp('Sarı kart'), s.h.y, s.a.y), row(tp('Kırmızı kart'), s.h.r, s.a.r))));
    const ev = [...m.events].reverse().slice(0, 60).filter(e => e.type !== 'foul' && e.type !== 'clear');
    mount(tl, ...ev.map(e => h('li', null, h('span', { class: `chip ${e.type === 'goal' ? 'promo' : e.type === 'red' ? 'rel' : e.type === 'yellow' ? 'mk' : ''}` }, `${e.min}'`), h('span', { style: e.type === 'goal' ? 'font-weight:700' : '' }, (ICON[e.type] ? ICON[e.type] + ' ' : '') + e.text))));
    board.replaceChildren(h('div', { class: 't' }, names.h), h('div', null, `${m.score.h} ${tlang('–', '-')} ${m.score.a}`), h('div', { class: 't', style: 'text-align:left' }, names.a),
      h('span', { class: 'clock' }, m.finished ? tp('Maç sonu') : m.atHalfTime ? tp('Devre arası') : m.clock));
    const goals = m.events.filter(e => e.type === 'goal');
    const line = t => goals.filter(e => e.team === t).map(e => `${lastName(e.who)} ${e.min}'`).join(' · ');
    scorers.textContent = goals.length ? `${line('h') || tlang('—', '-')}   |   ${line('a') || tlang('—', '-')}` : '';
    if (m.finished) {
      const b = m.summary().best;
      motm.replaceChildren(b ? h('div', { class: 'note', style: 'margin-top:8px' }, tp('Maçın oyuncusu: {p} ({team}) — {g} gol, {a} asist, {s} şut{k}', { p: b.p.name, team: names[b.side], g: b.st.g, a: b.st.a, s: b.st.s, k: b.st.k ? tp(', {n} kurtarış', { n: b.st.k }) : '' })) : '');
    } else motm.replaceChildren();
  }

  // ---- çizim ----
  function resize() { const r = pitch.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); }
  function pitchLines(c, k) {
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1.5, k * 0.17);
    const R = (x, y, w, hh) => c.strokeRect(x * k, y * k, w * k, hh * k);
    R(0.5, 0.5, W - 1, H - 1); c.beginPath(); c.moveTo(W / 2 * k, 0); c.lineTo(W / 2 * k, H * k); c.stroke();
    c.beginPath(); c.arc(W / 2 * k, H / 2 * k, 9.15 * k, 0, 6.283); c.stroke();
    c.beginPath(); c.arc(W / 2 * k, H / 2 * k, 0.4 * k, 0, 6.283); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
    R(0.5, (H - 40.3) / 2, 16.5, 40.3); R(W - 17, (H - 40.3) / 2, 16.5, 40.3); R(0.5, (H - 18.3) / 2, 5.5, 18.3); R(W - 6, (H - 18.3) / 2, 5.5, 18.3);
    c.beginPath(); c.arc(11.5 * k, H / 2 * k, 9.15 * k, -0.93, 0.93); c.stroke(); c.beginPath(); c.arc((W - 11.5) * k, H / 2 * k, 9.15 * k, Math.PI - 0.93, Math.PI + 0.93); c.stroke();
    // kale ağları
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, (H / 2 - 3.66) * k, 2.2 * k, 7.32 * k); c.fillRect((W - 2.2) * k, (H / 2 - 3.66) * k, 2.2 * k, 7.32 * k);
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = Math.max(2, k * 0.3); c.strokeRect(0.2 * k, (H / 2 - 3.66) * k, 2 * k, 7.32 * k); c.strokeRect((W - 2.2) * k, (H / 2 - 3.66) * k, 2 * k, 7.32 * k);
  }
  function draw() {
    const c = canvas.getContext('2d'), k = canvas.width / W;
    c.clearRect(0, 0, canvas.width, canvas.height);
    pitchLines(c, k);
    const snap = m.snapshot(), rad = Math.max(6, k * 1.15);
    // top izi
    if (snap.trail.length > 4) { c.beginPath(); c.moveTo(snap.trail[0] * k, snap.trail[1] * k); for (let i = 2; i < snap.trail.length; i += 2) c.lineTo(snap.trail[i] * k, snap.trail[i + 1] * k); c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = Math.max(1.5, k * 0.25); c.stroke(); }
    // pas / şut çizgisi
    const fl = snap.flight;
    if (fl && fl.kind === 'pass') { c.setLineDash([k * 0.8, k * 0.6]); c.beginPath(); c.moveTo(fl.from.x * k, fl.from.y * k); c.lineTo(fl.aim.x * k, fl.aim.y * k); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(1.5, k * 0.2); c.stroke(); c.setLineDash([]); }
    if (fl && fl.kind === 'shot') { c.beginPath(); c.moveTo(fl.from.x * k, fl.from.y * k); c.lineTo(fl.to.x * k, fl.to.y * k); c.strokeStyle = 'rgba(255,224,102,.85)'; c.lineWidth = Math.max(2, k * 0.35); c.stroke(); }
    const label = (q, y) => { c.font = `600 ${Math.max(10.5, k * 1.05)}px Inter, sans-serif`; c.textAlign = 'center'; const t = lastName(q.p.name), w = c.measureText(t).width + 8; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(q.x * k - w / 2, y - 11, w, 15); c.fillStyle = '#fff'; c.fillText(t, q.x * k, y); };
    const drawP = (q, t) => {
      const gk = q.role === 'GK', x = q.x * k, y = q.y * k;
      c.beginPath(); c.ellipse(x + 1, y + rad * 0.85, rad * 0.9, rad * 0.35, 0, 0, 6.283); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill();
      c.beginPath(); c.arc(x, y, rad, 0, 6.283); c.fillStyle = gk ? (t === 'h' ? '#f2c230' : '#33c481') : COLORS[t]; c.fill();
      c.lineWidth = snap.carrier === q ? 3 : 1.6; c.strokeStyle = snap.carrier === q ? '#fff' : 'rgba(255,255,255,.7)'; c.stroke();
      c.fillStyle = gk ? '#1b1b1b' : '#fff'; c.font = `700 ${Math.max(9, rad * 0.95)}px Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(q.p.jersey || q.slot + 1), x, y + 0.5); c.textBaseline = 'alphabetic';
      if (q.yellow) { c.fillStyle = '#ffd23f'; c.fillRect(x + rad * 0.5, y - rad * 1.3, rad * 0.55, rad * 0.8); }
    };
    for (const t of ['h', 'a']) for (const q of snap[t]) if (q.p && !q.off) drawP(q, t);
    const nameOn = new Set([snap.carrier, snap.recv, hover].filter(Boolean));
    for (const t of ['h', 'a']) for (const q of snap[t]) if (q.p && !q.off && (showNames || nameOn.has(q))) label(q, q.y * k - rad - 5);
    // top
    const b = snap.ball, z = b.z * k * 0.5;
    c.beginPath(); c.arc(b.x * k + 1, b.y * k + 2, rad * 0.5, 0, 6.283); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill();
    c.beginPath(); c.arc(b.x * k, b.y * k - z, rad * 0.5, 0, 6.283); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = '#222'; c.stroke();
    // durum etiketi
    if (snap.dead && DEAD[snap.dead.type] && m.state !== 'goal') { const t = DEAD[snap.dead.type]; c.font = `700 ${Math.max(13, k * 1.5)}px Inter, sans-serif`; c.textAlign = 'center'; const w = c.measureText(t).width + 24; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(canvas.width / 2 - w / 2, 12, w, k * 2.6); c.fillStyle = '#fff'; c.fillText(t, canvas.width / 2, 12 + k * 1.85); }
    if (m.state === 'goal' && m.pause > 0) {
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = `800 ${k * 9}px "Space Grotesk", Inter, sans-serif`; c.fillText(GOAL_TAG, canvas.width / 2, canvas.height / 2 + k * 3);
      const ev = [...m.events].reverse().find(e => e.type === 'goal'); c.font = `600 ${k * 2.6}px Inter, sans-serif`; if (ev) c.fillText(ev.text.replace(GOAL_TAG + ' ', ''), canvas.width / 2, canvas.height / 2 + k * 8);
    }
  }
  let evCount = -1, uiT = 0;
  function frame(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    const wasPaused = m.paused, wasFinished = m.finished;
    m.speed = effSpeed(); dlg._m = m;
    m.update(dt);
    draw();
    uiT += dt;
    if (m.events.length !== evCount || uiT > 0.5) { evCount = m.events.length; uiT = 0; drawSide(); }
    if (m.paused !== wasPaused || m.finished !== wasFinished) { drawCtrl(); drawTac(); }
    raf = requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    let best = null, bd = 3.2;
    for (const t of ['h', 'a']) for (const q of m.players[t]) { if (!q.p || q.off) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } }
    hover = best;
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });
  function close() { cancelAnimationFrame(raf); removeEventListener('resize', resize); dlg.close(); dlg.remove(); }

  dlg.append(h('div', { style: 'padding:14px 18px 18px;display:grid;gap:14px' },
    h('div', { class: 'live-wrap' }, h('div', { style: 'display:grid;gap:10px' }, board, scorers, pitch, ctrlBox, motm),
      h('div', { style: 'display:grid;gap:14px' }, h('div', { class: 'sheet' }, h('div', { class: 'hd' }, h('h3', null, tp('Taktik ve değişiklik'))), h('div', { class: 'bd' }, tacBox)),
        h('div', { class: 'sheet' }, h('div', { class: 'hd' }, h('h3', null, tp('Maç istatistikleri'))), h('div', { class: 'bd', style: 'padding:0' }, statsBox)),
        h('div', { class: 'sheet' }, h('div', { class: 'hd' }, h('h3', null, tp('Maç olayları'))), tl)))));
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  document.body.append(dlg); dlg.showModal();
  addEventListener('resize', resize);
  resize(); drawCtrl(); drawTac(); drawSide(); raf = requestAnimationFrame(ts => { last = ts; frame(ts); });
}
