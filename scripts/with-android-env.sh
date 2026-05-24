#!/usr/bin/env bash

set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
export PATH="/opt/homebrew/opt/openjdk@17/bin:$ANDROID_SDK_ROOT/platform-tools:/opt/homebrew/bin:$PATH"

if [[ $# -eq 0 ]]; then
  echo "JAVA_HOME=$JAVA_HOME"
  echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
  echo "ANDROID_HOME=$ANDROID_HOME"
  exit 0
fi

exec "$@"
