// Sayfalar arası ortak arayüz: menü, 3B gökyüzü, burç ızgarası, "şu an" kartları.
import * as E from "../ephem.js?v=13";
import { SIGNS, PLANETS } from "../zodiac.js?v=13";
import { $, $$, MONTHS, ORDER, SLUGS } from "../common.js?v=13";
import { createSky } from "../sky.js?v=13";

// telefon menüsü
const mb = $(".menuBtn");
mb?.addEventListener("click", () => {
  const open = mb.getAttribute("aria-expanded") !== "true";
  mb.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("navOpen", open);
});

// yukarı çık düğmesi: uzun sayfalarda menüye ve sekmelere tek dokunuşla dön
{
  const b = document.createElement("button");
  b.type = "button";
  b.className = "toTop";
  b.setAttribute("aria-label", "Sayfanın başına dön");
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>';
  b.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  document.body.append(b);
  const upd = () => b.classList.toggle("show", scrollY > 700);
  addEventListener("scroll", upd, { passive: true });
  upd();
}

/** Yapışkan bölüm menüsü: okunan bölümü işaretler, dokununca o bölüme kaydırır. */
export function secNav(nav) {
  if (!nav) return;
  const links = $$("a[href^='#']", nav);
  const mark = (id) => links.forEach((a) => {
    const on = a.getAttribute("href") === "#" + id;
    a.classList.toggle("on", on);
    if (on) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth" });
  });
  const io = new IntersectionObserver((es) => {
    const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis) mark(vis.target.id);
  }, { rootMargin: "-130px 0px -60% 0px" });
  links.forEach((a) => { const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) io.observe(t); });
}

/** Sayfadaki 3B gökyüzünü kurar; THREE yüklenene kadar bekler. */
export function mountSky(onReady) {
  const canvas = $("#sky");
  if (!canvas) return;
  const tip = $("#skyTip"), box = $("#skyBox");
  const show = (p) => {
    if (!p) return (tip.hidden = true);
    const P = PLANETS[p.body], s = SIGNS[p.sign];
    tip.innerHTML = `<b style="color:${P.c}">${P.g} ${P.n}</b><span>${s.g} ${s.n} ${Math.floor(p.deg)}°${p.retro ? " · geri harekette" : ""}${p.house ? ` · ${p.house}. ev` : ""}</span><small>${P.about}</small>`;
    const r = box.getBoundingClientRect();
    tip.style.left = Math.min(r.width - 236, Math.max(8, p.x - r.left + 12)) + "px";
    tip.style.top = Math.min(r.height - 110, Math.max(8, p.y - r.top - 20)) + "px";
    tip.hidden = false;
  };
  document.addEventListener("pointerdown", (e) => { if (e.target !== canvas) tip.hidden = true; });
  const go = () => {
    if (!window.THREE) return setTimeout(go, 60);
    const sky = createSky(canvas, { onPick: show });
    if (!sky) { box.classList.add("noGL"); return; }
    $$("[data-sky]", box).forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.sky;
      if (k === "in") sky.zoom(0.85);
      if (k === "out") sky.zoom(1.18);
      if (k === "top") sky.top();
      if (k === "reset") sky.reset();
    }));
    onReady?.(sky);
  };
  go();
}

export const signGridHtml = (base = "/astro/signs/?sign=") =>
  SIGNS.map((s, i) => `<a class="sgTile" href="${base}${SLUGS[i]}" style="--c:${s.c}"><span>${s.g}</span><b>${s.n}</b><small>${s.dates}</small></a>`).join("");

export function phaseName(p) {
  if (p < 0.03 || p > 0.97) return ["Yeni Ay", "🌑"];
  if (p < 0.22) return ["Büyüyen Hilal", "🌒"];
  if (p < 0.28) return ["İlk Dördün", "🌓"];
  if (p < 0.47) return ["Büyüyen Ay", "🌔"];
  if (p < 0.53) return ["Dolunay", "🌕"];
  if (p < 0.72) return ["Küçülen Ay", "🌖"];
  if (p < 0.78) return ["Son Dördün", "🌗"];
  return ["Küçülen Hilal", "🌘"];
}
export function nowHtml(limit = ORDER.length) {
  const jd = E.julian(new Date()), pos = E.positions(jd), ph = E.moonPhase(jd);
  const [pn, pe] = phaseName(ph);
  const lit = Math.round(((1 - Math.cos(ph * 2 * Math.PI)) / 2) * 100);
  const d = new Date();
  const title = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const html = `<article class="moonCard glass"><span class="moonE">${pe}</span><div><b>${pn}</b><small>Ay %${lit} aydınlık · ${SIGNS[E.signOf(pos.moon.lon)].n} burcunda</small></div></article>` +
    ORDER.slice(0, limit).map((b) => {
      const p = pos[b], sg = SIGNS[E.signOf(p.lon)];
      return `<article class="nowCard glass" style="--c:${PLANETS[b].c}"><span class="ng">${PLANETS[b].g}</span><b>${PLANETS[b].n}${p.retro ? ' <em class="rx" title="Geri harekette">R</em>' : ""}</b><small><span style="color:${sg.c}">${sg.g}</span> ${sg.n} ${Math.floor(E.degIn(p.lon))}°</small></article>`;
    }).join("");
  return { title, html, pos };
}
export async function loadForecast() {
  const r = await fetch("/astro/data/forecast.json", { cache: "no-cache" });
  if (!r.ok) throw Error("yok");
  return r.json();
}
