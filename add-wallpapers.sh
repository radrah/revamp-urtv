#!/usr/bin/env bash
# Turns the pictures in ./my-wallpapers into TV-sized wallpapers for Navy Home.
# 1. Put images in my-wallpapers/ (jpg, png, webp, heic).  2. ./add-wallpapers.sh  3. ./tv-install.sh
# They replace the built-in wallpapers and are used by the home screen AND the screensaver.
# Delete everything in my-wallpapers/ and run again to go back to the built-in set.
set -e
cd "$(dirname "$0")"
SRC="my-wallpapers"
DEST="app/src/main/assets/www/wallpapers"
mkdir -p "$SRC"
rm -f "$DEST"/custom-*.jpg "$DEST"/custom.js

n=0; names=""
# search sub-folders too; skip Mac junk
while IFS= read -r f; do
  n=$((n+1)); id=$(printf "custom-%03d" "$n")
  # 1920px on the long edge, JPEG ~80%: sharp on a 4K TV but light enough to stay fast
  if sips -Z 1920 -s format jpeg -s formatOptions 80 "$f" --out "$DEST/$id.jpg" >/dev/null 2>&1; then
    names="$names'$id',"
  else
    n=$((n-1)); echo "skipped (could not convert): $f"
  fi
done < <(find "$SRC" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.heic' \) -not -path '*__MACOSX*' -not -name '._*' | sort)

if [ "$n" -eq 0 ]; then
  echo "No images found in $SRC/. Built-in wallpapers will be used."
else
  echo "window.CUSTOM_WALLS=[${names%,}];" > "$DEST/custom.js"
  echo ">> $n wallpapers ready. Now run ./tv-install.sh"
fi
