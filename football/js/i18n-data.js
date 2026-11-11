// Veri hattının ürettiği Türkçe akış satırları (data/changes.json) için İngilizce görünüm.
// Veri dosyalarına dokunulmaz; yalnızca gösterilirken, İngilizce modda bilinen etiket sözcükleri değiştirilir.
import { lang } from './i18n.js';

const pl = (n, one, many) => (+n === 1 ? one : many);
const ROLES = { hoca: ['teknik direktör', 'manager'], baskan: ['başkan', 'chairman'], ceo: ['genel müdür', 'CEO'], sahip: ['sahip', 'owner'] };

/** kind: changes.json satır türü (hoca, baskan, ceo, sahip, transfer, sakat, haber, mac); text: veri hattının yazdığı satır. */
export function feedText(kind, text) {
  if (lang !== 'en' || typeof text !== 'string') return text;
  const role = ROLES[kind];
  if (role) return text.replace(`: ${role[0]} yeni: `, `: ${role[1]} new: `).replace(`: ${role[0]} `, `: ${role[1]} `);
  if (kind === 'haber') {
    return text.replace(/^(\S+) günü haberleri hazır: (\d+) maç, (\d+) lig$/, (_, d, n, m) => `${d} news ready: ${n} ${pl(n, 'match', 'matches')}, ${m} ${pl(m, 'league', 'leagues')}`);
  }
  if (kind === 'mac') {
    return text.replace(/^(.*): (\d+) yeni maç sonucu \(toplam (\d+)\)$/, (_, x, n, tot) => `${x}: ${n} new ${pl(n, 'result', 'results')} (total ${tot})`);
  }
  return text;   // transfer ve sakat: dil bağımsız ya da zaten İngilizce
}
