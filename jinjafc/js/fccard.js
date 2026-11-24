// JinjaFC oyuncu kartı: oyundaki temel kart düzeni (bronz / gümüş / altın), oyuncu fotoğrafı, bayrak, lig ve kulüp.
import { esc } from "./util.js";
import { POS_TR, STAT_TR, GK_TR, crestSrc, photoSrc, photoFb, leagueSrc } from "./db.js?v=3";

// oyundaki eşikler: 75+ altın, 65-74 gümüş, 64 ve altı bronz
export const tier = (r) => (r >= 75 ? "gold" : r >= 65 ? "silver" : "bronze");
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLocaleUpperCase("tr");

// görsel yüklenemezse: önce yedek adres, o da olmazsa gizle (CSP satır içi onerror'a izin vermez)
if (!window.__fcImgFb) {
  window.__fcImgFb = true;
  document.addEventListener("error", (e) => {
    const im = e.target;
    if (!(im instanceof HTMLImageElement)) return;
    if (im.dataset.fb) { const u = im.dataset.fb; delete im.dataset.fb; im.src = u; return; }
    if (im.classList.contains("fcImg")) im.closest(".fcc")?.classList.add("noph");
    im.style.visibility = "hidden";
  }, true);
}

export const photo = (p, cls = "fcImg") => {
  const src = photoSrc(p), fb = photoFb(p);
  return `<img class="${cls}" src="${src}"${src !== fb ? ` data-fb="${fb}"` : ""} alt="" loading="lazy" decoding="async" draggable="false">`;
};
const attr = (s) => esc(s).replace(/"/g, "&quot;");

/** p: oyuncu · o: { pos (gösterilecek mevki), out (mevki dışı), size: "s" } */
export function cardHtml(p, o = {}) {
  const pos = o.pos || p.pos[0];
  const lab = p.pos[0] === "GK" ? GK_TR : STAT_TR;
  const lg = leagueSrc(p.league);
  return `<span class="fcc ${tier(p.r)}${o.out ? " out" : ""}${o.size === "s" ? " s" : ""}">
    <span class="fcMono" aria-hidden="true">${esc(initials(p.name))}</span>
    <span class="fcPh">${photo(p)}</span>
    <b class="fcR">${p.r}</b><i class="fcP">${POS_TR[pos] || pos}</i>
    <span class="fcSW" title="Yetenek hareketi - zayıf ayak">${p.skill}-${p.wf}</span>
    ${p.psp.length ? `<span class="fcPS" title="PlayStyle+: ${attr(p.psp.join(", "))}">${p.psp.length}</span>` : ""}
    <span class="fcN">${esc(p.short)}</span>
    <span class="fcS">${p.stats.map((v, i) => `<i><em>${lab[i]}</em>${v}</i>`).join("")}</span>
    <span class="fcI">${p.nat?.iso ? `<img class="fcFl" src="/jinjafc/flags/${p.nat.iso}.svg" alt="${attr(p.nat.tr)}" title="${attr(p.nat.tr)}" loading="lazy">` : "<i></i>"}${lg ? `<img class="fcLg" src="${lg}" alt="${attr(p.league)}" title="${attr(p.league)}" loading="lazy">` : "<i></i>"}${p.clubId ? `<img class="fcCl" src="${crestSrc(p.clubId)}" alt="${attr(p.club)}" title="${attr(p.club)}" loading="lazy">` : "<i></i>"}</span>
  </span>`;
}
/** Kimya göstergesi: 0-3 elmas */
export const chemPips = (c) => `<span class="cpips" aria-label="Kimya ${c}/3">${[1, 2, 3].map((k) => `<i class="${k <= c ? "on" : ""}"></i>`).join("")}</span>`;
