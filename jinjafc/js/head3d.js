// Fotoğraftaki yüz noktalarından oyun tarzı 3D kafa önizlemesi (Three.js, sayfada global THREE).
// Bu, oyundaki sonucun birebir aynısı değil; ayarları yaptıktan sonra yüzünün kabaca nasıl duracağını gösterir.
import { TRIS } from "./canon.js";

export function headPreview(canvas, img, r) {
  const T = window.THREE;
  if (!T) return null;
  let gl;
  try { gl = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return null; }
  gl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  gl.outputEncoding = T.sRGBEncoding;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, 0.05, 5.4);

  // yüz ağı: noktalar yüz genişliğine göre ölçeklenir, merkez burun köprüsü
  const pts = r.raw.slice(0, 468), W = Math.hypot(pts[454].x - pts[234].x, pts[454].y - pts[234].y);
  const c = pts[168], s = 1.0 / W;
  const pos = new Float32Array(468 * 3), uv = new Float32Array(468 * 2);
  pts.forEach((p, i) => {
    pos[i * 3] = (p.x - c.x) * s;
    pos[i * 3 + 1] = -(p.y - c.y) * s;
    pos[i * 3 + 2] = -(p.z - c.z) * s;
    uv[i * 2] = p.x / r.w;
    uv[i * 2 + 1] = 1 - p.y / r.h;
  });
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.BufferAttribute(uv, 2));
  g.setIndex(TRIS.flat());
  g.computeVertexNormals();
  // doku: fotoğraf, oyun görünümü için biraz yumuşatılmış ve canlandırılmış
  const tc = document.createElement("canvas");
  const k = Math.min(1, 1024 / Math.max(r.w, r.h));
  tc.width = Math.round(r.w * k); tc.height = Math.round(r.h * k);
  const tx = tc.getContext("2d");
  tx.filter = "blur(0.6px) saturate(1.15) contrast(1.05)";
  tx.drawImage(img, 0, 0, tc.width, tc.height);
  const tex = new T.CanvasTexture(tc);
  tex.encoding = T.sRGBEncoding;
  const face = new T.Mesh(g, new T.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 }));

  // kafanın geri kalanı: ten renginde kafatası, saç rengi başlık, boyun
  const skin = new T.Color(r.skin.hex), hairCol = new T.Color(r.hair.bald ? r.skin.hex : r.hair.hex);
  g.computeBoundingBox();
  const bb = g.boundingBox, fw = bb.max.x - bb.min.x, fh = bb.max.y - bb.min.y;
  const head = new T.Group();
  const skinMat = new T.MeshStandardMaterial({ color: skin, roughness: 0.68 });
  // kafatası: yüzün kenarları kafatasının içine gömülecek kadar geniş ve derin
  const skull = new T.Mesh(new T.SphereGeometry(1, 56, 40), skinMat);
  skull.scale.set(fw * 0.56, fh * 0.64, fw * 0.66);
  skull.position.set(0, bb.max.y - fh * 0.42, bb.min.z - fw * 0.2);
  // saç: kafanın üstünü ve arkasını saran başlık (kel ise ten rengi, görünmez)
  const hair = new T.Mesh(new T.SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, Math.PI * 0.5), new T.MeshStandardMaterial({ color: hairCol, roughness: 0.95 }));
  hair.scale.set(fw * 0.585, fh * 0.66, fw * 0.69);
  hair.position.set(0, skull.position.y + fh * 0.02, skull.position.z - fw * 0.02);
  hair.rotation.x = -0.42;
  hair.visible = !r.hair.bald;
  // kulaklar: göz hizasında, yüz kenarının hemen arkasında
  const earY = -(r.raw[33].y - c.y) * s - fh * 0.06;
  const ears = [-1, 1].map((sd) => {
    const e = new T.Mesh(new T.SphereGeometry(1, 24, 16), skinMat);
    e.scale.set(fw * 0.07, fh * 0.15, fw * 0.11);
    e.position.set(sd * fw * 0.55, earY, skull.position.z + fw * 0.08);
    e.rotation.y = sd * 0.5;
    return e;
  });
  const neck = new T.Mesh(new T.CylinderGeometry(fw * 0.3, fw * 0.34, fh * 0.5, 40), skinMat);
  neck.position.set(0, bb.min.y - fh * 0.02, skull.position.z + fw * 0.08);
  const shirt = new T.Mesh(new T.CylinderGeometry(fw * 0.5, fw * 1.05, fh * 0.55, 48, 1, true), new T.MeshStandardMaterial({ color: 0x1f8a52, roughness: 0.8, side: T.DoubleSide }));
  shirt.position.set(0, bb.min.y - fh * 0.42, neck.position.z);
  head.add(skull, hair, ...ears, neck, shirt, face);
  head.position.y = 0.08;
  scene.add(head);

  scene.add(new T.HemisphereLight(0xdfe9ff, 0x2a2a35, 0.85));
  const key = new T.DirectionalLight(0xffffff, 1.05); key.position.set(1.5, 2, 3); scene.add(key);
  const rim = new T.DirectionalLight(0x7fe0a8, 0.6); rim.position.set(-2.5, 1, -2); scene.add(rim);

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
    front() { auto = false; tYaw = 0; pitch = 0; },
    spin() { auto = true; t0 = performance.now(); },
    snapshot() { gl.render(scene, cam); return canvas.toDataURL("image/png"); },
    stop() { cancelAnimationFrame(raf); gl.dispose(); },
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
