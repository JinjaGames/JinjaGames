// Doğum tarihi ve saati için kolay seçiciler: tarayıcının takvim/saat kutusu yerine Gün · Ay · Yıl ve Saat : Dakika.
// Asıl <input type="date|time"> gizli kalır; değeri her zaman ondan okunur/yazılır (mevcut kod değişmeden çalışır).
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const pad = (n) => String(n).padStart(2, "0");
const opts = (list, ph) => `<option value="">${ph}</option>` + list.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
const range = (a, b, step = 1) => { const r = []; for (let i = a; step > 0 ? i <= b : i >= b; i += step) r.push(i); return r; };

// input'un value / disabled özelliklerini yakala: kod değer yazınca seçiciler de güncellensin
function hook(input, onSet) {
  const proto = Object.getPrototypeOf(input);
  for (const prop of ["value", "disabled"]) {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, prop) || Object.getOwnPropertyDescriptor(proto, prop);
    Object.defineProperty(input, prop, {
      configurable: true,
      get() { return d.get.call(this); },
      set(v) { d.set.call(this, v); onSet(prop); },
    });
  }
}
const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };

export function enhanceDate(input) {
  if (input.dataset.enh) return;
  input.dataset.enh = "1";
  const minY = Number((input.min || "1900").slice(0, 4)), maxY = Math.min(Number((input.max || "2049").slice(0, 4)), new Date().getFullYear() + 1);
  const box = document.createElement("div");
  box.className = "dpick";
  box.innerHTML = `<select class="dD" aria-label="Gün">${opts(range(1, 31).map((d) => [d, d]), "Gün")}</select>
    <select class="dM" aria-label="Ay">${opts(AYLAR.map((m, i) => [i + 1, m]), "Ay")}</select>
    <select class="dY" aria-label="Yıl">${opts(range(maxY, minY, -1).map((y) => [y, y]), "Yıl")}</select>`;
  input.after(box);
  input.hidden = true;
  input.tabIndex = -1;
  const [sd, sm, sy] = box.querySelectorAll("select");
  const days = (y, m) => new Date(y || 2000, m || 1, 0).getDate();
  const fromInput = () => {
    const [y, m, d] = (input.value || "").split("-").map(Number);
    sy.value = y || ""; sm.value = m || ""; sd.value = d || "";
    sync();
  };
  function sync() {
    const n = days(+sy.value, +sm.value);
    [...sd.options].forEach((o) => { if (o.value) o.disabled = +o.value > n; });
    if (+sd.value > n) sd.value = String(n);
  }
  const toInput = () => {
    sync();
    const v = sy.value && sm.value && sd.value ? `${sy.value}-${pad(sm.value)}-${pad(sd.value)}` : "";
    if (v !== input.value) { setting = true; input.value = v; setting = false; fire(input); }
  };
  let setting = false;
  hook(input, (prop) => { if (prop === "disabled") box.querySelectorAll("select").forEach((s) => (s.disabled = input.disabled)); else if (!setting) fromInput(); });
  for (const s of [sd, sm, sy]) s.addEventListener("change", toInput);
  input.focus = () => (sd.value ? sm.value ? sy : sm : sd).focus();
  fromInput();
}

export function enhanceTime(input) {
  if (input.dataset.enh) return;
  input.dataset.enh = "1";
  const box = document.createElement("div");
  box.className = "tpick";
  box.innerHTML = `<select class="tH" aria-label="Saat">${range(0, 23).map((h) => `<option value="${pad(h)}">${pad(h)}</option>`).join("")}</select><b aria-hidden="true">:</b>
    <select class="tM" aria-label="Dakika">${range(0, 59).map((m) => `<option value="${pad(m)}">${pad(m)}</option>`).join("")}</select>`;
  input.after(box);
  input.hidden = true;
  input.tabIndex = -1;
  const [sh, sm] = box.querySelectorAll("select");
  let setting = false;
  const fromInput = () => { const [h, m] = (input.value || "12:00").split(":"); sh.value = pad(+h || 0); sm.value = pad(+m || 0); };
  const toInput = () => { const v = `${sh.value}:${sm.value}`; if (v !== input.value) { setting = true; input.value = v; setting = false; fire(input); } };
  hook(input, (prop) => { if (prop === "disabled") { sh.disabled = sm.disabled = input.disabled; box.classList.toggle("off", input.disabled); } else if (!setting) fromInput(); });
  sh.addEventListener("change", toInput);
  sm.addEventListener("change", toInput);
  input.focus = () => sh.focus();
  fromInput();
}

export function enhanceFields(root = document) {
  root.querySelectorAll('input[type="date"]').forEach(enhanceDate);
  root.querySelectorAll('input[type="time"]').forEach(enhanceTime);
}
