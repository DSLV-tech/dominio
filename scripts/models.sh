#!/usr/bin/env bash
# Rigenera i pezzi 3D (truppe, bandiere, dadi, arena, stemmi) da Blender
# e li comprime con Draco.  Uso:  ./scripts/models.sh  [--no-render]
set -euo pipefail
cd "$(dirname "$0")/.."

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
if [ ! -x "$BLENDER" ]; then BLENDER="$(command -v blender || true)"; fi
if [ -z "$BLENDER" ]; then echo "Blender non trovato: imposta BLENDER=/percorso/blender"; exit 1; fi

echo "▸ Costruisco i pezzi con $BLENDER"
"$BLENDER" -b --factory-startup -P blender/build_pezzi.py -- "$@"

echo "▸ Compressione Draco"
for f in truppe dadi arena; do
  npx --yes @gltf-transform/cli@4 draco "public/models/$f.glb" "public/models/$f.tmp.glb" >/dev/null
  mv "public/models/$f.tmp.glb" "public/models/$f.glb"
done
ls -lh public/models public/ui
echo "✓ Fatto"
