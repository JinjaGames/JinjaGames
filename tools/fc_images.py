# JinjaFC görselleri: EA'in oyuncu fotoğraflarını ve kulüp armalarını küçük WebP'lere çevirip siteye koyar.
# Oyuncu fotoğrafları (512 px, ~350 KB) yalnızca reytingi MIN_RATING ve üstü olanlar için indirilir;
# diğerlerinde (ya da dosya yoksa) arayüz EA'in kendi adresine düşer. Zaten olan dosyalar tekrar indirilmez.
# Kullanım: python tools/fc_images.py   (Pillow gerekir)
import json, os, sys, io, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "jinjafc", "data", "players.json")
PDIR = os.path.join(ROOT, "jinjafc", "img", "ph")
CDIR = os.path.join(ROOT, "jinjafc", "img", "c")
MIN_RATING = int(os.environ.get("FC_MIN_RATING", "70"))
AV = "https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p{}.png"
UA = {"User-Agent": "JinjaFC image updater"}


def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except Exception as e:
            if getattr(e, "code", 0) in (403, 404):
                return None
            time.sleep(1.5 * 2 ** i)
    return None


def save(raw, path, size, crop):
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    if crop:  # arma: kenar boşluğunu at, kareye ortala
        box = im.getbbox()
        if box:
            im = im.crop(box)
        w, h = im.size
        s = max(w, h)
        sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        sq.paste(im, ((s - w) // 2, (s - h) // 2))
        im = sq
    # oyuncu fotoğrafı: EA'in 512'lik kadrajı olduğu gibi küçültülür (kart üstündeki yeri birebir aynı olsun)
    im.resize((size, size), Image.LANCZOS).save(path, "WEBP", quality=80, method=6)


def job(kind, key, url):
    path = os.path.join(PDIR if kind == "p" else CDIR, f"{key}.webp")
    if os.path.exists(path):
        return 0
    raw = get(url)
    if not raw:
        return 0
    try:
        save(raw, path, 200 if kind == "p" else 72, kind != "p")
        return 1
    except Exception:
        return 0


def main():
    os.makedirs(PDIR, exist_ok=True)
    os.makedirs(CDIR, exist_ok=True)
    d = json.load(open(DATA, encoding="utf-8"))
    crests = json.load(open(os.path.join(ROOT, "tools", "fc_crests.json"), encoding="utf-8"))
    jobs = [("c", k, u + ("&" if "?" in u else "?") + "w=144") for k, u in crests.items()]
    jobs += [("p", p[0], AV.format(p[0])) for p in d["players"] if p[2] >= MIN_RATING]
    t = time.time()
    with ThreadPoolExecutor(int(os.environ.get("FC_PAR", "12"))) as ex:
        n = sum(ex.map(lambda j: job(*j), jobs))
    print(f"{n} yeni görsel, {len(os.listdir(PDIR))} oyuncu fotoğrafı, {len(os.listdir(CDIR))} arma, {time.time() - t:.0f} sn")


if __name__ == "__main__":
    sys.exit(main())
