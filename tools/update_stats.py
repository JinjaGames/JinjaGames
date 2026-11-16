"""BaneBender'ın CurseForge indirme sayılarını çekip banebender/data/stats.js'e yazar.

GitHub Actions 6 saatte bir (Türkiye saatiyle 00.00, 06.00, 12.00, 18.00) bunu çalıştırır (.github/workflows/curseforge-stats.yml).
Yalnızca SAYILAR güncellenir; yeni bir mod bulunursa sayfası elle yazılır, betik yalnızca
listesini `banebender/data/new_mods.txt` dosyasına bırakır (iş akışı bundan bir GitHub issue açar).

Kaynak sırası:
  1. CurseForge resmî API'si (CF_API_KEY ortam değişkeni varsa; console.curseforge.com'dan ücretsiz anahtar).
  2. Yoksa ya da başarısız olursa profil sayfası (curseforge.com/members/banebender/projects).
  3. O da Cloudflare'e takılırsa api.cfwidget.com (resmî değil; yalnız bilinen modların sayısı).
Hiçbiri olmazsa dosyaya dokunmadan çıkar; site eski sayılarla çalışmaya devam eder.

Yalnızca Python standart kütüphanesi kullanır.
"""
import datetime, json, os, re, shutil, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'banebender', 'data', 'stats.js')
NEW = os.path.join(ROOT, 'banebender', 'data', 'new_mods.txt')
MODS_JS = os.path.join(ROOT, 'banebender', 'data', 'mods.js')
GEN_JS = os.path.join(ROOT, 'banebender', 'data', 'generated.js')
COMMENTS = os.path.join(ROOT, 'banebender', 'data', 'comments.js')
AUTHOR_ID = 127320626          # CurseForge yazar kimliği (BaneBender)
MEMBER = 'banebender'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'


def get(url, headers=None, tries=5):
    """curl ile çeker (Cloudflare, Python'un urllib istemcisine 403 dönüyor); curl yoksa urllib."""
    last = None
    hdr = dict({'User-Agent': UA, 'Accept-Language': 'en'}, **(headers or {}))
    for i in range(tries):
        try:
            if shutil.which('curl'):
                cmd = ['curl', '-sS', '-L', '--max-time', '40', '--fail']
                for k, v in hdr.items():
                    cmd += ['-H', '%s: %s' % (k, v)]
                return subprocess.run(cmd + [url], capture_output=True, check=True).stdout.decode('utf8', 'replace')
            req = urllib.request.Request(url, headers=hdr)
            return urllib.request.urlopen(req, timeout=40).read().decode('utf8', 'replace')
        except Exception as e:  # ağ ya da Cloudflare
            last = e
            time.sleep(6 * (i + 1))
    raise last


def from_api(key):
    mods, index = {}, 0
    while True:
        url = ('https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&authorId=%d&pageSize=50&index=%d'
               '&sortField=2&sortOrder=desc' % (AUTHOR_ID, index))
        data = json.loads(get(url, {'x-api-key': key, 'Accept': 'application/json'}))
        for m in data.get('data', []):
            if any(a.get('id') == AUTHOR_ID for a in m.get('authors', [])):
                mods[m['slug']] = {'name': m['name'], 'dl': int(m.get('downloadCount', 0)),
                                   'created': (m.get('dateReleased') or m.get('dateCreated') or '')[:16] + 'Z',
                                   'updated': (m.get('dateModified') or '')[:16] + 'Z'}
        page = data.get('pagination', {})
        index += page.get('resultCount', 0)
        if not page.get('resultCount') or index >= page.get('totalCount', 0):
            break
    total = sum(v['dl'] for v in mods.values())
    return mods, total


def from_profile():
    mods, total = {}, None
    for page in range(1, 6):
        html = get('https://www.curseforge.com/members/%s/projects%s' % (MEMBER, '' if page == 1 else '?page=%d' % page))
        if 'project-card' not in html:
            if page == 1:
                raise RuntimeError('profil sayfası okunamadı (Cloudflare?)')
            break
        if total is None:
            m = re.search(r'downloadCount\\?"\s*:\s*(\d+)', html)
            total = int(m.group(1)) if m else None
        added = 0
        # CurseForge kart sınıfını değiştirdi (member-project-card -> project-card); ikisi de okunur
        for card in re.split(r'(?:member-)?project-card', html)[1:]:
            s = re.search(r'href="/minecraft/mc-mods/([a-z0-9-]+)"', card)
            n = re.search(r'aria-label="Go to (.*?) Project Page"', card)
            dl = re.search(r'(?:detail-)?downloads">\s*([\d.,]+)\s*([KkMm]?)<', card)
            if not s or not dl:
                continue
            num = float(dl.group(1).replace(',', ''))
            num = int(num * (1000 if dl.group(2).lower() == 'k' else 1000000 if dl.group(2).lower() == 'm' else 1))
            if s.group(1) not in mods:
                mods[s.group(1)] = {'name': (n.group(1) if n else s.group(1)).replace('&amp;', '&'), 'dl': num}
                added += 1
        if not added:
            break
    if not mods:
        raise RuntimeError('profilde proje bulunamadı')
    return mods, total if total is not None else sum(v['dl'] for v in mods.values())


def iso(ms):
    return datetime.datetime.fromtimestamp(int(ms) / 1000, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')


def dates_from_page(slug):
    """Proje sayfasındaki JSON'dan yayınlanma (dateCreated) ve son güncelleme (updateDate) tarihleri."""
    html = get('https://www.curseforge.com/minecraft/mc-mods/' + slug, tries=2).replace('\\"', '"')
    m = re.search(r'"slug":"' + re.escape(slug) + r'".{0,2500}?"updateDate":(\d+),"dateCreated":(\d+)', html, re.S)
    if not m:
        raise RuntimeError('tarih yok')
    # CurseForge onaydan önce yüklenen dosyanın tarihini 'güncelleme' sayar; yayından eski olamaz.
    created, updated = iso(m.group(2)), iso(m.group(1))
    return {'created': created, 'updated': max(created, updated)}


def from_cfwidget(slugs):
    mods = {}
    for s in slugs:
        try:
            d = json.loads(get('https://api.cfwidget.com/minecraft/mc-mods/' + s, tries=2))
            mods[s] = {'name': d.get('title', s), 'dl': int(d.get('downloads', {}).get('total', 0))}
        except Exception as e:
            print('cfwidget', s, e)
    if len(mods) < len(slugs):
        raise RuntimeError('cfwidget eksik döndü')
    return mods, sum(v['dl'] for v in mods.values())


def project_ids():
    """slug -> CurseForge proje kimliği (generated.js'ten)."""
    t = open(GEN_JS, encoding='utf8').read()
    g = json.loads(t[t.index('=') + 1:].rstrip().rstrip(';'))
    return {k: v['projectId'] for k, v in g.items() if v.get('projectId')}


def fetch_comments(pid):
    """Bir projenin herkese açık yorumları (CurseForge'un kendi sitesinin yorum uç noktası; anahtar gerekmez)."""
    out, idx = [], 0
    while idx < 500:
        d = json.loads(get('https://www.curseforge.com/api/v1/mods/%d/comments?index=%d&pageSize=50' % (pid, idx), {'Accept': 'application/json'}, tries=3))
        rows = d.get('data', [])
        for c in rows:
            if c.get('status', 1) != 1:
                continue
            txt = (c.get('text') or re.sub(r'<[^>]+>', '', c.get('body') or '')).strip()
            if not txt:
                continue
            at = c.get('datePosted')
            out.append({'id': c.get('id'), 'n': ((c.get('author') or {}).get('displayName') or '').strip()[:60] or 'CurseForge',
                        't': txt[:1500], 'd': iso(at)[:10] if at else '', 'p': bool(c.get('isPinned'))})
        idx += len(rows)
        if not rows or idx >= d.get('pagination', {}).get('totalCount', 0):
            break
        time.sleep(1)
    out.sort(key=lambda c: (not c['p'], -(c['id'] or 0)))
    return out


def update_comments():
    """Her modun CurseForge yorumlarını banebender/data/comments.js'e yazar; alınamayan modun eski yorumları korunur."""
    old = {}
    if os.path.exists(COMMENTS):
        t = open(COMMENTS, encoding='utf8').read()
        m = re.search(r'window\.BB_COMMENTS=(\{.*\});', t, re.S)
        if m:
            old = json.loads(m.group(1))
    new = dict(old)
    for slug, pid in sorted(project_ids().items()):
        try:
            new[slug] = fetch_comments(pid)
        except Exception as e:
            print('yorumlar alınamadı', slug, e)
        time.sleep(1)
    new = {k: new[k] for k in sorted(new) if new[k]}
    if new == old and os.path.exists(COMMENTS):
        print('Yorumlarda değişiklik yok.')
        return
    with open(COMMENTS, 'w', encoding='utf8', newline='\n') as f:
        f.write('/* Otomatik: tools/update_stats.py (6 saatte bir, GitHub Actions). CurseForge yorumları; elle düzenleme. */\n')
        f.write('window.BB_COMMENTS=' + json.dumps(new, ensure_ascii=False, indent=1) + ';\n')
    print('Yorumlar güncellendi:', sum(len(v) for v in new.values()), 'yorum,', len(new), 'mod')


def main():
    rc = main_stats()
    try:
        update_comments()
    except Exception as e:  # yorumlar sayıları engellemesin
        print('Yorum güncellemesi başarısız:', e)
    return rc


def main_stats():
    mods = total = None
    source = ''
    key = os.environ.get('CF_API_KEY', '').strip()
    if key:
        try:
            mods, total = from_api(key); source = 'api'
        except Exception as e:
            print('API başarısız:', e)
    if mods is None:
        try:
            mods, total = from_profile(); source = 'profile'
        except Exception as e:
            print('Profil başarısız:', e)
    known = set(re.findall(r"slug: '([a-z0-9-]+)'", open(MODS_JS, encoding='utf8').read()))
    if mods is None:
        try:
            mods, total = from_cfwidget(sorted(known)); source = 'cfwidget'
        except Exception as e:
            print('cfwidget başarısız:', e)
            print('Güncelleme yok; mevcut sayılar kalıyor.')
            # Sessizce yeşil kalmasın: iş akışı kırmızı olsun ki fark edilsin (CurseForge sayfa düzeni değişmiş olabilir).
            return 1

    new = sorted(s for s in mods if s not in known)

    # Sayılar değişmediyse dosyaya dokunma (gereksiz commit olmasın).
    old = None
    if os.path.exists(OUT):
        t = open(OUT, encoding='utf8').read()
        m = re.search(r'window\.BB_STATS=(\{.*\});', t, re.S)
        if m:
            old = json.loads(m.group(1))
    # Tarihler: API verdiyse onlar; yoksa eskiler korunur ve günde bir kez proje sayfalarından tazelenir.
    old_mods = (old or {}).get('mods', {})
    now = datetime.datetime.now(datetime.timezone.utc)
    last = (old or {}).get('datesAt')
    stale = not last or (now - datetime.datetime.strptime(last, '%Y-%m-%dT%H:%MZ').replace(tzinfo=datetime.timezone.utc)).total_seconds() > 20 * 3600
    dates_at = last
    for slug, v in mods.items():
        prev = old_mods.get(slug, {})
        if v.get('created', 'Z') == 'Z':
            v.pop('created', None); v.pop('updated', None)
        if 'created' not in v and (stale or 'created' not in prev):
            try:
                v.update(dates_from_page(slug)); dates_at = now.strftime('%Y-%m-%dT%H:%MZ'); time.sleep(1.5)
            except Exception as e:
                print('tarih alınamadı', slug, e)
        for k in ('created', 'updated'):
            if k not in v and k in prev:
                v[k] = prev[k]
    payload = {'total': total, 'projects': len(mods), 'mods': {k: mods[k] for k in sorted(mods)}, 'unlisted': new}
    if old and dates_at == last and {k: old.get(k) for k in payload} == payload:
        print('Değişiklik yok.')
        payload = None
    if payload:
        payload['updated'] = now.strftime('%Y-%m-%dT%H:%MZ')
        payload['source'] = source
        payload['datesAt'] = dates_at
        with open(OUT, 'w', encoding='utf8', newline='\n') as f:
            f.write('/* Otomatik: tools/update_stats.py (6 saatte bir, GitHub Actions). Elle düzenleme. */\n')
            f.write('window.BB_STATS=' + json.dumps(payload, ensure_ascii=False, indent=1) + ';\n')
        print('Güncellendi:', total, 'indirme,', len(mods), 'proje, kaynak:', source)

    with open(NEW, 'w', encoding='utf8', newline='\n') as f:
        f.write(''.join('%s\t%s\n' % (s, mods[s]['name']) for s in new))
    if new:
        print('Wikide sayfası olmayan modlar:', ', '.join(new))
    return 0


if __name__ == '__main__':
    sys.exit(main())
