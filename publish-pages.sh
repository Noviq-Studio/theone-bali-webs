#!/usr/bin/env bash
# Regenera la vista previa en GitHub Pages (rama gh-pages) con las 3 variantes,
# la web original y el comparador. Los symlinks de assets se copian de verdad.
#
#   ./publish-pages.sh
set -euo pipefail
cd "$(dirname "$0")"

SITE="$(mktemp -d)"
cp index.html "$SITE/"
cp -RL TheOne-Bali-Web "$SITE/TheOne-Bali-Web"
for v in v1-editorial v2-cinematic v3-investor; do
  cp -RL "$v" "$SITE/$v"
done
find "$SITE" -name .DS_Store -delete
touch "$SITE/.nojekyll"

REMOTE="$(git remote get-url origin)"
( cd "$SITE" \
  && git init -q -b gh-pages \
  && git add -A \
  && git commit -q -m "Vista previa $(date +%F)" \
  && git push -f "$REMOTE" gh-pages )
rm -rf "$SITE"
echo "Publicado. La URL aparece en Settings -> Pages del repositorio."
