/* JinjaCut web. Kendi cihazında çalışan JinjaCut Helper'a bağlanır; JinjaGames sunucusu yoktur. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var LS = 'jc_helper';
  var DEFAULT_LOCAL = 'http://127.0.0.1:8765';

  var T = {
    en: {
      skip: 'Skip to content', eyebrow: 'Web · your device does the work',
      h1: 'Save a video or its audio from a link.',
      lead: 'Paste a link, pick the quality, get an MP4 or MP3. There is no JinjaGames server in the middle: your own computer downloads it and hands it to this page, on the computer or on your phone.',
      chip1: 'MP4 up to the best quality', chip2: 'MP3 up to 320 kbps', chip3: 'iPhone and Android',
      connOff: 'Helper not connected', connOn: 'Connected to your helper', connWait: 'Looking for the helper…',
      connPhone: 'Connected to your computer', forget: 'Disconnect',
      setupTitle: 'Start the helper on your computer',
      setupIntro: 'A browser cannot fetch videos from other sites by itself, so a small free helper runs on your own computer and does it. Nothing runs on a JinjaGames server and nothing is paid.',
      setup1: 'Download the helper and open it. Windows needs nothing else.',
      setup2: 'If Windows shows a blue warning, choose <b>More info</b>, then <b>Run anyway</b>.',
      setup3: 'Pick <b>1</b> for this computer or <b>2</b> for your phone. This page opens by itself, already connected. For the phone, scan the QR code it shows.',
      dlHelper: 'Download for Windows (.exe)', dlZip: 'Mac / Linux (.zip)', retry: 'I started it, check again',
      setupReq: 'The first start downloads yt-dlp, which takes a moment. On Mac and Linux unzip it and run baslat.sh; that version needs Python 3.8 or newer.',
      pasteSum: 'I have a connection link', pasteLabel: 'Paste the link the helper printed', pairGo: 'Connect',
      badLink: 'That is not a JinjaCut connection link.',
      foundNoKey: 'The helper is running, but this page has no key yet. Use the page the helper opened, or paste its link below.',
      notFound: 'No helper found. Start it, then check again.',
      phoneNeedsQr: 'On a phone, start the helper on your computer in phone mode (2) and scan its QR code.',
      safari: 'Safari blocks pages from reaching a helper on the same computer. Use Chrome, Edge or Firefox, or start phone mode (2) and open its link here.',
      lost: 'The helper stopped answering. Is its window still open?',
      urlLabel: 'Video link', paste: 'Paste', analyze: 'Find video', analyzing: 'Reading the link…',
      needUrl: 'Paste a link that starts with http.', kindVideo: 'Video (MP4)', kindAudio: 'Audio (MP3)',
      qLabel: 'Quality', aLabel: 'Audio quality', start: 'Download', best: 'Best available', lowest: 'Smallest file',
      aBest: 'Best (variable bitrate)', hintHi: 'Above 1080p the file may use a codec the iPhone gallery cannot play.',
      queued: 'Waiting', preparing: 'Preparing…', downloading: 'Downloading', merging: 'Joining video and audio…',
      mp3: 'Converting to MP3…', processing: 'Processing…', done: 'Ready', failed: 'Failed', canceled: 'Canceled',
      cancel: 'Cancel', remove: 'Remove', save: 'Download', savePhotos: 'Save to Photos', saveFiles: 'Save to Files',
      share: 'Share', fetching: 'Getting the file… ', tapAgain: 'Ready. Tap to save.', left: ' left',
      saved: 'Sent to your device.', bigFile: 'Large file: use Download so the phone does not run out of memory.',
      howTitle: 'How it works',
      how1: 'The helper runs on your computer and listens only to this page, with a secret key that never leaves your devices.',
      how2: 'You paste a link here. Your computer downloads the video with yt-dlp and converts it with ffmpeg.',
      how3: 'The finished file comes to this browser. On a phone it travels through a free, temporary Cloudflare tunnel that only your link can open.',
      phoneTitle: 'Saving to the gallery',
      phone1: '<b>iPhone:</b> tap <b>Save to Photos</b>, then choose <b>Save Video</b> in the share sheet. MP3 files go to <b>Save to Files</b>.',
      phone2: '<b>Android:</b> tap <b>Download</b>. The file lands in Downloads and shows up in the gallery.',
      phone3: 'Videos are saved as H.264 + AAC when the source offers it, so phones can play them. Above 1080p many sites only offer other codecs; those play in VLC and most players but the iPhone gallery may refuse them.',
      fairTitle: 'Use it fairly',
      fair: 'Only download what you are allowed to: your own videos, freely licensed work, or content whose owner lets you. Site terms and copyright are your responsibility.',
      footApps: 'Web apps', footPrivacy: 'Privacy', footNote: 'JinjaCut Web · no account, no tracking, no JinjaGames server.'
    },
    tr: {
      skip: 'İçeriğe geç', eyebrow: 'Web · işi kendi cihazın yapar',
      h1: 'Bağlantıdan videoyu ya da sesini kaydet.',
      lead: 'Bağlantıyı yapıştır, kaliteyi seç, MP4 ya da MP3 al. Arada JinjaGames sunucusu yok: videoyu kendi bilgisayarın indirir ve bu sayfaya verir; bilgisayarda da telefonda da.',
      chip1: 'En yüksek kaliteye kadar MP4', chip2: '320 kbps\'ye kadar MP3', chip3: 'iPhone ve Android',
      connOff: 'Yardımcı bağlı değil', connOn: 'Yardımcına bağlı', connWait: 'Yardımcı aranıyor…',
      connPhone: 'Bilgisayarına bağlı', forget: 'Bağlantıyı kes',
      setupTitle: 'Yardımcıyı bilgisayarında başlat',
      setupIntro: 'Tarayıcı başka sitelerden kendi başına video çekemez; bu işi kendi bilgisayarında çalışan küçük, ücretsiz bir yardımcı yapar. JinjaGames sunucusunda hiçbir şey çalışmaz, ücret yoktur.',
      setup1: 'Yardımcıyı indir ve aç. Windows\'ta başka bir şey gerekmez.',
      setup2: 'Windows mavi bir uyarı gösterirse <b>Ek bilgi</b>, sonra <b>Yine de çalıştır</b> de.',
      setup3: 'Bu bilgisayar için <b>1</b>, telefon için <b>2</b> seç. Bu sayfa bağlanmış olarak kendiliğinden açılır. Telefon için ekrandaki QR kodu okut.',
      dlHelper: 'Windows için indir (.exe)', dlZip: 'Mac / Linux (.zip)', retry: 'Başlattım, yeniden dene',
      setupReq: 'İlk açılışta yt-dlp iner, kısa sürer. Mac ve Linux\'ta zip\'i açıp baslat.sh dosyasını çalıştır; o sürüm Python 3.8 ya da yenisini ister.',
      pasteSum: 'Bağlantı linkim var', pasteLabel: 'Yardımcının yazdığı linki yapıştır', pairGo: 'Bağlan',
      badLink: 'Bu bir JinjaCut bağlantı linki değil.',
      foundNoKey: 'Yardımcı çalışıyor ama bu sayfada anahtar yok. Yardımcının açtığı sayfayı kullan ya da linkini aşağıya yapıştır.',
      notFound: 'Yardımcı bulunamadı. Başlat, sonra yeniden dene.',
      phoneNeedsQr: 'Telefonda kullanmak için yardımcıyı bilgisayarında telefon modunda (2) başlat ve QR kodunu okut.',
      safari: 'Safari, sayfaların aynı bilgisayardaki yardımcıya ulaşmasını engeller. Chrome, Edge ya da Firefox kullan; ya da telefon modunu (2) başlatıp linkini burada aç.',
      lost: 'Yardımcı yanıt vermiyor. Penceresi hâlâ açık mı?',
      urlLabel: 'Video bağlantısı', paste: 'Yapıştır', analyze: 'Videoyu bul', analyzing: 'Bağlantı okunuyor…',
      needUrl: 'http ile başlayan bir bağlantı yapıştır.', kindVideo: 'Video (MP4)', kindAudio: 'Ses (MP3)',
      qLabel: 'Kalite', aLabel: 'Ses kalitesi', start: 'İndir', best: 'En yüksek', lowest: 'En küçük dosya',
      aBest: 'En iyi (değişken bit hızı)', hintHi: '1080p üstünde dosya, iPhone galerisinin oynatamadığı bir kodekle gelebilir.',
      queued: 'Sırada', preparing: 'Hazırlanıyor…', downloading: 'İndiriliyor', merging: 'Video ve ses birleştiriliyor…',
      mp3: 'MP3\'e dönüştürülüyor…', processing: 'İşleniyor…', done: 'Hazır', failed: 'Hata', canceled: 'İptal edildi',
      cancel: 'İptal', remove: 'Kaldır', save: 'İndir', savePhotos: 'Fotoğraflar\'a kaydet', saveFiles: 'Dosyalar\'a kaydet',
      share: 'Paylaş', fetching: 'Dosya alınıyor… ', tapAgain: 'Hazır. Kaydetmek için dokun.', left: ' kaldı',
      saved: 'Cihazına gönderildi.', bigFile: 'Büyük dosya: telefonun belleği dolmasın diye İndir\'i kullan.',
      howTitle: 'Nasıl çalışır',
      how1: 'Yardımcı bilgisayarında çalışır ve yalnızca bu sayfayı dinler; gizli anahtar cihazlarından dışarı çıkmaz.',
      how2: 'Bağlantıyı buraya yapıştırırsın. Bilgisayarın videoyu yt-dlp ile indirir, ffmpeg ile dönüştürür.',
      how3: 'Biten dosya bu tarayıcıya gelir. Telefonda, yalnızca senin linkinin açabildiği ücretsiz ve geçici bir Cloudflare tünelinden geçer.',
      phoneTitle: 'Galeriye kaydetme',
      phone1: '<b>iPhone:</b> <b>Fotoğraflar\'a kaydet</b>\'e dokun, açılan paylaşım menüsünde <b>Videoyu Kaydet</b>\'i seç. MP3 için <b>Dosyalar\'a Kaydet</b>.',
      phone2: '<b>Android:</b> <b>İndir</b>\'e dokun. Dosya İndirilenler\'e iner ve galeride görünür.',
      phone3: 'Kaynak sunuyorsa videolar H.264 + AAC olarak kaydedilir; telefonlar bunu oynatır. 1080p üstünde çoğu site yalnızca başka kodekler sunar; bunlar VLC ve çoğu oynatıcıda açılır ama iPhone galerisi kabul etmeyebilir.',
      fairTitle: 'Adil kullan',
      fair: 'Yalnızca indirmeye hakkın olanı indir: kendi videoların, serbest lisanslı işler ya da sahibinin izin verdiği içerikler. Site koşulları ve telif hakkı senin sorumluluğundadır.',
      footApps: 'Web uygulamaları', footPrivacy: 'Gizlilik', footNote: 'JinjaCut Web · hesap yok, izleme yok, JinjaGames sunucusu yok.'
    }
  };
  function lang() { return root.getAttribute('data-lang') === 'tr' ? 'tr' : 'en'; }
  function t(k) { return T[lang()][k] || T.en[k] || k; }
  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (e) { e.textContent = t(e.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (e) { e.innerHTML = t(e.getAttribute('data-i18n-html')); });
    $('lang-cur').textContent = lang() === 'tr' ? 'TR' : 'EN';
    renderConn(); fillQuality(); jobs.forEach(renderJob);
  }
  $('btn-lang').addEventListener('click', function () {
    var l = lang() === 'tr' ? 'en' : 'tr';
    root.setAttribute('data-lang', l); root.lang = l;
    try { localStorage.setItem('jg_lang', l); } catch (e) {}
    applyLang();
  });
  $('btn-theme').addEventListener('click', function () {
    var th = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', th);
    try { localStorage.setItem('jg_theme', th); } catch (e) {}
  });

  function toast(msg, err) {
    var d = document.createElement('div');
    d.className = 'toast' + (err ? ' err' : ''); d.textContent = msg;
    $('toasts').appendChild(d);
    setTimeout(function () { d.remove(); }, 5200);
  }

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid;
  var isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);

  /* ---------- yardımcı bağlantısı ---------- */
  var helper = null;      // {h, k}
  var connState = 'off';  // off | wait | on
  var jobs = [];
  var video = null;       // son /info sonucu
  var kind = 'video';

  function cleanHost(h) {
    try {
      var u = new URL(h);
      var local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
      if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.origin;
    } catch (e) {}
    return null;
  }
  function parsePair(s) {
    var i = String(s || '').indexOf('#');
    if (i < 0) return null;
    var p = new URLSearchParams(String(s).slice(i + 1));
    var h = cleanHost(p.get('h') || ''), k = p.get('k') || '';
    return h && /^[\w-]{20,200}$/.test(k) ? { h: h, k: k } : null;
  }
  function saved() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
  function store(v) { try { v ? localStorage.setItem(LS, JSON.stringify(v)) : localStorage.removeItem(LS); } catch (e) {} }

  function api(path, opt, h) {
    h = h || helper; opt = opt || {};
    var ctl = new AbortController();
    var tm = setTimeout(function () { ctl.abort(); }, opt.timeout || 15000);
    var headers = { 'X-Cut-Key': h.k };
    if (opt.body) headers['Content-Type'] = 'application/json';
    return fetch(h.h + path, { method: opt.method || 'GET', headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, signal: ctl.signal, cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); })
      .finally(function () { clearTimeout(tm); });
  }
  function ping(h) { return api('/ping', { timeout: 6000 }, h); }

  function renderConn() {
    var c = $('conn');
    c.setAttribute('data-state', connState);
    var remote = helper && helper.h.indexOf('https:') === 0;
    $('conn-text').textContent = connState === 'on' ? t(remote ? 'connPhone' : 'connOn') : connState === 'wait' ? t('connWait') : t('connOff');
    $('conn-forget').hidden = connState !== 'on';
    $('view-setup').hidden = connState === 'on';
    $('view-app').hidden = connState !== 'on';
  }
  function setStatus(id, msg, cls) { var e = $(id); e.textContent = msg || ''; e.className = 'status' + (cls ? ' ' + cls : ''); }

  function connect(cand, quiet) {
    connState = 'wait'; renderConn();
    return ping(cand).then(function (r) {
      if (!r.authed) throw new Error('key');
      helper = cand; store(cand); connState = 'on'; renderConn(); setStatus('setup-status', '');
      return true;
    }).catch(function (e) {
      connState = 'off'; renderConn();
      if (!quiet) setStatus('setup-status', e && e.message === 'key' ? t('foundNoKey') : t('notFound'), 'err');
      return false;
    });
  }
  function discover() {
    var s = saved();
    if (s && cleanHost(s.h)) {
      return connect({ h: cleanHost(s.h), k: s.k }, true).then(function (ok) { if (!ok) probe(); });
    }
    probe();
  }
  function probe() {
    if (isMobile) { setStatus('setup-status', t('phoneNeedsQr')); return; }
    connState = 'wait'; renderConn();
    ping({ h: DEFAULT_LOCAL, k: '' }).then(function () {
      connState = 'off'; renderConn(); setStatus('setup-status', t('foundNoKey'));
    }).catch(function () {
      connState = 'off'; renderConn();
      setStatus('setup-status', isSafari ? t('safari') : '');
    });
  }
  $('retry').addEventListener('click', function () {
    var s = saved();
    if (s) connect(s); else { setStatus('setup-status', t('connWait'), 'busy'); ping({ h: DEFAULT_LOCAL, k: '' }).then(function () { setStatus('setup-status', t('foundNoKey')); }, function () { setStatus('setup-status', isSafari ? t('safari') : t('notFound'), 'err'); }); }
  });
  $('pair-go').addEventListener('click', function () {
    var p = parsePair($('pair-in').value.trim());
    if (!p) return setStatus('setup-status', t('badLink'), 'err');
    connect(p);
  });
  $('conn-forget').addEventListener('click', function () { helper = null; store(null); connState = 'off'; renderConn(); });

  /* ---------- bağlantıyı çözme ---------- */
  function fmtDur(s) {
    s = Math.round(s || 0); if (!s) return '';
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  }
  function fmtBytes(n) {
    if (!n) return '';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (n >= 1024 && i < 3) { n /= 1024; i++; }
    return n.toFixed(i > 1 ? 1 : 0) + ' ' + u[i];
  }
  function fmtEta(s) {
    if (s < 0 || !isFinite(s)) return '';
    s = Math.ceil(s);
    var tr = lang() === 'tr';
    if (s < 60) return s + (tr ? ' sn' : ' s');
    return Math.floor(s / 60) + (tr ? ' dk ' : ' min ') + String(s % 60).padStart(2, '0') + (tr ? ' sn' : ' s');
  }
  function opt(sel, value, text) { var o = document.createElement('option'); o.value = value; o.textContent = text; sel.appendChild(o); }
  function fillQuality() {
    var v = $('q-video'), a = $('q-audio'), pv = v.value, pa = a.value;
    v.textContent = ''; a.textContent = '';
    opt(v, 'best', t('best'));
    (video ? video.heights : []).forEach(function (h) { opt(v, String(h), h + 'p' + (h >= 2160 ? ' · 4K' : h >= 1440 ? ' · 2K' : h >= 1080 ? ' · Full HD' : h >= 720 ? ' · HD' : '')); });
    opt(v, 'lowest', t('lowest'));
    opt(a, '0', t('aBest'));
    [320, 256, 192, 128, 96, 64].forEach(function (k) { opt(a, String(k), k + ' kbps'); });
    if (pv && v.querySelector('option[value="' + pv + '"]')) v.value = pv;
    else if (video && isMobile && video.heights.some(function (h) { return h <= 1080; })) v.value = String(video.heights.filter(function (h) { return h <= 1080; })[0]);
    if (pa) a.value = pa;
    hint();
  }
  function hint() {
    var q = $('q-video').value, top = video && video.heights[0];
    var hi = kind === 'video' && ((q === 'best' && top > 1080) || Number(q) > 1080);
    $('q-hint').textContent = hi ? t('hintHi') : '';
  }
  $('q-video').addEventListener('change', hint);
  $('kind').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-kind]'); if (!b) return;
    kind = b.getAttribute('data-kind');
    this.querySelectorAll('button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    $('f-video').hidden = kind !== 'video'; $('f-audio').hidden = kind !== 'audio';
    hint();
  });

  function analyze() {
    var url = $('url').value.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return setStatus('url-status', t('needUrl'), 'err');
    setStatus('url-status', t('analyzing'), 'busy');
    $('analyze').disabled = true; $('pick').hidden = true;
    api('/info', { method: 'POST', body: { url: url }, timeout: 130000 }).then(function (j) {
      video = j; video.url = url;
      $('v-title').textContent = j.title;
      $('v-meta').textContent = [j.uploader, fmtDur(j.duration), j.site].filter(Boolean).join(' · ');
      var th = $('thumb');
      if (j.thumbnail && /^https:\/\//.test(j.thumbnail)) { th.src = j.thumbnail; th.hidden = false; } else { th.hidden = true; }
      $('q-video').value = ''; fillQuality();
      $('pick').hidden = false; setStatus('url-status', '');
    }).catch(function (e) {
      setStatus('url-status', e.name === 'AbortError' || e instanceof TypeError ? t('lost') : e.message, 'err');
    }).finally(function () { $('analyze').disabled = false; });
  }
  $('analyze').addEventListener('click', analyze);
  $('url').addEventListener('keydown', function (e) { if (e.key === 'Enter') analyze(); });
  $('paste').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (s) { if (s) { $('url').value = s.trim(); analyze(); } }).catch(function () { $('url').focus(); });
    } else $('url').focus();
  });

  /* ---------- işler ---------- */
  $('start').addEventListener('click', function () {
    if (!video) return;
    var body = { url: video.url, kind: kind }, label;
    if (kind === 'audio') {
      var kb = Number($('q-audio').value);
      if (kb) body.kbps = kb;
      label = 'MP3 · ' + (kb ? kb + ' kbps' : t('aBest'));
    } else {
      var q = $('q-video').value;
      if (q === 'lowest') body.lowest = true; else if (q !== 'best') body.height = Number(q);
      label = 'MP4 · ' + (q === 'best' ? t('best') : q === 'lowest' ? t('lowest') : q + 'p');
    }
    var title = video.title;
    $('start').disabled = true;
    api('/jobs', { method: 'POST', body: body }).then(function (j) {
      var job = { id: j.id, title: title, label: label, kind: kind, s: j, blob: null, fetchPct: -1 };
      job.el = document.createElement('li'); job.el.className = 'job';
      $('jobs').prepend(job.el); jobs.unshift(job); renderJob(job); poll(job);
    }).catch(function (e) { toast(e instanceof TypeError ? t('lost') : e.message, true); })
      .finally(function () { $('start').disabled = false; });
  });

  function poll(job) {
    if (job.gone) return;
    api('/jobs/' + job.id).then(function (s) {
      job.s = s; job.miss = 0; renderJob(job);
      if (s.state === 'running' || s.state === 'queued') setTimeout(function () { poll(job); }, 800);
    }).catch(function () {
      job.miss = (job.miss || 0) + 1;
      if (job.miss > 8) { job.s.state = 'failed'; job.s.error = t('lost'); renderJob(job); return; }
      setTimeout(function () { poll(job); }, 1500);
    });
  }
  function fileUrl(job) { return helper.h + '/jobs/' + job.id + '/file?k=' + encodeURIComponent(helper.k); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function renderJob(job) {
    var s = job.s, box = job.el; box.textContent = '';
    var head = el('div', 'bt');
    var left = el('div'); left.appendChild(el('b', null, job.title)); left.appendChild(el('div', 'lbl', job.label + (s.size ? ' · ' + fmtBytes(s.size) : '')));
    head.appendChild(left);
    var st = s.state === 'running' ? 'active' : s.state;
    head.appendChild(el('span', 'badge ' + st, t(s.state === 'running' ? s.status : s.state)));
    box.appendChild(head);
    if (s.state === 'running' || s.state === 'queued') {
      var bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.round(s.progress * 100) + '%'; bar.appendChild(fill); box.appendChild(bar);
      var stats = el('div', 'stats');
      stats.appendChild(el('span', null, Math.round(s.progress * 100) + '%'));
      if (s.speed > 0) stats.appendChild(el('span', null, fmtBytes(s.speed) + '/s'));
      var eta = fmtEta(s.eta); if (eta && s.status === 'downloading') stats.appendChild(el('span', null, eta + t('left')));
      box.appendChild(stats);
    }
    if (s.error) box.appendChild(el('p', 'errline', s.error));
    var acts = el('div', 'actions');
    if (s.state === 'done') {
      var audio = job.kind === 'audio';
      var canShare = isMobile && !!navigator.canShare && !!navigator.share;
      var dl = el('a', 'btn' + (isIOS && canShare ? '' : ' p'), t('save'));
      dl.href = fileUrl(job); dl.setAttribute('download', s.file || '');
      if (canShare) {
        var sh = el('button', 'btn' + (isIOS ? ' p' : ''), job.fetchPct >= 0 && !job.blob ? t('fetching') + job.fetchPct + '%' : job.blob ? t('tapAgain') : t(isIOS ? (audio ? 'saveFiles' : 'savePhotos') : 'share'));
        sh.type = 'button'; sh.disabled = job.fetchPct >= 0 && !job.blob;
        sh.addEventListener('click', function () { shareJob(job); });
        if (isIOS) { acts.appendChild(sh); acts.appendChild(dl); } else { acts.appendChild(dl); acts.appendChild(sh); }
      } else acts.appendChild(dl);
    }
    var rm = el('button', 'btn g sm', t(s.state === 'running' || s.state === 'queued' ? 'cancel' : 'remove'));
    rm.type = 'button';
    rm.addEventListener('click', function () {
      job.gone = true; job.blob = null; box.remove(); jobs = jobs.filter(function (x) { return x !== job; });
      api('/jobs/' + job.id, { method: 'DELETE' }).catch(function () {});
    });
    acts.appendChild(rm); box.appendChild(acts);
  }

  /* Telefon galerisi: paylaşım menüsü ancak dokunuştan hemen sonra açılabilir. Bu yüzden dosya önce belleğe
     alınır (ilk dokunuş), sonra ikinci dokunuşta paylaşım menüsü açılır. */
  function shareJob(job) {
    var s = job.s, type = job.kind === 'audio' ? 'audio/mpeg' : 'video/mp4';
    if (job.blob) {
      var f = new File([job.blob], s.file || (job.kind === 'audio' ? 'audio.mp3' : 'video.mp4'), { type: type });
      if (!navigator.canShare({ files: [f] })) { location.href = fileUrl(job); return; }
      navigator.share({ files: [f] }).then(function () { toast(t('saved')); }).catch(function (e) { if (e && e.name !== 'AbortError') location.href = fileUrl(job); });
      return;
    }
    if (s.size > 700 * 1024 * 1024) { toast(t('bigFile'), true); return; }
    job.fetchPct = 0; renderJob(job);
    fetch(fileUrl(job), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!r.body || !r.body.getReader) return r.blob();
      var rd = r.body.getReader(), parts = [], got = 0, last = 0;
      function pump() {
        return rd.read().then(function (x) {
          if (x.done) return new Blob(parts, { type: type });
          parts.push(x.value); got += x.value.length;
          var pct = s.size ? Math.min(99, Math.floor(got / s.size * 100)) : 0;
          if (pct !== last) { last = pct; job.fetchPct = pct; if (!job.gone) renderJob(job); }
          return pump();
        });
      }
      return pump();
    }).then(function (b) {
      if (job.gone) return;
      job.blob = b; job.fetchPct = 100; renderJob(job);
    }).catch(function () { job.fetchPct = -1; if (!job.gone) renderJob(job); toast(t('lost'), true); });
  }

  /* ---------- başlangıç ---------- */
  applyLang();
  var fromHash = parsePair(location.href);
  if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  if (fromHash) connect(fromHash).then(function (ok) { if (!ok) discover(); }); else discover();
  setInterval(function () {
    if (connState !== 'on' || document.hidden) return;
    ping(helper).catch(function () { return ping(helper); }).catch(function () {
      if (connState === 'on') { connState = 'off'; renderConn(); setStatus('setup-status', t('lost'), 'err'); }
    });
  }, 20000);
})();
