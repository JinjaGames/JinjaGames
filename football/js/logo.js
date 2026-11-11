// Jinja Football logosu: dört kanatlı bir shuriken (JinjaGames'in J-shuriken'inden), ortasında top.
// Kanatların bir kenarı düz, öbürü kıvrık: dönerken "fırlatılmış" görünür. Sayfa açılınca dönerek yerine oturur,
// üstüne gelince yeniden döner; gol olunca da bir tur atar (spinLogo).
// Aynı çizim favicon ve /assets/img/apps/football.svg için kullanılır (tools: logoSvg({animated:false})).

const C = 16;
const rot = ([x, y], k) => { const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [C + x * c - y * s, C + x * s + y * c]; };
const f = n => +n.toFixed(2);
const P = p => `${f(p[0])} ${f(p[1])}`;

/** Kanatlar: uç → (düz) → çentik → (kıvrık) → sonraki uç. */
function bladesPath() {
  const tip = [0, -15], notch = [5.2, -5.2], ctrl = [9.6, -1.2];
  let d = `M${P(rot(tip, 0))}`;
  for (let k = 0; k < 4; k++) d += `L${P(rot(notch, k))}Q${P(rot(ctrl, k))} ${P(rot(tip, k + 1))}`;
  return d + 'Z';
}

/** Klasik top: ortada beşgen, kenarlarda kesilmiş beşgenler, aralarında dikiş çizgileri. */
function ballMarkup(r, id) {
  const pent = (cx, cy, rr, a0) => Array.from({ length: 5 }, (_, i) => { const a = a0 + i * 2 * Math.PI / 5; return `${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`; }).join(' ');
  const up = -Math.PI / 2, pr = r * 0.36;
  let out = `<clipPath id="${id}c"><circle cx="${C}" cy="${C}" r="${r}"/></clipPath>`;
  out += `<circle cx="${C}" cy="${C}" r="${r}" fill="url(#${id}w)"/>`;
  out += `<g clip-path="url(#${id}c)" fill="#111a14" stroke="#111a14" stroke-width="${f(r * 0.09)}" stroke-linejoin="round">`;
  out += `<polygon points="${pent(C, C, pr, up)}"/>`;
  for (let i = 0; i < 5; i++) {
    const a = up + i * 2 * Math.PI / 5, vx = C + pr * Math.cos(a), vy = C + pr * Math.sin(a);
    const ox = C + r * 1.02 * Math.cos(a), oy = C + r * 1.02 * Math.sin(a);
    out += `<polygon points="${pent(ox, oy, pr * 0.95, a + Math.PI)}"/>`;
    out += `<path d="M${f(vx)} ${f(vy)}L${f(C + r * 0.66 * Math.cos(a))} ${f(C + r * 0.66 * Math.sin(a))}" fill="none"/>`;
  }
  out += '</g>';
  out += `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#111a14" stroke-width=".5" opacity=".5"/>`;
  return out;
}

let uid = 0;
export function logoSvg({ animated = true, tile = true } = {}) {
  const id = `jf${uid++}`;
  return `<svg class="jf-logo${animated ? ' anim' : ''}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecffa6"/><stop offset=".5" stop-color="#c2f53f"/><stop offset="1" stop-color="#6fbf1a"/></linearGradient><radialGradient id="${id}w" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#eef1ec"/><stop offset="1" stop-color="#bfc7be"/></radialGradient></defs>${tile ? '<rect class="tile" width="32" height="32" rx="9" fill="#0d1a12"/>' : ''}<g class="spin"><path d="${bladesPath()}" fill="url(#${id}b)"/><circle cx="${C}" cy="${C}" r="5.9" fill="#0d1a12"/><g class="ball">${ballMarkup(4.9, id)}</g></g></svg>`;
}

/** Logoyu bir kez döndür (gol, tıklama). */
export function spinLogo() {
  for (const el of document.querySelectorAll('.jf-logo.anim')) {
    el.classList.remove('kick'); void el.getBoundingClientRect(); el.classList.add('kick');
  }
}
