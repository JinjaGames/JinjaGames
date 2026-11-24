// JinjaFC oyuncu verisi: EA SPORTS FC'nin herkese açık reyting listesini çeker, kadro kurucu için küçültür.
// Çıktı: jinjafc/data/players.json. GitHub Actions'ta günde bir kez çalışır; veri değişmediyse dosya yazılmaz.
// Liste eksik gelirse (toplamın %95'inden azı) eski dosya korunur ve iş başarısız sayılır.
// Arma adresleri tools/fc_crests.json'a yazılır; görselleri tools/fc_images.py küçültüp siteye koyar.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { NATIONS } from "./fc_nations.mjs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "jinjafc/data/players.json");
const API = "https://drop-api.ea.com/rating/ea-sports-fc?locale=en";
const PAGE = 100, PARALLEL = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(offset) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${API}&limit=${PAGE}&offset=${offset}`, { headers: { "User-Agent": "JinjaFC data updater (jinjagames.com)" }, signal: AbortSignal.timeout(30000) });
      if (r.status === 429 || r.status >= 500) throw Error("HTTP " + r.status);
      if (!r.ok) throw Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (i === 4) throw e;
      await sleep(1500 * 2 ** i);
    }
  }
}

const first = await page(0);
const total = first.totalItems;
const items = [...first.items];
const offsets = [];
for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
for (let i = 0; i < offsets.length; i += PARALLEL) {
  const got = await Promise.all(offsets.slice(i, i + PARALLEL).map(page));
  for (const g of got) items.push(...g.items);
  await sleep(250);
}
const seen = new Set();
const uniq = items.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
if (uniq.length < total * 0.95) {
  console.error(`Eksik liste: ${uniq.length}/${total}. Eski dosya korunuyor.`);
  process.exit(1);
}

// sözlükler: kulüp, lig, ülke (dosyayı küçük tutmak için indeksle)
const dict = () => { const list = [], map = new Map(); return { list, id(key, val) { if (!map.has(key)) { map.set(key, list.length); list.push(val); } return map.get(key); } }; };
const clubs = dict(), leagues = dict(), nations = dict(), styles = dict();
// ayrıntılı özellikler (Meta Rating hesabı ve oyuncu sayfası için), bu sırayla
const ATTR = ["acceleration", "sprintSpeed", "positioning", "finishing", "shotPower", "longShots", "volleys", "penalties", "vision", "crossing", "freeKickAccuracy",
  "shortPassing", "longPassing", "curve", "agility", "balance", "reactions", "ballControl", "dribbling", "composure", "interceptions", "headingAccuracy",
  "defensiveAwareness", "standingTackle", "slidingTackle", "jumping", "stamina", "strength", "aggression", "gkDiving", "gkHandling", "gkKicking", "gkPositioning", "gkReflexes"];
const missing = new Set();
const crests = {};
const POS = ["GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"];
const pos = (s) => POS.indexOf(s);
const v = (st, k) => st?.[k]?.value ?? 0;
const players = uniq.map((p) => {
  const st = p.stats;
  const gk = p.position?.shortLabel === "GK";
  const lg = leagues.id(p.leagueName || "?", p.leagueName || "?");
  return [
    p.id,
    p.commonName || [p.firstName, p.lastName].filter(Boolean).join(" "),
    p.overallRating,
    [p.position?.shortLabel, ...(p.alternatePositions || []).map((a) => a.shortLabel)].map(pos).filter((x) => x >= 0),
    clubs.id(p.team?.id ?? p.team?.label, (() => { if (p.team?.id && p.team.imageUrl) crests[p.team.id] = p.team.imageUrl; return [p.team?.label || "?", lg, p.team?.id || 0]; })()),
    lg,
    nations.id(p.nationality?.id ?? p.nationality?.label, (() => { const n = p.nationality?.label || "?"; const m = NATIONS[n]; if (!m) missing.add(n); return [n, m ? m[0] : "", m ? m[1] : n]; })()),
    p.gender?.id === 1 ? 1 : 0,
    // kart özellikleri: oyuncu için PAC SHO PAS DRI DEF PHY, kaleci için DIV HAN KIC REF SPD POS
    gk ? [v(st, "gkDiving"), v(st, "gkHandling"), v(st, "gkKicking"), v(st, "gkReflexes"), v(st, "acceleration") + v(st, "sprintSpeed") >> 1, v(st, "gkPositioning")]
       : [v(st, "pac"), v(st, "sho"), v(st, "pas"), v(st, "dri"), v(st, "def"), v(st, "phy")],
    p.skillMoves || 0,
    p.weakFootAbility || 0,
    p.preferredFoot === 1 ? "R" : "L",
    p.height || 0,
    ATTR.map((k) => v(st, k)),
    (p.playerAbilities || []).filter((a) => a.type?.id === "playStyle").map((a) => styles.id(a.label, a.label)),
    (p.playerAbilities || []).filter((a) => a.type?.id === "playStylePlus").map((a) => styles.id(a.label.replace(/\+$/, ""), a.label.replace(/\+$/, ""))),
  ];
}).sort((a, b) => b[2] - a[2]);

writeFileSync(join(ROOT, "tools/fc_crests.json"), JSON.stringify(crests) + "\n");
if (missing.size) console.warn("Bayrağı olmayan ülkeler:", [...missing].join(", "));
const body = { v: 2, source: "EA SPORTS FC Ratings", positions: POS, attrs: ATTR, styles: styles.list, clubs: clubs.list, leagues: leagues.list, nations: nations.list,
  fields: ["id", "name", "rating", "positions", "club", "league", "nation", "women", "stats", "skill", "weakFoot", "foot", "height", "attrs", "styles", "stylesPlus"], players };
const json = JSON.stringify(body);
let old = null;
try { old = readFileSync(OUT, "utf8"); } catch {}
const oldBody = old ? JSON.parse(old) : null;
if (oldBody && JSON.stringify({ ...oldBody, updated: undefined }) === JSON.stringify(body)) {
  console.log("Veri değişmedi:", players.length, "oyuncu");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ ...body, updated: new Date().toISOString() }) + "\n");
  console.log("Yazıldı:", players.length, "oyuncu,", clubs.list.length, "kulüp,", leagues.list.length, "lig,", nations.list.length, "ülke");
}
