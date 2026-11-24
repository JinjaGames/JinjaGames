# JinjaGames kurumsal sayfaları: Hakkında, İş birliği, Basın kiti, Yayıncılar için, Yol haritası, Kariyer.
# Üst menü, alt bilgi, dil ve tema düğmeleri ana sayfadan (index.html) alınır; böylece tasarım her yerde aynı kalır.
# Kullanım: python tools/build_company.py   (index.html değişince yeniden çalıştır)
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "index.html").read_text(encoding="utf-8")
MAIL = "jinjagamesofficial@gmail.com"


def mailto(subject):
    return f"mailto:{MAIL}?subject={quote(subject)}"


def t(en, tr):  # satır içi iki dilli metin
    return f'<span class="en i">{en}</span><span class="tr i">{tr}</span>'


def p(en, tr, cls=""):  # iki dilli paragraf
    c = f" {cls}" if cls else ""
    return f'<p class="en{c}">{en}</p><p class="tr{c}">{tr}</p>'


def h(tag, en, tr, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f'<{tag}{c}>{t(en, tr)}</{tag}>'


# ---------- iskelet ----------
head_end = SRC.index('<main id="top">')
foot_start = SRC.index("</main>") + len("</main>")
TOP, BOTTOM = SRC[:head_end], SRC[foot_start:]
TOP = re.sub(r'<div id="intro".*?</div>\s*</div>\s*', "", TOP, count=1, flags=re.S)
TOP = TOP.replace('<html lang="en" data-lang="en" data-theme="light">', '<html lang="en" data-lang="en" data-theme="light" class="nointro">')
TOP = re.sub(r'<script type="application/ld\+json">.*?</script>\s*', "", TOP, count=1, flags=re.S)


def fix_links(s):
    # göreli adresleri kökten yaz; ana sayfa çapalarını ana sayfaya yönlendir
    s = re.sub(r'(href|src)="(?!https?:|/|#|mailto:|data:|javascript:)([^"]*)"', r'\1="/\2"', s)
    s = s.replace('href="#top"', 'href="/"')
    s = re.sub(r'href="#(?!content)([a-z0-9-]+)"', r'href="/#\1"', s)
    return s


TOP, BOTTOM = fix_links(TOP), fix_links(BOTTOM)

PAGES = [
    ("about", "About", "Hakkında"),
    ("business", "Business", "İş birliği"),
    ("press", "Press kit", "Basın kiti"),
    ("publishers", "For publishers", "Yayıncılar için"),
    ("roadmap", "Roadmap", "Yol haritası"),
]


def subnav(cur):
    return '<div class="cnav" role="navigation" aria-label="JinjaGames">' + "".join(
        f'<a href="/{k}/"{" aria-current=\"page\"" if k == cur else ""}>{t(en, tr)}</a>' for k, en, tr in PAGES) + "</div>"


def page(slug, title_en, title_tr, desc, body):
    top = TOP
    top = re.sub(r"<title>.*?</title>", f"<title>{title_en} · JinjaGames</title>", top, count=1, flags=re.S)
    top = re.sub(r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{desc}" />', top, count=1)
    top = re.sub(r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="https://jinjagames.com/{slug}/" />', top, count=1)
    top = re.sub(r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{title_en} · JinjaGames" />', top, count=1)
    top = re.sub(r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{desc}" />', top, count=1)
    top = re.sub(r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="https://jinjagames.com/{slug}/" />', top, count=1)
    top = top.replace("</head>", '<link rel="stylesheet" href="/assets/company.css?v=3">\n</head>', 1)
    html = top + f'<main id="top" class="cpage"><span id="content"></span><div class="wrap">{body}</div></main>' + BOTTOM
    out = ROOT / slug / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("yazıldı:", out.relative_to(ROOT))


def hero(cur, label_en, label_tr, h1_en, h1_tr, lede_en, lede_tr):
    return f'''<div class="chero">
  <span class="label">{t(label_en, label_tr)}</span>
  <h1 class="en">{h1_en}</h1><h1 class="tr">{h1_tr}</h1>
  {p(lede_en, lede_tr, "lede")}
  {subnav(cur)}
</div>'''


def cta(en_h, tr_h, en_p, tr_p, subject, btn_en="Email us", btn_tr="E-posta gönder"):
    return f'''<section class="cta"><div><h2 class="en">{en_h}</h2><h2 class="tr">{tr_h}</h2>{p(en_p, tr_p)}</div>
  <a class="btn p" href="{mailto(subject)}">{t(btn_en, btn_tr)} <span aria-hidden="true">&rarr;</span></a></section>'''


ICON = {
    "brief": '<rect x="3.5" y="7.5" width="17" height="12" rx="2.2"/><path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7M3.5 12.5h17"/>',
    "press": '<path d="M5 4h11v16H6a1 1 0 0 1-1-1z"/><path d="M16 8h3v10a2 2 0 0 1-2 2h-1"/><path d="M8 8h5M8 12h5M8 16h3"/>',
    "help": '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 16.9v.2"/>',
}

# ================= HAKKINDA =================
about = hero("about", "About JinjaGames", "JinjaGames hakkında",
             'Games and tools that <span class="hl">respect your time.</span>', 'Zamanına <span class="hl">saygı duyan</span> oyunlar ve araçlar.',
             "JinjaGames is an independent studio from Ankara, Türkiye. We make PC and mobile games, learning games and small web tools that open in your browser. Very different products, built on the same promise.",
             "JinjaGames, Ankara merkezli bağımsız bir stüdyo. PC ve mobil oyunlar, öğreten oyunlar ve tarayıcıda açılan küçük web araçları yapıyoruz. Birbirinden çok farklı ürünler, aynı sözün üstüne kuruluyor.")
about += f'''
<section class="csec"><span class="label">{t("Company vision", "Vizyon")}</span>
  {h("h2", "Thoughtful entertainment, from Türkiye to the world.", "Türkiye'den dünyaya, düşündüren eğlence.")}
  {p("Our goal is to become a studio known for games that make you think and tools people trust, released in many languages and on every platform where our players are. We grow step by step: each release has to be good enough on its own before the next one starts.",
     "Hedefimiz; düşündüren oyunları ve insanların güvendiği araçlarıyla tanınan, ürünlerini birçok dilde ve oyuncularının olduğu her platformda yayınlayan bir stüdyo olmak. Adım adım büyüyoruz: bir sonraki iş başlamadan önce her ürün tek başına yeterince iyi olmak zorunda.")}
</section>
<section class="csec"><span class="label">{t("What connects everything we make", "Yaptığımız her şeyi birleştiren")}</span>
  <div class="value">
    <div>{h("h3", "One promise behind very different products", "Çok farklı ürünlerin arkasında tek bir söz")}
      {p("A cyber security game, a detective game, puzzle games and a cooking helper look unrelated. What they share is how they treat the person using them.",
         "Bir siber güvenlik oyunu, bir dedektif oyunu, bulmacalar ve bir mutfak yardımcısı birbirinden alakasız görünür. Ortak noktaları, kullanan kişiye nasıl davrandıklarıdır.")}</div>
    <ol>
      <li><span><b>{t("Your mind is part of the game", "Aklın oyunun bir parçası")}</b>{t("Almost everything we make is built around a puzzle, a case or a skill to learn.", "Yaptığımız neredeyse her şey bir bulmacanın, bir dosyanın ya da öğrenilecek bir becerinin etrafında kurulu.")}</span></li>
      <li><span><b>{t("Fair to your time and money", "Zamanına ve paranı adil")}</b>{t("No dark patterns, no pressure to keep tapping. You play because it is fun, not because it nags.", "Karanlık tasarım hileleri yok, sürekli dokunman için baskı yok. Eğlendiğin için oynarsın, dürttüğü için değil.")}</span></li>
      <li><span><b>{t("Private by default", "Varsayılan olarak gizli")}</b>{t("Our web tools need no account and keep your data on your device.", "Web araçlarımız hesap istemez; verilerin cihazında kalır.")}</span></li>
      <li><span><b>{t("Finished before it ships", "Bitmeden çıkmaz")}</b>{t("If an idea turns out harder than planned, we move the date, not the quality.", "Bir fikir planlanandan zor çıkarsa kaliteyi değil tarihi değiştiririz.")}</span></li>
    </ol>
  </div>
</section>
<section class="csec"><span class="label">{t("At a glance", "Kısaca")}</span>
  <div class="facts">
    <div><small>{t("Based in", "Merkez")}</small><b>Ankara, {t("Türkiye", "Türkiye")}</b></div>
    <div><small>{t("Making games since", "Oyun geliştirme")}</small><b>{t("Mid 2023", "2023 ortası")}</b></div>
    <div><small>{t("Platforms", "Platformlar")}</small><b>Steam · Google Play · Web</b></div>
    <div><small>{t("Languages", "Diller")}</small><b>{t("Up to 25 per game", "Oyun başına 25'e kadar")}</b></div>
  </div>
</section>
<section class="csec"><span class="label">{t("Studio milestones", "Kilometre taşları")}</span>
  {h("h2", "How we got here", "Buraya nasıl geldik")}
  <ol class="tl">
    <li><time>2023</time><h4>{t("First games", "İlk oyunlar")}</h4>{p("I started making games and learned every part of the job: design, code, art and release.", "Oyun geliştirmeye başladım ve işin her adımını öğrendim: tasarım, kod, görseller ve yayın.")}</li>
    <li><time>2026 · Q3</time><h4>{t("The JinjaGames name", "JinjaGames adı")}</h4>{p("I brought all my projects together under one studio name and one website.", "Tüm projelerimi tek bir stüdyo adı ve tek bir web sitesi altında topladım.")}</li>
    <li><time>2026</time><h4>Cyber Academy · Steam {t("Early Access", "Erken Erişim")}</h4>{p("A cyber security game played inside a virtual operating system, in 25 languages.", "Sanal bir işletim sisteminin içinde oynanan, 25 dilde bir siber güvenlik oyunu.")}</li>
    <li><time>2026</time><h4>{t("The Jelly family on Google Play", "Jelly ailesi Google Play'de")}</h4>{p("Eight calm puzzle games for Android, each with 500 levels.", "Android için sekiz sakin bulmaca oyunu, her birinde 500 bölüm.")}</li>
    <li><time>{t("Oct – Nov 2026", "Ekim – Kasım 2026")}</time><h4>{t("Web apps", "Web uygulamaları")}</h4>{p("Jinja Football, JinjaPeer, JinjaQuiz, JinjaAstro and JinjaFC: free tools that open in the browser.", "Jinja Football, JinjaPeer, JinjaQuiz, JinjaAstro ve JinjaFC: tarayıcıda açılan ücretsiz araçlar.")}</li>
    <li class="plan"><time>2027 · Q1 ({t("planned", "planlanan")})</time><h4>Locard · {t("Early Access", "Erken Erişim")}</h4>{p("A first person detective game for 1 to 4 players. Wishlist open on Steam.", "1–4 oyunculu birinci şahıs dedektif oyunu. Steam'de istek listesine açık.")}</li>
  </ol>
  <p style="margin-top:22px"><a class="btn g" href="/roadmap/">{t("See the full roadmap", "Yol haritasının tamamı")} <span aria-hidden="true">&rarr;</span></a></p>
</section>
<section class="csec"><span class="label">{t("Team and partners", "Ekip ve iş birlikleri")}</span>
  {h("h2", "Who is behind it", "Arkasında kim var")}
  <div class="cgrid two">
    <div class="ccard"><span class="k">{t("Founder · Developer", "Kurucu · Geliştirici")}</span><h3>Eren Oğur</h3>{p("Design, code, art and release of every JinjaGames product. Based in Ankara.", "JinjaGames ürünlerinin tasarımı, kodu, görselleri ve yayını. Ankara'da.")}<a class="btn g" href="https://www.linkedin.com/company/jinjagamesofficial" target="_blank" rel="noopener">LinkedIn</a></div>
    <div class="ccard"><span class="k">{t("Partners", "Ortaklar")}</span><h3>{t("Open to partnerships", "İş birliklerine açık")}</h3>{p("Publishing, education, brand and co-development partnerships are always welcome.", "Yayıncılık, eğitim, marka ve ortak geliştirme iş birliklerine her zaman açığım.")}<a class="btn g" href="/business/">{t("Business", "İş birliği")} <span aria-hidden="true">&rarr;</span></a></div>
  </div>
</section>
''' + cta("Want to work with us?", "Birlikte bir şey yapalım mı?", "Partnerships, publishing, press or a simple question.", "İş birliği, yayıncılık, basın ya da basit bir soru.", "JinjaGames: Hello")
page("about", "About JinjaGames", "JinjaGames hakkında", "JinjaGames: an independent studio from Ankara making games that make you think and privacy friendly web tools. Vision, values and milestones.", about)

# ================= İŞ BİRLİĞİ =================
biz = hero("business", "Business, press and support", "İş, basın ve destek",
           "Let's build something <span class=\"hl\">together.</span>", "Birlikte bir şey <span class=\"hl\">kuralım.</span>",
           "Every message reaches a real person. Pick the right lane so we can answer you faster.",
           "Her mesajı gerçek bir insan okuyor. Doğru başlığı seçersen daha hızlı dönebiliriz.")
biz += f'''
<div class="lanes">
  <div class="lane"><span class="ico"><svg viewBox="0 0 24 24">{ICON["brief"]}</svg></span>{h("h3", "Business inquiries", "İş görüşmeleri")}
    {p("Publishing, licensing, co-development, porting, sponsorship or education partnerships.", "Yayıncılık, lisanslama, ortak geliştirme, port, sponsorluk ya da eğitim iş birlikleri.")}
    <a class="btn p" href="{mailto('Business inquiry')}">{t("Business email", "İş e-postası")}</a></div>
  <div class="lane"><span class="ico"><svg viewBox="0 0 24 24">{ICON["press"]}</svg></span>{h("h3", "Press and creators", "Basın ve içerik üreticileri")}
    {p("Review keys, interviews, logos and screenshots. Most of what you need is in the press kit.", "İnceleme anahtarı, röportaj, logo ve ekran görüntüleri. Gerekenlerin çoğu basın kitinde.")}
    <a class="btn g" href="/press/">{t("Press kit", "Basın kiti")} <span aria-hidden="true">&rarr;</span></a></div>
  <div class="lane"><span class="ico"><svg viewBox="0 0 24 24">{ICON["help"]}</svg></span>{h("h3", "Player support", "Oyuncu desteği")}
    {p("A bug, a lost purchase or a question about one of our games or apps.", "Bir hata, kaybolan bir satın alma ya da oyunlarımız veya uygulamalarımızla ilgili bir soru.")}
    <a class="btn g" href="{mailto('Support')}">{t("Support email", "Destek e-postası")}</a></div>
</div>
<section class="csec"><span class="label">{t("Partnership opportunities", "İş birliği fırsatları")}</span>
  {h("h2", "Where we can work together", "Nerelerde birlikte çalışabiliriz")}
  <div class="cgrid">
    <div class="ccard"><span class="k">01</span>{h("h3", "Publishing", "Yayıncılık")}{p("Marketing, funding, console ports and localization for our PC games.", "PC oyunlarımız için pazarlama, finansman, konsol portu ve yerelleştirme.")}<a class="btn g" href="/publishers/">{t("For publishers", "Yayıncılar için")}</a></div>
    <div class="ccard"><span class="k">02</span>{h("h3", "Education and training", "Eğitim")}{p("Cyber Academy teaches real security concepts through play. We are open to school, university and company training programs.", "Cyber Academy gerçek güvenlik kavramlarını oyunla öğretiyor. Okul, üniversite ve şirket eğitim programlarına açığız.")}</div>
    <div class="ccard"><span class="k">03</span>{h("h3", "Brands and sponsorship", "Markalar ve sponsorluk")}{p("Themed quizzes, custom puzzle packs or tools built around your community, without tracking your users.", "Topluluğuna özel quizler, bulmaca paketleri ya da araçlar; kullanıcılarını izlemeden.")}</div>
    <div class="ccard"><span class="k">04</span>{h("h3", "Co-development", "Ortak geliştirme")}{p("Unity and web projects where an extra pair of hands with release experience helps.", "Yayın deneyimi olan bir el daha gereken Unity ve web projeleri.")}</div>
    <div class="ccard"><span class="k">05</span>{h("h3", "Localization and QA partners", "Yerelleştirme ve test ortakları")}{p("Localization and QA companies that want to work on upcoming languages and platforms.", "Yeni diller ve platformlar için çalışmak isteyen yerelleştirme ve test şirketleri.")}</div>
    <div class="ccard"><span class="k">06</span>{h("h3", "Open source", "Açık kaynak")}{p("Our developer tools are on GitHub under the MIT license. Contributions and forks are welcome.", "Geliştirici araçlarımız GitHub'da, MIT lisansıyla. Katkılara ve çatallamaya açık.")}<a class="btn g" href="https://github.com/JinjaGames" target="_blank" rel="noopener">GitHub</a></div>
  </div>
  <p class="note">{t("Writing to us? A short note about who you are, what you have in mind and a rough timeline helps us reply with something useful.", "Bize yazarken kim olduğunu, aklındaki fikri ve kabaca zaman planını kısaca anlatırsan işe yarar bir cevap verebiliriz.")}</p>
</section>
''' + cta("Prefer a direct line?", "Doğrudan yazmak mı istersin?", MAIL, MAIL, "JinjaGames: Business inquiry")
page("business", "Business, press and support", "İş, basın ve destek", "Business inquiries, partnership opportunities, press and player support for JinjaGames.", biz)

# ================= BASIN KİTİ =================
def asset(img, name, href, dark=False, cover=False):
    cls = "pv" + (" dark" if dark else "") + (" cover" if cover else "")
    m = re.search(r'<span class="en i">(.*?)</span>', name)
    alt = (m.group(1) if m else name).replace('"', "")
    return f'<div class="asset"><div class="{cls}"><img src="{img}" alt="{alt}" loading="lazy"></div><div class="m"><span>{name}</span><a href="{href}" download>{t("Download", "İndir")}</a></div></div>'


def copyblock(en, tr):
    return f'<div class="copy en">{en}<button type="button" data-copy>Copy</button></div><div class="copy tr">{tr}<button type="button" data-copy>Kopyala</button></div>'


press = hero("press", "Press kit", "Basın kiti",
             "Everything you need <span class=\"hl\">in one place.</span>", "Gereken her şey <span class=\"hl\">tek yerde.</span>",
             "Logos, images, fact sheet and ready to use descriptions. You can use these freely when writing about JinjaGames and its products.",
             "Logolar, görseller, künye ve kullanıma hazır açıklamalar. JinjaGames ve ürünleri hakkında yazarken serbestçe kullanabilirsin.")
press += f'''
<section class="csec"><span class="label">{t("Fact sheet", "Künye")}</span>
  <div class="facts">
    <div><small>{t("Studio", "Stüdyo")}</small><b>JinjaGames</b></div>
    <div><small>{t("Founder", "Kurucu")}</small><b>Eren Oğur</b></div>
    <div><small>{t("Based in", "Merkez")}</small><b>Ankara, Türkiye</b></div>
    <div><small>{t("Since", "Başlangıç")}</small><b>2023</b></div>
    <div><small>{t("Platforms", "Platformlar")}</small><b>PC (Steam), Android, Web</b></div>
    <div><small>{t("Website", "Web sitesi")}</small><b>jinjagames.com</b></div>
    <div><small>{t("Press contact", "Basın iletişim")}</small><b style="font-size:15px">{MAIL}</b></div>
    <div><small>{t("Social", "Sosyal")}</small><b style="font-size:15px">Instagram · LinkedIn · GitHub</b></div>
  </div>
</section>
<section class="csec"><span class="label">{t("About the studio", "Stüdyo hakkında")}</span>
  {h("h2", "Boilerplate", "Kısa tanıtım metni")}
  {copyblock("JinjaGames is an independent game studio based in Ankara, Türkiye, founded by Eren Oğur. The studio makes games that make you think, including the cyber security game Cyber Academy, the detective game Locard and the Jelly family of puzzle games, alongside free, privacy friendly web apps such as JinjaQuiz and JinjaAstro.",
             "JinjaGames, Eren Oğur tarafından kurulan, Ankara merkezli bağımsız bir oyun stüdyosudur. Siber güvenlik oyunu Cyber Academy, dedektif oyunu Locard ve Jelly bulmaca ailesi gibi düşündüren oyunların yanında JinjaQuiz ve JinjaAstro gibi ücretsiz, gizliliğe saygılı web uygulamaları da geliştirir.")}
</section>
<section class="csec"><span class="label">{t("Logos", "Logolar")}</span>
  {h("h2", "Logos and brand mark", "Logolar ve marka işareti")}
  <div class="assets">
    {asset("/logo-512.png", "Logo 512", "/logo-512.png")}
    {asset("/logo.png", t("Logo (large)", "Logo (büyük)"), "/logo.png", dark=True)}
    {asset("/brand-mark.png", t("Brand mark", "Marka işareti"), "/brand-mark.png")}
    {asset("/JinjaGamesBanner.png", t("Banner", "Afiş"), "/JinjaGamesBanner.png")}
  </div>
  <p class="note">{t("Please do not stretch, recolor or redraw the logo. Leave some empty space around it.", "Lütfen logoyu esnetme, rengini değiştirme ya da yeniden çizme; etrafında biraz boşluk bırak.")}</p>
</section>
<section class="csec"><span class="label">{t("Products", "Ürünler")}</span>
  {h("h2", "Short descriptions", "Kısa açıklamalar")}
  <div class="cgrid two">
    <div class="ccard"><span class="k">PC · Steam · {t("Early Access", "Erken Erişim")}</span><h3>Cyber Academy</h3>{p("Learn real security by doing it inside a virtual operating system, then enter the Dark Net to attack, defend and trace other players. Available in 25 languages.", "Gerçek güvenliği sanal bir işletim sisteminin içinde yaparak öğren, sonra diğer oyunculara saldırmak, savunmak ve iz sürmek için Karanlık Ağ'a gir. 25 dilde.")}<a class="btn g" href="/cyberacademy/">{t("Product page", "Ürün sayfası")}</a></div>
    <div class="ccard"><span class="k">PC · Steam · 2027 Q1</span><h3>Locard</h3>{p("A first person case in the city of Meridian, solved with evidence instead of hunches. Alone or with up to three friends.", "Meridian kentinde, önseziyle değil delille çözülen birinci şahıs bir dosya. Tek başına ya da üç arkadaşınla.")}<a class="btn g" href="/locard/">{t("Product page", "Ürün sayfası")}</a></div>
    <div class="ccard"><span class="k">Android · Google Play</span><h3>{t("The Jelly games", "Jelly oyunları")}</h3>{p("Eight calm puzzle games with 500 levels each: Trails, Pipes, Jars, Logic, Loops, Park, Seek and Slide.", "Her birinde 500 bölüm olan sekiz sakin bulmaca oyunu: Trails, Pipes, Jars, Logic, Loops, Park, Seek ve Slide.")}<a class="btn g" href="/games/">{t("All games", "Tüm oyunlar")}</a></div>
    <div class="ccard"><span class="k">Web · {t("free", "ücretsiz")}</span><h3>{t("Web apps", "Web uygulamaları")}</h3>{p("JinjaQuiz (song and trivia quizzes), JinjaAstro (3D birth chart), JinjaFC (FC 27 squad builder), Jinja Football and JinjaPeer. No account, no install.", "JinjaQuiz (şarkı ve trivia quizleri), JinjaAstro (3D doğum haritası), JinjaFC (FC 27 kadro kurucu), Jinja Football ve JinjaPeer. Hesap yok, kurulum yok.")}<a class="btn g" href="/apps/">{t("All web apps", "Tüm web uygulamaları")}</a></div>
  </div>
</section>
<section class="csec"><span class="label">{t("Screenshots", "Ekran görüntüleri")}</span>
  {h("h2", "Cyber Academy", "Cyber Academy")}
  <div class="assets">
    {asset("/ss1_darknet_desktop.png", "Dark Net", "/ss1_darknet_desktop.png", cover=True)}
    {asset("/ss2_attack_chain.png", t("Attack chain", "Saldırı zinciri"), "/ss2_attack_chain.png", cover=True)}
    {asset("/ss3_defense_wall.png", t("Defense wall", "Savunma duvarı"), "/ss3_defense_wall.png", cover=True)}
    {asset("/ss5_module_lesson.png", t("Lesson module", "Ders modülü"), "/ss5_module_lesson.png", cover=True)}
  </div>
</section>
''' + cta("Need something else?", "Başka bir şey mi lazım?", "Review keys, interviews, higher resolution assets or quotes.", "İnceleme anahtarı, röportaj, daha yüksek çözünürlüklü görsel ya da alıntı.", "Press request")
press += '''<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-copy]");if(!b)return;var c=b.parentElement.cloneNode(true);c.querySelector("button").remove();navigator.clipboard&&navigator.clipboard.writeText(c.textContent.trim()).then(function(){var o=b.textContent;b.textContent="✓";setTimeout(function(){b.textContent=o},1400)})});</script>'''
page("press", "Press kit", "Basın kiti", "JinjaGames press kit: logos, screenshots, fact sheet and product descriptions.", press)

# ================= YAYINCILAR =================
pub = hero("publishers", "For publishers", "Yayıncılar için",
           "Small studio, <span class=\"hl\">finished games.</span>", "Küçük stüdyo, <span class=\"hl\">bitmiş oyunlar.</span>",
           "A short overview of what JinjaGames brings to a publishing partnership and what we are looking for.",
           "JinjaGames'in bir yayıncılık ortaklığına neler getirdiğine ve neler aradığına kısa bir bakış.")
pub += f'''
<section class="csec"><span class="label">{t("What we bring", "Neler getiriyoruz")}</span>
  <div class="cgrid">
    <div class="ccard">{h("h3", "Shipping experience", "Yayın deneyimi")}{p("A live Early Access game on Steam and eight released mobile games on Google Play.", "Steam'de Erken Erişim'de bir oyun ve Google Play'de yayında sekiz mobil oyun.")}</div>
    <div class="ccard">{h("h3", "Localization from day one", "Baştan yerelleştirme")}{p("Cyber Academy ships in 25 languages; our pipeline is built for it.", "Cyber Academy 25 dilde; geliştirme sürecimiz buna göre kurulu.")}</div>
    <div class="ccard">{h("h3", "Distinct ideas", "Özgün fikirler")}{p("Games built around real skills and puzzles: cyber security, detective work, logic.", "Gerçek beceriler ve bulmacalar etrafında kurulan oyunlar: siber güvenlik, dedektiflik, mantık.")}</div>
    <div class="ccard">{h("h3", "Fast iteration", "Hızlı geliştirme")}{p("A lean team means short feedback loops and quick builds.", "Küçük ekip, kısa geri bildirim döngüsü ve hızlı sürümler demek.")}</div>
    <div class="ccard">{h("h3", "Honest communication", "Dürüst iletişim")}{p("Clear milestones and realistic dates. If something slips, you hear it early.", "Net kilometre taşları ve gerçekçi tarihler. Bir şey kayarsa erkenden duyarsın.")}</div>
    <div class="ccard">{h("h3", "Community channels", "Topluluk kanalları")}{p("Steam pages, Instagram and LinkedIn, plus web apps that bring people to the studio.", "Steam sayfaları, Instagram ve LinkedIn; ayrıca insanları stüdyoya getiren web uygulamaları.")}</div>
  </div>
</section>
<section class="csec"><span class="label">{t("What we are looking for", "Ne arıyoruz")}</span>
  <div class="cgrid two">
    <div class="ccard"><h3>{t("Support", "Destek")}</h3><ul>
      <li>{t("Marketing and PR for PC launches", "PC çıkışları için pazarlama ve tanıtım")}</li>
      <li>{t("Funding to grow the team", "Ekibi büyütmek için finansman")}</li>
      <li>{t("Console porting and certification", "Konsol portu ve sertifikasyon")}</li>
      <li>{t("QA and localization review", "Test ve yerelleştirme kontrolü")}</li></ul></div>
    <div class="ccard"><h3>{t("Projects to discuss", "Konuşabileceğimiz projeler")}</h3><ul>
      <li>Locard · {t("detective game, 1 to 4 players, Early Access planned for 2027 Q1", "1–4 oyunculu dedektif oyunu, Erken Erişim 2027 Q1 planlı")}</li>
      <li>Cyber Academy · {t("growth, education market and console ports", "büyüme, eğitim pazarı ve konsol portları")}</li>
      <li>{t("Jelly puzzle family · iOS and other stores", "Jelly bulmaca ailesi · iOS ve diğer mağazalar")}</li></ul></div>
  </div>
  <p class="note">{t("We will happily share builds, a pitch deck and plans under NDA.", "Gizlilik sözleşmesiyle oynanabilir sürüm, sunum ve planları memnuniyetle paylaşırız.")}</p>
</section>
''' + cta("Let's talk about a project", "Bir proje hakkında konuşalım", "Tell us which game you are interested in and we will send a build and a deck.", "Hangi oyunla ilgilendiğini yaz; sürümü ve sunumu gönderelim.", "Publishing: ", "Contact us", "Bize yaz")
page("publishers", "For publishers", "Yayıncılar için", "JinjaGames for publishers: what we bring, what we are looking for and projects open to publishing partnerships.", pub)

# ================= YOL HARİTASI =================
def row(name, sub_en, sub_tr, st, st_en, st_tr, items):
    li = "".join(f"<li>{t(a, b)}</li>" for a, b in items)
    return f'<div class="rmrow"><div><h3>{name}</h3><small>{t(sub_en, sub_tr)}</small></div><div><span class="st {st}">{t(st_en, st_tr)}</span></div><ul>{li}</ul></div>'


rm = hero("roadmap", "Roadmap", "Yol haritası",
          "Where every product <span class=\"hl\">is heading.</span>", "Her ürün <span class=\"hl\">nereye gidiyor.</span>",
          "The current state of our games and apps and what comes next. Dates are goals, not promises; we move a date before we cut quality.",
          "Oyunlarımızın ve uygulamalarımızın şu anki durumu ve sırada ne olduğu. Tarihler hedeftir, söz değildir; kaliteden kısmak yerine tarihi kaydırırız.")
rm += f'''
<section class="csec"><span class="label">{t("Games", "Oyunlar")}</span>
  <div class="rm">
    {row("Cyber Academy", "PC · Steam", "PC · Steam", "ea", "Early Access", "Erken Erişim", [("Regular content and balance updates during Early Access", "Erken Erişim boyunca düzenli içerik ve denge güncellemeleri"), ("More missions in the Dark Net", "Karanlık Ağ'da daha fazla görev"), ("Full release after Early Access feedback", "Erken Erişim geri bildirimleriyle tam sürüm")])}
    {row("Locard", "PC · Steam · 1–4", "PC · Steam · 1–4", "dev", "In development", "Geliştiriliyor", [("Early Access planned for 2027 Q1", "Erken Erişim 2027 Q1 için planlanıyor"), ("Steam wishlist open now", "Steam istek listesi şimdiden açık")])}
    {row(t("Jelly games", "Jelly oyunları"), "Android", "Android", "live", "Released", "Yayında", [("Eight games live on Google Play, 500 levels each", "Sekiz oyun Google Play'de, her birinde 500 bölüm"), ("Fixes and quality updates based on player feedback", "Oyuncu geri bildirimine göre düzeltmeler ve iyileştirmeler")])}
    {row("DayPot", "Android · kitchen helper", "Android · mutfak yardımcısı", "dev", "In development", "Yapımda", [("250+ recipes, offline, no account and no ads", "250+ tarif, internetsiz, hesapsız ve reklamsız"), ("Release on Google Play", "Google Play'de yayın")])}
  </div>
</section>
<section class="csec"><span class="label">{t("Web apps", "Web uygulamaları")}</span>
  <div class="rm">
    {row("JinjaQuiz", "Web", "Web", "live", "Live", "Yayında", [("Song, trivia and number quizzes, solo or in a lobby", "Şarkı, trivia ve sayı quizleri; tek başına ya da lobide"), ("More reliable lobbies between phones", "Telefonlar arasında daha sağlam lobiler")])}
    {row("JinjaAstro", "Web", "Web", "live", "Live", "Yayında", [("Birth chart, compatibility, weekly and monthly readings", "Doğum haritası, uyum, haftalık ve aylık yorumlar"), ("Readings refreshed automatically every week and month", "Yorumlar her hafta ve ay kendiliğinden yenilenir")])}
    {row("JinjaFC", "Web", "Web", "live", "Live", "Yayında", [("FC 27 squad builder, player database and Clubs face tool", "FC 27 kadro kurucu, oyuncu veritabanı ve Clubs yüz aracı"), ("Player list updated every night", "Oyuncu listesi her gece güncellenir")])}
    {row("Jinja Football", "Web", "Web", "live", "Live", "Yayında", [("Daily match, transfer and manager news", "Günlük maç, transfer ve teknik direktör haberleri")])}
    {row("JinjaPeer", "Web", "Web", "live", "Live", "Yayında", [("Encrypted device to device file transfer", "Cihazdan cihaza şifreli dosya gönderimi")])}
  </div>
</section>
''' + cta("Have an idea for us?", "Bize bir fikrin mi var?", "Feature requests and feedback shape this roadmap.", "Özellik istekleri ve geri bildirimler bu yol haritasını şekillendiriyor.", "Roadmap feedback", "Send feedback", "Geri bildirim gönder")
page("roadmap", "Roadmap", "Yol haritası", "JinjaGames roadmap: the current state of our games and web apps and what comes next.", rm)
