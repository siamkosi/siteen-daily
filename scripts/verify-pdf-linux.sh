#!/bin/sh
set -eu
test "$(uname -s)" = Linux
mkdir -p /tmp/pdf-verification
printf '{"status":"running"}\n' > /tmp/pdf-verification/verification.json
finish() {
  code=$?
  if [ "$code" -ne 0 ]; then
    printf '{"status":"failed","exit_code":%s}\n' "$code" > /tmp/pdf-verification/verification.json
  fi
}
trap finish EXIT
node --experimental-strip-types scripts/pdf-smoke.mjs /tmp/pdf-verification
for kind in report request; do
  pdfinfo "/tmp/pdf-verification/$kind.pdf" > "/tmp/pdf-verification/$kind.info"
  pdffonts "/tmp/pdf-verification/$kind.pdf" > "/tmp/pdf-verification/$kind.fonts"
  pdftotext -layout "/tmp/pdf-verification/$kind.pdf" "/tmp/pdf-verification/$kind.txt"
  grep -Eq '^Pages:[[:space:]]+2$' "/tmp/pdf-verification/$kind.info"
  # Chromium may embed variable-font glyphs as Type 3 outlines without a font name.
  awk 'NR>2 && NF>=8 {found=1; if ($(NF-4)!="yes") bad=1} END {exit (!found || bad)}' "/tmp/pdf-verification/$kind.fonts"
  pdfimages -list "/tmp/pdf-verification/$kind.pdf" | awk '$1==2 && $3=="image" && $4>=200 {found=1} END {exit !found}'
  grep -q 'SiteEN DAILY' "/tmp/pdf-verification/$kind.info"
  grep -q 'ทดสอบเอกสารภาษาไทย' "/tmp/pdf-verification/$kind.txt"
  grep -q 'ตรวจแบบหล่อ' "/tmp/pdf-verification/$kind.txt"
  grep -q 'ฟอนต์ไทย' "/tmp/pdf-verification/$kind.txt"
  pdftoppm -f 1 -singlefile -scale-to 1200 -png "/tmp/pdf-verification/$kind.pdf" "/tmp/pdf-verification/$kind-page-1" >/dev/null 2>&1
  pdftoppm -f 2 -singlefile -scale-to 1200 -png "/tmp/pdf-verification/$kind.pdf" "/tmp/pdf-verification/$kind-page-2" >/dev/null 2>&1
done
# Layout extraction splits diagonal watermarks across lines; raw order preserves them.
pdftotext -raw /tmp/pdf-verification/request.pdf /tmp/pdf-verification/request.raw.txt
tr -d '[:space:]' < /tmp/pdf-verification/request.raw.txt | grep -q 'CANCELLED'
printf '{"status":"passed","platform":"linux","two_pages":true,"thai_text":true,"embedded_fonts":true,"images":true,"title":true,"cancellation_watermark":true}\n' > /tmp/pdf-verification/verification.json
echo 'PASS: Linux Chromium; two-page PDFs, Thai text/font, images, and cancellation watermark'
