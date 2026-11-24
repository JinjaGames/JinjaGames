// Fotoğraftaki yüz noktalarından 3D kafa; Sculpt kaydırıcıları oynatıldıkça ilgili bölge canlı olarak şekil değiştirir.
// Başlangıç = fotoğraftaki kendi yüzün (önerilen değerler). Bir kaydırıcı önerilen değerden uzaklaştıkça yüz o yönde değişir.
// Oyundaki yüzün birebir aynısı değildir; ayarların yüzü nasıl etkilediğini görmeni sağlar.
import { TRIS } from "./canon.js";

// her kaydırıcı: hangi yüz noktaları (çapa), nasıl hareket (x: dışa, y: yukarı, z: öne, s: göz merkezine göre ölçek), genlik
const DEF = {
  "Skull NW": { a: [234, 454, 127, 356, 162, 389, 21, 251, 54, 284], m: "x", amp: 0.07, head: "x" },
  "Upper Forehead NW": { a: [54, 284, 103, 332, 67, 297, 109, 338], m: "x", amp: 0.05 },
  "Lower Forehead DU": { a: [10, 338, 109, 67, 297, 151, 108, 337], m: "y", amp: 0.07, head: "y" },
  "Eyebrows DU": { a: [70, 63, 105, 66, 107, 300, 293, 334, 296, 336, 46, 276, 53, 283], m: "y", amp: 0.035 },
  "Eyes NW": { a: [33, 133, 159, 145, 160, 144, 158, 153, 263, 362, 386, 374, 387, 373, 385, 380], m: "x", amp: 0.035 },
  "Eyes DU": { a: [33, 133, 159, 145, 160, 144, 158, 153, 263, 362, 386, 374, 387, 373, 385, 380], m: "y", amp: 0.035 },
  "Eyes LS": { a: [33, 133, 159, 145, 160, 144, 158, 153, 263, 362, 386, 374, 387, 373, 385, 380], m: "s", amp: -0.35 },
  "Eye Corner Outer DU": { a: [33, 263, 130, 359], m: "y", amp: 0.022 },
  "Eyelid Fold Center DU": { a: [159, 386, 158, 385, 160, 387], m: "y", amp: 0.015 },
  "Nostril Outside Center NW": { a: [64, 294, 98, 327, 129, 358, 48, 278, 102, 331], m: "x", amp: 0.04 },
  "Nose DU": { a: [1, 2, 4, 5, 19, 94, 45, 275], m: "y", amp: 0.045 },
  "Cheeks NW": { a: [234, 454, 93, 323, 50, 280, 123, 352, 116, 345], m: "x", amp: 0.06 },
  "Lower Cheeks LM": { a: [205, 425, 206, 426, 207, 427, 187, 411], m: "z", amp: 0.05 },
  "Mouth NW": { a: [61, 291, 146, 375, 91, 321, 185, 409], m: "x", amp: 0.04 },
  "Mouth DU": { a: [0, 13, 14, 17, 61, 291, 37, 267, 84, 314, 39, 269, 181, 405], m: "y", amp: 0.035 },
  "Upper Lip Top Center DU": { a: [0, 37, 267, 39, 269], m: "y", amp: 0.018 },
  "Lower Lip Bottom Center DU": { a: [17, 84, 314, 181, 405], m: "y", amp: 0.02 },
  "Philtrum DU": { a: [164, 167, 393, 165, 391], m: "y", amp: 0.02 },
  "Chin NW": { a: [176, 148, 152, 377, 400, 149, 378], m: "x", amp: 0.045 },
  "Chin DU": { a: [152, 148, 377, 175, 199, 176, 400], m: "y", amp: 0.06 },
  "Chin RA": { a: [176, 400, 149, 378], m: "x", amp: 0.025 },
  "Jaw NW": { a: [172, 136, 397, 365, 58, 288, 150, 379, 132, 361], m: "x", amp: 0.065 },
};
const LS_CENTERS = [[33, 133], [263, 362]];

export function headPreview(canvas, img, r) {
  const T = window.THREE;
  if (!T) return null;
  let gl;
  try { gl = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return null; }
  gl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  gl.outputEncoding = T.sRGBEncoding;
  gl.toneMapping = T.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(28, 1, 0.1, 100);
  cam.position.set(0, 0.02, 6);

  // yüz ağı: noktalar yüz genişliğine göre ölçeklenir, merkez burun köprüsü
  const pts = r.raw.slice(0, 468), W = Math.hypot(pts[454].x - pts[234].x, pts[454].y - pts[234].y);
  const c = pts[168], s = 1.0 / W;
  const base = new Float32Array(468 * 3), uv = new Float32Array(468 * 2);
  pts.forEach((p, i) => {
    base[i * 3] = (p.x - c.x) * s; base[i * 3 + 1] = -(p.y - c.y) * s; base[i * 3 + 2] = -(p.z - c.z) * s;
    uv[i * 2] = p.x / r.w; uv[i * 2 + 1] = 1 - p.y / r.h;
  });
  const pos = new Float32Array(base);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.BufferAttribute(uv, 2));
  g.setIndex(TRIS.flat());
  g.computeVertexNormals();
  // her kaydırıcı için noktaların etki ağırlıkları (çapalara uzaklığa göre yumuşak geçiş)
  const sig2 = 0.09 * 0.09;
  const W8 = {};
  for (const [k, d] of Object.entries(DEF)) {
    const w = new Float32Array(468);
    for (let i = 0; i < 468; i++) {
      let m = 0;
      for (const a of d.a) { const dx = base[i * 3] - base[a * 3], dy = base[i * 3 + 1] - base[a * 3 + 1], dz = base[i * 3 + 2] - base[a * 3 + 2]; m = Math.max(m, Math.exp(-(dx * dx + dy * dy + dz * dz) / sig2)); }
      w[i] = m;
    }
    W8[k] = w;
  }
  const eyeC = LS_CENTERS.map(([a, b]) => [(base[a * 3] + base[b * 3]) / 2, (base[a * 3 + 1] + base[b * 3 + 1]) / 2]);

  // doku: fotoğraf, oyun görünümü için hafif yumuşatılmış
  const tc = document.createElement("canvas");
  const k = Math.min(1, 1024 / Math.max(r.w, r.h));
  tc.width = Math.round(r.w * k); tc.height = Math.round(r.h * k);
  const tx = tc.getContext("2d");
  tx.filter = "blur(0.5px) saturate(1.1) contrast(1.04)";
  tx.drawImage(img, 0, 0, tc.width, tc.height);
  const tex = new T.CanvasTexture(tc);
  tex.encoding = T.sRGBEncoding;
  const face = new T.Mesh(g, new T.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));

  // kafanın geri kalanı
  // renkler sRGB → doğrusal: aksi hâlde ten ve saç olduğundan çok açık görünür
  const skin = new T.Color(r.skin.hex).convertSRGBToLinear(), hairCol = new T.Color(r.hair.bald ? r.skin.hex : r.hair.hex).convertSRGBToLinear();
  g.computeBoundingBox();
  const bb = g.boundingBox, fw = bb.max.x - bb.min.x, fh = bb.max.y - bb.min.y;
  const skinMat = new T.MeshStandardMaterial({ color: skin, roughness: 0.6, metalness: 0 });
  const head = new T.Group(), skullG = new T.Group();
  // kafatası: yüzün kenarları içine gömülecek kadar öne alınmış; yüz önde çizilir (polygonOffset)
  const skull = new T.Mesh(new T.SphereGeometry(1, 64, 48), skinMat);
  skull.scale.set(fw * 0.55, fh * 0.62, fw * 0.62);
  skull.position.set(0, bb.max.y - fh * 0.43, bb.min.z - fw * 0.24);
  const hair = new T.Mesh(new T.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.52), new T.MeshStandardMaterial({ color: hairCol, roughness: 0.92 }));
  hair.scale.set(fw * 0.575, fh * 0.645, fw * 0.645);
  hair.position.set(0, skull.position.y + fh * 0.03, skull.position.z - fw * 0.03);
  hair.rotation.x = -0.5;
  hair.visible = !r.hair.bald;
  // alt yüz hacmi: yandan bakınca yüz ile kafatası arasındaki boşluğu doldurur (çene-kulak arası)
  const jawFill = new T.Mesh(new T.SphereGeometry(1, 48, 32), skinMat);
  jawFill.scale.set(fw * 0.47, fh * 0.36, fw * 0.5);
  jawFill.position.set(0, bb.min.y + fh * 0.36, bb.min.z - fw * 0.1);
  skullG.add(skull, jawFill, hair);
  // kulak: kenarı kıvrık halka + iç çukur (sadece top değil)
  const earY = -(r.raw[33].y - c.y) * s - fh * 0.07;
  const ears = [-1, 1].map((sd) => {
    const e = new T.Group();
    const rim = new T.Mesh(new T.TorusGeometry(1, 0.32, 16, 32, Math.PI * 1.55), skinMat);
    rim.rotation.z = sd < 0 ? Math.PI * 0.62 : Math.PI * 0.83;
    const bowl = new T.Mesh(new T.SphereGeometry(0.95, 24, 16), skinMat);
    bowl.scale.set(1, 1, 0.35);
    const lobe = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), skinMat);
    lobe.position.set(0, -1.05, 0.05);
    e.add(rim, bowl, lobe);
    e.scale.set(fw * 0.055, fh * 0.085, fw * 0.06);
    e.position.set(sd * fw * 0.53, earY, skull.position.z + fw * 0.12);
    e.rotation.y = sd * 1.15;
    return e;
  });
  skullG.add(...ears);
  const neck = new T.Mesh(new T.CylinderGeometry(fw * 0.29, fw * 0.33, fh * 0.55, 48), skinMat);
  neck.position.set(0, bb.min.y - fh * 0.04, skull.position.z + fw * 0.06);
  const shirt = new T.Mesh(new T.CylinderGeometry(fw * 0.48, fw * 1.05, fh * 0.55, 56, 1, true), new T.MeshStandardMaterial({ color: 0x1f8a52, roughness: 0.85, side: T.DoubleSide }));
  shirt.position.set(0, bb.min.y - fh * 0.45, neck.position.z);
  const collar = new T.Mesh(new T.TorusGeometry(fw * 0.4, fw * 0.045, 12, 48), new T.MeshStandardMaterial({ color: 0xeaf7ef, roughness: 0.8 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, bb.min.y - fh * 0.19, neck.position.z);
  head.add(skullG, neck, shirt, collar, face);
  head.position.y = 0.08;
  scene.add(head);

  // stüdyo ışığı
  scene.add(new T.HemisphereLight(0xe8f0ff, 0x1a1f24, 0.7));
  const key = new T.DirectionalLight(0xfff3e6, 1.25); key.position.set(1.6, 1.8, 3); scene.add(key);
  const fill = new T.DirectionalLight(0xbfd8ff, 0.45); fill.position.set(-2.2, 0.4, 2); scene.add(fill);
  const rim = new T.DirectionalLight(0x7fe0a8, 0.9); rim.position.set(-1.8, 1.4, -2.5); scene.add(rim);

  // kaydırıcı değerleri: { anahtar: [önerilen, şu anki] }
  const vals = {};
  function apply() {
    pos.set(base);
    let sx = 1, sy = 1;
    for (const [key, [rec, cur]] of Object.entries(vals)) {
      const d = DEF[key];
      if (!d) continue;
      const t = ((cur - rec) / 50) * d.amp, w = W8[key];
      if (!t) continue;
      for (let i = 0; i < 468; i++) {
        const wi = w[i];
        if (wi < 0.01) continue;
        const j = i * 3;
        if (d.m === "x") pos[j] += Math.sign(base[j] || 1e-6) * t * wi;
        else if (d.m === "y") pos[j + 1] += t * wi;
        else if (d.m === "z") pos[j + 2] += t * wi;
        else if (d.m === "s") { const e = eyeC[base[j] < 0 ? 0 : 1]; pos[j] += (base[j] - e[0]) * t * wi; pos[j + 1] += (base[j + 1] - e[1]) * t * wi; }
      }
      if (d.head === "x") sx += t * 0.9;
      if (d.head === "y") sy += t * 0.6;
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    skullG.scale.set(sx, sy, 1);
  }

  let yaw = 0.35, tYaw = 0.35, pitch = 0, drag = null, auto = true, t0 = performance.now();
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: tYaw, pitch }; auto = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; tYaw = drag.yaw + (e.clientX - drag.x) * 0.01; pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.005, -0.4, 0.4); });
  const end = () => { drag = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    gl.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  size();
  new ResizeObserver(size).observe(canvas);
  let raf = 0;
  const frame = (now) => {
    if (!canvas.isConnected) return gl.dispose();
    if (auto) tYaw = Math.sin((now - t0) / 1800) * 0.6;
    yaw += (tYaw - yaw) * 0.12;
    head.rotation.set(pitch, yaw, 0);
    gl.render(scene, cam);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    /** kaydırıcıyı ayarla: key "Jaw NW" gibi; rec = önerilen, cur = şu anki */
    set(key, rec, cur) { vals[key] = [rec, cur]; apply(); },
    has: (key) => !!DEF[key],
    front() { auto = false; tYaw = 0; pitch = 0; },
    side() { auto = false; tYaw = 1.2; pitch = 0; },
    spin() { auto = true; t0 = performance.now(); },
    snapshot() { gl.render(scene, cam); return canvas.toDataURL("image/png"); },
    stop() { cancelAnimationFrame(raf); gl.dispose(); },
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
