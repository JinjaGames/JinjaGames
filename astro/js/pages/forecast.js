// Haftalık ve aylık yorum sayfası (hangisi olduğu bölümün data-period değerinden okunur).
import * as E from "../ephem.js";
import { SIGNS } from "../zodiac.js";
import { $, $$, esc, store, SLUGS, signBySlug, mySign, saved, computeChart, shareLink } from "../common.js";
import { loadForecast } from "./ui.js";

const period = $("[data-period]").dataset.period; // week | month
let sel = signBySlug(new URLSearchParams(location.search).get("sign")) ?? mySign();
let fc = null;

// kayıtlı harita varsa güneş ve yükselen için kısayol
const c0 = saved()[0];
const mine = c0 ? (() => { const ch = computeChart(c0); return { sun: E.signOf(ch.pos.sun.lon), asc: c0.noTime ? null : E.signOf(ch.houses.asc), name: c0.name }; })() : null;

function picker() {
  $("#signPick").innerHTML = SIGNS.map((s, i) => `<a role="tab" href="?sign=${SLUGS[i]}" data-sign="${i}" aria-selected="${i === sel}" style="--c:${s.c}"><span>${s.g}</span><b>${s.n}</b><small>${s.dates}</small></a>`).join("");
}
$("#signPick").addEventListener("click", (e) => {
  const a = e.target.closest("[data-sign]");
  if (!a) return;
  e.preventDefault();
  setSign(Number(a.dataset.sign), true);
});
function setSign(i, scroll) {
  sel = i;
  store.set("jaSign", i);
  history.replaceState(null, "", `?sign=${SLUGS[i]}`);
  picker();
  draw();
  if (scroll) $("#fcBox").scrollIntoView({ behavior: "smooth", block: "start" });
}
function draw() {
  if (!fc) return;
  const P = fc[period], s = SIGNS[sel], d = P.signs[s.id];
  const label = period === "week" ? "Haftanın" : "Ayın";
  const quick = mine ? `<div class="quick">${mine.sun !== sel ? `<button type="button" data-go="${mine.sun}">Güneş burcum: ${SIGNS[mine.sun].g} ${SIGNS[mine.sun].n}</button>` : ""}${mine.asc != null && mine.asc !== sel ? `<button type="button" data-go="${mine.asc}">Yükselenim: ${SIGNS[mine.asc].g} ${SIGNS[mine.asc].n}</button>` : ""}</div>` : `<p class="hint">Yükselen burcunu bilmiyor musun? <a href="/astro/chart/">Doğum haritanı çıkar</a>, ardından yükselenine göre de oku.</p>`;
  $("#fcBox").innerHTML = `
    <header class="fcHead" style="--c:${s.c}"><span aria-hidden="true">${s.g}</span><div><h2>${s.n}</h2><small>${esc(P.title)} · ${s.el} · ${s.dates}</small></div><button type="button" class="btn glass sm" id="shareFc">Paylaş</button></header>
    ${quick}
    <div class="fcGrid">
      <section class="fcItem main"><h3>${label} genel havası</h3><p>${esc(d.general)}</p></section>
      <section class="fcItem"><h3>Aşk ve ilişkiler</h3><p>${esc(d.love)}</p></section>
      <section class="fcItem"><h3>İş ve para</h3><p>${esc(d.work)}</p></section>
      <section class="fcItem advice"><h3>${label} önerisi</h3><p>${esc(d.tip)}</p>${d.lucky ? `<span class="pill">Şanslı günün: <b>${esc(d.lucky)}</b></span>` : ""}${d.dates?.length ? `<span class="pill">Önemli günler: <b>${d.dates.map(esc).join(", ")}</b></span>` : ""}</section>
    </div>
    <footer class="fcFoot"><a href="/astro/signs/?sign=${SLUGS[sel]}">${s.n} burcunun tüm özellikleri →</a><a href="/astro/${period === "week" ? "monthly" : "weekly"}/?sign=${SLUGS[sel]}">${period === "week" ? "Aylık" : "Haftalık"} yorumu oku →</a></footer>`;
  $("#shareFc").addEventListener("click", () => shareLink(location.href, `${s.n} burcu ${period === "week" ? "bu hafta" : "bu ay"}:`));
  $$("[data-go]", $("#fcBox")).forEach((b) => b.addEventListener("click", () => setSign(Number(b.dataset.go), false)));
}
picker();
try {
  fc = await loadForecast();
  const P = fc[period];
  $("#periodTitle").textContent = P.title;
  $("#skyList").innerHTML = P.sky.length ? P.sky.map((n) => `<li>${esc(n.text)}</li>`).join("") : "<li>Bu dönemde büyük bir geçiş yok; sakin bir gökyüzü.</li>";
  draw();
} catch {
  $("#fcBox").innerHTML = `<p class="hint">Yorumlar şu an yüklenemedi. Biraz sonra tekrar dene.</p>`;
}
