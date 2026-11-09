// Veri ve yöntem: kaynaklar, lisanslar, hesaplama yöntemlerinin kısa özeti, sınırlar.
import { h, mount, setCrumbs } from '../util.js';
import { pageHead, sheet } from '../ui.js';
import { loadManagers, loadChanges } from '../data.js';
import { t, LOC } from '../i18n.js';

const SOURCES = [
  [t('Transfermarkt veri seti (dcaribou/transfermarkt-datasets)'), t('Maçlar ve hoca adları, oyuncular, piyasa değeri geçmişi, transferler, kulüpler'), t('CC0 (kamu malı); topluluğun herkese açık veri seti. Transfermarkt sitesinden doğrudan veri çekilmez.'), 'https://github.com/dcaribou/transfermarkt-datasets'],
  ['martj42/international_results', t('1872’den beri milli maçlar'), t('CC0'), 'https://github.com/martj42/international_results'],
  ['openfootball/england, jalapic/engsoccerdata', t('2000’den itibaren İngiltere ve diğer ligler'), t('Açık lisans / kamu malı'), 'https://github.com/openfootball'],
  ['Wikidata', t('Başkan, genel müdür, sahip ve hoca dönemleri (başlangıç/bitiş tarihleriyle)'), t('CC0'), 'https://www.wikidata.org'],
  ['Wikimedia Commons', t('Başkan ve hoca fotoğrafları (bağlantı olarak gösterilir, kopyalanmaz)'), t('Fotoğraflar çoğunlukla CC lisanslıdır ve atıf ister; fotoğrafa tıklayınca Commons’taki lisans/yazar sayfası açılır'), 'https://commons.wikimedia.org'],
  [t('ESPN açık JSON API'), t('Güncel sezon sonuçları, maç olayları, kadrolar'), t('Belgesiz API; yalnızca kişisel/tanıtım amaçlı küçük ölçekte kullanılır'), 'https://www.espn.com'],
  ['Fantasy Premier League API', t('Premier League sakatlıkları'), t('Herkese açık API'), 'https://fantasy.premierleague.com'],
  ['TheSportsDB', t('Kulüp armaları'), t('Topluluk veritabanı; armalar sahiplerine aittir'), 'https://www.thesportsdb.com'],
];

export async function render(app) {
  setCrumbs(t('Veri ve yöntem'));
  const [M, CH] = await Promise.all([loadManagers(), loadChanges()]);
  const p = (...c) => h('p', { style: 'max-width:78ch;margin:0 0 10px' }, ...c);
  mount(app,
    pageHead(t('Veri ve yöntem'), t('Neye dayanıyoruz, nasıl hesaplıyoruz, nerede yanılabiliriz.')),
    h('div', { class: 'grid', style: 'gap:18px' },
      sheet(h('h2', null, t('Veri kaynakları')), h('div', { style: 'overflow:auto' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, t('Kaynak')), h('th', null, t('Ne için')), h('th', null, t('Lisans / not')))),
        h('tbody', null, SOURCES.map(([n, w, l, u]) => h('tr', null, h('td', null, h('a', { href: u, target: '_blank', rel: 'noopener' }, n)), h('td', { class: 'dim' }, w), h('td', { class: 'dim' }, l)))))),
        { tight: true }),
      sheet(h('h2', null, t('Takım gücü nasıl hesaplanıyor?')), h('div', null,
        p(h('b', null, t('Oyuncu: ')), t('piyasa değerinin logaritması yetenek ölçüsüdür; genç oyuncunun değeri potansiyeli de içerdiği için yaşa göre düzeltilir. Mevki dışında oynayan oyuncu, mevki uyumu kadar katkı verir (FIFA’daki “mevki dışı” cezası gibi).')),
        p(h('b', null, t('Takım: ')), t('ilk 11’in mevkilere göre ağırlıklı hücum ve savunma kalitesi. Kulübün sezon başı Elo’su gerçek kadronun gücünü taşır; senin değişikliğin yalnızca bunun üstüne FARK olarak eklenir. İlk 11’in ortalama yeteneğinde bir birimlik fark ≈ 170 Elo’dur.')),
        p(h('b', null, t('Kimya: ')), t('FIFA’daki gibi komşu mevkilerdeki oyuncular arasında bağlar kurulur. Bağ gücü; birlikte oynadıkları ay (Transfermarkt kulüp geçmişinden), ortak uyruk ve aynı ligi bilmeleriyle artar. Yeni gelen oyuncu kulübe ~1,5 yılda tam uyum sağlar. Kimyadaki fark ≈ 85 Elo/birim, en fazla ±60 Elo.')),
        p(h('b', null, t('Teknik direktör: ')), t('her hocanın kulüpten bağımsız hücum ve savunma etkisi, kulüp-dönem etkisiyle birlikte tahmin edilen bir istatistik modelinden (ridge regresyon) bulunur; az maçlı hocalar ortalamaya çekilir. Ayrıca hocanın en çok kullandığı diziliş bilinir; farklı dizilişte küçük bir uyum cezası vardır.')),
        p(h('b', null, t('Form: ')), t('güncel sezonda oynanan maçlarla Elo yeniden hesaplanır (sezon içi gelişme); son 6 maçın beklentiye göre puanı ayrıca en fazla ±25 Elo ekler. Oyuncu düzeyinde, sezon gol+asist istatistiği beklentinin üstündeyse yeteneğe küçük bir ek (en çok yaklaşık %10) yazılır.')),
        p(h('b', null, t('Oyun tarzı: ')), t('son iki sezonun maçlarından takımın gol atma ve yeme eğiliminin beklentiden sapması bulunur: hücum ağırlıklı takımın hücumu artar, savunması aynı oranda azalır (toplam güç değişmez). Maçlarında beklenen toplam gol de takıma göre değişir: açık oynayan iki takımın maçı daha golcü olur.')),
        p(h('b', null, t('Sakatlık: ')), t('sakat ya da şüpheli (oynama şansı %50 altı) oyuncu ilk 11’e otomatik alınmaz; yerine en iyi yedek oynar, kadro gücü sağlıklı kadroya göre ölçülür. Şüpheli oyuncuda yedek olasılıkla oynar. Sakatlık verisi yalnızca Premier League için var; diğer ligler için slotta oyuncunun durumunu sen işaretleyebilirsin.')),
        p(h('b', null, t('Sonuç: ')), t('hücum/savunma farkından beklenen gol, buradan Poisson ile skor olasılıkları (ve istenirse 2D canlı maç).')))),
      sheet(h('h2', null, t('Sınırlar')), h('div', null,
        p(t('Piyasa değeri oyun kalitesinin kusurlu bir göstergesidir. Sakatlık verisi yalnızca Premier League için otomatik gelir (ücretsiz ve düzenli bir kaynak başka lig için yok); form maç sonuçlarından, oyun tarzı gol verisinden çıkarılır, topa sahip olma, pres gibi ayrıntılı oyun verisi yoktur. Oyuncu özellikleri (hız, şut gücü gibi FM tarzı nitelikler) ve ruh hâli de modellenmez.')),
        p(t('Güncel piyasa değerleri Transfermarkt veri setinin son güncellemesindendir (Eylül 2026); o tarihten sonraki değer değişimleri yoktur. Yardımcı hocalar, sportif direktör gibi kadro dışı personel verisi yoktur.')),
        p(t('Bu site resmî bir kaynak değildir ve bahis amaçlı kullanılmamalıdır; olasılıklar bir model tahminidir.')))),
      sheet(h('h2', null, t('Güncel durum')), h('div', { class: 'dim' },
        t('Hoca/başkan verisi: {a} · Son güncelleme: {b}. Veri her gece 00.05’te (Türkiye saati) yenilenir.', { a: M.asOf || '—', b: CH.updated ? new Date(CH.updated).toLocaleString(LOC, { dateStyle: 'medium', timeStyle: 'short' }) : '—' })))));
}
