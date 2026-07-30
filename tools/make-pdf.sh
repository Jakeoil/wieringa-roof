#!/bin/sh
# Render sheets.html to a print-ready PDF, then verify it is at true size.
#
#   sh tools/make-pdf.sh
#
# The browser's own Save-as-PDF gives the same result — this exists so the PDF can
# be produced reproducibly and, more importantly, *checked*. Scale is the one thing
# in this pipeline that can silently go wrong: every angle and length is exact right
# up to the moment a print driver decides to fit-to-page.
#
# Needs Google Chrome. Nothing else in the project does, which is why this is a
# script rather than part of the build.
set -e

OUT=sheets/wieringa-sheets.pdf
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
    echo "Chrome not found. Open sheets.html and use Print → Save as PDF instead;" >&2
    echo "set scale to 100% and margins to none." >&2
    exit 1
fi

node tools/make-sheets.mjs

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$PWD/$OUT" "file://$PWD/sheets.html" 2>&1 | tail -1

python3 tools/check-pdf.py "$OUT"
