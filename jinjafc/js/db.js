// JinjaFC oyuncu veritabanı: players.json'u bir kez yükler, kullanışlı nesnelere çevirir.
const fold = (s) => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/ø/g, "o").replace(/ß/g, "ss");
export { fold };
let DB = null;
export async function loadDB() {
  if (DB) return DB;
  const r = await fetch("/jinjafc/data/players.json", { cache: "no-cache" });
  if (!r.ok) throw Error("Oyuncu listesi yüklenemedi");
  const d = await r.json();
  const P = d.positions, ST = d.styles || [];
  const nations = d.nations.map((n) => (Array.isArray(n) ? { name: n[0], iso: n[1], tr: n[2] } : { name: n, iso: "", tr: n }));
  const players = d.players.map((a) => {
    const [id, name, r, pos, club, league, nation, women, stats, skill, wf, foot, h, attrs, ps, psp] = a;
    const n = nations[nation];
    return { id, name, r, pos: pos.map((i) => P[i]), club: d.clubs[club][0], clubId: d.clubs[club][2] || 0, league: d.leagues[league], nation: n.name, nat: n, women: !!women,
      stats, skill, wf, foot, h, attrs: attrs || [], ps: (ps || []).map((i) => ST[i]), psp: (psp || []).map((i) => ST[i]), short: shortName(name), key: fold(name) };
  });
  DB = {
    players, byId: new Map(players.map((p) => [p.id, p])), updated: d.updated, attrNames: d.attrs || [],
    leagues: [...new Set(players.map((p) => p.league))].sort((a, b) => a.localeCompare(b, "tr")),
    nations: nations.slice().sort((a, b) => a.tr.localeCompare(b.tr, "tr")),
    clubs: [...new Set(players.map((p) => p.club))].sort((a, b) => a.localeCompare(b, "tr")),
    natByName: new Map(nations.map((n) => [n.name, n])),
    clubIdByName: new Map(players.filter((p) => p.clubId).map((p) => [p.club, p.clubId])),
  };
  return DB;
}
export function shortName(n) {
  const parts = String(n).split(" ");
  if (parts.length <= 1 || n.length <= 12) return n;
  const last = parts.slice(1).join(" ");
  return last.length <= 13 ? last : parts[parts.length - 1];
}
// mevki adlarının Türkçesi (FC 27 Türkçe arayüzündeki kısaltmalar)
export const POS_TR = { GK: "KL", RB: "SĞB", RWB: "SĞKB", CB: "STP", LB: "SLB", LWB: "SLKB", CDM: "MDO", CM: "MO", CAM: "MOO", RM: "SĞO", LM: "SLO", RW: "SĞK", LW: "SLK", CF: "SF", ST: "SNT" };
export const STAT_TR = ["HIZ", "ŞUT", "PAS", "DRİ", "DEF", "FİZ"], GK_TR = ["UÇŞ", "TPK", "VUR", "REF", "SÜR", "POZ"];
// görseller: yerel küçük WebP varsa o, yoksa EA'in adresi (fccard.js hata olunca yedeğe düşer)
const EA_AV = (id) => `https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p${id}.png`;
export const PHOTO_MIN = 70;
export const photoSrc = (p) => (p.r >= PHOTO_MIN ? `/jinjafc/img/ph/${p.id}.webp` : EA_AV(p.id));
export const photoFb = (p) => EA_AV(p.id);
// lig logosu: dosya adı lig adının sadeleştirilmiş hâli (tools/fc_images ile aynı kural)
export const leagueSlug = (s) => String(s).normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const leagueSrc = (name) => (name && name !== "?" ? `/jinjafc/img/lg/${leagueSlug(name)}.webp` : "");
export const crestSrc = (id) => (id ? `/jinjafc/img/c/${id}.webp` : "");
export const crest = (p, cls = "crest") => (p.clubId ? `<img class="${cls}" src="${crestSrc(p.clubId)}" alt="${p.club.replace(/"/g, "&quot;")}" title="${p.club.replace(/"/g, "&quot;")}" loading="lazy" width="20" height="20" data-hide>` : "");
export const flag = (n) => (n?.iso ? `<img class="flag" src="/jinjafc/flags/${n.iso}.svg" alt="${n.tr}" title="${n.tr}" loading="lazy" width="20" height="15">` : "");
