import { h, mount, setCrumbs, toast, fmtDate, u } from '../util.js';
import { pageHead, sheet, emptyState } from '../ui.js';
import { copyShareLink } from '../palette.js';
import * as store from '../store.js';
import { t } from '../i18n.js';

export async function render(app) {
  setCrumbs(t('Senaryolar'));
  const draw = () => {
    const list = store.scenarios(), act = store.active();
    const file = h('input', { type: 'file', accept: '.json', hidden: true, onchange: async e => { try { store.importJSON(await e.target.files[0].text()); toast(t('İçe aktarıldı')); draw(); } catch (err) { toast(t('Dosya okunamadı')); } } });
    const exportBtn = h('button', { class: 'btn', onclick: () => {
      const url = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
      const a = h('a', { href: url, download: 'what-if-senaryolar.json' }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } }, t('Dışa aktar'));
    mount(app, pageHead(t('Senaryolar'), t('Senaryolar geçicidir: bu sekmeyi ya da siteyi kapattığında silinir. Saklamak istediğin senaryonun bağlantısını kopyala ya da dosya olarak dışa aktar.'),
      file, h('button', { class: 'btn', onclick: () => file.click() }, t('İçe aktar')), exportBtn,
      h('button', { class: 'btn primary', onclick: () => { store.newScenario(); draw(); } }, t('Yeni senaryo'))),
    list.length ? h('div', { class: 'grid' }, list.map(s => sheet(
      h('div', { style: 'display:flex;align-items:center;gap:10px;flex:1' },
        h('input', { type: 'text', value: s.name, 'aria-label': t('Senaryo adı'), style: 'font:600 16px var(--font-c);width:min(260px,100%)', onchange: e => store.rename(s.id, e.target.value || t('Adsız')) }),
        s.id === act?.id ? h('span', { class: 'chip mk' }, t('Aktif')) : null),
      s.edits.length ? h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1)' }, s.edits.map((e, i) => h('li', null,
        h('span', { class: 'chip' }, ({ result: t('Skor'), transfer: t('Transfer'), intl: t('Milli'), pens: t('Penaltı') }[e.t] || e.t)), h('span', { style: 'flex:1' }, e.label || (e.t === 'result' ? t('Maç #{id}', { id: e.id }) : t('Oyuncu #{id}', { id: e.pid }))),
        h('button', { class: 'btn sm ghost', onclick: () => { s.edits.splice(i, 1); store.setActive(s.id); draw(); } }, t('Kaldır'))))) : h('div', { class: 'dim' }, t('Bu senaryoda henüz değişiklik yok.')),
      { actions: [s.id !== act?.id ? h('button', { class: 'btn sm', onclick: () => { store.setActive(s.id); draw(); } }, t('Aktif yap')) : null,
        h('button', { class: 'btn sm', onclick: () => copyShareLink(s) }, t('Bağlantı kopyala')),
        h('span', { class: 'dim', style: 'font-size:12px' }, fmtDate(new Date(s.created).toISOString())),
        h('button', { class: 'btn sm ghost', onclick: () => { if (confirm(t('“{name}” silinsin mi?', { name: s.name }))) { store.remove(s.id); draw(); } } }, t('Sil'))] }))) : emptyState(t('Henüz senaryo yok'), t('Bir lig sezonunda skor değiştirdiğinde senaryo otomatik oluşur. Senaryolar bu sekme açık kaldıkça durur.'), h('a', { class: 'btn primary', href: u('/lig') }, t('Lig & Sezon’a git'))));
  };
  draw();
}
