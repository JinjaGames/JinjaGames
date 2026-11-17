#!/bin/sh
# JinjaCut Helper (Mac / Linux):  sh baslat.sh
cd "$(dirname "$0")" || exit 1
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then echo "Python 3 gerekli / Python 3 is required: https://www.python.org/downloads/"; exit 1; fi
echo "  1) Bu bilgisayar / This computer"
echo "  2) Telefon (QR kod) / Phone (QR code)"
printf "Secim / Choice [1]: "; read M
if [ "$M" = "2" ]; then exec "$PY" jinjacut_helper.py --phone; else exec "$PY" jinjacut_helper.py; fi
