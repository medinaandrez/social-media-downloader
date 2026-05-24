#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 /path/to/youtube-cookies.txt" >&2
  exit 1
fi

cookies_file="$1"

if [ ! -f "$cookies_file" ]; then
  echo "Cookies file not found: $cookies_file" >&2
  exit 1
fi

encoded_file="$(mktemp)"
trap 'rm -f "$encoded_file"' EXIT

base64 <"$cookies_file" | tr -d '\n' >"$encoded_file"

if npx vercel env ls 2>/dev/null | rg -q '^YTDLP_YOUTUBE_COOKIES_B64\\b'; then
  npx vercel env rm YTDLP_YOUTUBE_COOKIES_B64 production --yes >/dev/null
fi

npx vercel env add YTDLP_YOUTUBE_COOKIES_B64 production <"$encoded_file"
echo "YTDLP_YOUTUBE_COOKIES_B64 updated in Vercel production."
