# JinjaGames — jinjagames.com

Stüdyo/yayıncı sitesi. Tek dosyalık statik site (harici bağımlılık yok), GitHub Pages + özel domain ile yayınlanır.

## Tasarım sistemi

Dört sayfa aynı iskeleti paylaşır — aynı nav, aynı bölüm ritmi, aynı
`jg_lang` / `jg_theme` anahtarları, aynı açık/koyu mantığı — ama her biri
kendi dünyasının yüzeyini kullanır. Ortak olan yapı, farklı olan ten:

| Sayfa | His | Başlık | Gövde | Etiket | Vurgu |
|---|---|---|---|---|---|
| Ana sayfa | Editöryel stüdyo | Space Grotesk | Inter | JetBrains Mono | Kırmızı `#C42B2B` |
| Cyber Academy | Terminal, gece | JetBrains Mono | Inter | JetBrains Mono | Camgöbeği |
| Locard | Dosya / gizem | Playfair Display | Inter | Courier Prime | Damga kırmızısı |
| DayPot | Sakin mutfak | Fraunces | Nunito | Nunito | Orman yeşili |
| Jelly Trails | Pastel jöle | Fraunces | Nunito | Nunito | Mor `#7A4FD6` |
| Jelly Pipes | Pastel su camı | Fraunces | Nunito | Nunito | Mavi `#1C7FB8` |
| Jelly Jars | Bal rengi raf | Fraunces | Nunito | Nunito | Kehribar `#B8470A` |
| Jelly Logic | Kitaplık, lavanta | Fraunces | Nunito | Nunito | İndigo `#5A47C9` |
| Jelly Loops | Boncuk ve ip | Fraunces | Nunito | Nunito | Gül `#C2306F` |
| Jelly Park | Şeker yolu | Fraunces | Nunito | Nunito | Kırmızı `#D1342F` |
| Jelly Seek | Çimen, şeker | Fraunces | Nunito | Nunito | Yeşil `#1A7F4F` |
| Jelly Slide | Buz, kar | Fraunces | Nunito | Nunito | Kobalt `#3560D8` |

Locard'ın açık teması sararmış dosya kâğıdı, koyu teması gece bürosudur;
ikisi de aynı ölçüleri kullanır. DayPot yuvarlak köşe ve geniş satır aralığı
kullanır, keskin çizgi yoktur. Ana sayfada üç projenin başlığı kendi
sayfasının yazı tipiyle yazılır, böylece fark okumadan önce hissedilir.

**Renk kuralı:** hiçbir bileşen sabit renk yazmaz, hepsi `:root` belirteçlerinden
gelir. Metin/zemin çiftleri WCAG AA eşiğine (küçük metin 4.5, büyük metin 3.0)
göre seçilmiştir; yeni bir renk eklerken bu kontrol tekrarlanmalı.

## Yazı tipleri

`assets/fonts/` altında woff2 olarak depoda durur, `assets/fonts.css` ile
tanımlanır. **Google Fonts ya da başka bir CDN kullanılmaz:** sitede üçüncü
taraf isteği yoktur ve gizlilik metni bunu söyler. `unicode-range` sayesinde
tarayıcı yalnız gereken dilimi indirir; Türkçe karakterler (ğ ş İ) `latin-ext`
dilimindedir, o yüzden yeni bir aile eklenirken latin-ext sürümü de indirilmeli.

Aileler: Inter, Space Grotesk, JetBrains Mono, Playfair Display, Courier Prime,
Fraunces, Nunito. Hepsi açık lisanslıdır (SIL OFL).

## Dosyalar
Her sayfa kendi CSS ve JS'ini içinde taşır; harici bağımlılık yoktur.

- `index.html` — ana sayfa (hero, üç projelik derli toplu kart vitrini, stüdyo, SSS, iletişim).
  Ayrıntı ana sayfada değil `games/` sayfasında; ana sayfa yalnız kapı.
- `games/index.html` — oyunlar merkezi (jinjagames.com/games/): filtrelenebilir oyun satırları,
  karşılaştırma tablosu ve BaneBender wikisine açılan kapı. Oyun sayfalarının adresleri
  (`/cyberacademy/`, `/locard/`, `/daypot/`) bilerek TAŞINMADI: Steam, Play Console ve dış
  bağlantılar bu adreslere bakıyor.
- `banebender/` — kardeşimin (BaneBender) Minecraft mod wikisi. Sitenin geri kalanıyla
  bilerek ortak tasarım dili yok;
  ana sayfadaki menüden (BaneBender), SSS'nin üstündeki kapıdan ve `games/` sayfasından girilir. Ayrıntı aşağıda, "BaneBender wikisi".
- `assets/fonts.css` + `assets/fonts/` — yazı tipleri; her sayfa bunu bağlar.
- `cyberacademy/index.html` — Cyber Academy tanıtım sayfası. Fragman `cyberacademy/media/darknet-trailer.mp4`
  (kaynak: `steam_cyberacademy/steam_darknet_trailer/DarkNet_Trailer_EN_final.mp4`, web için yeniden
  sıkıştırıldı), kısa sessiz döngü `darknet-loop.mp4` ana sayfa ve oyunlar kartında; ekran
  görüntüleri `cyberacademy/img/` (WebP).
- `locard/index.html` — Locard tanıtım sayfası (`locard-og.jpg` paylaşım görseli,
  `locard/img/` oyun içi kareler ve kapak sahnesi, WebP). Sayfada etkileşimli delil
  panosu, fragman (`locard/media/locard-trailer.mp4`, kaynak `steam_locard/06_Fragman/Locard_Gameplay_Trailer_16x9.mp4`;
  spoiler içermiyor), galeri, sekmeli sistem listesi ve birlikte oynama bölümü var.
- `assets/steam.js` — **Locard Steam anahtarı.** Mağaza sayfası açılınca değiştirilecek tek
  yer burası (aşağıya bak). Hem `locard/` hem ana sayfa bunu okur.
- `daypot/index.html` — DayPot tanıtım sayfası; görseller `daypot/img/`.
- `daypot/gizlilik/index.html` — DayPot gizlilik politikası (TR + EN), `https://jinjagames.com/daypot/gizlilik/`.
  Eski `daypot/gizlilik.html` adresi uygulamada/Play Console'da kayıtlı olabileceği için silinmedi;
  yeni adrese yönlendiriyor. Uygulamadaki `privacyPolicyUrl` yeni adrese çevrilebilir.
- `privacy/index.html` — site gizlilik politikası (jinjagames.com/privacy/). Eski `privacy.html` yönlendirmedir.
- `jellytrails/privacy/`, `jellypipes/privacy/` — Jelly Trails ve Jelly Pipes gizlilik politikaları
  (Play Console'a girilecek adresler: `https://jinjagames.com/jellytrails/privacy/` ve
  `https://jinjagames.com/jellypipes/privacy/`). Oyun sayfalarından ve ana sayfa altbilgisinden
  bağlanır; site haritasında yok, `noindex`. `tools/make_jelly_privacy.py` ile üretilir;
  metin oyunların kodundan çıkarıldı (AdMob, Google Play satın alma, veriler cihazda). Oyunlara
  Firebase, çökme raporu ya da rıza formu eklenirse betikteki metin güncellenip yeniden çalıştırılmalı.
- `jellytrails/index.html`, `jellypipes/index.html` — Jelly Trails ve Jelly Pipes oyun sayfaları
  (`https://jinjagames.com/jellytrails/`, `/jellypipes/`). Her biri kendine özgü ve oynanabilir: Trails'te sayfanın
  içinde gerçekten oynanan bir renk bağlama bulmacası, Pipes'ta anında üretilen, akan sulu bir boru bulmacası;
  ikisinde de hero'da kendiliğinden oynayan bir gösterim, oyunun kendi çizim ve açıklamalarıyla mekanik
  laboratuvarı (yalnız oyunda GERÇEKTEN bulunanlar: Trails 11, Pipes 12; kaynak `puzzle_core/level.dart`
  `_flowMechanics` / `_pipesMechanics`) ve galeri. Demo kuralları oyunun kodundan alındı: Trails'te kesilen
  renk tamamen başa döner, yarım bırakılan yol geri çekilip silinir; Pipes'ta su yalnız çiçeğe giden yolda akar. **Tek kaynak `tools/jelly_pages/`:** `trails.html` / `pipes.html` sayfaya özel
  yerleşim+CSS+demo, `base.css`/`base.js` ortak iskelet, `build.py` birleştirir. Sırayla:
  `extract_strings.py` (oyunun l10n dosyasından metin), `prep_assets.py` (çizimler `Puzzles/apps/*/assets/art`
  ve `Puzzles/store` altından `<oyun>/img/` içine), `gen_trails_puzzles.py` (tek çözümlü demo bulmacaları, bir kez),
  `build.py`. Sayfaları elle değil bu betiklerle değiştir. Oyunlar `games/` listesinde 04/05, ana sayfada 04/05
  paneli olarak yer alır. Google Play bağlantısı yayına çıkınca `build.py` içindeki `PLAY_URL` sözlüğüne yazılıp
  çalıştırılır (şimdilik "Yakında" rozeti).
- `jellyjars/`, `jellylogic/`, `jellyloops/`, `jellypark/`, `jellyseek/`, `jellyslide/` — altı yeni Jelly oyununun sayfaları
  (`https://jinjagames.com/<ad>/`), her biri kendi oynanabilir demosuyla: Jars'ta dök ve ayır, Logic'te 4x4/6x6 sudoku (karşılaştırma,
  tek-çift, çapraz), Loops'ta halka çiz + köprü kur, Park'ta arabaları çıkar (koni, otobüs, numaralı), Seek'te tahminsiz arama (fener,
  dürbün), Slide'da buzda kayan penguen (kaya, kar yığını, balık, ışınlanma). Demo kuralları oyunların kodundan (`puzzle_core`) alındı;
  bulmacalar `gen_new_puzzles.py` ile çözücüyle doğrulanarak üretilir (Logic/Loops tek çözümlü, Seek tahminsiz, diğerleri çözülebilir).
  **Tek kaynak `tools/jelly_pages/`:** `game.html` ortak iskelet, `g_<ad>.txt` oyuna özgü CSS + hero sahnesi + demo (`@@@ BÖLÜM` ile ayrılmış),
  `build_new.py` oyun metinleri/renkleri/mekanik listesi ve derleme. Sırayla: `extract_new.py` (oyun metinleri), `prep_new.py` (çizimler ve
  mağaza görselleri; Slide'ın mağaza ekran görüntüsü olmadığı için galerisi oyunun dünya arka planlarıdır), `gen_new_puzzles.py` (bir kez),
  `build_new.py [ad]`. Uygulamalar gizlilik ve silme adreslerini `https://jinjagames.com/<ad>/privacy/` ve `/delete/` olarak açar;
  ikisi `tools/make_jelly_legal.py` ile üretilir (Trails ve Pipes dahil 8 oyun için; Firebase hesap/yedek, AdMob + UMP, yaş kapısı, Analytics/Crashlytics, Google Play satın alma,
  uygulama içinden hesap silme). Oyunlara yeni bir veri işleyen hizmet eklenirse o betikteki metin güncellenip yeniden çalıştırılmalı.
  Play bağlantısı `build_new.py` içindeki `PLAY_URL`'ye yazılır. Ana sayfa ve `games/` değişiklikleri `tools/patch_home_jelly.py` ve
  `tools/patch_games_jelly.py` ile, ikinci tur düzen (Mobil = Jelly oyunları + Uygulamalar, 3B kart halkası `assets/games3d.js`, DayPot en sonda) `tools/patch_home_v2.py` ve `tools/patch_games_v2.py` ile (bir kez) yapıldı; sonrası elle düzenlenir.
- Ana sayfa hero'su sayfalıdır: JinjaGames → Cyber Academy → Locard → Jelly Trails → Pipes → Jars → Logic → Loops → Park → Seek → Slide → DayPot → başa.
  Yeni oyun eklerken `index.html` içindeki `.slide` listesine bir sayfa, `assets/home3d.js` içine bir parçacık biçimi
  ekle (`data-shape` adı eşleşmeli; Jelly oyunlarının biçimleri kavanoz, sudoku tablosu, ip halkası, araba, büyüteç, kar tanesi). `home3d.js` değişince `index.html`'deki `?v=` sürümünü artır.
- BaneBender yorumları: `tools/update_stats.py` sayılarla birlikte her modun CurseForge yorumlarını
  (`https://www.curseforge.com/api/v1/mods/<id>/comments`, anahtar gerekmez) `banebender/data/comments.js`'e yazar;
  GitHub Actions bunu 6 saatte bir çalıştırıp commit'ler. Mod sayfasında "CurseForge yorumları" bölümü olarak görünür.
  Yeni mod eklerken: jar elindeyse `BB_ONLY=<slug> python tools/build_banebender.py` (JARS listesine ekle), yoksa
  `python tools/add_cf_mod.py <slug> <logo>`; sonra metni `banebender/data/mods.js`'e yaz. Sayfadaki mod sayısı veriden gelir.
- **Adreslerde `.html` yok:** her sayfa klasör adresiyle açılır (`/privacy/`, `/daypot/gizlilik/`).
- `sitemap.xml`, `robots.txt` — yeni sayfa eklenince sitemap da güncellenmeli.
- `CNAME` — özel domain (`jinjagames.com`); GitHub Pages bunu okur.

## Bilinen tuzaklar

Bu sitede iki kez ısırdılar, üçüncüsü olmasın diye buraya yazıyoruz:

- **`overflow-x:hidden` hem `html` hem `body` üzerinde olursa ikisi de ayrı bir
  kaydırma kabı olur** ve içerik gövdeden taşarsa sayfada iki dikey kaydırma
  çubuğu belirir. Doğrusu `overflow-x:clip` (kap oluşturmaz, `overflow-y`
  görünür kalır); `hidden` yalnız eski tarayıcılar için yedek olarak önce yazılır.
- **Etiket adıyla seçici yazarken dikkat:** `nav { position:fixed }` kuralı üst
  barı değil, sayfadaki her `<nav>` etiketini yakalar. Breadcrumb da bir `<nav>`
  olduğu için ekranın tepesine yapışıp üst barın altında kaybolmuştu. Üst bar
  her sayfada `nav#nav` ile seçilir.
- **`<img>` üzerinde `width`/`height` özniteliği varsa CSS'te `height:auto`
  şart.** Yoksa CSS genişliği daraltırken yükseklik öznitelikte kalır ve görsel
  ezilir. Temel `img` kuralı bunu taşır; bir görsele özel yükseklik verilecekse
  daha özgül bir seçiciyle verilir.
- **Telefonda dokunma hedefi** en az 44 piksel olmalı. Küçük bağlantılarda
  (breadcrumb, alt bilgi) düzeni bozmamak için görünmez bir `::after` katmanı
  kullanılıyor: `content:"";position:absolute;left:0;right:0;top:50%;height:44px`.
- **Dar ekranda marka yazısı** geri bağlantısının üstüne binebiliyor. Alt
  sayfalarda `.brand span` 680 pikselin altında gizleniyor (Cyber Academy'nin
  marka metni span içinde olmadığı için orada geri bağlantısı gizleniyor).
- **Etiket tipografisi** telefonda 12 pikselin altına inmemeli; masaüstünde
  10-11 piksel duran mono etiketler dar ekranda büyütülüyor.
- **Süs lekeleri** (`section.blk::before` gibi) bölümden taşacak şekilde
  konumlanıyor. Son bölümdekinin aşağı sarkması sayfanın altına boş alan ekler;
  son bölümde leke yukarı alınır.

- **`<nav>` etiketini üst bar dışında kullanma.** Ana sayfadaki `nav{position:fixed}` kuralı
  her `<nav>`'ı yakalar; telefondaki alt gezinme çubuğu bu yüzden `div role="navigation"`.

## BaneBender: 6 saatte bir otomatik sayı güncellemesi

- `.github/workflows/curseforge-stats.yml` **6 saatte bir** (Türkiye saatiyle 00.00, 06.00, 12.00, 18.00) çalışır;
  Actions sekmesinden "Run workflow" ile elle de çalıştırılabilir.
- `tools/update_stats.py` CurseForge'dan indirme sayılarını çeker ve yalnız
  `banebender/data/stats.js` dosyasını yazar. Wiki bu dosya varsa `mods.js`'teki elle yazılmış
  sayıların yerine onu kullanır. Sayı değişmediyse dosyaya dokunmaz, boş commit atılmaz.
- Profilde wikide sayfası olmayan bir mod görülürse bir GitHub issue açılır ("yeni mod … için sayfa
  yazılmalı"). Sayfanın kendisi elle yazılır; sayısı ise o gece itibarıyla zaten izlenir.
- Kaynak sırası: `CF_API_KEY` sırrı varsa CurseForge resmî API'si → profil sayfası →
  api.cfwidget.com. CurseForge profil sayfası Cloudflare arkasında ve bazen otomatik istekleri
  engelliyor; **en sağlam yol ücretsiz bir API anahtarı** almak (console.curseforge.com) ve onu
  Repo > Settings > Secrets and variables > Actions altına `CF_API_KEY` adıyla eklemek.
- Yayın ve son güncelleme tarihleri de `stats.js`'e yazılır (wikideki "En yeni" ve "Son güncellenen"
  sıralaması bunları kullanır). API yoksa tarihler günde bir kez proje sayfalarından tazelenir.
- Hiçbir kaynak cevap vermezse iş başarısız sayılmaz; site bir önceki sayılarla devam eder.
- GitHub, 60 gün boyunca hiç commit almayan depolarda zamanlanmış işleri kendiliğinden durdurur;
  bu iş her gün commit atmayabileceği için uzun sessiz dönemlerden sonra Actions sekmesinden
  yeniden etkinleştirmek gerekebilir.

## Canlı katmanlar

- Ana sayfa hero'su: `assets/home3d.js`, üç dünyanın biçimleri (küp, parmak izi, tencere)
  arasında dönüşen parçacık bulutu; hero listesindeki adların üzerine gelince biçim değişir.
  Renkleri temadan (`--brand`, `--w-cyber` …) okur.
- Ana sayfa "Yaptıklarımız": yan yana üç panel; üzerine gelinen açılır. Telefonda alt alta.
- Cyber Academy: hero'da canlı ağ animasyonu ve yazı yazan terminal, "Karanlık Ağ'da bir
  operasyon" adımları (kareler `cyberacademy/img/run/`, Karanlık Ağ fragmanından), imleci
  izleyen kart ışığı, sayan rakamlar. Hepsi `prefers-reduced-motion` açıkken durur.

## Siteyi bilgisayarda açmak

`index.html` çift tıklanarak (sunucusuz, `file://`) açılabilir. Bu durumda klasör
bağlantıları (`cyberacademy/`, `../`) tarayıcıda klasör listesi açardı; her sayfanın
`<head>`'indeki `assets/local-links.js` yalnız `file://` altında bu bağlantıların sonuna
`index.html` ekler, yayındaki sitede hiçbir şey yapmaz. Yeni sayfa eklenince bu betik de bağlanmalı.

## Telefonda gezinme

Sağ üstteki üç çizgili menü kaldırıldı. 1060 pikselin altında ana sayfada ve `games/`
sayfasında ekranın altında yüzen bir çubuk (`.dock`) var: Oyunlar · Stüdyo · SSS · İletişim.
Bulunulan bölüm çubukta yanar. Dil ve tema düğmeleri sağ üstte kalır. Çubuk içeriğin
üstüne binmesin diye `body` altına çubuk kadar boşluk alır.

## BaneBender wikisi

- `banebender/index.html` iskelet, `app.css` görünüm, `app.js` arayüz ve mod sayfaları
  (adres çubuğunda # görünmez; mod sayfaları geçmişe adres değiştirmeden yazılır, geri tuşu çalışır), `scene.js` hero'daki 3B voksel ada.
- `assets/vendor/three.min.js` — three.js r149 (MIT; hem ana sayfa hem wiki kullanır), klasik betik olarak yerel kopya
  (ES modülü değil; modüller dosyadan açınca yüklenmiyor). Dönen eşya simgeleri
  `banebender/data/hero-sprites.js` içinde veri URI'si. Sitede
  üçüncü taraf isteği olmaması kuralı burada da geçerli.
- `assets/fonts/pixelify-sans-var.woff2` — Pixelify Sans (SIL OFL), Türkçe karakterleri içerir.
- `banebender/data/mods.js` — **elle yazılmış içerik** (İngilizce + Türkçe). Kaynak yalnızca
  modların CurseForge açıklamaları ve modların kendi dosyaları; açıklamada olmayan bir
  özellik yazılmaz. İndirme sayıları 12 Ekim 2026 tarihli; güncellenirken tarih de değişmeli.
- `banebender/data/generated.js` + `banebender/img/<slug>/` — **otomatik üretilir**:
  `tools/build_banebender.py`, mod jar dosyalarından (dil dosyaları, dokular) eşya adlarını,
  sprite atlaslarını (`items.png`), yaratık/yapı/büyü listelerini ve logodan vurgu rengini çıkarır.
  CurseForge logo ve galeri görselleri `$CF_CACHE_PARENT/dl/<slug>/` altında beklenir.
- Yeni mod eklenince: jar'ı CurseForge örneğine kur, `build_banebender.py` içindeki `JARS`
  listesine ekle, betiği çalıştır, sonra `mods.js`'e o modun metnini yaz.
- Bilinen tuzak: Frontier Structures'ın `tr_tr.json` dosyasında bazı adlar çift kodlanmış
  (Ã¼ gibi). Betik bunu düzeltiyor (`fix()`); asıl düzeltme modun kendisinde yapılmalı.
- YouTube videosu (Chest Hauler) tıklanana kadar yüklenmez, tıklanınca youtube-nocookie.com
  açılır; gizlilik sayfası bunu söylüyor.

- **Önbellek:** GitHub Pages CSS/JS dosyalarını tarayıcıda 10 dakika önbellekte tutar; yeni
  HTML eski CSS ile birleşince (örneğin wiki logosu ve yükleme bloğu görünmüyordu) sayfa
  bozuk görünür. Bu yüzden bütün `.css`/`.js` bağlantılarının sonunda `?v=20261012d` var.
  CSS ya da JS değiştiğinde bu değeri bütün sayfalarda birlikte artır (tek sed komutu yeter).

- **Metin seçme kapalı:** `assets/fonts.css` sonundaki kural sitedeki metinlerin seçilip
  kopyalanmasını kapatır (arama kutusu ve form alanları hariç). Her sayfa bu dosyayı bağladığı için
  kural tek yerde.

## Yazı kuralları

- **Sitede uzun tire (—), kısa tire (–) ve kelime içi tire kullanılmaz.** Cümle
  tireyle bölünecekse yeniden yazılır; "co-op", "low-poly", "e-posta" gibi
  yazımlardan da kaçınılır ("birlikte", "low poly", "mail adresi").
- Ayırıcı gerektiğinde nokta, virgül, iki nokta, noktalı virgül ya da orta
  nokta (·) kullanılır.
- Her cümlenin Türkçesi ve İngilizcesi `class="tr"` / `class="en"` çiftiyle
  yan yana durur; satır içi kullanımda `i` sınıfı eklenir.

## Locard: Steam sayfası açılınca

**Mağaza sayfası yayında (Ekim 2026):** `assets/steam.js` içinde `live:true`. `live:false`
yapılırsa sitede "Steam sayfası yakında" görünür ve istek listesi düğmeleri gizlenir.
Başka bir oyun için aynı düzen gerekirse adımlar şunlardı:

1. `live:true` yap (ya da `liveAt:'2026-10-09T17:00:00Z'` gibi bir an yaz; o andan sonra
   site kendiliğinden açılır, elle müdahale gerekmez), commit + push.
2. Bağlantı `https://store.steampowered.com/app/5296440/Locard/` adresine gider. Uygulama
   kimliğini (5296440) Steamworks panelinden bir kez daha teyit et.

Canlı modda: Locard sayfasında hero düğmesi, üst bar düğmesi, telefondaki alt çubuk ve
kapanış bölümü "Steam'de istek listesine ekle" olur; ana sayfadaki kartta ek bağlantı belirir.

Hero sahnesindeki yazı görselden silinip sayfada canlı yazı olarak basılır (oyunun kendi
Spartan SemiBold yazı tipi, yalnız L O C A R D alt kümesi: `assets/fonts/spartan-semibold-locard.woff`).
Kaynak sahne: `steam_locard/90_Uretim_Kaynaklari/main.png`.

## Yeni proje sayfası eklerken
1. Sayfayı `<proje>/index.html` olarak aç; `locard/index.html` iyi bir iskelet.
   Site içi bağlantılarda dosya adı yerine klasör adresini (`/locard/`, `/daypot/`, `/cyberacademy/`) kullan; ana sayfa için `/` kullan.
2. Ana sayfada `.world` satırı ekle (kendi `--accent` deri sınıfıyla) ve alt bilgideki "İşler" sütununa bağlantı koy.
3. `sitemap.xml` ve `index.html` içindeki JSON-LD `@graph` listesini güncelle.

## Tanıtım videosu ekleme
`index.html` içinde `<div class="video" id="video">…</div>` bloğunu bul ve şununla değiştir:

```html
<video src="trailer.mp4" controls poster="poster.jpg" style="width:100%;aspect-ratio:16/9;display:block"></video>
```

`trailer.mp4` (ve istersen `poster.jpg`) dosyasını bu klasöre koy. Alternatif: YouTube'a yükleyip
`<iframe>` gömebilirsin.

## Yayınlama (GitHub Pages)
1. GitHub'da **public** repo aç: `JinjaGames` (ya da `jinjagames.com`).
2. Bu klasördeki dosyaları yükle (web arayüzü: *Add file → Upload files*, ya da git).
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → Save.
4. Aynı sayfada **Custom domain**: `jinjagames.com` → Save. Doğrulanınca *Enforce HTTPS* aktifleşir.

### Git ile
```bash
cd C:/Users/user/Desktop/JinjaGames
git init
git add .
git commit -m "JinjaGames site"
git branch -M main
git remote add origin https://github.com/<kullanıcı-adın>/JinjaGames.git
git push -u origin main
```

## DNS (domain sağlayıcında)
Apex (kök) domain için **A** kayıtları, `www` için **CNAME**:

**A kayıtları** — host `@`:
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
**CNAME** — host `www` → değer: `<kullanıcı-adın>.github.io`

DNS yayılması 10 dk – 24 saat sürebilir.

## Yapılacaklar
- [x] Locard: Steam mağaza sayfası açıldı, `assets/steam.js` içinde `live:true`.
- [ ] Locard: Steam sayfası şu an yalnız Windows ve yalnız Türkçe listeliyor; site de böyle
      diyor ("macOS planlanıyor", "İngilizce planlanıyor"). Steam'e Mac derlemesi ya da İngilizce
      eklenince künye şeridi, "Henüz değil" listesi, ana sayfa kartı, `games/` sayfası ve
      JSON-LD (`gamePlatform`, `inLanguage`) birlikte güncellenmeli.
- [ ] Locard sayfasındaki rakamlar (10 mekân, 18 karakter, 64 kayıt, 7 son) ve "Erken Erişim ·
      Q1 2027" ibaresi Steam mağaza metniyle birebir aynı olmalı. Çıkış tarihi kesinleşince ya da
      mağaza "yakında" yerine tarih gösterirse `locard/index.html` künyesi güncellenmeli.
- [ ] Cyber Academy 11 Eylül 2026'da Steam Erken Erişime çıktı; site "istek listesi" yerine
      "Steam'de al" diyor. Modül sayısı sitede "25 modül planlanıyor, ilkleri oynanabilir"
      olarak yazılı; yeni modüller duyurulunca kesin sayı yazılabilir. Steam'deki Erken Erişim
      SSS'si hâlâ "25+ modules … English + Turkish" diyor, mağazadaki dil listesi 23 dil; oyun
      ise 25 arayüz dili taşıyor. Steamworks'teki bu metinler güncellenmeli (site doğru olanı söylüyor).
- [ ] DayPot tarif sayısı sayfada "250+" olarak yazılıyor; katalog büyüdükçe bu eşik
      güncellenebilir (ana sayfadaki rakam satırı ve DayPot sayfası).
- [x] Locard: oynanış fragmanı eklendi, galeri 7 kare. `Locard_Bolum01_Senaryo.mp4` katili
      açıkladığı için siteye konmaz.
- [ ] DayPot: Play yayını açılınca "Yakında Google Play'de" durumu mağaza rozetiyle
      değiştirilecek; mağaza ekran görüntüleri alınınca sayfaya galeri eklenebilir.
- [ ] DayPot: gizlilik politikasındaki tarih, yayın gününde güncellensin.
- [ ] Jelly Jars / Logic / Loops / Park / Seek / Slide: Play yayını açılınca `tools/jelly_pages/build_new.py` içindeki `PLAY_URL` doldurulup betik çalıştırılsın; `games/` kartlarındaki "Yayın hazırlığında" durumu ve ana sayfadaki kartlar elle güncellensin. Slide için mağaza ekran görüntüsü alınınca `prep_new.py` içindeki `shots` listesi ekran görüntülerine çevrilebilir.
- [x] Jelly Trails / Pipes gizlilik ve silme sayfaları `make_jelly_legal.py` ile 8 oyun için aynı metinde üretiliyor (`make_jelly_privacy.py` yalnız şablon kaynağı).
- [ ] Jelly Trails / Jelly Pipes: Play yayını açılınca `tools/jelly_pages/build.py` içindeki `PLAY_URL` doldurulup betik çalıştırılsın; `games/` kartlarındaki "Yayın hazırlığında" durumu ve ana sayfadaki "Google Play yakında" etiketi güncellensin. Mağaza ekran görüntüleri değişirse betik görselleri `Puzzles/store`'dan yeniden üretir.

## Web uygulamaları (`/apps/`)

Tarayıcıda kurulumsuz çalışan işler. Ana menüde **Web Apps / Web Uygulamaları** açılır menüsü
(`assets/webapps.css` + `assets/webapps.js`, ana sayfa ve `games/` sayfasında; telefonda alt çubukta "Apps")
ve tümünü listeleyen `apps/index.html` vardır. Yeni bir web uygulaması eklerken üç yere yazılır:
`index.html` ve `games/index.html` içindeki `.apps-pop` listesi, `apps/index.html` kartları, `sitemap.xml`.
Simgeler `assets/img/apps/` altındadır.

- `/football/` — Jinja Football (aşağıda). Logo `football/js/logo.js` (shuriken + top); `assets/img/apps/football.svg` aynı koddan üretilir.
- `/peer/` — JinjaPeer web istemcisi (masaüstü/Android uygulamasıyla aynı protokol).

### Jinja Football (eski adı What If Football): adresler `#` içermez

**Dil (TR/EN):** `football/js/i18n.js` — `t('Türkçe metin', {param})`; anahtar Türkçe kaynak metindir, İngilizce karşılıklar `football/js/i18n/en-*.js` içinde (yalnızca EN modunda yüklenir). Tercih sitenin `jg_lang` anahtarında; değişince sayfa yenilenir. Veri tarafındaki Türkçe metinler (`competitions.json`, haber/değişiklik satırları) `data.js` ve `i18n-data.js` içinde çevrilir. Denetim: `node tools/football/check_i18n.mjs` (eksik çeviri, çakışma, çevrilmemiş görünen metin).

- Adresler temizdir: `/football/takim/36/2015`, `/football/haberler/2026-11-07`. `football/index.html`
  `<base href="/football/">` taşır; uygulama içi bağlantılar `u('/takim/36')` ile yazılır, programla gezinme
  `go(path)` ile yapılır (`js/util.js`). Adresi yeniden çizmeden değiştirmek için `go(path, { replace: true, silent: true })`.
- GitHub Pages'te SPA yedeği yoktur: derin bir adres `404.html`'e düşer, o da `/football/?r=<yol>`'a yönlendirir,
  `js/main.js` adresi eski haline getirir. Eski `#/…` bağlantıları (köke düşenler dahil) otomatik çevrilir.
- Yerelde Pages gibi denemek için: `python tools/dev_server.py 8080` → `http://localhost:8080/football/`.
- **Senaryolar geçicidir:** `sessionStorage`'da durur; sayfa yenilenince kalır, sekme/site kapanınca silinir.
  Saklamak isteyen bağlantıyı kopyalar ya da dosya olarak dışa aktarır. Eski sürümün `localStorage` kaydı silinir.
- Üçüncü taraf isteği yok: Three.js `football/vendor/` altında, yazı tipleri (Barlow Condensed dahil) `assets/fonts/`'tan.
  (Arma ve oyuncu fotoğrafları hâlâ Transfermarkt/ESPN görsel adreslerinden gelir.)
- Ana sayfadaki penaltı oyunu `js/stadium3d.js`: gerçek ölçüler (metre), kaleye nişan alınır; kalecinin
  çarpışma çizgisi çizilen pozla aynı veriden hesaplanır. Duyurular (GOL!/KURTARDI!) kalenin ekrandaki yerine
  konur; geniş ekranda kamera kaleyi sağa kaydırır, telefonda içerik sahnenin altına iner.
- Üst menü sığmayan bağlantıları ölçerek "Daha fazla"ya taşır; telefonda alt çubuk 4 sekme + Menü.

### JinjaPeer web (`/peer/`)

- `peer/index.html` + `app.js` (arayüz), `session.js` (WebRTC), `transfer.js` (aktarım), `core.js` (kodlar, kripto,
  çerçeveler, dosya adı temizliği), `i18n.js` (TR/EN). Masaüstü/Android uygulamasıyla **aynı protokol (v1)**:
  web ↔ Windows ↔ Android, her iki yönde, davet eden ya da katılan olarak.
- Kripto kütüphaneleri `peer/vendor/` altında, yerelde (@noble curves/ciphers/hashes, qrcode-generator; lisanslar yanında).
  Sıkı CSP var; tek dış bağlantı WebRTC'nin STUN sorgusu (Google, Cloudflare). Gizlilik sayfası bunu söyler.
- Dart uygulamasıyla uyumluluk testi JinjaPeer deposunda: `node --test tool/web_vectors/interop_test.mjs`
  (`bridge.dart` uygulamanın gerçek `lib/core` kodunu çalıştırır; 11 test).
- Dosya değişince `index.html`'deki `?v=` sürümünü artır.

### Formalar ve Kramponlar (rafa kaldırıldı, 2026-11-08)

Gerçek ürün fotoğrafları yalnızca affiliate ürün feed'leriyle ücretsiz ve izinli gelebildiği için bölüm yayından
kaldırıldı. Kod ve veri `git stash list` içinde "kits-boots shelved" adıyla duruyor; geri almak için
`git stash apply` (stash'in numarasıyla) ve `football/js/main.js` içine rotaları geri ekle.

### Humanizer web (rafa kaldırıldı, 2026-11-08)

Tarayıcıda çalışabilen küçük modeller yeterli kaliteyi vermediği için yayından kaldırıldı. Kod `git stash list` içinde
"humanizer-web shelved" adıyla duruyor.
