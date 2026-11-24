// JinjaQuiz ses efektleri: dosya indirmeden, Web Audio ile üretilen kısa sesler.
// Ayar: localStorage "jqSfx" ("0" = kapalı). Tarayıcı ses izni ilk dokunuşta açılır.
let ctx = null, master = null;
const on = () => { try { return localStorage.getItem("jqSfx") !== "0"; } catch { return true; } };
export const sfxEnabled = on;
export function setSfx(v) { try { localStorage.setItem("jqSfx", v ? "1" : "0"); } catch {} }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
// ilk kullanıcı etkileşiminde sesi aç (mobil tarayıcılar bunu ister)
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => ac(), { once: true, passive: true });

function tone(freq, t0, dur, { type = "sine", vol = 1, to = null, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, vol = 0.4, hp = 2000) {
  const n = Math.round(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = "highpass"; f.frequency.value = hp; g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(t0);
}

const SOUNDS = {
  // geri sayım: 3, 2, 1
  tick: (t) => { tone(880, t, 0.09, { type: "triangle", vol: 0.55 }); },
  // soru açıldı
  go: (t) => { tone(660, t, 0.12, { type: "triangle", vol: 0.5 }); tone(1320, t + 0.07, 0.22, { type: "triangle", vol: 0.45 }); },
  // quiz açılışı: yükselen kısa melodi
  open: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.22, { type: "triangle", vol: 0.42 })); noise(t + 0.3, 0.35, 0.12, 5000); },
  // cevap kilitlendi
  lock: (t) => { tone(420, t, 0.06, { type: "square", vol: 0.18 }); tone(620, t + 0.04, 0.08, { type: "square", vol: 0.14 }); },
  // doğru / yanlış
  good: (t) => { tone(784, t, 0.12, { type: "triangle", vol: 0.5 }); tone(1175, t + 0.09, 0.28, { type: "triangle", vol: 0.5 }); },
  bad: (t) => { tone(220, t, 0.28, { type: "sawtooth", vol: 0.22, to: 140 }); },
  // soru geçişi
  whoosh: (t) => { noise(t, 0.28, 0.22, 1200); tone(300, t, 0.25, { type: "sine", vol: 0.15, to: 900 }); },
  // sonuçlar
  end: (t) => { [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.12, 0.3, { type: "triangle", vol: 0.42 })); tone(1047, t + 0.36, 0.7, { type: "triangle", vol: 0.45 }); },
};
export function sfx(name) {
  if (!on() || !SOUNDS[name]) return;
  const c = ac();
  if (!c || c.state !== "running") return;
  try { SOUNDS[name](c.currentTime + 0.01); } catch {}
}
