#!/usr/bin/env bash
# Propaga los archivos compartidos a las 3 variantes y regenera los idiomas.
# Ejecútalo tras tocar shared/leads.* o cualquier texto de i18n/.
set -euo pipefail
cd "$(dirname "$0")"

for d in v1-editorial v2-cinematic v3-investor; do
  cp shared/leads.js  "$d/js/leads.js"
  cp shared/leads.css "$d/css/leads.css"
  echo "  leads -> $d"
done

echo
python3 tools/i18n_build.py

echo
if [ "$(md5 -q shared/leads.js v1-editorial/js/leads.js v2-cinematic/js/leads.js v3-investor/js/leads.js | sort -u | wc -l)" -eq 1 ]; then
  echo "  OK: leads.js idéntico en las 3 variantes"
else
  echo "  ATENCIÓN: hay divergencias en leads.js"
fi
