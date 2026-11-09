import { h, mount, setCrumbs, u } from '../util.js';
import { pageHead } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';

const OPTIONS = [
  ['/lig', 'table', t('Bir maçın sonucunu'), t('Bir skoru değiştir. Şampiyon kim olurdu, Avrupa’ya kim giderdi, kim küme düşerdi?'), t('Maç seç')],
  ['/transfer', 'transfer', t('Bir transferi'), t('Gerçekleşen bir transferi iptal et ya da hiç olmamış bir transfer yap. Takımlar nasıl değişirdi?'), t('Transfer seç')],
  ['/kupa', 'trophy', t('Bir kupa maçını'), t('Şampiyonlar Ligi, Avrupa Ligi, FA Cup… Bir maçı ya da penaltıyı değiştir, kupayı kim kazanırdı?'), t('Kupa seç')],
  ['/milli', 'globe', t('Bir milli maçı'), t('Dünya Kupası, EURO ve diğer milli maçlar. Sonucu değiştir, güç sıralaması nasıl değişir?'), t('Milli maç seç')],
];

export async function render(app) {
  setCrumbs(t('Geçmişi değiştir'));
  mount(app,
    pageHead(t('Neyi değiştirmek istersin?'), t('Birini seç. Sonrasında ne yapacağını adım adım gösteririz.')),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(250px,1fr))' }, OPTIONS.map(([href, ic, ttl, d, act]) =>
      h('a', { class: 'tile big', href: u(href) }, h('span', { class: 'ic', html: icon(ic) }), h('h3', null, ttl), h('p', null, d), h('span', { class: 'go' }, `${act} →`)))),
    h('div', { class: 'section-h' }, t('Takımınla başlamak ister misin?')),
    h('a', { class: 'btn lg', href: u('/takimlar') }, t('Takımımı seç →')),
    h('p', { class: 'dim', style: 'max-width:60ch;margin-top:10px' }, t('Takım sayfasında “Senaryo atölyesi” var: hedefini seç (şampiyonluk, Avrupa, ligde kalmak), hangi sonuçları çevirmen gerektiğini senin yerine bulalım.')));
}
