// JinjaFC · Pro Clubs yüzü sayfası
import { analyze, loadModel, grouped, EYE_NAMES, HAIR_NAMES } from "./face.js";
import { headPreview } from "./head3d.js";
import { toast, shareOrDownload, esc } from "./util.js";

const $ = (s) => document.querySelector(s);
let current = null, preview = null, showPts = true, img = null;

// dosya seçimi: etiket tıklaması galeriyi açar; "kamerayla çek" ayrı girdi
$("#pickBtn").addEventListener("click", (e) => { e.preventDefault(); $("#file").click(); });
$("#camBtn").addEventListener("click", (e) => { e.preventDefault(); $("#cam").click(); });
for (const id of ["#file", "#cam"]) $(id).addEventListener("change", (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(f); });
const drop = $("#drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files?.[0]; if (f) run(f); });
// model, sayfa açılınca arka planda hazırlanmaya başlasın (fotoğraf seçilene kadar iner)
setTimeout(() => loadModel().catch(() => {}), 600);

const status = (t) => { $("#status").hidden = !t; if (t) $("#statusText").textContent = t; };
function fail(msg) { status(""); $("#error").hidden = false; $("#error").textContent = msg; }

async function decode(file) {
  if (!file.type.startsWith("image/")) throw Error("Bu bir fotoğraf dosyası değil.");
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    im.decoding = "async";
    im.src = url;
    await im.decode().catch(() => { throw Error("Fotoğraf açılamadı. Bu biçimi tarayıcın desteklemiyor olabilir; JPG ya da PNG dene."); });
    // büyük fotoğrafları küçült: hem hızlı hem bellek dostu (yönlendirme tarayıcı tarafından düzeltilir)
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

async function run(file) {
  $("#error").hidden = true;
  status("Fotoğraf hazırlanıyor…");
  try {
    img = await decode(file);
    const r = await analyze(img, status);
    current = r;
    status("");
    render(r);
  } catch (e) {
    console.error(e);
    fail(e.message || "Bir şeyler ters gitti, başka bir fotoğrafla dene.");
  }
}

function drawPhoto() {
  const cv = $("#photo"), r = current, box = cv.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr);
  const x = cv.getContext("2d");
  // yüze yakınlaştırılmış kırpma
  const xs = r.raw.map((p) => p.x), ys = r.raw.map((p) => p.y);
  const fx0 = Math.min(...xs), fx1 = Math.max(...xs), fy0 = Math.min(...ys), fy1 = Math.max(...ys);
  const cw = (fx1 - fx0) * 1.9, ch = cw * (cv.height / cv.width);
  const sx = (fx0 + fx1) / 2 - cw / 2, sy = (fy0 + fy1) / 2 - ch * 0.48;
  const k = cv.width / cw;
  x.fillStyle = "#000"; x.fillRect(0, 0, cv.width, cv.height);
  x.drawImage(img, sx, sy, cw, ch, 0, 0, cv.width, cv.height);
  if (!showPts) return;
  x.fillStyle = "#4ef08a";
  for (const p of r.raw.slice(0, 468)) { x.beginPath(); x.arc((p.x - sx) * k, (p.y - sy) * k, 1.1 * dpr, 0, 7); x.fill(); }
  // ölçülen ana çizgiler
  const line = (a, b, col) => { x.strokeStyle = col; x.lineWidth = 2 * dpr; x.beginPath(); x.moveTo((r.raw[a].x - sx) * k, (r.raw[a].y - sy) * k); x.lineTo((r.raw[b].x - sx) * k, (r.raw[b].y - sy) * k); x.stroke(); };
  line(234, 454, "#ffcf5c"); line(172, 397, "#ffcf5c"); line(10, 152, "#63b3ff"); line(61, 291, "#ff8fc7"); line(64, 294, "#ff8fc7"); line(133, 362, "#63b3ff");
}
$("#togglePts").addEventListener("click", (e) => { showPts = !showPts; e.target.textContent = showPts ? "Noktaları gizle" : "Noktaları göster"; drawPhoto(); });
new ResizeObserver(() => current && drawPhoto()).observe($("#photo"));

const slHtml = (s) => {
  const pct = s.value, changed = s.value !== s.neutral;
  return `<div class="sl${changed ? " chg" : ""}"><div class="ends"><span>${s.left}</span><span>${s.right}</span></div><span class="val">${s.value}</span>
    <div class="bar"><i style="width:${pct}%"></i><u style="left:${s.neutral}%"></u><em style="left:${pct}%"></em></div><small>${esc(s.why)}</small></div>`;
};
function skinPalette(step) {
  const cols = ["#f6dcc8", "#f0cfb3", "#e7bf9d", "#dcae86", "#c99670", "#b47f59", "#9a6646", "#7f5136", "#623d28", "#46291b"];
  return `<div class="palette" aria-label="Ten paletinde konum: ${step}/10">${cols.map((c, i) => `<i class="${i + 1 === step ? "on" : ""}" style="background:${c}" title="${i + 1}"></i>`).join("")}</div>`;
}

function render(r) {
  $("#result").hidden = false;
  paint(r);
  finish(r);
}
function paint(r) {
  $("#warnings").innerHTML = r.warnings.map((w) => `<div class="note">${esc(w)}</div>`).join("") ||
    `<div class="note ok">Fotoğraf uygun: yüz karşıdan ve net görünüyor.</div>`;
  $("#summary").innerHTML = `
    <div class="card sum"><small>Yüz şekli</small><b>${esc(r.shape)}</b><span>Hazır yüz seçerken bu şekle yakın olanı al.</span></div>
    <div class="card sum"><small>Ten</small><b><i class="sw" style="background:${r.skin.hex}"></i>${esc(r.skin.name)}</b><span>Paletin ${r.skin.step}/10 civarı · alt ton ${esc(r.skin.under)}</span></div>
    <div class="card sum"><small>Göz rengi</small><label class="pickC"><i class="sw" style="background:${r.eye.hex}"></i><select id="eyeSel" aria-label="Göz rengi">${EYE_NAMES.map((n) => `<option${n === r.eye.name ? " selected" : ""}>${n}</option>`).join("")}</select></label><span>${r.eye.name === r.eye.guess ? "Tahmin; yanlışsa değiştir" : "Senin seçimin"}</span></div>
    <div class="card sum"><small>Saç rengi</small><label class="pickC"><i class="sw" style="background:${r.hair.hex}"></i><select id="hairSel" aria-label="Saç rengi">${HAIR_NAMES.map((n) => `<option${n === (r.hair.bald ? "Saç yok / çok kısa" : r.hair.name) ? " selected" : ""}>${n}</option>`).join("")}</select></label><span>${r.hair.name === r.hair.guess || r.hair.bald ? "Tahmin; yanlışsa değiştir" : "Senin seçimin"}</span></div>`;
  $("#eyeSel").addEventListener("change", (e) => { r.eye.name = e.target.value; paint(r); });
  $("#hairSel").addEventListener("change", (e) => { const v = e.target.value; r.hair.bald = v === "Saç yok / çok kısa"; r.hair.name = r.hair.bald ? "Saç görünmüyor" : v; paint(r); });
  const groups = grouped(r.sliders);
  const changed = r.sliders.filter((s) => s.value !== s.neutral).length;
  $("#steps").innerHTML = `
    <section class="card step"><h3><i>1</i>Hazır yüzle başla</h3>
      <p>Oyuncu oluşturucuda <b>Head</b> bölümüne gir, hazır yüzler (preset) arasından <b>${esc(r.shape.toLocaleLowerCase("tr"))}</b> yüzlü ve ten rengi <b>${esc(r.skin.name.toLocaleLowerCase("tr"))}</b> olan birini seç. Sonra <b>Sculpt</b> menüsünü aç; <b>Shape</b> sekmesinde ve <b>Symmetry</b> açıkken aşağıdaki ayarları sırayla yap.</p></section>
    <section class="card step"><h3><i>2</i>Sculpt › Shape ayarları</h3>
      <p>${changed} kaydırıcıyı değiştireceksin (yeşil olanlar). Önce katmanı (en üstteki kutu), sonra bölgeyi, sonra alt bölgeyi seç. Çizgi, kaydırıcının başlangıç (nötr) noktasını gösterir.</p>
      ${groups.map((L) => `<div class="layer"><h4>${L.layer} <small>${L.tr}</small></h4><div class="regions">${L.regions.map((R) => `
        <div class="region"><h5>${R.region}<small>${R.tr}</small></h5>${Object.entries(R.subs).map(([sub, list]) => `<div class="sub"><b>${sub}</b>${list.map(slHtml).join("")}</div>`).join("")}</div>`).join("")}</div></div>`).join("")}
    </section>
    <section class="card step"><h3><i>3</i>Ten rengi</h3>
      <p><b>Skin</b> bölümünde ten tonunu paletin açıktan koyuya <b>${r.skin.step}. ton</b> civarına getir. Alt tonun <b>${esc(r.skin.under)}</b>; seçenek varsa ona yakın olanı al. Cilt dokusu ve çilleri az kullanmak daha gerçekçi görünür.</p>
      ${skinPalette(r.skin.step)}</section>
    <section class="card step"><h3><i>4</i>Göz rengi</h3>
      <p><b>Face</b> bölümünde göz rengini <b>${esc(r.eye.name.toLocaleLowerCase("tr"))}</b> tonlarından seç. <span class="sw" style="background:${r.eye.hex}"></span> Fotoğraftaki ışık göz rengini koyu gösterebilir; aynada gördüğün tona güven.</p></section>
    <section class="card step"><h3><i>5</i>Saç, kaş ve sakal</h3>
      <p><b>Hair</b> bölümünde ${r.hair.bald ? "saç görünmediği için önce saç modelini seç, rengini kendi saçına göre ayarla" : `saç rengini <b>${esc(r.hair.name.toLocaleLowerCase("tr"))}</b> tonlarından seç <span class="sw" style="background:${r.hair.hex}"></span>`}. Saç modeli (Hair Style), kaşlar ve sakal (Facial Hair) fotoğraftan güvenilir ölçülemez; kendi tarzına en yakın olanları seç. Saçı en sona bırak; yüzün nasıl göründüğünü çok değiştirir.</p></section>
    <section class="card step"><h3><i>6</i>Son kontrol</h3>
      <ul class="plain">
        <li>Yüzü yandan çevirip bak; benzerlik en çok profilde bozulur. Burun ve çene için Back–Forward ayarlarını gözle düzelt.</li>
        <li>Her seferinde tek kaydırıcıyı değiştirip etkisine bak; ±5–10 küçük oynamalar yeterli.</li>
        <li>Visual Age ile yaşını ayarla; kırışıklıklar yüzün ifadesini değiştirir.</li>
        <li>Bir maç oyna: ara sahnelerde ve sevinçlerde yüz farklı görünebilir, gerekirse geri dönüp düzelt.</li>
      </ul></section>`;
}
function finish(r) {
  drawPhoto();
  preview?.stop();
  preview = null;
  const go = () => { if (!window.THREE) return setTimeout(go, 80); preview = headPreview($("#head"), img, r); if (!preview) $("#head").parentElement.querySelector(".disc").textContent = "Bu cihazda 3D önizleme açılamadı."; };
  go();
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#front").addEventListener("click", () => preview?.front());
$("#spinBtn").addEventListener("click", () => preview?.spin());
$("#again").addEventListener("click", () => { $("#result").hidden = true; current = null; preview?.stop(); preview = null; img = null; scrollTo({ top: 0, behavior: "smooth" }); });

// --- dışa aktarma ---
const asText = (r) => [
  "JinjaFC · FC 27 Pro Clubs yüz ayarları",
  `Yüz şekli: ${r.shape} · Ten: ${r.skin.name} (${r.skin.step}/10, ${r.skin.under}) · Göz: ${r.eye.name} · Saç: ${r.hair.bald ? "görünmüyor" : r.hair.name}`,
  "",
  "Sculpt › Shape (listede olmayanlar varsayılan kalsın):",
  ...r.sliders.map((s) => `${s.layer} › ${s.region} › ${s.sub} — ${s.left}/${s.right}: ${s.value}`),
  "",
  "jinjagames.com/jinjafc/face",
].join("\n");
$("#copyTxt").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(asText(current)); toast("Ayarlar panoya kopyalandı."); } catch { toast("Kopyalanamadı; görsel olarak kaydetmeyi dene."); }
});
async function card() {
  await document.fonts?.ready;
  const r = current, rows = r.sliders, W = 1080, rowH = 52, top = 470;
  const H = top + rows.length * rowH + 150;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0c1d17"); g.addColorStop(1, "#07130f");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 3D görüntü (varsa)
  if (preview) {
    preview.front();
    await new Promise((res) => setTimeout(res, 450));
    const im = new Image();
    im.src = preview.snapshot();
    await im.decode().catch(() => {});
    const s = 360;
    x.save(); x.beginPath(); x.roundRect(W - s - 60, 60, s, s, 32); x.clip();
    x.fillStyle = "#16382a"; x.fillRect(W - s - 60, 60, s, s);
    const ar = im.width / im.height || 1;
    x.drawImage(im, W - s - 60 - (s * ar - s) / 2, 60, s * ar, s);
    x.restore();
  }
  x.fillStyle = "#4ef08a"; x.font = "800 28px Inter, sans-serif"; x.fillText("JINJAFC · FC 27 CLUBS", 60, 100);
  x.fillStyle = "#fff"; x.font = "700 64px 'Space Grotesk', Inter, sans-serif"; x.fillText("Yüz ayarlarım", 60, 180);
  const chip = (y, label, val, col) => { x.fillStyle = col; x.beginPath(); x.roundRect(60, y - 30, 36, 36, 9); x.fill(); x.fillStyle = "#9fbdaf"; x.font = "600 24px Inter, sans-serif"; x.fillText(label, 112, y - 4); x.fillStyle = "#fff"; x.font = "700 28px Inter, sans-serif"; x.fillText(val, 112, y + 28); };
  chip(260, "Ten", `${r.skin.name} · ${r.skin.step}/10`, r.skin.hex);
  chip(340, "Göz", r.eye.name, r.eye.hex);
  chip(420, "Saç", r.hair.bald ? "Görünmüyor" : r.hair.name, r.hair.hex);
  x.fillStyle = "#ffffff22"; x.fillRect(60, top - 10, W - 120, 2);
  rows.forEach((s, i) => {
    const y = top + 40 + i * rowH;
    x.fillStyle = s.value !== s.neutral ? "#fff" : "#9fbdaf";
    x.font = "600 24px Inter, sans-serif";
    x.fillText(`${s.layer} › ${s.region} › ${s.sub}`, 60, y);
    x.fillStyle = "#9fbdaf"; x.font = "500 22px Inter, sans-serif";
    x.fillText(`${s.left} / ${s.right}`, 640, y);
    x.fillStyle = s.value !== s.neutral ? "#4ef08a" : "#9fbdaf"; x.font = "800 28px 'Space Grotesk', Inter, sans-serif";
    x.textAlign = "right"; x.fillText(String(s.value), W - 60, y); x.textAlign = "left";
  });
  x.fillStyle = "#7f9e90"; x.font = "600 24px Inter, sans-serif";
  x.fillText("jinjagames.com/jinjafc · Fotoğraf cihazdan çıkmadan hesaplandı", 60, H - 60);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
$("#saveImg").addEventListener("click", async (e) => {
  e.target.disabled = true;
  try { const b = await card(); await shareOrDownload(b, "jinjafc-yuz-ayarlari.png", null, true); } finally { e.target.disabled = false; }
});
$("#shareBtn").addEventListener("click", async () => {
  const b = await card();
  await shareOrDownload(b, "jinjafc-yuz-ayarlari.png", "FC 27 Pro Clubs yüz ayarlarım · JinjaFC", false);
});
