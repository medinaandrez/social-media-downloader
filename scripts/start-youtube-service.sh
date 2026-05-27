#!/bin/sh
set -eu

app_root="${APP_ROOT:-$(pwd)}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$app_root/.render/config}"

provider_pid=""
provider_entry=""

for candidate in \
  "$app_root/.render/bgutil-ytdlp-pot-provider/server/build/main.js" \
  "$app_root/bgutil-ytdlp-pot-provider/server/build/main.js" \
  "/app/bgutil-ytdlp-pot-provider/server/build/main.js"; do
  if [ -f "$candidate" ]; then
    provider_entry="$candidate"
    break
  fi
done

if [ -n "$provider_entry" ]; then
  node "$provider_entry" --port "${BGUTIL_PROVIDER_PORT:-4416}" &
  provider_pid="$!"
fi

cleanup() {
  if [ -n "$provider_pid" ]; then
    kill "$provider_pid" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

npx tsx scripts/youtube-resolve-service.ts
