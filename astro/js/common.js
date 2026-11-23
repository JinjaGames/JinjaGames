// JinjaAstro sayfalarının ortak parçaları: yardımcılar, kayıtlı haritalar, ülke→şehir seçici, paylaşma.
import * as E from "./ephem.js?v=10";
import { SIGNS } from "./zodiac.js?v=10";
import { COUNTRIES } from "./places.js?v=10";
import { utcOffset } from "./cities.js?v=10";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const SLUGS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const TR_SLUGS = ["koc", "boga", "ikizler", "yengec", "aslan", "basak", "terazi", "akrep", "yay", "oglak", "kova", "balik"]; // eski bağlantılar için
export const signBySlug = (s) => { const k = String(s || "").toLowerCase(); const i = SLUGS.indexOf(k); return i >= 0 ? i : TR_SLUGS.indexOf(k) >= 0 ? TR_SLUGS.indexOf(k) : null; };
export const degTxt = (lon) => { const d = E.degIn(lon); return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, "0")}′`; };
export const ORDER = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

let toastT;
export function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2800);
}

// ---- kayıtlı haritalar (yalnızca bu cihazda) ----
export const saved = () => store.get("jaCharts", []);
export function keepChart(info) {
  const list = saved().filter((c) => !(c.date === info.date && c.time === info.time && c.city === info.city && c.name === info.name));
  list.unshift({ name: info.name, date: info.date, time: info.time, noTime: info.noTime, country: info.country, city: info.city, lat: info.lat, lon: info.lon, off: info.off });
  store.set("jaCharts", list.slice(0, 20));
}
/** Kayıtlı ya da formdan gelen bilgiyle harita hesapla */
export function computeChart(info) {
  const [y, m, d] = info.date.split("-").map(Number), [hh, mm] = info.time.split(":").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm) - info.off * 3600e3);
  return E.chart(utc, info.lat, info.lon);
}
export const lineOf = (info) => { const [y, m, d] = info.date.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}${info.noTime ? "" : ` · ${info.time}`} · ${info.city}`; };
export const mySign = () => { const c = saved()[0]; return c ? E.signOf(computeChart(c).pos.sun.lon) : store.get("jaSign", E.signOf(E.sunLon(E.julian(new Date())))); };

// ---- aranabilir açılır liste (ülke ve şehir için) ----
const fold = (s) => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
export function combo(root, { items, placeholder, label, onPick }) {
  root.classList.add("combo");
  root.innerHTML = `<button type="button" class="comboBtn" aria-haspopup="listbox" aria-expanded="false"><span class="comboLabel">${esc(placeholder)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="comboPop" hidden><input class="comboSearch" type="search" placeholder="Ara…" aria-label="${esc(label)} ara" autocomplete="off"><ul class="comboList" role="listbox" aria-label="${esc(label)}"></ul></div>`;
  const btn = $(".comboBtn", root), pop = $(".comboPop", root), q = $(".comboSearch", root), ul = $(".comboList", root);
  let list = items, value = null, act = 0;
  const draw = () => {
    const f = fold(q.value.trim());
    const vis = list.map((it, i) => ({ it, i })).filter(({ it }) => !f || fold(it.n).includes(f));
    act = Math.min(act, Math.max(0, vis.length - 1));
    ul.innerHTML = vis.length ? vis.map(({ it, i }, k) => `<li role="option" data-i="${i}" aria-selected="${it === value}" class="${k === act ? "act" : ""}">${it.flag ? `<span class="fl">${it.flag}</span>` : ""}${esc(it.n)}</li>`).join("") : `<li class="none">Bulunamadı</li>`;
  };
  const open = (v) => {
    pop.hidden = !v;
    btn.setAttribute("aria-expanded", String(v));
    root.classList.toggle("open", v);
    if (v) { q.value = ""; act = Math.max(0, list.indexOf(value)); draw(); q.focus({ preventScroll: true }); ul.querySelector(".act")?.scrollIntoView({ block: "nearest" }); }
  };
  const pick = (i) => { value = list[i]; $(".comboLabel", root).textContent = value.n; root.classList.add("has"); open(false); btn.focus(); onPick?.(value); };
  btn.addEventListener("click", () => open(pop.hidden));
  q.addEventListener("input", () => { act = 0; draw(); });
  q.addEventListener("keydown", (e) => {
    const lis = $$("li[data-i]", ul);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, Math.min(lis.length - 1, act + (e.key === "ArrowDown" ? 1 : -1))); lis.forEach((l, k) => l.classList.toggle("act", k === act)); lis[act]?.scrollIntoView({ block: "nearest" }); }
    if (e.key === "Enter") { e.preventDefault(); if (lis[act]) pick(Number(lis[act].dataset.i)); }
    if (e.key === "Escape") { open(false); btn.focus(); }
  });
  ul.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) pick(Number(li.dataset.i)); });
  document.addEventListener("click", (e) => { if (!root.contains(e.target)) open(false); });
  return {
    set(it) { value = it; $(".comboLabel", root).textContent = it ? it.n : placeholder; root.classList.toggle("has", !!it); },
    items(newItems) { list = newItems; },
    get value() { return value; },
  };
}
/** Ülke ve şehir seçici. el: {country, city} kapsayıcıları. */
export function placePicker(countryEl, cityEl, onChange) {
  const countries = COUNTRIES.map((c) => ({ ...c, n: c.name }));
  let country = countries[0];
  const city = combo(cityEl, { items: country.cities, placeholder: "Şehir seç", label: "Şehir", onPick: () => onChange?.() });
  const ctry = combo(countryEl, { items: countries, placeholder: "Ülke seç", label: "Ülke", onPick: (c) => { country = c; city.items(c.cities); city.set(null); onChange?.(); } });
  ctry.set(country);
  return {
    get country() { return country; },
    get city() { return city.value; },
    set(countryName, cityName) {
      const c = countries.find((x) => x.name === countryName) || countries.find((x) => x.cities.some((y) => y.n === cityName)) || countries[0];
      country = c;
      ctry.set(c);
      city.items(c.cities);
      city.set(c.cities.find((y) => y.n === cityName) || null);
    },
    offset(date) {
      const ct = city.value;
      if (!ct || !date) return null;
      const [y, m, d] = date.split("-").map(Number);
      return utcOffset(ct.tz || country.tz, y, m, d);
    },
  };
}

// ---- paylaşma: telefonda paylaşım menüsü (Instagram, WhatsApp…), olmazsa indir ----
export async function shareImage(blob, fileName, text) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "JinjaAstro", text }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancel"; }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
export function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1500);
}
export async function shareLink(url, text) {
  if (navigator.share) { try { await navigator.share({ title: "JinjaAstro", text, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Bağlantı kopyalandı."); } catch { toast(url); }
}
export const waLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const signLink = (i) => SIGNS[i] && SLUGS[i];
