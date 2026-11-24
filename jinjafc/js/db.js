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
    return { id, name, r, pos: pos.map((i) => P[i]), club: d.clubs[club][0], league: d.leagues[league], nation: n.name, nat: n, women: !!women,
      stats, skill, wf, foot, h, attrs: attrs || [], ps: (ps || []).map((i) => ST[i]), psp: (psp || []).map((i) => ST[i]), short: shortName(name), key: fold(name) };
  });
  DB = {
    players, byId: new Map(players.map((p) => [p.id, p])), updated: d.updated,
    leagues: [...new Set(players.map((p) => p.league))].sort((a, b) => a.localeCompare(b, "tr")),
    nations: nations.slice().sort((a, b) => a.tr.localeCompare(b.tr, "tr")),
    clubs: [...new Set(players.map((p) => p.club))].sort((a, b) => a.localeCompare(b, "tr")),
    natByName: new Map(nations.map((n) => [n.name, n])),
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
export const flag = (n) => (n?.iso ? `<img class="flag" src="/jinjafc/flags/${n.iso}.svg" alt="${n.tr}" title="${n.tr}" loading="lazy" width="20" height="15">` : "");
