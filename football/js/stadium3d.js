// Ana sayfa 3D sahnesi: gece maçında penaltı. Kaleye nişan al, tıkla/dokun; kaleci gerçekten uzanır.
// Ölçüler metredir (kale 7.32 × 2.44, penaltı noktası 11 m). Three.js depodan yüklenir (üçüncü taraf isteği yok);
// yüklenemezse (WebGL yok, eski tarayıcı) null döner ve sayfa statik zeminle çalışır.
import { t } from './i18n.js';

const THREE_URL = new URL('../vendor/three.module.min.js', import.meta.url).href;

const GW = 7.32, GH = 2.44, R = 0.17, SPOT = 11, DEPTH = 2.2, POST = 0.06;
const G = 9.81;
const KREACT = 0.16;            // kalecinin tepki süresi (sn)
const KBODY = 2.25;             // ayak → uzanmış eldiven ucu

export async function mountStadium(host, cb = {}) {
  let T;
  try { T = await import(/* @vite-ignore */ THREE_URL); } catch { return null; }
  const canvas = document.createElement('canvas');
  canvas.className = 'stadium-canvas';
  canvas.setAttribute('aria-label', t('Penaltı oyunu: kaleye nişan alıp tıkla'));
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch { return null; }
  if (!renderer.getContext()) return null;
  host.prepend(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new T.Scene();
  scene.background = new T.Color('#030705');
  scene.fog = new T.Fog('#030705', 45, 120);
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 300);
  const camBase = new T.Vector3(0, 1.7, SPOT + 6.2);
  const camLook = new T.Vector3(0, 1.25, 0);
  camera.position.copy(camBase);

  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };

  // ---------------------------------------------------------------- saha (yarı saha + kale arkası)
  const PW = 76, PZ0 = -9, PZ1 = 62; // çizilen zemin
  const pitchTex = canvasTex(2048, Math.round(2048 * (PZ1 - PZ0) / PW), (x, W, H) => {
    const px = X => (X + PW / 2) / PW * W, pz = Z => (Z - PZ0) / (PZ1 - PZ0) * H, m = W / PW;
    // biçilmiş çim şeritleri
    x.fillStyle = '#0b2316'; x.fillRect(0, 0, W, H);
    for (let z = 0; z < 60; z += 5.5) { x.fillStyle = (z / 5.5) % 2 ? '#1a6a3e' : '#175d36'; x.fillRect(px(-34), pz(z), 68 * m, 5.5 * m + 1); }
    x.fillStyle = '#145232'; x.fillRect(px(-34), pz(PZ0), 68 * m, pz(0) - pz(PZ0));
    // doku gürültüsü
    const img = x.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n * 0.5; d[i + 1] += n; d[i + 2] += n * 0.5; }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(255,255,255,.93)'; x.lineWidth = Math.max(3, 0.13 * m); x.lineCap = 'square';
    const rect = (x0, z0, x1, z1) => { x.strokeRect(px(x0), pz(z0), (x1 - x0) * m, (z1 - z0) * m); };
    x.beginPath(); x.moveTo(px(-34), pz(0)); x.lineTo(px(34), pz(0)); x.stroke();
    x.beginPath(); x.moveTo(px(-34), pz(0)); x.lineTo(px(-34), pz(60)); x.moveTo(px(34), pz(0)); x.lineTo(px(34), pz(60)); x.stroke();
    rect(-9.16, 0, 9.16, 5.5); rect(-20.16, 0, 20.16, 16.5);
    x.beginPath(); x.arc(px(0), pz(SPOT), 9.15 * m, Math.asin(5.5 / 9.15), Math.PI - Math.asin(5.5 / 9.15)); x.stroke();
    x.beginPath(); x.arc(px(0), pz(52.5), 9.15 * m, Math.PI, 2 * Math.PI); x.stroke();
    x.beginPath(); x.moveTo(px(-34), pz(52.5)); x.lineTo(px(34), pz(52.5)); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(px(0), pz(SPOT), 0.11 * m, 0, 7); x.fill();
    for (const s of [-1, 1]) { x.beginPath(); x.arc(px(s * 34), pz(0), 1 * m, s < 0 ? 0 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI); x.stroke(); }
  });
  pitchTex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 8;
  const pitch = new T.Mesh(new T.PlaneGeometry(PW, PZ1 - PZ0), new T.MeshStandardMaterial({ map: pitchTex, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.z = (PZ0 + PZ1) / 2; pitch.receiveShadow = true; scene.add(pitch);
  const apron = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshBasicMaterial({ color: '#06100a' })); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);

  // ---------------------------------------------------------------- ışık
  scene.add(new T.HemisphereLight('#cfe2ff', '#0d2a18', 0.55));
  const key = new T.DirectionalLight('#fff4dc', 2.1);
  key.position.set(-14, 26, 22); key.target.position.set(0, 0, 3);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 5, far: 70 }); key.shadow.bias = -0.0005;
  scene.add(key, key.target);
  const fill = new T.DirectionalLight('#bcd4ff', 0.6); fill.position.set(18, 20, 10); scene.add(fill);
  const beams = [];
  const glowTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(.25, 'rgba(255,240,200,.55)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  for (const [x, z] of [[-40, -16], [40, -16], [-44, 40], [44, 40]]) {
    const pole = new T.Mesh(new T.CylinderGeometry(0.35, 0.55, 34, 8), new T.MeshStandardMaterial({ color: '#141b18', roughness: 0.8 }));
    pole.position.set(x, 17, z); scene.add(pole);
    const head = new T.Mesh(new T.BoxGeometry(8, 4, 0.5), new T.MeshBasicMaterial({ color: '#fff7dd' }));
    head.position.set(x, 35, z); head.lookAt(0, 0, 10); scene.add(head);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: '#fff3d0', transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    glow.position.copy(head.position); glow.scale.set(26, 26, 1); scene.add(glow);
    const from = new T.Vector3(x, 34.5, z), to = new T.Vector3(x * 0.1, 0, 6), len = from.distanceTo(to);
    const g = new T.ConeGeometry(12, len, 32, 1, true); g.translate(0, -len / 2, 0); g.rotateX(-Math.PI / 2);
    const beam = new T.Mesh(g, new T.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.035, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.copy(from); beam.lookAt(to); scene.add(beam); beams.push(beam);
  }

  // ---------------------------------------------------------------- tribünler + seyirci
  const standMat = new T.MeshStandardMaterial({ color: '#0c1512', roughness: 0.9 });
  const crowdGeo = new T.BoxGeometry(0.46, 0.8, 0.34); crowdGeo.translate(0, 0.4, 0);
  const headGeo = new T.SphereGeometry(0.15, 8, 6);
  const shirts = ['#d62828', '#f2b705', '#f4f4f4', '#1f4fd6', '#18a558', '#7a2be2', '#e86a1c', '#0e1a2b', '#d62828', '#f2b705'].map(c => new T.Color(c));
  const seats = [];
  const tier = (n, rows, place) => { for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) if (Math.random() > 0.08) seats.push(place(r, i)); };
  tier(120, 10, (r, i) => ({ x: -47 + i * 0.79 + (r % 2) * 0.35, y: 1.1 + r * 0.72, z: -12 - r * 0.95, ry: 0 }));                    // kale arkası
  tier(84, 10, (r, i) => ({ x: -40 - r * 0.95, y: 1.1 + r * 0.72, z: -9 + i * 0.82 + (r % 2) * 0.35, ry: Math.PI / 2 }));             // sol
  tier(84, 10, (r, i) => ({ x: 40 + r * 0.95, y: 1.1 + r * 0.72, z: -9 + i * 0.82 + (r % 2) * 0.35, ry: -Math.PI / 2 }));             // sağ
  const crowd = new T.InstancedMesh(crowdGeo, new T.MeshBasicMaterial({ color: '#ffffff' }), seats.length);
  const heads = new T.InstancedMesh(headGeo, new T.MeshBasicMaterial({ color: '#ffffff' }), seats.length);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), eul = new T.Euler(), one = new T.Vector3(1, 1, 1), v3 = new T.Vector3();
  const skin = ['#f1c9a5', '#d9a77e', '#a8714a', '#6b4429', '#e8b894'].map(c => new T.Color(c));
  const phase = new Float32Array(seats.length);
  const placeFan = (i, jump) => {
    const s = seats[i]; eul.set(0, s.ry, 0); q.setFromEuler(eul);
    v3.set(s.x, s.y + jump, s.z); m4.compose(v3, q, one); crowd.setMatrixAt(i, m4);
    v3.set(s.x, s.y + jump + 0.98, s.z); m4.compose(v3, q, one); heads.setMatrixAt(i, m4);
  };
  seats.forEach((s, i) => {
    placeFan(i, 0); phase[i] = Math.random() * 6.28;
    crowd.setColorAt(i, shirts[(Math.random() * shirts.length) | 0].clone().multiplyScalar(0.16 + Math.random() * 0.16));
    heads.setColorAt(i, skin[(Math.random() * skin.length) | 0].clone().multiplyScalar(0.22));
  });
  scene.add(crowd, heads);
  for (let r = 0; r < 10; r++) {
    const b = new T.Mesh(new T.BoxGeometry(100, 0.72, 0.95), standMat); b.position.set(0, 0.74 + r * 0.72, -12.2 - r * 0.95); scene.add(b);
    for (const sx of [-1, 1]) { const s = new T.Mesh(new T.BoxGeometry(0.95, 0.72, 74), standMat); s.position.set(sx * (40.2 + r * 0.95), 0.74 + r * 0.72, 25); scene.add(s); }
  }
  const roofMat = new T.MeshStandardMaterial({ color: '#070c0a', roughness: 1, side: T.DoubleSide });
  const roof = new T.Mesh(new T.PlaneGeometry(104, 14), roofMat); roof.position.set(0, 13, -18); roof.rotation.x = Math.PI / 2 - 0.12; scene.add(roof);

  // ---------------------------------------------------------------- LED reklam panoları
  const ledTex = canvasTex(2048, 64, (x, W, H) => {
    x.fillStyle = '#05080a'; x.fillRect(0, 0, W, H);
    const items = [['JINJA FOOTBALL', '#c8ff5a'], ['JINJAGAMES.COM', '#ffffff'], [t('YA ŞÖYLE OLSAYDI?'), '#ffc933'], [t('GEÇMİŞİ DEĞİŞTİR'), '#6fd3ff']];
    x.font = '800 40px "Barlow Condensed", "Arial Narrow", sans-serif'; x.textBaseline = 'middle';
    let px = 20; for (let k = 0; px < W; k++) { const [txt, c] = items[k % items.length]; x.fillStyle = c; x.fillText(txt, px, H / 2 + 2); px += x.measureText(txt).width + 70; x.fillStyle = '#2a3a30'; x.fillRect(px - 42, 18, 6, 28); }
    for (let yy = 0; yy < H; yy += 3) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, yy, W, 1); }
  });
  ledTex.wrapS = T.RepeatWrapping;
  const boards = [];
  const board = (w, pos, ry) => {
    const t = ledTex.clone(); t.needsUpdate = true; t.wrapS = T.RepeatWrapping; t.repeat.set(w / 30, 1);
    const m = new T.Mesh(new T.PlaneGeometry(w, 0.9), new T.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.copy(pos); m.rotation.y = ry; scene.add(m); boards.push(t);
    const back = new T.Mesh(new T.BoxGeometry(w, 0.95, 0.12), new T.MeshStandardMaterial({ color: '#0a0f0d' })); back.position.copy(pos); back.rotation.y = ry; back.translateZ(-0.08); scene.add(back);
  };
  board(56, new T.Vector3(0, 0.45, -4.2), 0);
  board(56, new T.Vector3(-36.2, 0.45, 26), Math.PI / 2);
  board(56, new T.Vector3(36.2, 0.45, 26), -Math.PI / 2);

  // ---------------------------------------------------------------- kale ve file
  const goal = new T.Group(); scene.add(goal);
  const wood = new T.MeshStandardMaterial({ color: '#f7f7f3', roughness: 0.3, metalness: 0.05 });
  const cyl = (len, x, y, z, rz = 0, rx = 0) => { const m = new T.Mesh(new T.CylinderGeometry(POST, POST, len, 14), wood); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; goal.add(m); return m; };
  cyl(GH + POST, -GW / 2, (GH + POST) / 2, 0); cyl(GH + POST, GW / 2, (GH + POST) / 2, 0); cyl(GW + POST * 2, 0, GH, 0, Math.PI / 2);
  // arka çerçeve
  const backTop = 1.6;
  const frameMat = new T.MeshStandardMaterial({ color: '#c9ccc9', roughness: 0.5 });
  for (const s of [-1, 1]) {
    const len = Math.hypot(DEPTH, GH - backTop); const a = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, len, 6), frameMat);
    a.position.set(s * GW / 2, (GH + backTop) / 2, -DEPTH / 2); a.rotation.x = Math.atan2(DEPTH, GH - backTop); goal.add(a);
    const b = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, backTop, 6), frameMat); b.position.set(s * GW / 2, backTop / 2, -DEPTH); goal.add(b);
  }
  const netTex = canvasTex(64, 64, (x) => { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, 32); x.lineTo(32, 0); x.lineTo(64, 32); x.lineTo(32, 64); x.closePath(); x.stroke(); });
  netTex.wrapS = netTex.wrapT = T.RepeatWrapping;
  const netMat = (rx, ry) => { const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.62, side: T.DoubleSide, depthWrite: false, alphaTest: 0.05 }); };
  const CELL = 0.16;
  // arka file: eğimli yüzey, esnemesi için ızgara
  const NX = 44, NY = 16;
  const backGeo = new T.PlaneGeometry(GW, Math.hypot(DEPTH, GH - backTop) + backTop, NX, NY);
  const netBack = new T.Mesh(backGeo, netMat(GW / CELL, (GH + 0.6) / CELL)); goal.add(netBack);
  const nbPos = backGeo.attributes.position, nbRest = Float32Array.from(nbPos.array);
  // arka filenin dinlenme biçimi: alttan backTop'a dik, sonra üst direğe doğru eğimli
  const restShape = (u, v) => { // u: -GW/2..GW/2, v: 0..1 (alt→üst)
    const L1 = backTop, L2 = Math.hypot(DEPTH, GH - backTop), s = v * (L1 + L2);
    return s <= L1 ? [u, s, -DEPTH] : [u, backTop + (s - L1) / L2 * (GH - backTop), -DEPTH + (s - L1) / L2 * DEPTH];
  };
  const H0 = backGeo.parameters.height;
  for (let i = 0; i < nbPos.count; i++) { const u = nbRest[i * 3], v = (nbRest[i * 3 + 1] + H0 / 2) / H0; const [x, y, z] = restShape(u, v); nbRest[i * 3] = x; nbRest[i * 3 + 1] = y; nbRest[i * 3 + 2] = z; }
  nbPos.array.set(nbRest); nbPos.needsUpdate = true;
  for (const s of [-1, 1]) {
    const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(DEPTH, 0); sh.lineTo(DEPTH, backTop); sh.lineTo(0, GH); sh.closePath();
    const sg = new T.ShapeGeometry(sh); const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, sg.attributes.position.getX(i) / DEPTH, sg.attributes.position.getY(i) / GH);
    const side = new T.Mesh(sg, netMat(DEPTH / CELL, GH / CELL)); side.rotation.y = Math.PI / 2; side.position.set(s * GW / 2, 0, 0); goal.add(side);
  }
  const bulge = { x: 0, y: 0, a: 0, t: 0 };

  // ---------------------------------------------------------------- kaleci: eklemli, atletik gövde
  // Hiyerarşi: keeper (ayak noktası, dalışta bunun etrafında döner) → body (çömelme yüksekliği)
  //   → kalçalar (uyluk → diz → baldır → bot) + şort + upper (bel ekseni: gövde, omuzlar, baş, kollar → dirsek → eldiven)
  const jerseyTex = canvasTex(256, 256, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff9a2e'); g.addColorStop(1, '#f2731a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(160,50,0,.22)'; x.lineWidth = 5; for (let i = -H; i < W + H; i += 18) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); }
    x.fillStyle = '#16191d'; x.fillRect(W * 0.2, 0, W * 0.1, H); x.fillRect(W * 0.7, 0, W * 0.1, H);       // yan paneller
    x.fillStyle = '#c8ff5a'; x.fillRect(W * 0.2 - 3, 0, 3, H); x.fillRect(W * 0.8, 0, 3, H);              // ince fosforlu biyeler
    x.fillStyle = '#16191d'; x.fillRect(0, H - 10, W, 10);                                                 // yaka
  });
  const sleeveTex = canvasTex(64, 128, (x, W, H) => { x.fillStyle = '#f4801f'; x.fillRect(0, 0, W, H); x.fillStyle = '#16191d'; x.fillRect(W * 0.42, 0, W * 0.16, H); x.fillStyle = '#c8ff5a'; x.fillRect(0, H - 8, W, 8); });
  const kit = new T.MeshStandardMaterial({ map: jerseyTex, roughness: 0.62 });
  const sleeve = new T.MeshStandardMaterial({ map: sleeveTex, roughness: 0.62 });
  const kitDark = new T.MeshStandardMaterial({ color: '#16191d', roughness: 0.72 });
  const sock = new T.MeshStandardMaterial({ color: '#f4801f', roughness: 0.7 });
  const skinM = new T.MeshStandardMaterial({ color: '#c98f68', roughness: 0.62 });
  const hairM = new T.MeshStandardMaterial({ color: '#1d1410', roughness: 0.9 });
  const glove = new T.MeshStandardMaterial({ color: '#f3f5f0', roughness: 0.45 });
  const gloveAcc = new T.MeshStandardMaterial({ color: '#c8ff5a', roughness: 0.4, emissive: '#c8ff5a', emissiveIntensity: 0.18 });
  const bootM = new T.MeshStandardMaterial({ color: '#111316', roughness: 0.35, metalness: 0.1 });
  const numTex = canvasTex(128, 128, (x) => { x.clearRect(0, 0, 128, 128); x.fillStyle = '#16191d'; x.font = '800 96px "Barlow Condensed", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('1', 64, 70); });
  const keeper = new T.Group(); scene.add(keeper);
  const body = new T.Group(); keeper.add(body);
  const part = (geo, mat, x, y, z, parent = body) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const limb = (rTop, rBot, len, mat, parent) => part(new T.CylinderGeometry(rTop, rBot, len, 16, 1), mat, 0, -len / 2, 0, parent);
  const joint = (r, mat, parent, y = 0) => part(new T.SphereGeometry(r, 16, 12), mat, 0, y, 0, parent);
  const HIP_Y = 0.98, THIGH = 0.46, SHIN = 0.44;
  // bacaklar
  const legs = [-1, 1].map(s => {
    const hip = new T.Group(); hip.position.set(s * 0.115, HIP_Y, 0); hip.rotation.order = 'ZXY'; body.add(hip);
    joint(0.095, kitDark, hip);
    limb(0.098, 0.068, THIGH, skinM, hip);
    part(new T.CylinderGeometry(0.112, 0.118, 0.2, 16, 1), kitDark, s * 0.012, -0.08, 0, hip);                 // şort paçası
    part(new T.SphereGeometry(0.085, 14, 10), skinM, 0, -0.17, 0.02, hip).scale.set(1, 1.6, 1.05);           // quadriceps
    const knee = new T.Group(); knee.position.y = -THIGH; hip.add(knee);
    joint(0.066, sock, knee);
    limb(0.066, 0.046, SHIN, sock, knee);
    part(new T.SphereGeometry(0.06, 14, 10), sock, 0, -0.13, -0.025, knee).scale.set(1, 1.9, 1.05);          // baldır
    part(new T.CylinderGeometry(0.069, 0.067, 0.05, 16), kitDark, 0, -0.04, 0, knee);                       // çorap bandı
    const ankle = new T.Group(); ankle.position.y = -SHIN; knee.add(ankle);
    const boot = part(new T.CapsuleGeometry(0.048, 0.15, 6, 12), bootM, 0, -0.035, 0.06, ankle); boot.rotation.x = Math.PI / 2;
    part(new T.BoxGeometry(0.1, 0.014, 0.25), gloveAcc, 0, -0.08, 0.06, ankle);                               // taban
    return { hip, knee, s };
  });
  // şort
  const shorts = part(new T.CylinderGeometry(0.2, 0.215, 0.17, 20, 1), kitDark, 0, HIP_Y + 0.03, 0); shorts.scale.z = 0.78;
  part(new T.CylinderGeometry(0.2, 0.2, 0.02, 20), kitDark, 0, HIP_Y + 0.11, 0).scale.z = 0.78;
  // üst gövde (bel ekseni)
  const upper = new T.Group(); upper.position.y = HIP_Y + 0.08; body.add(upper);
  const prof = [[0.16, 0], [0.185, 0.08], [0.195, 0.2], [0.225, 0.33], [0.255, 0.43], [0.245, 0.49], [0.19, 0.54], [0.08, 0.565]].map(([r, y]) => new T.Vector2(r, y));
  const torso = part(new T.LatheGeometry(prof, 28), kit, 0, 0, 0, upper); torso.scale.z = 0.62;
  const num = part(new T.PlaneGeometry(0.17, 0.17), new T.MeshBasicMaterial({ map: numTex, transparent: true }), 0.065, 0.36, 0.152, upper); num.castShadow = false;
  const badge = part(new T.CircleGeometry(0.026, 20), gloveAcc, -0.075, 0.4, 0.15, upper); badge.castShadow = false;
  // boyun + baş
  limb(0.058, 0.064, 0.1, skinM, upper).position.set(0, 0.62, 0);
  const head = part(new T.SphereGeometry(0.112, 22, 16), skinM, 0, 0.75, 0.005, upper); head.scale.set(0.9, 1.1, 1);
  const hair = part(new T.SphereGeometry(0.118, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), hairM, 0, 0.775, -0.018, upper); hair.scale.set(0.93, 1.05, 1.02); hair.rotation.x = -0.35;
  const eyeM = new T.MeshStandardMaterial({ color: '#1a120e', roughness: 0.4 });
  for (const s of [-1, 1]) { part(new T.SphereGeometry(0.012, 8, 6), eyeM, s * 0.038, 0.765, 0.097, upper); const br = part(new T.BoxGeometry(0.035, 0.008, 0.01), hairM, s * 0.038, 0.788, 0.1, upper); br.rotation.z = s * 0.12; }
  for (const s of [-1, 1]) part(new T.SphereGeometry(0.022, 8, 6), skinM, s * 0.1, 0.745, 0, upper);
  part(new T.SphereGeometry(0.03, 10, 8), skinM, 0, 0.72, 0.105, upper).scale.set(0.8, 1, 0.7);              // burun
  // kollar
  const UARM = 0.29, FARM = 0.26;
  const arms = [-1, 1].map(s => {
    const sh = new T.Group(); sh.position.set(s * 0.255, 0.5, 0); sh.rotation.order = 'ZXY'; upper.add(sh);
    joint(0.088, kit, sh);
    limb(0.062, 0.05, UARM, sleeve, sh);
    part(new T.SphereGeometry(0.055, 12, 10), sleeve, 0, -0.1, 0, sh).scale.set(1, 1.7, 1);                  // pazı
    const el = new T.Group(); el.position.y = -UARM; sh.add(el);
    joint(0.05, sleeve, el);
    limb(0.05, 0.04, FARM, sleeve, el);
    const hand = new T.Group(); hand.position.y = -FARM; el.add(hand);
    part(new T.CylinderGeometry(0.052, 0.048, 0.05, 14), gloveAcc, 0, -0.01, 0, hand);                       // bilek bandı
    part(new T.SphereGeometry(0.075, 14, 10), glove, 0, -0.09, 0, hand).scale.set(1.08, 1.2, 0.55);          // avuç
    part(new T.CircleGeometry(0.045, 16), gloveAcc, 0, -0.09, -0.042, hand).rotation.y = Math.PI;              // elin sırtındaki fosforlu yama
    for (let k = 0; k < 4; k++) part(new T.CapsuleGeometry(0.019, 0.075, 4, 8), glove, (k - 1.5) * 0.036, -0.2, 0, hand);
    const th = part(new T.CapsuleGeometry(0.02, 0.06, 4, 8), glove, -s * 0.07, -0.095, 0.025, hand); th.rotation.z = -s * 0.7;
    return { sh, el, s };
  });
  const shadowTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const K = { x: 0, lean: 0, jump: 0, crouch: 0, state: 'idle', t: 0, dir: 0, tx: 0, ty: 0, reachAngle: 0, sx: 0 };

  // ---------------------------------------------------------------- top
  const ballGeo = (() => {
    const g = new T.IcosahedronGeometry(R, 3).toNonIndexed(), p = g.attributes.position;
    const ico = new T.IcosahedronGeometry(1, 0), ip = ico.attributes.position, centers = [];
    for (let i = 0; i < ip.count; i++) { const v = new T.Vector3().fromBufferAttribute(ip, i).normalize(); if (!centers.some(o => o.distanceTo(v) < 1e-3)) centers.push(v); }
    const col = new Float32Array(p.count * 3), v = new T.Vector3(), c = new T.Vector3();
    for (let f = 0; f < p.count; f += 3) {
      c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(p, f + k)); c.normalize();
      const dark = centers.some(o => o.angleTo(c) < 0.32);
      for (let k = 0; k < 3; k++) { const s = dark ? 0.05 : 0.96; col.set([s, s, s], (f + k) * 3); }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  })();
  const ball = new T.Mesh(ballGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.02 }));
  scene.add(ball);
  const shadow = new T.Mesh(new T.PlaneGeometry(R * 4, R * 4), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);
  // iz
  const TRAIL = 22, trailGeo = new T.BufferGeometry(), trailPos = new Float32Array(TRAIL * 3);
  trailGeo.setAttribute('position', new T.BufferAttribute(trailPos, 3));
  const trail = new T.Line(trailGeo, new T.LineBasicMaterial({ color: '#c8ff5a', transparent: true, opacity: 0.5 })); trail.frustumCulled = false; scene.add(trail);
  let trailN = 0;
  // nişangâh (kale ağzı düzleminde)
  const aim = new T.Group(); aim.visible = false; scene.add(aim);
  const ringMat = new T.MeshBasicMaterial({ color: '#c8ff5a', transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
  aim.add(new T.Mesh(new T.RingGeometry(0.2, 0.26, 40), ringMat));
  for (let i = 0; i < 4; i++) { const t = new T.Mesh(new T.PlaneGeometry(0.035, 0.14), ringMat); const a = i * Math.PI / 2; t.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0); t.rotation.z = a + Math.PI / 2; aim.add(t); }
  aim.add(new T.Mesh(new T.CircleGeometry(0.035, 16), ringMat));
  aim.renderOrder = 10;

  const B = { p: new T.Vector3(0, R, SPOT), v: new T.Vector3(), curl: 0, state: 'ready', t: 0, result: null, crossed: false, grow: 1 };
  let goals = 0, shots = 0, streak = 0, best = 0;
  try { best = +localStorage.getItem('wif.penBest') || 0; } catch { /* yok */ }

  // ---------------------------------------------------------------- konfeti
  const NC = 260, cGeo = new T.BufferGeometry(), cPos = new Float32Array(NC * 3), cCol = new Float32Array(NC * 3), cVel = new Float32Array(NC * 3);
  cGeo.setAttribute('position', new T.BufferAttribute(cPos, 3)); cGeo.setAttribute('color', new T.BufferAttribute(cCol, 3));
  const confetti = new T.Points(cGeo, new T.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false })); confetti.visible = false; confetti.frustumCulled = false; scene.add(confetti);
  let cLife = 0, cheer = 0;
  const burst = () => {
    const cols = ['#c8ff5a', '#ffc933', '#ffffff', '#ff7a6b', '#6fa8ff'].map(c => new T.Color(c));
    for (let i = 0; i < NC; i++) {
      cPos.set([(Math.random() - .5) * 9, 3 + Math.random() * 2, -1 - Math.random() * 3], i * 3);
      cVel.set([(Math.random() - .5) * 7, 3 + Math.random() * 6, 2 + Math.random() * 6], i * 3);
      const c = cols[i % cols.length]; cCol.set([c.r, c.g, c.b], i * 3);
    }
    cGeo.attributes.color.needsUpdate = true; confetti.visible = true; cLife = 3;
  };

  // ---------------------------------------------------------------- vuruş
  function kick(tx, ty) {
    if (B.state !== 'ready') return;
    const err = 0.12;
    tx += (Math.random() - 0.5) * err * 2; ty += (Math.random() - 0.5) * err * 2;
    const dist = Math.hypot(B.p.z, tx - B.p.x);
    const speed = 24 + Math.min(4, Math.abs(tx) * 0.5) + Math.random() * 2;
    const T0 = dist / speed;
    B.curl = (Math.random() - 0.5) * 1.6;                                   // hafif falso
    B.v.set((tx - B.p.x) / T0 - 0.5 * B.curl * T0, (ty - B.p.y + 0.5 * G * T0 * T0) / T0, -B.p.z / T0);
    B.state = 'flight'; B.t = 0; B.result = null; B.crossed = false; trailN = 0;
    shots++; cb.onShot?.(shots);
    // kaleci kararı: bazen doğru tarafa, bazen yanlış, bazen ortada kalır
    const r = Math.random(), side = Math.abs(tx) < 0.9 ? 0 : Math.sign(tx);
    K.dir = r < 0.5 ? side : r < 0.82 ? (side === 0 ? (Math.random() < .5 ? -1 : 1) : -side) : 0;
    K.tx = K.dir === side ? tx : K.dir * (1.8 + Math.random() * 1.6);
    K.ty = K.dir === side ? ty : 0.6 + Math.random() * 1.2;
    K.state = 'wait'; K.t = 0; aim.visible = false;
  }
  const reset = () => {
    B.p.set(0, R, SPOT); B.v.set(0, 0, 0); B.state = 'ready'; B.grow = 0; B.result = null; ball.scale.setScalar(0.01);
    if (K.state === 'wait' || K.state === 'dive' || K.state === 'down') { K.state = 'getup'; K.ga = pose.ang; } else if (K.state !== 'getup') K.state = 'recover';
    K.t = 0; trailN = 0; trailGeo.setDrawRange(0, 0);
  };

  // kalecinin pozu → gövde çizgisi (çarpışma ve çizim aynı veriden)
  const pose = { fx: 0, ang: 0, lift: 0 };
  function keeperPose(dt) {
    K.t += dt;
    if (K.state === 'idle' || K.state === 'recover') {
      const tgt = reduce ? 0 : Math.sin(time * 1.3) * 0.55;
      pose.fx += (tgt - pose.fx) * Math.min(1, dt * 3);
      pose.ang += (0 - pose.ang) * Math.min(1, dt * 5); pose.lift += (0 - pose.lift) * Math.min(1, dt * 6);
      K.crouch = 0.08 + Math.abs(Math.sin(time * 2.6)) * 0.04;
      if (K.state === 'recover' && K.t > 0.6) K.state = 'idle';
    } else if (K.state === 'wait') {
      K.crouch += (0.16 - K.crouch) * Math.min(1, dt * 10);
      if (K.t >= KREACT) { K.state = 'dive'; K.t = 0; K.sx = pose.fx; }
    } else if (K.state === 'dive') {
      const k = Math.min(1, K.t / 0.42), e = 1 - Math.pow(1 - k, 3);
      // hedef: eldiven ucu (tx, ty) noktasına gelsin
      const step = Math.max(-0.9, Math.min(0.9, K.tx * 0.25));
      const fxT = K.sx + step;
      const dx = K.tx - fxT, dy = Math.max(0.15, K.ty);
      const want = Math.atan2(dx, dy);                     // dikeyden sapma
      const ang = Math.max(-1.45, Math.min(1.45, want));
      const lift = K.dir === 0 ? Math.min(0.5, Math.max(0, K.ty - 1.9)) : Math.max(0, Math.min(0.55, (K.ty - 0.5) * 0.35));
      pose.fx = K.sx + (fxT - K.sx) * e; pose.ang = ang * e; pose.lift = lift * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.7));
      K.crouch = 0.16 * (1 - e);
      if (K.t > 0.75) { K.state = 'down'; K.t = 0; }
    } else if (K.state === 'down') {
      // yere iner, kısa bir an yatar, sonra kalkar (top hâlâ filedeyken bile)
      pose.lift += (0 - pose.lift) * Math.min(1, dt * 6);
      if (Math.abs(pose.ang) > 0.5) pose.ang += (Math.sign(pose.ang) * 1.45 - pose.ang) * Math.min(1, dt * 4);
      if (K.t > 0.55) { K.state = 'getup'; K.t = 0; K.ga = pose.ang; }
    } else if (K.state === 'getup') {
      const k = Math.min(1, K.t / 0.8), e = k * k * (3 - 2 * k);
      pose.ang = K.ga * (1 - e);
      K.crouch = 0.16 * Math.sin(e * Math.PI);
      if (k >= 1) { K.state = 'idle'; K.t = 0; }
    }
    // yatarken gövdenin yanı zeminin üstünde dursun (gövde yarı kalınlığı ~0.17 m)
    pose.lift = Math.max(pose.lift, 0.17 * Math.sin(Math.min(1.5, Math.abs(pose.ang))));
    const reachUp = K.state === 'dive' || K.state === 'down' ? 1 : 0;
    const lerp = (o, k, v, r) => { o[k] += (v - o[k]) * Math.min(1, dt * r); };
    keeper.position.set(pose.fx, pose.lift, 0.35);
    keeper.rotation.z = -pose.ang;
    // çömelme: uyluk öne, baldır geriye; ayak kalçanın altında kalır, gövde alçalır ve öne eğilir
    const bend = reachUp ? 0.05 : K.crouch * 3.6;
    body.position.y = -(THIGH + SHIN) * (1 - Math.cos(bend)) * 0.5;
    lerp(upper.rotation, 'x', reachUp ? 0 : K.crouch * 1.5, 10);
    legs.forEach(({ hip, knee, s }, i) => {
      const trail = reachUp && Math.sign(pose.ang || 1) === s ? 0 : reachUp ? 0.45 : 0;    // dalışta arka bacak hafif bükülür
      lerp(hip.rotation, 'z', reachUp ? s * 0.06 - pose.ang * 0.08 : s * (0.13 + K.crouch * 0.5), 12);
      lerp(hip.rotation, 'x', reachUp ? -trail * 0.5 : -bend, 12);
      lerp(knee.rotation, 'x', reachUp ? trail : bend * 1.9, 12);
    });
    arms.forEach(({ sh, el, s }) => {
      if (reachUp) {
        const lead = Math.sign(pose.ang || s) === s || Math.abs(pose.ang) < 0.25;          // dalış tarafındaki kol tam uzanır
        lerp(sh.rotation, 'z', s * (lead ? 2.95 : 2.55), 16); lerp(sh.rotation, 'x', 0, 16); lerp(el.rotation, 'x', lead ? 0 : -0.35, 16);
      } else {
        // hazır duruş: kollar yana-öne açık, eldivenler bel hizasında kameraya dönük
        lerp(sh.rotation, 'z', s * (0.42 + K.crouch * 0.9), 7); lerp(sh.rotation, 'x', -0.55, 7); lerp(el.rotation, 'x', -0.95 - K.crouch * 1.2, 7);
      }
    });
  }
  // gövde çizgisi (dünya): ayaktan eldiven ucuna
  const segA = new T.Vector2(), segB = new T.Vector2();
  function keeperSegment() {
    const fx = pose.fx, fy = pose.lift, a = pose.ang;
    const reach = (K.state === 'dive' || K.state === 'down') ? KBODY : 1.95;
    segA.set(fx, fy + 0.1); segB.set(fx + Math.sin(a) * reach, fy + Math.cos(a) * reach);
  }
  const distSeg = (px, py) => {
    const ax = segA.x, ay = segA.y, bx = segB.x - ax, by = segB.y - ay, l2 = bx * bx + by * by;
    const t = Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / l2));
    return Math.hypot(px - (ax + bx * t), py - (ay + by * t));
  };

  // ---------------------------------------------------------------- girdi
  const ray = new T.Raycaster(), ndc = new T.Vector2(), goalPlane = new T.Plane(new T.Vector3(0, 0, 1), 0), hitPt = new T.Vector3();
  const mouse = { x: 0, y: 0 };
  const aimAt = ev => {
    const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(goalPlane, hitPt)) return null;
    return { x: Math.max(-GW * 1.2, Math.min(GW * 1.2, hitPt.x)), y: Math.max(R, Math.min(GH * 2, hitPt.y)) };
  };
  const free = ev => !ev.target.closest('a,button,input,select,label,textarea,.hero-box,.suggest,.chips-row,.stage-ui h1,.stage-ui p,.stage-hud');
  const onMove = ev => {
    const r = host.getBoundingClientRect(); mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1; mouse.y = ((ev.clientY - r.top) / r.height) * 2 - 1;
    if (ev.pointerType === 'touch' || !free(ev) || B.state !== 'ready') { aim.visible = false; host.classList.remove('aiming'); return; }
    const a = aimAt(ev);
    if (a) { aim.visible = true; aim.position.set(a.x, a.y, 0.08); const inside = Math.abs(a.x) < GW / 2 && a.y < GH; ringMat.color.set(inside ? '#c8ff5a' : '#ff7a6b'); host.classList.add('aiming'); }
    else { aim.visible = false; host.classList.remove('aiming'); }
  };
  const onDown = ev => {
    if (ev.button > 0 || !free(ev)) return;
    const a = aimAt(ev); if (!a) return;
    kick(a.x, a.y);
  };
  host.addEventListener('pointermove', onMove); host.addEventListener('pointerdown', onDown);
  const onLeave = () => { aim.visible = false; host.classList.remove('aiming'); };
  host.addEventListener('pointerleave', onLeave);

  // ---------------------------------------------------------------- boyut: geniş ekranda kale sağ yarıda dursun (başlıkla çakışmasın)
  let shiftX = 0;
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // yatay görüş en az ~36°: dar/dikey ekranda kale sığsın
    const hHalf = Math.tan((36 / 2) * Math.PI / 180);
    camera.fov = Math.max(38, 2 * Math.atan(hHalf / aspect) * 180 / Math.PI);
    // geniş ekran: kale sağa (sol yarıda başlık var). Telefonda içerik sahnenin altında durur, kale ortada kalır.
    shiftX = w >= 900 ? -w * 0.2 : 0;
    const shiftY = w < 900 ? -h * 0.06 : 0;
    if (shiftX || shiftY) camera.setViewOffset(w, h, shiftX, shiftY, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit); ro.observe(canvas); fit();
  let visible = true; const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }); io.observe(host);
  let raf = 0, last = performance.now(), dead = false, time = 0;

  const announce = (kind) => {
    const p = new T.Vector3(0, GH + 0.9, 0).project(camera);
    const x = canvas.offsetLeft + (p.x + 1) / 2 * canvas.clientWidth, y = canvas.offsetTop + (1 - p.y) / 2 * canvas.clientHeight;
    cb.onCall?.(kind, { x, y, w: canvas.clientWidth });
  };

  function step(dt) {
    time += dt;
    // ---- top
    if (B.state === 'flight' || B.state === 'after') {
      B.t += dt;
      B.v.y -= G * dt;
      if (B.state === 'flight') B.v.x += B.curl * dt;
      B.v.multiplyScalar(1 - 0.02 * dt);
      const prev = B.p.clone(); B.p.addScaledVector(B.v, dt);
      if (B.p.y < R) { B.p.y = R; if (Math.abs(B.v.y) > 1) B.v.y *= -0.5; else B.v.y = 0; B.v.x *= 1 - 2 * dt; B.v.z *= 1 - 2 * dt; }
      // kaleci teması (kale çizgisine yaklaşırken)
      if (B.state === 'flight' && !B.result && B.p.z < 1.4 && B.p.z > -0.2) {
        keeperSegment();
        if (distSeg(B.p.x, B.p.y) < R + 0.22) {
          B.result = 'save'; streak = 0;
          const away = Math.sign(B.p.x - pose.fx) || 1;
          B.v.set(away * (3 + Math.random() * 4), 2.5 + Math.random() * 3, 5 + Math.random() * 4);
          B.p.z = Math.max(B.p.z, 0.6); B.state = 'after'; B.t = 0; cb.onSave?.(); announce('save');
        }
      }
      // kale çizgisi
      if (B.state === 'flight' && !B.crossed && prev.z > 0 && B.p.z <= 0) {
        B.crossed = true;
        const ax = Math.abs(B.p.x);
        const postHit = Math.abs(ax - GW / 2) < R + POST && B.p.y < GH + R;
        const barHit = Math.abs(B.p.y - GH) < R + POST && ax < GW / 2 + R;
        if (postHit || barHit) {
          if (barHit) { B.v.y = -Math.abs(B.v.y) * 0.4 - 1; } B.v.z = Math.abs(B.v.z) * 0.5; B.v.x *= postHit ? -0.6 : 0.6; B.p.z = 0.3;
          B.result = 'wood'; streak = 0; B.state = 'after'; B.t = 0; cb.onWood?.(); announce('wood');
        } else if (ax < GW / 2 - R * 0.5 && B.p.y < GH - R * 0.5) {
          B.result = 'goal'; goals++; streak++; if (streak > best) { best = streak; try { localStorage.setItem('wif.penBest', String(best)); } catch { /* yok */ } }
          cb.onGoal?.(goals, streak, best); burst(); cheer = 2.6; B.state = 'after'; B.t = 0; announce('goal');
        } else { B.result = 'miss'; streak = 0; B.state = 'after'; B.t = 0; cb.onMiss?.(); announce('miss'); }
      }
      // file: gol olduysa top filede durur, file esner
      if (B.result === 'goal') {
        const L = -DEPTH + R + 0.05;
        if (B.p.z < L * (B.p.y < backTop ? 1 : 1 - (B.p.y - backTop) / (GH - backTop))) {
          if (bulge.a === 0) { bulge.x = B.p.x; bulge.y = B.p.y; bulge.a = Math.min(0.75, B.v.length() * 0.035); bulge.t = 0; }
          B.p.z = Math.min(B.p.z, L + 0.02); B.v.z = Math.abs(B.v.z) * 0.08; B.v.x *= 0.3;
        }
        if (Math.abs(B.p.x) > GW / 2 - R) { B.p.x = Math.sign(B.p.x) * (GW / 2 - R); B.v.x *= -0.3; }
        if (B.p.y > GH - R) { B.p.y = GH - R; B.v.y = -Math.abs(B.v.y) * 0.3; }
      }
      const out = B.p.z > 30 || Math.abs(B.p.x) > 34 || B.p.z < -4;
      if (out) { B.v.multiplyScalar(0.5); }
      if (B.state === 'flight' && B.t > 2.5) { B.state = 'after'; B.t = 0; if (!B.result) { B.result = 'miss'; streak = 0; cb.onMiss?.(); announce('miss'); } }
      if (B.state === 'after' && B.t > (B.result === 'goal' ? 2.4 : 1.8)) { B.state = 'reset'; B.t = 0; }
      // iz
      if (B.state === 'flight' || B.t < 0.25) {
        if (trailN < TRAIL) trailN++; trailPos.copyWithin(3, 0, (TRAIL - 1) * 3); trailPos.set([B.p.x, B.p.y, B.p.z], 0);
        trailGeo.attributes.position.needsUpdate = true; trailGeo.setDrawRange(0, trailN);
      } else if (trailN > 0) { trailN = Math.max(0, trailN - 2); trailGeo.setDrawRange(0, trailN); }
    } else if (B.state === 'reset') {
      B.t += dt; ball.scale.setScalar(Math.max(0.01, 1 - B.t * 4));
      if (B.t > 0.45) reset();
    }
    if (B.state === 'ready' && B.grow < 1) { B.grow = Math.min(1, B.grow + dt * 4); const k = 1 - Math.pow(1 - B.grow, 3); ball.scale.setScalar(Math.max(0.01, k)); }
    ball.position.copy(B.p);
    ball.rotation.x -= (B.v.z * dt) / R; ball.rotation.z += (B.v.x * dt) / R; ball.rotation.y += B.curl * dt * 3;
    shadow.position.set(B.p.x, 0.012, B.p.z); const hh = Math.max(0, B.p.y - R); shadow.scale.setScalar(1 + hh * 0.5); shadow.material.opacity = Math.max(0.15, 0.9 - hh * 0.25);
    shadow.visible = B.state !== 'reset';

    keeperPose(dt);

    // ---- file esnemesi
    if (bulge.a > 0) {
      bulge.t += dt; const amp = bulge.a * Math.exp(-bulge.t * 3.2) * Math.cos(bulge.t * 11);
      const arr = nbPos.array;
      for (let i = 0; i < nbPos.count; i++) {
        const x = nbRest[i * 3], y = nbRest[i * 3 + 1];
        const d2 = ((x - bulge.x) ** 2) / 1.1 + ((y - bulge.y) ** 2) / 0.7;
        arr[i * 3 + 2] = nbRest[i * 3 + 2] - amp * Math.exp(-d2);
      }
      nbPos.needsUpdate = true;
      if (bulge.t > 2) { bulge.a = 0; arr.set(nbRest); nbPos.needsUpdate = true; }
    }
    // ---- konfeti
    if (cLife > 0) {
      cLife -= dt;
      for (let i = 0; i < NC; i++) {
        cVel[i * 3 + 1] -= 6 * dt; cVel[i * 3] *= 1 - dt * 0.8; cVel[i * 3 + 2] *= 1 - dt * 0.8;
        cPos[i * 3] += cVel[i * 3] * dt; cPos[i * 3 + 1] += cVel[i * 3 + 1] * dt; cPos[i * 3 + 2] += cVel[i * 3 + 2] * dt;
        if (cPos[i * 3 + 1] < 0.03) { cPos[i * 3 + 1] = 0.03; cVel[i * 3] = cVel[i * 3 + 1] = cVel[i * 3 + 2] = 0; }
      }
      cGeo.attributes.position.needsUpdate = true; if (cLife <= 0) confetti.visible = false;
    }
    // ---- tribün coşkusu
    if (cheer > 0 && !reduce) {
      cheer -= dt; const k = Math.min(1, cheer / 0.6);
      for (let i = 0; i < seats.length; i += 1) placeFan(i, Math.max(0, Math.sin(time * 11 + phase[i])) * 0.35 * k);
      crowd.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
      if (cheer <= 0) { for (let i = 0; i < seats.length; i++) placeFan(i, 0); crowd.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; }
    }
    // ---- LED panolar
    for (const t of boards) t.offset.x = (t.offset.x + dt * (cheer > 0 ? 0.25 : 0.04)) % 1;
    // ---- kamera
    const flying = B.state === 'flight' || B.state === 'after';
    const fx = flying ? Math.max(-2, Math.min(2, B.p.x * 0.25)) : 0;
    const sway = reduce ? 0 : 1;
    camera.position.x += ((camBase.x + mouse.x * 0.6 * sway + Math.sin(time * 0.3) * 0.15 * sway) - camera.position.x) * Math.min(1, dt * 2);
    camera.position.y += ((camBase.y - mouse.y * 0.18 * sway) - camera.position.y) * Math.min(1, dt * 2);
    camera.position.z += ((camBase.z - (flying ? 1.2 : 0)) - camera.position.z) * Math.min(1, dt * 1.5);
    camLook.x += (fx - camLook.x) * Math.min(1, dt * 3);
    camera.lookAt(camLook);
    beams.forEach((b, i) => { b.material.opacity = 0.03 + Math.sin(time * 0.8 + i) * 0.006; });
    if (aim.visible) aim.scale.setScalar(1 + Math.sin(time * 6) * 0.05);
  }
  function loop(now) {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    if (!host.isConnected) { api.destroy(); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    step(dt); renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);

  const api = {
    renderer,
    reset() { goals = 0; shots = 0; streak = 0; cb.onShot?.(0); cb.onGoal?.(0, 0, best, true); },
    best: () => best,
    destroy() {
      if (dead) return; dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerdown', onDown); host.removeEventListener('pointerleave', onLeave);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
      renderer.dispose(); canvas.remove();
    },
    stats: () => ({ goals, shots, streak, best }),
  };
  return api;
}
