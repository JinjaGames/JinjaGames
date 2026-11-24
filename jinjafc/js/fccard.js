// JinjaFC oyuncu kartı (özgün tasarım). Reyting rengine göre bronz / gümüş / altın / elit.
import { esc } from "./util.js";
import { POS_TR, STAT_TR, GK_TR, flag } from "./db.js";

export const tier = (r) => (r >= 88 ? "elite" : r >= 75 ? "gold" : r >= 65 ? "silver" : "bronze");
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLocaleUpperCase("tr");

/** p: oyuncu · o: { pos (gösterilecek mevki), out (mevki dışı), size: "s" | "m" } */
export function cardHtml(p, o = {}) {
  const pos = o.pos || p.pos[0];
  const lab = p.pos[0] === "GK" ? GK_TR : STAT_TR;
  return `<span class="fcc ${tier(p.r)}${o.out ? " out" : ""}${p.women ? " w" : ""}${o.size === "s" ? " s" : ""}">
    <span class="fcTop"><b class="fcR">${p.r}</b><i class="fcP">${POS_TR[pos] || pos}</i>${flag(p.nat)}</span>
    <span class="fcMono" aria-hidden="true">${esc(initials(p.name))}</span>
    <span class="fcN">${esc(p.short)}</span>
    <span class="fcS">${p.stats.map((v, i) => `<i><em>${lab[i]}</em>${v}</i>`).join("")}</span>
    <span class="fcF">${p.psp.length ? `<i title="PlayStyle+: ${esc(p.psp.join(", "))}">◆${p.psp.length}</i>` : ""}<i title="Yetenek hareketi / zayıf ayak">${p.skill}★ ${p.wf}★</i></span>
  </span>`;
}
/** Kimya göstergesi: 0-3 elmas */
export const chemPips = (c) => `<span class="cpips" aria-label="Kimya ${c}/3">${[1, 2, 3].map((k) => `<i class="${k <= c ? "on" : ""}"></i>`).join("")}</span>`;
