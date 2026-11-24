// Doğum haritası çarkı (canvas) ve paylaşılabilir görseller (gönderi 1080×1350, hikâye 1080×1920).
import { SIGNS, PLANETS } from "./zodiac.js?v=14";
import { signOf, degIn, norm } from "./ephem.js?v=14";

const GLYPH_FONT = "'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols',sans-serif";
const ASPECT_COLOR = { sext: "#6fd3ff", trine: "#6fd3ff", square: "#ff6b7a", opp: "#ff6b7a" };

/** Çarkı (cx, cy) merkezli, r yarıçaplı çizer. Yükselen solda (9 yönü) olacak şekilde döndürülür. */
export function drawWheel(x, chart, cx, cy, r, { hideHouses = false } = {}) {
  const asc = hideHouses ? 0 : chart.houses.asc;
  const ang = (lon) => Math.PI + ((norm(lon - asc)) * Math.PI) / 180; // ekran açısı: burçlar saat yönünün tersine ilerler
  const P = (lon, rad) => [cx + Math.cos(ang(lon)) * rad, cy - Math.sin(ang(lon)) * rad];
  const rO = r, rS = r * 0.83, rH = r * 0.7, rP = r * 0.6, rA = r * 0.46;
  x.save();
  // dış halka: burç dilimleri
  SIGNS.forEach((s, i) => {
    x.beginPath();
    x.moveTo(...P(i * 30, rS));
    for (let d = 0; d <= 30; d += 2) x.lineTo(...P(i * 30 + d, rO));
    for (let d = 30; d >= 0; d -= 2) x.lineTo(...P(i * 30 + d, rS));
    x.closePath();
    x.fillStyle = s.c + (i % 2 ? "26" : "3d");
    x.fill();
    x.strokeStyle = "#ffffff26";
    x.lineWidth = r * 0.004;
    x.stroke();
    x.font = `${r * 0.085}px ${GLYPH_FONT}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = s.c;
    x.fillText(s.g, ...P(i * 30 + 15, (rO + rS) / 2));
  });
  // derece çentikleri
  x.strokeStyle = "#ffffff40";
  for (let d = 0; d < 360; d += 5) {
    x.lineWidth = d % 10 ? r * 0.002 : r * 0.004;
    x.beginPath();
    x.moveTo(...P(d, rS));
    x.lineTo(...P(d, rS - r * (d % 10 ? 0.015 : 0.03)));
    x.stroke();
  }
  // iç daireler
  for (const rr of [rS, rH, rA]) {
    x.beginPath();
    x.arc(cx, cy, rr, 0, Math.PI * 2);
    x.strokeStyle = "#ffffff30";
    x.lineWidth = r * 0.004;
    x.stroke();
  }
  // evler
  if (!hideHouses) {
    for (let h = 1; h <= 12; h++) {
      const lon = chart.houses.cusps[h];
      const axis = h === 1 || h === 10 || h === 4 || h === 7;
      x.beginPath();
      x.moveTo(...P(lon, axis ? rO * 1.02 : rS));
      x.lineTo(...P(lon, rA));
      x.strokeStyle = axis ? "#ffd36e" : "#a79bff66";
      x.lineWidth = r * (axis ? 0.006 : 0.003);
      x.stroke();
      const next = chart.houses.cusps[h === 12 ? 1 : h + 1];
      const mid = lon + norm(next - lon) / 2;
      x.font = `600 ${r * 0.04}px Inter,sans-serif`;
      x.fillStyle = "#cfc6ff";
      x.fillText(String(h), ...P(mid, (rH + rA) / 2 + r * 0.03));
    }
    x.font = `800 ${r * 0.045}px Inter,sans-serif`;
    x.fillStyle = "#ffd36e";
    x.fillText("ASC", ...P(chart.houses.asc, rO * 1.08));
    x.fillStyle = "#ff8fc7";
    x.fillText("MC", ...P(chart.houses.mc, rO * 1.08));
  }
  // açılar
  const bodies = Object.keys(chart.pos);
  for (const a of chart.aspects.slice(0, 16)) {
    if (a.type === "conj") continue;
    x.beginPath();
    x.moveTo(...P(chart.pos[a.a].lon, rA));
    x.lineTo(...P(chart.pos[a.b].lon, rA));
    x.strokeStyle = ASPECT_COLOR[a.type] + "99";
    x.lineWidth = r * 0.004;
    x.stroke();
  }
  // gezegenler: üst üste binmesinler diye yaydır
  const sorted = bodies.map((b) => ({ b, lon: chart.pos[b].lon, show: chart.pos[b].lon })).sort((a, b) => a.lon - b.lon);
  const gap = 7.5;
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i], b = sorted[(i + 1) % sorted.length];
      const d = norm(b.show - a.show);
      if (d < gap) {
        const push = (gap - d) / 2;
        a.show -= push;
        b.show += push;
      }
    }
  for (const p of sorted) {
    const C = PLANETS[p.b].c;
    x.beginPath();
    x.moveTo(...P(p.lon, rS));
    x.lineTo(...P(p.lon, rS - r * 0.04));
    x.strokeStyle = C;
    x.lineWidth = r * 0.006;
    x.stroke();
    const [px, py] = P(p.show, rP);
    x.shadowColor = C;
    x.shadowBlur = r * 0.04;
    x.font = `${r * 0.075}px ${GLYPH_FONT}`;
    x.fillStyle = C;
    x.fillText(PLANETS[p.b].g, px, py);
    x.shadowBlur = 0;
    x.font = `600 ${r * 0.032}px Inter,sans-serif`;
    x.fillStyle = "#ffffffcc";
    x.fillText(`${Math.floor(degIn(p.lon))}°${chart.pos[p.b].retro ? "ᴿ" : ""}`, ...P(p.show, rP - r * 0.085));
  }
  x.restore();
}

function stars(x, w, h, n, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    x.globalAlpha = 0.25 + rnd() * 0.75;
    x.fillStyle = rnd() < 0.2 ? "#ffd6ec" : "#ffffff";
    x.beginPath();
    x.arc(rnd() * w, rnd() * h, rnd() * 1.8 + 0.3, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
}
function wrap(x, text, cx, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > maxW && line) {
      x.fillText(line, cx, y);
      y += lh;
      line = w;
    } else line = t;
  }
  if (line) x.fillText(line, cx, y);
  return y + lh;
}
/** Paylaşılabilir görsel üretir; Blob döner. kind: "post" | "story" */
export async function renderCard(chart, info, kind = "post") {
  await document.fonts?.ready;
  const W = 1080, H = kind === "story" ? 1920 : 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1b0f3d");
  g.addColorStop(0.55, "#0d0a22");
  g.addColorStop(1, "#2a0f33");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, W * 0.7);
  glow.addColorStop(0, "#8a5cff33");
  glow.addColorStop(1, "#8a5cff00");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);
  stars(x, W, H, kind === "story" ? 420 : 320);
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  const top = kind === "story" ? 190 : 110;
  x.fillStyle = "#f5c66b";
  x.font = "600 30px Inter,sans-serif";
  x.fillText("DOĞUM HARİTASI", W / 2, top);
  x.fillStyle = "#ffffff";
  x.font = "700 78px Fraunces,Georgia,serif";
  x.fillText(info.name || "Gökyüzüm", W / 2, top + 88);
  x.fillStyle = "#cfc6ff";
  x.font = "500 30px Inter,sans-serif";
  x.fillText(info.line, W / 2, top + 138);
  const R = kind === "story" ? 430 : 380, cy = kind === "story" ? 860 : top + 180 + R;
  drawWheel(x, chart, W / 2, cy, R, { hideHouses: info.noTime });
  // büyük üçlü
  const trio = [["Güneş", PLANETS.sun.g, chart.pos.sun.lon], ["Ay", PLANETS.moon.g, chart.pos.moon.lon]];
  if (!info.noTime) trio.push(["Yükselen", "↑", chart.houses.asc]);
  const y0 = cy + R + (kind === "story" ? 130 : 95);
  const colW = W / trio.length;
  trio.forEach(([label, gl, lon], i) => {
    const cx = colW * i + colW / 2, s = SIGNS[signOf(lon)];
    x.fillStyle = s.c;
    x.font = `64px ${GLYPH_FONT}`;
    x.fillText(s.g, cx, y0);
    x.fillStyle = "#ffffff";
    x.font = "700 40px Fraunces,Georgia,serif";
    x.fillText(s.n, cx, y0 + 56);
    x.fillStyle = "#cfc6ff";
    x.font = "500 26px Inter,sans-serif";
    x.fillText(`${label} · ${Math.floor(degIn(lon))}°`, cx, y0 + 94);
  });
  if (kind === "story" && info.quote) {
    x.fillStyle = "#ffffffd9";
    x.font = "italic 500 34px Fraunces,Georgia,serif";
    wrap(x, `“${info.quote}”`, W / 2, y0 + 200, W - 200, 48);
  }
  x.fillStyle = "#ffffff80";
  x.font = "500 26px Inter,sans-serif";
  x.fillText("jinjagames.com/astro", W / 2, H - 60);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1500);
}
