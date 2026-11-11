// 2D canlı maç motoru (v2). Oyuncular sahada gerçek hızlarla koşar; top pasla, çalımla ve şutla ilerler.
// Gol sayısı, maç simülatöründeki beklenen gol (λ) ile tutarlı kalır: her şutun "ham" gol değeri (xG) saha konumundan gelir,
// ölçek katsayısı K ise o ana kadarki şutlardan λ'ya göre sürekli ayarlanır.
import { rng } from './engine.js';
import { FORMATIONS, ROLE_LINE } from './matchsim.js';
import { t as tp, tl as tlang } from './i18n.js';

export const W = 105, H = 68;
/** Gol olay metninin başlığı; arayüz, gol satırından bunu ayıklayıp yalnızca "kim, hangi takım" kısmını gösterir. */
export const GOAL_TAG = tp('GOL!');
const GH = 3.66;                                  // yarım kale genişliği (m)

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hyp = Math.hypot;
// Takımın kendi çerçevesi: x = 0 kendi kalesi, x = W rakip kale. Ev sahibi için dünya = çerçeve; deplasman için ayna.
const FX = (s, x) => (s === 'h' ? x : W - x);
const FY = (s, y) => (s === 'h' ? y : H - y);
const OPP = s => (s === 'h' ? 'a' : 'h');
const V0 = Math.log(2e5), V1 = Math.log(2e8);
const skillOf = p => clamp((Math.log(Math.max(p?.value || 3e5, 2e5)) - V0) / (V1 - V0), 0, 1);
const MAXV = { G: 5.2, D: 6.6, M: 6.9, A: 7.3 };
const PUSH_ATT = { D: 5, M: 9, A: 13 }, PUSH_DEF = { D: -3, M: -7, A: -11 }, FOLLOW = { D: 0.42, M: 0.55, A: 0.5 }, MIN_FX = { D: 7, M: 12, A: 24 };
const BOX_ATT = [[W - 6, H / 2 - 3], [W - 9, H / 2 + 4], [W - 11, H / 2 - 6], [W - 7, H / 2 + 8], [W - 14, H / 2], [W - 16, H / 2 - 8]];
const BOX_DEF = [[6, H / 2 - 4], [8, H / 2 + 3], [10, H / 2 - 7], [7, H / 2 + 8], [12, H / 2 + 1], [14, H / 2 - 9]];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return { d: hyp(px - (ax + t * dx), py - (ay + t * dy)), t };
}

export class Match2D {
  /**
   * @param {object} o { sides:{h,a}, rates:()=>({lh,la}), seed }
   *  side = { name, formation, xi:[player|null], squad:[player], tactics }
   */
  constructor({ sides, rates, seed = (Math.random() * 1e9) | 0 }) {
    this.r = rng(seed);
    this.sides = sides; this.rates = rates;
    this.sec = 0; this.half = 1; this.speed = 8;
    this.s1 = 30 + Math.floor(this.r() * 60); this.s2 = 60 + Math.floor(this.r() * 4) * 30;
    this.score = { h: 0, a: 0 }; this.events = [];
    const st = () => ({ shots: 0, on: 0, y: 0, r: 0, seq: 0, xg: 0, pass: 0, pc: 0, foul: 0, corner: 0 });
    this.stats = { h: st(), a: st() }; this.subs = { h: 0, a: 0 }; this.xs = { h: 0, a: 0 };
    this.players = { h: this.makePlayers('h'), a: this.makePlayers('a') };
    this.ball = { x: W / 2, y: H / 2, z: 0 };
    this.owner = null; this.flight = null; this.loose = null; this.dead = null; this.drib = null; this.setPiece = null; this.passer = null;
    this.nd = 0; this.tkT = 0.3; this.lastTeam = 'h'; this.paused = true; this.finished = false; this.fast = false;
    this.kickTeam = this.r() < 0.5 ? 'h' : 'a';
    this._rt = null; this._rtT = 0;
    this.trail = [];
    this.log(0, 'start', null, tp('Maç başladı'));
    this.setDead('kickoff', this.kickTeam, { x: W / 2, y: H / 2 }, 1);
  }

  // ---- oyuncular ----
  makePlayers(side) {
    const f = FORMATIONS[this.sides[side].formation];
    return this.sides[side].xi.map((p, i) => {
      const s = f[i], gk = s.role === 'GK';
      const bfx = gk ? 4 : 17 + (79 - s.y) / 66 * 46, bfy = 6 + s.x / 100 * (H - 12);
      const x = FX(side, Math.min(bfx, W / 2 - 3)), y = FY(side, bfy);
      return { side, slot: i, p, role: s.role, line: ROLE_LINE[s.role] || 'M', bfx, bfy, x, y, vx: 0, vy: 0, tx: x, ty: y, sp: 1, off: false, yellow: 0, sk: skillOf(p), st: { g: 0, s: 0, a: 0, k: 0 } };
    });
  }
  on(side) { return this.players[side].filter(q => q.p && !q.off); }
  gk(side) { return this.players[side].find(q => q.role === 'GK' && q.p && !q.off) || null; }
  nearest(list, x, y, skip) {
    let best = null, bd = 1e9;
    for (const q of list) { if (q === skip) continue; const d = hyp(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } }
    return best ? { q: best, d: bd } : null;
  }
  get state() { return this.dead?.type === 'goal' ? 'goal' : 'play'; }
  get pause() { return this.dead?.type === 'goal' ? this.dead.t : 0; }
  get atHalfTime() { return this.half === 2 && this.paused && !this.h2started && !this.finished; }
  /** Özet modunda: topun kale önünde olduğu / durağan önemli anlar. */
  get hot() {
    if (this.dead) return this.dead.type !== 'goalkick' && this.dead.type !== 'throw' && this.dead.type !== 'kickoff';
    const bx = this.ball.x; return bx < 36 || bx > W - 36 || this.flight?.kind === 'shot';
  }

  log(sec, type, team, text, extra) { this.events.push({ min: Math.floor(sec / 60), type, team, text, ...extra }); }
  get minute() { return Math.min(Math.floor(this.sec / 60), 120); }
  get clock() {
    const m = Math.floor(this.sec / 60);
    if (this.half === 1 && m >= 45) return `45+${m - 45}'`;
    return this.half === 2 && m >= 90 ? `90+${m - 90}'` : `${m}'`;
  }

  // ---- kontroller ----
  setTactics(side, t) { this.sides[side].tactics = t; this._rt = null; }
  substitute(side, slot, np) {
    if (this.subs[side] >= 5) return false;
    const q = this.players[side][slot]; if (!q || q.off) return false;
    const old = q.p; q.p = np; q.sk = skillOf(np); this.sides[side].xi[slot] = np; this.subs[side]++; this._rt = null;
    this.log(this.sec, 'sub', side, tp('Oyuncu değişikliği ({team}): {out} → {inn}', { team: this.sides[side].name, out: old?.name || tlang('—', '-'), inn: np.name }));
    return true;
  }
  rt() { if (!this._rt || Math.abs(this.sec - this._rtT) > 3) { this._rt = this.rates(); this._rtT = this.sec; } return this._rt; }
  edge(side) { const { lh, la } = this.rt(); const e = Math.tanh(Math.log(lh / la) * 0.5); return side === 'h' ? e : -e; }
  lam(side) {
    const { lh, la } = this.rt(); let l = side === 'h' ? lh : la;
    const diff = this.score[side] - this.score[OPP(side)];
    if (diff < 0 && this.sec > 3600) l *= 1.1; if (diff > 1 && this.sec > 3600) l *= 0.92;
    return l;
  }
  calK(side) { const proj = (this.xs[side] + 0.027 * 30) / (this.sec / 60 + 30) * 90; return clamp((this.lam(side) - 0.07) / proj, 0.2, 3); }

  // ---- döngü ----
  update(dtReal) {
    if (this.finished || this.paused) return;
    let gs = dtReal * this.speed;
    while (gs > 0 && !this.finished && !this.paused) { const s = Math.min(gs, 0.2); this.tick(s); gs -= s; }
  }
  finishNow() { this.paused = false; this.fast = true; let g = 0; while (!this.finished && g++ < 60000) { this.tick(0.25); if (this.paused) this.resume(); } this.fast = false; }
  resume() {
    if (this.half === 2 && !this.h2started) {
      this.h2started = true;
      for (const t of ['h', 'a']) for (const q of this.players[t]) { q.x = FX(t, Math.min(q.bfx, W / 2 - 3)); q.y = FY(t, q.bfy); q.vx = q.vy = 0; }
      this.setDead('kickoff', OPP(this.kickTeam), { x: W / 2, y: H / 2 }, 2);
      this.log(this.sec, 'ko2', null, tp('İkinci yarı başladı'));
    }
    this.paused = false;
  }

  tick(dt) {
    this.sec += dt;
    if (this.half === 1 && this.sec >= 2700 + this.s1) {
      this.log(2700, 'ht', null, tp('Devre arası: {h}–{a}', { h: this.score.h, a: this.score.a }));
      this.half = 2; this.sec = 2700; this.paused = true; this.owner = null; this.flight = null; this.loose = null; this.dead = null; return;
    }
    if (this.half === 2 && this.sec >= 5400 + this.s2) { this.finished = true; this.log(this.sec, 'ft', null, tp('Maç bitti: {h}–{a}', { h: this.score.h, a: this.score.a })); return; }
    if (this.dead) { this.dead.t -= dt; this.move(dt); if (this.dead.t <= 0) this.endDead(); return; }
    this.play(dt); this.move(dt);
  }

  // ---- durdurulmuş toplar ----
  setDead(type, team, pt, t) {
    this.owner = null; this.flight = null; this.loose = null; this.drib = null; this.setPiece = null;
    this.dead = { type, team, pt, t, taker: pt ? this.pickTaker(type, team, pt) : null };
    this.lastTeam = team;
    if (pt) { this.ball.x = pt.x; this.ball.y = pt.y; this.ball.z = 0; }
    if (type === 'corner') this.stats[team].corner++;
  }
  pickTaker(type, team, pt) {
    const mates = this.on(team);
    if (type === 'goalkick') return this.gk(team) || mates[0];
    const out = mates.filter(q => q.role !== 'GK');
    if (type === 'pen') return out.reduce((a, q) => ((q.p.value || 0) * (q.line === 'A' ? 1.3 : 1) > (a.p.value || 0) * (a.line === 'A' ? 1.3 : 1) ? q : a), out[0]);
    if (type === 'kickoff') return this.nearest(out.filter(q => q.line !== 'D'), W / 2, H / 2)?.q || out[0];
    if (type === 'corner') return this.nearest(out.filter(q => q.line !== 'D'), pt.x, pt.y)?.q || out[0];
    return this.nearest(out, pt.x, pt.y)?.q || out[0];
  }
  endDead() {
    const d = this.dead; this.dead = null;
    if (d.type === 'goal') { this.setDead('kickoff', OPP(d.scorer), { x: W / 2, y: H / 2 }, 4.5); return; }
    let tk = d.taker; if (!tk || tk.off || !tk.p) tk = this.pickTaker(d.type, d.team, d.pt);
    if (!tk) return;
    if (d.type === 'kickoff') { tk.x = W / 2 - (tk.side === 'h' ? 0.8 : -0.8); tk.y = H / 2; }
    this.takeBall(tk, 0.5);
    if (d.type === 'corner') this.setPiece = 'corner';
    if (d.type === 'pen') this.setPiece = 'pen';
    if (d.type === 'free' && hyp(W - FX(d.team, tk.x), FY(d.team, tk.y) - H / 2) < 31) this.setPiece = 'free';
    if (d.type === 'goalkick') this.nd = 1.2;
  }
  takeBall(q, nd) {
    this.owner = q; this.lastTeam = q.side; this.flight = null; this.loose = null; this.drib = null;
    this.nd = nd ?? 0.45 + this.r() * 0.45; this.tkT = 0.35;
    this.ball.x = q.x; this.ball.y = q.y; this.ball.z = 0;
  }

  // ---- oyun akışı ----
  play(dt) {
    const o = this.owner;
    this.stats[o ? o.side : this.lastTeam].seq += dt;
    if (o) this.carrier(o, dt);
    else if (this.flight) this.fly(dt);
    else if (this.loose) this.chase(dt);
    else { const all = [...this.on('h'), ...this.on('a')].filter(q => q.role !== 'GK'); const n = this.nearest(all, this.ball.x, this.ball.y); if (n) this.takeBall(n.q); }
    if (!this.fast) { const t = this.trail; t.push(this.ball.x, this.ball.y); if (t.length > 20) t.splice(0, 2); }
  }
  carrier(o, dt) {
    const sp = hyp(o.vx, o.vy), ux = sp > 0.5 ? o.vx / sp : (o.side === 'h' ? 1 : -1), uy = sp > 0.5 ? o.vy / sp : 0, k = Math.min(1, dt * 9);
    this.ball.x += (o.x + ux * 0.8 - this.ball.x) * k; this.ball.y += (o.y + uy * 0.8 - this.ball.y) * k;
    const ne = this.nearest(this.on(OPP(o.side)), o.x, o.y);
    if (ne && ne.d < 2.0) {
      this.tkT -= dt;
      if (this.tkT <= 0) { this.tkT = 0.55 + this.r() * 0.4; this.challenge(o, ne.q); if (this.owner !== o) return; }
    } else this.tkT = Math.max(this.tkT, 0.3);
    this.nd -= dt; if (this.nd > 0) return;
    this.decide(o, ne);
  }
  challenge(o, t) {
    const press = ((this.sides[t.side].tactics?.press ?? 50) - 50) / 50;
    const p = clamp(0.15 + 0.3 * (t.sk - o.sk) + 0.1 * this.edge(t.side) + 0.06 * press, 0.04, 0.45);
    if (this.r() >= p) return;
    if (this.r() < 0.065) { this.foul(t, o); return; }
    this.takeBall(t);
  }
  foul(t, o) {
    const T = o.side; this.stats[t.side].foul++;
    const cfx = FX(T, o.x), cfy = FY(T, o.y), inBox = cfx > W - 16.5 && Math.abs(cfy - H / 2) < 20.15;
    if (inBox && this.r() > 0.06) { this.takeBall(t); return; }
    this.log(this.sec, 'foul', t.side, tp('Faul: {a} → {b}', { a: t.p.name, b: o.p.name }));
    const u = this.r();
    if (u < 0.012) this.sendOff(t, tp('Direkt kırmızı kart'));
    else if (u < 0.16) {
      t.yellow++;
      if (t.yellow >= 2) this.sendOff(t, tp('2. sarı'));
      else { this.stats[t.side].y++; this.log(this.sec, 'yellow', t.side, tp('Sarı kart: {n}', { n: t.p.name }), { who: t.p.name }); }
    }
    if (inBox) { this.log(this.sec, 'pen', T, tp('PENALTI! {team}', { team: this.sides[T].name })); this.setDead('pen', T, { x: FX(T, W - 11), y: FY(T, H / 2) }, 4.5); }
    else this.setDead('free', T, { x: o.x, y: o.y }, 2.2);
  }
  sendOff(q, why) {
    q.off = true; this.stats[q.side].r++; this.sides[q.side].xi[q.slot] = null; this._rt = null;
    this.log(this.sec, 'red', q.side, tp('Kırmızı kart! {n} ({why}) — {team} {k} kişi', { n: q.p.name, why, team: this.sides[q.side].name, k: this.on(q.side).length }), { who: q.p.name });
  }

  decide(o, ne) {
    const T = o.side, O = OPP(T), tac = this.sides[T].tactics || {}, ment = ((tac.mentality ?? 50) - 50) / 50, tempo = ((tac.tempo ?? 50) - 50) / 50;
    const e = this.edge(T);
    if (this.setPiece) {
      const sp = this.setPiece; this.setPiece = null;
      if (sp === 'pen') { this.shoot(o, 'pen'); return; }
      if (sp === 'corner') { this.corner(o); return; }
      if (sp === 'free' && this.r() < 0.5) { this.shoot(o, 'free'); return; }
    }
    const opps = this.on(O), mates = this.on(T).filter(q => q !== o);
    const cfx = FX(T, o.x), cfy = FY(T, o.y), dg = hyp(W - cfx, cfy - H / 2);
    const pres = ne ? ne.d : 99;
    // şut
    const roleF = { A: 1, M: 0.5, D: 0.1, G: 0 }[o.line] || 0.1;
    let ps = dg < 32 ? (dg < 11 ? 0.11 : dg < 17 ? 0.05 : dg < 23 ? 0.017 : 0.006) * roleF : 0;
    if (Math.abs(cfy - H / 2) > 20 && dg < 18) ps *= 0.35;
    if (pres < 1.6) ps *= 0.8;
    ps *= 1 + 0.25 * ment + 0.3 * e;
    if (ps > 0 && this.r() < ps) { this.shoot(o, 'open'); return; }
    // pas adayları
    const direct = clamp(0.5 + 0.5 * ment + 0.4 * tempo, 0.1, 1.2);
    const cands = [];
    for (const m of mates) {
      const d = hyp(m.x - o.x, m.y - o.y); if (d < 4 || d > 46) continue;
      const mf = FX(T, m.x), gain = mf - cfx, isGK = m.role === 'GK';
      if (isGK && (cfx > 40 || pres > 7)) continue;
      let open = 12, lane = 8;
      for (const q of opps) {
        open = Math.min(open, hyp(q.x - m.x, q.y - m.y));
        lane = Math.min(lane, segDist(q.x, q.y, o.x, o.y, m.x, m.y).d);
      }
      let sc = gain / 18 * (0.8 + 0.6 * direct) + Math.min(open, 9) / 9 * 0.9 + Math.min(lane, 5) / 5 * 1.4 - Math.abs(d - 16) / 30;
      if (mf > W - 30) sc += 0.5; if (isGK) sc -= 0.6; if (m.line === 'D' && gain < 0 && pres > 4) sc -= 0.3;
      if (pres < 2.5) sc += Math.min(open, 9) / 9 * 0.6;
      cands.push({ m, d, sc, open, lane, gain, w: Math.exp(1.6 * sc) });
    }
    // çalım
    let space = 15; for (const q of opps) { const ahead = FX(T, q.x) - cfx; if (ahead > -2 && Math.abs(FY(T, q.y) - cfy) < 9) space = Math.min(space, hyp(q.x - o.x, q.y - o.y)); }
    const roleD = { A: 1, M: 0.7, D: 0.45, G: 0 }[o.line] || 0.4;
    const wD = o.role === 'GK' ? 0 : 3.2 * roleD * clamp(space / 12, 0.1, 1.2) * (1 + 0.4 * (o.sk - 0.5)) * (cfx > W - 14 ? 0.5 : 1);
    const tot = cands.reduce((s, c) => s + c.w, 0) + wD;
    let u = this.r() * tot;
    if (!cands.length || u < wD) { this.dribble(o); return; }
    u -= wD; let pick = cands[0];
    for (const c of cands) { u -= c.w; if (u <= 0) { pick = c; break; } }
    this.pass(o, pick, pres);
  }
  dribble(o) {
    const T = o.side, cfx = FX(T, o.x), cfy = FY(T, o.y);
    const L = 8 + this.r() * 7, tfy = clamp(cfy + (H / 2 - cfy) * 0.22 + (this.r() - 0.5) * 9, 3, H - 3);
    this.drib = { tx: FX(T, clamp(cfx + L, 3, W - 2)), ty: FY(T, tfy) };
    this.nd = 0.7 + this.r() * 0.6;
  }
  pass(o, c, pres, then) {
    const T = o.side, m = c.m, e = this.edge(T);
    const spd = c.d > 25 ? 21 : 16, dur = Math.max(0.35, c.d / spd);
    const aim = { x: clamp(m.x + m.vx * dur * 0.5, 1, W - 1), y: clamp(m.y + m.vy * dur * 0.5, 1, H - 1) };
    let pf = 0.005 + c.d / 420 + (c.lane < 1.2 ? 0.16 : c.lane < 2.5 ? 0.05 : 0.01) + (pres < 2 ? 0.07 : pres < 4 ? 0.025 : 0) - 0.08 * (o.sk - 0.5) - 0.07 * e;
    if (c.gain > 20) pf += 0.06;
    pf = clamp(pf, 0.03, 0.7);
    const f = { kind: 'pass', team: T, from: { x: this.ball.x, y: this.ball.y }, to: aim, aim, t: 0, dur, recv: m, passer: o, end: 'ok', arc: c.d > 25 ? 1.2 : 0, then };
    this.stats[T].pass++;
    if (this.r() < pf) {
      const opps = this.on(OPP(T));
      let ib = null, bd = 1e9, bt = 0.5;
      for (const q of opps) { const s = segDist(q.x, q.y, o.x, o.y, aim.x, aim.y); if (s.d < bd && s.t > 0.2) { bd = s.d; ib = q; bt = s.t; } }
      if (this.r() < 0.62 && ib) {
        const t = clamp(bt, 0.3, 0.9);
        f.end = 'int'; f.int = ib; f.to = { x: f.from.x + (aim.x - f.from.x) * t, y: f.from.y + (aim.y - f.from.y) * t }; f.dur = Math.max(0.3, dur * t);
      } else {
        f.end = 'out';
        const dy = Math.min(aim.y, H - aim.y), dx = Math.min(aim.x, W - aim.x);
        f.to = dy < dx * 0.8 + 3 ? { x: aim.x, y: aim.y < H / 2 ? -0.5 : H + 0.5 } : { x: aim.x < W / 2 ? -0.5 : W + 0.5, y: clamp(aim.y, 3, H - 3) };
      }
    }
    this.owner = null; this.flight = f; this.drib = null; this.passer = { q: o, t: this.sec };
  }
  corner(o) {
    const T = o.side, O = OPP(T);
    const att = this.on(T).filter(q => q !== o && q.line !== 'G'), box = att.filter(q => FX(T, q.x) > W - 28 || q.line !== 'M');
    const cand = (box.length ? box : att).sort((a, b) => ((b.line === 'A' ? 1.2 : b.line === 'D' ? 1 : 0.5) * (b.p.value || 1e6)) - ((a.line === 'A' ? 1.2 : a.line === 'D' ? 1 : 0.5) * (a.p.value || 1e6)));
    const m = cand[Math.floor(this.r() * Math.min(3, cand.length))];
    if (!m) { this.dribble(o); return; }
    const aim = { x: m.x, y: m.y }, d = hyp(aim.x - o.x, aim.y - o.y);
    const f = { kind: 'pass', team: T, from: { x: o.x, y: o.y }, to: aim, aim, t: 0, dur: Math.max(0.8, d / 17), recv: m, passer: o, end: 'ok', arc: 3, then: 'head' };
    this.stats[T].pass++;
    if (this.r() > 0.55) {
      const dfs = this.on(O).filter(q => q.role !== 'GK'), ib = this.nearest(dfs, aim.x, aim.y)?.q;
      if (ib) { f.end = 'int'; f.int = ib; f.to = { x: ib.x, y: ib.y }; }
    }
    this.owner = null; this.flight = f; this.passer = { q: o, t: this.sec };
  }

  // ---- şut ----
  shoot(o, kind) {
    const T = o.side, O = OPP(T), cfx = FX(T, o.x), cfy = FY(T, o.y);
    const x = Math.max(W - cfx, 0.5), y = Math.abs(cfy - H / 2);
    const ang = Math.atan2(2 * GH * x, x * x + y * y - GH * GH);
    const a = ang < 0 ? ang + Math.PI : ang;
    const ne = this.nearest(this.on(O), o.x, o.y), pres = ne ? ne.d : 99;
    let xg = 0.01 + 0.6 * Math.pow(a, 2.2);
    xg *= 1 - 0.45 * clamp(1 - pres / 4, 0, 1); xg *= 0.85 + 0.3 * o.sk;
    if (kind === 'head') xg *= 0.65; if (kind === 'free') xg *= 0.7;
    let pg;
    if (kind === 'pen') { xg = 0.76; pg = clamp(0.76 + 0.08 * (o.sk - 0.5), 0.6, 0.88); }
    else { pg = clamp(xg * this.calK(T), 0.01, 0.85); }
    this.xs[T] += kind === 'pen' ? 0 : xg; this.stats[T].xg += pg;
    const keeper = this.gk(O), r = this.r(), u = this.r();
    let res = r < pg ? 'goal' : u < 0.27 ? 'save' : u < 0.55 && kind !== 'pen' ? 'block' : 'wide';
    if (kind === 'pen' && res !== 'goal') res = u < 0.7 ? 'save' : 'wide';
    if (!keeper && res === 'save') res = 'wide';
    const gx = FX(T, W), side = this.r() < 0.5 ? -1 : 1;
    const f = { kind: 'shot', team: T, shooter: o, res, from: { x: this.ball.x, y: this.ball.y }, t: 0, dur: 0.5, arc: 0.6, xg, shotKind: kind };
    const gy = H / 2 + side * (0.6 + this.r() * (GH - 1.0)), world = (fx, fy) => ({ x: FX(T, fx), y: FY(T, fy) });
    if (res === 'goal') f.to = world(W + 1.2, gy);
    else if (res === 'save') f.to = world(W - 1.2, gy);
    else if (res === 'wide') f.to = world(W + 0.8, H / 2 + side * (GH + 0.6 + this.r() * 5));
    else {
      const df = this.on(O).filter(q => q.role !== 'GK').map(q => ({ q, s: segDist(q.x, q.y, o.x, o.y, FX(T, W), H / 2) })).filter(c => c.s.t > 0.1 && c.s.t < 0.85 && c.s.d < 4).sort((p, q) => p.s.d - q.s.d)[0];
      if (df) { f.blocker = df.q; f.to = { x: df.q.x, y: df.q.y }; } else { f.res = 'wide'; f.to = world(W + 0.8, H / 2 + side * (GH + 3)); }
    }
    f.dur = Math.max(0.3, hyp(f.to.x - f.from.x, f.to.y - f.from.y) / 27);
    this.stats[T].shots++; o.st.s++;
    this.owner = null; this.flight = f; this.drib = null; this.passer = this.passer && this.passer.q.side === T ? this.passer : null;
  }
  fly(dt) {
    const f = this.flight; f.t += dt / f.dur; const k = Math.min(1, f.t);
    this.ball.x = f.from.x + (f.to.x - f.from.x) * k; this.ball.y = f.from.y + (f.to.y - f.from.y) * k;
    this.ball.z = f.arc ? Math.sin(Math.PI * k) * f.arc : 0;
    if (k >= 1) this.land(f);
  }
  land(f) {
    this.flight = null; this.ball.z = 0;
    if (f.kind === 'pass') {
      if (f.end === 'ok') {
        this.stats[f.team].pc++; f.passer.st.a += 0;
        this.takeBall(f.recv, f.then === 'head' ? 0 : undefined);
        if (f.then === 'head') this.shoot(f.recv, 'head');
      } else if (f.end === 'int') {
        const q = f.int; const d = hyp(q.x - f.to.x, q.y - f.to.y); if (d > 1.5) { q.x += (f.to.x - q.x) * 0.7; q.y += (f.to.y - q.y) * 0.7; }
        if (f.then === 'head') this.log(this.sec, 'clear', q.side, tp('Savunma uzaklaştırdı: {n}', { n: q.p.name }));
        this.takeBall(q);
      } else this.outOfPlay(f);
      return;
    }
    this.resolveShot(f);
  }
  outOfPlay(f) {
    const T = f.team, bx = f.to.x, by = f.to.y;
    if (bx <= 0 || bx >= W) {
      const defTeam = bx >= W ? 'a' : 'h';
      if (T === defTeam) { this.setDead('corner', OPP(T), { x: bx <= 0 ? 0.5 : W - 0.5, y: by < H / 2 ? 0.5 : H - 0.5 }, 3.5); this.log(this.sec, 'corner', OPP(T), tp('Korner: {team}', { team: this.sides[OPP(T)].name })); }
      else this.setDead('goalkick', defTeam, { x: bx <= 0 ? 5.5 : W - 5.5, y: H / 2 }, 2.5);
    } else this.setDead('throw', OPP(T), { x: clamp(bx, 3, W - 3), y: by < H / 2 ? 0.5 : H - 0.5 }, 1.6);
  }
  resolveShot(f) {
    const s = f.shooter, T = f.team, O = OPP(T), keeper = this.gk(O), name = s.p.name;
    const asst = f.shotKind !== 'pen' && this.passer && this.passer.q.side === T && this.passer.q !== s && this.sec - this.passer.t < 9 ? this.passer.q : null;
    if (f.res === 'goal') {
      this.score[T]++; this.stats[T].on++; s.st.g++; if (asst) asst.st.a++;
      this.log(this.sec, 'goal', T, `${GOAL_TAG} ${name} (${this.sides[T].name})${f.shotKind === 'pen' ? tp(' — penaltı') : f.shotKind === 'head' ? tp(' — kafa') : f.shotKind === 'free' ? tp(' — serbest vuruş') : ''}${asst ? tp(' · asist: {n}', { n: asst.p.name }) : ''}`, { who: name });
      this.setDead('goal', T, null, 6.5); this.dead.scorer = T; this.lastTeam = T; return;
    }
    if (f.res === 'save') {
      this.stats[T].on++; if (keeper) keeper.st.k++;
      this.log(this.sec, 'save', T, tp('Kurtarış! {shooter}’in şutunu {keeper} çıkardı', { shooter: name, keeper: keeper?.p.name || tp('kaleci') }), { who: name });
      if (this.r() < 0.55 && keeper) this.takeBall(keeper, 1.2);
      else if (this.r() < 0.38) { const cy = this.ball.y < H / 2 ? 0.5 : H - 0.5; this.setDead('corner', T, { x: FX(T, W - 0.5), y: cy }, 3.5); this.log(this.sec, 'corner', T, tp('Korner: {team}', { team: this.sides[T].name })); }
      else { const a = this.r() * 1.2 - 0.6; this.loose = { vx: (T === 'h' ? -1 : 1) * (5 + this.r() * 4), vy: a * 8, t: 0 }; }
      return;
    }
    if (f.res === 'block') {
      this.log(this.sec, 'block', T, tp('{n}’in şutu engellendi', { n: name }), { who: name });
      const u = this.r(), b = f.blocker;
      if (u < 0.4 && b) this.takeBall(b);
      else if (u < 0.7) { const cy = this.ball.y < H / 2 ? 0.5 : H - 0.5; this.setDead('corner', T, { x: FX(T, W - 0.5), y: cy }, 3.5); this.log(this.sec, 'corner', T, tp('Korner: {team}', { team: this.sides[T].name })); }
      else this.loose = { vx: (this.r() - 0.5) * 8, vy: (this.r() - 0.5) * 8, t: 0 };
      return;
    }
    this.log(this.sec, 'shot', T, tp('{n} şutu auta attı', { n: name }), { who: name });
    this.setDead('goalkick', O, { x: FX(O, 5.5), y: H / 2 }, 2.5);
  }
  chase(dt) {
    const L = this.loose; L.t += dt;
    const dec = Math.pow(0.35, dt); L.vx *= dec; L.vy *= dec;
    this.ball.x = clamp(this.ball.x + L.vx * dt, 0.6, W - 0.6); this.ball.y = clamp(this.ball.y + L.vy * dt, 0.6, H - 0.6);
    let best = null, bd = 1e9;
    for (const q of [...this.on('h'), ...this.on('a')]) { if (q.role === 'GK' && hyp(q.x - this.ball.x, q.y - this.ball.y) > 4) continue; const d = hyp(q.x - this.ball.x, q.y - this.ball.y) - 1.2 * q.sk + this.r() * 0.3; if (d < bd) { bd = d; best = q; } }
    if (best && (bd < 1.5 || L.t > 3.5)) this.takeBall(best);
  }

  // ---- hareket ----
  targets() {
    const o = this.owner, d = this.dead, fl = this.flight, B = this.ball;
    const poss = o ? o.side : d ? (d.type === 'goal' ? null : d.team) : fl ? fl.team : this.loose ? null : this.lastTeam;
    for (const side of ['h', 'a']) {
      const opp = OPP(side), tac = this.sides[side].tactics || {};
      const ment = ((tac.mentality ?? 50) - 50) / 50, press = ((tac.press ?? 50) - 50) / 50;
      const att = poss === side, def = poss && poss !== side;
      const bf = FX(side, B.x), bfy = FY(side, B.y);
      let lastDef = W / 2; for (const q of this.players[opp]) if (q.p && !q.off && q.role !== 'GK') lastDef = Math.max(lastDef, FX(side, q.x));
      const mates = this.on(side);
      let chasers = [];
      if (!d && (def || this.loose) && !(fl && fl.kind === 'shot')) {
        chasers = mates.filter(q => q.role !== 'GK').sort((a, b) => hyp(a.x - B.x, a.y - B.y) - hyp(b.x - B.x, b.y - B.y)).slice(0, this.loose ? 2 : press > 0.3 ? 3 : 2);
      }
      // duran top düzenleri
      let boxSpots = null;
      if (d && d.type === 'corner') {
        const pool = mates.filter(q => q !== d.taker && q.role !== 'GK');
        const order = d.team === side ? { A: 0, D: 1, M: 2 } : { D: 0, M: 1, A: 2 };
        pool.sort((a, b) => order[a.line] - order[b.line]);
        boxSpots = new Map(); const spots = d.team === side ? BOX_ATT : BOX_DEF;
        pool.slice(0, spots.length).forEach((q, i) => boxSpots.set(q, spots[i]));
      }
      for (const q of this.players[side]) {
        if (!q.p || q.off) continue;
        let tx, ty, sprint = 1;
        if (q.role === 'GK') {
          const prox = clamp(1 - bf / 45, 0, 1);
          tx = 3 + (att ? clamp(bf * 0.12, 0, 13) : 0); ty = H / 2 + (bfy - H / 2) * (0.1 + 0.4 * prox);
          if (fl && fl.kind === 'shot' && fl.team !== side) { tx = 2.2; ty = clamp(FY(side, fl.to.y), H / 2 - 5, H / 2 + 5); sprint = 1.6; }
          if (d && d.type === 'corner' && d.team !== side) { tx = 2.5; ty = H / 2; }
        } else {
          const k = FOLLOW[q.line];
          const push = att ? PUSH_ATT[q.line] + ment * 5 : def ? PUSH_DEF[q.line] + press * 5 : 0;
          tx = q.bfx + (bf - 50) * k + push;
          ty = H / 2 + (q.bfy + (bfy - H / 2) * 0.28 - H / 2) * (att ? 1.04 : 0.9);
          if (att && q.line === 'A') tx = Math.min(tx, lastDef + 0.5);
          tx = clamp(tx, MIN_FX[q.line], W - 3); ty = clamp(ty, 3, H - 3);
          if (d && d.type === 'kickoff') { tx = Math.min(tx, W / 2 - 2); }
          if (chasers.includes(q)) { tx = clamp(bf - 1.2, 2, W - 2); ty = bfy; sprint = 1.12; }
        }
        let wx = FX(side, tx), wy = FY(side, ty);
        if (boxSpots?.has(q)) { const s = boxSpots.get(q); wx = FX(side, s[0]); wy = FY(side, s[1]); sprint = 1.1; }
        if (d && d.taker === q && d.pt) { wx = d.pt.x; wy = d.pt.y; sprint = 1.2; }
        if (fl?.kind === 'pass') { if (q === fl.recv) { wx = fl.aim.x; wy = fl.aim.y; sprint = 1.15; } else if (q === fl.int) { wx = fl.to.x; wy = fl.to.y; sprint = 1.2; } }
        if (fl?.kind === 'shot' && q === fl.blocker) { wx = fl.to.x; wy = fl.to.y; sprint = 1.3; }
        if (q === o) {
          if (this.drib) { wx = this.drib.tx; wy = this.drib.ty; } else { wx = q.x + (side === 'h' ? 1 : -1) * 2; wy = q.y; }
          sprint = 0.85;
        }
        if (this.loose && chasers.includes(q)) { wx = B.x; wy = B.y; sprint = 1.2; }
        q.tx = clamp(wx, 0.5, W - 0.5); q.ty = clamp(wy, 0.5, H - 0.5); q.sp = sprint;
      }
    }
  }
  move(dt) {
    this.targets();
    const all = [];
    for (const side of ['h', 'a']) for (const q of this.players[side]) {
      if (!q.p || q.off) continue;
      const dx = q.tx - q.x, dy = q.ty - q.y, dist = hyp(dx, dy);
      const maxv = (q.role === 'GK' ? MAXV.G : MAXV[q.line]) * q.sp * (0.93 + 0.14 * q.sk);
      const want = Math.min(maxv, dist * 2.4), ux = dist > 1e-3 ? dx / dist : 0, uy = dist > 1e-3 ? dy / dist : 0;
      const a = Math.min(1, dt * 3.6);
      q.vx += (ux * want - q.vx) * a; q.vy += (uy * want - q.vy) * a;
      q.x = clamp(q.x + q.vx * dt, 0.5, W - 0.5); q.y = clamp(q.y + q.vy * dt, 0.5, H - 0.5);
      all.push(q);
    }
    if (!this.fast) for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
      if (d < 2.2 && d > 0.001) { const s = (2.2 - d) * 0.15 / d; a.x -= dx * s; a.y -= dy * s; b.x += dx * s; b.y += dy * s; }
    }
  }

  /** Çizim için anlık görüntü. */
  snapshot() {
    return { ball: this.ball, h: this.players.h, a: this.players.a, carrier: this.owner, recv: this.flight?.kind === 'pass' ? this.flight.recv : null, flight: this.flight, trail: this.trail, dead: this.dead };
  }
  /** Maç sonu özeti: golcüler ve maçın oyuncusu. */
  summary() {
    const all = [...this.players.h, ...this.players.a].filter(q => q.p);
    const score = q => q.st.g * 3 + q.st.a * 1.5 + q.st.s * 0.3 + q.st.k * 0.6;
    const best = all.slice().sort((a, b) => score(b) - score(a))[0];
    return { best: best && score(best) > 0 ? best : null };
  }
}
