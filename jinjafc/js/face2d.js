// Canlı yüz önizlemesi: senin fotoğrafın, Sculpt kaydırıcılarına göre yüz noktalarından bükülür (WebGL).
// Başlangıç = fotoğraftaki kendi yüzün (önerilen değerler). Bir kaydırıcı önerilen değerden uzaklaştıkça
// ilgili bölge (çene, burun, gözler…) fotoğrafın üzerinde o yöne doğru şekil değiştirir.

// her kaydırıcı: çapa noktaları, hareket (x: dışa, y: yukarı, s: göz merkezine göre ölçek, z: dolgunluk), genlik (yüz genişliği oranı)
const DEF = {
  "Skull NW": { a: [234, 454, 127, 356, 162, 389, 21, 251, 54, 284], m: "x", amp: 0.07, sg: 0.2 },
  "Upper Forehead NW": { a: [54, 284, 103, 332, 67, 297, 109, 338], m: "x", amp: 0.05 },
  "Lower Forehead DU": { a: [10, 338, 109, 67, 297, 151, 108, 337], m: "y", amp: 0.07, sg: 0.16 },
  "Eyebrows DU": { a: [70, 63, 105, 66, 107, 300, 293, 334, 296, 336, 46, 276, 53, 283], m: "y", amp: 0.04, sg: 0.07 },
  "Eyes NW": { a: [33, 133, 159, 145, 160, 144, 158, 153, 263, 362, 386, 374, 387, 373, 385, 380], m: "x", amp: 0.035, sg: 0.08 },
  "Eyes DU": { a: [33, 133, 159, 145, 160, 144, 158, 153, 263, 362, 386, 374, 387, 373, 385, 380], m: "y", amp: 0.035, sg: 0.08 },
  "Eyes LS": { a: [33, 133, 159, 145, 160, 144, 158, 153, 263, 362, 386, 374, 387, 373, 385, 380], m: "s", amp: -0.4, sg: 0.07 },
  "Eye Corner Outer DU": { a: [33, 263, 130, 359], m: "y", amp: 0.025, sg: 0.05 },
  "Eyelid Fold Center DU": { a: [159, 386, 158, 385, 160, 387], m: "y", amp: 0.018, sg: 0.04 },
  "Nostril Outside Center NW": { a: [64, 294, 98, 327, 129, 358, 48, 278, 102, 331], m: "x", amp: 0.045, sg: 0.07 },
  "Nose DU": { a: [1, 2, 4, 5, 19, 94, 45, 275], m: "y", amp: 0.045, sg: 0.08 },
  "Cheeks NW": { a: [234, 454, 93, 323, 50, 280, 123, 352, 116, 345], m: "x", amp: 0.06, sg: 0.12 },
  "Lower Cheeks LM": { a: [205, 425, 206, 426, 207, 427, 187, 411], m: "x", amp: 0.035, sg: 0.1 },
  "Mouth NW": { a: [61, 291, 146, 375, 91, 321, 185, 409], m: "x", amp: 0.045, sg: 0.07 },
  "Mouth DU": { a: [0, 13, 14, 17, 61, 291, 37, 267, 84, 314, 39, 269, 181, 405], m: "y", amp: 0.035, sg: 0.08 },
  "Upper Lip Top Center DU": { a: [0, 37, 267, 39, 269], m: "y", amp: 0.02, sg: 0.04 },
  "Lower Lip Bottom Center DU": { a: [17, 84, 314, 181, 405], m: "y", amp: 0.022, sg: 0.045 },
  "Philtrum DU": { a: [164, 167, 393, 165, 391], m: "y", amp: 0.02, sg: 0.04 },
  "Chin NW": { a: [176, 148, 152, 377, 400, 149, 378], m: "x", amp: 0.05, sg: 0.09 },
  "Chin DU": { a: [152, 148, 377, 175, 199, 176, 400], m: "y", amp: 0.06, sg: 0.1 },
  "Chin RA": { a: [176, 400, 149, 378], m: "x", amp: 0.03, sg: 0.06 },
  "Jaw NW": { a: [172, 136, 397, 365, 58, 288, 150, 379, 132, 361], m: "x", amp: 0.07, sg: 0.12 },
};
const EYES = [[33, 133], [263, 362]];

// Bowyer–Watson Delaunay üçgenlemesi (birkaç yüz nokta için yeterince hızlı)
function delaunay(P) {
  const n = P.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of P) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const d = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const pts = P.concat([[mx - d, my - d], [mx + d, my - d], [mx, my + d]]);
  const circ = (a, b, c) => {
    const [ax, ay] = pts[a], [bx, by] = pts[b], [cx, cy] = pts[c];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
    return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
  };
  let tris = [[n, n + 1, n + 2, ...circ(n, n + 1, n + 2)]];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i], bad = [], keep = [];
    for (const t of tris) ((x - t[3]) ** 2 + (y - t[4]) ** 2 < t[5] ? bad : keep).push(t);
    const edges = new Map();
    for (const t of bad) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      const k = a < b ? a + "," + b : b + "," + a;
      edges.set(k, edges.has(k) ? null : [a, b]);
    }
    for (const e of edges.values()) if (e) keep.push([e[0], e[1], i, ...circ(e[0], e[1], i)]);
    tris = keep;
  }
  return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n).map((t) => [t[0], t[1], t[2]]);
}

const VS = `attribute vec2 p;attribute vec2 u;varying vec2 v;void main(){v=u;gl_Position=vec4(p,0.,1.);}`;
const FS = `precision mediump float;varying vec2 v;uniform sampler2D t;void main(){gl_FragColor=texture2D(t,v);}`;

export function facePreview(canvas, img, r) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;
  const L = r.raw.slice(0, 468);
  const xs = L.map((p) => p.x), ys = L.map((p) => p.y);
  const fx0 = Math.min(...xs), fx1 = Math.max(...xs), fy0 = Math.min(...ys), fy1 = Math.max(...ys);
  const FW = Math.hypot(L[454].x - L[234].x, L[454].y - L[234].y); // yüz genişliği (piksel)
  const cx = (fx0 + fx1) / 2, cy = (fy0 + fy1) / 2;
  const mid = L[168];

  // kaynak noktalar: yüz noktaları + yüzün çevresinde yumuşak geçiş halkaları + çerçeve (sabit)
  const src = L.map((p) => [p.x, p.y]);
  const rx = (fx1 - fx0) / 2, ry = (fy1 - fy0) / 2;
  for (const k of [1.18, 1.45, 1.9]) for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2;
    src.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
  }
  const ringEnd = src.length;
  const B = 3 * Math.max(rx, ry);
  const bx0 = cx - B, bx1 = cx + B, by0 = cy - B, by1 = cy + B;
  for (let i = 0; i <= 8; i++) { const f = i / 8; src.push([bx0 + (bx1 - bx0) * f, by0], [bx0 + (bx1 - bx0) * f, by1], [bx0, by0 + (by1 - by0) * f], [bx1, by0 + (by1 - by0) * f]); }
  const N = src.length;
  const tris = delaunay(src);

  // ağırlıklar: her kaydırıcı için noktaların çapalara uzaklığına göre yumuşak etki (çerçeve hep 0)
  const W8 = {};
  for (const [key, d] of Object.entries(DEF)) {
    const w = new Float32Array(N), s2 = (d.sg || 0.09) ** 2;
    for (let i = 0; i < ringEnd; i++) {
      let m = 0;
      for (const a of d.a) { const dx = (src[i][0] - L[a].x) / FW, dy = (src[i][1] - L[a].y) / FW; m = Math.max(m, Math.exp(-(dx * dx + dy * dy) / s2)); }
      w[i] = m;
    }
    W8[key] = w;
  }
  const eyeC = EYES.map(([a, b]) => [(L[a].x + L[b].x) / 2, (L[a].y + L[b].y) / 2]);

  // WebGL
  const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
  const idx = new Uint16Array(tris.flat());
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const uv = new Float32Array(N * 2);
  src.forEach(([x, y], i) => { uv[i * 2] = x / img.width; uv[i * 2 + 1] = y / img.height; });
  const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  const uLoc = gl.getAttribLocation(prog, "u"); gl.enableVertexAttribArray(uLoc); gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 0, 0);
  const pb = gl.createBuffer();
  const pLoc = gl.getAttribLocation(prog, "p");
  const dst = new Float32Array(N * 2), clip = new Float32Array(N * 2);

  const vals = {};
  let mix = 1, showOrig = false, anim = 0, raf = 0;
  function deform() {
    for (let i = 0; i < N; i++) { dst[i * 2] = src[i][0]; dst[i * 2 + 1] = src[i][1]; }
    for (const [key, [rec, cur]] of Object.entries(vals)) {
      const d = DEF[key];
      if (!d || cur === rec) continue;
      const t = ((cur - rec) / 50) * d.amp * 0.8, w = W8[key];
      for (let i = 0; i < ringEnd; i++) {
        const wi = w[i];
        if (wi < 0.005) continue;
        const [x, y] = src[i];
        if (d.m === "x") dst[i * 2] += Math.sign(x - mid.x || 1) * t * wi * FW;
        else if (d.m === "y") dst[i * 2 + 1] -= t * wi * FW;
        else if (d.m === "s") { const e = eyeC[x < mid.x ? 0 : 1]; dst[i * 2] += (x - e[0]) * t * wi; dst[i * 2 + 1] += (y - e[1]) * t * wi; }
      }
    }
  }
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.03, 0.07, 0.06, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    // görünüm: yüze yakın kırpma, kanvas oranında
    const vw = (fx1 - fx0) * 1.75, vh = vw * (h / w);
    const vx = cx - vw / 2, vy = cy - vh * 0.47;
    const k = showOrig ? 0 : mix;
    for (let i = 0; i < N; i++) {
      const x = src[i][0] + (dst[i * 2] - src[i][0]) * k, y = src[i][1] + (dst[i * 2 + 1] - src[i][1]) * k;
      clip[i * 2] = ((x - vx) / vw) * 2 - 1; clip[i * 2 + 1] = 1 - ((y - vy) / vh) * 2;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, clip, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pLoc); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
  }
  const ro = new ResizeObserver(draw); ro.observe(canvas);
  const loop = (now) => {
    if (!canvas.isConnected) return;
    mix = 0.5 - 0.5 * Math.cos(((now - anim) / 1400) * Math.PI); // önce/sonra arasında gidip gelir
    draw();
    raf = requestAnimationFrame(loop);
  };
  draw();
  return {
    /** kaydırıcıyı ayarla: key "Jaw NW" gibi; rec = önerilen (fotoğraftaki), cur = şu anki */
    set(key, rec, cur) { vals[key] = [rec, cur]; deform(); if (!raf) draw(); },
    has: (key) => !!DEF[key],
    /** ayarlı yüz */
    front() { cancelAnimationFrame(raf); raf = 0; showOrig = false; mix = 1; draw(); },
    /** fotoğraftaki hâli */
    side() { cancelAnimationFrame(raf); raf = 0; showOrig = true; draw(); },
    /** önce / sonra arasında yavaşça gidip gelir: farkı görmek için */
    spin() { cancelAnimationFrame(raf); showOrig = false; anim = performance.now(); raf = requestAnimationFrame(loop); },
    snapshot() { const o = showOrig, m = mix; showOrig = false; mix = 1; draw(); const u = canvas.toDataURL("image/png"); showOrig = o; mix = m; draw(); return u; },
    stop() { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); },
  };
}
