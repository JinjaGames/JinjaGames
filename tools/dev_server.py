"""GitHub Pages'i taklit eden yerel geliştirme sunucusu.

    python tools/dev_server.py [port]

Depo kökünü sunar. Pages gibi davranır: klasör adresi index.html'i açar, sonda
eğik çizgi yoksa yönlendirir, bulunamayan her adres 404 durumuyla kökteki
404.html'i döner. Böylece /football/takim/123 gibi derin bağlantılar yerelde de
yayındaki gibi çalışır (404.html onları uygulamaya geri gönderir).
"""
import http.server
import os
import sys
from urllib.parse import urlsplit, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        fs = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not fs.startswith(ROOT):
            return self._not_found()
        if os.path.isdir(fs):
            if not path.endswith("/"):
                self.send_response(301)
                q = urlsplit(self.path).query
                self.send_header("Location", path + "/" + ("?" + q if q else ""))
                self.end_headers()
                return None
            if not os.path.isfile(os.path.join(fs, "index.html")):
                return self._not_found()
        elif not os.path.isfile(fs):
            return self._not_found()
        return super().send_head()

    def _not_found(self):
        body = open(os.path.join(ROOT, "404.html"), "rb").read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return None

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"http://localhost:{port}/")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
