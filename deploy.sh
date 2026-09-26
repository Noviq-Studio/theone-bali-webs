#!/usr/bin/env bash
# Prepara una variante para subir a hosting estático.
# Los assets son un symlink compartido; -L los copia de verdad.
#
#   ./deploy.sh v1-editorial        -> crea dist/v1-editorial/ lista para subir
set -euo pipefail

VARIANT="${1:-}"
if [[ ! -d "$VARIANT" || ! -f "$VARIANT/index.html" ]]; then
  echo "Uso: ./deploy.sh <v1-editorial|v2-cinematic|v3-investor>" >&2
  exit 1
fi

OUT="dist/$VARIANT"
rm -rf "$OUT"
mkdir -p "$OUT"
cp -RL "$VARIANT"/. "$OUT"/          # -L resuelve el symlink de assets

echo "Listo: $OUT ($(du -sh "$OUT" | cut -f1))"
echo "Sube el CONTENIDO de esa carpeta a la raíz del dominio."
