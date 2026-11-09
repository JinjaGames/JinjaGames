import { h, mount, setCrumbs, go, toast, u } from '../util.js';
import { pageHead, sheet, emptyState } from '../ui.js';
import { decodeScenario, importShared } from '../palette.js';
import { t } from '../i18n.js';

export async function render(app, data) {
  setCrumbs(t('Paylaşılan senaryo'));
  let sc;
  try { sc = decodeScenario(data); if (!Array.isArray(sc.edits)) throw new Error(); } catch { mount(app, emptyState(t('Bağlantı okunamadı'), t('Bağlantı eksik ya da bozuk olabilir.'), h('a', { class: 'btn', href: u('/') }, t('Ana sayfa')))); return; }
  const first = sc.edits.find(e => e.t === 'result' || e.t === 'pens');
  const target = first ? `/${first.comp && ['CL', 'EL', 'FAC', 'CDR', 'DFB', 'CIT', 'UCOL'].includes(first.comp) ? 'kupa' : 'lig'}/${first.comp}/${first.season}` : first?.t === 'transfer' ? `/transfer/${first.season}` : '/senaryolar';
  mount(app, pageHead(sc.name || t('Paylaşılan senaryo'), t('{n} değişiklik içeriyor. İçe aktarırsan senin senaryolarına eklenir.', { n: sc.edits.length }),
    h('button', { class: 'btn primary', onclick: () => { importShared(sc); toast(t('Senaryo eklendi')); go(target); } }, t('İçe aktar ve aç'))),
  sheet(t('Değişiklikler'), h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1)' }, sc.edits.map(e => h('li', null, h('span', { class: 'chip' }, ({ result: t('Skor'), transfer: t('Transfer'), intl: t('Milli'), pens: t('Penaltı') }[e.t] || e.t)), h('span', null, e.label || '')))), {}));
}
