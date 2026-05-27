#!/bin/sh
set -eu

provider_pid=""

if [ -f "/app/bgutil-ytdlp-pot-provider/server/build/main.js" ]; then
  node /app/bgutil-ytdlp-pot-provider/server/build/main.js --port "${BGUTIL_PROVIDER_PORT:-4416}" &
  provider_pid="$!"
fi

cleanup() {
  if [ -n "$provider_pid" ]; then
    kill "$provider_pid" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

npx tsx scripts/youtube-resolve-service.ts
