// 3B gökyüzü: yıldızlar, burç kuşağı, gezegenler ve (doğum haritasında) evler ile açılar.
// Sürükle: döndür · tekerlek ya da iki parmak: yakınlaştır · gezegene dokun: bilgi.
import { SIGNS, PLANETS } from "./zodiac.js?v=10";
import { signOf, degIn } from "./ephem.js?v=10";

const THREE = window.THREE;
const RING = 11, PL = 8.2;
const ASPECT_COLOR = { conj: 0xffd36e, sext: 0x6fd3ff, trine: 0x6fd3ff, square: 0xff6b7a, opp: 0xff6b7a };

function textSprite(text, color, size = 128, font = "600 92px 'Segoe UI Symbol','Noto Sans Symbols 2',sans-serif") {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  x.font = font;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.shadowColor = color;
  x.shadowBlur = 18;
  x.fillStyle = color;
  x.fillText(text, size / 2, size / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  return s;
}
function glowTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color + "aa");
  g.addColorStop(1, color + "00");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const at = (lon, r, y = 0) => new THREE.Vector3(Math.cos((lon * Math.PI) / 180) * r, y, -Math.sin((lon * Math.PI) / 180) * r);

export function createSky(canvas, { onPick } = {}) {
  if (!THREE) return null;
  let gl;
  try { gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return null; }
  gl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const world = new THREE.Group();
  scene.add(world);

  // yıldızlar
  const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 70 + Math.random() * 60, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * r, u * r, Math.sin(th) * s * r], i * 3);
    const tint = Math.random();
    col.set(tint < 0.15 ? [1, 0.8, 0.9] : tint < 0.3 ? [0.8, 0.85, 1] : [1, 1, 1], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(stars);

  // burç kuşağı: 12 renkli dilim + glifler + derece çizgileri
  const zodiac = new THREE.Group();
  SIGNS.forEach((s, i) => {
    const geo = new THREE.RingGeometry(RING - 1.1, RING + 0.9, 32, 1, (i * 30 * Math.PI) / 180, (30 * Math.PI) / 180);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(s.c), transparent: true, opacity: i % 2 ? 0.16 : 0.26, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    zodiac.add(m);
    const g = textSprite(s.g, s.c);
    g.position.copy(at(i * 30 + 15, RING - 0.1, 0.05));
    g.scale.set(1.7, 1.7, 1);
    zodiac.add(g);
  });
  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const a = at(d, RING + 0.9), b = at(d, RING + (d % 30 === 0 ? 1.9 : 1.35));
    ticks.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(ticks, 3));
  zodiac.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xc9b8ff, transparent: true, opacity: 0.45 })));
  const inner = new THREE.Mesh(new THREE.RingGeometry(RING - 1.16, RING - 1.1, 128), new THREE.MeshBasicMaterial({ color: 0xc9b8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  inner.rotation.x = -Math.PI / 2;
  zodiac.add(inner);
  world.add(zodiac);

  // Dünya
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), new THREE.MeshBasicMaterial({ color: 0x4a78ff }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("#6f9bff"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(2.4, 2.4, 1);
  world.add(earth, halo);

  const dyn = new THREE.Group(); // gezegenler, evler, açılar
  world.add(dyn);
  let planets = [];

  function clearDyn() {
    for (const o of [...dyn.children]) {
      dyn.remove(o);
      o.geometry?.dispose?.();
      o.material?.map?.dispose?.();
      o.material?.dispose?.();
    }
    planets = [];
  }
  /** pos: {body:{lon,retro}}, chart: houses ve aspects (isteğe bağlı) */
  function setPositions(pos, chart = null) {
    clearDyn();
    const bodies = Object.keys(pos);
    bodies.forEach((b, i) => {
      const P = PLANETS[b], p = pos[b];
      const y = ((i % 3) - 1) * 0.45;
      const v = at(p.lon, PL - (i % 2) * 0.9, y);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(P.c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(b === "sun" ? 3.2 : 2.2, b === "sun" ? 3.2 : 2.2, 1);
      glow.position.copy(v);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(b === "sun" ? 0.5 : b === "moon" ? 0.4 : 0.32, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.c) }));
      ball.position.copy(v);
      ball.userData = { body: b, lon: p.lon, retro: p.retro, house: p.house };
      const label = textSprite(P.g, P.c, 96, "700 64px 'Segoe UI Symbol','Noto Sans Symbols 2',sans-serif");
      label.position.copy(v).add(new THREE.Vector3(0, 0.95, 0));
      label.scale.set(1.15, 1.15, 1);
      const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v, at(p.lon, RING - 1.1)]), new THREE.LineBasicMaterial({ color: new THREE.Color(P.c), transparent: true, opacity: 0.35 }));
      dyn.add(glow, ball, label, stem);
      planets.push(ball);
    });
    if (chart?.houses) {
      const pts = [];
      for (let h = 1; h <= 12; h++) {
        const a = at(chart.houses.cusps[h], 1.4), b = at(chart.houses.cusps[h], RING - 1.15);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const n = textSprite(String(h), "#cfc6ff", 64, "600 34px Inter,sans-serif");
        n.position.copy(at(chart.houses.cusps[h] + 6, RING - 2.1, 0));
        n.scale.set(0.8, 0.8, 1);
        dyn.add(n);
      }
      const hg = new THREE.BufferGeometry();
      hg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const hl = new THREE.LineSegments(hg, new THREE.LineDashedMaterial({ color: 0xa79bff, transparent: true, opacity: 0.35, dashSize: 0.35, gapSize: 0.25 }));
      hl.computeLineDistances();
      dyn.add(hl);
      // Yükselen ve Tepe Noktası eksenleri
      for (const [lon, color, txt] of [[chart.houses.asc, 0xffd36e, "ASC"], [chart.houses.mc, 0xff8fc7, "MC"]]) {
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([at(lon + 180, RING + 0.9), at(lon, RING + 2.4)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
        const t = textSprite(txt, "#" + color.toString(16), 128, "800 40px Inter,sans-serif");
        t.position.copy(at(lon, RING + 3.1));
        t.scale.set(1.6, 1.6, 1);
        dyn.add(l, t);
      }
    }
    if (chart?.aspects) {
      // açılar: merkeze doğru hafif kavisli, parlayan ince tüpler; sıkı açılar daha belirgin
      chart.aspects.slice(0, 14).forEach((a, k) => {
        const A = planets.find((p) => p.userData.body === a.a), B = planets.find((p) => p.userData.body === a.b);
        if (!A || !B || a.type === "conj") return;
        const mid = A.position.clone().add(B.position).multiplyScalar(0.5);
        mid.multiplyScalar(0.55).add(new THREE.Vector3(0, a.type === "trine" || a.type === "sext" ? 0.9 : -0.6, 0));
        const curve = new THREE.QuadraticBezierCurve3(A.position.clone(), mid, B.position.clone());
        const strong = Math.max(0.35, 1 - a.orb / 8);
        const mat = new THREE.MeshBasicMaterial({ color: ASPECT_COLOR[a.type], transparent: true, opacity: 0.75 * strong, blending: THREE.AdditiveBlending, depthWrite: false });
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.035 + 0.03 * strong, 6), mat);
        tube.userData.pulse = { base: mat.opacity, ph: k * 0.7 };
        dyn.add(tube);
      });
    }
  }

  // kamera ve etkileşim
  let yaw = -0.6, pitch = 0.95, dist = 30, tYaw = yaw, tPitch = pitch, tDist = dist, drag = null, auto = true, idleT = 0;
  // yalnızca ana sayfadaki büyük gökyüzünde sahne yazının arkasından kaydırılır; diğer kutularda ortada durur
  const hero = !!canvas.closest(".hero");
  let lastW = 0, lastH = 0, sizeClass = "";
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    lastW = w; lastH = h;
    gl.setSize(w, h, false); // çizim tamponu kutunun gerçek boyutunda: bulanıklık olmaz
    cam.aspect = w / h;
    const cls = w < 640 ? "s" : w < 1000 ? "m" : "l";
    if (cls !== sizeClass) { sizeClass = cls; tDist = dist = cls === "s" ? 40 : cls === "m" ? 34 : 30; }
    if (hero && w >= 900) cam.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else if (hero) cam.setViewOffset(w, h, 0, h * 0.16, w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  resize();
  addEventListener("resize", resize);
  // kutu gizliyken oluşturulup sonradan açılırsa (harita sonucu gibi) boyutu yeniden ölç
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    ray.params.Mesh = {};
    const hit = ray.intersectObjects(planets)[0];
    return hit?.object || null;
  }
  canvas.addEventListener("pointerdown", (e) => {
    onPick?.(null); // önceki bilgi kutusunu kapat; dokunulan yer gezegense bırakınca yeniden açılır
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    auto = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) {
      canvas.style.cursor = pickAt(e) ? "pointer" : "grab";
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    tYaw -= dx * 0.006;
    tPitch = Math.max(0.12, Math.min(1.45, tPitch + dy * 0.005));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const up = (e) => {
    if (drag && drag.moved < 6) {
      const o = pickAt(e);
      onPick?.(o ? { ...o.userData, sign: signOf(o.userData.lon), deg: degIn(o.userData.lon), x: e.clientX, y: e.clientY } : null);
    }
    drag = null;
    idleT = performance.now();
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", () => (drag = null));
  canvas.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // sayfa kaydırmasını engellemesin; Ctrl + tekerlek ya da düğmeler
    e.preventDefault();
    tDist = Math.max(14, Math.min(60, tDist * (1 + e.deltaY * 0.0012)));
  }, { passive: false });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    if (!auto && !drag && performance.now() - idleT > 6000) auto = true;
    if (auto && !reduce) tYaw += 0.0016;
    yaw += (tYaw - yaw) * 0.08;
    pitch += (tPitch - pitch) * 0.08;
    dist += (tDist - dist) * 0.08;
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(0, 0, 0);
    stars.rotation.y = t * 0.000008;
    for (const o of dyn.children) if (o.userData.pulse) o.material.opacity = o.userData.pulse.base * (0.7 + 0.3 * Math.sin(t * 0.002 + o.userData.pulse.ph));
    gl.render(scene, cam);
  }
  requestAnimationFrame(frame);
  return {
    setPositions,
    zoom: (k) => (tDist = Math.max(14, Math.min(60, tDist * k))),
    reset: () => { tYaw = -0.6; tPitch = 0.95; auto = true; },
    top: () => { tPitch = 1.45; auto = false; idleT = performance.now(); },
    snapshot: () => canvas.toDataURL("image/png"),
  };
}
