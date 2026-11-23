// JinjaFC yüz aracı: fotoğraftaki yüzü ölçer, FC 27 Sculpt ayarlarına çevirir. Her şey bu cihazda olur;
// fotoğraf hiçbir yere gönderilmez, hiçbir yere kaydedilmez. Sayfa kapanınca her şey silinir.
import { FilesetResolver, FaceLandmarker } from "../vendor/mediapipe/vision_bundle.js";
import { CANON } from "./canon.js";
import { S, LAYER_TR, REGION_TR } from "./sculpt.js";

let landmarker = null;
export async function loadModel(onStep) {
  if (landmarker) return landmarker;
  onStep?.("Yüz modeli yükleniyor (ilk seferde birkaç saniye sürer)…");
  const fs = await FilesetResolver.forVisionTasks("/jinjafc/vendor/mediapipe/wasm");
  landmarker = await FaceLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: "/jinjafc/vendor/mediapipe/face_landmarker.task", delegate: "CPU" },
    runningMode: "IMAGE", numFaces: 2, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
  });
  return landmarker;
}

// --- yardımcılar ---
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round5 = (v) => Math.round(v / 5) * 5;

/** Görüntü koordinatlarına çevir, göz hattına göre düzle (kafa yana yatıksa). */
function frontalize(lm, w, h) {
  const p = lm.map((q) => ({ x: q.x * w, y: q.y * h, z: q.z * w }));
  const L = p[263], R = p[33];
  const ang = Math.atan2(L.y - R.y, L.x - R.x);
  const c = mid(p[234], p[454]), cs = Math.cos(-ang), sn = Math.sin(-ang);
  return { pts: p.map((q) => ({ x: c.x + (q.x - c.x) * cs - (q.y - c.y) * sn, y: c.y + (q.x - c.x) * sn + (q.y - c.y) * cs, z: q.z })), roll: (ang * 180) / Math.PI };
}
// Kanonik (ortalama) yüz: ekseni görüntüye benzet (y aşağı)
const CAN = CANON.map(([x, y, z]) => ({ x, y: -y, z }));

/** Bir yüz için oranlar: genişlikler yanak genişliğine, yükseklikler yüz yüksekliğine göre */
function measures(p) {
  const W = dist(p[234], p[454]), H = dist(p[10], p[152]);
  const eyeR = mid(p[33], p[133]), eyeL = mid(p[362], p[263]), eyes = mid(eyeR, eyeL);
  const browR = p[105], browL = p[334];
  const jawAngle = (a, g, c) => { // gonion açısı: yanak kenarı → çene köşesi → çene ucu
    const v1 = { x: a.x - g.x, y: a.y - g.y }, v2 = { x: c.x - g.x, y: c.y - g.y };
    return (Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y))) * 180) / Math.PI;
  };
  return {
    faceRatio: H / W,
    templeW: dist(p[54], p[284]) / W,
    foreheadW: dist(p[67], p[297]) / W,
    foreheadH: (mid(browR, browL).y - p[10].y) / H,
    jawW: dist(p[172], p[397]) / W,
    jawAng: (jawAngle(p[234], p[172], p[152]) + jawAngle(p[454], p[397], p[152])) / 2,
    chinW: dist(p[176], p[400]) / W,
    chinH: (p[152].y - p[17].y) / H,
    lowerCheekW: dist(p[58], p[288]) / W,
    eyeGap: dist(p[133], p[362]) / W,
    eyeW: (dist(p[33], p[133]) + dist(p[362], p[263])) / 2 / W,
    eyeOpen: (dist(p[159], p[145]) / dist(p[33], p[133]) + dist(p[386], p[374]) / dist(p[362], p[263])) / 2,
    eyeY: (eyes.y - p[10].y) / H,
    eyeTilt: ((p[133].y - p[33].y) + (p[362].y - p[263].y)) / 2 / W, // pozitif: dış köşe yukarıda
    browGap: ((p[159].y - browR.y) + (p[386].y - browL.y)) / 2 / H,
    noseW: dist(p[64], p[294]) / W,
    noseL: (p[2].y - p[168].y) / H,
    mouthW: dist(p[61], p[291]) / W,
    mouthY: (p[13].y - p[2].y) / (p[152].y - p[2].y),
    upperLip: (p[13].y - p[0].y) / H,
    lowerLip: (p[17].y - p[14].y) / H,
    philtrum: (p[0].y - p[2].y) / H,
  };
}
const BASE = measures(CAN); // kanonik yüz (yalnızca referans)

// Ölçüden kaydırıcıya: oran ortalamadan %k sapınca değer gain*k kadar kayar
// [katman, bölge, alt bölge, kaydırıcı türü, ölçü, yön(+1 / -1), kazanç, açıklama]
// Ölçüden kaydırıcıya: değer = başlangıç + katsayı × sapma (sapma = ortalamadan kaç standart sapma uzakta).
// Başlangıç ve katsayılar, FC 27 yüz videolarında (Haaland, LeBron James, Neymar, Pessi) oyundaki bitmiş yüzlerin
// ölçüleriyle içerik üreticisinin seçtiği gerçek değerler karşılaştırılarak ayarlandı. Örneğin üreticiler kaşları
// neredeyse hep 0-20 arasında tutuyor; çene keskinliğini Jaw değil Chin › Round/Angular ile veriyor; burun genişliğini
// Flesh › Nostril Outside Center ile ayarlıyor.
// [katman, bölge, alt bölge, kaydırıcı türü, ölçü, başlangıç, katsayı, açıklama]
const RULES = [
  ["Skeletal", "Head", "Skull", "NW", "templeW", 30, 20, "Şakak hizasında kafa genişliği"],
  ["Skeletal", "Forehead", "Upper Forehead", "NW", "foreheadW", 40, 15, "Alnın üst kısmının genişliği"],
  ["Skeletal", "Forehead", "Lower Forehead", "DU", "foreheadH", 50, 8, "Alın yüksekliği (kaşlarla saç çizgisi arası)"],
  ["Skeletal", "Brow Ridge", "Eyebrows", "DU", "browGap", 15, 10, "Kaşların gözden yüksekliği"],
  ["Skeletal", "Eyes", "Eyes", "NW", "eyeGap", 45, 22, "İki göz arası mesafe"],
  ["Skeletal", "Eyes", "Eyes", "DU", "eyeY", 60, -8, "Gözlerin yüzdeki yüksekliği"],
  ["Skeletal", "Eyes", "Eyes", "LS", "eyeW", 55, -12, "Göz büyüklüğü (küçük göz = Smaller tarafı)"],
  ["Flesh", "Eyes", "Eye Corner Outer", "DU", "eyeTilt", 50, 12, "Göz dış köşesinin eğimi"],
  ["Flesh", "Eyes", "Eyelid Fold Center", "DU", "eyeOpen", 55, 10, "Gözün açıklığı (üst kapak)"],
  ["Flesh", "Nose", "Nostril Outside Center", "NW", "noseW", 60, 18, "Burun kanatlarının genişliği"],
  ["Skeletal", "Nose", "Nose", "DU", "noseL", 50, -12, "Burun uzunluğu"],
  ["Skeletal", "Cheeks", "Cheeks", "NW", "faceRatio", 45, -22, "Elmacık kemiği genişliği (yüzün eni/boyu)"],
  ["Fat", "Cheeks", "Lower Cheeks", "LM", "lowerCheekW", 55, 15, "Alt yanak dolgunluğu"],
  ["Skeletal", "Mouth", "Mouth", "NW", "mouthW", 55, 12, "Ağız genişliği"],
  ["Skeletal", "Mouth", "Mouth", "DU", "mouthY", 35, -10, "Ağzın burun ile çene arasındaki yeri"],
  ["Flesh", "Mouth", "Upper Lip Top Center", "DU", "upperLip", 20, 10, "Üst dudak kalınlığı"],
  ["Flesh", "Mouth", "Lower Lip Bottom Center", "DU", "lowerLip", 70, -10, "Alt dudak kalınlığı"],
  ["Flesh", "Mouth", "Philtrum", "DU", "philtrum", 70, -10, "Burun ile üst dudak arası mesafe"],
  ["Skeletal", "Chin", "Chin", "NW", "chinW", 40, 20, "Çene ucunun genişliği"],
  ["Skeletal", "Chin", "Chin", "DU", "chinH", 45, -10, "Çene ucunun uzunluğu"],
  ["Skeletal", "Chin", "Chin", "RA", "jawAng", 70, -20, "Çene hattının keskinliği (keskin çene = Angular)"],
  ["Skeletal", "Jaw", "Jaw", "NW", "jawW", 30, 15, "Çene hattının genişliği"],
];

// Kalibrasyon: aynı ölçüler, gerçek olmayan (yapay zekâ ile üretilmiş) 24 önden yüz fotoğrafında ölçüldü.
// [ortalama, standart sapma]. Gülümseyen yüzler ağız genişliğini şişirdiği için ağız ortalaması biraz düşürüldü.
const CALIB = {
  faceRatio: [1.1894, 0.051], templeW: [0.8423, 0.0235], foreheadW: [0.4964, 0.0173], foreheadH: [0.1799, 0.0106], jawW: [0.8015, 0.0181],
  jawAng: [135.72, 2.77], chinW: [0.3245, 0.0102], chinH: [0.2015, 0.0201], lowerCheekW: [0.8936, 0.0158], eyeGap: [0.2407, 0.01],
  eyeW: [0.1963, 0.0072], eyeOpen: [0.2915, 0.0291], eyeY: [0.3136, 0.0125], eyeTilt: [0.016, 0.0057], browGap: [0.0999, 0.0128],
  noseW: [0.2861, 0.013], noseL: [0.2944, 0.0093], mouthW: [0.41, 0.03], mouthY: [0.31, 0.035], upperLip: [0.04, 0.007],
  lowerLip: [0.07, 0.008], philtrum: [0.08, 0.0143],
};
/** Ortalamadan kaç standart sapma uzakta (uç değerler ±2,5'te kesilir) */
export const zOf = (m, key) => clamp((m[key] - CALIB[key][0]) / CALIB[key][1], -2.5, 2.5);
// bir standart sapma ≈ 18 puan; kazanç, ölçünün o kaydırıcıyı ne kadar güçlü etkilediğini ayarlar
function sliderValue(m, rule) {
  const [, , , , key, start, k] = rule;
  return clamp(round5(start + k * zOf(m, key)), 0, 100);
}

// --- renk örnekleme ---
function sample(ctx, pts, r) {
  const out = [];
  for (const p of pts) {
    const d = ctx.getImageData(Math.max(0, p.x - r), Math.max(0, p.y - r), r * 2, r * 2).data;
    for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
  }
  const med = (k) => out.map((c) => c[k]).sort((a, b) => a - b)[out.length >> 1];
  return [med(0), med(1), med(2)];
}
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
function lab([r, g, b]) {
  const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
function hsv([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
}
function skinInfo(c) {
  const [L, , b] = lab(c);
  const step = clamp(Math.round((78 - L) / 5.5) + 1, 1, 10);
  const name = step <= 2 ? "Çok açık" : step <= 4 ? "Açık" : step <= 6 ? "Buğday" : step <= 8 ? "Esmer" : "Koyu";
  return { hex: hex(c), step, name, under: b > 18 ? "sıcak (sarı/altın)" : b < 11 ? "soğuk (pembe)" : "nötr" };
}
// göz rengi: renk doygunluğu (Lab kroma) ve yönüne göre; düşük doygunluklu açık irisler gri/mavi-gri olur
export const EYE_NAMES = ["Koyu kahverengi", "Kahverengi", "Ela", "Yeşil", "Mavi", "Gri / mavi-gri"];
function eyeInfo(c) {
  const [L, a, b] = lab(c), chroma = Math.hypot(a, b), hue = (Math.atan2(b, a) * 180) / Math.PI;
  let name;
  if (L < 24) name = "Koyu kahverengi";
  else if (b < -2) name = "Mavi";
  else if (a < -2) name = "Yeşil";
  else if (chroma < 12) name = L > 36 ? "Gri / mavi-gri" : "Koyu kahverengi";
  else if (hue > 68 && L > 40) name = "Ela";
  else name = L < 32 ? "Koyu kahverengi" : "Kahverengi";
  return { hex: hex(c), name, guess: name };
}
/** İrisin halka kısmı: gözbebeği ve üst kapak gölgesi hariç, en parlak %40 piksel */
function irisColor(ctx, p) {
  const all = [];
  for (const [ci, e1, e2] of [[468, 469, 471], [473, 474, 476]]) {
    const R = dist(p[e1], p[e2]) / 2, cx = p[ci].x, cy = p[ci].y, S = Math.max(2, Math.round(2 * R));
    const d = ctx.getImageData(Math.round(cx - R), Math.round(cy - R), S, S).data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const dx = i - R, dy = j - R, rr = Math.hypot(dx, dy) / R;
      if (rr > 0.3 && rr < 0.75 && dy > -R * 0.3) { const k = (j * S + i) * 4; all.push([d[k], d[k + 1], d[k + 2]]); }
    }
  }
  all.sort((u, v) => v[0] + v[1] + v[2] - (u[0] + u[1] + u[2]));
  const top = all.slice(0, Math.max(1, Math.floor(all.length * 0.4)));
  return [0, 1, 2].map((k) => Math.round(top.reduce((s, q) => s + q[k], 0) / top.length));
}
/** Alnın üstünden yukarı doğru tarar; tenden belirgin farklı renge geçilen ilk yer saçtır */
function hairColor(ctx, p, skinC, W, r) {
  const H = dist(p[10], p[152]), sk = lab(skinC), top = p[10];
  const found = [];
  for (let k = 1; k <= 18 && found.length < 4; k++) {
    const y = top.y - H * 0.03 * k;
    if (y < r) break;
    const c = sample(ctx, [{ x: top.x, y }, { x: top.x - W * 0.12, y: y + H * 0.02 }, { x: top.x + W * 0.12, y: y + H * 0.02 }], r);
    const L = lab(c);
    const diff = Math.hypot(L[0] - sk[0], L[1] - sk[1], L[2] - sk[2]);
    if (diff > 10) found.push({ k, c });
    else if (found.length) break; // tekrar tene döndüyse dur
  }
  // saç alnın çok üstünde başlıyorsa büyük ihtimalle arka plandır
  if (!found.length || found[0].k > 11) return null;
  return [0, 1, 2].map((i) => Math.round(found.reduce((s, f) => s + f.c[i], 0) / found.length));
}
export const HAIR_NAMES = ["Siyah", "Koyu kahverengi", "Kahverengi / kumral", "Sarı", "Kızıl", "Gri / beyaz", "Saç yok / çok kısa"];
function hairInfo(c, skin) {
  const [L, a, b] = lab(c), [Ls, as, bs] = lab(skin);
  if (Math.hypot(L - Ls, a - as, b - bs) < 12) return { hex: hex(c), name: "Saç görünmüyor (kel ya da çok kısa saç olabilir)", bald: true };
  const [h, s] = hsv(c);
  const name = L < 22 ? "Siyah" : L < 36 ? "Koyu kahverengi" : L < 52 ? (s > 0.45 && (h < 25 || h > 340) ? "Kızıl" : "Kahverengi / kumral") : s < 0.18 ? "Gri / beyaz" : h < 30 && s > 0.5 ? "Kızıl" : "Sarı";
  return { hex: hex(c), name, guess: name };
}

/** Görüntüyü analiz et. img: HTMLImageElement / ImageBitmap; canvas: sonuç çizimi için */
export async function analyze(img, onStep) {
  const lm = await loadModel(onStep);
  onStep?.("Yüz noktaları bulunuyor…");
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const res = lm.detect(img);
  const faces = res.faceLandmarks || [];
  if (!faces.length) throw Error("Fotoğrafta yüz bulunamadı. Yüzün tam göründüğü, iyi ışıklı bir fotoğraf dene.");
  // birden fazla yüz varsa en büyüğü
  const pick = faces.map((f) => ({ f, s: Math.abs(f[454].x - f[234].x) })).sort((a, b) => b.s - a.s)[0].f;
  const { pts, roll } = frontalize(pick, w, h);
  const raw = pick.map((q) => ({ x: q.x * w, y: q.y * h, z: q.z * w }));
  const W = dist(pts[234], pts[454]);
  const yaw = (pts[1].x - mid(pts[234], pts[454]).x) / W;
  const warnings = [];
  if (faces.length > 1) warnings.push("Fotoğrafta birden fazla yüz var; en büyük yüz kullanıldı.");
  if (Math.abs(yaw) > 0.07) warnings.push("Yüzün tam karşıdan değil, biraz yana dönük. Genişlik ayarları daha az doğru olabilir; mümkünse tam karşıdan çekilmiş bir fotoğraf kullan.");
  if (Math.abs(roll) > 12) warnings.push("Kafa yana yatık; düzeltildi ama düz bir fotoğraf daha iyi sonuç verir.");
  if (W < 160) warnings.push("Yüz fotoğrafta küçük kalıyor; daha yakından çekilmiş bir fotoğraf daha doğru sonuç verir.");
  const m = measures(pts);
  // renkler
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const r = Math.max(2, Math.round(W * 0.025));
  const skinC = sample(ctx, [raw[50], raw[280], raw[151], raw[101], raw[330]], r);
  const eyeC = raw.length > 476 ? irisColor(ctx, raw) : sample(ctx, [raw[159]], 2);
  const hairC = hairColor(ctx, raw, skinC, W, r);
  const skin = skinInfo(skinC), eye = eyeInfo(eyeC), hair = hairC ? hairInfo(hairC, skinC) : { hex: hex(skinC), name: "Saç görünmüyor (kel ya da çok kısa saç olabilir)", bald: true };
  // kaydırıcılar
  const sliders = RULES.map((rule) => {
    const [layer, region, sub, type, key, , , why] = rule;
    const v = sliderValue(m, rule);
    return { layer, region, sub, type, key, why, value: v, neutral: S[type][2], left: S[type][0], right: S[type][1] };
  });
  // yüz şekli
  const zr = zOf(m, "faceRatio"), zj = zOf(m, "jawW"), za = zOf(m, "jawAng");
  const shape = zr > 0.9 ? (zj < -0.5 ? "Uzun ve ince" : "Uzun") : zr < -0.9 ? (za < -0.8 ? "Kare" : "Yuvarlak") : zj < -1 ? "Kalp (alın geniş, çene dar)" : za < -1 ? "Köşeli oval" : "Oval";
  return { w, h, raw, pts, m, sliders, skin, eye, hair, shape, warnings, roll, yaw };
}

/** Sonucu katman › bölge sırasına göre grupla (oyundaki sıraya uygun) */
export function grouped(sliders) {
  const order = ["Skeletal", "Flesh", "Fat"], out = [];
  for (const L of order) {
    const regions = {};
    for (const s of sliders.filter((x) => x.layer === L)) (regions[s.region] ||= {}, regions[s.region][s.sub] ||= []).push(s);
    if (Object.keys(regions).length) out.push({ layer: L, tr: LAYER_TR[L], regions: Object.entries(regions).map(([r, subs]) => ({ region: r, tr: REGION_TR[r], subs })) });
  }
  return out;
}
