#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_ENV="$ROOT_DIR/scripts/with-android-env.sh"

bash "$WITH_ENV" sdkmanager \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0"
