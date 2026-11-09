import { h, mount, setCrumbs, fmtDate, norm, debounce, go, u } from '../util.js';
import { boot, sheet, crestFor } from '../ui.js';
import { loadUpcoming, loadChanges } from '../data.js';
import * as store from '../store.js';
import { icon } from '../icons.js';
import { t, tl, LOC } from '../i18n.js';
import { feedText } from '../i18n-data.js';

const POPULAR = ['Galatasaray', 'Fenerbahce', 'Beşiktaş Jimnastik Kulübü', 'Trabzonspor', 'Real Madrid', 'FC Barcelona', 'Manchester United', 'Liverpool FC', 'Manchester City', 'Bayern Munich', 'Juventus FC', 'Inter Milan'];

const TILES = [
  ['/lig', t('Lig & Sezon'), t('Bir maçın skorunu değiştir; tabloyu, Avrupa kontenjanını ve tahmini geliri gör.'), 'table'],
  ['/kupa', t('Kupalar'), t('Şampiyonlar Ligi, Avrupa Ligi, FA Cup… Grup ve eleme sonuçlarını değiştir.'), 'trophy'],
  ['/transfer', t('Transfer'), t('Bir transferi iptal et ya da yeni bir transfer kur.'), 'transfer'],
  ['/simulator', t('Maç oyna'), t('İlk 11’i, dizilişi ve taktiği seç; maçı 2D izle ya da binlerce kez oynat.'), 'sim'],
  ['/haberler', t('Günün haberleri'), t('Her lige o günün sonuçları: kim kazandı, kaç kaç bitti, goller kaçıncı dakikada, kartlar.'), 'news'],
  ['/hocalar', t('Teknik direktörler'), t('Hoca geçmişi ve puanı; “ya şu hoca olsaydı?” senaryosu.'), 'manager'],
  ['/milli', t('Milli Takımlar'), t('1872’den beri Elo, geçmiş maçlarda what-if.'), 'globe'],
];

export async function render(app) {
  const ctx = await boot();
  setCrumbs();
  const idByName = n => Number(Object.keys(ctx.clubs).find(k => ctx.clubs[k].n === n && ctx.clubs[k].c) || 0);
  const popular = POPULAR.map(idByName).filter(Boolean);
  const leagueClubs = Object.entries(ctx.clubs).filter(([, c]) => c.c && ctx.comps[c.c]?.type === 'league' && ctx.comps[c.c].tier === 1).map(([id, c]) => ({ id: +id, name: c.n, key: norm(c.n), comp: ctx.compName(c.c) }));
  const up = (await loadUpcoming()).fixtures.filter(f => f.h > 0 && f.a > 0).slice(0, 5);
  const scs = store.scenarios().slice(0, 4);
  const CH = await loadChanges();
  const KIND = { hoca: t('Teknik direktör'), baskan: t('Başkan'), ceo: t('Genel müdür'), sahip: t('Sahip'), transfer: t('Transfer'), sakat: t('Sakatlık'), mac: tl('Maç', 'Match'), haber: t('haber') };
  const chText = r => feedText(r[1], r[1] === 'mac' ? r[3].replace(/^([A-Z0-9]+):/, (_, c) => `${ctx.comps[c] ? ctx.compName(c) : c}:`) : r[3]);
  const updatedAt = CH.updated ? new Date(CH.updated).toLocaleString(LOC, { dateStyle: 'medium', timeStyle: 'short' }) : null;

  // ---- takım arama
  const results = h('div', { class: 'suggest', role: 'listbox', hidden: true });
  const input = h('input', { type: 'search', class: 'hero-search', placeholder: t('Takımını yaz: Galatasaray, Real Madrid, Liverpool…'), 'aria-label': t('Takım ara'), autocomplete: 'off' });
  const draw = () => {
    const q = norm(input.value).trim();
    const hit = q ? leagueClubs.filter(c => q.split(' ').every(w => c.key.includes(w))).slice(0, 7) : [];
    results.replaceChildren(...hit.map(c => h('a', { class: 'sg', href: u(`/takim/${c.id}`), role: 'option' }, crestFor(ctx, c.id), h('span', null, c.name), h('span', { class: 'dim' }, c.comp))));
    results.hidden = !hit.length;
  };
  input.addEventListener('input', debounce(draw, 60));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = results.querySelector('a'); if (a) a.click(); } });

  const examples = [
    [t('Fenerbahçe 2015/16'), t('Şampiyon olmak için kaç sonucu çevirmek yeterdi?'), u(`/takim/${idByName('Fenerbahce')}/2015`)],
    [t('Liverpool 2018/19'), t('97 puan yetmedi. Hangi maç şampiyonluğu getirirdi?'), u(`/takim/${idByName('Liverpool FC')}/2018`)],
    [t('Bellingham Dortmund’da kalsaydı'), t('Real Madrid ve Dortmund’un sezonu nasıl değişirdi?'), u('/transfer/2023')],
    [t('Barcelona 0-4’ü yemeseydi'), t('Şampiyonlar Ligi 2018/19 yarı finali rövanşı 0-0 bitseydi?'), u('/kupa/CL/2018')],
    [t('Galatasaray – Fenerbahçe'), t('İlk 11’leri sen seç, 100.000 kez oynat.'), u(`/simulator/h=${idByName('Galatasaray')}&a=${idByName('Fenerbahce')}`)],
  ];

  // ---- 3D sahne: penaltı oyunu. Duyurular (GOL! / KURTARDI!) kalenin üstünde çıkar, başlığın üstüne binmez.
  const stage = h('section', { class: 'stage', 'aria-label': t('Etkileşimli penaltı oyunu') });
  const call = h('div', { class: 'stage-call', 'aria-hidden': 'true' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const hudG = h('b', null, '0'), hudS = h('b', null, '0'), hudR = h('b', null, '0');
  const bestEl = h('span', { class: 'hud-best' });
  const touch = matchMedia('(pointer: coarse)').matches;
  const hint = h('div', { class: 'hud-hint' }, touch ? t('Kalede bir noktaya dokun, şutunu çek') : t('Kalede bir noktaya nişan al ve tıkla · köşeler daha zor kurtarılır'));
  const CALLS = { goal: [t('GOL!'), 'goal'], save: [t('KURTARDI!'), 'save'], wood: [t('DİREK!'), 'wood'], miss: [t('AUT!'), 'miss'] };
  let callT = 0;
  const flash = (kind, pos) => {
    const [text, cls] = CALLS[kind] || [kind, ''];
    clearTimeout(callT);
    call.className = 'stage-call'; void call.offsetWidth;
    call.textContent = text; live.textContent = text.replace('!', '');
    if (pos) { call.style.left = `${Math.round(pos.x)}px`; call.style.top = `${Math.round(Math.max(70, pos.y))}px`; call.style.setProperty('--fs', `${Math.round(Math.min(150, Math.max(54, pos.w * 0.09)))}px`); }
    call.className = `stage-call show ${cls}`;
    callT = setTimeout(() => { call.className = 'stage-call'; }, 1700);
  };
  const setBest = b => { bestEl.textContent = b ? t('En iyi seri: {n}', { n: b }) : ''; };
  let api = null;
  const resetBtn = h('button', { class: 'hud-reset', type: 'button', title: t('Skoru sıfırla'), onclick: () => { api?.reset(); hudG.textContent = '0'; hudS.textContent = '0'; hudR.textContent = '0'; } }, t('Sıfırla'));
  stage.append(
    h('div', { class: 'stage-scrim' }),
    h('div', { class: 'stage-hud' },
      h('div', { class: 'hud-score' }, h('div', null, hudG, h('span', null, t('Gol', { n: 2 }))), h('div', null, hudS, h('span', null, t('Şut', { n: 2 }))), h('div', null, hudR, h('span', null, t('Seri')))),
      h('div', { class: 'hud-row' }, bestEl, resetBtn), hint),
    call, live,
    h('div', { class: 'stage-ui' },
      h('h1', null, t('Ya şöyle'), ' ', h('em', null, t('olsaydı?'))),
      h('p', { class: 'lead' }, t('Gerçek futbol tarihinde tek bir maçı, transferi ya da penaltıyı değiştir. Tabloya, kupalara, paraya ve sonraki yıllara etkisini hesapla.')),
      h('div', { class: 'hero-box' }, input, results),
      h('div', { class: 'chips-row' }, h('span', { class: 'cap' }, t('Hızlı seç:')), ...popular.slice(0, 8).map(id => h('a', { class: 'btn sm', href: u(`/takim/${id}`) }, crestFor(ctx, id), ctx.clubName(id).replace(/ Jimnastik Kulübü| FC$/g, ''))))));
  window.__stage?.destroy?.(); window.__stage = null;
  import('../stadium3d.js').then(async m => {
    api = await m.mountStadium(stage, {
      onShot: n => { hudS.textContent = n; },
      onGoal: (n, streak, best, isReset) => { hudG.textContent = n; hudR.textContent = streak; setBest(best); if (!isReset) dispatchEvent(new Event('jf:goal')); },
      onSave: () => { hudR.textContent = '0'; }, onWood: () => { hudR.textContent = '0'; }, onMiss: () => { hudR.textContent = '0'; },
      onCall: flash,
    });
    if (!api) stage.classList.add('nogl'); else { window.__stage = api; setBest(api.best()); }
  }).catch(() => stage.classList.add('nogl'));

  mount(app, stage,
    h('div', { class: 'section-h' }, t('Hazır senaryolar')),
    h('div', { class: 'grid ex-grid' }, examples.map(([ttl, d, href]) => h('a', { class: 'tile ex', href }, h('h3', null, ttl), h('p', null, d), h('span', { class: 'go' }, t('Dene →'))))),
    h('div', { class: 'section-h' }, t('Neler yapabilirsin')),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' },
      TILES.map(([href, ttl, d, ic]) => h('a', { class: 'tile', href: u(href) }, h('span', { class: 'ic', html: icon(ic) }), h('h3', null, ttl), h('p', null, d)))),
    h('div', { class: 'grid cols-2', style: 'margin-top:40px' },
      sheet(t('Yaklaşan maçlar'), up.length ? h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1)' }, up.map(f => h('li', null,
        h('span', { class: 'dim', style: 'width:54px' }, fmtDate(f.date).slice(0, -5)), h('span', { class: 'chip' }, ctx.compName(f.comp)),
        h('span', { style: 'flex:1' }, `${ctx.clubName(f.h)} – ${ctx.clubName(f.a)}`),
        h('a', { class: 'btn sm mk', href: u(`/simulator/h=${f.h}&a=${f.a}`) }, t('Simüle et'))))) : h('div', { class: 'dim' }, t('Yaklaşan maç verisi yok.'))),
      sheet(t('Son güncellemeler'), CH.items.length ? h('div', null, h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1);max-height:340px;overflow:auto' }, CH.items.slice(0, 40).map(r => h('li', null,
        h('span', { class: 'dim', style: 'width:54px' }, fmtDate(r[0]).slice(0, -5)), h('span', { class: 'chip' }, KIND[r[1]] || r[1]),
        r[2] && ctx.clubs[r[2]] ? h('a', { style: 'flex:1', href: u(`/takim/${r[2]}`) }, chText(r)) : h('span', { style: 'flex:1' }, chText(r)))))) : h('div', { class: 'dim' }, t('Henüz kaydedilmiş değişiklik yok. Veri her güncellendiğinde yeni maç sonuçları, transferler, sakatlıklar ve hoca/başkan değişiklikleri burada listelenir.')),
        { actions: [updatedAt ? h('span', { class: 'dim', style: 'font-size:12.5px' }, t('Veri: {d}', { d: updatedAt })) : null] }),
      sheet(t('Senaryolarım'), scs.length
        ? h('ul', { class: 'list-plain', style: 'margin:calc(var(--pad) * -1)' }, scs.map(s => h('li', null,
          h('span', { style: 'flex:1' }, h('b', null, s.name), h('span', { class: 'dim' }, '  ' + t('{n} değişiklik', { n: s.edits.length }))),
          h('button', { class: 'btn sm', onclick: () => { store.setActive(s.id); go('/senaryolar'); } }, t('Aç')))))
        : h('div', { class: 'dim' }, t('İlk değişikliğini yaptığında senaryon burada görünür. Senaryolar geçicidir; site kapanınca silinir.')))));
}
