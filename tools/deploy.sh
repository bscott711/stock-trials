#!/usr/bin/env bash
# Deploy version_2/ to the Oracle box, served statically by Caddy at
# https://stocktrials.duckdns.org
#
# The full-quality music_assets/ is NOT deployed; the transcoded
# music_assets_web/ is uploaded in its place under the name music_assets/,
# so no application code needs to know which set it is running against.
set -euo pipefail

cd "$(dirname "$0")/.."

HOST="${DEPLOY_HOST:-Oracle}"
ROOT="${DEPLOY_ROOT:-/var/www/stocktrials}"
SRC="version_2"

[ -f "$SRC/music_assets_web/tracklist.txt" ] || {
    echo "music_assets_web/ is missing or unbuilt - run tools/transcode_music.sh first" >&2
    exit 1
}

echo "==> ensuring $ROOT exists on $HOST"
ssh "$HOST" "sudo mkdir -p '$ROOT' && sudo chown -R opc:opc '$ROOT' && sudo chmod -R a+rX '$ROOT'"

echo "==> syncing app"
rsync -az --delete \
    --exclude 'music_assets/' \
    --exclude 'music_assets_web/' \
    "$SRC"/ "$HOST:$ROOT"/

echo "==> syncing audio (music_assets_web -> music_assets)"
rsync -az --delete "$SRC/music_assets_web"/ "$HOST:$ROOT/music_assets"/

echo "==> fixing permissions for the caddy user"
# Caddy runs confined as httpd_t under SELinux. Freshly rsynced files land as
# var_t, which it cannot read, so every request 403s until they are relabelled.
ssh "$HOST" "sudo chmod -R a+rX '$ROOT' && sudo restorecon -R '$ROOT'"

echo "==> done: https://stocktrials.duckdns.org"
