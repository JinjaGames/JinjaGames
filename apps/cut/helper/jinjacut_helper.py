#!/usr/bin/env python3
"""JinjaCut Helper: jinjagames.com/apps/cut sayfasının kullandığı, kendi cihazında çalışan küçük indirme servisi.

Sunucu yok: sayfa, senin bilgisayarında çalışan bu yardımcıya bağlanır. Videoyu yt-dlp + ffmpeg senin
bilgisayarın indirir; sayfa sonucu tarayıcına (ya da telefonuna) aktarır.

  python jinjacut_helper.py            bu bilgisayardaki tarayıcı için
  python jinjacut_helper.py --phone    telefon için de aç (ücretsiz Cloudflare tüneli + QR kod)

Gerekenler (ilk çalıştırmada kendisi kurar): yt-dlp, imageio-ffmpeg, segno (QR). Python 3.8+.
JinjaCut Helper, JinjaGames. İndirdiklerinin telif hakkı ve site koşulları sana aittir."""
import argparse
import hmac
import io
import json
import os
import platform
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.request
import webbrowser
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs, quote

VERSION = '1.0.0'
HOME = os.path.join(os.path.expanduser('~'), '.jinjacut')
SITE = 'https://jinjagames.com/apps/cut/'
ALLOWED_ORIGINS = {'https://jinjagames.com', 'https://www.jinjagames.com'}
MAX_PARALLEL = 2
JOB_TTL = 3600  # bitmiş işin dosyası 1 saat sonra silinir
IS_WIN = os.name == 'nt'
NOWIN = subprocess.CREATE_NO_WINDOW if IS_WIN else 0
FROZEN = getattr(sys, 'frozen', False)  # tek dosyalık .exe olarak paketlenmiş


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- araçlar
def pip(*pkgs, upgrade=False):
    cmd = [sys.executable, '-m', 'pip', 'install', '--user', '--quiet', '--disable-pip-version-check']
    if upgrade:
        cmd.append('-U')
    r = subprocess.run(cmd + list(pkgs), capture_output=True, text=True)
    if r.returncode != 0:
        # --user bazı sanal ortamlarda hata verir
        cmd.remove('--user')
        r = subprocess.run(cmd + list(pkgs), capture_output=True, text=True)
    return r.returncode == 0


def have(mod):
    try:
        __import__(mod)
        return True
    except Exception:
        return False


def ensure_ytdlp_exe(update):
    """Paketlenmiş sürüm: yt-dlp'nin kendi .exe'sini indirir ve her açılışta günceller."""
    exe = os.path.join(HOME, 'yt-dlp.exe')
    if not os.path.exists(exe):
        log('yt-dlp indiriliyor, bir kez yapılır…')
        try:
            download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', exe + '.tmp')
            os.replace(exe + '.tmp', exe)
        except Exception as e:
            sys.exit('yt-dlp indirilemedi. İnternet bağlantını kontrol et. (%s)' % e)
    elif update:
        log('yt-dlp güncelleniyor…')
        try:
            subprocess.run([exe, '-U'], capture_output=True, timeout=180, creationflags=NOWIN)
        except Exception:
            pass
    return exe


def ensure_python_deps(update):
    if FROZEN:
        return
    if not have('yt_dlp'):
        log('yt-dlp kuruluyor…')
        if not pip('yt-dlp[default]'):
            sys.exit('yt-dlp kurulamadı. İnternet bağlantını kontrol et.')
    elif update:
        log('yt-dlp güncelleniyor…')
        pip('yt-dlp[default]', upgrade=True)
    if not shutil.which('ffmpeg') and not have('imageio_ffmpeg'):
        log('ffmpeg kuruluyor…')
        if not pip('imageio-ffmpeg'):
            sys.exit('ffmpeg kurulamadı.')


def ffmpeg_path():
    p = shutil.which('ffmpeg')
    if p:
        return p
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': 'jinjacut-helper'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, 'wb') as f:
        shutil.copyfileobj(r, f)


def machine():
    m = platform.machine().lower()
    return 'arm64' if m in ('arm64', 'aarch64') else 'x64'


def ensure_js_runtime():
    """yt-dlp'nin YouTube için bir JS çalışma ortamına (deno/node) ihtiyacı var."""
    for name in ('deno', 'node'):
        p = shutil.which(name)
        if p:
            return name + ':' + p
    exe = os.path.join(HOME, 'deno.exe' if IS_WIN else 'deno')
    if not os.path.exists(exe):
        sysn = platform.system()
        arch = 'aarch64' if machine() == 'arm64' else 'x86_64'
        triple = {'Windows': 'x86_64-pc-windows-msvc', 'Darwin': arch + '-apple-darwin', 'Linux': arch + '-unknown-linux-gnu'}.get(sysn)
        if not triple:
            return None
        log('JS çalışma ortamı (deno) indiriliyor, bir kez yapılır…')
        try:
            os.makedirs(HOME, exist_ok=True)
            tmp = os.path.join(HOME, 'deno.zip')
            download('https://github.com/denoland/deno/releases/latest/download/deno-%s.zip' % triple, tmp)
            with zipfile.ZipFile(tmp) as z:
                z.extractall(HOME)
            os.remove(tmp)
            if not IS_WIN:
                os.chmod(exe, 0o755)
        except Exception as e:
            log('deno indirilemedi (YouTube bazı videolarda çalışmayabilir):', e)
            return None
    return 'deno:' + exe


class Engine:
    def __init__(self, update=True):
        self.ytdlp = [ensure_ytdlp_exe(update)] if FROZEN else [sys.executable, '-m', 'yt_dlp']
        self.ffmpeg = ffmpeg_path()
        self.js = ensure_js_runtime()

    def base(self):
        a = self.ytdlp + ['--no-playlist', '--encoding', 'utf-8', '--ffmpeg-location', self.ffmpeg]
        if self.js:
            a += ['--js-runtimes', self.js]
        return a


# ---------------------------------------------------------------- işler
def friendly(raw):
    lines = [l for l in raw.strip().split('\n') if l.strip()]
    err = next((l for l in reversed(lines) if 'ERROR' in l), lines[-1] if lines else 'Bilinmeyen hata')
    return re.sub(r'^ERROR:\s*(\[[^\]]+\]\s*)?', '', err).strip()


def valid_url(u):
    try:
        p = urlsplit(u.strip())
    except Exception:
        return False
    return p.scheme in ('http', 'https') and bool(p.netloc) and len(u) < 2000


def video_args(height, lowest):
    # iPhone Fotoğraflar'ın oynatabilmesi için mümkünse H.264 + AAC (mp4) seçilir
    cap = '[height<=%d]' % height if height else ''
    if lowest:
        return ['-f', 'bv*+ba/b', '-S', '+res,+size']
    return ['-f', 'bv*%s[vcodec^=avc]+ba[ext=m4a]/bv*%s+ba/b%s' % (cap, cap, cap),
            '-S', 'res,vcodec:h264,acodec:aac,ext:mp4:m4a']


class Job:
    def __init__(self, engine, url, kind, height, lowest, kbps):
        self.id = secrets.token_urlsafe(9)
        self.engine, self.url, self.kind = engine, url, kind
        self.height, self.lowest, self.kbps = height, lowest, kbps
        self.state, self.progress, self.speed, self.eta = 'queued', 0.0, 0.0, -1.0
        self.status, self.file, self.size, self.error = 'queued', None, 0, None
        self.dir = tempfile.mkdtemp(prefix='jc_', dir=HOME)
        self.proc = None
        self.killed = False
        self.finished = 0.0
        self.total = None
        self.base_bytes = 0.0
        self.last_cur = 0.0
        self.ema = 0.0

    def public(self):
        return {'id': self.id, 'state': self.state, 'progress': round(self.progress, 4), 'speed': self.speed,
                'eta': self.eta, 'status': self.status, 'file': os.path.basename(self.file) if self.file else None,
                'size': self.size, 'error': self.error}

    def args(self):
        a = self.engine.base() + [
            '--newline', '--no-mtime', '--windows-filenames', '--no-part',
            '--concurrent-fragments', '8', '--http-chunk-size', '10M', '--retries', '15', '--fragment-retries', '15',
            '--progress', '--progress-template', 'download:CFP|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s',
            '--progress-template', 'postprocess:CFPP|%(progress.postprocessor)s|%(progress.status)s',
            '--print', 'before_dl:CFSZ|%(requested_formats.0.filesize,requested_formats.0.filesize_approx)s|%(requested_formats.1.filesize,requested_formats.1.filesize_approx)s|%(filesize,filesize_approx)s',
            '--print', 'after_move:CFDONE|%(filepath)s',
            '-P', self.dir, '-o', '%(title).120B.%(ext)s']
        if self.kind == 'audio':
            q = '0' if not self.kbps else ('64K' if self.kbps <= 64 else '%dK' % self.kbps)
            a += ['-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', q, '--embed-metadata']
        else:
            a += video_args(self.height, self.lowest) + ['--merge-output-format', 'mp4', '--embed-metadata']
        return a + ['--', self.url]

    def on_line(self, line):
        if line.startswith('CFSZ|'):
            p = line.split('|')
            n = lambda i: float(p[i]) if i < len(p) and re.fullmatch(r'[\d.]+', p[i].strip()) else None
            a, b, al = n(1), n(2), n(3)
            self.total = a + b if (a is not None and b is not None) else (al if al is not None else a)
        elif line.startswith('CFP|'):
            p = line.split('|')
            try:
                cur = float(p[1])
            except ValueError:
                return
            tot = float(p[2]) if len(p) > 2 and re.fullmatch(r'[\d.]+', p[2].strip()) else None
            spd = float(p[3]) if len(p) > 3 and re.fullmatch(r'[\d.]+', p[3].strip()) else None
            if cur < self.last_cur - 1:
                self.base_bytes += self.last_cur
            self.last_cur = cur
            done = self.base_bytes + cur
            total = self.total if self.total else (self.base_bytes + tot if tot else None)
            if spd:
                self.ema = spd if not self.ema else self.ema * .85 + spd * .15
            if total:
                self.progress = min(done / total, .995)
                self.eta = (total - done) / self.ema if self.ema else -1
            self.speed = self.ema
            self.status = 'downloading'
        elif line.startswith('CFPP|'):
            name = line.split('|')[1] if '|' in line else ''
            self.status = 'merging' if 'Merger' in name else ('mp3' if 'ExtractAudio' in name else 'processing')
            self.progress, self.eta, self.speed = .995, -1, 0
        elif line.startswith('CFDONE|'):
            self.file = line[7:].strip()

    def run(self):
        # siteler ara sıra geçici 403 döndürür; bir kez daha denenir
        for attempt in range(2):
            self.error, self.file, self.total = None, None, None
            self.base_bytes = self.last_cur = self.ema = 0.0
            self.progress = 0.0
            self._attempt()
            if self.state != 'failed' or self.killed or '403' not in (self.error or ''):
                break
            time.sleep(1.5)
        self.finished = time.time()

    def _attempt(self):
        self.state, self.status = 'running', 'preparing'
        try:
            self.proc = subprocess.Popen(self.args(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                         encoding='utf-8', errors='replace', creationflags=NOWIN)
            err = []
            t = threading.Thread(target=lambda: [err.append(l) for l in self.proc.stderr], daemon=True)
            t.start()
            for line in self.proc.stdout:
                self.on_line(line.strip())
            code = self.proc.wait()
            t.join(2)
            if self.killed:
                self.state, self.status = 'canceled', 'canceled'
            elif code == 0 and self.file and os.path.exists(self.file):
                self.size = os.path.getsize(self.file)
                self.state, self.status, self.progress = 'done', 'done', 1.0
            else:
                self.error = friendly(''.join(err)) if err else 'İndirme başarısız'
                self.state, self.status = 'failed', 'failed'
        except Exception as e:
            self.error = str(e)
            self.state, self.status = 'failed', 'failed'

    def cancel(self):
        self.killed = True
        if self.proc and self.proc.poll() is None:
            if IS_WIN:
                subprocess.run(['taskkill', '/PID', str(self.proc.pid), '/T', '/F'], capture_output=True, creationflags=NOWIN)
            else:
                self.proc.kill()
        elif self.state == 'queued':
            self.state, self.status = 'canceled', 'canceled'

    def cleanup(self):
        shutil.rmtree(self.dir, ignore_errors=True)


class Jobs:
    def __init__(self, engine):
        self.engine = engine
        self.jobs = {}
        self.sem = threading.Semaphore(MAX_PARALLEL)
        self.lock = threading.Lock()
        threading.Thread(target=self.reaper, daemon=True).start()

    def create(self, url, kind, height, lowest, kbps):
        j = Job(self.engine, url, kind, height, lowest, kbps)
        with self.lock:
            self.jobs[j.id] = j

        def go():
            with self.sem:
                if j.state == 'queued':
                    j.run()
        threading.Thread(target=go, daemon=True).start()
        return j

    def get(self, jid):
        return self.jobs.get(jid)

    def remove(self, jid):
        with self.lock:
            j = self.jobs.pop(jid, None)
        if j:
            j.cancel()
            time.sleep(.3)
            j.cleanup()

    def reaper(self):
        while True:
            time.sleep(60)
            now = time.time()
            for jid, j in list(self.jobs.items()):
                if j.finished and now - j.finished > JOB_TTL:
                    self.remove(jid)


def info(engine, url):
    cmd = engine.base() + ['-J', '--no-warnings', '--', url]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', creationflags=NOWIN, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(friendly(r.stderr) or 'Bağlantı çözümlenemedi')
    j = json.loads(r.stdout)
    hs = sorted({f['height'] for f in j.get('formats', []) if isinstance(f.get('height'), int) and f['height'] > 0
                 and f.get('vcodec') not in (None, 'none')}, reverse=True)
    return {'title': j.get('title') or 'Video', 'uploader': j.get('uploader') or j.get('channel') or '',
            'duration': j.get('duration') or 0, 'thumbnail': j.get('thumbnail'), 'heights': hs,
            'site': j.get('extractor_key') or ''}


# ---------------------------------------------------------------- HTTP
class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'JinjaCutHelper/' + VERSION
    jobs = None
    engine = None
    token = ''
    extra_origins = set()

    def log_message(self, *a):
        pass

    # --- yardımcılar
    def origin_ok(self):
        o = self.headers.get('Origin')
        return o if o and (o in ALLOWED_ORIGINS or o in self.extra_origins) else None

    def cors(self):
        o = self.origin_ok()
        if o:
            self.send_header('Access-Control-Allow-Origin', o)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'content-type, x-cut-key')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            self.send_header('Access-Control-Expose-Headers', 'content-length, content-disposition')
            if self.headers.get('Access-Control-Request-Private-Network'):
                self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Access-Control-Max-Age', '600')

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        qs = parse_qs(urlsplit(self.path).query)
        k = self.headers.get('X-Cut-Key') or (qs.get('k') or [''])[0]
        return hmac.compare_digest(k.encode(), self.token.encode())

    # --- yöntemler
    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/ping':
            return self.send_json(200, {'ok': True, 'name': 'jinjacut-helper', 'version': VERSION,
                                        'authed': self.authed()})
        if not self.authed():
            return self.send_json(401, {'error': 'unauthorized'})
        m = re.fullmatch(r'/jobs/([\w-]+)(/file)?', path)
        if not m:
            return self.send_json(404, {'error': 'not found'})
        j = self.jobs.get(m.group(1))
        if not j:
            return self.send_json(404, {'error': 'gone'})
        if m.group(2):
            return self.send_file(j)
        self.send_json(200, j.public())

    def do_POST(self):
        path = urlsplit(self.path).path
        if not self.authed():
            return self.send_json(401, {'error': 'unauthorized'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            data = json.loads(self.rfile.read(min(n, 20000)) or b'{}')
        except Exception:
            return self.send_json(400, {'error': 'bad json'})
        url = str(data.get('url', '')).strip()
        if not valid_url(url):
            return self.send_json(400, {'error': 'Geçerli bir http(s) bağlantısı gir'})
        if path == '/info':
            try:
                return self.send_json(200, info(self.engine, url))
            except Exception as e:
                return self.send_json(422, {'error': str(e)})
        if path == '/jobs':
            kind = 'audio' if data.get('kind') == 'audio' else 'video'
            h = data.get('height')
            kb = data.get('kbps')
            j = self.jobs.create(url, kind, h if isinstance(h, int) and 0 < h < 10000 else None,
                                 bool(data.get('lowest')), kb if isinstance(kb, int) and 0 < kb <= 320 else None)
            return self.send_json(200, j.public())
        self.send_json(404, {'error': 'not found'})

    def do_DELETE(self):
        if not self.authed():
            return self.send_json(401, {'error': 'unauthorized'})
        m = re.fullmatch(r'/jobs/([\w-]+)', urlsplit(self.path).path)
        if not m:
            return self.send_json(404, {'error': 'not found'})
        self.jobs.remove(m.group(1))
        self.send_json(200, {'ok': True})

    def send_file(self, j):
        if j.state != 'done' or not j.file or not os.path.exists(j.file):
            return self.send_json(409, {'error': 'not ready'})
        size = os.path.getsize(j.file)
        name = os.path.basename(j.file)
        ctype = 'audio/mpeg' if name.lower().endswith('.mp3') else 'video/mp4'
        start, end = 0, size - 1
        rng = self.headers.get('Range')
        code = 200
        if rng:
            m = re.fullmatch(r'bytes=(\d*)-(\d*)', rng.strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                else:
                    start = max(0, size - int(m.group(2)))
                end = min(end, size - 1)
                if start > end:
                    self.send_response(416)
                    self.send_header('Content-Range', 'bytes */%d' % size)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                code = 206
        self.send_response(code)
        self.cors()
        ascii_name = re.sub(r'[^\w.\- ]', '_', name.encode('ascii', 'ignore').decode()) or 'video.mp4'
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Disposition', 'attachment; filename="%s"; filename*=UTF-8\'\'%s' % (ascii_name, quote(name)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Cache-Control', 'no-store')
        if code == 206:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        try:
            with open(j.file, 'rb') as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(262144, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


# ---------------------------------------------------------------- tünel (telefon için)
def ensure_cloudflared():
    p = shutil.which('cloudflared')
    if p:
        return p
    sysn, arch = platform.system(), machine()
    names = {('Windows', 'x64'): 'cloudflared-windows-amd64.exe', ('Linux', 'x64'): 'cloudflared-linux-amd64',
             ('Linux', 'arm64'): 'cloudflared-linux-arm64', ('Darwin', 'x64'): 'cloudflared-darwin-amd64.tgz',
             ('Darwin', 'arm64'): 'cloudflared-darwin-arm64.tgz'}
    nm = names.get((sysn, arch))
    if not nm:
        return None
    exe = os.path.join(HOME, 'cloudflared.exe' if IS_WIN else 'cloudflared')
    if not os.path.exists(exe):
        log('Cloudflare tüneli indiriliyor, bir kez yapılır…')
        os.makedirs(HOME, exist_ok=True)
        url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/' + nm
        try:
            if nm.endswith('.tgz'):
                tmp = os.path.join(HOME, 'cf.tgz')
                download(url, tmp)
                with tarfile.open(tmp) as t:
                    t.extract('cloudflared', HOME)
                os.remove(tmp)
            else:
                download(url, exe)
            if not IS_WIN:
                os.chmod(exe, 0o755)
        except Exception as e:
            log('cloudflared indirilemedi:', e)
            return None
    return exe


def start_tunnel(port):
    exe = ensure_cloudflared()
    if not exe:
        return None, None
    proc = subprocess.Popen([exe, 'tunnel', '--url', 'http://127.0.0.1:%d' % port, '--no-autoupdate'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, creationflags=NOWIN)
    found = []

    def reader():
        for line in proc.stderr:
            m = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
            if m and not found:
                found.append(m.group(0))
    threading.Thread(target=reader, daemon=True).start()
    t0 = time.time()
    while time.time() - t0 < 40 and not found and proc.poll() is None:
        time.sleep(.3)
    return (found[0] if found else None), proc


def print_qr(text):
    try:
        if not FROZEN and not have('segno'):
            pip('segno')
        import segno
        out = io.StringIO()
        segno.make(text, error='l').terminal(out=out, compact=True)
        log(out.getvalue())
    except Exception:
        pass


def free_port(want):
    for p in range(want, want + 30):
        with socket.socket() as s:
            try:
                s.bind(('127.0.0.1', p))
                return p
            except OSError:
                continue
    sys.exit('Boş port bulunamadı.')


def load_token():
    os.makedirs(HOME, exist_ok=True)
    f = os.path.join(HOME, 'token')
    try:
        t = open(f).read().strip()
        if len(t) >= 30:
            return t
    except OSError:
        pass
    t = secrets.token_urlsafe(32)
    with open(f, 'w') as fh:
        fh.write(t)
    return t


def main():
    ap = argparse.ArgumentParser(description='JinjaCut Helper')
    ap.add_argument('--phone', action='store_true', help='telefon için tünel aç ve QR göster')
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--site', default=SITE, help='sayfa adresi (geliştirme için)')
    ap.add_argument('--no-update', action='store_true', help='yt-dlp güncellemesini atla')
    ap.add_argument('--no-browser', action='store_true')
    args = ap.parse_args()
    if FROZEN and len(sys.argv) == 1:
        for line in ('', '  JinjaCut Helper', '', '  1) Bu bilgisayar / This computer',
                     '  2) Telefon (QR kod) / Phone (QR code)', ''):
            print(line)
        try:
            args.phone = input('  Secim / Choice [1]: ').strip() == '2'
        except EOFError:
            pass

    for st in (sys.stdout, sys.stderr):
        try:
            st.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    os.makedirs(HOME, exist_ok=True)
    log('JinjaCut Helper %s' % VERSION)
    ensure_python_deps(not args.no_update)
    engine = Engine(not args.no_update)
    for d in os.listdir(HOME):  # önceki oturumdan kalan geçici klasörler
        if d.startswith('jc_'):
            shutil.rmtree(os.path.join(HOME, d), ignore_errors=True)

    H.engine, H.jobs, H.token = engine, Jobs(engine), load_token()
    so = urlsplit(args.site)
    if so.hostname in ('localhost', '127.0.0.1'):
        H.extra_origins.add('%s://%s' % (so.scheme, so.netloc))
    port = free_port(args.port)
    srv = ThreadingHTTPServer(('127.0.0.1', port), H)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    local = 'http://127.0.0.1:%d' % port
    link = '%s#h=%s&k=%s' % (args.site, quote(local, safe=''), H.token)
    log('Hazır: ' + local)
    tunnel = None
    if args.phone:
        turl, tunnel = start_tunnel(port)
        if turl:
            plink = '%s#h=%s&k=%s' % (args.site, quote(turl, safe=''), H.token)
            log('\nTelefonunla bu QR kodu okut (ya da aşağıdaki bağlantıyı telefona gönder):\n')
            print_qr(plink)
            log(plink + '\n')
        else:
            log('Tünel açılamadı; yalnızca bu bilgisayar için çalışıyor.')
    if not args.no_browser:
        webbrowser.open(link)
    log('Bu pencereyi açık tut. Kapatmak için Ctrl+C.')
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass
    finally:
        for jid in list(H.jobs.jobs):
            H.jobs.remove(jid)
        if tunnel:
            tunnel.terminate()


if __name__ == '__main__':
    main()
