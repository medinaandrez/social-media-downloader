#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_ENV="$ROOT_DIR/scripts/with-android-env.sh"

echo "Checking Android toolchain..."
bash "$WITH_ENV"
echo
bash "$WITH_ENV" java -version
echo
bash "$WITH_ENV" adb version
echo
bash "$WITH_ENV" sdkmanager --version
echo
bash "$WITH_ENV" sdkmanager --list_installed | sed -n '1,80p'
echo
bash "$WITH_ENV" adb devices
