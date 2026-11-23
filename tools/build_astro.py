# JinjaAstro sayfalarını ortak başlık ve alt bilgiyle üretir. Kullanım: python tools/build_astro.py
# Her sayfa astro/<yol>/index.html olarak yazılır; sayfanın JavaScript'i astro/js/pages/<ad>.js.
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "astro"
V = "9"
NAV = [("", "Ana sayfa"), ("chart/", "Doğum haritası"), ("weekly/", "Haftalık"), ("monthly/", "Aylık"), ("compatibility/", "Uyum"), ("signs/", "Burçlar"), ("sky/", "Gökyüzü")]

NOTES = """
<details class="notes glass">
  <summary>Bilmen gerekenler</summary>
  <ul>
    <li><b>Eğlence ve kendini tanıma amaçlıdır.</b> Buradaki yorumlar sağlık, para ya da hukuk konularında karar vermek için bir dayanak değildir.</li>
    <li><b>Hesaplar gerçek gökyüzü verisiyle yapılır.</b> Tropikal zodyak ve Placidus ev sistemi kullanılır; kutup bölgelerine yakın doğumlarda eşit evlere geçilir.</li>
    <li><b>Doğum saati önemli.</b> Yükselen burç yaklaşık iki saatte bir değişir. Saatin yoksa güneş ve ay burcun yine doğru çıkar, yükselen ve evler gösterilmez.</li>
    <li><b>Saat dilimi otomatik hesaplanır.</b> Seçtiğin ülke ve tarihe göre yaz saati de dikkate alınır; çok eski tarihlerde gerekirse elle düzeltebilirsin.</li>
    <li><b>Bilgilerin cihazından çıkmaz.</b> Hesaplar tarayıcında yapılır; kaydettiğin haritalar yalnızca bu cihazda saklanır.</li>
  </ul>
</details>"""

SKY_BOX = """
    <div class="skyBox" id="skyBox">
      <canvas class="sky3d" id="sky" aria-label="3 boyutlu gökyüzü: burç kuşağı ve gezegenler. Sürükleyerek döndürebilirsin."></canvas>
      <div class="skyCtl" aria-label="Gökyüzü kontrolleri">
        <button type="button" data-sky="in" aria-label="Yakınlaştır">+</button>
        <button type="button" data-sky="out" aria-label="Uzaklaştır">−</button>
        <button type="button" data-sky="top" aria-label="Üstten bak">⊙</button>
        <button type="button" data-sky="reset" aria-label="Başa dön">↺</button>
      </div>
      <p class="skyHint">Sürükle, çevir · gezegene dokun</p>
      <div class="tip" id="skyTip" hidden></div>
    </div>"""

PAGES = {
  "": dict(js="home", title="JinjaAstro · Doğum haritası, yükselen burç ve burç yorumları",
    desc="Doğum haritanı 3 boyutlu gökyüzünde gör, yükselen burcunu öğren; her burç için haftalık ve aylık yorumlar, burç uyumu ve detaylı burç profilleri. Ücretsiz, hesap yok.",
    body=f"""
  <section class="hero">
    {SKY_BOX}
    <div class="heroTxt">
      <span class="eyebrow" id="skyMode">Şu an gökyüzü</span>
      <h1>Doğduğun anın <em>gökyüzü.</em></h1>
      <p>Güneşin, ayın ve yükselenin; evlerin ve gezegenlerin yerleri. Haritanı çıkar, sonra onu üç boyutta çevirip gez.</p>
      <div class="cta"><a class="btn gold" href="/astro/chart/">Doğum haritamı çıkar</a><a class="btn glass" id="myWeek" href="/astro/weekly/">Bu haftaki yorumum</a></div>
    </div>
  </section>
  <section class="sec">
    <div class="secHead"><span class="eyebrow">Ne öğrenmek istersin?</span><h2>Gökyüzünde nereden başlayalım?</h2></div>
    <div class="doors">
      <a class="door d1" href="/astro/chart/"><span class="dIc">✦</span><b>Doğum haritam</b><small>Güneş, ay, yükselen; aşk, kariyer ve para okumaları</small></a>
      <a class="door d2" href="/astro/weekly/"><span class="dIc">☾</span><b>Haftalık yorum</b><small>Her pazartesi gökyüzüne göre yenilenir</small></a>
      <a class="door d3" href="/astro/monthly/"><span class="dIc">◐</span><b>Aylık yorum</b><small>Ayın genel havası ve önemli günler</small></a>
      <a class="door d4" href="/astro/compatibility/"><span class="dIc">♡</span><b>Burç uyumu</b><small>İkiniz aşkta, arkadaşlıkta ve işte nasıl anlaşırsınız?</small></a>
      <a class="door d5" href="/astro/signs/"><span class="dIc">✧</span><b>Burç profilleri</b><small>Her burcun aşkı, kariyeri, parası ve sağlığı</small></a>
      <a class="door d6" href="/astro/sky/"><span class="dIc">☉</span><b>Bugün gökyüzü</b><small>Gezegenler şu an nerede, ay hangi evrede?</small></a>
    </div>
  </section>
  <section class="sec">
    <div class="secHead"><span class="eyebrow">Burcunu seç</span><h2>Burçlar</h2></div>
    <div class="signGrid" id="signGrid"></div>
  </section>
  <section class="sec">
    <div class="secHead"><span class="eyebrow" id="todayTitle">Bugün</span><h2>Gökyüzü şu an</h2></div>
    <div class="now" id="nowGrid"></div>
    <p class="more"><a class="btn glass" href="/astro/sky/">Gökyüzünün tamamı ve takvim →</a></p>
  </section>
  <section class="sec">{NOTES}</section>"""),

  "chart/": dict(js="harita", title="Doğum haritası hesapla · Yükselen burç ve evler · JinjaAstro",
    desc="Doğum tarihini, saatini ve yerini gir; güneş, ay ve yükselen burcunu, on iki evi ve gezegenleri öğren. Aşk, kariyer, para ve bu ay sana özel yorumlar; 3D harita ve paylaşılabilir görsel.",
    body=f"""
  <section class="sec first">
    <div class="secHead"><span class="eyebrow">Doğum haritası</span><h1 class="h2">Seni gökyüzünden okuyalım.</h1><p>Doğum tarihin, saatin ve yerin yeter. Saati ne kadar doğru girersen yükselen burcun ve evlerin o kadar doğru çıkar.</p></div>
    <form class="birth glass" id="birthForm" autocomplete="off" novalidate>
      <label class="f"><span>Adın <small>(görselde görünür)</small></span><input id="fName" maxlength="28" placeholder="Örn. Eren"></label>
      <label class="f"><span>Doğum tarihi</span><input id="fDate" type="date" min="1900-01-01" max="2049-12-31"></label>
      <div class="f"><span>Doğum saati</span><div class="timeRow"><input id="fTime" type="time" value="12:00" aria-label="Doğum saati"><label class="chk"><input type="checkbox" id="fNoTime"> Bilmiyorum</label></div></div>
      <div class="f"><span>Ülke</span><div id="fCountry"></div></div>
      <div class="f"><span>Şehir</span><div id="fCity"></div></div>
      <div class="f tzRow"><span>Saat dilimi</span><p class="tzInfo" id="tzInfo">Şehir seçince hesaplanır</p><details class="tzEdit"><summary>Değiştir</summary><label>UTC farkı <input id="fOff" type="number" step="0.5" min="-12" max="14" value="3"></label></details></div>
      <button class="btn gold big" type="submit">Haritamı çıkar</button>
    </form>
    <div class="savedRow" id="savedRow"></div>
  </section>
  <section class="sec" id="result" hidden>
    <div class="trio" id="trio"></div>
    <div class="viewer glass">
      <div class="seg" role="tablist" aria-label="Görünüm"><button type="button" role="tab" aria-selected="true" data-view="3d">3D gökyüzü</button><button type="button" role="tab" aria-selected="false" data-view="wheel">Harita çarkı</button></div>
      {SKY_BOX}
      <canvas id="wheel" width="1000" height="1000" hidden aria-label="Doğum haritası çarkı"></canvas>
      <div class="actions">
        <button class="btn gold" type="button" data-share="post">Paylaş</button>
        <button class="btn glass" type="button" data-save="post">Görsel olarak indir</button>
        <button class="btn glass" type="button" data-save="story">Hikâye boyutu</button>
        <button class="btn glass" type="button" id="keepBtn">Haritamı sakla</button>
      </div>
    </div>
    <nav class="catTabs" role="tablist" aria-label="Yorum kategorileri" id="catTabs"></nav>
    <div class="catPanel glass" id="catPanel"></div>
  </section>
  <section class="sec">{NOTES}</section>"""),

  "weekly/": dict(js="forecast", title="Haftalık burç yorumları · JinjaAstro",
    desc="Her burç için gökyüzündeki gerçek hareketlere göre her pazartesi yenilenen haftalık yorum: genel hava, aşk, iş ve para, öneri ve şanslı gün.",
    body=f"""
  <section class="sec first" data-period="week">
    <div class="secHead"><span class="eyebrow" id="periodTitle">Bu hafta</span><h1 class="h2">Haftalık burç yorumu</h1><p>Her pazartesi gökyüzündeki hareketlere göre yeniden yazılır. Yükselen burcunu biliyorsan onu da oku.</p></div>
    <div class="signPick" id="signPick" role="tablist" aria-label="Burç seç"></div>
    <article class="fc glass" id="fcBox"></article>
    <div class="glass skyNotes"><h3>Bu haftanın gökyüzü</h3><ul id="skyList"></ul></div>
  </section>
  <section class="sec">{NOTES}</section>"""),

  "monthly/": dict(js="forecast", title="Aylık burç yorumları · JinjaAstro",
    desc="Her burç için ayın genel havası, aşk, iş ve para, önemli günler ve ayın gökyüzü takvimi. Her ayın ilk günü yenilenir.",
    body=f"""
  <section class="sec first" data-period="month">
    <div class="secHead"><span class="eyebrow" id="periodTitle">Bu ay</span><h1 class="h2">Aylık burç yorumu</h1><p>Her ayın ilk günü yenilenir. Yükselen burcunu biliyorsan onu da oku.</p></div>
    <div class="signPick" id="signPick" role="tablist" aria-label="Burç seç"></div>
    <article class="fc glass" id="fcBox"></article>
    <div class="glass skyNotes"><h3>Bu ayın gökyüzü takvimi</h3><ul id="skyList"></ul></div>
  </section>
  <section class="sec">{NOTES}</section>"""),

  "compatibility/": dict(js="uyum", title="Burç uyumu · Aşk, arkadaşlık ve iş · JinjaAstro",
    desc="İki burcun aşkta, arkadaşlıkta ve işte nasıl anlaştığını öğren. Kayıtlı doğum haritalarınla Venüs, Mars ve Ay karşılaştırması.",
    body=f"""
  <section class="sec first">
    <div class="secHead"><span class="eyebrow">Uyum</span><h1 class="h2">İkiniz nasıl anlaşırsınız?</h1><p>İki burç seç ya da kayıtlı doğum haritalarından birini kullan. Haritalarla bakınca Venüs, Mars ve Ay da işin içine girer.</p></div>
    <div class="match glass">
      <div class="mSide"><span>Sen</span><div id="m1"></div></div>
      <div class="mScore"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="arc" id="mArc" cx="60" cy="60" r="52" pathLength="100"/></svg><b id="mNum">0</b><small>%</small></div>
      <div class="mSide"><span>O</span><div id="m2"></div></div>
    </div>
    <div id="mDetail"></div>
  </section>
  <section class="sec">{NOTES}</section>"""),

  "signs/": dict(js="burclar", title="Burçlar ve özellikleri · JinjaAstro",
    desc="On iki burcun kişiliği, aşk hayatı, kariyeri, para ilişkisi, sağlığı, arkadaşlığı ve en uyumlu burçları.",
    body=f"""
  <section class="sec first" id="profile"></section>
  <section class="sec">
    <div class="secHead"><span class="eyebrow">Tüm burçlar</span><h2>Bir burç seç</h2></div>
    <div class="signGrid" id="signGrid"></div>
  </section>
  <section class="sec">{NOTES}</section>"""),

  "sky/": dict(js="gokyuzu", title="Bugün gökyüzü · Gezegenlerin yerleri ve ay evresi · JinjaAstro",
    desc="Gezegenler şu an hangi burçta, ay hangi evrede, hangi gezegen geri harekette? Bu hafta ve bu ayın gökyüzü takvimi.",
    body=f"""
  <section class="sec first">
    <div class="secHead"><span class="eyebrow" id="todayTitle">Bugün</span><h1 class="h2">Gökyüzü şu an</h1><p>Gezegenlerin şu anki yerleri, ayın evresi ve bu dönemin önemli anları.</p></div>
    <div class="viewer glass solo">{SKY_BOX}</div>
    <div id="skyShare"></div>
    <div class="now" id="nowGrid"></div>
    <div class="twoCol">
      <div class="glass skyNotes"><h3>Bu haftanın gökyüzü</h3><ul id="weekSky"></ul></div>
      <div class="glass skyNotes"><h3 id="monthSkyTitle">Bu ayın gökyüzü</h3><ul id="monthSky"></ul></div>
    </div>
  </section>
  <section class="sec">{NOTES}</section>"""),
}

TEMPLATE = """<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta name="theme-color" content="#0d0a22" />
<link rel="canonical" href="https://jinjagames.com/astro/{path}" />
<link rel="icon" type="image/svg+xml" href="/assets/img/apps/jinjaastro.svg" />
<link rel="apple-touch-icon" href="/favicon-j-shuriken-180.png?v=2" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://jinjagames.com/astro/{path}" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'" />
<link rel="stylesheet" href="/assets/fonts.css?v=20261012d" />
<link rel="stylesheet" href="/astro/astro.css?v={v}" />
{three}<script type="module" src="/astro/js/pages/{js}.js?v={v}"></script>
</head>
<body class="pg-{js}">
<a class="skip" href="#main">İçeriğe geç</a>
<header class="top">
  <a class="back" href="/" title="JinjaGames ana sayfası" aria-label="JinjaGames ana sayfası"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg><img src="/favicon-j-shuriken-32.png" width="20" height="20" alt=""></a>
  <a class="brand" href="/astro/"><img src="/assets/img/apps/jinjaastro.svg" alt="" width="30" height="30"><b>Jinja</b><i>Astro</i></a>
  <button class="menuBtn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menü"><span></span><span></span><span></span></button>
  <nav class="nav" id="nav" aria-label="JinjaAstro bölümleri">{nav}</nav>
</header>
<main id="main">{body}
</main>
<footer class="foot"><a href="/astro/">JinjaAstro</a> · <a href="/">JinjaGames</a> · <a href="/apps/">Diğer web uygulamaları</a> · <a href="/privacy/">Gizlilik</a></footer>
</body>
</html>
"""

for path, p in PAGES.items():
    cur = ' aria-current="page"'
    nav = "".join(f'<a href="/astro/{h}"{cur if h == path else ""}>{t}</a>' for h, t in NAV)
    three = '<script src="/assets/vendor/three.min.js" defer></script>\n' if "sky3d" in p["body"] else ""
    html = TEMPLATE.format(title=p["title"], desc=p["desc"], path=path, js=p["js"], v=V, nav=nav, body=p["body"], three=three)
    out = ROOT / path / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("yazıldı", out.relative_to(ROOT.parent))

# Modüller içindeki import yollarına da sürüm ekle: tarayıcı eski ve yeni dosyaları karıştırmasın.
import re
IMP = re.compile(r'(from\s*"|import\(\s*")(\.{1,2}/[^"?]+\.js)(\?v=\w+)?"')
for js in (ROOT / "js").rglob("*.js"):
    src = js.read_text(encoding="utf-8")
    new = IMP.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={V}"', src)
    if new != src:
        js.write_text(new, encoding="utf-8")
        print("sürüm", js.relative_to(ROOT.parent))
