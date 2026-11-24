// Yorum kartı: haftalık, aylık, uyum ve burç profili için paylaşılabilir görsel (1080×1350 ya da 1080×1920)
// ve her sayfada aynı görünen paylaş / kaydet çubuğu.
import { toast, shareImage, downloadBlob, shareLink, waLink } from "./common.js?v=13";

const GLYPH_FONT = "'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols',sans-serif";

function stars(x, w, h, n) {
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    x.globalAlpha = 0.2 + rnd() * 0.7;
    x.fillStyle = rnd() < 0.2 ? "#ffd6ec" : "#ffffff";
    x.beginPath();
    x.arc(rnd() * w, rnd() * h, rnd() * 1.7 + 0.3, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
}
/** Metni satırlara böler; en çok maxLines satır, taşarsa "…" */
function lines(x, text, maxW, maxLines) {
  const out = [];
  let line = "";
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  return out;
}
/** Metni verilen genişliğe en çok maxLines satırda sığdıran en büyük yazı boyutunu bulur (kesmeden). */
function fit(x, text, weight, family, maxPx, minPx, maxW, maxLines) {
  for (let px = maxPx; px >= minPx; px -= 2) {
    x.font = `${weight} ${px}px ${family}`;
    const words = String(text).split(/\s+/);
    if (words.some((w) => x.measureText(w).width > maxW)) continue;
    const l = lines(x, text, maxW, 99);
    if (l.length <= maxLines) return { px, l };
  }
  x.font = `${weight} ${minPx}px ${family}`;
  return { px: minPx, l: lines(x, text, maxW, maxLines) };
}
function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); }

/** Uyum kartı üst bölümü: iki isim, ortada yüzde halkası, altında alt puan çubukları. y'yi döndürür. */
function matchHead(x, m, W, P, y, story) {
  const R = story ? 150 : 128, cx = W / 2, cy = y + R + 10;
  // halka
  x.lineWidth = 22; x.lineCap = "round";
  x.strokeStyle = "#ffffff1f"; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
  const g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  g.addColorStop(0, "#f5c66b"); g.addColorStop(1, "#ff8fc7");
  x.strokeStyle = g; x.beginPath(); x.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(0, Math.min(100, m.score))) / 100); x.stroke();
  x.textAlign = "center"; x.fillStyle = "#fff";
  x.font = `700 ${story ? 104 : 92}px Fraunces,Georgia,serif`;
  x.fillText(`%${m.score}`, cx, cy + 30);
  x.fillStyle = "#cfc6ff"; x.font = "600 26px Inter,sans-serif";
  x.fillText("uyum", cx, cy + 74);
  // isimler: halkanın iki yanında, sütuna sığana kadar küçülür, en çok 2 satır
  const colW = cx - R - P - 34;
  for (const [i, name, glyph] of [[0, m.a, m.ga], [1, m.b, m.gb]]) {
    const colX = i === 0 ? P + colW / 2 : W - P - colW / 2;
    if (glyph) { x.font = `86px ${GLYPH_FONT}`; x.fillStyle = "#f5c66b"; x.globalAlpha = 0.95; x.fillText(glyph, colX, cy - 34); x.globalAlpha = 1; }
    const f = fit(x, name, 700, "Fraunces,Georgia,serif", 58, 30, colW, 2);
    x.fillStyle = "#fff";
    let ty = cy + 30 + (f.l.length === 1 ? 0 : -f.px * 0.45);
    for (const l of f.l) { x.fillText(l, colX, ty); ty += f.px * 1.1; }
  }
  y = cy + R + 60;
  // tür satırı
  if (m.type) {
    x.fillStyle = "#cfc6ff"; x.font = "500 31px Inter,sans-serif";
    for (const l of lines(x, m.type, W - P * 2, 2)) { x.fillText(l, cx, y); y += 40; }
    y += 8;
  }
  // alt puanlar: çubuklar
  const subs = m.subs || [];
  if (subs.length) {
    const gap = 18, bw = (W - P * 2 - gap * (subs.length - 1)) / subs.length;
    subs.forEach(([lab, v], i) => {
      const bx = P + i * (bw + gap);
      x.textAlign = "left"; x.fillStyle = "#ece6ff"; x.font = "600 25px Inter,sans-serif";
      x.fillText(lab, bx, y + 8);
      x.textAlign = "right"; x.fillStyle = "#f5c66b"; x.font = "700 25px Inter,sans-serif";
      x.fillText(`%${v}`, bx + bw, y + 8);
      x.fillStyle = "#ffffff1f"; rr(x, bx, y + 22, bw, 12, 6); x.fill();
      x.fillStyle = g; rr(x, bx, y + 22, Math.max(12, (bw * v) / 100), 12, 6); x.fill();
    });
    y += 74;
  }
  x.textAlign = "left";
  return y + 20;
}

/**
 * card: { glyph, color, eyebrow, title, sub, blocks: [{ h, t }], foot, match? }
 * match (uyum kartı): { a, b, ga, gb, score, type, subs: [[etiket, yüzde]] }
 * kind: "post" | "story"
 */
export async function renderReading(card, kind = "post") {
  await document.fonts?.ready;
  const W = 1080, H = kind === "story" ? 1920 : 1350, P = 90;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1b0f3d"); g.addColorStop(0.55, "#0d0a22"); g.addColorStop(1, "#2a0f33");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * 0.8, 160, 20, W * 0.8, 160, W * 0.8);
  glow.addColorStop(0, (card.color || "#f5c66b") + "44"); glow.addColorStop(1, "#00000000");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  stars(x, W, H, kind === "story" ? 360 : 260);

  let y = kind === "story" ? 200 : 130;
  x.textBaseline = "alphabetic";
  if (card.match) {
    x.textAlign = "center"; x.fillStyle = "#f5c66b"; x.font = "700 30px Inter,sans-serif";
    x.fillText((card.eyebrow || "").toLocaleUpperCase("tr"), W / 2, y);
    y = matchHead(x, card.match, W, P, y + 40, kind === "story");
  } else if (card.glyph) {
    x.textAlign = "right";
    x.fillStyle = card.color || "#f5c66b";
    x.globalAlpha = 0.9;
    x.font = `150px ${GLYPH_FONT}`;
    x.fillText(card.glyph, W - P + 10, y + 70);
    x.globalAlpha = 1;
  }
  if (!card.match) {
    x.textAlign = "left";
    x.fillStyle = "#f5c66b";
    x.font = "700 30px Inter,sans-serif";
    x.fillText((card.eyebrow || "").toLocaleUpperCase("tr"), P, y);
    y += 84;
    // başlık: kesmeden sığana kadar küçülür (en çok 2 satır)
    const f = fit(x, card.title, 700, "Fraunces,Georgia,serif", 84, 50, W - P * 2 - (card.glyph ? 180 : 0), 2);
    x.fillStyle = "#ffffff";
    for (const l of f.l) { x.fillText(l, P, y); y += f.px * 1.1; }
    if (card.sub) {
      x.fillStyle = "#cfc6ff";
      x.font = "500 32px Inter,sans-serif";
      for (const l of lines(x, card.sub, W - P * 2, 2)) { y += 4; x.fillText(l, P, y); y += 40; }
    }
    y += 40;
  }
  const bottom = H - (kind === "story" ? 230 : 150);
  const blocks = card.blocks || [];
  x.textAlign = "left";
  for (const b of blocks) {
    if (y > bottom - 130) break;
    x.font = "500 30px Inter,sans-serif";
    const room = Math.max(1, Math.floor((bottom - y - 76) / 41));
    const ls = lines(x, b.t, W - P * 2 - 56, Math.min(room, kind === "story" ? 7 : 4));
    const boxH = 66 + ls.length * 41;
    x.fillStyle = "#ffffff0f"; rr(x, P, y - 8, W - P * 2, boxH, 24); x.fill();
    x.fillStyle = "#f5c66b"; x.font = "700 23px Inter,sans-serif";
    x.fillText(b.h.toLocaleUpperCase("tr"), P + 28, y + 30);
    x.fillStyle = "#ece6ff"; x.font = "500 30px Inter,sans-serif";
    let ty = y + 74;
    for (const l of ls) { x.fillText(l, P + 28, ty); ty += 41; }
    y += boxH + 18;
  }
  x.fillStyle = "#ffffff22";
  x.fillRect(P, H - (kind === "story" ? 170 : 110), W - P * 2, 2);
  x.fillStyle = "#9b92c4";
  x.font = "600 28px Inter,sans-serif";
  x.fillText(card.foot || "jinjagames.com/astro", P, H - (kind === "story" ? 115 : 58));
  return new Promise((res) => c.toBlob(res, "image/png"));
}

const ICON = {
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  story: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  wa: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1.3-1.3 2.2 1-.5 1.8c-3.5.3-8-4.2-7.7-7.7l1.8-.5 1 2.2z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

/**
 * Paylaş / kaydet çubuğu. opts: { card: () => cardObj, file, url: () => string, text: () => string, save?: { label, done, onSave } }
 * Telefonda "Paylaş" sistem menüsünü açar (Instagram, WhatsApp, mesajlar…); masaüstünde görseli indirir.
 */
export function shareBar(root, opts) {
  const save = opts.save;
  root.classList.add("shareBar");
  root.innerHTML = `
    <button type="button" class="sbtn main" data-act="share">${ic("share")}<span>Paylaş</span></button>
    <button type="button" class="sbtn" data-act="post">${ic("image")}<span>Görseli kaydet</span></button>
    <button type="button" class="sbtn" data-act="story">${ic("story")}<span>Hikâye görseli</span></button>
    <a class="sbtn" data-act="wa" target="_blank" rel="noopener">${ic("wa")}<span>WhatsApp</span></a>
    <button type="button" class="sbtn" data-act="link">${ic("link")}<span>Linki kopyala</span></button>
    ${save ? `<button type="button" class="sbtn" data-act="save" aria-pressed="false">${ic("star")}<span></span></button>` : ""}`;
  const wa = root.querySelector('[data-act="wa"]');
  const refresh = () => {
    wa.href = waLink(`${opts.text()} ${opts.url()}`);
    if (save) {
      const b = root.querySelector('[data-act="save"]'), on = save.done();
      b.setAttribute("aria-pressed", String(on));
      b.querySelector("span").textContent = on ? save.doneLabel : save.label;
    }
  };
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.dataset.act === "wa") return;
    const act = b.dataset.act;
    if (act === "link") { await shareLink(opts.url(), opts.text()); return; }
    if (act === "save") { save.onSave(); refresh(); toast(save.toast || "Kaydedildi."); return; }
    b.disabled = true;
    try {
      const mobile = matchMedia("(max-width: 760px)").matches;
      const kind = act === "story" || (act === "share" && mobile) ? "story" : "post";
      const blob = await renderReading(opts.card(), kind);
      const name = `${opts.file()}-${kind === "story" ? "hikaye" : "gorsel"}.png`;
      if (act === "share") {
        const r = await shareImage(blob, name, `${opts.text()} ${opts.url()}`);
        if (r === "downloaded") toast("Görsel indirildi; istediğin yerde paylaşabilirsin.");
      } else { downloadBlob(blob, name); toast("Görsel kaydedildi."); }
    } finally { b.disabled = false; }
  });
  refresh();
  return { refresh };
}
