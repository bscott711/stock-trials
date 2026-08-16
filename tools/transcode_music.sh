#!/usr/bin/env bash
# Regenerate the web-weight music set from the git-LFS originals.
# Originals are ~192kbps (~114MB total); these come out ~112kbps (~50MB),
# which is what actually gets deployed. Output is gitignored.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="version_2/music_assets"
DST="version_2/music_assets_web"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }

mkdir -p "$DST"
n=0
for f in "$SRC"/*.mp3; do
    ffmpeg -nostdin -loglevel error -y -i "$f" \
        -c:a libmp3lame -q:a 6 -ar 44100 -ac 2 \
        "$DST/$(basename "$f")" </dev/null
    n=$((n + 1))
done

# The manifest the game fetches at runtime; must match the files beside it.
printf '%s\n' "$DST"/*.mp3 | sed 's|.*/||' | sort > "$DST/tracklist.txt"

echo "transcoded $n tracks"
du -sh "$SRC" "$DST"
