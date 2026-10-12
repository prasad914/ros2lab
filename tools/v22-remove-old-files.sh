#!/usr/bin/env bash
# V22: delete the files the update removed (copying the update over the project does not delete them).
# Run from the project folder:  bash tools/v22-remove-old-files.sh
set -e
for f in public/js/games/{lidar,warehouse,tftree,hover,controllers,pickplace}.js \
         public/css/games/{lidar,warehouse,tftree,hover,controllers,pickplace}.css \
         tests/games-lidar-hover.mjs tests/games-warehouse-tftree.mjs tests/games-controllers-pickplace.mjs; do
  [ -e "$f" ] && rm -v "$f"
done
echo "done"
